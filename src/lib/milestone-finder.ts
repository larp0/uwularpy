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

/**
 * Enhanced milestone finding function with better pattern matching and debugging.
 */
export async function findMostRecentMilestoneEnhanced(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  options: MilestoneSearchOptions = {}
): Promise<any | null> {
  const {
    searchDepth = 200,
    includeAllUsers = false,
    debugMode = false
  } = options;

  try {
    logger.info("🔍 Enhanced milestone search starting", { 
      issueNumber, 
      searchDepth, 
      includeAllUsers,
      debugMode 
    });

    // Get recent comments
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: searchDepth,
      sort: 'created',
      direction: 'desc'
    });

    logger.info(`📝 Found ${comments.length} comments to search`);

    if (debugMode) {
      // Log comment authors for debugging
      const authors = comments.map(c => c.user?.login).filter(Boolean);
      const uniqueAuthors = Array.from(new Set(authors));
      logger.info("👥 Comment authors found:", { uniqueAuthors });
    }

    // Enhanced milestone patterns - more comprehensive
    const milestonePatterns = [
      // Full GitHub URLs
      /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/milestone\/(\d+)/gi,
      // Relative URLs
      /\/([^\/]+)\/([^\/]+)\/milestone\/(\d+)/gi,
      // Simple milestone references
      /milestone\s*#?(\d+)/gi,
      /milestone:\s*#?(\d+)/gi,
      /milestone\s+(\d+)/gi,
      // Markdown links with milestone URLs
      /\[.*?\]\(.*?milestone\/(\d+).*?\)/gi,
      // GitHub milestone notifications
      /created milestone.*?#(\d+)/gi,
      /assigned to milestone.*?#(\d+)/gi
    ];

    const foundMilestones: Array<{
      milestone: any;
      commentCreatedAt: string;
      foundIn: string;
      pattern: string;
    }> = [];

    // Search through comments
    for (const comment of comments) {
      const commentUser = comment.user?.login || 'unknown';
      const shouldSearchComment = includeAllUsers || 
        commentUser === 'l' || 
        commentUser === 'uwularpy' || 
        commentUser.includes('bot') ||
        commentUser.includes('copilot');

      if (shouldSearchComment && comment.body) {
        if (debugMode) {
          logger.info(`🔍 Searching comment from ${commentUser}`, {
            commentId: comment.id,
            bodyLength: comment.body.length,
            createdAt: comment.created_at
          });
        }

        // Try each pattern
        for (let i = 0; i < milestonePatterns.length; i++) {
          const pattern = milestonePatterns[i];
          const patternName = `pattern_${i + 1}`;
          
          let match;
          pattern.lastIndex = 0; // Reset regex
          
          while ((match = pattern.exec(comment.body)) !== null) {
            // Extract milestone number (always the last capture group)
            const milestoneNumber = parseInt(match[match.length - 1], 10);

            if (milestoneNumber && milestoneNumber > 0) {
              try {
                if (debugMode) {
                  logger.info(`🎯 Found milestone #${milestoneNumber} using ${patternName}`, {
                    match: match[0],
                    commentUser
                  });
                }

                // Get milestone details
                const { data: milestone } = await octokit.issues.getMilestone({
                  owner,
                  repo,
                  milestone_number: milestoneNumber
                });

                foundMilestones.push({
                  milestone,
                  commentCreatedAt: comment.created_at,
                  foundIn: commentUser,
                  pattern: patternName
                });

                logger.info(`✅ Successfully retrieved milestone #${milestoneNumber}`, {
                  title: milestone.title,
                  state: milestone.state,
                  pattern: patternName
                });

              } catch (milestoneError) {
                if (debugMode) {
                  logger.warn(`❌ Failed to retrieve milestone #${milestoneNumber}`, {
                    error: milestoneError instanceof Error ? milestoneError.message : 'Unknown error'
                  });
                }
              }
            }
          }
        }
      }
    }

    if (foundMilestones.length === 0) {
      logger.warn("❌ No milestones found", {
        commentsSearched: comments.length,
        searchedUsers: includeAllUsers ? 'all' : 'bot users only'
      });

      if (debugMode) {
        // Sample some comment content for debugging
        const sampleComments = comments.slice(0, 3).map(c => ({
          user: c.user?.login,
          bodyPreview: c.body?.substring(0, 200) + '...',
          createdAt: c.created_at
        }));
        logger.info("📋 Sample comments for debugging:", { sampleComments });
      }

      return null;
    }

    // Sort by comment creation time (most recent first)
    foundMilestones.sort((a, b) =>
      new Date(b.commentCreatedAt).getTime() - new Date(a.commentCreatedAt).getTime()
    );

    const mostRecent = foundMilestones[0];
    logger.info("🏆 Selected most recent milestone", {
      milestoneNumber: mostRecent.milestone.number,
      title: mostRecent.milestone.title,
      foundBy: mostRecent.pattern,
      foundIn: mostRecent.foundIn,
      totalFound: foundMilestones.length
    });

    return mostRecent.milestone;

  } catch (error) {
    logger.error("💥 Error in enhanced milestone search", {
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber
    });
    return null;
  }
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
 * Alternative milestone search that looks directly in repository milestones.
 */
export async function findMilestonesByDate(
  octokit: Octokit,
  owner: string,
  repo: string,
  daysBack: number = 7
): Promise<any[]> {
  try {
    logger.info("📅 Searching milestones by date", { daysBack });

    // Get all milestones
    const { data: milestones } = await octokit.issues.listMilestones({
      owner,
      repo,
      state: 'all',
      sort: 'due_on',
      direction: 'desc'
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const recentMilestones = milestones.filter(milestone => {
      const createdDate = new Date(milestone.created_at);
      return createdDate >= cutoffDate;
    });

    logger.info(`📊 Found ${recentMilestones.length} recent milestones (last ${daysBack} days)`);

    return recentMilestones;

  } catch (error) {
    logger.error("💥 Error searching milestones by date", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return [];
  }
}
