// src/lib/binary-uwuify.ts
// Optimized with GitHub App authentication: Bash-based markdown processing with parallel execution

import { execSync, spawnSync } from 'child_process';
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
export async function uwuifyRepository(repoUrl: string, branchName: string, installationIdParam?: string): Promise<string> {
  logger.log("Starting repository uwuification", { repoUrl, branchName });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  logger.log(`Created temporary directory at: ${tempDir}`);
  
  const uwuifyBinaryPath = path.join(process.cwd(), 'src', 'lib', 'bin', 'uwuify');
  logger.log(`UwUify binary path: ${uwuifyBinaryPath}`);
  
  // Verify the binary exists and is executable
  if (!fs.existsSync(uwuifyBinaryPath)) {
    throw new Error(`UwUify binary not found at ${uwuifyBinaryPath}`);
  }
  
  try {
    // Test the binary to make sure it works
    const testOutput = execSync(`${uwuifyBinaryPath} --version`, { encoding: 'utf-8' });
    logger.log(`UwUify binary version: ${testOutput.trim()}`);
  } catch (e) {
    logger.error(`Error testing uwuify binary: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

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
    execSync('git config user.email "uwuify-bot@example.com"', { stdio: 'inherit', cwd: tempDir });
    execSync('git config user.name "UwUify Bot"', { stdio: 'inherit', cwd: tempDir });

    // Display current git config to debug
    logger.log("Verifying Git identity configuration:");
    execSync('git config --list | grep user.', { stdio: 'inherit', cwd: tempDir });

    // List markdown files in the repository for debugging
    logger.log("Finding markdown files in the repository");
    try {
      const findCommand = `find ${tempDir} -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*"`;
      const mdFiles = execSync(findCommand, { encoding: 'utf-8' }).toString().trim();
      
      const fileCount = mdFiles ? mdFiles.split('\n').length : 0;
      logger.log(`Found ${fileCount} markdown files in the repository`);
      
      if (fileCount === 0) {
        logger.warn("No markdown files found to process!");
      } else {
        logger.log("Markdown files found:", mdFiles.split('\n').slice(0, 10).join('\n'));
      }
    } catch (e) {
      logger.error(`Error finding markdown files: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    logger.log("Running uwuify directly on each markdown file");
    
    // Process each markdown file directly with the uwuify binary
    const processFiles = `
      find ${tempDir} -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
        echo "Processing $file"
        # Save original content for comparison
        cp "$file" "$file.orig"
        # Process the file with uwuify
        "${uwuifyBinaryPath}" -t 32 "$file" > "$file.tmp" && mv "$file.tmp" "$file"
        # Check if the file was changed
        if ! diff -q "$file" "$file.orig" > /dev/null; then
          echo "File changed: $file"
        else
          echo "No changes in file: $file"
        fi
        # Remove the original file
        rm "$file.orig"
      done
    `;
    
    const processOutput = execSync(processFiles, { encoding: 'utf-8', shell: '/bin/bash' });
    logger.log("Process output:", processOutput);

    logger.log("Checking for changes");
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8', cwd: tempDir }).toString().trim();
    
    if (!gitStatus) {
      logger.log("No changes were made to markdown files. Creating empty commit.");
      // For testing purposes, let's create a simple change to verify git works
      fs.writeFileSync(path.join(tempDir, 'UWUIFY_TEST.md'), 'This is a test file created by uwuify bot');
      execSync('git add UWUIFY_TEST.md', { stdio: 'inherit', cwd: tempDir });
      execSync('git commit -m "uwu (test file added since no changes were found)"', { stdio: 'inherit', cwd: tempDir });
    } else {
      logger.log(`Changes detected: ${gitStatus.split("\n").length} files modified`);
      execSync('git add .', { stdio: 'inherit', cwd: tempDir });
      execSync('git commit -m "uwu"', { stdio: 'inherit', cwd: tempDir });
    }

    logger.log("Configuring Git for push");
    if (installationAuthentication && owner && repo) {
      logger.log("Using GitHub App token for push");
      execSync(`git remote set-url origin https://x-access-token:${installationAuthentication.token}@github.com/${owner}/${repo}.git`, { stdio: 'inherit', cwd: tempDir });
    } else {
      logger.warn("No GitHub App authentication available, using original URL for push");
    }

    logger.log("Pushing changes");
    execSync(`git push origin ${branchName}`, { stdio: 'inherit', cwd: tempDir });

    return tempDir;
  } catch (error) {
    logger.error(`Error during uwuifyRepository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Get the top contributors by merged PRs
 */
export function getTopContributorsByMergedPRs(repoDir: string, count: number = 5): Array<{name: string, count: number}> {
  try {
    const gitLogOutput = execSync(
      'git log --merges --pretty=format:"%an" | grep -v "^$"',
      { encoding: 'utf-8', cwd: repoDir }
    );

    const authorCounts: Record<string, number> = {};
    gitLogOutput.split('\n').forEach(author => {
      author = author.trim();
      if (author) authorCounts[author] = (authorCounts[author] || 0) + 1;
    });

    return Object.entries(authorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, count);
  } catch (error) {
    logger.error(`Error retrieving top contributors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}
