// Utility functions for parsing commands from GitHub comments
import { classifyCommandIntent, intentToTaskType } from './ai-command-parser';

export interface ParsedCommand {
  command: string;
  fullText: string;
  isMention: boolean;
  userQuery?: string; // Added to capture user-specific problems/queries
  aiIntent?: string; // AI-classified intent
  aiConfidence?: number; // AI confidence score
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
  let textAfterMention = match ? match[2].trim() : '';
  
  // Additional cleanup to handle any hidden characters or extra whitespace
  textAfterMention = textAfterMention.replace(/\s+/g, ' ').trim();

  // Handle edge case where mention is at the end with no command
  if (!textAfterMention && /@(uwularpy|l)\s*$/i.test(sanitizedComment)) {
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

  return {
    command: textAfterMention.trim().toLowerCase(),
    fullText: textAfterMention,
    isMention: true,
    userQuery
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
  parsedCommand: ParsedCommand,
  context?: { recentMilestone?: boolean; lastTaskType?: string }
): Promise<string | null> {
  if (!parsedCommand || !parsedCommand.isMention) {
    return null;
  }

  // If no command text, return null
  if (!parsedCommand.command) {
    return null;
  }

  try {
    // Use AI to classify the intent
    const classification = await classifyCommandIntent(parsedCommand.command, context);
    
    // Store AI results in the parsed command for reference
    parsedCommand.aiIntent = classification.intent;
    parsedCommand.aiConfidence = classification.confidence;
    
    console.log('[getTaskType] AI Classification:', {
      command: parsedCommand.command,
      intent: classification.intent,
      confidence: classification.confidence,
      language: classification.language
    });
    
    // Map intent to task type
    const taskType = intentToTaskType(classification.intent);
    
    if (taskType) {
      console.log(`[getTaskType] Mapped intent "${classification.intent}" to task: ${taskType}`);
      return taskType;
    }
    
    // Fallback to codex-task if no mapping
    return 'codex-task';
    
  } catch (error) {
    console.error('[getTaskType] AI classification failed, using fallback', error);
    
    // Fallback to the old pattern-based system
    return getTaskTypeFallback(parsedCommand);
  }
}

/**
 * Fallback task type determination using patterns
 * Used when AI classification fails
 */
function getTaskTypeFallback(parsedCommand: ParsedCommand): string | null {
  const normalizedCommand = parsedCommand.command.toLowerCase().trim();
  
  console.log('[getTaskTypeFallback] Using pattern matching for:', normalizedCommand);
  
  // Check for approval patterns first
  if (isApprovalCommand(normalizedCommand)) {
    return 'plan-approval-task';
  }
  
  // Check for refinement patterns
  if (isRefinementCommand(normalizedCommand)) {
    return 'plan-refinement-task';
  }
  
  // Check for cancellation patterns
  if (isCancellationCommand(normalizedCommand)) {
    return 'plan-cancellation-task';
  }
  
  // Check for execution confirmation patterns
  if (isExecutionConfirmationCommand(normalizedCommand)) {
    return 'plan-execution-task';
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
    'i approve'
  ];
  
  // Debug logging
  console.log('[isApprovalCommand] Checking command:', command);
  console.log('[isApprovalCommand] Command length:', command.length);
  console.log('[isApprovalCommand] Command char codes:', command.split('').map(c => c.charCodeAt(0)));
  
  // Check if command starts with any approval pattern (handles edge cases)
  const isApproval = approvalPatterns.includes(command) ||
                     approvalPatterns.some(pattern => command.startsWith(pattern + ' '));
  
  console.log('[isApprovalCommand] Is approval?', isApproval);
  
  return isApproval;
}

/**
 * Checks if a command is a refinement command for milestone modification
 * @param command The normalized command to check
 * @returns true if the command is a refinement request
 */
function isRefinementCommand(command: string): boolean {
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
function isCancellationCommand(command: string): boolean {
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
function isExecutionConfirmationCommand(command: string): boolean {
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
