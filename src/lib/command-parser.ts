// Utility functions for parsing commands from GitHub comments

export interface ParsedCommand {
  command: string;
  fullText: string;
  isMention: boolean;
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
  
  // Check if the comment mentions @uwularpy or @l with various patterns
  // Handle multiple mentions by taking the first one
  const mentionPatterns = [
    /@uwularpy\b/i,
    /@l\s+/i
  ];
  
  const isMention = mentionPatterns.some(pattern => pattern.test(sanitizedComment));
  
  if (!isMention) {
    return {
      command: '',
      fullText: sanitizedComment,
      isMention: false
    };
  }

  // Extract text after the mention (case-insensitive, allow for punctuation/whitespace)
  // Updated regex to handle edge cases better
  const match = sanitizedComment.match(/@(uwularpy|l)\s+([\s\S]*?)(?=@\w+|$)/i);
  const textAfterMention = match ? match[2].trim() : '';

  // Handle edge case where mention is at the end with no command
  if (!textAfterMention && /@(uwularpy|l)\s*$/i.test(sanitizedComment)) {
    return {
      command: '',
      fullText: '',
      isMention: true
    };
  }

  return {
    command: textAfterMention.trim().toLowerCase(),
    fullText: textAfterMention,
    isMention: true
  };
}

/**
 * Determines the task type based on the parsed command
 * Enhanced with better validation and edge case handling
 * @param parsedCommand The parsed command object
 * @returns The task type to trigger
 */
export function getTaskType(parsedCommand: ParsedCommand): string | null {
  if (!parsedCommand || !parsedCommand.isMention) {
    return null;
  }

  // If no command text, trigger uwuify repository
  if (!parsedCommand.command) {
    return 'uwuify-repository';
  }

  // Normalize command for comparison
  const normalizedCommand = parsedCommand.command.toLowerCase().trim();
  
  // Check for approval patterns first
  if (isApprovalCommand(normalizedCommand)) {
    return 'plan-approval-task';
  }
  
  // Check for specific commands with aliases
  switch (normalizedCommand) {
    case 'r':
    case 'review':
      return 'full-code-review';
    case 'plan':
    case 'planning':
    case 'analyze':
      return 'plan-task';
    default:
      // For any other command, trigger codex-task
      return 'codex-task';
  }
}

/**
 * Checks if a command is an approval command
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
    'go',
    'proceed',
    'continue',
    'lfg'
  ];
  
  return approvalPatterns.includes(command);
}