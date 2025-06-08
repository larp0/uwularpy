import { execSync, spawn, execFileSync } from "child_process";
import { loggers } from "./structured-logger";

/**
 * Safe git utilities that prevent shell injection attacks.
 * All git commands are executed with proper argument escaping.
 */

/**
 * Sanitize a string to be safe for use in shell commands.
 * Removes or escapes potentially dangerous characters.
 */
export function sanitizeForShell(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes and other dangerous characters
  return input
    .replace(/\0/g, '') // Remove null bytes
    .replace(/[\r\n]/g, ' ') // Replace newlines with spaces
    .replace(/[`$]/g, '') // Remove backticks and dollar signs
    .replace(/[;&|><]/g, '') // Remove command separators and redirections
    .trim();
}

/**
 * Execute a git commit with safe argument handling using spawn.
 * Prevents shell injection by using spawn with separate arguments.
 */
export async function safeGitCommit(message: string, options: { cwd: string; allowEmpty?: boolean }): Promise<void> {
  const sanitizedMessage = sanitizeForShell(message);
  
  if (!sanitizedMessage) {
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
export function safeGitCommand(command: string[], options: { cwd: string; stdio?: 'inherit' | 'pipe' }): string {
  const logger = loggers.git.child({ operation: command[0] });
  
  logger.startOperation(`git-${command[0]}`, { command: command.join(' '), cwd: options.cwd });
  
  try {
    const result = execFileSync('git', command, {
      cwd: options.cwd,
      stdio: options.stdio || 'pipe',
      encoding: 'utf-8'
    });
    
    logger.completeOperation(`git-${command[0]}`);
    return result.toString();
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
    const hasChanges = status.trim().length > 0;
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
    logger.debug('staged-diff-retrieved', 'Retrieved staged diff', { diffLength: diff.length, repoPath });
    return diff;
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
 */
export function getRepositoryStructure(repoPath: string): string {
  const logger = loggers.git.child({ operation: 'repo-structure' });
  
  try {
    // Get list of files in the repository
    const lsFiles = safeGitCommand(['ls-files'], { cwd: repoPath });
    const files = lsFiles.split('\n').filter(file => file.trim().length > 0);
    
    // Categorize files by type
    const categories = {
      config: files.filter(f => f.match(/\.(json|yaml|yml|toml|ini|env|config)$/i) || 
                              f.match(/^(package\.json|tsconfig\.json|\.env|\.gitignore|README|Dockerfile|Makefile)$/i)),
      source: files.filter(f => f.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|cs|go|rs|php|rb)$/i)),
      tests: files.filter(f => f.match(/\.(test|spec)\./i) || f.includes('test') || f.includes('spec')),
      docs: files.filter(f => f.match(/\.(md|txt|rst|doc)$/i)),
      other: files.filter(f => !f.match(/\.(ts|js|jsx|tsx|py|java|cpp|c|cs|go|rs|php|rb|json|yaml|yml|toml|ini|env|config|test|spec|md|txt|rst|doc)$/i))
    };
    
    // Build context string
    let context = `# Repository Structure\n\n`;
    context += `Total files: ${files.length}\n\n`;
    
    if (categories.config.length > 0) {
      context += `## Configuration Files (${categories.config.length})\n`;
      context += categories.config.slice(0, 10).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    if (categories.source.length > 0) {
      context += `## Source Files (${categories.source.length})\n`;
      context += categories.source.slice(0, 20).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    if (categories.tests.length > 0) {
      context += `## Test Files (${categories.tests.length})\n`;
      context += categories.tests.slice(0, 10).map(f => `- ${f}`).join('\n') + '\n\n';
    }
    
    // Try to read key files for more context
    const keyFiles = ['package.json', 'README.md', 'tsconfig.json'];
    for (const keyFile of keyFiles) {
      if (files.includes(keyFile)) {
        try {
          const content = require('fs').readFileSync(require('path').join(repoPath, keyFile), 'utf8');
          context += `## ${keyFile}\n\`\`\`\n${content.slice(0, 1000)}\n\`\`\`\n\n`;
        } catch (error) {
          // Ignore file reading errors
        }
      }
    }
    
    logger.debug('repo-structure-generated', 'Repository structure generated', { 
      fileCount: files.length,
      contextLength: context.length,
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