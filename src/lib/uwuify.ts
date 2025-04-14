// src/lib/uwuify.ts

import { Octokit } from '@octokit/rest';

/**
 * Pure JavaScript implementation of uwuify for use in serverless environments
 * 
 * @param text - The text to uwuify
 * @returns The uwuified text
 */
function uwuifyText(text: string): string {
  // Basic uwuification rules
  return text
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
}

/**
 * Uwuifies markdown content while preserving special content
 * 
 * @param content - The markdown content to uwuify
 * @returns The uwuified content with preserved code blocks
 */
export function uwuifyMarkdown(content: string): string {
  try {
    // Use a two-pass approach
    // First pass: Extract and store all special content
    const specialContent: string[] = [];
    
    // Generate a unique token that won't be affected by uwuification
    const uniqueToken = `UWUIFY_TOKEN_${Date.now()}_`;
    
    // Extract code blocks
    let processedContent = content.replace(/```[\s\S]*?```/g, (match) => {
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
    const uwuifiedContent = uwuifyText(processedContent);
    
    // Third pass: Restore all special content
    let finalContent = uwuifiedContent;
    for (let i = 0; i < specialContent.length; i++) {
      finalContent = finalContent.replace(`${uniqueToken}${i}`, specialContent[i]);
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
        const uwuifiedContent = uwuifyMarkdown(content);
        
        // Only update if content actually changed
        if (uwuifiedContent !== content) {
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
          console.log(`No changes needed for ${file.path}`);
        }
      } else {
        console.log(`Skipping ${file.path} - not a single file or missing content property`);
      }
    }
  } catch (error) {
    console.error('Error uwuifying repository markdown files:', error);
    throw error;
  }
}
