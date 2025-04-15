// src/lib/uwuify.ts

import { Octokit } from '@octokit/rest';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execPromise = promisify(exec);
const writeFilePromise = promisify(fs.writeFile);
const readFilePromise = promisify(fs.readFile);
const unlinkPromise = promisify(fs.unlink);

/**
 * Uwuifies markdown content using the Rust uwuify binary
 * 
 * @param content - The markdown content to uwuify
 * @returns The uwuified content with preserved code blocks
 */
export async function uwuifyMarkdown(content: string): Promise<string> {
  try {
    // Create a temporary file for the input
    const tempDir = os.tmpdir();
    const inputFile = path.join(tempDir, `uwuify-input-${Date.now()}.md`);
    const outputFile = path.join(tempDir, `uwuify-output-${Date.now()}.md`);
    
    // Write the content to the input file
    await writeFilePromise(inputFile, content);
    
    try {
      // Execute the Rust uwuify binary
      await execPromise(`uwuify "${inputFile}" > "${outputFile}"`);
      
      // Read the uwuified content
      const uwuifiedContent = await readFilePromise(outputFile, 'utf8');
      
      return uwuifiedContent;
    } catch (execError) {
      console.error('Error executing uwuify binary:', execError);
      
      // Fallback to simple uwuification if the binary fails
      return fallbackUwuify(content);
    } finally {
      // Clean up temporary files
      try {
        await unlinkPromise(inputFile);
        await unlinkPromise(outputFile);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary files:', cleanupError);
      }
    }
  } catch (error) {
    console.error('Error in uwuifyMarkdown:', error);
    return content; // Return original content if uwuification fails
  }
}

/**
 * Fallback uwuification function in case the Rust binary fails
 * 
 * @param text - The text to uwuify
 * @returns The uwuified text
 */
function fallbackUwuify(text: string): string {
  try {
    // Use a two-pass approach
    // First pass: Extract and store all special content
    const specialContent: string[] = [];
    
    // Generate a unique token that won't be affected by uwuification
    const uniqueToken = `UWUIFY_TOKEN_${Date.now()}_`;
    
    // Extract code blocks
    let processedContent = text.replace(/```[\s\S]*?```/g, (match) => {
      const token = `${uniqueToken}${specialContent.length}`;
      specialContent.push(match);
      return token;
    });
    
    // Extract inline code
    processedContent = processedContent.replace(/`[^`]+`/g, (match) => {
      const token = `${uniqueToken}${specialContent.length}`;
      specialContent.push(match);
      return token;
    });
    
    // Extract links
    processedContent = processedContent.replace(/\[.*?\]\(.*?\)/g, (match) => {
      const token = `${uniqueToken}${specialContent.length}`;
      specialContent.push(match);
      return token;
    });
    
    // Second pass: Uwuify the remaining text
    const uwuifiedContent = processedContent
      .replace(/(?:r|l)/g, 'w')
      .replace(/(?:R|L)/g, 'W')
      .replace(/n([aeiou])/g, 'ny$1')
      .replace(/N([aeiou])/g, 'Ny$1')
      .replace(/N([AEIOU])/g, 'NY$1')
      .replace(/ove/g, 'uv')
      .replace(/OVE/g, 'UV')
      .replace(/\!+/g, '! uwu')
      .replace(/\?+/g, '? owo')
      .replace(/\. /g, '~ ')
      .replace(/th/g, 'd')
      .replace(/Th/g, 'D');
    
    // Third pass: Restore all special content
    let finalContent = uwuifiedContent;
    for (let i = 0; i < specialContent.length; i++) {
      finalContent = finalContent.replace(`${uniqueToken}${i}`, specialContent[i]);
    }
    
    return finalContent;
  } catch (error) {
    console.error('Error in fallbackUwuify:', error);
    return text; // Return original text if fallback uwuification fails
  }
}

/**
 * Processes all markdown files in a repository and uwuifies them in a single commit
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
    // Get the reference to the branch
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
    
    // Array to store all file changes
    const fileChanges = [];
    const modifiedPaths = [];
    
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
        
        // Uwuify the content using the Rust binary
        const uwuifiedContent = await uwuifyMarkdown(content);
        
        // Only add to changes if content actually changed
        if (uwuifiedContent !== content) {
          fileChanges.push({
            path: file.path!,
            mode: "100644" as const, // Fix: Use string literal type instead of string
            type: "blob" as const,   // Fix: Use string literal type instead of string
            content: uwuifiedContent,
          });
          
          modifiedPaths.push(file.path!);
          console.log(`Prepared uwuified content for ${file.path}`);
        } else {
          console.log(`No changes needed for ${file.path}`);
        }
      } else {
        console.log(`Skipping ${file.path} - not a single file or missing content property`);
      }
    }
    
    // If there are changes, create a single commit with all changes
    if (fileChanges.length > 0) {
      // Create a new tree with all the changes
      const { data: newTree } = await octokit.git.createTree({
        owner,
        repo,
        base_tree: treeSha,
        tree: fileChanges,
      });
      
      // Create a commit with the new tree
      const { data: newCommit } = await octokit.git.createCommit({
        owner,
        repo,
        message: `Uwuify ${fileChanges.length} markdown files`,
        tree: newTree.sha,
        parents: [commitSha],
      });
      
      // Update the branch reference to point to the new commit
      await octokit.git.updateRef({
        owner,
        repo,
        ref: `heads/${branch}`,
        sha: newCommit.sha,
      });
      
      console.log(`Created a single commit with ${fileChanges.length} uwuified files: ${modifiedPaths.join(', ')}`);
    } else {
      console.log('No files were modified, no commit needed');
    }
  } catch (error) {
    console.error('Error uwuifying repository markdown files:', error);
    throw error;
  }
}
