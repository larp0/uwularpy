import { execSync } from "child_process";
import { logger } from "@trigger.dev/sdk/v3";
/**
 * Safe git utilities that prevent shell injection attacks.
 * All git commands are executed with proper argument escaping.
 */
/**
 * Sanitize a string to be safe for use in shell commands.
 * Removes or escapes potentially dangerous characters.
 */
export function sanitizeForShell(input) {
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
 * Execute a git commit with safe argument handling.
 * Prevents shell injection by using execSync with properly escaped arguments.
 */
export function safeGitCommit(message, options) {
    const sanitizedMessage = sanitizeForShell(message);
    if (!sanitizedMessage) {
        throw new Error('Commit message cannot be empty after sanitization');
    }
    logger.log('Executing safe git commit', {
        messageLenth: sanitizedMessage.length,
        allowEmpty: options.allowEmpty || false,
        cwd: options.cwd
    });
    try {
        // Build the git commit command with proper escaping
        const args = ['commit'];
        if (options.allowEmpty) {
            args.push('--allow-empty');
        }
        args.push('-m');
        // Use double quotes and escape any remaining quotes in the message
        const escapedMessage = sanitizedMessage.replace(/"/g, '\\"');
        const command = `git ${args.join(' ')} "${escapedMessage}"`;
        execSync(command, {
            cwd: options.cwd,
            stdio: 'inherit',
            encoding: 'utf-8'
        });
        logger.log('Git commit completed successfully');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Safe git commit failed', { error: errorMessage, cwd: options.cwd });
        throw new Error(`Git commit failed: ${errorMessage}`);
    }
}
/**
 * Execute git commands safely with proper argument handling.
 */
export function safeGitCommand(command, options) {
    logger.log('Executing safe git command', { command: command.join(' '), cwd: options.cwd });
    try {
        const result = execSync(`git ${command.join(' ')}`, {
            cwd: options.cwd,
            stdio: options.stdio || 'pipe',
            encoding: 'utf-8'
        });
        return result.toString();
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Safe git command failed', {
            command: command.join(' '),
            error: errorMessage,
            cwd: options.cwd
        });
        throw new Error(`Git command failed: ${errorMessage}`);
    }
}
/**
 * Check if there are any staged changes in the repository.
 */
export function hasStageChanges(repoPath) {
    try {
        const status = safeGitCommand(['status', '--porcelain'], { cwd: repoPath });
        return status.trim().length > 0;
    }
    catch (error) {
        logger.warn('Failed to check git status', { error: String(error), repoPath });
        return false;
    }
}
/**
 * Get git diff for staged changes.
 */
export function getStagedDiff(repoPath) {
    try {
        return safeGitCommand(['diff', '--cached'], { cwd: repoPath });
    }
    catch (error) {
        logger.warn('Failed to get staged diff', { error: String(error), repoPath });
        return '';
    }
}
/**
 * Set git user configuration safely.
 */
export function setGitUser(repoPath, email, name) {
    const sanitizedEmail = sanitizeForShell(email);
    const sanitizedName = sanitizeForShell(name);
    if (!sanitizedEmail || !sanitizedName) {
        throw new Error('Git user email and name cannot be empty after sanitization');
    }
    try {
        safeGitCommand(['config', 'user.email', sanitizedEmail], { cwd: repoPath });
        safeGitCommand(['config', 'user.name', sanitizedName], { cwd: repoPath });
        logger.log('Git user configuration set', { email: sanitizedEmail, name: sanitizedName });
    }
    catch (error) {
        throw new Error(`Failed to set git user: ${error}`);
    }
}
