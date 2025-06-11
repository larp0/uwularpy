import * as fs from "fs";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { extractSearchReplaceBlocks, sanitizeFilePath } from "./ai-sanitizer";
import { getFileOperationsConfig } from "./config";

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
 * Enhanced validation interface for search/replace operations with security metrics.
 */
export interface SearchReplaceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityScore: number; // 0-100, lower is more concerning
  complexity: 'low' | 'medium' | 'high';
  syntaxValid: boolean;
}

/**
 * Enhanced validation for search/replace blocks with comprehensive security checks.
 * Includes advanced pattern analysis, syntax validation, and security scoring.
 */
export function validateSearchReplaceBlock(
  filePath: string,
  searchText: string,
  replaceText: string,
  content: string
): SearchReplaceValidation {
  const config = getFileOperationsConfig();
  const errors: string[] = [];
  const warnings: string[] = [];
  let securityScore = 100;
  let syntaxValid = true;

  // Input validation
  if (!searchText?.trim()) {
    errors.push("Search text cannot be empty");
    return { isValid: false, errors, warnings, securityScore: 0, complexity: 'high', syntaxValid: false };
  }

  if (searchText === replaceText) {
    warnings.push("Search and replace text are identical - no changes will be made");
  }

  // Enhanced dangerous pattern detection with severity scoring
  const dangerousPatterns = [
    { pattern: /rm\s+-rf/i, severity: 95, desc: "File deletion command" },
    { pattern: /sudo\s+/i, severity: 80, desc: "Privilege escalation" },
    { pattern: /eval\s*\(/i, severity: 90, desc: "Code evaluation" },
    { pattern: /exec\s*\(/i, severity: 85, desc: "Code execution" },
    { pattern: /system\s*\(/i, severity: 85, desc: "System command execution" },
    { pattern: /shell_exec/i, severity: 85, desc: "Shell execution" },
    { pattern: /process\.exit/i, severity: 60, desc: "Process termination" },
    { pattern: /\.\.\/.*\.\.\//g, severity: 70, desc: "Path traversal attack" },
    { pattern: /__proto__/i, severity: 75, desc: "Prototype pollution" },
    { pattern: /constructor.*prototype/i, severity: 75, desc: "Constructor prototype manipulation" },
    { pattern: /document\.cookie/i, severity: 60, desc: "Cookie access" },
    { pattern: /localStorage|sessionStorage/i, severity: 50, desc: "Browser storage access" },
    { pattern: /innerHTML|outerHTML/i, severity: 65, desc: "HTML injection risk" },
    { pattern: /setTimeout.*eval|setInterval.*eval/i, severity: 90, desc: "Delayed code evaluation" },
    { pattern: /import\s*\(\s*['"`][^'"`]*['"`]\s*\)/g, severity: 40, desc: "Dynamic import" },
    { pattern: /require\s*\(\s*['"`][^'"`]*['"`]\s*\)/g, severity: 40, desc: "Dynamic require" },
    { pattern: /fetch\s*\(|XMLHttpRequest/i, severity: 45, desc: "Network request" },
    { pattern: /crypto\.|Math\.random/i, severity: 30, desc: "Cryptographic operation" },
    // Add custom dangerous patterns from config
    ...config.customDangerousPatterns.map(p => ({ 
      pattern: p.pattern, 
      severity: p.severity, 
      desc: p.description 
    }))
  ];

  for (const { pattern, severity, desc } of dangerousPatterns) {
    if (pattern.test(searchText) || pattern.test(replaceText)) {
      const impact = severity > 80 ? 'critical' : severity > 60 ? 'high' : 'medium';
      const description = desc || 'Unknown security risk';
      errors.push(`${impact.toUpperCase()} SECURITY RISK: ${description} - Pattern: ${pattern.source}`);
      securityScore = Math.min(securityScore, 100 - severity);
    }
  }

  // Size and complexity analysis using configurable limits
  const searchSize = searchText.length;
  const replaceSize = replaceText.length;
  const sizeDifference = Math.abs(replaceSize - searchSize);

  if (replaceSize > config.maxSearchReplaceSize) {
    errors.push(`Replacement text exceeds safe size limit (${config.maxSearchReplaceSize} bytes)`);
    securityScore -= 20;
  } else if (replaceSize > config.maxSearchReplaceSize / 5) {
    warnings.push(`Replacement text is very large (>${config.maxSearchReplaceSize / 5} bytes) - verify content carefully`);
    securityScore -= 10;
  }

  if (sizeDifference > searchSize * 10) {
    warnings.push(`Replacement is ${Math.round(sizeDifference / searchSize)}x larger than search text`);
    securityScore -= 15;
  }

  // Advanced pattern analysis for search accuracy
  const searchMatches = content.split(searchText).length - 1;
  if (searchMatches === 0) {
    warnings.push("Search text not found in file content");
  } else if (searchMatches > 1) {
    warnings.push(`Search text appears ${searchMatches} times - only first occurrence will be replaced`);
    securityScore -= 5;
  }

  // Line count analysis for context preservation
  const searchLines = searchText.split('\n').length;
  const replaceLines = replaceText.split('\n').length;
  const lineDifference = Math.abs(replaceLines - searchLines);

  if (lineDifference > 100) {
    warnings.push(`Large line count change: ${lineDifference} lines difference`);
    securityScore -= 10;
  }

  // Enhanced syntax validation for different file types (if enabled)
  if (config.enableSyntaxValidation) {
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    const syntaxCheck = performSyntaxValidation(searchText, replaceText, fileExtension || '');
    
    if (!syntaxCheck.isValid) {
      syntaxValid = false;
      errors.push(...syntaxCheck.errors);
      warnings.push(...syntaxCheck.warnings);
      securityScore -= 20;
    }
  }

  // Complexity assessment (if enabled)
  let complexity: 'low' | 'medium' | 'high' = 'low';
  if (config.enableComplexityAnalysis) {
    complexity = assessComplexity(searchText, replaceText, searchMatches);
    if (complexity === 'high') {
      securityScore -= 10;
    }
  }

  // Content integrity validation
  const integrityCheck = validateContentIntegrity(searchText, replaceText, content, filePath);
  if (!integrityCheck.isValid) {
    errors.push(...integrityCheck.errors);
    warnings.push(...integrityCheck.warnings);
    securityScore -= integrityCheck.severityPenalty;
  }

  // Apply strict mode checks if enabled
  if (config.strictMode) {
    if (securityScore < 80) {
      errors.push("Strict mode: Security score too low for operation");
    }
    if (complexity === 'high') {
      errors.push("Strict mode: High complexity operations not allowed");
    }
  }

  return {
    isValid: errors.length === 0 && securityScore >= config.minSecurityScore,
    errors,
    warnings,
    securityScore: Math.max(0, securityScore),
    complexity,
    syntaxValid
  };
}

/**
 * Perform syntax validation specific to file type.
 */
function performSyntaxValidation(
  searchText: string, 
  replaceText: string, 
  fileExtension: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (fileExtension) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return validateJavaScriptSyntax(searchText, replaceText);
    
    case 'json':
      return validateJsonSyntax(searchText, replaceText);
    
    case 'xml':
    case 'html':
    case 'svg':
      return validateXmlSyntax(searchText, replaceText);
    
    case 'css':
    case 'scss':
    case 'less':
      return validateCssSyntax(searchText, replaceText);
    
    default:
      // Generic validation for unknown types
      return validateGenericSyntax(searchText, replaceText);
  }
}

/**
 * Validate JavaScript/TypeScript syntax patterns.
 */
function validateJavaScriptSyntax(searchText: string, replaceText: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Bracket/brace/parenthesis matching
  const brackets = [
    { open: '{', close: '}', name: 'braces' },
    { open: '[', close: ']', name: 'brackets' },
    { open: '(', close: ')', name: 'parentheses' }
  ];

  for (const { open, close, name } of brackets) {
    const searchOpen = (searchText.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const searchClose = (searchText.match(new RegExp(`\\${close}`, 'g')) || []).length;
    const replaceOpen = (replaceText.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const replaceClose = (replaceText.match(new RegExp(`\\${close}`, 'g')) || []).length;

    const searchBalance = searchOpen - searchClose;
    const replaceBalance = replaceOpen - replaceClose;

    if (Math.abs(searchBalance - replaceBalance) > 0) {
      errors.push(`Unbalanced ${name} in search/replace operation`);
    }
  }

  // Quote matching (basic check)
  const quoteTypes = ["'", '"', '`'];
  for (const quote of quoteTypes) {
    const searchQuotes = (searchText.match(new RegExp(`\\${quote}`, 'g')) || []).length;
    const replaceQuotes = (replaceText.match(new RegExp(`\\${quote}`, 'g')) || []).length;

    if (searchQuotes % 2 !== 0 || replaceQuotes % 2 !== 0) {
      warnings.push(`Potentially unmatched ${quote} quotes detected`);
    }
  }

  // Semicolon consistency check
  const searchSemicolons = (searchText.match(/;/g) || []).length;
  const replaceSemicolons = (replaceText.match(/;/g) || []).length;
  const searchLines = searchText.split('\n').filter(line => line.trim()).length;
  const replaceLines = replaceText.split('\n').filter(line => line.trim()).length;

  if (searchLines > 1 && replaceSemicolons === 0 && searchSemicolons > 0) {
    warnings.push("Semicolon usage pattern changed - verify syntax correctness");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate JSON syntax patterns.
 */
function validateJsonSyntax(searchText: string, replaceText: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Try to parse as JSON if it looks like complete JSON
  const trimmedSearch = searchText.trim();
  const trimmedReplace = replaceText.trim();

  if (trimmedSearch.startsWith('{') && trimmedSearch.endsWith('}')) {
    try {
      JSON.parse(trimmedSearch);
    } catch (e) {
      warnings.push("Search text appears to be malformed JSON");
    }
  }

  if (trimmedReplace.startsWith('{') && trimmedReplace.endsWith('}')) {
    try {
      JSON.parse(trimmedReplace);
    } catch (e) {
      warnings.push("Replace text appears to be malformed JSON");
    }
  }

  // Check quote consistency
  const searchDoubleQuotes = (searchText.match(/"/g) || []).length;
  const replaceDoubleQuotes = (replaceText.match(/"/g) || []).length;

  if (searchDoubleQuotes % 2 !== 0 || replaceDoubleQuotes % 2 !== 0) {
    errors.push("Unmatched double quotes in JSON content");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate XML/HTML syntax patterns.
 */
function validateXmlSyntax(searchText: string, replaceText: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic tag matching
  const searchOpenTags = (searchText.match(/<[^\/][^>]*>/g) || []).length;
  const searchCloseTags = (searchText.match(/<\/[^>]*>/g) || []).length;
  const replaceOpenTags = (replaceText.match(/<[^\/][^>]*>/g) || []).length;
  const replaceCloseTags = (replaceText.match(/<\/[^>]*>/g) || []).length;

  const searchBalance = searchOpenTags - searchCloseTags;
  const replaceBalance = replaceOpenTags - replaceCloseTags;

  if (Math.abs(searchBalance - replaceBalance) > 1) {
    warnings.push("Significant change in XML/HTML tag balance");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate CSS syntax patterns.
 */
function validateCssSyntax(searchText: string, replaceText: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Brace matching for CSS rules
  const searchBraces = (searchText.match(/{/g) || []).length - (searchText.match(/}/g) || []).length;
  const replaceBraces = (replaceText.match(/{/g) || []).length - (replaceText.match(/}/g) || []).length;

  if (Math.abs(searchBraces - replaceBraces) > 0) {
    errors.push("Unbalanced CSS braces");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Generic syntax validation for unknown file types.
 */
function validateGenericSyntax(searchText: string, replaceText: string): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for obvious encoding issues
  if (searchText.includes('\uFFFD') || replaceText.includes('\uFFFD')) {
    warnings.push("Text contains replacement characters - possible encoding issues");
  }

  // Check for binary content
  const controlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]/;
  if (controlChars.test(searchText) || controlChars.test(replaceText)) {
    warnings.push("Text contains control characters - possible binary content");
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Assess complexity of the search/replace operation.
 */
function assessComplexity(searchText: string, replaceText: string, matchCount: number): 'low' | 'medium' | 'high' {
  let complexity = 0;

  // Size factor
  if (searchText.length > 1000 || replaceText.length > 1000) complexity += 2;
  if (searchText.length > 5000 || replaceText.length > 5000) complexity += 3;

  // Line count factor
  const searchLines = searchText.split('\n').length;
  const replaceLines = replaceText.split('\n').length;
  if (searchLines > 20 || replaceLines > 20) complexity += 2;
  if (searchLines > 50 || replaceLines > 50) complexity += 3;

  // Multiple matches factor
  if (matchCount > 1) complexity += 1;
  if (matchCount > 5) complexity += 2;

  // Content complexity (regex patterns, special chars)
  const specialCharCount = (searchText.match(/[{}[\]()\\.*+?^$|]/g) || []).length;
  if (specialCharCount > 10) complexity += 2;

  if (complexity >= 7) return 'high';
  if (complexity >= 3) return 'medium';
  return 'low';
}

/**
 * Validate content integrity and context preservation.
 */
function validateContentIntegrity(
  searchText: string, 
  replaceText: string, 
  content: string, 
  filePath: string
): { isValid: boolean; errors: string[]; warnings: string[]; severityPenalty: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  let severityPenalty = 0;

  // Check if replacement might break imports/requires
  if (filePath.match(/\.(ts|js|tsx|jsx)$/)) {
    const hasImportChanges = searchText.includes('import') || replaceText.includes('import') ||
                            searchText.includes('require') || replaceText.includes('require');
    
    if (hasImportChanges) {
      warnings.push("Changes affect import/require statements - verify module resolution");
      severityPenalty += 5;
    }

    // Check for function signature changes
    const functionPattern = /function\s+\w+\s*\(/g;
    const searchFuncs = (searchText.match(functionPattern) || []).length;
    const replaceFuncs = (replaceText.match(functionPattern) || []).length;
    
    if (searchFuncs !== replaceFuncs) {
      warnings.push("Function declarations are being modified - verify API compatibility");
      severityPenalty += 10;
    }
  }

  // Check for configuration file changes
  if (filePath.match(/\.(json|yaml|yml|toml|env)$/)) {
    warnings.push("Configuration file changes detected - verify application behavior");
    severityPenalty += 5;
  }

  // Context preservation check
  const searchIndex = content.indexOf(searchText);
  if (searchIndex >= 0) {
    const contextBefore = content.substring(Math.max(0, searchIndex - 100), searchIndex);
    const contextAfter = content.substring(searchIndex + searchText.length, Math.min(content.length, searchIndex + searchText.length + 100));
    
    // Check if we're in the middle of a larger structure
    if (contextBefore.includes('{') && !contextBefore.includes('}') && 
        contextAfter.includes('}') && !contextAfter.includes('{')) {
      warnings.push("Change appears to be within a code block - verify structural integrity");
      severityPenalty += 5;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    severityPenalty
  };
}

/**
 * Apply a single search/replace operation to a file with comprehensive validation and safety checks.
 */
export function applySearchReplace(
  filePath: string,
  searchText: string,
  replaceText: string,
  repoPath: string
): boolean {
  const config = getFileOperationsConfig();
  
  const content = safeReadFile(filePath, repoPath);
  if (content === null) {
    logger.error("Failed to read file for search/replace operation", { filePath });
    return false;
  }
  
  // Comprehensive validation before applying changes
  const validation = validateSearchReplaceBlock(filePath, searchText, replaceText, content);
  
  // Log detailed validation results
  logger.log("Search/replace validation completed", {
    filePath,
    isValid: validation.isValid,
    securityScore: validation.securityScore,
    complexity: validation.complexity,
    syntaxValid: validation.syntaxValid,
    errorsCount: validation.errors.length,
    warningsCount: validation.warnings.length
  });
  
  if (!validation.isValid) {
    logger.error("Search/replace validation failed - operation rejected", {
      filePath,
      securityScore: validation.securityScore,
      complexity: validation.complexity,
      errors: validation.errors,
      warnings: validation.warnings
    });
    return false;
  }

  // Log warnings for monitoring and debugging
  if (validation.warnings.length > 0) {
    logger.warn("Search/replace validation warnings", {
      filePath,
      securityScore: validation.securityScore,
      warnings: validation.warnings
    });
  }

  // Enhanced security check using configurable threshold
  if (validation.securityScore < config.minSecurityScore) {
    logger.error("Security score below threshold - operation rejected", {
      filePath,
      securityScore: validation.securityScore,
      minRequired: config.minSecurityScore,
      complexity: validation.complexity
    });
    return false;
  }
  
  // Enhanced security check for complex operations using configurable complexity limit
  const maxComplexityForHighSecurity = config.maxComplexityForHighSecurity;
  const complexityThreshold = maxComplexityForHighSecurity === 'low' ? 70 : 
                               maxComplexityForHighSecurity === 'medium' ? 80 : 90;
                               
  if (validation.complexity === 'high' && validation.securityScore < complexityThreshold) {
    logger.error("High complexity operation with low security score rejected", {
      filePath,
      complexity: validation.complexity,
      securityScore: validation.securityScore,
      requiredScore: complexityThreshold
    });
    return false;
  }
  
  // Verify search text exists in content
  if (!content.includes(searchText)) {
    logger.warn("Search text not found in file content", {
      filePath,
      searchTextLength: searchText.length,
      searchTextPreview: searchText.substring(0, 100) + (searchText.length > 100 ? '...' : ''),
      contentLength: content.length
    });
    return false;
  }
  
  // Create versioned backup before making changes (if enabled)
  let backupPath: string | null = null;
  if (config.enableBackups) {
    backupPath = createVersionedBackup(filePath, repoPath);
    if (!backupPath) {
      logger.error("Failed to create backup - aborting operation", { filePath });
      return false;
    }
  }
  
  try {
    // Apply the replacement with careful indexing
    const searchIndex = content.indexOf(searchText);
    if (searchIndex === -1) {
      logger.error("Search text not found during replacement (race condition?)", { filePath });
      return false;
    }

    const beforeContent = content.substring(0, searchIndex);
    const afterContent = content.substring(searchIndex + searchText.length);
    const newContent = beforeContent + replaceText + afterContent;
    
    // Verify the new content integrity
    const integrityCheck = verifyContentIntegrity(newContent, filePath);
    if (!integrityCheck.isValid) {
      logger.error("Content integrity check failed after replacement", {
        filePath,
        issues: integrityCheck.issues
      });
      
      // Restore from backup if available
      if (backupPath) {
        restoreFromBackup(backupPath, path.join(repoPath, filePath));
      }
      return false;
    }
    
    // Write the new content
    const success = safeWriteFile(filePath, newContent, repoPath);
    
    if (!success) {
      logger.error("Failed to write modified content", { filePath });
      // Restore from backup on write failure if available
      if (backupPath) {
        restoreFromBackup(backupPath, path.join(repoPath, filePath));
      }
      return false;
    }
    
    // Log successful operation
    logger.log("Search/replace operation completed successfully", {
      filePath,
      searchLength: searchText.length,
      replaceLength: replaceText.length,
      contentSizeBefore: content.length,
      contentSizeAfter: newContent.length,
      securityScore: validation.securityScore,
      complexity: validation.complexity
    });
    
    // Clean up backup after successful operation using configurable TTL
    if (backupPath && config.backupTTL > 0) {
      setTimeout(() => {
        try {
          if (require('fs').existsSync(backupPath)) {
            require('fs').unlinkSync(backupPath);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }, config.backupTTL);
    }
    
    return true;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Exception during search/replace operation", {
      filePath,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    // Restore from backup on any error if available
    if (backupPath) {
      const restored = restoreFromBackup(backupPath, path.join(repoPath, filePath));
      logger.log("Backup restoration after error", { filePath, restored });
    }
    
    return false;
  }
}

/**
 * Create a versioned backup file with timestamp.
 */
function createVersionedBackup(filePath: string, repoPath: string): string | null {
  if (!isValidFilePath(filePath, repoPath)) {
    return null;
  }
  
  const fullPath = path.join(repoPath, filePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(repoPath, '.backup');
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupFileName = `${path.basename(filePath)}.${timestamp}.backup`;
    const backupPath = path.join(backupDir, backupFileName);
    
    fs.copyFileSync(fullPath, backupPath);
    logger.log("Versioned backup created", { 
      originalPath: filePath, 
      backupPath,
      timestamp
    });
    
    return backupPath;
  } catch (error) {
    logger.error("Failed to create versioned backup", {
      filePath,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

/**
 * Verify content integrity after modifications.
 */
function verifyContentIntegrity(content: string, filePath: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  try {
    // Check for basic encoding issues
    if (content.includes('\uFFFD')) {
      issues.push("Content contains replacement characters (encoding issues)");
    }
    
    // Check for unexpected null bytes
    if (content.includes('\0')) {
      issues.push("Content contains null bytes");
    }
    
    // File-type specific integrity checks
    const fileExtension = path.extname(filePath).toLowerCase();
    
    switch (fileExtension) {
      case '.json':
        try {
          JSON.parse(content);
        } catch (jsonError) {
          issues.push("Modified JSON content is not valid");
        }
        break;
        
      case '.ts':
      case '.tsx':
      case '.js':
      case '.jsx':
        // Basic syntax checks for JavaScript/TypeScript
        const brackets = ['{', '}', '[', ']', '(', ')'];
        const counts = brackets.reduce((acc, bracket) => {
          acc[bracket] = (content.match(new RegExp(`\\${bracket}`, 'g')) || []).length;
          return acc;
        }, {} as Record<string, number>);
        
        if (counts['{'] !== counts['}']) {
          issues.push("Unbalanced curly braces in JavaScript/TypeScript content");
        }
        if (counts['['] !== counts[']']) {
          issues.push("Unbalanced square brackets in JavaScript/TypeScript content");
        }
        if (counts['('] !== counts[')']) {
          issues.push("Unbalanced parentheses in JavaScript/TypeScript content");
        }
        break;
        
      case '.xml':
      case '.html':
      case '.svg':
        // Basic XML/HTML tag balance check
        const openTags = (content.match(/<[^\/!][^>]*>/g) || []).length;
        const closeTags = (content.match(/<\/[^>]*>/g) || []).length;
        const selfClosing = (content.match(/<[^>]*\/>/g) || []).length;
        
        if (Math.abs(openTags - closeTags - selfClosing) > 1) {
          issues.push("Possibly unbalanced XML/HTML tags");
        }
        break;
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
    
  } catch (error) {
    issues.push(`Integrity verification failed: ${error instanceof Error ? error.message : String(error)}`);
    return { isValid: false, issues };
  }
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
 * Validate the structure of a search-replace block for use in codex.ts.
 * @param blockContent - Content of the search-replace block.
 * @param repoPath - Repository path for file existence validation.
 * @returns Validation result with errors and warnings.
 */
export function validateSearchReplaceBlockStructure(
  blockContent: string, 
  repoPath: string
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check for FILE declaration
    const fileMatch = blockContent.match(/FILE:\s*(.*)/);
    if (!fileMatch) {
      errors.push("Missing FILE declaration");
      return { isValid: false, errors, warnings };
    }

    const filePath = fileMatch[1].trim();
    if (!filePath) {
      errors.push("Empty file path");
      return { isValid: false, errors, warnings };
    }

    // Validate file path safety
    if (filePath.includes('..')) {
      errors.push("File path contains directory traversal");
    }

    // Check if file exists (warning, not error)
    try {
      const fullPath = path.join(repoPath, filePath);
      if (!fs.existsSync(fullPath)) {
        warnings.push(`File does not exist: ${filePath}`);
      }
    } catch (pathError) {
      warnings.push(`Cannot verify file existence: ${filePath}`);
    }

    // Check for SEARCH/REPLACE pairs
    const searchReplaceRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    const operations = [];
    let operationMatch;

    while ((operationMatch = searchReplaceRegex.exec(blockContent)) !== null) {
      operations.push({
        search: operationMatch[1],
        replace: operationMatch[2]
      });
    }

    if (operations.length === 0) {
      errors.push("No valid SEARCH/REPLACE operations found");
    }

    // Validate individual operations
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      
      if (!op.search.trim()) {
        errors.push(`Empty search text in operation ${i + 1}`);
      }
      
      if (op.search.length > 5000) {
        warnings.push(`Search text is very long in operation ${i + 1} (${op.search.length} chars)`);
      }
      
      if (op.replace.length > 10000) {
        warnings.push(`Replace text is very long in operation ${i + 1} (${op.replace.length} chars)`);
      }
    }

  } catch (error) {
    errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
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
