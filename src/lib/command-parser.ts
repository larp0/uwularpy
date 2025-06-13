// Utility functions for parsing commands from GitHub comments

export interface ParsedCommand {
  command: string;
  fullText: string;
  isMention: boolean;
  userQuery?: string; // Added to capture user-specific problems/queries
  aiIntent?: string; // AI-classified intent
  aiConfidence?: number; // AI confidence score
  isDevCommand?: boolean; // True if this is a "@l dev " command
}

/**
 * Strips HTML and markdown tags from text for safety
 * @param text The text to sanitize
 * @returns Sanitized text
 */
function sanitizeText(text: string): string {
  if (typeof text !== 'string') return '';
  
  // Remove HTML tags
  let sanitized = text.replace(/<[^>]*>/g, '');
  
  // Remove markdown links but keep the text
  sanitized = sanitized.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // Remove markdown formatting
  sanitized = sanitized.replace(/[*_`~]/g, '');
  
  // Remove potential script injection attempts
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized.trim();
}

/**
 * Parses a GitHub comment to extract uwularpy commands
 * Enhanced with safety checks and edge case handling
 * @param comment The comment text to parse
 * @returns ParsedCommand object with extracted information
 */
export function parseCommand(comment: string): ParsedCommand {
  // Validate input
  if (!comment || typeof comment !== 'string') {
    return {
      command: '',
      fullText: '',
      isMention: false
    };
  }
  
  // Sanitize the comment to prevent potential security issues
  const sanitizedComment = sanitizeText(comment);
  
  // Check for length limits to prevent abuse
  if (sanitizedComment.length > 10000) {
    console.warn('Comment too long, truncating for processing');
    const truncated = sanitizedComment.slice(0, 10000);
    return parseCommand(truncated);
  }
  
  // Check if the comment mentions @uwularpy, @l, or self@ with various patterns
  // Handle multiple mentions by taking the first one
  // IMPORTANT: @l should only trigger when at the beginning of the message
  const mentionPatterns = [
    /^\s*@uwularpy\b/i,
    /self@/i
  ];
  
  // Check for @l only at the beginning (after optional whitespace)
  const atLBeginningPattern = /^\s*@l\b/i;
  
  const hasUwularpy = mentionPatterns.some(pattern => pattern.test(sanitizedComment));
  const hasAtLAtBeginning = atLBeginningPattern.test(sanitizedComment);
  
  const isMention = hasUwularpy || hasAtLAtBeginning;
  
  if (!isMention) {
    return {
      command: '',
      fullText: sanitizedComment,
      isMention: false
    };
  }

  // Extract text after the mention (case-insensitive, allow for punctuation/whitespace)
  // Updated regex to handle edge cases better, including self@ prefix
  // For @l, only match if it's at the beginning of the message
  let match;
  
  if (hasAtLAtBeginning) {
    // For @l at beginning, extract everything after @l
    match = sanitizedComment.match(/^\s*@l\s*([\s\S]*?)(?=@\w+|$)/i);
  } else if (hasUwularpy) {
    // For @uwularpy or self@, use the original logic (can be anywhere)
    match = sanitizedComment.match(/@(uwularpy)\s*([\s\S]*?)(?=@\w+|$)/i) || 
            sanitizedComment.match(/self@\s*(.+?)(?=@\w+|$)/i);
  }
  
  let textAfterMention = '';
  
  if (match) {
    if (match[0].startsWith('self@')) {
      // For self@ mentions, the command is in match[1]
      textAfterMention = (match[1] || '').trim();
    } else if (hasAtLAtBeginning) {
      // For @l at beginning, the command is in match[1]
      textAfterMention = (match[1] || '').trim();
    } else {
      // For @uwularpy mentions, the command is in match[2]
      textAfterMention = (match[2] || '').trim();
    }
  }
  
  // Additional cleanup to handle any hidden characters or extra whitespace
  textAfterMention = textAfterMention.replace(/\s+/g, ' ').trim();

  // Handle edge case where mention is at the end with no command
  if (!textAfterMention && (/@(uwularpy)\s*$/i.test(sanitizedComment) || /self@\s*$/i.test(sanitizedComment) || /^\s*@l\s*$/i.test(sanitizedComment))) {
    return {
      command: '',
      fullText: '',
      isMention: true
    };
  }

  // Extract user query for plan commands
  let userQuery = '';
  const planCommandMatch = textAfterMention.match(/^(plan|planning|analyze)\s+(.+)$/i);
  const refineCommandMatch = textAfterMention.match(/^(refine|revise|modify|update|change|edit)\s+(.+)$/i);
  
  if (planCommandMatch) {
    userQuery = planCommandMatch[2].trim();
  } else if (refineCommandMatch) {
    userQuery = refineCommandMatch[2].trim();
  }

  // Check if this is a "@l dev " command specifically
  const isDevCommand = textAfterMention.toLowerCase().startsWith('dev ');

  return {
    command: textAfterMention.trim().toLowerCase(),
    fullText: textAfterMention,
    isMention: true,
    userQuery,
    isDevCommand
  };
}

/**
 * Determines the task type based on the parsed command
 * Now uses AI to understand intent, typos, and multiple languages
 * @param parsedCommand The parsed command object
 * @param context Optional context for better AI classification
 * @returns The task type to trigger
 */
export async function getTaskType(
  parsedCommand: ParsedCommand
): Promise<string | null> {
  if (!parsedCommand || !parsedCommand.isMention) {
    return null;
  }

  // If no command text, analyze the thread and provide general response
  if (!parsedCommand.command) {
    return 'general-response-task';
  }

  // Priority commands that should work without AI
  const normalizedCommand = parsedCommand.command.toLowerCase().trim();
  
  // Handle critical commands directly without AI to ensure they always work
  // Use a comprehensive list that matches isApprovalCommand patterns
  const directApprovalPatterns = ['approve', 'yes', 'y', 'ok', 'okay', 'lgtm'];
  if (directApprovalPatterns.includes(normalizedCommand)) {
    console.log('[getTaskType] Direct match for approval command:', normalizedCommand);
    return 'plan-approval-task';
  }
  
  if (normalizedCommand === 'plan' || normalizedCommand === 'planning' || normalizedCommand === 'analyze' ||
      normalizedCommand.startsWith('plan ') || normalizedCommand.startsWith('planning ') || normalizedCommand.startsWith('analyze ')) {
    console.log('[getTaskType] Direct match for plan command:', normalizedCommand);
    return 'plan-task';
  }
  
  if (normalizedCommand === 'review' || normalizedCommand === 'r') {
    console.log('[getTaskType] Direct match for review command:', normalizedCommand);
    return 'full-code-review';
  }

  // Before checking dev commands, let's check for multi-word approval commands
  // using the comprehensive isApprovalCommand function
  if (isApprovalCommand(normalizedCommand)) {
    console.log('[getTaskType] Multi-word approval command detected:', normalizedCommand);
    return 'plan-approval-task';
  }

  // IMPORTANT: Only "@l dev " commands should trigger codex-task
  if (parsedCommand.isDevCommand) {
    console.log('[getTaskType] Detected dev command, routing to codex-task:', normalizedCommand);
    return 'codex-task';
  }

  // For other @l commands, we analyze the thread and provide contextual responses
  // This fetches all messages from the thread and generates appropriate responses
  console.log('[getTaskType] Non-dev @l command detected, routing to general response:', normalizedCommand);
  return 'general-response-task';
}

/**
 * Checks if a command is an approval command for milestone decomposition
 * @param command The normalized command to check
 * @returns true if the command is an approval
 */
function isApprovalCommand(command: string): boolean {
  const approvalPatterns = [
    'y',
    'yes',
    'ok',
    'okay',
    'approve',
    'i approve',
    'lgtm',
    'ship it',
    'looks good',
    'go ahead'
  ];
  
  // Debug logging
  console.log('[isApprovalCommand] Checking command:', command);
  
  // Simple direct match first
  if (approvalPatterns.includes(command)) {
    console.log('[isApprovalCommand] Direct match found');
    return true;
  }
  
  // Check if command starts with any approval pattern
  const startsWithApproval = approvalPatterns.some(pattern =>
    command === pattern || command.startsWith(pattern + ' ')
  );
  
  if (startsWithApproval) {
    console.log('[isApprovalCommand] Starts with approval pattern');
    return true;
  }
  
  // Check for common variations
  if (/^(ship\s+it|looks\s+good|go\s+ahead)/i.test(command)) {
    console.log('[isApprovalCommand] Matches common variation');
    return true;
  }
  
  console.log('[isApprovalCommand] No approval pattern matched');
  return false;
}

/**
 * Checks if a command is a refinement command for milestone modification
 * @param command The normalized command to check
 * @returns true if the command is a refinement request
 */
function _isRefinementCommand(command: string): boolean {
  const refinementPatterns = [
    'refine',
    'revise', 
    'modify',
    'update',
    'change',
    'edit'
  ];
  
  return refinementPatterns.includes(command);
}

/**
 * Checks if a command is a cancellation command for milestone rejection
 * @param command The normalized command to check
 * @returns true if the command is a cancellation request
 */
function _isCancellationCommand(command: string): boolean {
  const cancellationPatterns = [
    'cancel',
    'reject',
    'no',
    'n',
    'abort',
    'stop'
  ];
  
  return cancellationPatterns.includes(command);
}

/**
 * Checks if a command is an execution confirmation command
 * @param command The normalized command to check
 * @returns true if the command is an execution confirmation
 */
function _isExecutionConfirmationCommand(command: string): boolean {
  const confirmationPatterns = [
    'go',
    'proceed',
    'continue',
    'start',
    'begin',
    'lfg',
    'let\'s go',
    'do it'
  ];
  
  return confirmationPatterns.includes(command);
}
