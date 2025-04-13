require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
app.use(express.json());

// GitHub App credentials
const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Verify GitHub webhook signature
function verifySignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    throw new Error('No X-Hub-Signature-256 found on request');
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Post an immediate reply comment
async function postReplyComment(octokit, owner, repo, issueNumber) {
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
async function createBranch(octokit, owner, repo, issueNumber) {
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
async function addUwuifyScript(octokit, owner, repo, branch) {
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

// Run the uwuify script and commit changes
async function runUwuifyScript(octokit, owner, repo, branch) {
  // Get the tree of the branch
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  
  const commitSha = refData.object.sha;
  
  // Get the commit to get the tree
  const { data: commitData } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });
  
  const treeSha = commitData.tree.sha;
  
  // Get all markdown files in the repository
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: 1,
  });
  
  // Find all markdown files
  const markdownFiles = treeData.tree.filter(item => 
    item.path.endsWith('.md') && item.type === 'blob'
  );
  
  // Process each markdown file
  for (const file of markdownFiles) {
    // Get the content of the file
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: file.path,
      ref: branch,
    });
    
    // Decode the content
    const content = Buffer.from(fileData.content, 'base64').toString();
    
    // Uwuify the content
    const uwuifiedContent = require('uwuify').uwuify(content);
    
    // Update the file with uwuified content
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: file.path,
      message: `Uwuify ${file.path}`,
      content: Buffer.from(uwuifiedContent).toString('base64'),
      sha: fileData.sha,
      branch,
    });
  }
  
  // Delete the uwuify script
  const { data: scriptFile } = await octokit.repos.getContent({
    owner,
    repo,
    path: 'uwuify_repo.py',
    ref: branch,
  });
  
  await octokit.repos.deleteFile({
    owner,
    repo,
    path: 'uwuify_repo.py',
    message: 'Remove uwuify script',
    sha: scriptFile.sha,
    branch,
  });
}

// Create a pull request
async function createPullRequest(octokit, owner, repo, branch, issueNumber, requester) {
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

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // Verify webhook signature
    if (!verifySignature(req)) {
      return res.status(401).send('Invalid signature');
    }
    
    const event = req.headers['x-github-event'];
    const payload = req.body;
    
    // Only process issue_comment events
    if (event === 'issue_comment' && payload.action === 'created') {
      const comment = payload.comment.body;
      const issueNumber = payload.issue.number;
      const requester = payload.comment.user.login;
      const repo = payload.repository.name;
      const owner = payload.repository.owner.login;
      
      // Check if the comment mentions @uwularpy
      if (comment.includes('@uwularpy')) {
        console.log(`Mention detected in issue #${issueNumber} by ${requester}`);
        
        // Create an authenticated Octokit instance
        const octokit = new Octokit({
          authStrategy: createAppAuth,
          auth: {
            appId: APP_ID,
            privateKey: PRIVATE_KEY,
            installationId: payload.installation.id,
          },
        });
        
        // Post an immediate reply comment for validation
        await postReplyComment(octokit, owner, repo, issueNumber);
        
        // Create a new branch
        const branch = await createBranch(octokit, owner, repo, issueNumber);
        console.log(`Created branch: ${branch}`);
        
        // Add uwuify script to the repository
        await addUwuifyScript(octokit, owner, repo, branch);
        console.log('Added uwuify script to the repository');
        
        // Run the uwuify script and commit changes
        await runUwuifyScript(octokit, owner, repo, branch);
        console.log('Ran uwuify script and committed changes');
        
        // Create a pull request
        const prNumber = await createPullRequest(octokit, owner, repo, branch, issueNumber, requester);
        console.log(`Created pull request #${prNumber}`);
      }
    }
    
    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
