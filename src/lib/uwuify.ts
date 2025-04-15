// src/lib/uwuify.ts

import { Octokit } from '@octokit/rest';

/**
 * Fallback uwuification function for client-side use
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
 * This function is now a stub that will be handled by Koyeb worker
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
  // This function is now a stub
  // The actual uwuification is handled by the Koyeb worker
  // This is kept for backwards compatibility
  console.log(`Uwuification for ${owner}/${repo} on branch ${branch} will be handled by Koyeb worker`);
}
