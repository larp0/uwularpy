// src/lib/uwuify.ts

import { Octokit } from '@octokit/rest';

/**
 * Uwuifies markdown content while preserving code blocks
 * 
 * @param content - The markdown content to uwuify
 * @returns The uwuified content with preserved code blocks
 */
export function uwuifyMarkdown(content: string): string {
  try {
    // Preserve code blocks
    const codeBlocks: string[] = [];
    
    // Function to save code blocks and replace them with placeholders
    const saveCodeBlock = (match: string) => {
      codeBlocks.push(match);
      return `CODE_BLOCK_${codeBlocks.length - 1}`;
    };
    
    // Save code blocks
    let contentWithoutCode = content.replace(/```[\s\S]*?```/g, (match) => saveCodeBlock(match));
    contentWithoutCode = contentWithoutCode.replace(/`[^`]*`/g, (match) => saveCodeBlock(match));
    
    // Import uwuify dynamically to avoid server/client mismatch issues
    const uwuify = require('uwuify');
    
    // Uwuify the text
    const uwuifiedContent = uwuify.uwuify(contentWithoutCode);
    
    // Restore code blocks
    let finalContent = uwuifiedContent;
    for (let i = 0; i < codeBlocks.length; i++) {
      finalContent = finalContent.replace(`CODE_BLOCK_${i}`, codeBlocks[i]);
    }
    
    return finalContent;
  } catch (error) {
    console.error('Error uwuifying content:', error);
    return content; // Return original content if uwuification fails
  }
}

/**
 * Processes all markdown files in a repository and uwuifies them
 * 
 * @param octokit - Authenticated Octokit instance
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name
 */
export async function uwuifyRepositoryMarkdownFiles(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  branch: string
): Promise<void> {
  try {
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
      recursive: "1",
    });
    
    // Find all markdown files
    const markdownFiles = treeData.tree.filter(item => 
      item.path.endsWith('.md') && item.type === 'blob'
    );
    
    console.log(`Found ${markdownFiles.length} markdown files to uwuify`);
    
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
      const uwuifiedContent = uwuifyMarkdown(content);
      
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
      
      console.log(`Uwuified ${file.path}`);
    }
  } catch (error) {
    console.error('Error uwuifying repository markdown files:', error);
    throw error;
  }
}
