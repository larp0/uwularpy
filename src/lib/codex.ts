import { execSync, spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Clone a repository, run OpenAI Codex CLI in a self-ask flow by repeatedly passing prompt input via stdin,
 * commit & push changes.
 *
 * The self-ask flow repeatedly sends the current prompt to the Codex CLI until no new reply is generated.
 * It includes an evaluator-optimizer to refine responses and a search & replace tool to apply changes.
 *
 * @param prompt - The initial prompt for Codex.
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
    logger.log("Running Codex CLI self-ask iteration", { iteration, promptLength: userText.length });
    const promptFilePath = path.join(tempDir, "prompt.txt");
    fs.writeFileSync(promptFilePath, userText, "utf-8");
    
    // Use spawn to run Codex CLI
    const codexProcess = spawn("bunx", [
      "@openai/codex",
      "--approval-mode", "full-auto",
      "--model", "gpt-4.1-2025-04-14",
      "--quiet",
      "--no-tty"
    ], {
      cwd: tempDir,
      shell: true,
      env: process.env,
      stdio: ["pipe", "pipe", "inherit"]
    });
    
    // Pipe prompt file contents to Codex CLI stdin
    const promptContent = fs.readFileSync(promptFilePath, "utf-8");
    codexProcess.stdin.write(promptContent);
    codexProcess.stdin.end();
    
    // Collect stdout data
    let stdoutData = "";
    for await (const chunk of codexProcess.stdout) {
      stdoutData += chunk.toString();
    }
    
    // Wait for process to exit
    const exitCode: number = await new Promise((resolve) => {
      codexProcess.on("close", resolve);
    });
    if (exitCode !== 0) {
      logger.error("Codex CLI exited non-zero in self-ask loop", { exitCode, iteration });
      if (iteration > 1) {
        // Only break if we've completed at least one iteration
        break;
      }
    }
    
    // Attempt to parse JSON output
    try {
      const parsed = JSON.parse(stdoutData);
      if (parsed && parsed.content && Array.isArray(parsed.content) && parsed.content.length > 0) {
        newSelfReply = parsed.content[0].text.trim();
      } else {
        newSelfReply = stdoutData.trim();
      }
    } catch (e) {
      newSelfReply = stdoutData.trim();
    }
    
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
  execSync('git commit -m "Apply changes from Codex CLI self-ask flow"', { cwd: tempDir, stdio: "inherit" });
  execSync(`git push -u origin ${branchName}`, {
    cwd: tempDir,
    stdio: "inherit",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });

  return tempDir;
}

/**
 * Evaluate the quality of the response and optimize it.
 * @param reply - The reply from Codex CLI.
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
 * @param reply - The reply from Codex CLI.
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
