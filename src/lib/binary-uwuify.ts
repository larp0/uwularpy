// src/lib/binary-uwuify.ts
// This file provides a direct interface to the uwuify binary

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from "@trigger.dev/sdk/v3";

/**
 * Process a repository with the uwuify binary
 * @param repoUrl - URL of the repository to clone
 * @param branchName - Name of the branch to create
 * @returns Path to the cloned repository
 */
export async function uwuifyRepository(repoUrl: string, branchName: string): Promise<string> {
  logger.log("Starting repository uwuification", { repoUrl, branchName });
  
  // Create a temporary directory for the repository
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  
  try {
    // Get the path to the uwuify binary
    const uwuifyBinaryPath = path.join(process.cwd(), 'src', 'lib', 'bin', 'uwuify');
    
    // Ensure the binary is executable
    try {
      fs.accessSync(uwuifyBinaryPath, fs.constants.X_OK);
    } catch (error) {
      logger.log("Making uwuify binary executable");
      execSync(`chmod +x "${uwuifyBinaryPath}"`);
    }
    
    // Get the GitHub token from environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      logger.warn("No GITHUB_TOKEN found in environment variables. Git operations may fail if authentication is required.");
    }
    
    // Extract owner and repo from repoUrl
    const repoUrlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/);
    const owner = repoUrlMatch ? repoUrlMatch[1] : null;
    const repo = repoUrlMatch ? repoUrlMatch[2] : null;
    
    // Prepare authenticated URL for git operations if token is available
    const authenticatedRepoUrl = githubToken && owner && repo
      ? `https://${githubToken}@github.com/${owner}/${repo}.git`
      : repoUrl;
    
    // Clone the repository using the authenticated URL if available
    logger.log(`Cloning repository: ${repoUrl}`);
    execSync(`git clone ${authenticatedRepoUrl} ${tempDir}`, { stdio: 'inherit' });
    
    // Change to the repository directory
    process.chdir(tempDir);
    
    // Create and checkout a new branch
    logger.log(`Creating branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
    
    // Run the uwuify_repo.js script using the binary
    logger.log("Running uwuify on repository");
    
    // Find all markdown files
    const markdownFiles: string[] = [];
    findMarkdownFiles(tempDir, markdownFiles);
    logger.log(`Found ${markdownFiles.length} markdown files to process`);
    
    // Process each markdown file with the uwuify binary
    for (const file of markdownFiles) {
      try {
        logger.log(`Processing file: ${file}`);
        
        // Create temporary files for input/output
        const tempInput = path.join(os.tmpdir(), `uwuify-input-${path.basename(file)}`);
        const tempOutput = path.join(os.tmpdir(), `uwuify-output-${path.basename(file)}`);
        
        // Read the original content
        const content = fs.readFileSync(file, 'utf-8');
        
        // Write to temp input file
        fs.writeFileSync(tempInput, content, 'utf-8');
        
        // Run the uwuify binary directly
        execSync(`"${uwuifyBinaryPath}" -t 32 "${tempInput}" "${tempOutput}"`);
        
        // Read the uwuified content
        const uwuifiedContent = fs.readFileSync(tempOutput, 'utf-8');
        
        // Write back to the original file
        fs.writeFileSync(file, uwuifiedContent, 'utf-8');
        
        // Clean up temp files
        fs.unlinkSync(tempInput);
        fs.unlinkSync(tempOutput);
        
        logger.log(`Successfully processed: ${file}`);
      } catch (error) {
        logger.error(`Error processing file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Commit the changes
    logger.log("Committing changes");
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "uwu"', { stdio: 'inherit' });
    
    // Configure Git with token for authentication if available
    if (githubToken) {
      logger.log("Configuring Git with token for authentication");
      
      // Set up Git credentials using the token
      if (owner && repo) {
        const remoteUrl = `https://${githubToken}@github.com/${owner}/${repo}.git`;
        execSync(`git remote set-url origin ${remoteUrl}`);
      }
    }
    
    // Push the changes
    logger.log("Pushing changes");
    execSync(`git push origin ${branchName}`, { stdio: 'inherit' });
    
    return tempDir;
  } catch (error) {
    logger.error(`Error in uwuifyRepository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Get the top contributors by merged PRs
 * @param repoDir - Path to the repository directory
 * @param count - Number of top contributors to return
 * @returns Array of top contributors with their PR counts
 */
export function getTopContributorsByMergedPRs(repoDir: string, count: number = 5): Array<{name: string, count: number}> {
  try {
    const currentDir = process.cwd();
    process.chdir(repoDir);
    
    // Get all merged PRs and their authors
    const gitLogOutput = execSync(
      'git log --merges --pretty=format:"%an" | grep -v "^$"',
      { encoding: 'utf-8' }
    );
    
    // Restore original directory
    process.chdir(currentDir);
    
    // Count occurrences of each author
    const authorCounts: Record<string, number> = {};
    const authors = gitLogOutput.split('\n');
    
    for (const author of authors) {
      if (author.trim()) {
        authorCounts[author] = (authorCounts[author] || 0) + 1;
      }
    }
    
    // Convert to array and sort by count
    const sortedAuthors = Object.entries(authorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, count);
    
    return sortedAuthors;
  } catch (error) {
    logger.error(`Error getting top contributors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

/**
 * Helper function to find all markdown files in a directory recursively
 */
function findMarkdownFiles(dir: string, results: string[]) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      findMarkdownFiles(fullPath, results);
    } else if (file.isFile() && file.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
}
