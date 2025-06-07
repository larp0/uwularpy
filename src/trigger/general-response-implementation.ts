// src/trigger/general-response-implementation.ts

import { logger } from "@trigger.dev/sdk/v3";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";

interface ConversationMessage {
  author: string;
  body: string;
  createdAt: string;
  isBot: boolean;
}

/**
 * Runs the general response task to analyze thread conversation and provide helpful responses
 */
export async function runGeneralResponseTask(payload: GitHubContext, ctx: any) {
  logger.log("Starting general response analysis", { payload });

  try {
    // Create an authenticated Octokit instance
    const octokit = await createAuthenticatedOctokit(payload.installationId);
    
    // Fetch all comments from the issue/PR thread
    const conversation = await fetchConversationHistory(octokit, payload.owner, payload.repo, payload.issueNumber);
    logger.log("Fetched conversation history", { messageCount: conversation.length });
    
    // Check if there are any specific questions directed at @l bot
    const botQuestions = identifyBotQuestions(conversation, payload.message || '');
    
    // Generate response using GPT-4-turbo (using gpt-4 as GPT-4.1-nano isn't available yet)
    const response = await generateContextualResponse(conversation, botQuestions, payload.message || '');
    logger.log("Generated contextual response");
    
    // Post the response as a comment
    await postResponseComment(octokit, payload.owner, payload.repo, payload.issueNumber, response);
    logger.log("Posted response comment successfully");
    
    return {
      success: true,
      response: response,
      conversationLength: conversation.length,
      botQuestionsFound: botQuestions.length
    };
    
  } catch (error) {
    logger.error("Error in general response task", { error });
    
    // Post a fallback error response
    try {
      const octokit = await createAuthenticatedOctokit(payload.installationId);
      await postResponseComment(
        octokit, 
        payload.owner, 
        payload.repo, 
        payload.issueNumber, 
        "I encountered an error while analyzing the conversation. Please try again or use a specific command like `@l plan` or `@l review`."
      );
    } catch (fallbackError) {
      logger.error("Failed to post fallback error message", { fallbackError });
    }
    
    throw error;
  }
}

/**
 * Fetches all comments from the GitHub issue/PR thread
 */
async function fetchConversationHistory(
  octokit: any, 
  owner: string, 
  repo: string, 
  issueNumber: number
): Promise<ConversationMessage[]> {
  try {
    // Get the issue/PR details first
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    
    // Get all comments
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100, // Get up to 100 comments
    });
    
    const conversation: ConversationMessage[] = [];
    
    // Add the original issue/PR as the first message
    conversation.push({
      author: issue.user.login,
      body: issue.body || '',
      createdAt: issue.created_at,
      isBot: issue.user.type === 'Bot'
    });
    
    // Add all comments
    for (const comment of comments) {
      conversation.push({
        author: comment.user.login,
        body: comment.body,
        createdAt: comment.created_at,
        isBot: comment.user.type === 'Bot'
      });
    }
    
    return conversation;
    
  } catch (error) {
    logger.error("Error fetching conversation history", { error });
    throw new Error(`Failed to fetch conversation: ${error}`);
  }
}

/**
 * Identifies questions or requests specifically directed at the @l bot
 */
function identifyBotQuestions(conversation: ConversationMessage[], currentMessage: string): ConversationMessage[] {
  const botQuestions: ConversationMessage[] = [];
  
  // Patterns that indicate questions directed at the bot
  const botQuestionPatterns = [
    /@l\s+bot/i,
    /@uwularpy/i,
    /what.*do.*you.*think/i,
    /can.*you.*help/i,
    /do.*you.*know/i,
    /what.*should.*i/i,
    /how.*do.*i/i,
    /could.*you/i,
    /would.*you/i
  ];
  
  // Check current message first
  if (botQuestionPatterns.some(pattern => pattern.test(currentMessage))) {
    botQuestions.push({
      author: 'current_user',
      body: currentMessage,
      createdAt: new Date().toISOString(),
      isBot: false
    });
  }
  
  // Check recent conversation (last 10 messages)
  const recentMessages = conversation.slice(-10);
  for (const message of recentMessages) {
    if (!message.isBot && botQuestionPatterns.some(pattern => pattern.test(message.body))) {
      botQuestions.push(message);
    }
  }
  
  return botQuestions;
}

/**
 * Generates a contextual response using GPT-4
 */
async function generateContextualResponse(
  conversation: ConversationMessage[], 
  botQuestions: ConversationMessage[], 
  currentMessage: string
): Promise<string> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }
    
    // Prepare conversation context (limit to last 15 messages to stay within token limits)
    const recentConversation = conversation.slice(-15);
    const conversationText = recentConversation
      .map(msg => `${msg.author}: ${msg.body}`)
      .join('\n\n');
    
    // Prepare bot questions context
    const botQuestionsText = botQuestions.length > 0 
      ? `\n\nSpecific questions/requests directed at me:\n${botQuestions.map(q => `${q.author}: ${q.body}`).join('\n')}`
      : '';
    
    const systemPrompt = `You are uwularpy, a helpful GitHub bot assistant. You help developers with code reviews, planning, and general development questions.

Your capabilities include:
- Code review (@l review or @l r)
- Development planning (@l plan <description>)
- Milestone approval (@l approve, @l yes, @l ok, etc.)
- Development tasks (@l dev <description>)

Context: You're responding to a mention in a GitHub issue/PR thread. Analyze the conversation and provide helpful, relevant responses.

Guidelines:
1. If there are specific questions directed at you, answer them first
2. Be concise and actionable
3. Suggest appropriate commands when relevant
4. Be friendly but professional
5. Focus on the most recent and relevant parts of the conversation
6. If the conversation is about a specific technical issue, provide guidance
7. If unclear what they want, ask clarifying questions or suggest specific commands

Current user message: "${currentMessage}"`;

    const userPrompt = `Conversation history:
${conversationText}${botQuestionsText}

Please analyze this conversation and provide a helpful response. Focus on:
1. Any direct questions asked to me
2. The overall context and what the user might need help with
3. Actionable next steps or suggestions`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4", // Using gpt-4 as gpt-4.1-nano isn't available
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseContent = data.choices?.[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    return responseContent.trim();
    
  } catch (error) {
    logger.error("Error generating contextual response", { error });
    
    // Fallback response
    if (botQuestions.length > 0) {
      return "I see you have some questions for me! I can help with code reviews (`@l review`), development planning (`@l plan <description>`), or specific development tasks (`@l dev <description>`). Could you let me know what specific help you need?";
    } else {
      return "Hi! I'm here to help with your development needs. You can use commands like:\n\n- `@l review` for code reviews\n- `@l plan <description>` for development planning\n- `@l dev <description>` for development tasks\n- `@l approve` to approve proposed plans\n\nWhat can I help you with?";
    }
  }
}

/**
 * Posts the generated response as a comment on the issue/PR
 */
async function postResponseComment(
  octokit: any, 
  owner: string, 
  repo: string, 
  issueNumber: number, 
  response: string
): Promise<void> {
  try {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: response
    });
    
  } catch (error) {
    logger.error("Error posting response comment", { error });
    throw new Error(`Failed to post comment: ${error}`);
  }
}