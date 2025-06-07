import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from "@octokit/auth-app";
import { safeGitCommit, hasStageChanges, getStagedDiff, setGitUser } from "./git-utils";
import { generateCommitMessage, runSelfAskFlow } from "./openai-operations";
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

    // Clone the repository and checkout branch
    execSync(`git clone ${cloneUrl} ${tempDir}`, { stdio: "inherit" });
    execSync(`git checkout -b ${branchName}`, { cwd: tempDir, stdio: "inherit" });

    // Set Git identity using safe utilities
    setGitUser(tempDir, "bot@larp.dev", "larp0");

    // Self-ask flow: repeatedly call OpenAI API until no new reply is generated.
    const responses = await runSelfAskFlow(prompt);
    
    if (responses.length === 0) {
      logger.log("No responses generated from self-ask flow");
    } else {
      logger.log("Self-ask flow completed", { responsesCount: responses.length });
      
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
    execSync("git add .", { cwd: tempDir, stdio: "inherit" });
    
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
    
    execSync(`git push -u origin ${branchName}`, {
      cwd: tempDir,
      stdio: "inherit",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
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
 * Evaluate the quality of the response and optimize it.
 * @param reply - The reply from OpenAI API.
 * @param repoPath - Path to the repository for context.
 * @returns Optimized reply.
 */
function evaluateAndOptimize(reply: string, repoPath: string): string {
  // Step 1: Extract any code blocks for separate evaluation
  const codeBlocks: string[] = [];
  const textWithoutCodeBlocks = reply.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `CODE_BLOCK_${codeBlocks.length - 1}`;
  });

  // Step 2: Evaluate the clarity and completeness of the text
  let optimizedText = textWithoutCodeBlocks;

  // Check for vague statements and add specificity
  optimizedText = optimizedText.replace(
    /I (will|would|could|should|might) (do|implement|create|modify|change|update|fix) ([\w\s]+)/gi,
    "I will specifically $2 $3 by following these steps: "
  );

  // Ensure all TODO items have clear next steps
  optimizedText = optimizedText.replace(
    /TODO: ([\w\s]+)(?!\s*\d\.)/gi,
    "TODO: $1\n1. "
  );

  // Step 3: Evaluate code blocks for syntax errors and best practices
  const optimizedCodeBlocks = codeBlocks.map((block) => {
    // Remove the code block markers for processing
    const code = block.replace(/```[\w]*\n|```$/g, "");

    // Check for common issues in code
    let optimizedCode = code;

    // Add proper error handling where missing
    if (code.includes("try {") && !code.includes("catch")) {
      optimizedCode = optimizedCode.replace(
        /try {([\s\S]*?)}/g,
        "try {$1} catch (error) {\n  console.error('Operation failed:', error);\n}"
      );
    }

    // Ensure async/await consistency
    if (code.includes("await") && !code.includes("async")) {
      optimizedCode = "async " + optimizedCode;
    }

    // Wrap back in code block markers
    const language = block.match(/```([\w]*)/)?.[1] || "";
    return "```" + language + "\n" + optimizedCode + "\n```";
  });

  // Step 4: Reassemble the text with optimized code blocks
  let finalOptimizedReply = optimizedText;
  for (let i = 0; i < optimizedCodeBlocks.length; i++) {
    finalOptimizedReply = finalOptimizedReply.replace(
      `CODE_BLOCK_${i}`,
      optimizedCodeBlocks[i]
    );
  }

  // Step 5: Final readability improvements
  finalOptimizedReply = finalOptimizedReply
    // Ensure clear section breaks
    .replace(/(?<!\n\n)(#+\s.*)/g, "\n\n$1")
    // Ensure list items are properly formatted
    .replace(/(?<!\n)(\d+\.\s)/g, "\n$1");

  return finalOptimizedReply;
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
