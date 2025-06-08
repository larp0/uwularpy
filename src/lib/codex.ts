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
 * Result interface for code generation operations.
 * Distinguishes between successful code changes and error responses.
 */
export interface CodeGenerationResult {
  success: boolean;
  responses: string[];
  isErrorFallback: boolean;
  errorMessage?: string;
  changesApplied?: number;
}

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
    let generationResult: CodeGenerationResult;
    try {
      generationResult = await runModernCodeGeneration(prompt, tempDir);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Code generation failed", { error: errorMessage });
      
      // Return error result with clear metadata
      generationResult = {
        success: false,
        responses: [],
        isErrorFallback: true,
        errorMessage: `Code generation failed: ${errorMessage}`
      };
    }
    
    let totalChangesApplied = 0;
    
    if (generationResult.success && generationResult.responses.length > 0) {
      logger.log("Modern code generation completed", { responsesCount: generationResult.responses.length });
      
      // Process search/replace operations from all responses
      for (let i = 0; i < generationResult.responses.length; i++) {
        const response = generationResult.responses[i];
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
        const successfulChanges = searchReplaceChanges.filter(change => change.applied).length;
        totalChangesApplied += successfulChanges;
        
        if (searchReplaceChanges.length > 0) {
          logger.log("Applied search/replace operations", {
            iteration: i + 1,
            changesCount: searchReplaceChanges.length,
            successfulChanges,
            changes: searchReplaceChanges
          });
        }
      }
      
      // Update the generation result with actual changes applied
      generationResult.changesApplied = totalChangesApplied;
    } else if (generationResult.isErrorFallback) {
      logger.error("Code generation failed, no changes will be applied", { 
        errorMessage: generationResult.errorMessage 
      });
    } else {
      logger.log("No responses generated from code generation");
    }

    // Commit and push changes using safe git utilities
    safeGitCommand(['add', '.'], { cwd: tempDir, stdio: 'inherit' });
    
    // Check if there are any changes to commit
    const hasChanges = hasStageChanges(tempDir);
    
    // Generate AI commit message based on success/failure and actual changes
    let commitMessage: string;
    if (generationResult.isErrorFallback) {
      commitMessage = `Code generation failed: ${generationResult.errorMessage?.split(':')[1]?.trim() || 'Unknown error'}`;
    } else {
      const diffContent = hasChanges ? getStagedDiff(tempDir) : '';
      commitMessage = hasChanges 
        ? await generateCommitMessage(diffContent)
        : `OpenAI code generation completed (${totalChangesApplied} changes applied)`;
    }
    
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
 * @returns CodeGenerationResult with success status and metadata.
 */
async function runModernCodeGeneration(prompt: string, repoPath: string): Promise<CodeGenerationResult> {
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
    
    // Return successful result with actual code changes
    return {
      success: true,
      responses: response.trim() ? [response.trim()] : [],
      isErrorFallback: false,
      changesApplied: 0 // Will be updated later after processing search/replace blocks
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Modern code generation failed", { 
      error: errorMessage,
      promptLength: prompt.length
    });
    
    // Return error result with metadata to differentiate from real code changes
    return {
      success: false,
      responses: [],
      isErrorFallback: true,
      errorMessage: `Code generation failed: ${errorMessage}`
    };
  }
}

/**
 * Evaluate the quality of the response and optimize it.
 * Simplified version without risky regex operations, but with hooks for future optimizations.
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
  
  // Hook for future safe optimizations
  optimizedReply = applyFutureOptimizations(optimizedReply, _repoPath);
  
  logger.log("Response optimized", {
    originalLength: reply.length,
    optimizedLength: optimizedReply.length
  });
  
  return optimizedReply;
}

/**
 * Hook for applying future safe optimizations to AI responses.
 * This function is designed to be extended with additional safe optimization features.
 * @param reply - The reply to optimize.
 * @param repoPath - Path to the repository for context-aware optimizations.
 * @returns The optimized reply.
 */
function applyFutureOptimizations(reply: string, _repoPath: string): string {
  // Currently a pass-through, but provides a safe place to add:
  // - AST-based code formatting
  // - Context-aware search/replace block validation
  // - Language-specific improvements
  // - Safe pattern matching for common issues
  
  // Example: Remove obviously malformed search/replace blocks
  // This is safer than complex regex operations
  const lines = reply.split('\n');
  const cleanedLines = lines.filter(line => {
    // Remove lines that look like broken search/replace artifacts
    // but only if they're clearly malformed (safe patterns only)
    const suspiciousPatterns = [
      /^={7,}$/, // Lines with only equals signs
      /^<{7,}$/, // Lines with only less-than signs  
      /^>{7,}$/, // Lines with only greater-than signs
    ];
    
    return !suspiciousPatterns.some(pattern => pattern.test(line.trim()));
  });
  
  return cleanedLines.join('\n');
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
