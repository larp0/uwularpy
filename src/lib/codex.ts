import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from "@octokit/auth-app";
import OpenAI from "openai";

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

    // Set Git identity
    execSync('git config user.email "bot@uwularpy.dev"', { cwd: tempDir, stdio: "inherit" });
    execSync('git config user.name "uwularpy"', { cwd: tempDir, stdio: "inherit" });

    // Self-ask flow: repeatedly call Codex CLI until no new reply is generated.
    let userText = prompt + "\n\nPlease respond with a detailed, step-by-step continuation if further clarification or changes are needed. Leave empty if complete. If you need to modify files, use SEARCH/REPLACE blocks following this format:\n\n```search-replace\nFILE: path/to/file.ext\n<<<<<<< SEARCH\nexact content to find\n=======\nnew content to replace with\n>>>>>>> REPLACE\n```";
    let newSelfReply = "";
    let iteration = 0;

    while (true) {
      iteration++;
      logger.log("Running OpenAI API self-ask iteration", { iteration, promptLength: userText.length });

      // Run OpenAI API directly instead of Codex CLI
      let stdoutData = "";
      try {
        // Initialize OpenAI client
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        logger.log("Calling OpenAI API", { inputLength: userText.length });
        
        // Call OpenAI API with the prompt
        const response = await openai.chat.completions.create({
          model: "gpt-4.1-mini", // Use GPT-4 instead of Codex for better results
          messages: [
            {
              role: "system",
              content: "You are a helpful coding assistant. When asked to modify files, use SEARCH/REPLACE blocks following this format:\n\n```search-replace\nFILE: path/to/file.ext\n<<<<<<< SEARCH\nexact content to find\n=======\nnew content to replace with\n>>>>>>> REPLACE\n```"
            },
            {
              role: "user", 
              content: userText
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        });
        
        stdoutData = response.choices[0]?.message?.content || "";
        
        // Log the output for debugging
        logger.log("OpenAI API response received", { 
          stdoutLength: stdoutData.length,
          stdoutPreview: stdoutData.substring(0, 100) 
        });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        logger.error("OpenAI API call failed", { 
          error: errorMsg,
          iteration,
          promptLength: userText.length
        });
        
        // Throw an error on the first iteration, but continue after that
        if (iteration === 1) {
          throw new Error(`OpenAI API failed to process input: ${errorMsg}`);
        } else {
          break; // exit loop after at least one iteration
        }
      }

      // Process the API response directly
      newSelfReply = stdoutData.trim();
      logger.log("Self-ask reply", { newSelfReplyLength: newSelfReply.length });

      // If no new reply or reply is identical to previous input, break the loop
      if (!newSelfReply || newSelfReply === userText) {
        logger.log("No new self reply, ending self-ask flow", { iteration });
        break;
      }

      // Run evaluator-optimizer on the reply
      const optimizedReply = evaluateAndOptimize(newSelfReply, tempDir);
      logger.log("Evaluated and optimized reply", {
        iteration,
        originalLength: newSelfReply.length,
        optimizedLength: optimizedReply.length
      });

      // Process any search/replace blocks in the reply
      const searchReplaceChanges = processSearchReplaceBlocks(optimizedReply, tempDir);
      if (searchReplaceChanges.length > 0) {
        logger.log("Applied search/replace operations", {
          iteration,
          changesCount: searchReplaceChanges.length,
          changes: searchReplaceChanges
        });
      }

      // Update prompt for next iteration
      userText = optimizedReply;
    }

    // Commit and push changes
    execSync("git add .", { cwd: tempDir, stdio: "inherit" });
    execSync('git commit -m "Apply changes from OpenAI API self-ask flow"', { cwd: tempDir, stdio: "inherit" });
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
 * Process search/replace blocks in the reply and apply them to repository files.
 * @param reply - The reply from OpenAI API.
 * @param repoPath - Path to the repository.
 * @returns Array of changes made.
 */
function processSearchReplaceBlocks(reply: string, repoPath: string): Array<{ file: string; applied: boolean }> {
  const changes: Array<{ file: string; applied: boolean }> = [];

  // Find all search-replace blocks
  const searchReplaceRegex = /```search-replace\n([\s\S]*?)```/g;
  let match;

  while ((match = searchReplaceRegex.exec(reply)) !== null) {
    const block = match[1];

    // Extract file path
    const fileMatch = block.match(/FILE:\s*(.*)/);
    if (!fileMatch) continue;

    const filePath = path.join(repoPath, fileMatch[1].trim());
    if (!fs.existsSync(filePath)) {
      logger.warn("Search/replace target file does not exist", { filePath });
      changes.push({ file: fileMatch[1].trim(), applied: false });
      continue;
    }

    // Find all SEARCH/REPLACE operations
    const operationRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let fileContent = fs.readFileSync(filePath, "utf-8");
    let operationMatch;
    let fileModified = false;

    while ((operationMatch = operationRegex.exec(block)) !== null) {
      const searchText = operationMatch[1];
      const replaceText = operationMatch[2];

      if (fileContent.includes(searchText)) {
        fileContent = fileContent.replace(searchText, replaceText);
        fileModified = true;
      } else {
        logger.warn("Search text not found in file", {
          filePath,
          searchTextLength: searchText.length
        });
      }
    }

    if (fileModified) {
      fs.writeFileSync(filePath, fileContent, "utf-8");
      changes.push({ file: fileMatch[1].trim(), applied: true });
    } else {
      changes.push({ file: fileMatch[1].trim(), applied: false });
    }
  }

  return changes;
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
