// src/services/task-types.ts

/**
 * Interface for GitHub context to be passed to the worker
 */
export interface GitHubContext {
  owner: string;
  repo: string;
  issueNumber: number;
  requester: string;
  installationId: number;
  requestTimestamp?: string;
  requestId?: string;
}

/**
 * Interface for repository statistics
 */
export interface RepoStats {
  totalFiles: number;
  markdownFiles: number;
  totalMarkdownSize: number;
  avgMarkdownSize: number;
  largestFile: {
    name: string;
    size: number;
  };
  contributors: number;
  lastUpdated: string;
  topLanguages: { [key: string]: number };
}

/**
 * Generates a unique request ID for tracking
 * 
 * @returns A unique ID string
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
