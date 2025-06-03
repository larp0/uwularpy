import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { COPILOT_USERNAME, TITLE_SIMILARITY_THRESHOLD } from "./workflow-constants";
import {
  ISSUE_LABELS,
  ISSUE_PRIORITIES
} from "./plan-implementation";

// Define interfaces for GitHub objects
interface GitHubMilestone {
  id: number;
  number: number;
  title: string;
  description: string | null;
  state: 'open' | 'closed';
  url: string;
  html_url: string;
  due_on: string | null;
  created_at: string;
  updated_at: string;
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
  milestone: GitHubMilestone | null;
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

// Export the PR merge progression implementation function
export async function runPRMergeProgressionTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting PR merge progression task - advancing to next issue", { payload });
  const { owner, repo, issueNumber: prNumber, installationId } = payload;

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);

    // Get the merged pull request details
    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    // Find the related issue that was completed
    const completedIssue = await findRelatedCopilotIssue(octokit, owner, repo, pullRequest);
    
    if (!completedIssue) {
      logger.info("PR not related to copilot workflow, skipping progression", { 
        prNumber,
        prTitle: pullRequest.title
      });
      return { success: true, message: "PR not related to copilot workflow" };
    }

    // Close the completed issue
    await closeCompletedIssue(octokit, owner, repo, completedIssue, pullRequest);
    
    // Find the next issue to assign
    const milestone = completedIssue.milestone;
    if (!milestone) {
      logger.warn("Completed issue has no milestone, cannot find next issue", {
        issueNumber: completedIssue.number
      });
      return { success: true, message: "No milestone found for progression" };
    }

    const nextIssue = await findNextIssueInMilestone(octokit, owner, repo, milestone.number);
    
    if (!nextIssue) {
      // All issues completed - milestone is done!
      await completeMilestone(octokit, owner, repo, milestone, completedIssue);
      
      return { 
        success: true, 
        milestone: milestone,
        completedIssue: completedIssue,
        phase: 'milestone_completed'
      };
    }

    // Assign the next issue to GitHub Copilot
    await assignIssueToCopilot(octokit, owner, repo, nextIssue);
    
    // Post progression update
    await postProgressionUpdate(octokit, owner, repo, completedIssue, nextIssue, milestone);
    
    logger.info("PR merge progression task completed - next issue assigned", { 
      prNumber,
      completedIssueNumber: completedIssue.number,
      nextIssueNumber: nextIssue.number,
      milestoneNumber: milestone.number
    });
    
    return { 
      success: true, 
      pullRequest: {
        number: pullRequest.number,
        title: pullRequest.title,
        url: pullRequest.html_url
      },
      completedIssue: {
        number: completedIssue.number,
        title: completedIssue.title
      },
      nextIssue: {
        number: nextIssue.number,
        title: nextIssue.title
      },
      milestone: milestone,
      phase: 'progressed_to_next_issue'
    };
    
  } catch (error) {
    logger.error("Error in PR merge progression task", { error });
    
    // Don't post error comments for PR progression to avoid spam
    // Just log the error and continue
    
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}



// Find a related copilot-assigned issue for this PR (similar to pr-monitoring)
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
    
    // Strategy 2: Look for open copilot-assigned issues with pr-created label
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      labels: 'copilot-assigned,pr-created',
      state: 'open',
      per_page: 20
    });
    
    // Find the most likely related issue using better heuristics
    if (issues.length > 0) {
      // Try to match by title similarity first
      const prTitleWords = pullRequest.title.toLowerCase().split(/\s+/).filter((word: string) => word.length > 2);
      let bestMatch = null;
      let bestScore = 0;
      
      for (const issue of issues) {
        const issueWords = issue.title.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        const commonWords = prTitleWords.filter((word: string) => issueWords.includes(word));
        const score = commonWords.length / Math.max(prTitleWords.length, issueWords.length, 1);
        
        if (score > bestScore && score > TITLE_SIMILARITY_THRESHOLD) { // Minimum similarity threshold
          bestScore = score;
          bestMatch = issue;
        }
      }
      
      if (bestMatch) {
        logger.info("Found PR-issue match using title similarity for merge progression", {
          prTitle: pullRequest.title,
          issueTitle: bestMatch.title,
          similarity: bestScore
        });
        return bestMatch as GitHubIssue;
      }
      
      // Fallback: return the most recently assigned issue (not oldest)
      const sortedIssues = issues.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      logger.warn("Using fallback heuristic for PR-issue merge progression matching", {
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

// Close the completed issue
async function closeCompletedIssue(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issue: GitHubIssue,
  pullRequest: any
): Promise<void> {
  try {
    // Add completion comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `✅ **Issue Completed Successfully!**

This issue has been completed and merged via PR [#${pullRequest.number}](${pullRequest.html_url}).

**Workflow Status:**
- ✅ Issue assigned to GitHub Copilot
- ✅ Implementation completed and PR created
- ✅ Automated review triggered and completed
- ✅ PR approved and merged
- ✅ Issue closed and marked as completed

Moving to the next issue in the milestone workflow...`
    });
    
    // Add completion labels
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issue.number,
      labels: ['completed', 'merged']
    });
    
    // Close the issue
    await octokit.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed'
    });
    
    logger.info("Closed completed issue", { 
      issueNumber: issue.number,
      prNumber: pullRequest.number
    });
    
  } catch (error) {
    logger.error("Error closing completed issue", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber: issue.number
    });
    throw error;
  }
}

// Find the next issue to assign in the milestone
async function findNextIssueInMilestone(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  milestoneNumber: number
): Promise<GitHubIssue | null> {
  try {
    // Get all open issues in the milestone
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      milestone: milestoneNumber.toString(),
      state: 'open',
      per_page: 100
    });
    
    // Filter for unassigned issues (no copilot-assigned label)
    const unassignedIssues = issues.filter((issue: any) => 
      !issue.labels.some((label: any) => label.name === 'copilot-assigned')
    );
    
    if (unassignedIssues.length === 0) {
      return null;
    }
    
    // Sort by priority and return the highest priority unassigned issue
    const sortedIssues = unassignedIssues.sort((a: any, b: any) => {
      const getPriority = (issue: any): number => {
        if (issue.labels.some((l: any) => l.name === ISSUE_LABELS.CRITICAL)) return 0;
        if (issue.labels.some((l: any) => l.name === ISSUE_LABELS.MISSING_FEATURE)) return 1;
        if (issue.labels.some((l: any) => l.name === ISSUE_LABELS.IMPROVEMENT)) return 2;
        return 3; // feature
      };
      
      const aPriority = getPriority(a);
      const bPriority = getPriority(b);
      
      if (aPriority === bPriority) {
        return a.number - b.number; // Creation order
      }
      
      return aPriority - bPriority;
    });
    
    return sortedIssues[0] as GitHubIssue;
    
  } catch (error) {
    logger.error("Error finding next issue in milestone", { error, milestoneNumber });
    return null;
  }
}

// Assign the next issue to GitHub Copilot
async function assignIssueToCopilot(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issue: GitHubIssue
): Promise<void> {
  try {
    // Add assignment comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `🤖 **Assigned to GitHub Copilot**

@${COPILOT_USERNAME} This issue has been automatically assigned to you as the next task in the AI development plan workflow.

Please implement the solution according to the requirements and create a pull request when ready.

**Workflow Status:** 
- ✅ Issue assigned
- ⏳ Awaiting implementation and PR creation
- ⏳ Automated review trigger ("@l r")
- ⏳ Review and approval process
- ⏳ Merge and progression to next issue

**Next Steps:**
1. Implement the required changes
2. Create a pull request
3. I will automatically post "@l r" to trigger the review process`
    });
    
    // Add the copilot-assigned label
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issue.number,
      labels: ['copilot-assigned']
    });
    
    logger.info("Assigned next issue to GitHub Copilot", { 
      issueNumber: issue.number,
      issueTitle: issue.title
    });
    
  } catch (error) {
    logger.error("Error assigning issue to Copilot", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber: issue.number
    });
    throw error;
  }
}

// Complete the milestone when all issues are done
async function completeMilestone(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  milestone: GitHubMilestone,
  lastCompletedIssue: GitHubIssue
): Promise<void> {
  try {
    // Post completion comment on the last issue
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: lastCompletedIssue.number,
      body: `🎉 **Milestone Completed Successfully!**

This was the final issue in milestone [${milestone.title}](${milestone.html_url}).

**🏆 Workflow Summary:**
All issues in this AI development plan have been successfully completed through the automated workflow:

1. ✅ Milestone created and analyzed
2. ✅ Issues decomposed and prioritized  
3. ✅ Sequential assignment to GitHub Copilot
4. ✅ Automated PR creation and review triggers
5. ✅ Review iterations and approvals
6. ✅ Merges and progression management
7. ✅ Complete milestone execution

The development plan has been fully implemented! 🚀`
    });
    
    // Close the milestone
    await octokit.issues.updateMilestone({
      owner,
      repo,
      milestone_number: milestone.number,
      state: 'closed'
    });
    
    logger.info("Completed milestone", { 
      milestoneNumber: milestone.number,
      milestoneTitle: milestone.title
    });
    
  } catch (error) {
    logger.error("Error completing milestone", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      milestoneNumber: milestone.number
    });
    // Don't throw here as this is not critical
  }
}

// Post progression update
async function postProgressionUpdate(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  completedIssue: GitHubIssue,
  nextIssue: GitHubIssue,
  milestone: GitHubMilestone
): Promise<void> {
  try {
    // Post update on the next issue
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: nextIssue.number,
      body: `🔄 **Workflow Progression Update**

Previous issue [#${completedIssue.number}](https://github.com/${owner}/${repo}/issues/${completedIssue.number}) has been completed and merged successfully.

**Milestone Progress:** [${milestone.title}](${milestone.html_url})
- ✅ Previous: ${completedIssue.title}
- 🎯 Current: ${nextIssue.title}

The automated workflow continues with this issue. Implementation and PR creation expected next.`
    });
    
    logger.info("Posted progression update", { 
      completedIssueNumber: completedIssue.number,
      nextIssueNumber: nextIssue.number
    });
    
  } catch (error) {
    logger.error("Error posting progression update", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      nextIssueNumber: nextIssue.number
    });
    // Don't throw here as this is not critical
  }
}
