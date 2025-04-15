// src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedOctokit, verifyWebhookSignature } from '@/lib/github-auth';
import { Octokit } from '@octokit/rest';
import { client } from '@/trigger';
import { uwuifyRepositoryTask } from '@/trigger/uwuify';

// Interface for repository statistics
interface RepoStats {
  totalFiles: number;
  markdownFiles: number;
  totalMarkdownSize: number;
  avgMarkdownSize: number;
  largestFile: {
    name: string;
    size: number;
  };
  contributors: number;
  lastUpdated: string;
  topLanguages: { [key: string]: number };
}

// POST handler for webhook
export async function POST(request: NextRequest) {
  try {
    // Get the raw request body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    
    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const event = request.headers.get('x-github-event');
    
    // Only process issue_comment events
    if (event === 'issue_comment' && body.action === 'created') {
      const comment = body.comment.body;
      const issueNumber = body.issue.number;
      const requester = body.comment.user.login;
      const repo = body.repository.name;
      const owner = body.repository.owner.login;
      
      // Check if the comment mentions @uwularpy
      if (comment.includes('@uwularpy')) {
        console.log(`Mention detected in issue #${issueNumber} by ${requester}`);
        
        try {
          // Create an authenticated Octokit instance
          const octokit = await createAuthenticatedOctokit(body.installation.id);
          
          // Post an immediate reply comment for validation
          try {
            await postReplyComment(octokit, owner, repo, issueNumber);
          } catch (replyError) {
            console.error('Error posting initial reply:', replyError);
            await postErrorComment(octokit, owner, repo, issueNumber, requester, 'posting initial reply', replyError);
            return NextResponse.json({ error: 'Error posting initial reply' }, { status: 500 });
          }
          
          // Create a new branch
          let branch: string;
          try {
            branch = await createBranch(octokit, owner, repo, issueNumber);
            console.log(`Created branch: ${branch}`);
          } catch (branchError) {
            console.error('Error creating branch:', branchError);
            await postErrorComment(octokit, owner, repo, issueNumber, requester, 'creating branch', branchError);
            return NextResponse.json({ error: 'Error creating branch' }, { status: 500 });
          }
          
          // Gather repository statistics
          let repoStats: RepoStats | undefined = undefined;
          try {
            repoStats = await getRepositoryStatistics(octokit, owner, repo);
            console.log('Gathered repository statistics');
          } catch (statsError) {
            console.error('Error gathering repository statistics:', statsError);
            // Continue with the process even if stats gathering fails
            // Keep repoStats as undefined instead of setting to null
          }
          
          // Trigger the uwuify repository task using trigger.dev
          try {
            const runId = await client.runTask(uwuifyRepositoryTask, {
              owner,
              repo,
              issueNumber,
              requester,
              installationId: body.installation.id,
              branch,
              repoStats,
              requestTimestamp: new Date().toISOString(),
              requestId: generateRequestId(),
            });
            
            console.log(`Triggered uwuify repository task, run ID: ${runId}`);
            
            // Return success response immediately after triggering the task
            return NextResponse.json({ 
              message: 'Webhook processed successfully', 
              runId: runId 
            }, { status: 200 });
          } catch (taskError) {
            console.error('Error triggering uwuify repository task:', taskError);
            await postErrorComment(octokit, owner, repo, issueNumber, requester, 'triggering uwuification task', taskError);
            return NextResponse.json({ error: 'Error triggering uwuification task' }, { status: 500 });
          }
        } catch (authError) {
          console.error('Error authenticating with GitHub:', authError);
          try {
            // Try to post an error comment even without authentication if possible
            const errorMessage = authError instanceof Error ? authError.message : 'Unknown authentication error';
            const tempOctokit = new Octokit(); // Create a non-authenticated Octokit instance
            await tempOctokit.issues.createComment({
              owner,
              repo,
              issue_number: issueNumber,
              body: `@${requester} I encountered an error while authenticating with GitHub: \`${errorMessage}\`. Please check the repository settings and try again.`
            });
          } catch (commentError) {
            console.error('Could not post error comment after authentication failure:', commentError);
          }
          return NextResponse.json({ error: 'Error authenticating with GitHub' }, { status: 500 });
        }
      }
    }
    
    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ 
      error: 'Error processing webhook', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
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
    
    console.log(`Posted immediate reply to issue #${issueNumber}`);
  } catch (error) {
    console.error('Error posting reply comment:', error);
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
    
    console.log(`Posted error comment to issue #${issueNumber}`);
  } catch (commentError) {
    console.error('Error posting error comment:', commentError);
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
    console.error('Error creating branch:', error);
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
    console.error('Error gathering repository statistics:', error);
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
    console.error(`Error finding markdown files in ${path}:`, error);
    return []; // Return empty array on error to continue with other directories
  }
}

/**
 * Generates a unique request ID for tracking
 * 
 * @returns A unique ID string
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
