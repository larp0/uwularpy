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

/**
 * Sanitize Mermaid diagram by removing problematic symbols from node names (labels).
 * Preserves diagram structure, arrows, and syntax while cleaning only the node labels.
 * 
 * @param mermaidDiagram - The raw Mermaid diagram string
 * @returns The sanitized Mermaid diagram string
 */
export function sanitizeMermaidDiagram(mermaidDiagram: string): string {
  if (!mermaidDiagram || typeof mermaidDiagram !== 'string') {
    logger.warn('Invalid mermaid diagram input', { input: mermaidDiagram });
    return '';
  }

  logger.log('Sanitizing mermaid diagram', { 
    originalLength: mermaidDiagram.length 
  });

  // Split diagram into lines for processing
  const lines = mermaidDiagram.split('\n');
  const sanitizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let sanitizedLine = line;

    // Skip empty lines and diagram type declarations
    if (!line.trim() || 
        line.trim().startsWith('flowchart') || 
        line.trim().startsWith('graph') ||
        line.trim().startsWith('sequenceDiagram') ||
        line.trim().startsWith('classDiagram') ||
        line.trim().startsWith('stateDiagram') ||
        line.trim().startsWith('erDiagram') ||
        line.trim().startsWith('gantt') ||
        line.trim().startsWith('pie') ||
        line.trim().startsWith('mindmap') ||
        line.trim().startsWith('gitGraph') ||
        line.trim().startsWith('journey') ||
        line.trim().startsWith('requirement') ||
        line.trim().startsWith('C4Context') ||
        line.trim().startsWith('%%') || // Comments
        line.trim().startsWith('class ') || // Class definitions
        line.trim().startsWith('click ') || // Click events
        line.trim().startsWith('style ') // Style definitions
    ) {
      sanitizedLines.push(line);
      continue;
    }

    // Process node definitions and connections
    // Use simple regex patterns that work correctly
    
    // Parentheses: nodeId("content")
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\(\s*"([^"]*)"\s*\)/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\(\s*'([^']*)'\s*\)/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    // Square brackets: nodeId["content"] - use greedy match up to the last quote
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\[\s*"(.*?)"\s*\]/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\[\s*'(.*?)'\s*\]/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    // Curly braces: nodeId{"content"}
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\{\s*"([^"]*)"\s*\}/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\{\s*'([^']*)'\s*\}/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    // Double curly braces: nodeId{{"content"}}
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\{\{\s*"([^"]*)"\s*\}\}/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\{\{\s*'([^']*)'\s*\}\}/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });
    
    // Handle unquoted content in braces
    sanitizedLine = sanitizedLine.replace(/(\w+)\s*\{\s*([^"'\{\}]+?)\s*\}/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `${nodeId}["${sanitizedLabel}"]`;
    });

    // Handle participant definitions in sequence diagrams
    sanitizedLine = sanitizedLine.replace(/participant\s+(\w+)\s+as\s+"([^"]*)"/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `participant ${nodeId} as "${sanitizedLabel}"`;
    });
    
    sanitizedLine = sanitizedLine.replace(/participant\s+(\w+)\s+as\s+'([^']*)'/g, (match, nodeId, label) => {
      const sanitizedLabel = sanitizeNodeLabel(label);
      return `participant ${nodeId} as "${sanitizedLabel}"`;
    });

    sanitizedLines.push(sanitizedLine);
  }

  const result = sanitizedLines.join('\n');
  
  logger.log('Mermaid diagram sanitization complete', {
    originalLength: mermaidDiagram.length,
    sanitizedLength: result.length,
    linesProcessed: lines.length
  });

  return result;
}

/**
 * Sanitize individual node label by removing all non-letter characters.
 * Only keeps letters (a-z, A-Z, including accented characters).
 * Removes numbers, spaces, and all special symbols.
 * 
 * @param label - The original node label
 * @returns The sanitized label containing only letters
 */
export function sanitizeNodeLabel(label: string): string {
  if (typeof label !== 'string') {
    return '';
  }
  
  if (!label) {
    return 'node';
  }

  // Keep only letters (a-z, A-Z, including Unicode letters like accented characters and Greek)
  // This removes numbers, spaces, punctuation, and all special symbols
  let sanitized = label.replace(/[^a-zA-Z\u00C0-\u017F\u0100-\u024F\u0370-\u03FF]/g, '');

  // If label becomes empty after removing all non-letters, provide a fallback
  if (!sanitized) {
    sanitized = 'node';
  }

  return sanitized;
}

/**
 * Sanitize all Mermaid diagrams found in a response text.
 * Finds all ```mermaid code blocks and sanitizes the diagram content.
 * 
 * @param response - The response text that may contain Mermaid diagrams
 * @returns The response with sanitized Mermaid diagrams
 */
export function sanitizeMermaidDiagramsInResponse(response: string): string {
  if (!response || typeof response !== 'string') {
    logger.warn('Invalid response input for Mermaid sanitization', { input: response });
    return response || '';
  }

  logger.log('Sanitizing Mermaid diagrams in response', { 
    originalLength: response.length 
  });

  // Find all mermaid code blocks using regex
  const mermaidPattern = /```mermaid\s*\n([\s\S]*?)\n```/gi;
  let sanitizedResponse = response;
  let match;
  let diagramCount = 0;

  // Replace each mermaid diagram with its sanitized version
  while ((match = mermaidPattern.exec(response)) !== null) {
    const originalDiagram = match[1];
    const sanitizedDiagram = sanitizeMermaidDiagram(originalDiagram);
    
    // Replace the diagram content while preserving the code block structure
    const originalBlock = match[0];
    const sanitizedBlock = `\`\`\`mermaid\n${sanitizedDiagram}\n\`\`\``;
    
    sanitizedResponse = sanitizedResponse.replace(originalBlock, sanitizedBlock);
    diagramCount++;
    
    logger.log(`Sanitized Mermaid diagram ${diagramCount}`, {
      originalLength: originalDiagram.length,
      sanitizedLength: sanitizedDiagram.length
    });
  }

  logger.log('Mermaid diagram sanitization in response complete', {
    originalLength: response.length,
    sanitizedLength: sanitizedResponse.length,
    diagramsFound: diagramCount
  });

  return sanitizedResponse;
}
