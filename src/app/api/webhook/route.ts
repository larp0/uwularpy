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
        
        // Add uwuify script to the repository
        await addUwuifyScript(octokit, owner, repo, branch);
        console.log('Added uwuify script to the repository');
        
        // Uwuify all markdown files in the repository
        await uwuifyRepositoryMarkdownFiles(octokit, owner, repo, branch);
        console.log('Uwuified all markdown files in the repository');
        
        // Delete the uwuify script
        await deleteUwuifyScript(octokit, owner, repo, branch);
        console.log('Removed uwuify script from the repository');
        
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

// Add uwuify script to the repository
async function addUwuifyScript(octokit: any, owner: string, repo: string, branch: string) {
  // Content of the uwuify script
  const scriptContent = `#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path
try:
    import uwuify
except ImportError:
    os.system('pip install uwuify')
    import uwuify

def uwuify_markdown_file(file_path):
    """Uwuify the content of a markdown file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Preserve code blocks
    code_blocks = []
    def save_code_block(match):
        code_blocks.append(match.group(0))
        return f"CODE_BLOCK_{len(code_blocks) - 1}"
    
    # Save code blocks
    content_without_code = re.sub(r'\`\`\`.*?\`\`\`', save_code_block, content, flags=re.DOTALL)
    content_without_code = re.sub(r'\`.*?\`', save_code_block, content_without_code)
    
    # Uwuify the text
    uwuified_content = uwuify.uwuify(content_without_code)
    
    # Restore code blocks
    for i, block in enumerate(code_blocks):
        uwuified_content = uwuified_content.replace(f"CODE_BLOCK_{i}", block)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(uwuified_content)

def main():
    """Find and uwuify all markdown files in the repository."""
    # Get the repository root directory
    repo_root = os.getcwd()
    
    # Find all markdown files
    markdown_files = list(Path(repo_root).rglob('*.md'))
    
    print(f"Found {len(markdown_files)} markdown files")
    
    # Uwuify each markdown file
    for file_path in markdown_files:
        print(f"Uwuifying {file_path}")
        uwuify_markdown_file(file_path)
    
    print("All markdown files have been uwuified!")

if __name__ == "__main__":
    main()
`;

  // Create or update the uwuify_repo.py file
  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'uwuify_repo.py',
    message: 'Add uwuify script',
    content: Buffer.from(scriptContent).toString('base64'),
    branch,
  });
}

// Delete the uwuify script
async function deleteUwuifyScript(octokit: any, owner: string, repo: string, branch: string) {
  try {
    // Get the script file
    const { data: scriptFile } = await octokit.repos.getContent({
      owner,
      repo,
      path: 'uwuify_repo.py',
      ref: branch,
    });
    
    // Delete the file
    await octokit.repos.deleteFile({
      owner,
      repo,
      path: 'uwuify_repo.py',
      message: 'Remove uwuify script',
      sha: scriptFile.sha,
      branch,
    });
  } catch (error) {
    console.error('Error deleting uwuify script:', error);
  }
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
