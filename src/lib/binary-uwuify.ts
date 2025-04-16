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

    // Create a batch processing approach for large repositories
    logger.log("Using improved batch processing for large repositories");
    
    // Create a script file that will handle the uwuification in batches
    const batchScript = `#!/bin/bash
set -e

REPO_DIR="$1"
UWUIFY_BINARY="$2"
BATCH_SIZE=50
TOTAL_PROCESSED=0
CHANGED_FILES=0

echo "Repository directory: $REPO_DIR"
echo "UwUify binary path: $UWUIFY_BINARY"
echo "Testing uwuify binary..."
"$UWUIFY_BINARY" --version

# Find all markdown files, excluding .git and node_modules
echo "Finding all markdown files..."
find "$REPO_DIR" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" > /tmp/md_files_list.txt

# Get total count
TOTAL_FILES=$(wc -l < /tmp/md_files_list.txt)
echo "Found $TOTAL_FILES markdown files to process"

# Display first 10 files for verification
echo "Sample of files to process:"
head -n 10 /tmp/md_files_list.txt

# If no files found, exit early
if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "No markdown files found in repository"
  exit 0
fi

# Create a directory for temporary file processing
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory for processing: $TEMP_DIR"

# Process files one by one to avoid memory issues
cat /tmp/md_files_list.txt | while IFS= read -r file; do
  echo "Processing: $file"
  # Create a unique name for the temporary file
  TEMP_FILE="$TEMP_DIR/$(basename "$file").tmp"
  
  # Process the file with uwuify, with error handling
  if "$UWUIFY_BINARY" -t 32 "$file" > "$TEMP_FILE"; then
    # Compare the files to see if there are changes
    if ! cmp -s "$file" "$TEMP_FILE"; then
      # File was changed, replace it
      mv "$TEMP_FILE" "$file"
      echo "File changed: $file"
      CHANGED_FILES=$((CHANGED_FILES + 1))
      
      # Every 1000 changed files, make a commit to avoid large git operations
      if [ "$CHANGED_FILES" -ge 1000 ]; then
        echo "Committing batch of 1000 changed files"
        (cd "$REPO_DIR" && git add -A && git commit -m "uwuify batch of markdown files")
        CHANGED_FILES=0
      fi
    else
      # No changes, remove temp file
      rm "$TEMP_FILE"
      echo "No changes in file: $file"
    fi
  else
    echo "Error processing file: $file"
    # If the uwuify command fails, remove the temp file and continue
    [ -f "$TEMP_FILE" ] && rm "$TEMP_FILE"
  fi
  
  TOTAL_PROCESSED=$((TOTAL_PROCESSED + 1))
  
  # Print progress periodically
  if [ $((TOTAL_PROCESSED % 100)) -eq 0 ]; then
    echo "Progress: $TOTAL_PROCESSED/$TOTAL_FILES files processed"
  fi
done

# Commit any remaining changes
if [ "$CHANGED_FILES" -gt 0 ]; then
  echo "Committing final batch of $CHANGED_FILES changed files"
  (cd "$REPO_DIR" && git add -A && git commit -m "uwuify final batch of markdown files")
fi

# Clean up
rm -rf "$TEMP_DIR"
rm /tmp/md_files_list.txt

echo "Completed processing $TOTAL_PROCESSED files"
echo "All files processed successfully"
`;

    const batchScriptPath = path.join(os.tmpdir(), `uwuify-batch-${Date.now()}.sh`);
    fs.writeFileSync(batchScriptPath, batchScript, { mode: 0o755 });
    
    // Run the batch script
    logger.log("Starting batch processing script");
    try {
      // Execute the script with increased buffer size and memory
      const batchOutput = execSync(`${batchScriptPath} "${tempDir}" "${uwuifyBinaryPath}"`, { 
        encoding: 'utf-8',
        maxBuffer: 500 * 1024 * 1024, // 500MB buffer
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=8192' // Increase Node.js memory limit
        }
      });
      
      // Log a summary of the processing
      const outputLines = batchOutput.split('\n');
      const lastLines = outputLines.slice(-100).join('\n'); // Get the last 100 lines
      logger.log("Batch processing completed", { summary: lastLines });
    } catch (batchError) {
      logger.error(`Error during batch processing: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
      logger.warn("Attempting to commit any changes that were made before the error");
    }
    
    // Remove the batch script
    try {
      fs.unlinkSync(batchScriptPath);
    } catch (e) {
      logger.warn(`Could not remove batch script: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }

    logger.log("Checking for changes");
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8', cwd: tempDir }).toString().trim();
    
    if (!gitStatus) {
      logger.log("No changes were made to markdown files. Creating empty commit.");
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
