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

// Webhook processing limits
export const MAX_COMMENT_PROCESSING_TIME = 30000; // 30 seconds
export const MAX_PR_PROCESSING_TIME = 60000; // 60 seconds

// Security and validation
export const MAX_COMMENT_LENGTH = 10000;
export const MAX_PR_TITLE_LENGTH = 300;
export const MAX_ISSUE_TITLE_LENGTH = 300;

// Text similarity threshold for PR-issue matching
export const TITLE_SIMILARITY_THRESHOLD = 0.2; // 20% minimum