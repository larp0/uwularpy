import OpenAI from "openai";
import { logger } from "@trigger.dev/sdk/v3";
import { sanitizeCommitMessage, validateAIResponse } from "./ai-sanitizer";

/**
 * OpenAI API operations for the codex system.
 * Handles all interactions with OpenAI models with proper error handling and validation.
 */

export interface OpenAIConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export const DEFAULT_CONFIG: OpenAIConfig = {
  model: "gpt-4.1-mini",
  maxTokens: 30000,
  temperature: 0.3
};

export const COMMIT_MESSAGE_CONFIG: OpenAIConfig = {
  model: "gpt-4.1-nano", 
  maxTokens: 420,
  temperature: 0.3
};

export const HIGH_CREATIVITY_CONFIG: OpenAIConfig = {
  model: "gpt-4.1-mini",
  maxTokens: 30000,
  temperature: 0.9
};

/**
 * Select the appropriate OpenAI model based on the requesting user.
 * Uses o3-mini for 0xrinegade and larp0, gpt-4.1-mini for others.
 */
export function selectModelForUser(username: string): string {
  const vipUsers = ['0xrinegade', 'larp0'];
  return vipUsers.includes(username.toLowerCase()) ? 'o3-mini' : 'gpt-4.1-mini';
}

/**
 * Create OpenAI config with user-specific model selection and high creativity settings.
 */
export function createIdeaGenerationConfig(username: string): OpenAIConfig {
  return {
    model: selectModelForUser(username),
    maxTokens: 30000,
    temperature: 0.9 // High creativity for disruptive ideas
  };
}

/**
 * Initialize OpenAI client with error handling.
 */
function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate a response using OpenAI API with proper validation.
 * Handles different API requirements for o3 reasoning models vs GPT models.
 */
export async function generateAIResponse(
  prompt: string, 
  systemMessage?: string,
  config: OpenAIConfig = DEFAULT_CONFIG
): Promise<string> {
  const openai = createOpenAIClient();
  
  logger.log("Calling OpenAI API", { 
    inputLength: prompt.length,
    model: config.model,
    maxTokens: config.maxTokens
  });
  
  try {
    const isReasoningModel = config.model.startsWith('o3');
    
    // Build the request parameters based on model type
    const requestParams: any = {
      model: config.model,
      messages: [
        ...(systemMessage ? [{
          role: "system" as const,
          content: systemMessage
        }] : []),
        {
          role: "user" as const,
          content: prompt
        }
      ]
    };
    
    // o3 reasoning models use different parameter names and don't support temperature
    if (isReasoningModel) {
      requestParams.max_completion_tokens = config.maxTokens;
      requestParams.reasoning_effort = "medium";
      requestParams.response_format = { "type": "text" };
      // o3 models don't support temperature parameter
    } else {
      requestParams.max_tokens = config.maxTokens;
      requestParams.temperature = config.temperature;
    }
    
    const response = await openai.chat.completions.create(requestParams);
    
    const content = response.choices[0]?.message?.content || "";
    
    // Validate the AI response
    const validation = validateAIResponse(content);
    if (!validation.isValid) {
      logger.warn("AI response validation failed", { 
        errors: validation.errors,
        contentLength: content.length
      });
      
      // Use sanitized content but log the issues
      return validation.sanitizedContent;
    }
    
    logger.log("OpenAI API response received", { 
      contentLength: content.length,
      contentPreview: content.substring(0, 100)
    });
    
    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("OpenAI API call failed", { 
      error: errorMessage,
      model: config.model,
      promptLength: prompt.length
    });
    throw new Error(`OpenAI API failed: ${errorMessage}`);
  }
}

/**
 * Generate an AI-powered commit message based on git diff.
 */
export async function generateCommitMessage(diffContent: string): Promise<string> {
  if (!diffContent.trim()) {
    return "Apply changes from OpenAI API self-ask flow (no changes made)";
  }
  
  try {
    const systemMessage = `You are a helpful assistant that generates concise, informative git commit messages. Based on the provided git diff, create a single line commit message that clearly describes what was changed. Use conventional commit format when appropriate (feat:, fix:, refactor:, etc.). Keep it under 72 characters if possible.`;
    
    const prompt = `Generate a commit message for this git diff:\n\n${diffContent}`;
    
    const response = await generateAIResponse(prompt, systemMessage, COMMIT_MESSAGE_CONFIG);
    
    // Additional sanitization for commit messages
    const cleanMessage = sanitizeCommitMessage(response);
    
    logger.log("Generated commit message", { message: cleanMessage });
    
    return cleanMessage;
  } catch (error) {
    logger.warn("Failed to generate AI commit message, using fallback", { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return "Apply changes from OpenAI API self-ask flow";
  }
}

/**
 * Run the self-ask flow with OpenAI API.
 */
export async function runSelfAskFlow(
  initialPrompt: string,
  maxIterations: number = 10
): Promise<string[]> {
  const responses: string[] = [];
  
  let currentPrompt = initialPrompt + "\n\nPlease respond with a detailed, step-by-step continuation if further clarification or changes are needed. Leave empty if complete. If you need to modify files, use SEARCH/REPLACE blocks following this format:\n\n```search-replace\nFILE: path/to/file.ext\n<<<<<<< SEARCH\nexact content to find\n=======\nnew content to replace with\n>>>>>>> REPLACE\n```";
  
  const systemMessage = `You are a helpful coding assistant. When asked to modify files, use SEARCH/REPLACE blocks following this format:\n\n\`\`\`search-replace\nFILE: path/to/file.ext\n<<<<<<< SEARCH\nexact content to find\n=======\nnew content to replace with\n>>>>>>> REPLACE\n\`\`\``;
  
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    logger.log("Running OpenAI API self-ask iteration", { 
      iteration, 
      promptLength: currentPrompt.length 
    });
    
    try {
      const response = await generateAIResponse(currentPrompt, systemMessage);
      
      if (!response || response.trim() === currentPrompt.trim()) {
        logger.log("No new self reply, ending self-ask flow", { iteration });
        break;
      }
      
      responses.push(response);
      currentPrompt = response;
      
      logger.log("Self-ask iteration completed", {
        iteration,
        responseLength: response.length
      });
    } catch (error) {
      if (iteration === 1) {
        // Fail on first iteration
        throw error;
      } else {
        // Continue after first successful iteration
        logger.warn("Self-ask iteration failed, ending flow", {
          iteration,
          error: String(error)
        });
        break;
      }
    }
  }
  
  return responses;
}