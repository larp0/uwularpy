import * as fs from "fs";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { extractSearchReplaceBlocks, sanitizeFilePath } from "./ai-sanitizer";

/**
 * Safe file operations for the codex system.
 * Handles file reading, writing, and search/replace operations with security checks.
 */

export interface FileChange {
  file: string;
  applied: boolean;
  error?: string;
}

/**
 * Check if a file path is safe and within the repository boundaries.
 */
export function isValidFilePath(filePath: string, repoPath: string): boolean {
  const sanitizedPath = sanitizeFilePath(filePath);
  if (!sanitizedPath) {
    return false;
  }
  
  const fullPath = path.resolve(repoPath, sanitizedPath);
  const normalizedRepoPath = path.resolve(repoPath);
  
  // Ensure the file is within the repository directory
  return fullPath.startsWith(normalizedRepoPath + path.sep) || fullPath === normalizedRepoPath;
}

/**
 * Safely read a file with error handling.
 */
export function safeReadFile(filePath: string, repoPath: string): string | null {
  if (!isValidFilePath(filePath, repoPath)) {
    logger.warn("Invalid file path rejected", { filePath, repoPath });
    return null;
  }
  
  const fullPath = path.join(repoPath, filePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      logger.warn("File does not exist", { fullPath });
      return null;
    }
    
    const content = fs.readFileSync(fullPath, "utf-8");
    logger.log("File read successfully", { filePath, contentLength: content.length });
    return content;
  } catch (error) {
    logger.error("Failed to read file", { 
      filePath, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Safely write a file with error handling.
 */
export function safeWriteFile(filePath: string, content: string, repoPath: string): boolean {
  if (!isValidFilePath(filePath, repoPath)) {
    logger.warn("Invalid file path rejected for writing", { filePath, repoPath });
    return false;
  }
  
  const fullPath = path.join(repoPath, filePath);
  
  try {
    // Ensure the directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content, "utf-8");
    logger.log("File written successfully", { filePath, contentLength: content.length });
    return true;
  } catch (error) {
    logger.error("Failed to write file", { 
      filePath, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

/**
 * Apply a single search/replace operation to a file.
 */
export function applySearchReplace(
  filePath: string,
  searchText: string,
  replaceText: string,
  repoPath: string
): boolean {
  const content = safeReadFile(filePath, repoPath);
  if (content === null) {
    return false;
  }
  
  if (!content.includes(searchText)) {
    logger.warn("Search text not found in file", {
      filePath,
      searchTextLength: searchText.length,
      searchTextPreview: searchText.substring(0, 50)
    });
    return false;
  }
  
  const newContent = content.replace(searchText, replaceText);
  return safeWriteFile(filePath, newContent, repoPath);
}

/**
 * Process search/replace blocks from AI response.
 */
export function processSearchReplaceBlocks(
  aiResponse: string, 
  repoPath: string
): FileChange[] {
  const changes: FileChange[] = [];
  
  try {
    // Extract and sanitize search/replace operations
    const operations = extractSearchReplaceBlocks(aiResponse);
    
    logger.log("Processing search/replace operations", { 
      operationsCount: operations.length 
    });
    
    for (const operation of operations) {
      try {
        const success = applySearchReplace(
          operation.file,
          operation.search,
          operation.replace,
          repoPath
        );
        
        changes.push({
          file: operation.file,
          applied: success,
          error: success ? undefined : "Failed to apply search/replace operation"
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Search/replace operation failed", {
          file: operation.file,
          error: errorMessage
        });
        
        changes.push({
          file: operation.file,
          applied: false,
          error: errorMessage
        });
      }
    }
  } catch (error) {
    logger.error("Failed to process search/replace blocks", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return changes;
}

/**
 * Backup a file before making changes.
 */
export function backupFile(filePath: string, repoPath: string): string | null {
  if (!isValidFilePath(filePath, repoPath)) {
    return null;
  }
  
  const fullPath = path.join(repoPath, filePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  try {
    const backupPath = `${fullPath}.backup.${Date.now()}`;
    fs.copyFileSync(fullPath, backupPath);
    logger.log("File backed up", { originalPath: filePath, backupPath });
    return backupPath;
  } catch (error) {
    logger.error("Failed to backup file", {
      filePath,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Restore a file from backup.
 */
export function restoreFromBackup(backupPath: string, originalPath: string): boolean {
  try {
    if (!fs.existsSync(backupPath)) {
      logger.warn("Backup file does not exist", { backupPath });
      return false;
    }
    
    fs.copyFileSync(backupPath, originalPath);
    fs.unlinkSync(backupPath); // Clean up backup file
    logger.log("File restored from backup", { originalPath, backupPath });
    return true;
  } catch (error) {
    logger.error("Failed to restore from backup", {
      backupPath,
      originalPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}