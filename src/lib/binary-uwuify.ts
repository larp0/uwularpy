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
    logger.log("Using parallel processing with timeouts to handle large repositories");
    
    // Create a script file that will handle the uwuification in batches with parallel processing
    const batchScript = `#!/bin/bash
# Enable faster processing with timeouts
set -e

REPO_DIR="$1"
UWUIFY_BINARY="$2"
MAX_FILES=5000000  # Maximum files to process to avoid timeouts
MAX_PARALLEL=32  # Number of parallel processes
TIMEOUT_PER_FILE=15  # Seconds per file before timeout

TOTAL_PROCESSED=0
CHANGED_FILES=0
ERRORS=0

echo "Repository directory: $REPO_DIR"
echo "UwUify binary path: $UWUIFY_BINARY"
echo "Testing uwuify binary..."
"$UWUIFY_BINARY" --version || echo "ERROR: UwUify binary test failed!"

# Find all markdown files, excluding .git and node_modules
echo "Finding all markdown files..."
find "$REPO_DIR" -name "*.md" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" > /tmp/md_files_list.txt || { echo "ERROR: Find command failed!"; exit 1; }

# Get total count
TOTAL_FILES=$(wc -l < /tmp/md_files_list.txt)
echo "Found $TOTAL_FILES markdown files to process"

# If too many files, limit to MAX_FILES and select a representative sample
if [ "$TOTAL_FILES" -gt "$MAX_FILES" ]; then
  echo "Repository has too many files ($TOTAL_FILES). Limiting to $MAX_FILES files to avoid timeout."
  # Get first 10 files, last 10 files, and random selection from the middle
  head -n 10 /tmp/md_files_list.txt > /tmp/md_files_selected.txt
  tail -n 10 /tmp/md_files_list.txt >> /tmp/md_files_selected.txt
  
  # Get random selection from the middle (MAX_FILES - 20 files)
  MIDDLE_FILES=$((MAX_FILES - 20))
  if [ "$MIDDLE_FILES" -gt 0 ]; then
    # Skip the first 10 lines, shuffle, take the first MIDDLE_FILES lines
    tail -n +11 /tmp/md_files_list.txt | head -n -10 | sort -R | head -n $MIDDLE_FILES >> /tmp/md_files_selected.txt
  fi
  
  # Replace original list with selected files
  mv /tmp/md_files_selected.txt /tmp/md_files_list.txt
  TOTAL_FILES=$(wc -l < /tmp/md_files_list.txt)
  echo "Selected $TOTAL_FILES representative files for processing"
fi

# Display sample of files for verification
echo "Sample of files to process:"
head -n 5 /tmp/md_files_list.txt || echo "ERROR: Could not display sample files!"

# If no files found, exit early
if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "No markdown files found in repository"
  exit 0
fi

# Create a directory for temporary file processing
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory for processing: $TEMP_DIR"

# Verify filesystem access and permissions
echo "Testing file read/write:"
TEST_PATH="$REPO_DIR/test-uwuify-access.txt"
echo "Test" > "$TEST_PATH" && echo "Write test: SUCCESS" || echo "Write test: FAILED"
cat "$TEST_PATH" && echo "Read test: SUCCESS" || echo "Read test: FAILED"
rm "$TEST_PATH" && echo "Delete test: SUCCESS" || echo "Delete test: FAILED"

# Create a function to process a batch of files in parallel
process_batch() {
  local start_idx=$1
  local batch_size=$2
  
  # Create an array to hold background processes
  pids=()
  
  # Extract the batch of files to process
  sed -n "\${start_idx},\$((\${start_idx} + \${batch_size} - 1))p" /tmp/md_files_list.txt > /tmp/batch_\${start_idx}.txt
  
  # Process each file in the batch
  while IFS= read -r file; do
    # Skip if file doesn't exist
    if [ ! -f "$file" ]; then
      echo "ERROR: File doesn't exist or is not accessible: $file"
      ERRORS=$((ERRORS + 1))
      continue
    fi
    
    # Check file size (don't process files that are too large)
    FILE_SIZE=$(du -k "$file" | cut -f1)
    if [ "\${FILE_SIZE}" -gt 102400 ]; then
      echo "WARNING: File too large (\${FILE_SIZE}KB), skipping: $file"
      continue
    fi
    
    # Create a unique name for the temporary file
    TEMP_FILE="$TEMP_DIR/$(basename "$file").tmp"
    
    # Process the file with uwuify in background with timeout
    (
      echo "Processing: $file"
      if timeout \\\${TIMEOUT_PER_FILE}s "$UWUIFY_BINARY" -t 32 "$file" > "$TEMP_FILE" 2>/dev/null; then
        # If successful, check if the file changed
        if ! cmp -s "$file" "$TEMP_FILE"; then
          # Replace the original file
          mv "$TEMP_FILE" "$file"
          echo "Changed: $file"
          # Atomic file update for counting
          echo "$file" >> /tmp/changed_files.txt
        else
          # No changes, clean up
          rm "$TEMP_FILE"
        fi
      else
        [ -f "$TEMP_FILE" ] && rm "$TEMP_FILE"
        echo "Error or timeout processing: $file" >> /tmp/error_files.txt
      fi
      echo "$file" >> /tmp/processed_files.txt
    ) &
    
    # Store the PID of the background process
    pids+=($!)
    
    # If we've reached the maximum number of parallel processes, wait for one to finish
    if [ \${#pids[@]} -ge $MAX_PARALLEL ]; then
      wait -n  # Wait for any child process to finish
      # Clean up the pids array to remove finished processes
      new_pids=()
      for pid in "\${pids[@]}"; do
        if kill -0 $pid 2>/dev/null; then
          new_pids+=($pid)
        fi
      done
      pids=("\${new_pids[@]}")
    fi
  done < /tmp/batch_\${start_idx}.txt
  
  # Wait for all remaining processes in this batch to finish
  wait
  
  # Update counters based on results
  if [ -f /tmp/processed_files.txt ]; then
    TOTAL_PROCESSED=$(wc -l < /tmp/processed_files.txt)
  fi
  if [ -f /tmp/changed_files.txt ]; then
    CHANGED_FILES=$(wc -l < /tmp/changed_files.txt)
  fi
  if [ -f /tmp/error_files.txt ]; then
    ERRORS=$(wc -l < /tmp/error_files.txt)
  fi
  
  echo "Batch starting at $start_idx completed. Progress: $TOTAL_PROCESSED/$TOTAL_FILES files processed"
  
  # Commit changes after each batch to avoid timeout issues with large commits
  if [ -f /tmp/changed_files.txt ] && [ "$(wc -l < /tmp/changed_files.txt)" -gt 0 ]; then
    echo "Committing batch of changed files"
    (cd "$REPO_DIR" && git add -A && git commit -m "uwuify batch of markdown files" --quiet) || echo "ERROR: Git commit failed!"
  fi
}

# Process files in batches of MAX_PARALLEL * 2
BATCH_SIZE=$((MAX_PARALLEL * 2))
# Start with i=1 since bash arrays are 1-indexed
for ((i=1; i<=TOTAL_FILES; i+=BATCH_SIZE)); do
  echo "Processing batch starting at $i"
  # Ensure start_idx is at least 1
  start_idx=$i
  if [ "$start_idx" -lt 1 ]; then
    start_idx=1
  fi
  process_batch $start_idx $BATCH_SIZE
  
  # Print progress after each batch
  echo "Progress: $TOTAL_PROCESSED/$TOTAL_FILES files processed (Errors: $ERRORS, Changed: $CHANGED_FILES)"
  
  # Commit changes periodically to avoid large commits
  if [ "$CHANGED_FILES" -gt 0 ] && [ "$((TOTAL_PROCESSED % 100))" -lt "$BATCH_SIZE" ]; then
    echo "Periodic commit after $TOTAL_PROCESSED files"
    (cd "$REPO_DIR" && git add -A && git commit -m "uwuify periodic commit after $TOTAL_PROCESSED files" --quiet) || echo "WARNING: Git commit failed!"
  fi
done

# Finish up with a final commit if there are any uncommitted changes
echo "Final git operations"
if [ -f /tmp/changed_files.txt ]; then
  echo "Files changed: $CHANGED_FILES"
  if [ "$CHANGED_FILES" -gt 0 ]; then
    # Make sure all changes are committed
    (cd "$REPO_DIR" && git add -A && git commit -m "uwuify final changes" --quiet) || echo "WARNING: Final git commit failed!"
  fi
fi

# Create a summary file to ensure we have something to commit
echo "Creating summary markdown file"
TEST_CONTENT="# UwUify Processing Results

This repository was processed by the UwUify bot.

## Processing Summary

- Files found: $TOTAL_FILES
- Files processed: $TOTAL_PROCESSED
- Files changed: $CHANGED_FILES
- Errors encountered: $ERRORS

\${CHANGED_FILES} files were successfully uwuified.

\${TOTAL_FILES} > \${MAX_FILES} ? 'Note: Only a subset of files was processed due to repository size.' : 'All files in the repository were processed.'

Created automatically by the uwuify processing script.
"

echo "$TEST_CONTENT" > "$REPO_DIR/UWUIFY_RESULTS.md"
(cd "$REPO_DIR" && git add UWUIFY_RESULTS.md && git commit -m "Add uwuify processing results" --quiet) || echo "ERROR: Git commit of summary file failed!"

# Clean up
echo "Cleaning up temporary files"
rm -rf "$TEMP_DIR" || echo "WARNING: Could not remove temp dir: $TEMP_DIR"
rm -f /tmp/md_files_list.txt /tmp/processed_files.txt /tmp/changed_files.txt /tmp/error_files.txt
rm -f /tmp/batch_*.txt

echo "Processing summary:"
echo "- Total files found: $TOTAL_FILES"
echo "- Files processed: $TOTAL_PROCESSED"
echo "- Files changed: $CHANGED_FILES"
echo "- Errors encountered: $ERRORS"

echo "Completed processing files"
`;

    const batchScriptPath = path.join(os.tmpdir(), `uwuify-batch-${Date.now()}.sh`);
    fs.writeFileSync(batchScriptPath, batchScript, { mode: 0o755 });
    
    // Run the batch script
    logger.log("Starting batch processing script with detailed logging");
    try {
      // Execute the script with increased buffer size and memory, and use tee to capture output
      const bashCommand = `${batchScriptPath} "${tempDir}" "${uwuifyBinaryPath}" 2>&1 | tee /tmp/uwuify_output.log`;
      logger.log(`Executing command: ${bashCommand}`);
      
      const batchOutput = execSync(bashCommand, { 
        encoding: 'utf-8',
        maxBuffer: 12 * 1024 * 1024 * 1024, // 1GB buffer to handle very large outputs
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: '/bin/bash',
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=14192' // Increase Node.js memory limit
        }
      });
      
      // Read the complete log file
      let fullOutput = "";
      try {
        if (fs.existsSync('/tmp/uwuify_output.log')) {
          fullOutput = fs.readFileSync('/tmp/uwuify_output.log', 'utf-8');
          logger.log("Saved full output to /tmp/uwuify_output.log", { size: fullOutput.length });
          
          // Create a sample log file in the repo
          fs.writeFileSync(path.join(tempDir, 'uwuify-processing.log'), 
            fullOutput.slice(-10000)); // Last 10000 characters
        } else {
          logger.warn("Output log file does not exist");
        }
      } catch (readError) {
        logger.error(`Could not read output log: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
      }
      
      // Log a summary of the processing
      const outputLines = batchOutput.split('\n');
      const lastLines = outputLines.slice(-100).join('\n'); // Get the last 100 lines
      logger.log("Batch processing completed", { summary: lastLines });
    } catch (batchError) {
      logger.error(`Error during batch processing: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
      
      // Try to read the log file even if there was an error
      try {
        if (fs.existsSync('/tmp/uwuify_output.log')) {
          const errorOutput = fs.readFileSync('/tmp/uwuify_output.log', 'utf-8');
          const errorLines = errorOutput.split('\n');
          const errorSample = errorLines.slice(-200).join('\n'); // Last 200 lines
          logger.error("Error output from batch script", { sample: errorSample });
          
          // Create a log file in the repository with the error output
          fs.writeFileSync(path.join(tempDir, 'uwuify-error.log'), errorOutput);
          logger.log("Created error log in the repository");
        } else {
          logger.warn("Error output log file does not exist");
        }
      } catch (readError) {
        logger.error(`Could not read error output: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
      }
      
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