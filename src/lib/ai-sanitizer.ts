import { logger } from "@trigger.dev/sdk/v3";

/**
 * Utilities for sanitizing and validating AI-generated content.
 * Ensures AI outputs are safe for use in various contexts.
 */

/**
 * Sanitize AI-generated commit message to be safe for git.
 */
export function sanitizeCommitMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'AI-generated changes';
  }
  
  let sanitized = message
    // Remove dangerous shell characters
    .replace(/[`$;|&<>]/g, '')
    // Remove control characters and null bytes
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove quotes that could break command parsing
    .replace(/['"]/g, '')
    .trim();
  
  // Ensure it's not too long (git commit messages should be concise)
  if (sanitized.length > 72) {
    sanitized = sanitized.substring(0, 69) + '...';
  }
  
  // Ensure it's not empty after sanitization
  if (!sanitized) {
    sanitized = 'AI-generated changes';
  }
  
  logger.log('Sanitized commit message', { 
    originalLength: message.length,
    sanitizedLength: sanitized.length,
    sanitized: sanitized
  });
  
  return sanitized;
}

/**
 * Sanitize AI-generated file content.
 */
export function sanitizeFileContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  // Remove null bytes which can cause issues
  const sanitized = content.replace(/\0/g, '');
  
  logger.log('Sanitized file content', {
    originalLength: content.length,
    sanitizedLength: sanitized.length,
    nullBytesRemoved: content.length - sanitized.length
  });
  
  return sanitized;
}

/**
 * Validate and sanitize search/replace operations from AI.
 */
export interface SearchReplaceOperation {
  file: string;
  search: string;
  replace: string;
}

export function sanitizeSearchReplaceOperations(
  operations: SearchReplaceOperation[]
): SearchReplaceOperation[] {
  return operations.map(op => ({
    file: sanitizeFilePath(op.file),
    search: sanitizeFileContent(op.search),
    replace: sanitizeFileContent(op.replace)
  })).filter(op => 
    // Filter out operations with empty or invalid data
    op.file && 
    op.search && 
    op.file.length > 0 && 
    op.search.length > 0
  );
}

/**
 * Sanitize file paths to prevent directory traversal attacks.
 */
export function sanitizeFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }
  
  // Remove null bytes and dangerous characters
  let sanitized = filePath.replace(/\0/g, '');
  
  // Prevent directory traversal
  sanitized = sanitized.replace(/\.\./g, '');
  
  // Remove leading slashes to prevent absolute path injection
  sanitized = sanitized.replace(/^\/+/, '');
  
  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '');
  
  return sanitized.trim();
}

/**
 * Validate AI response structure and content.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedContent: string;
}

export function validateAIResponse(response: string): ValidationResult {
  const errors: string[] = [];
  
  if (!response || typeof response !== 'string') {
    errors.push('Response is empty or not a string');
    return {
      isValid: false,
      errors,
      sanitizedContent: ''
    };
  }
  
  // Check for potential security issues
  if (response.includes('\0')) {
    errors.push('Response contains null bytes');
  }
  
  if (response.match(/[`$;|&<>]/)) {
    errors.push('Response contains potentially dangerous shell characters');
  }
  
  // Check for excessively long responses that might cause issues
  if (response.length > 100000) {
    errors.push('Response is excessively long (>100KB)');
  }
  
  // Sanitize the response
  const sanitizedContent = sanitizeFileContent(response);
  
  logger.log('AI response validation', {
    isValid: errors.length === 0,
    errorsCount: errors.length,
    originalLength: response.length,
    sanitizedLength: sanitizedContent.length
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitizedContent
  };
}

/**
 * Extract and sanitize search/replace blocks from AI response.
 */
export function extractSearchReplaceBlocks(response: string): SearchReplaceOperation[] {
  const operations: SearchReplaceOperation[] = [];
  
  // Find all search-replace blocks
  const searchReplaceRegex = /```search-replace\n([\s\S]*?)```/g;
  let match;
  
  while ((match = searchReplaceRegex.exec(response)) !== null) {
    const block = match[1];
    
    // Extract file path
    const fileMatch = block.match(/FILE:\s*(.*)/);
    if (!fileMatch) continue;
    
    const filePath = sanitizeFilePath(fileMatch[1].trim());
    if (!filePath) continue;
    
    // Find all SEARCH/REPLACE operations
    const operationRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let operationMatch;
    
    while ((operationMatch = operationRegex.exec(block)) !== null) {
      const searchText = sanitizeFileContent(operationMatch[1]);
      const replaceText = sanitizeFileContent(operationMatch[2]);
      
      if (searchText && replaceText) {
        operations.push({
          file: filePath,
          search: searchText,
          replace: replaceText
        });
      }
    }
  }
  
  // Additional sanitization pass
  return sanitizeSearchReplaceOperations(operations);
}
