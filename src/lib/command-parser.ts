// Utility functions for parsing commands from GitHub comments

export interface ParsedCommand {
  command: string;
  fullText: string;
  isMention: boolean;
}

/**
 * Parses a GitHub comment to extract uwularpy commands
 * @param comment The comment text to parse
 * @returns ParsedCommand object with extracted information
 */
export function parseCommand(comment: string): ParsedCommand {
  // Check if the comment mentions @uwularpy or @l
  const isMention = comment.includes('@uwularpy') || comment.includes('@l ');
  
  if (!isMention) {
    return {
      command: '',
      fullText: comment,
      isMention: false
    };
  }

  // Extract text after the mention (case-insensitive, allow for punctuation/whitespace)
  const match = comment.match(/@(uwularpy|l)\s+([\s\S]+)/i);
  const textAfterMention = match ? match[2].trim() : '';

  return {
    command: textAfterMention.trim().toLowerCase(),
    fullText: textAfterMention,
    isMention: true
  };
}

/**
 * Determines the task type based on the parsed command
 * @param parsedCommand The parsed command object
 * @returns The task type to trigger
 */
export function getTaskType(parsedCommand: ParsedCommand): string | null {
  if (!parsedCommand.isMention) {
    return null;
  }

  // If no command text, trigger uwuify repository
  if (!parsedCommand.command) {
    return 'uwuify-repository';
  }

  // Check for specific commands
  switch (parsedCommand.command) {
    case 'r':
      return 'full-code-review';
    case 'plan':
      return 'plan-task';
    default:
      return 'codex-task';
  }
}