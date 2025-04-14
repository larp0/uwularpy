// src/lib/uwuify.ts

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Uwuifies markdown content using the Rust-based uwuify tool
 * 
 * @param content - The markdown content to uwuify
 * @returns The uwuified content with preserved code blocks
 */
export async function uwuifyMarkdown(content: string): Promise<string> {
  try {
    // Create temporary directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uwuify-'));
    const inputFile = path.join(tempDir, 'input.md');
    const outputFile = path.join(tempDir, 'output.md');
    
    // Write content to input file
    await fs.writeFile(inputFile, content, 'utf-8');
    
    // Run Rust-based uwuify command
    await execPromise(`uwuify -t 32 "${inputFile}" "${outputFile}"`);
    
    // Read uwuified content
    const uwuifiedContent = await fs.readFile(outputFile, 'utf-8');
    
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true });
    
    return uwuifiedContent;
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
      item.path && item.path.endsWith('.md') && item.type === 'blob'
    );
    
    console.log(`Found ${markdownFiles.length} markdown files to uwuify`);
    
    // Process each markdown file
    for (const file of markdownFiles) {
      // Get the content of the file
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path!,
        ref: branch,
      });
      
      // Check if fileData is a single file (not an array) and has content property
      if (!Array.isArray(fileData) && 'content' in fileData) {
        // Decode the content
        const content = Buffer.from(fileData.content, 'base64').toString();
        
        // Uwuify the content
        const uwuifiedContent = await uwuifyMarkdown(content);
        
        // Update the file with uwuified content
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: file.path!,
          message: `Uwuify ${file.path}`,
          content: Buffer.from(uwuifiedContent).toString('base64'),
          sha: fileData.sha,
          branch,
        });
        
        console.log(`Uwuified ${file.path}`);
      } else {
        console.log(`Skipping ${file.path} - not a single file or missing content property`);
      }
    }
  } catch (error) {
    console.error('Error uwuifying repository markdown files:', error);
    throw error;
  }
}
