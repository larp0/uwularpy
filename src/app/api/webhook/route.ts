// src/app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedOctokit, verifyWebhookSignature } from '@/lib/github-auth';
import { uwuifyRepositoryMarkdownFiles } from '@/lib/uwuify';

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
        
        // Create an authenticated Octokit instance
        const octokit = await createAuthenticatedOctokit(body.installation.id);
        
        // Post an immediate reply comment for validation
        await postReplyComment(octokit, owner, repo, issueNumber);
        
        // Create a new branch
        const branch = await createBranch(octokit, owner, repo, issueNumber);
        console.log(`Created branch: ${branch}`);
        
        // Uwuify all markdown files in the repository
        await uwuifyRepositoryMarkdownFiles(octokit, owner, repo, branch);
        console.log('Uwuified all markdown files in the repository');
        
        // Create a pull request
        const prNumber = await createPullRequest(octokit, owner, repo, branch, issueNumber, requester);
        console.log(`Created pull request #${prNumber}`);
      }
    }
    
    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Error processing webhook' }, { status: 500 });
  }
}

// Post an immediate reply comment
async function postReplyComment(octokit: any, owner: string, repo: string, issueNumber: number) {
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
  }
}

// Create a new branch from main
async function createBranch(octokit: any, owner: string, repo: string, issueNumber: number) {
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
}

// Create a pull request
async function createPullRequest(octokit: any, owner: string, repo: string, branch: string, issueNumber: number, requester: string) {
  const { data: pullRequest } = await octokit.pulls.create({
    owner,
    repo,
    title: `Uwuify markdown files (requested in #${issueNumber})`,
    body: `This PR uwuifies all markdown files in the repository as requested by @${requester} in issue #${issueNumber}.`,
    head: branch,
    base: 'main',
  });
  
  // Add a comment to the issue mentioning the requester
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: `@${requester} I've created a pull request with uwuified markdown files: ${pullRequest.html_url}`,
  });
  
  return pullRequest.number;
}
