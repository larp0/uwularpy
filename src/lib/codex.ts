// src/lib/binary-uwuify.ts
// Optimized with GitHub App authentication: Bash-based markdown processing with parallel execution

import { execSync, spawnSync, spawn, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from '@octokit/auth-app';

/** 
 * Process a repository with the uwuify binary
 * @param repoUrl - URL of the repository to clone
 * @param branchName - Name of the branch to c reate
 * @returns Path to the cloned repository
 */
export async function codexRepository(msg: any, repoUrl: string, branchName: string, installationIdParam?: string): Promise<string> {
  logger.log("Starting repository uwuification", { repoUrl, branchName });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  logger.log(`Created temporary directory at: ${tempDir}`);

  const githubAppId = process.env.GITHUB_APP_ID;
  const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const installationId = installationIdParam;

  // Parse repository owner and name from URL
  const repoUrlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/.]+)(?:\.git)?$/);
  const [owner, repo] = repoUrlMatch ? [repoUrlMatch[1], repoUrlMatch[2]] : [null, null];

  // Set up authentication if possible
  let authenticatedRepoUrl = repoUrl;
  let installationAuthentication;

  if (!githubAppId || !githubPrivateKey) {
    logger.warn("GitHub App credentials missing (APP_ID or PRIVATE_KEY). Git operations may fail.");
  }

  if (!installationId) {
    logger.warn("GitHub App installation ID missing. Git operations may fail.");
  }

  if (!owner || !repo) {
    logger.warn("Could not parse owner and repo from URL. Using original URL for git operations.");
  }

  try {
    // Try to authenticate with GitHub App if credentials are available
    if (githubAppId && githubPrivateKey && owner && repo && installationId) {
      logger.log("Setting up GitHub App authentication");
      
      try {
        const auth = createAppAuth({
          appId: githubAppId,
          privateKey: githubPrivateKey,
        });

        installationAuthentication = await auth({
          type: "installation",
          installationId: parseInt(installationId, 10),
        });

        authenticatedRepoUrl = `https://x-access-token:${installationAuthentication.token}@github.com/${owner}/${repo}.git`;
        logger.log("GitHub App authentication successful");
      } catch (authError) {
        logger.error(`GitHub App authentication failed: ${authError instanceof Error ? authError.message : 'Unknown error'}`);
        logger.warn("Falling back to original repository URL");
      }
    }

    logger.log(`Cloning repository: ${repoUrl}`);
    execSync(`git clone ${authenticatedRepoUrl} ${tempDir}`, { stdio: 'inherit' });

    logger.log(`Creating branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit', cwd: tempDir });

    // Always explicitly set Git identity for this repository
    // This is crucial for the git commit to work
    logger.log("Explicitly setting Git identity");
    execSync('git config user.email "bot@uwularpy.dev"', { stdio: 'inherit', cwd: tempDir });
    execSync('git config user.name "uwularpy"', { stdio: 'inherit', cwd: tempDir });

    // Display current git config to debug
    logger.log("Verifying Git identity configuration:");
    execSync('git config --list | grep user.', { stdio: 'inherit', cwd: tempDir });

    // Install codex globally
    logger.log("Installing @openai/codex globally");
    //execSync("npm install @openai/codex -g", { stdio: "inherit" });

    // Run codex CLI with user text (replace this with actual user text input)
    // Initialize userText with prompt instructing Codex to self-reply
    let userText = msg || "improve this code";

    // Append instruction to make Codex output self-replying
    userText += "\n\nPlease respond to this message with a self-reply that continues the conversation.";

    let selfReplyBuffer = '';

    try {
      logger.log(`Running codex CLI with user text: ${JSON.stringify(userText)} ${process.env.OPENAI_API_KEY ? 'with API key' : 'without API key'}`);

      // Run codex CLI using Bun's npx equivalent with options to avoid Ink raw mode error
      const codexProcess = spawn('bunx', [
        '@openai/codex',
        '--approval-mode', 'full-auto',
        '--model', 'gpt-4.1-2025-04-14',
        '--quiet',
        '--full-stdout',
        '--dangerously-auto-approve-everything',
        '--no-tty' // Disable TTY to prevent Ink raw mode error
      ], {
        cwd: tempDir,
        shell: true,
        env: {
          ...process.env,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
        }
      });

      let stdout = '';
      let stderr = '';

      codexProcess.stdout?.on('data', (data: Buffer | string) => {
        const chunk = data.toString();
        stdout += chunk;
        logger.log(`Codex data stdout: ${chunk}`);

        // Attempt to parse JSON message and extract text content for self-reply
        try {
          const json = JSON.parse(chunk);
          if (json && json.content && Array.isArray(json.content) && json.content.length > 0) {
            const text = json.content[0].text;
            if (text) {
              // Buffer the self-reply text to write after process close
              selfReplyBuffer = `\n\n${text}\n\nPlease respond to this message with a self-reply that continues the conversation.`;
            }
          }
        } catch (e) {
          // Not JSON or parse error, ignore
        }
      });

      codexProcess.stderr?.on('data', (data: Buffer | string) => {
        stderr += data.toString();
        logger.log(`Codex data stderr: ${stderr}`);
      });

      codexProcess.on('error', (error: Error) => {
        logger.log(`Codex spawn error: ${error.message}`);
      });

      // Write userText directly to stdin without patch header
      codexProcess.stdin?.write(userText);
      codexProcess.stdin?.end();

      await new Promise<void>((resolve) => {
        codexProcess.on('close', (code: number) => {
          if (code !== 0) {
            logger.error(`Codex exited with code ${code}`);
          } else {
            logger.log("Codex command executed successfully");
            // After process closes, if selfReplyBuffer has content, recursively call codexRepository with it
            if (selfReplyBuffer) {
              logger.log("Triggering self-reply with buffered text");
              codexRepository(selfReplyBuffer, repoUrl, branchName, installationIdParam).then(() => {
                resolve();
              }).catch(() => {
                resolve();
              });
              return;
            }
          }
          logger.log("Codex stdout:", { stdout });
          logger.log("Codex stderr:", { stderr });
          resolve();
        });
      });
    } catch (error) {
      logger.error(`Error executing codex command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    logger.log("Checking for changes");
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8', cwd: tempDir }).toString().trim();
    
    if (!gitStatus) {
      logger.log("No changes were made to markdown files. Creating empty commit.");
      fs.writeFileSync(path.join(tempDir, 'DEV_TEST.md'), 'This is a test file created by uwuify bot');
      execSync('git add DEV_TEST.md', { stdio: 'inherit', cwd: tempDir });
      execSync('git commit -m "dev (test file added since no changes were found)"', { stdio: 'inherit', cwd: tempDir });
    } else {
      logger.log(`Changes detected: ${gitStatus.split("\n").length} files modified`);
      execSync('git add .', { stdio: 'inherit', cwd: tempDir });
      execSync('git commit -m "dev"', { stdio: 'inherit', cwd: tempDir });
    }

    // Push the branch to the remote repository
    logger.log(`Pushing branch ${branchName} to remote repository`);
    try {
      execSync(`git push -u origin ${branchName}`, { 
        stdio: 'inherit', 
        cwd: tempDir,
        env: {
          ...process.env,
          // Ensure git doesn't prompt for credentials
          GIT_TERMINAL_PROMPT: '0',
        }
      });
      logger.log("Successfully pushed changes to remote repository");
    } catch (pushError) {
      logger.error(`Error pushing to remote: ${pushError instanceof Error ? pushError.message : 'Unknown error'}`);
      
      // If pushing with the current URL fails, try with the authenticated URL (if available)
      if (authenticatedRepoUrl !== repoUrl) {
        logger.log("Trying to push with the authenticated URL");
        try {
          // Set remote URL to the authenticated one and try push again
          execSync(`git remote set-url origin ${authenticatedRepoUrl}`, { stdio: 'inherit', cwd: tempDir });
          execSync(`git push -u origin ${branchName}`, { 
            stdio: 'inherit', 
            cwd: tempDir,
            env: {
              ...process.env,
              GIT_TERMINAL_PROMPT: '0',
            }
          });
          logger.log("Successfully pushed changes to remote repository with authenticated URL");
        } catch (authPushError) {
          logger.error(`Error pushing with authenticated URL: ${authPushError instanceof Error ? authPushError.message : 'Unknown error'}`);
          throw new Error(`Failed to push branch to remote: ${authPushError instanceof Error ? authPushError.message : 'Unknown error'}`);
        }
      } else {
        throw new Error(`Failed to push branch to remote: ${pushError instanceof Error ? pushError.message : 'Unknown error'}`);
      }
    }
  } catch (error) {
    logger.error(`Error during repository uwuification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }

  return tempDir;
}

/**
 * Get top contributors of a repository by number of merged PRs
 * @param repoPath - Path to the cloned repository
 * @param limit - Maximum number of contributors to return
 * @returns Array of top contributors with their PR counts
 */
export function getTopContributorsByMergedPRs(repoPath: string, limit: number = 5): Array<{name: string, count: number}> {
  logger.log("Getting top contributors by merged PRs", { repoPath, limit });
  
  try {
    // Make sure the path exists
    if (!fs.existsSync(repoPath)) {
      logger.error(`Repository path does not exist: ${repoPath}`);
      return [];
    }
    
    // Run git command to get authors of merged PRs
    const command = 'git log --merges --format="%an" | sort | uniq -c | sort -nr';
    logger.log(`Running command: ${command}`);
    
    const output = execSync(command, {
      cwd: repoPath,
      encoding: 'utf-8'
    }).trim();
    
    if (!output) {
      logger.log("No merged PRs found in repository");
      return [];
    }
    
    // Parse the output into contributor objects
    const contributors = output
      .split('\n')
      .map(line => {
        const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
        if (match) {
          return {
            name: match[2],
            count: parseInt(match[1], 10)
          };
        }
        return null;
      })
      .filter((item): item is {name: string, count: number} => item !== null)
      .slice(0, limit);
    
    logger.log(`Found ${contributors.length} top contributors`);
    return contributors;
  } catch (error) {
    logger.error(`Error getting top contributors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}
