// src/trigger/uwuify-implementation.ts

import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubContext, RepoStats } from "../services/task-types";
import { uwuifyRepository, getTopContributorsByMergedPRs } from "../lib/binary-uwuify";

// Export the implementation function
export async function runUwuifyTask(payload: GitHubContext, ctx: any) {
  logger.log("Starting uwuification process", { payload });

  try {
    // Create an authenticated Octokit instance
    const octokit = await createAuthenticatedOctokit(payload.installationId);
    
    // Post an immediate reply comment
    await postReplyComment(octokit, payload.owner, payload.repo, payload.issueNumber);
    logger.log("Posted initial reply comment");
    
    // Create a new branch name
    const branchName = `uwuify-issue-${payload.issueNumber}`;
    logger.log("Using branch name", { branchName });
    
    // Clone and process the repository using the binary
    const repoUrl = `https://github.com/${payload.owner}/${payload.repo}.git`;
    const repoDir = await uwuifyRepository({repoUrl, branchName}, `${payload.installationId}`);
    logger.log("Processed repository", { repoDir });
    
    // Gather repository statistics
    let repoStats: RepoStats | undefined;
    try {
      repoStats = await getRepositoryStatistics(octokit, payload.owner, payload.repo);
      
      // Get top contributors by merged PRs
      const topContributors = getTopContributorsByMergedPRs(repoDir, 5);
      if (repoStats && topContributors.length > 0) {
        repoStats.topContributors = topContributors;
      }
      
      logger.log("Gathered repository statistics", { repoStats });
    } catch (statsError) {
      logger.error("Error gathering repository statistics", { error: statsError });
      // Continue with the process even if stats gathering fails
    }
    
    // Create a pull request with the changes
    const prUrl = await createPullRequest(
      octokit,
      payload.owner,
      payload.repo,
      branchName,
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
- Uwuified all markdown files in the repository using the Rust binary implementation
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
      body: `@${requester} I've created a pull request with uwuified markdown files (using Rust binary implementation): ${prUrl}`,
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
    
    // Format top contributors section
    let topContributorsSection = '';
    if (stats.topContributors && stats.topContributors.length > 0) {
      topContributorsSection = `
## Top Contributors by Merged PRs 👥

${stats.topContributors.map((contributor, index) => 
  `${index + 1}. **${contributor.name}** - ${contributor.count} merged PR${contributor.count !== 1 ? 's' : ''}`
).join('\n')}

`;
    }
    
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

${topContributorsSection}
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
