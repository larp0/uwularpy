/**
 * Configuration constants for GitHub workflows
 * Centralized to avoid magic strings and improve maintainability
 */

// Bot configuration
export const BOT_USERNAME = process.env.BOT_USERNAME || 'uwularpy';
export const REVIEW_COMMAND = '@l r';

// GitHub Copilot configuration
export const COPILOT_USERNAME = 'copilot';

// Rate limiting and timing
export const DEFAULT_RATE_LIMIT_DELAY = 1000; // 1 second between API calls
export const MAX_API_CALLS_PER_MINUTE = 60;
export const MAX_RETRIES = 3;
export const RETRY_BASE_DELAY = 1000;

// Webhook processing limits (DoS protection)
export const MAX_COMMENT_PROCESSING_TIME = 30000; // 30 seconds
export const MAX_PR_PROCESSING_TIME = 60000; // 60 seconds
export const MAX_WORKFLOW_EXECUTION_TIME = 300000; // 5 minutes

// Security and validation limits
export const MAX_COMMENT_LENGTH = 10000;
export const MAX_PR_TITLE_LENGTH = 300;
export const MAX_ISSUE_TITLE_LENGTH = 300;
export const MAX_MILESTONE_TITLE_LENGTH = 300;
export const MAX_REPO_ANALYSIS_FILES = 50; // Limit number of files analyzed

// Text similarity threshold for PR-issue matching
export const TITLE_SIMILARITY_THRESHOLD = 0.2; // 20% minimum

// Rate limiting tracking (in-memory for simplicity)
export interface RateLimitTracker {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

let rateLimitTracker: RateLimitTracker = {};

/**
 * Simple rate limiter to prevent abuse
 */
export function checkRateLimit(identifier: string, maxCalls: number = MAX_API_CALLS_PER_MINUTE): boolean {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window
  
  // Clean up old entries
  for (const key in rateLimitTracker) {
    if (rateLimitTracker[key].resetTime < windowStart) {
      delete rateLimitTracker[key];
    }
  }
  
  // Check current usage
  const current = rateLimitTracker[identifier];
  if (!current) {
    rateLimitTracker[identifier] = { count: 1, resetTime: now };
    return true;
  }
  
  if (current.resetTime < windowStart) {
    // Reset the counter
    rateLimitTracker[identifier] = { count: 1, resetTime: now };
    return true;
  }
  
  if (current.count >= maxCalls) {
    return false; // Rate limited
  }
  
  current.count++;
  return true;
}

/**
 * Validate input lengths to prevent DoS attacks
 */
export function validateInputLength(input: string | null | undefined, maxLength: number, fieldName: string): boolean {
  if (!input) return true; // Allow empty/null values
  
  if (input.length > maxLength) {
    console.warn(`Input validation failed: ${fieldName} exceeds maximum length of ${maxLength}`);
    return false;
  }
  
  return true;
}