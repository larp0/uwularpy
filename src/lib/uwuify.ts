// src/lib/uwuify.ts
// GitHub API uwuify operations with correct typing

import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Type for GitHub tree entries with correct mode and type constraints
 */
interface GitHubTreeEntry {
  path: string;
  mode: "100644" | "100755" | "040000" | "160000" | "120000";
  type: "blob" | "tree" | "commit";
  content?: string;
  sha?: string;
}

/**
 * Create a uwuified version of repository content using GitHub API
 * @param repoUrl - URL of the repository to clone
 * @param branchName - Name of the branch to create
 * @param installationId - GitHub App installation ID
 * @returns Path to the cloned repository
 */
export async function uwuifyRepository(
  repoUrl: string, 
  branchName: string, 
  installationId?: string
): Promise<string> {
  logger.log("Starting GitHub API uwuification", { repoUrl, branchName });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  logger.log(`Created temporary directory at: ${tempDir}`);

  try {
    // Setup GitHub authentication
    const githubAppId = process.env.GITHUB_APP_ID;
    const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!githubAppId || !githubPrivateKey || !installationId) {
      logger.warn("GitHub App credentials missing. Using fallback method.");
      // Fallback to binary method
      const { uwuifyRepository: binaryUwuifyRepository } = await import('./binary-uwuify');
      return await binaryUwuifyRepository(repoUrl, branchName, installationId);
    }

    // Parse repository info
    const repoUrlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/.]+)(?:\.git)?$/);
    if (!repoUrlMatch) {
      throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
    }
    const [owner, repo] = [repoUrlMatch[1], repoUrlMatch[2]];

    // Create authenticated Octokit instance
    const auth = createAppAuth({
      appId: githubAppId,
      privateKey: githubPrivateKey,
    });

    const installationAuthentication = await auth({
      type: "installation",
      installationId: parseInt(installationId, 10),
    });

    const octokit = new Octokit({
      auth: installationAuthentication.token,
    });

    logger.log("GitHub authentication successful");

    // Get the default branch
    const { data: repoData } = await octokit.repos.get({
      owner,
      repo,
    });

    const defaultBranch = repoData.default_branch;
    logger.log(`Default branch: ${defaultBranch}`);

    // Get the latest commit SHA
    const { data: refData } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
    });

    const latestCommitSha = refData.object.sha;
    logger.log(`Latest commit SHA: ${latestCommitSha}`);

    // Get the tree SHA
    const { data: commitData } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });

    const treeSha = commitData.tree.sha;
    logger.log(`Tree SHA: ${treeSha}`);

    // Get all markdown files from the repository
    const { data: treeData } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: "true",
    });

    // Process markdown files and create uwuified content
    const fileChanges: GitHubTreeEntry[] = [];
    
    for (const item of treeData.tree) {
      if (item.type === "blob" && item.path && item.path.endsWith('.md')) {
        try {
          // Get the file content
          const { data: blobData } = await octokit.git.getBlob({
            owner,
            repo,
            file_sha: item.sha!,
          });

          // Decode the content
          const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
          
          // Uwuify the content (simple transformation for now)
          const uwuifiedContent = uwuifyText(content);

          // Only add to changes if content actually changed
          if (uwuifiedContent !== content) {
            fileChanges.push({
              path: item.path,
              mode: "100644" as const, // Explicitly type as literal
              type: "blob" as const,   // Explicitly type as literal
              content: uwuifiedContent,
            });
          }
        } catch (error) {
          logger.warn(`Failed to process file ${item.path}:`, { error });
        }
      }
    }

    if (fileChanges.length === 0) {
      logger.log("No markdown files needed uwuification");
      // Create a simple test file to ensure we have changes
      fileChanges.push({
        path: "UWUIFY_RESULTS.md",
        mode: "100644" as const,
        type: "blob" as const,
        content: "# UwU Results\n\nThis repository has been uwuified! 🌟\n",
      });
    }

    logger.log(`Creating ${fileChanges.length} file changes`);

    // Create a new tree with the changes
    const { data: newTreeData } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: treeSha,
      tree: fileChanges, // This should now have correct types
    });

    logger.log(`Created new tree: ${newTreeData.sha}`);

    // Create a new commit
    const { data: newCommitData } = await octokit.git.createCommit({
      owner,
      repo,
      message: "uwu",
      tree: newTreeData.sha,
      parents: [latestCommitSha],
    });

    logger.log(`Created new commit: ${newCommitData.sha}`);

    // Create the new branch
    await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: newCommitData.sha,
    });

    logger.log(`Created branch: ${branchName}`);

    return tempDir;

  } catch (error) {
    logger.error(`Error during GitHub API uwuification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Simple uwuification function
 */
function uwuifyText(text: string): string {
  return text
    .replace(/r/g, 'w')
    .replace(/R/g, 'W')
    .replace(/l/g, 'w')
    .replace(/L/g, 'W')
    .replace(/n([aeiou])/g, 'ny$1')
    .replace(/N([aeiou])/g, 'Ny$1')
    .replace(/N([AEIOU])/g, 'Ny$1')
    .replace(/ove/g, 'uv')
    .replace(/OVE/g, 'UV')
    .replace(/\./g, ' uwu')
    .replace(/!/g, ' owo!')
    .replace(/\?/g, ' uwu?');
}

/**
 * Get top contributors of a repository by number of merged PRs
 * Re-export from binary-uwuify for compatibility
 */
export function getTopContributorsByMergedPRs(repoPath: string, limit: number = 5): Array<{name: string, count: number}> {
  // Import synchronously and call the function
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getTopContributorsByMergedPRs: binaryGetTopContributors } = require('./binary-uwuify');
  return binaryGetTopContributors(repoPath, limit);
}