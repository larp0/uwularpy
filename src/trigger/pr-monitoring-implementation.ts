import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { 
  BOT_USERNAME, 
  REVIEW_COMMAND, 
  TITLE_SIMILARITY_THRESHOLD,
  checkRateLimit,
  validateInputLength,
  MAX_PR_TITLE_LENGTH,
  MAX_PR_PROCESSING_TIME
} from "./workflow-constants";

// Define interfaces for GitHub objects
interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  url: string;
  html_url: string;
  user: GitHubUser;
  labels: GitHubLabel[];
  created_at: string;
  updated_at: string;
}

interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  url: string;
  html_url: string;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  milestone: any;
  created_at: string;
  updated_at: string;
}

// Export the PR monitoring implementation function
export async function runPRMonitoringTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting PR monitoring task - checking for copilot assignment", { payload });
  const { owner, repo, issueNumber: prNumber, installationId } = payload;

  // Rate limiting for DoS protection
  const rateLimitKey = `pr-monitoring-${owner}-${repo}`;
  if (!checkRateLimit(rateLimitKey, 20)) { // Allow max 20 PR monitors per minute per repo
    logger.warn("PR monitoring rate limited", { owner, repo, prNumber });
    return { success: false, error: "Rate limit exceeded" };
  }

  // Set processing timeout
  const processingTimeout = setTimeout(() => {
    logger.error("PR monitoring timeout exceeded", { owner, repo, prNumber });
  }, MAX_PR_PROCESSING_TIME);

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);

    // Get the pull request details
    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    // Validate PR title length for security
    if (!validateInputLength(pullRequest.title, MAX_PR_TITLE_LENGTH, 'PR title')) {
      logger.warn("PR title validation failed", { prNumber, title: pullRequest.title });
      clearTimeout(processingTimeout);
      return { success: false, error: "PR title too long" };
    }

    // Check if this PR is related to a copilot-assigned issue
    const relatedIssue = await findRelatedCopilotIssue(octokit, owner, repo, pullRequest);
    
    if (!relatedIssue) {
      logger.info("PR not related to copilot-assigned issue, skipping monitoring", { 
        prNumber,
        prTitle: pullRequest.title
      });
      clearTimeout(processingTimeout);
      return { success: true, message: "PR not related to copilot workflow" };
    }

    // Post the "@l r" comment to trigger review
    await postReviewTriggerComment(octokit, owner, repo, prNumber);
    
    // Update the related issue with PR link
    await updateIssueWithPRLink(octokit, owner, repo, relatedIssue.number, pullRequest);
    
    logger.info("PR monitoring task completed - review triggered", { 
      prNumber,
      relatedIssueNumber: relatedIssue.number,
      prTitle: pullRequest.title
    });
    
    clearTimeout(processingTimeout);
    
    return { 
      success: true, 
      pullRequest: {
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url
      },
      relatedIssue: {
        number: relatedIssue.number,
        title: relatedIssue.title
      },
      phase: 'review_triggered'
    };
    
  } catch (error) {
    clearTimeout(processingTimeout);
    logger.error("Error in PR monitoring task", { error });
    
    // Don't post error comments for PR monitoring to avoid spam
    // Just log the error and continue
    
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}



// Find a related copilot-assigned issue for this PR
async function findRelatedCopilotIssue(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  pullRequest: any
): Promise<GitHubIssue | null> {
  try {
    // Strategy 1: Check if PR title/body mentions an issue number
    const issueNumberMatch = (pullRequest.title + ' ' + (pullRequest.body || '')).match(/#(\d+)/);
    if (issueNumberMatch) {
      const issueNumber = parseInt(issueNumberMatch[1], 10);
      
      try {
        const { data: issue } = await octokit.issues.get({
          owner,
          repo,
          issue_number: issueNumber
        });
        
        // Check if this issue has the copilot-assigned label
        if (issue.labels.some((label: any) => label.name === 'copilot-assigned')) {
          return issue as GitHubIssue;
        }
      } catch (error) {
        logger.warn("Referenced issue not found", { issueNumber });
      }
    }
    
    // Strategy 2: Look for open copilot-assigned issues and match by similarity  
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      labels: 'copilot-assigned',
      state: 'open',
      per_page: 20
    });
    
    // Find the most likely related issue using multiple heuristics
    if (issues.length > 0) {
      // Prefer issues that already have pr-created label (indicating a PR was previously linked)
      const issuesWithPR = issues.filter((issue: any) => 
        !issue.labels.some((label: any) => label.name === 'pr-created')
      );
      
      // If we have issues without PRs, use those first
      const candidateIssues = issuesWithPR.length > 0 ? issuesWithPR : issues;
      
      // Try to match by title similarity (simple word matching)
      const prTitleWords = pullRequest.title.toLowerCase().split(/\s+/).filter(word => word.length > 2);
      let bestMatch = null;
      let bestScore = 0;
      
      for (const issue of candidateIssues) {
        const issueWords = issue.title.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const commonWords = prTitleWords.filter(word => issueWords.includes(word));
        const score = commonWords.length / Math.max(prTitleWords.length, issueWords.length, 1);
        
        if (score > bestScore && score > TITLE_SIMILARITY_THRESHOLD) { // Minimum similarity threshold
          bestScore = score;
          bestMatch = issue;
        }
      }
      
      if (bestMatch) {
        logger.info("Found PR-issue match using title similarity", {
          prTitle: pullRequest.title,
          issueTitle: bestMatch.title,
          similarity: bestScore
        });
        return bestMatch as GitHubIssue;
      }
      
      // Fallback: return the most recently assigned issue (not oldest)
      const sortedIssues = candidateIssues.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      logger.warn("Using fallback heuristic for PR-issue matching", {
        prTitle: pullRequest.title,
        selectedIssue: sortedIssues[0].title
      });
      
      return sortedIssues[0] as GitHubIssue;
    }
    
    return null;
    
  } catch (error) {
    logger.error("Error finding related copilot issue", { error });
    return null;
  }
}

// Post "@l r" comment to trigger review
async function postReviewTriggerComment(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  prNumber: number
): Promise<void> {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: REVIEW_COMMAND
    });
    
    logger.info("Posted review trigger comment", { prNumber });
    
  } catch (error) {
    logger.error("Error posting review trigger comment", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      prNumber
    });
    throw error;
  }
}

// Update the related issue with PR link
async function updateIssueWithPRLink(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  pullRequest: any
): Promise<void> {
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `🔗 **Pull Request Created**

GitHub Copilot has created pull request [#${pullRequest.number}](${pullRequest.html_url}) for this issue.

**PR Title:** ${pullRequest.title}

**Workflow Status Update:**
- ✅ Issue assigned to GitHub Copilot
- ✅ Implementation completed and PR created
- ✅ Automated review triggered ("@l r" posted)
- ⏳ Review and approval process in progress
- ⏳ Merge and progression to next issue

I've automatically posted "@l r" in the PR to trigger the review process. The workflow will continue automatically based on the review outcome.`
    });
    
    // Add a label to indicate PR created
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels: ['pr-created']
    });
    
    logger.info("Updated issue with PR link", { 
      issueNumber,
      prNumber: pullRequest.number
    });
    
  } catch (error) {
    logger.error("Error updating issue with PR link", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber,
      prNumber: pullRequest.number
    });
    // Don't throw here to avoid failing the main task
  }
}
