import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";

/**
 * Enhanced milestone finding utilities with improved debugging and pattern matching.
 * Addresses the issue where milestones exist but cannot be found.
 */

export interface MilestoneSearchOptions {
  searchDepth?: number; // Number of comments to search (default: 200)
  includeAllUsers?: boolean; // Search comments from all users, not just bot
  debugMode?: boolean; // Enable detailed logging
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  type: 'User' | 'Bot' | 'Organization';
  site_admin?: boolean;
  html_url?: string;
  url?: string;
}

export interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  due_on: string | null;
  closed_at: string | null;
  creator: GitHubUser | null;
  open_issues: number;
  closed_issues: number;
  html_url: string;
  url: string;
  labels_url?: string;
  node_id?: string;
}

export interface GitHubComment {
  id: number;
  user: GitHubUser | null;
  created_at: string;
  updated_at: string;
  body: string | null;
  html_url: string;
  url?: string;
  issue_url?: string;
  node_id?: string;
  author_association?: 'COLLABORATOR' | 'CONTRIBUTOR' | 'FIRST_TIMER' | 'FIRST_TIME_CONTRIBUTOR' | 'MANNEQUIN' | 'MEMBER' | 'NONE' | 'OWNER';
}

export interface MilestoneSearchResult {
  milestone: GitHubMilestone;
  commentCreatedAt: string;
  foundIn: string;
  pattern: string;
  confidence: number; // 0-100 confidence score for the match
}

export interface MilestonePattern {
  name: string;
  regex: RegExp;
  priority: number; // Higher priority patterns are preferred
  description: string;
}

export interface EnhancedMilestoneSearchOptions extends MilestoneSearchOptions {
  minConfidence?: number; // Minimum confidence score to accept a match (default: 70)
  patternPriority?: string[]; // Preferred pattern names in order of preference
  contextValidation?: boolean; // Enable context-based validation (default: true)
}

/**
 * Enhanced milestone finding function with better pattern matching, typing, and confidence scoring.
 */
export async function findMostRecentMilestoneEnhanced(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  options: EnhancedMilestoneSearchOptions = {}
): Promise<GitHubMilestone | null> {
  const {
    searchDepth = 200,
    includeAllUsers = false,
    debugMode = false,
    minConfidence = 70,
    patternPriority = [],
    contextValidation = true
  } = options;

  try {
    logger.info("🔍 Enhanced milestone search starting", { 
      issueNumber, 
      searchDepth, 
      includeAllUsers,
      debugMode,
      minConfidence,
      contextValidation
    });

    // Get recent comments with proper typing
    const { data: comments }: { data: GitHubComment[] } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: searchDepth,
      sort: 'created',
      direction: 'desc'
    });

    logger.info(`📝 Found ${comments.length} comments to search`);

    if (debugMode) {
      // Log comment authors for debugging with proper typing
      const authors = comments
        .map((c: GitHubComment) => c.user?.login)
        .filter((login): login is string => Boolean(login));
      const uniqueAuthors = Array.from(new Set(authors));
      logger.info("👥 Comment authors found:", { uniqueAuthors });
    }

    // Enhanced milestone patterns with priority and confidence scoring
    const milestonePatterns: MilestonePattern[] = [
      {
        name: 'full_github_url',
        regex: /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/milestone\/(\d+)/gi,
        priority: 10,
        description: 'Full GitHub milestone URL'
      },
      {
        name: 'relative_milestone_url',
        regex: /\/([^\/]+)\/([^\/]+)\/milestone\/(\d+)/gi,
        priority: 9,
        description: 'Relative milestone URL'
      },
      {
        name: 'milestone_hash_reference',
        regex: /milestone\s*#(\d+)/gi,
        priority: 8,
        description: 'Milestone hash reference'
      },
      {
        name: 'milestone_colon_reference',
        regex: /milestone:\s*#?(\d+)/gi,
        priority: 7,
        description: 'Milestone colon reference'
      },
      {
        name: 'milestone_spaced',
        regex: /milestone\s+(\d+)/gi,
        priority: 6,
        description: 'Milestone with space'
      },
      {
        name: 'markdown_milestone_link',
        regex: /\[.*?\]\(.*?milestone\/(\d+).*?\)/gi,
        priority: 5,
        description: 'Markdown milestone link'
      },
      {
        name: 'milestone_created_notification',
        regex: /created milestone.*?#(\d+)/gi,
        priority: 4,
        description: 'Milestone creation notification'
      },
      {
        name: 'milestone_assigned_notification',
        regex: /assigned to milestone.*?#(\d+)/gi,
        priority: 3,
        description: 'Milestone assignment notification'
      }
    ];

    const foundMilestones: MilestoneSearchResult[] = [];

    // Search through comments with enhanced validation
    for (const comment of comments) {
      const commentUser = comment.user?.login || 'unknown';
      const shouldSearchComment = includeAllUsers || 
        isAuthorizedUser(commentUser);

      if (shouldSearchComment && comment.body) {
        if (debugMode) {
          logger.info(`🔍 Searching comment from ${commentUser}`, {
            commentId: comment.id,
            bodyLength: comment.body.length,
            createdAt: comment.created_at,
            authorAssociation: comment.author_association
          });
        }

        // Search with each pattern and calculate confidence
        for (const pattern of milestonePatterns) {
          const matches = findMilestoneMatches(comment.body, pattern, comment, contextValidation);
          
          for (const match of matches) {
            if (match.confidence >= minConfidence) {
              try {
                if (debugMode) {
                  logger.info(`🎯 Found milestone #${match.milestoneNumber} using ${pattern.name}`, {
                    confidence: match.confidence,
                    matchText: match.matchText,
                    commentUser
                  });
                }

                // Get milestone details with proper error handling
                const { data: milestone }: { data: GitHubMilestone } = await octokit.issues.getMilestone({
                  owner,
                  repo,
                  milestone_number: match.milestoneNumber
                });

                foundMilestones.push({
                  milestone,
                  commentCreatedAt: comment.created_at,
                  foundIn: commentUser,
                  pattern: pattern.name,
                  confidence: match.confidence
                });

                logger.info(`✅ Successfully retrieved milestone #${match.milestoneNumber}`, {
                  title: milestone.title,
                  state: milestone.state,
                  pattern: pattern.name,
                  confidence: match.confidence
                });

              } catch (milestoneError) {
                if (debugMode) {
                  logger.warn(`❌ Failed to retrieve milestone #${match.milestoneNumber}`, {
                    error: milestoneError instanceof Error ? milestoneError.message : 'Unknown error',
                    pattern: pattern.name
                  });
                }
              }
            }
          }
        }
      }
    }

    return selectBestMilestone(foundMilestones, patternPriority, debugMode);

  } catch (error) {
    logger.error("💥 Error in enhanced milestone search", {
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber,
      stack: error instanceof Error ? error.stack : undefined
    });
    return null;
  }
}

/**
 * Check if a user is authorized to create milestone references.
 */
function isAuthorizedUser(username: string): boolean {
  const authorizedUsers = ['l', 'uwularpy', 'copilot'];
  const authorizedPatterns = ['bot', 'github-actions'];
  
  return authorizedUsers.includes(username) || 
         authorizedPatterns.some(pattern => username.includes(pattern));
}

/**
 * Find milestone matches in text with confidence scoring.
 */
function findMilestoneMatches(
  text: string, 
  pattern: MilestonePattern, 
  comment: GitHubComment,
  contextValidation: boolean
): Array<{ milestoneNumber: number; confidence: number; matchText: string }> {
  const matches: Array<{ milestoneNumber: number; confidence: number; matchText: string }> = [];
  let match;
  
  // Reset regex state
  pattern.regex.lastIndex = 0;
  
  while ((match = pattern.regex.exec(text)) !== null) {
    // Extract milestone number (always the last capture group)
    const milestoneNumber = parseInt(match[match.length - 1], 10);
    
    if (milestoneNumber && milestoneNumber > 0) {
      let confidence = pattern.priority * 10; // Base confidence from pattern priority
      
      // Enhance confidence based on context
      if (contextValidation) {
        confidence = enhanceConfidenceWithContext(match, text, comment, confidence);
      }
      
      // Ensure confidence doesn't exceed 100
      confidence = Math.min(100, confidence);
      
      matches.push({
        milestoneNumber,
        confidence,
        matchText: match[0]
      });
    }
  }
  
  return matches;
}

/**
 * Enhance confidence score based on context analysis.
 */
function enhanceConfidenceWithContext(
  match: RegExpExecArray,
  text: string,
  comment: GitHubComment,
  baseConfidence: number
): number {
  let confidence = baseConfidence;
  
  // Increase confidence for recent comments
  const commentAge = Date.now() - new Date(comment.created_at).getTime();
  const daysOld = commentAge / (1000 * 60 * 60 * 24);
  
  if (daysOld < 1) confidence += 15;
  else if (daysOld < 7) confidence += 10;
  else if (daysOld < 30) confidence += 5;
  
  // Increase confidence for authorized users
  const user = comment.user;
  if (user) {
    if (user.type === 'Bot') confidence += 10;
    if (comment.author_association === 'OWNER' || comment.author_association === 'MEMBER') {
      confidence += 15;
    }
  }
  
  // Context keywords that increase confidence
  const contextKeywords = [
    'milestone', 'track', 'progress', 'goal', 'target', 'deadline',
    'release', 'version', 'sprint', 'iteration'
  ];
  
  const surroundingText = text.substring(
    Math.max(0, match.index! - 100),
    Math.min(text.length, match.index! + match[0].length + 100)
  ).toLowerCase();
  
  const keywordMatches = contextKeywords.filter(keyword => 
    surroundingText.includes(keyword)
  ).length;
  
  confidence += keywordMatches * 3;
  
  return confidence;
}

/**
 * Select the best milestone from candidates based on confidence and priority.
 */
function selectBestMilestone(
  foundMilestones: MilestoneSearchResult[],
  patternPriority: string[],
  debugMode: boolean
): GitHubMilestone | null {
  if (foundMilestones.length === 0) {
    logger.warn("❌ No milestones found with sufficient confidence");
    return null;
  }

  // Sort by confidence first, then by pattern priority, then by recency
  foundMilestones.sort((a, b) => {
    // Primary sort: confidence
    if (a.confidence !== b.confidence) {
      return b.confidence - a.confidence;
    }
    
    // Secondary sort: pattern priority
    const aPriorityIndex = patternPriority.indexOf(a.pattern);
    const bPriorityIndex = patternPriority.indexOf(b.pattern);
    
    if (aPriorityIndex !== -1 && bPriorityIndex !== -1) {
      return aPriorityIndex - bPriorityIndex;
    } else if (aPriorityIndex !== -1) {
      return -1;
    } else if (bPriorityIndex !== -1) {
      return 1;
    }
    
    // Tertiary sort: recency
    return new Date(b.commentCreatedAt).getTime() - new Date(a.commentCreatedAt).getTime();
  });

  const bestMatch = foundMilestones[0];
  
  logger.info("🏆 Selected best milestone match", {
    milestoneNumber: bestMatch.milestone.number,
    title: bestMatch.milestone.title,
    confidence: bestMatch.confidence,
    pattern: bestMatch.pattern,
    foundBy: bestMatch.foundIn,
    totalCandidates: foundMilestones.length
  });

  if (debugMode && foundMilestones.length > 1) {
    logger.info("📊 Other milestone candidates", {
      alternatives: foundMilestones.slice(1, 5).map(m => ({
        number: m.milestone.number,
        confidence: m.confidence,
        pattern: m.pattern
      }))
    });
  }

  return bestMatch.milestone;
}

/**
 * Debug function to test milestone patterns against a given text.
 */
export function testMilestonePatterns(text: string): Array<{ pattern: string; matches: string[] }> {
  const patterns = [
    { name: 'full_url', regex: /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/milestone\/(\d+)/gi },
    { name: 'relative_url', regex: /\/([^\/]+)\/([^\/]+)\/milestone\/(\d+)/gi },
    { name: 'simple_hash', regex: /milestone\s*#?(\d+)/gi },
    { name: 'with_colon', regex: /milestone:\s*#?(\d+)/gi },
    { name: 'spaced', regex: /milestone\s+(\d+)/gi },
    { name: 'markdown_link', regex: /\[.*?\]\(.*?milestone\/(\d+).*?\)/gi },
    { name: 'created_notification', regex: /created milestone.*?#(\d+)/gi },
    { name: 'assigned_notification', regex: /assigned to milestone.*?#(\d+)/gi }
  ];

  const results = [];
  
  for (const pattern of patterns) {
    const matches = [];
    let match;
    
    while ((match = pattern.regex.exec(text)) !== null) {
      matches.push(match[0]);
    }
    
    results.push({
      pattern: pattern.name,
      matches
    });
  }
  
  return results;
}

/**
 * Alternative milestone search that looks directly in repository milestones with enhanced typing.
 */
export async function findMilestonesByDate(
  octokit: Octokit,
  owner: string,
  repo: string,
  daysBack: number = 7
): Promise<GitHubMilestone[]> {
  try {
    logger.info("📅 Searching milestones by date", { daysBack });

    // Get all milestones with proper typing
    const { data: milestones }: { data: GitHubMilestone[] } = await octokit.issues.listMilestones({
      owner,
      repo,
      state: 'all',
      sort: 'due_on',
      direction: 'desc'
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const recentMilestones = milestones.filter((milestone: GitHubMilestone) => {
      const createdDate = new Date(milestone.created_at);
      return createdDate >= cutoffDate;
    });

    logger.info(`📊 Found ${recentMilestones.length} recent milestones (last ${daysBack} days)`);

    return recentMilestones;

  } catch (error) {
    logger.error("💥 Error searching milestones by date", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return [];
  }
}
