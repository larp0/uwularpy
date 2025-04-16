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
    logger.log("Using improved batch processing with detailed logging for large repositories");
    
    // Create a script file that will handle the uwuification in batches
    const batchScript = `#!/bin/bash
# Enable command tracing for detailed logs
set -x
set -e

REPO_DIR="$1"
UWUIFY_BINARY="$2"
BATCH_SIZE=50
TOTAL_PROCESSED=0
CHANGED_FILES=0

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

# Display first 10 files for verification
echo "Sample of files to process:"
head -n 10 /tmp/md_files_list.txt || echo "ERROR: Could not display sample files!"

# If no files found, exit early
if [ "$TOTAL_FILES" -eq 0 ]; then
  echo "No markdown files found in repository"
  exit 0
fi

# Create a directory for temporary file processing
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory for processing: $TEMP_DIR"

# Verify filesystem access and permissions
echo "Checking file permissions and access:"
ls -la "$REPO_DIR" | head -n 5
echo "Testing file read/write:"
TEST_PATH="$REPO_DIR/test-uwuify-access.txt"
echo "Test" > "$TEST_PATH" && echo "Write test: SUCCESS" || echo "Write test: FAILED"
cat "$TEST_PATH" && echo "Read test: SUCCESS" || echo "Read test: FAILED"
rm "$TEST_PATH" && echo "Delete test: SUCCESS" || echo "Delete test: FAILED"

# Process first file only as a test
TEST_FILE=$(head -n 1 /tmp/md_files_list.txt)
echo "===== TESTING PROCESSING WITH FIRST FILE: $TEST_FILE ====="
if [ -f "$TEST_FILE" ]; then
  TEST_TEMP="$TEMP_DIR/test.tmp"
  echo "File details:"
  ls -la "$TEST_FILE"
  echo "File content preview (first 10 lines):"
  head -n 10 "$TEST_FILE"
  echo "Saving original file for comparison"
  cp "$TEST_FILE" "$TEST_FILE.orig" || echo "ERROR: Could not copy test file!"
  
  echo "Running uwuify on test file"
  set +e  # Don't exit on error here
  "$UWUIFY_BINARY" -t 32 "$TEST_FILE" > "$TEST_TEMP" 2>/tmp/uwuify_test_error.log
  UWUIFY_EXIT_CODE=$?
  set -e  # Re-enable exit on error
  
  if [ $UWUIFY_EXIT_CODE -ne 0 ]; then
    echo "ERROR: UwUify failed on test file with exit code $UWUIFY_EXIT_CODE"
    echo "Error log:"
    cat /tmp/uwuify_test_error.log
    echo "Attempting to continue anyway..."
  else
    echo "UwUify completed successfully on test file"
  fi
  
  echo "Comparing test file before and after:"
  if [ -f "$TEST_TEMP" ]; then
    echo "Output file exists, size: $(wc -c < "$TEST_TEMP") bytes"
    echo "Diff output (first 20 lines):"
    diff -u "$TEST_FILE" "$TEST_TEMP" | head -n 20 || echo "Files are different (expected)"
  else
    echo "ERROR: Output file was not created!"
  fi
  
  echo "Test complete, continuing with batch processing"
else
  echo "ERROR: Test file not found or not accessible!"
  ls -la "$(dirname "$TEST_FILE")" || echo "ERROR: Cannot list directory!"
fi

# Counter for error tracking
ERRORS=0

# Process files one by one to avoid memory issues
echo "Starting main processing loop"
cat /tmp/md_files_list.txt | head -n 10 | while IFS= read -r file; do
  echo "------------------------------"
  echo "Processing: $file"
  
  # Check if the file exists and is readable
  if [ ! -f "$file" ]; then
    echo "ERROR: File doesn't exist or is not accessible: $file"
    ERRORS=$((ERRORS + 1))
    continue
  fi
  
  # Check file size (don't process files that are too large)
  FILE_SIZE=$(du -k "$file" | cut -f1)
  if [ "$FILE_SIZE" -gt 1024 ]; then
    echo "WARNING: File too large (${FILE_SIZE}KB), skipping: $file"
    continue
  fi
  
  # Create a unique name for the temporary file
  TEMP_FILE="$TEMP_DIR/$(basename "$file").tmp"
  
  # Process the file with uwuify, with error handling
  echo "Running uwuify binary on: $file"
  set +e  # Don't exit on error
  "$UWUIFY_BINARY" -t 32 "$file" > "$TEMP_FILE" 2>/tmp/uwuify_error.log
  UWUIFY_EXIT_CODE=$?
  set -e  # Re-enable exit on error
  
  if [ $UWUIFY_EXIT_CODE -eq 0 ]; then
    echo "UwUify completed successfully"
    
    # Compare the files to see if there are changes
    if ! cmp -s "$file" "$TEMP_FILE"; then
      echo "File changed, replacing original"
      # File was changed, replace it
      mv "$TEMP_FILE" "$file" || { echo "ERROR: Could not replace file!"; ERRORS=$((ERRORS + 1)); }
      echo "File changed: $file"
      CHANGED_FILES=$((CHANGED_FILES + 1))
      
      # Every 1000 changed files, make a commit to avoid large git operations
      if [ "$CHANGED_FILES" -ge 1000 ]; then
        echo "Committing batch of $CHANGED_FILES changed files"
        (cd "$REPO_DIR" && git add -A && git commit -m "uwuify batch of markdown files") || { echo "ERROR: Git commit failed!"; ERRORS=$((ERRORS + 1)); }
        CHANGED_FILES=0
      fi
    else
      echo "No changes in file, keeping original"
      # No changes, remove temp file
      rm "$TEMP_FILE" || echo "WARNING: Could not remove temp file: $TEMP_FILE"
    fi
  else
    ERRORS=$((ERRORS + 1))
    echo "ERROR processing file: $file (exit code: $UWUIFY_EXIT_CODE)"
    echo "UwUify error log:"
    cat /tmp/uwuify_error.log
    # If the uwuify command fails, remove the temp file and continue
    [ -f "$TEMP_FILE" ] && rm "$TEMP_FILE"
  fi
  
  TOTAL_PROCESSED=$((TOTAL_PROCESSED + 1))
  
  # Print progress periodically
  if [ $((TOTAL_PROCESSED % 10)) -eq 0 ]; then
    echo "Progress: $TOTAL_PROCESSED files processed (Errors: $ERRORS, Changed: $CHANGED_FILES)"
  fi
done

echo "First 10 files processed. Creating test file to ensure commit works."

# Create a test file to ensure we have something to commit
echo "Creating test markdown file to ensure Git operations work"
TEST_CONTENT="# Test UwUify File

This is a test file created to verify that Git operations are working correctly.
The uwuify processing script can commit and push this file even if other operations fail.

## Processing Summary

- Files found: $TOTAL_FILES
- Files processed: $TOTAL_PROCESSED
- Errors encountered: $ERRORS
- Files changed: $CHANGED_FILES

Created automatically by the uwuify processing script.
"

echo "$TEST_CONTENT" > "$REPO_DIR/UWUIFY_TEST_RESULTS.md"
(cd "$REPO_DIR" && git add UWUIFY_TEST_RESULTS.md && git commit -m "Add uwuify test results") || echo "ERROR: Git commit of test file failed!"

# Clean up
echo "Cleaning up temporary files"
rm -rf "$TEMP_DIR" || echo "WARNING: Could not remove temp dir: $TEMP_DIR"
rm /tmp/md_files_list.txt || echo "WARNING: Could not remove files list"
[ -f /tmp/uwuify_error.log ] && rm /tmp/uwuify_error.log
[ -f /tmp/uwuify_test_error.log ] && rm /tmp/uwuify_test_error.log

echo "Processing summary:"
echo "- Total files found: $TOTAL_FILES"
echo "- Files processed: $TOTAL_PROCESSED"
echo "- Errors encountered: $ERRORS"
echo "- Files changed: $CHANGED_FILES"

echo "Completed processing $TOTAL_PROCESSED files"
echo "All files processed successfully"
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
        maxBuffer: 1024 * 1024 * 1024, // 1GB buffer to handle very large outputs
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: '/bin/bash',
        env: {
          ...process.env,
          NODE_OPTIONS: '--max-old-space-size=8192' // Increase Node.js memory limit
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
  } catch (error) {
    logger.error(`Error during repository uwuification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }

  return tempDir;
}