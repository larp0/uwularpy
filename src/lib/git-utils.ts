import { execSync, spawn, execFileSync } from "child_process";
import { loggers } from "./structured-logger";

/**
 * Safe git utilities that prevent shell injection attacks.
 * All git commands are executed with proper argument escaping.
 */

/**
 * Sanitize a string to be safe for use in shell commands.
 * Uses proper shell escaping instead of removing characters.
 * Preserves legitimate use cases like paths with spaces and parentheses.
 */
export function sanitizeForShell(input: string): string {
  if (!input || typeof input !== 'string') {
    return "''"; // Return empty quoted string
  }
  
  // Remove null bytes which are never legitimate
  let sanitized = input.replace(/\0/g, '');
  
  // Replace newlines with spaces (these are rarely intentional in file paths/commit messages)
  sanitized = sanitized.replace(/[\r\n]/g, ' ');
  
  // Normalize multiple whitespace to single spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Additional safety: Limit length to prevent buffer overflows
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  // If string is empty after sanitization, return empty quoted string
  if (!sanitized) {
    return "''";
  }
  
  // Use proper shell escaping by wrapping in single quotes
  // and escaping any single quotes within the string
  // This approach preserves spaces, parentheses, and other legitimate characters
  return "'" + sanitized.replace(/'/g, "'\"'\"'") + "'";
}

/**
 * Execute a git commit with safe argument handling using spawn.
 * Prevents shell injection by using spawn with separate arguments.
 */
export async function safeGitCommit(message: string, options: { cwd: string; allowEmpty?: boolean }): Promise<void> {
  const sanitizedMessage = sanitizeForShell(message);
  
  if (!sanitizedMessage || sanitizedMessage === "''") {
    throw new Error('Commit message cannot be empty after sanitization');
  }
  
  const logger = loggers.git.child({ operation: 'commit' });
  
  logger.startOperation('git-commit', { 
    messageLength: sanitizedMessage.length,
    allowEmpty: options.allowEmpty || false,
    cwd: options.cwd
  });
  
  return new Promise<void>((resolve, reject) => {
    // Build the git commit arguments array
    const args = ['commit'];
    if (options.allowEmpty) {
      args.push('--allow-empty');
    }
    args.push('-m', sanitizedMessage);
    
    const gitProcess = spawn('git', args, {
      cwd: options.cwd,
      stdio: 'inherit'
    });
    
    gitProcess.on('close', (code) => {
      if (code === 0) {
        logger.completeOperation('git-commit');
        resolve();
      } else {
        const errorMessage = `Git commit failed with exit code ${code}`;
        logger.failOperation('git-commit', errorMessage, { exitCode: code });
        reject(new Error(errorMessage));
      }
    });
    
    gitProcess.on('error', (error) => {
      logger.failOperation('git-commit', error, { processError: true });
      reject(new Error(`Git commit failed: ${error.message}`));
    });
  });
}

/**
 * Execute git commands safely using execFileSync for proper argument separation.
 * Prevents shell injection by using execFileSync with separate arguments.
 */
export function safeGitCommand(command: string[], options: { cwd: string; stdio?: 'inherit' | 'pipe' }): string | null {
  const logger = loggers.git.child({ operation: command[0] });
  
  logger.startOperation(`git-${command[0]}`, { command: command.join(' '), cwd: options.cwd });
  
  try {
    const result = execFileSync('git', command, {
      cwd: options.cwd,
      stdio: options.stdio || 'pipe',
      encoding: options.stdio === 'inherit' ? undefined : 'utf-8'
    });
    
    logger.completeOperation(`git-${command[0]}`);
    
    // Return null when stdio is 'inherit' to indicate no output is captured
    // Return string output when stdio is 'pipe'
    return options.stdio === 'inherit' ? null : result.toString();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.failOperation(`git-${command[0]}`, errorMessage);
    throw new Error(`Git command failed: ${errorMessage}`);
  }
}

/**
 * Check if there are any staged changes in the repository.
 */
export function hasStageChanges(repoPath: string): boolean {
  const logger = loggers.git.child({ operation: 'status-check' });
  
  try {
    const status = safeGitCommand(['status', '--porcelain'], { cwd: repoPath });
    const hasChanges = status !== null && status.trim().length > 0;
    logger.debug('stage-changes-check', 'Checked for staged changes', { hasChanges, repoPath });
    return hasChanges;
  } catch (error) {
    logger.warn('stage-changes-check-failed', 'Failed to check git status', { error: String(error), repoPath });
    return false;
  }
}

/**
 * Get git diff for staged changes.
 */
export function getStagedDiff(repoPath: string): string {
  const logger = loggers.git.child({ operation: 'diff' });
  
  try {
    const diff = safeGitCommand(['diff', '--cached'], { cwd: repoPath });
    const diffContent = diff || '';
    logger.debug('staged-diff-retrieved', 'Retrieved staged diff', { diffLength: diffContent.length, repoPath });
    return diffContent;
  } catch (error) {
    logger.warn('staged-diff-failed', 'Failed to get staged diff', { error: String(error), repoPath });
    return '';
  }
}

/**
 * Set git user configuration safely.
 */
export function setGitUser(repoPath: string, email: string, name: string): void {
  const logger = loggers.git.child({ operation: 'user-config' });
  
  const sanitizedEmail = sanitizeForShell(email);
  const sanitizedName = sanitizeForShell(name);
  
  if (!sanitizedEmail || !sanitizedName) {
    throw new Error('Git user email and name cannot be empty after sanitization');
  }
  
  try {
    safeGitCommand(['config', 'user.email', sanitizedEmail], { cwd: repoPath });
    safeGitCommand(['config', 'user.name', sanitizedName], { cwd: repoPath });
    logger.info('git-user-configured', 'Git user configuration set', { 
      email: sanitizedEmail, 
      name: sanitizedName,
      repoPath
    });
  } catch (error) {
    logger.error('git-user-config-failed', 'Failed to set git user', { error: String(error), repoPath });
    throw new Error(`Failed to set git user: ${error}`);
  }
}

/**
 * Get a basic repository structure for context in code generation.
 * Returns a summary of the repository layout and important files.
 * Includes size and token limits to prevent context overflow.
 * Uses async file operations for better performance with large repositories.
 */
export async function getRepositoryStructureAsync(repoPath: string): Promise<string> {
  const logger = loggers.git.child({ operation: 'repo-structure-async' });
  
  const MAX_CONTEXT_LENGTH = 8000; // ~2000 tokens at 4 chars per token
  const MAX_FILE_CONTENT_SIZE = 1000; // Max content size per file
  const MAX_FILES_PER_CATEGORY = 20; // Limit files to show per category
  
  try {
    // Get list of files in the repository
    const lsFiles = safeGitCommand(['ls-files'], { cwd: repoPath });
    const files = lsFiles ? lsFiles.split('\n').filter(file => file.trim().length > 0) : [];
    
    // Categorize files by type
    const categories = {
      config: files.filter(f => f.match(/\.(json|yaml|yml|toml|ini|env|config)$/i) || 
                              f.match(/^(package\.json|tsconfig\.json|\.env|\.gitignore|README|Dockerfile|Makefile)$/i)),
      source: files.filter(f => f.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|cs|go|rs|php|rb)$/i)),
      tests: files.filter(f => f.match(/\.(test|spec)\./i) || f.includes('test') || f.includes('spec')),
      docs: files.filter(f => f.match(/\.(md|txt|rst|doc)$/i)),
      other: files.filter(f => !f.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|cs|go|rs|php|rb|json|yaml|yml|toml|ini|env|config|test|spec|md|txt|rst|doc)$/i))
    };
    
    // Build context string with size limits
    let context = `# Repository Structure\n\n`;
    context += `Total files: ${files.length}\n\n`;
    
    if (categories.config.length > 0) {
      context += `## Configuration Files (${categories.config.length})\n`;
      context += categories.config.slice(0, MAX_FILES_PER_CATEGORY).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    if (categories.source.length > 0) {
      context += `## Source Files (${categories.source.length})\n`;
      context += categories.source.slice(0, MAX_FILES_PER_CATEGORY).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    if (categories.tests.length > 0) {
      context += `## Test Files (${categories.tests.length})\n`;
      context += categories.tests.slice(0, MAX_FILES_PER_CATEGORY).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    // Try to read key files for more context with size limits using async operations
    const keyFiles = ['package.json', 'README.md', 'tsconfig.json'];
    const fs = require('fs').promises;
    const fsPath = require('path');
    
    for (const keyFile of keyFiles) {
      if (files.includes(keyFile) && context.length < MAX_CONTEXT_LENGTH) {
        try {
          const filePath = fsPath.join(repoPath, keyFile);
          
          // Check file size before reading to avoid memory issues
          const stats = await fs.stat(filePath);
          if (stats.size > MAX_FILE_CONTENT_SIZE * 2) {
            context += `## ${keyFile}\n*(file too large, skipped for performance)*\n\n`;
            continue;
          }
          
          const content = await fs.readFile(filePath, 'utf8');
          const truncatedContent = content.slice(0, MAX_FILE_CONTENT_SIZE);
          const truncationMarker = content.length > MAX_FILE_CONTENT_SIZE ? '\n...(truncated)' : '';
          
          const fileSection = `## ${keyFile}\n\`\`\`\n${truncatedContent}${truncationMarker}\n\`\`\`\n\n`;
          
          // Only add if it doesn't exceed the context limit
          if (context.length + fileSection.length <= MAX_CONTEXT_LENGTH) {
            context += fileSection;
          } else {
            context += `## ${keyFile}\n*(file content truncated due to size limits)*\n\n`;
            break; // Stop adding more files
          }
        } catch (error) {
          // Ignore file reading errors but log them
          logger.warn('Failed to read key file', { keyFile, error: String(error) });
        }
      }
    }
    
    // Final size check and truncation
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.slice(0, MAX_CONTEXT_LENGTH - 50) + '\n\n...(context truncated)';
    }
    
    logger.debug('repo-structure-generated', 'Repository structure generated', { 
      fileCount: files.length,
      contextLength: context.length,
      maxContextLength: MAX_CONTEXT_LENGTH,
      repoPath 
    });
    
    return context;
  } catch (error) {
    logger.warn('repo-structure-failed', 'Failed to get repository structure', { 
      error: String(error), 
      repoPath 
    });
    return `# Repository Structure\n\nUnable to read repository structure: ${error}`;
  }
}

/**
 * Get a basic repository structure for context in code generation.
 * Returns a summary of the repository layout and important files.
 * Includes size and token limits to prevent context overflow.
 * Synchronous version for backward compatibility.
 */
export function getRepositoryStructure(repoPath: string): string {
  const logger = loggers.git.child({ operation: 'repo-structure' });
  
  const MAX_CONTEXT_LENGTH = 8000; // ~2000 tokens at 4 chars per token
  const MAX_FILE_CONTENT_SIZE = 1000; // Max content size per file
  const MAX_FILES_PER_CATEGORY = 20; // Limit files to show per category
  
  try {
    // Get list of files in the repository
    const lsFiles = safeGitCommand(['ls-files'], { cwd: repoPath });
    const files = lsFiles ? lsFiles.split('\n').filter(file => file.trim().length > 0) : [];
    
    // Categorize files by type
    const categories = {
      config: files.filter(f => f.match(/\.(json|yaml|yml|toml|ini|env|config)$/i) || 
                              f.match(/^(package\.json|tsconfig\.json|\.env|\.gitignore|README|Dockerfile|Makefile)$/i)),
      source: files.filter(f => f.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|cs|go|rs|php|rb)$/i)),
      tests: files.filter(f => f.match(/\.(test|spec)\./i) || f.includes('test') || f.includes('spec')),
      docs: files.filter(f => f.match(/\.(md|txt|rst|doc)$/i)),
      other: files.filter(f => !f.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|cs|go|rs|php|rb|json|yaml|yml|toml|ini|env|config|test|spec|md|txt|rst|doc)$/i))
    };
    
    // Build context string with size limits
    let context = `# Repository Structure\n\n`;
    context += `Total files: ${files.length}\n\n`;
    
    if (categories.config.length > 0) {
      context += `## Configuration Files (${categories.config.length})\n`;
      context += categories.config.slice(0, MAX_FILES_PER_CATEGORY).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    if (categories.source.length > 0) {
      context += `## Source Files (${categories.source.length})\n`;
      context += categories.source.slice(0, MAX_FILES_PER_CATEGORY).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    if (categories.tests.length > 0) {
      context += `## Test Files (${categories.tests.length})\n`;
      context += categories.tests.slice(0, MAX_FILES_PER_CATEGORY).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    // Try to read key files for more context with size limits
    const keyFiles = ['package.json', 'README.md', 'tsconfig.json'];
    for (const keyFile of keyFiles) {
      if (files.includes(keyFile) && context.length < MAX_CONTEXT_LENGTH) {
        try {
          const filePath = require('path').join(repoPath, keyFile);
          
          // Check file size before reading to avoid memory issues
          const stats = require('fs').statSync(filePath);
          if (stats.size > MAX_FILE_CONTENT_SIZE * 2) {
            context += `## ${keyFile}\n*(file too large, skipped for performance)*\n\n`;
            continue;
          }
          
          const content = require('fs').readFileSync(filePath, 'utf8');
          const truncatedContent = content.slice(0, MAX_FILE_CONTENT_SIZE);
          const truncationMarker = content.length > MAX_FILE_CONTENT_SIZE ? '\n...(truncated)' : '';
          
          const fileSection = `## ${keyFile}\n\`\`\`\n${truncatedContent}${truncationMarker}\n\`\`\`\n\n`;
          
          // Only add if it doesn't exceed the context limit
          if (context.length + fileSection.length <= MAX_CONTEXT_LENGTH) {
            context += fileSection;
          } else {
            context += `## ${keyFile}\n*(file content truncated due to size limits)*\n\n`;
            break; // Stop adding more files
          }
        } catch (error) {
          // Ignore file reading errors
        }
      }
    }
    
    // Final size check and truncation
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.slice(0, MAX_CONTEXT_LENGTH - 50) + '\n\n...(context truncated)';
    }
    
    logger.debug('repo-structure-generated', 'Repository structure generated', { 
      fileCount: files.length,
      contextLength: context.length,
      maxContextLength: MAX_CONTEXT_LENGTH,
      repoPath 
    });
    
    return context;
  } catch (error) {
    logger.warn('repo-structure-failed', 'Failed to get repository structure', { 
      error: String(error), 
      repoPath 
    });
    return `# Repository Structure\n\nUnable to read repository structure: ${error}`;
  }
}
