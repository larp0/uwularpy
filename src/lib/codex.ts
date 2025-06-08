import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from "@octokit/auth-app";
import { safeGitCommit, hasStageChanges, getStagedDiff, setGitUser, getRepositoryStructure, safeGitCommand } from "./git-utils";
import { generateCommitMessage, generateCodeChanges } from "./openai-operations";
import { processSearchReplaceBlocks } from "./file-operations";

/**
 * Clone a repository, run OpenAI API in a self-ask flow by repeatedly sending prompts,
 * commit & push changes.
 *
 * The self-ask flow repeatedly sends the current prompt to the OpenAI API until no new reply is generated.
 * It includes an evaluator-optimizer to refine responses and a search & replace tool to apply changes.
 *
 * @param prompt - The initial prompt for OpenAI.
 * @param repoUrl - HTTPS clone URL of the repository.
 * @param branchName - Name of the branch to create and push.
 * @param installationId - Optional GitHub App installation ID for authentication.
 * @returns Local path to the cloned repository.
 */
export async function codexRepository(
  prompt: string,
  repoUrl: string,
  branchName: string,
  installationId?: string
): Promise<string> {
  try {
    logger.log("codexRepository start", { repoUrl, branchName });

    // Create temporary workspace
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-"));
    logger.log("created temp dir", { tempDir });

    // Prepare authenticated URL if GitHub App creds are provided
    let cloneUrl = repoUrl;
    if (process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY && installationId) {
      try {
        const auth = createAppAuth({
          appId: parseInt(process.env.GITHUB_APP_ID, 10),
          privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });
        const installation = await auth({
          type: "installation",
          installationId: parseInt(installationId, 10),
        });
        const originHost = repoUrl.replace(/^https?:\/\//, "");
        cloneUrl = `https://x-access-token:${installation.token}@${originHost}`;
        logger.log("using authenticated GitHub URL");
      } catch (err) {
        logger.warn("GitHub authentication failed, using original URL", { error: (err as Error).message });
      }
    }

    // Clone the repository and checkout branch using safe git commands
    safeGitCommand(['clone', cloneUrl, tempDir], { cwd: process.cwd(), stdio: 'inherit' });
    safeGitCommand(['checkout', '-b', branchName], { cwd: tempDir, stdio: 'inherit' });

    // Set Git identity using safe utilities
    setGitUser(tempDir, "bot@larp.dev", "larp0");

    // Use modern OpenAI API to process the repository
    let responses: string[] = [];
    try {
      responses = await runModernCodeGeneration(prompt, tempDir);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Code generation failed", { error: errorMessage });
      
      // Create a helpful error response instead of failing completely
      responses = [`# Code Generation Failed

Sorry, I encountered an error while trying to generate code changes:

**Error**: ${errorMessage}

**Possible solutions**:
1. Check if OPENAI_API_KEY is properly configured
2. Verify the repository is accessible
3. Try a simpler or more specific request
4. Check your OpenAI API usage limits

Please try again with a more specific request or check the configuration.`];
    }
    
    if (responses.length === 0) {
      logger.log("No responses generated from code generation");
    } else {
      logger.log("Modern code generation completed", { responsesCount: responses.length });
      
      // Process search/replace operations from all responses
      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        logger.log("Processing response", { index: i + 1, responseLength: response.length });
        
        // Run evaluator-optimizer on the reply
        const optimizedReply = evaluateAndOptimize(response, tempDir);
        logger.log("Evaluated and optimized reply", {
          iteration: i + 1,
          originalLength: response.length,
          optimizedLength: optimizedReply.length
        });

        // Process any search/replace blocks in the reply
        const searchReplaceChanges = processSearchReplaceBlocks(optimizedReply, tempDir);
        if (searchReplaceChanges.length > 0) {
          logger.log("Applied search/replace operations", {
            iteration: i + 1,
            changesCount: searchReplaceChanges.length,
            changes: searchReplaceChanges
          });
        }
      }
    }

    // Commit and push changes using safe git utilities
    safeGitCommand(['add', '.'], { cwd: tempDir, stdio: 'inherit' });
    
    // Check if there are any changes to commit
    const hasChanges = hasStageChanges(tempDir);
    
    // Generate AI commit message
    const diffContent = hasChanges ? getStagedDiff(tempDir) : '';
    const commitMessage = await generateCommitMessage(diffContent);
    
    // Use safe git commit that prevents shell injection
    await safeGitCommit(commitMessage, {
      cwd: tempDir,
      allowEmpty: !hasChanges
    });
    
    safeGitCommand(['push', '-u', 'origin', branchName], {
      cwd: tempDir,
      stdio: 'inherit'
    });

    return tempDir;
  } catch (err: unknown) {
    let msg: string;
    if (err instanceof Error && err.message) {
      msg = err.message;
    } else if (typeof err === 'string') {
      msg = err;
    } else {
      msg = 'Unknown error';
    }
    logger.error("codexRepository failed", { error: msg, repoUrl, branchName });
    throw new Error(`Error processing repository ${repoUrl}: ${msg}. Please check repository settings and try again.`);
  }
}

/**
 * Run the modern OpenAI API to process the repository.
 * @param prompt - The initial prompt for code generation.
 * @param repoPath - Path to the repository directory.
 * @returns Array of responses from OpenAI API.
 */
async function runModernCodeGeneration(prompt: string, repoPath: string): Promise<string[]> {
  try {
    logger.log("Running modern code generation with OpenAI API", { promptLength: prompt.length, repoPath });
    
    // Get repository context for better code generation
    let repositoryContext = '';
    try {
      // Get repository structure using git-utils function
      repositoryContext = getRepositoryStructure(repoPath);
      logger.log("Repository context gathered", { contextLength: repositoryContext.length });
    } catch (error) {
      logger.warn("Failed to gather repository context", { error: String(error) });
      // Continue without context - the API can still work
    }
    
    // Generate code changes using OpenAI API
    const response = await generateCodeChanges(prompt, repositoryContext);
    
    logger.log("Code generation completed", { 
      responseLength: response.length,
      hasSearchReplace: response.includes('search-replace')
    });
    
    // Return the response as a single entry
    return response.trim() ? [response.trim()] : [];
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Modern code generation failed", { 
      error: errorMessage,
      promptLength: prompt.length
    });
    
    // Re-throw the error to maintain consistent error handling
    throw new Error(`Code generation failed: ${errorMessage}`);
  }
}

/**
 * Evaluate the quality of the response and optimize it.
 * Simplified version without risky regex operations.
 * @param reply - The reply from OpenAI API.
 * @param repoPath - Path to the repository for context.
 * @returns Optimized reply.
 */
function evaluateAndOptimize(reply: string, _repoPath: string): string {
  // Basic validation and cleanup without complex regex manipulation
  if (!reply || typeof reply !== 'string') {
    return '';
  }
  
  // Simple cleanup operations that are safe
  let optimizedReply = reply
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace
    .trim();
  
  // Basic validation - ensure the reply is reasonable
  if (optimizedReply.length < 10) {
    logger.warn("Reply appears too short after optimization", { 
      originalLength: reply.length,
      optimizedLength: optimizedReply.length 
    });
  }
  
  if (optimizedReply.length > 50000) {
    logger.warn("Reply is very long, truncating", { 
      originalLength: reply.length 
    });
    optimizedReply = optimizedReply.slice(0, 50000) + '\n\n...(truncated due to length)';
  }
  
  logger.log("Response optimized", {
    originalLength: reply.length,
    optimizedLength: optimizedReply.length
  });
  
  return optimizedReply;
}

/**
 * Return top contributors by number of merged pull requests.
 * @param repoPath - Local path of the repository.
 * @param limit - Maximum number of contributors to return.
 */
export function getTopContributorsByMergedPRs(
  repoPath: string,
  limit: number = 5
): Array<{ name: string; count: number }> {
  logger.log("getTopContributorsByMergedPRs", { repoPath, limit });
  if (!fs.existsSync(repoPath)) {
    logger.warn("repository path does not exist", { repoPath });
    return [];
  }
  const cmd = 'git log --merges --format="%an" | sort | uniq -c | sort -nr';
  const output = execSync(cmd, { cwd: repoPath, encoding: "utf-8" }).trim();
  if (!output) return [];
  return output
    .split("\n")
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const count = parseInt(parts[0], 10);
      const name = parts.slice(1).join(" ");
      return { name, count };
    })
    .slice(0, limit);
}
