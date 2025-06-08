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
  model: "gpt-4",
  maxTokens: 30000,
  temperature: 0.3
};

export const COMMIT_MESSAGE_CONFIG: OpenAIConfig = {
  model: "gpt-4", 
  maxTokens: 420,
  temperature: 0.3
};

export const CODEX_CONFIG: OpenAIConfig = {
  model: "gpt-4",
  maxTokens: 16000,
  temperature: 0.1  // Lower temperature for more deterministic code generation
};

/**
 * Initialize OpenAI client with comprehensive error handling.
 * Ensures OPENAI_API_KEY is always properly validated.
 */
function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Comprehensive validation of API key
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set. Please configure your OpenAI API key.');
  }
  
  if (typeof apiKey !== 'string') {
    throw new Error('OPENAI_API_KEY must be a string value.');
  }
  
  if (apiKey.trim().length === 0) {
    throw new Error('OPENAI_API_KEY cannot be empty.');
  }
  
  // Basic format validation (OpenAI keys typically start with 'sk-')
  if (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk-proj-')) {
    logger.warn('API key format may be invalid', { 
      keyPrefix: apiKey.substring(0, 6),
      keyLength: apiKey.length 
    });
  }
  
  return new OpenAI({
    apiKey: apiKey,
  });
}

/**
 * Generate a response using OpenAI API with proper validation.
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
    const response = await openai.chat.completions.create({
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
      ],
      max_tokens: config.maxTokens,
      temperature: config.temperature
    });
    
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

/**
 * Generate code changes using OpenAI API for development tasks.
 * This replaces the deprecated Codex CLI functionality.
 */
export async function generateCodeChanges(
  prompt: string,
  repositoryContext?: string,
  config: OpenAIConfig = CODEX_CONFIG
): Promise<string> {
  try {
    logger.log("Generating code changes with OpenAI API", { 
      promptLength: prompt.length,
      contextLength: repositoryContext?.length || 0,
      model: config.model
    });

    const systemMessage = `You are an expert software developer and code assistant. Your task is to analyze the provided code repository context and user request, then generate precise code changes to accomplish the requested goal.

IMPORTANT INSTRUCTIONS:
1. Always use SEARCH/REPLACE blocks when modifying files
2. Follow this exact format for file modifications:

\`\`\`search-replace
FILE: path/to/file.ext
<<<<<<< SEARCH
exact content to find (must match exactly)
=======
new content to replace with
>>>>>>> REPLACE
\`\`\`

3. Provide clear explanations for each change
4. Focus on minimal, surgical changes rather than large rewrites
5. Ensure all changes are functional and follow best practices
6. Test-driven approach when applicable

For each request:
- Analyze the current codebase structure
- Identify the specific files that need changes
- Generate precise search/replace blocks
- Explain the reasoning behind each change
- Consider edge cases and error handling`;

    const enhancedPrompt = repositoryContext 
      ? `REPOSITORY CONTEXT:\n${repositoryContext}\n\nUSER REQUEST:\n${prompt}\n\nPlease generate the necessary code changes using SEARCH/REPLACE blocks.`
      : `USER REQUEST:\n${prompt}\n\nPlease generate the necessary code changes using SEARCH/REPLACE blocks.`;

    const response = await generateAIResponse(enhancedPrompt, systemMessage, config);
    
    logger.log("Code generation completed", { 
      responseLength: response.length,
      model: config.model
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Code generation failed", { error: errorMessage });
    throw new Error(`Failed to generate code changes: ${errorMessage}`);
  }
}
