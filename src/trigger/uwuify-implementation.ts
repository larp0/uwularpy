// src/trigger/uwuify-implementation.ts

import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubContext, RepoStats } from "../services/task-types";
import { uwuifyText } from "../lib/rust-uwuify"; // Import the Rust uwuify implementation

// Export the implementation function
export async function runUwuifyTask(payload: GitHubContext, ctx: any) {
  logger.log("Starting uwuification process", { payload });

  try {
    // Create an authenticated Octokit instance
    const octokit = await createAuthenticatedOctokit(payload.installationId);
    
    // Post an immediate reply comment
    await postReplyComment(octokit, payload.owner, payload.repo, payload.issueNumber);
    logger.log("Posted initial reply comment");
    
    // Create a new branch
    const branch = await createBranch(octokit, payload.owner, payload.repo, payload.issueNumber);
    logger.log("Created branch", { branch });
    
    // Gather repository statistics
    let repoStats: RepoStats | undefined;
    try {
      repoStats = await getRepositoryStatistics(octokit, payload.owner, payload.repo);
      logger.log("Gathered repository statistics", { repoStats });
    } catch (statsError) {
      logger.error("Error gathering repository statistics", { error: statsError });
      // Continue with the process even if stats gathering fails
    }

    // Find all markdown files in the repository
    const markdownFiles = await findAllMarkdownFiles(octokit, payload.owner, payload.repo);
    logger.log("Found markdown files", { count: markdownFiles.length });

    // Process each markdown file
    const processedFiles = await uwuifyRepositoryMarkdownFiles(
      octokit,
      payload.owner,
      payload.repo,
      branch,
      markdownFiles
    );
    
    logger.log("Processed files", { count: processedFiles.length });

    // Create a pull request with the changes
    const prUrl = await createPullRequest(
      octokit,
      payload.owner,
      payload.repo,
      branch,
      payload.issueNumber,
      repoStats
    );
    
    logger.log("Created pull request", { url: prUrl });

    // Notify the requester about the PR
    await notifyRequester(
      octokit,
      payload.owner,
      payload.repo,
      payload.issueNumber,
      payload.requester,
      prUrl
    );
    
    logger.log("Notified requester", { requester: payload.requester });

    return {
      success: true,
      prUrl,
      filesProcessed: processedFiles.length,
    };
  } catch (error) {
    logger.error("Error in uwuification process", { error });
    
    // Try to notify the requester about the error
    try {
      const octokit = await createAuthenticatedOctokit(payload.installationId);
      await postErrorComment(
        octokit,
        payload.owner,
        payload.repo,
        payload.issueNumber,
        payload.requester,
        "processing the repository",
        error
      );
    } catch (notifyError) {
      logger.error("Error notifying requester about failure", { error: notifyError });
    }
    
    throw error;
  }
}

// Create an authenticated Octokit instance
async function createAuthenticatedOctokit(installationId: number): Promise<any> {
  try {
    // GitHub App credentials should be stored in environment variables
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
    
    if (!appId || !privateKey) {
      throw new Error("GitHub App credentials not found in environment variables");
    }
    
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId,
      },
    });
    
    return octokit;
  } catch (error) {
    logger.error("Error creating authenticated Octokit instance", { error });
    throw error;
  }
}

// Post an immediate reply comment
async function postReplyComment(octokit: any, owner: string, repo: string, issueNumber: number): Promise<void> {
  try {
    // Post the reply comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: "see you, uwuing..."
    });
    
    logger.log(`Posted immediate reply to issue #${issueNumber}`);
  } catch (error) {
    logger.error('Error posting reply comment:', { error });
    throw error; // Re-throw to be handled by the caller
  }
}

// Post an error comment to notify the user
async function postErrorComment(octokit: any, owner: string, repo: string, issueNumber: number, requester: string, action: string, error: any): Promise<void> {
  try {
    const errorMessage = error && error.message ? error.message : 'Unknown error';
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `@${requester} I encountered an error while ${action}: \`${errorMessage}\`. Please check the repository settings and try again.`
    });
    
    logger.log(`Posted error comment to issue #${issueNumber}`);
  } catch (commentError) {
    logger.error('Error posting error comment:', { error: commentError });
    // We don't throw here as this is already error handling
  }
}

// Create a new branch from main
async function createBranch(octokit: any, owner: string, repo: string, issueNumber: number): Promise<string> {
  try {
    // Get the SHA of the latest commit on the main branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    });
    
    const mainSha = refData.object.sha;
    
    // Create a new branch
    const branchName = `uwuify-issue-${issueNumber}`;
    
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: mainSha,
    });
    
    return branchName;
  } catch (error) {
    logger.error('Error creating branch:', { error });
    throw error; // Re-throw to be handled by the caller
  }
}

// Gather repository statistics
async function getRepositoryStatistics(octokit: any, owner: string, repo: string): Promise<RepoStats> {
  try {
    // Get repository information
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    });
    
    // Get repository contents
    const { data: contentsData } = await octokit.repos.getContent({
      owner,
      repo,
      path: '',
    });
    
    // Get languages used in the repository
    const { data: languagesData } = await octokit.repos.listLanguages({
      owner,
      repo,
    });
    
    // Get contributors
    const { data: contributorsData } = await octokit.repos.listContributors({
      owner,
      repo,
    });
    
    // Find all markdown files recursively
    const markdownFiles = await findAllMarkdownFiles(octokit, owner, repo);
    
    // Calculate statistics
    let totalMarkdownSize = 0;
    let largestFile = { name: '', size: 0 };
    
    for (const file of markdownFiles) {
      totalMarkdownSize += file.size;
      
      if (file.size > largestFile.size) {
        largestFile = {
          name: file.path,
          size: file.size,
        };
      }
    }
    
    const avgMarkdownSize = markdownFiles.length > 0 ? Math.round(totalMarkdownSize / markdownFiles.length) : 0;
    
    return {
      totalFiles: repoData.size || contentsData.length,
      markdownFiles: markdownFiles.length,
      totalMarkdownSize,
      avgMarkdownSize,
      largestFile,
      contributors: contributorsData.length,
      lastUpdated: repoData.updated_at,
      topLanguages: languagesData,
    };
  } catch (error) {
    logger.error('Error gathering repository statistics:', { error });
    throw error;
  }
}

// Helper function to find all markdown files recursively
async function findAllMarkdownFiles(octokit: any, owner: string, repo: string, path: string = ''): Promise<Array<{path: string, size: number}>> {
  try {
    const { data: contents } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });
    
    let markdownFiles: Array<{path: string, size: number}> = [];
    
    for (const item of Array.isArray(contents) ? contents : [contents]) {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        markdownFiles.push({
          path: item.path,
          size: item.size,
        });
      } else if (item.type === 'dir') {
        const subDirFiles = await findAllMarkdownFiles(octokit, owner, repo, item.path);
        markdownFiles = [...markdownFiles, ...subDirFiles];
      }
    }
    
    return markdownFiles;
  } catch (error) {
    logger.error(`Error finding markdown files in ${path}:`, { error });
    return []; // Return empty array on error to continue with other directories
  }
}

// Process all markdown files in the repository
async function uwuifyRepositoryMarkdownFiles(
  octokit: any,
  owner: string,
  repo: string,
  branch: string,
  markdownFiles: Array<{path: string, size: number}>
): Promise<string[]> {
  try {
    // Get the current commit SHA for the branch
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    
    const branchSha = refData.object.sha;
    
    // Get the current tree
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: branchSha,
    });
    
    const treeSha = commitData.tree.sha;
    
    // Process each markdown file and collect the changes
    const changes = [];
    const processedFiles = [];
    
    for (const file of markdownFiles) {
      try {
        // Get the file content
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: file.path,
          ref: branch,
        });
        
        // Decode the content
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        
        // Uwuify the content using the Rust implementation
        // Fix: Await the uwuifyText function to get the string value
        const uwuifiedContent = await uwuifyText(content);
        
        // Only add to changes if the content actually changed
        if (uwuifiedContent !== content) {
          changes.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            content: uwuifiedContent,
          });
          
          processedFiles.push(file.path);
        }
      } catch (fileError) {
        logger.error(`Error processing file ${file.path}:`, { error: fileError });
        // Continue with other files
      }
    }
    
    // If there are no changes, return empty array
    if (changes.length === 0) {
      return [];
    }
    
    // Create a new tree with the changes
    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: changes,
    });
    
    // Create a new commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `Uwuify markdown files for issue #${branch.split('-').pop()}`,
      tree: newTree.sha,
      parents: [branchSha],
    });
    
    // Update the branch reference
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });
    
    return processedFiles;
  } catch (error) {
    logger.error('Error uwuifying repository markdown files:', { error });
    throw error;
  }
}

// Create a pull request with the changes
async function createPullRequest(
  octokit: any,
  owner: string,
  repo: string,
  branch: string,
  issueNumber: number,
  repoStats?: RepoStats
): Promise<string> {
  try {
    // Create the pull request
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo,
      title: `Uwuify markdown files for issue #${issueNumber}`,
      head: branch,
      base: 'main',
      body: `This PR uwuifies all markdown files in the repository as requested in issue #${issueNumber}.

${formatRepositoryStatistics(repoStats)}

## Changes
- Uwuified all markdown files in the repository using Rust implementation
- Created by @uwularpy bot
`,
    });
    
    return pr.html_url;
  } catch (error) {
    logger.error('Error creating pull request:', { error });
    throw error;
  }
}

// Notify the requester about the PR
async function notifyRequester(
  octokit: any,
  owner: string,
  repo: string,
  issueNumber: number,
  requester: string,
  prUrl: string
): Promise<void> {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `@${requester} I've created a pull request with uwuified markdown files (using Rust implementation): ${prUrl}`,
    });
  } catch (error) {
    logger.error('Error notifying requester:', { error });
    throw error;
  }
}

// Format repository statistics for display
function formatRepositoryStatistics(stats: RepoStats | undefined): string {
  if (!stats) return '';
  
  try {
    // Format the last updated date
    const lastUpdated = new Date(stats.lastUpdated).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    // Format the top languages
    const topLanguages = Object.entries(stats.topLanguages || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang, bytes]) => `${lang} (${formatBytes(bytes)})`)
      .join(', ');
    
    return `
## Repository Statistics 📊

Here are some interesting insights about this repository:

- **Total Files:** ${stats.totalFiles}
- **Markdown Files:** ${stats.markdownFiles} (${Math.round((stats.markdownFiles / stats.totalFiles) * 100)}% of total)
- **Total Markdown Size:** ${formatBytes(stats.totalMarkdownSize)}
- **Average Markdown File Size:** ${formatBytes(stats.avgMarkdownSize)}
- **Largest Markdown File:** \`${stats.largestFile.name || 'None'}\` (${formatBytes(stats.largestFile.size)})
- **Contributors:** ${stats.contributors}
- **Last Updated:** ${lastUpdated}
- **Top Languages:** ${topLanguages || 'None detected'}

*These statistics were generated at the time of uwuification.*
`;
  } catch (error) {
    logger.error('Error formatting repository statistics:', { error });
    return ''; // Return empty string on error to avoid breaking the PR creation
  }
}

// Helper function to format bytes to human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
