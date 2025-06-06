import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { 
  BOT_USERNAME, 
  COPILOT_USERNAME, 
  checkRateLimit,
  validateInputLength,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_WORKFLOW_EXECUTION_TIME
} from "./workflow-constants";
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

// Export the plan execution implementation function
export async function runPlanExecutionTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting plan execution task - initiating sequential workflow", { payload });
  const { owner, repo, issueNumber, installationId } = payload;

  // Input validation and rate limiting for DoS protection
  const rateLimitKey = `plan-execution-${owner}-${repo}`;
  if (!checkRateLimit(rateLimitKey, 10)) { // Allow max 10 plan executions per minute per repo
    logger.warn("Plan execution rate limited", { owner, repo });
    return { success: false, error: "Rate limit exceeded" };
  }

  // Set execution timeout
  const executionTimeout = setTimeout(() => {
    logger.error("Plan execution timeout exceeded", { owner, repo, issueNumber });
  }, MAX_WORKFLOW_EXECUTION_TIME);

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);

    // Find the milestone and its associated issues
    const milestone = await findMostRecentMilestone(octokit, owner, repo, issueNumber);
    
    if (!milestone) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: "❌ **No Milestone Found**\n\nI couldn't find a milestone to work with. Please run the plan workflow from the beginning."
      });
      return { success: false, error: "No milestone found" };
    }

    // Get all issues associated with this milestone
    const milestoneIssues = await getMilestoneIssues(octokit, owner, repo, milestone.number);
    
    if (milestoneIssues.length === 0) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: "❌ **No Issues Found**\n\nNo issues are associated with the milestone. Please run the approval step first."
      });
      return { success: false, error: "No milestone issues found" };
    }

    // Validate issue titles for security (prevent malicious content)
    for (const issue of milestoneIssues) {
      if (!validateInputLength(issue.title, MAX_ISSUE_TITLE_LENGTH, 'issue title')) {
        logger.warn("Issue title validation failed", { issueNumber: issue.number, title: issue.title });
        // Continue with other issues rather than failing entirely
      }
    }

    // Sort issues by priority for execution order
    const sortedIssues = sortIssuesByPriority(milestoneIssues);
    
    // Find the first unassigned issue to start with
    const nextIssue = findNextIssueToAssign(sortedIssues);
    
    if (!nextIssue) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: "✅ **All Issues Completed**\n\nAll issues in this milestone have been completed! The development plan has been fully executed."
      });
      return { success: true, message: "All issues completed" };
    }

    // Assign the issue to GitHub Copilot
    await assignIssueToCopilot(octokit, owner, repo, nextIssue);
    
    // Post workflow start comment
    await postWorkflowStartComment(octokit, owner, repo, issueNumber, milestone, nextIssue, sortedIssues);
    
    logger.info("Plan execution task completed - workflow started", { 
      milestoneId: milestone.id,
      nextIssueNumber: nextIssue.number,
      totalIssues: sortedIssues.length
    });
    
    // Clear the timeout on success
    clearTimeout(executionTimeout);
    
    return { 
      success: true, 
      milestone: milestone,
      currentIssue: nextIssue,
      totalIssues: sortedIssues.length,
      phase: 'workflow_started'
    };
    
  } catch (error) {
    // Clear the timeout on error
    clearTimeout(executionTimeout);
    
    logger.error("Error in plan execution task", { error });
    
    // Try to post error comment
    try {
      const octokit = await createAuthenticatedOctokit(installationId);
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `❌ **Plan Execution Failed**\n\nSorry, I encountered an error while starting the execution workflow:\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``
      });
    } catch (commentError) {
      logger.error("Failed to post error comment", { commentError });
    }
    
    throw error;
  }
}



// Find the most recent milestone (same logic as approval task)
async function findMostRecentMilestone(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number
): Promise<GitHubMilestone | null> {
  try {
    // Get recent comments to find milestone URL
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 20,
      sort: 'created',
      direction: 'desc'
    });
    
    // Look for milestone URL in recent comments
    for (const comment of comments) {
      if (comment.user?.login === BOT_USERNAME && comment.body) {
        // Extract milestone URL pattern
        const milestoneUrlMatch = comment.body.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/milestone\/(\d+)/);
        if (milestoneUrlMatch) {
          const milestoneNumber = parseInt(milestoneUrlMatch[1], 10);
          
          // Get the milestone details
          const { data: milestone } = await octokit.issues.getMilestone({
            owner,
            repo,
            milestone_number: milestoneNumber
          });
          
          return milestone as GitHubMilestone;
        }
      }
    }
    
    logger.warn("No milestone URL found in recent comments");
    return null;
    
  } catch (error) {
    logger.error("Error finding recent milestone", { error });
    return null;
  }
}

// Get all issues associated with a milestone
async function getMilestoneIssues(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  milestoneNumber: number
): Promise<GitHubIssue[]> {
  try {
    const { data: issues } = await octokit.issues.listForRepo({
      owner,
      repo,
      milestone: milestoneNumber.toString(),
      state: 'all',
      per_page: 100
    });
    
    return issues as GitHubIssue[];
    
  } catch (error) {
    logger.error("Error fetching milestone issues", { error, milestoneNumber });
    return [];
  }
}

// Sort issues by priority for execution order
function sortIssuesByPriority(issues: GitHubIssue[]): GitHubIssue[] {
  return issues.sort((a, b) => {
    // Priority order: critical -> high -> normal -> feature
    const getPriority = (issue: GitHubIssue): number => {
      if (issue.labels.some(l => l.name === ISSUE_LABELS.CRITICAL)) return 0;
      if (issue.labels.some(l => l.name === ISSUE_LABELS.MISSING_FEATURE)) return 1;
      if (issue.labels.some(l => l.name === ISSUE_LABELS.IMPROVEMENT)) return 2;
      return 3; // feature
    };
    
    const aPriority = getPriority(a);
    const bPriority = getPriority(b);
    
    // If same priority, sort by issue number (creation order)
    if (aPriority === bPriority) {
      return a.number - b.number;
    }
    
    return aPriority - bPriority;
  });
}

// Find the next issue to assign (first open, unassigned issue without copilot-assigned label)
function findNextIssueToAssign(sortedIssues: GitHubIssue[]): GitHubIssue | null {
  return sortedIssues.find(issue => 
    issue.state === 'open' && 
    issue.assignees.length === 0 &&
    !issue.labels.some(label => label.name === 'copilot-assigned')
  ) || null;
}

// Assign an issue to GitHub Copilot
async function assignIssueToCopilot(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issue: GitHubIssue
): Promise<void> {
  try {
    // Try to assign the issue to the "copilot" user if it exists
    let assignmentSuccess = false;
    try {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        assignees: [COPILOT_USERNAME]
      });
      assignmentSuccess = true;
      logger.info(`Successfully assigned issue to '${COPILOT_USERNAME}' user`, { 
        issueNumber: issue.number
      });
    } catch (assignError) {
      logger.warn(`Could not assign to '${COPILOT_USERNAME}' user, will use comment-based assignment`, { 
        error: assignError instanceof Error ? assignError.message : 'Unknown error',
        issueNumber: issue.number
      });
    }
    
    // Create comment to trigger Copilot's attention
    const assignmentMessage = assignmentSuccess 
      ? `🤖 **Assigned to GitHub Copilot**\n\n@${COPILOT_USERNAME} This issue has been automatically assigned to you as part of the AI development plan workflow.`
      : `🤖 **Assigned to GitHub Copilot**\n\n@${COPILOT_USERNAME} This issue has been automatically assigned to you as part of the AI development plan workflow.\n\n*Note: Could not assign you directly, but you are tagged here for notification.*`;
    
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `${assignmentMessage}

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
    
    // Add a label to indicate Copilot assignment
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issue.number,
      labels: ['copilot-assigned']
    });
    
    logger.info("Assigned issue to GitHub Copilot", { 
      issueNumber: issue.number,
      issueTitle: issue.title,
      directAssignment: assignmentSuccess
    });
    
  } catch (error) {
    logger.error("Error assigning issue to Copilot", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber: issue.number
    });
    throw error;
  }
}

// Post workflow start comment
async function postWorkflowStartComment(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  milestone: GitHubMilestone,
  currentIssue: GitHubIssue,
  allIssues: GitHubIssue[]
): Promise<void> {
  
  const currentIndex = allIssues.findIndex(issue => issue.number === currentIssue.number) + 1;
  
  const workflowComment = `## 🚀 Workflow Started!

I've initiated the automated development workflow for milestone [${milestone.title}](${milestone.html_url}).

### 📋 Current Status

**Currently Working On:**
[#${currentIssue.number}](${currentIssue.html_url}) ${currentIssue.title} (Issue ${currentIndex}/${allIssues.length})

### 🔄 Workflow Process

Each issue will go through these automated steps:
1. **✅ Assignment** - Issue assigned to GitHub Copilot
2. **⏳ Implementation** - Copilot implements the solution and creates PR
3. **⏳ Review Trigger** - I automatically post "@l r" in the PR
4. **⏳ Review Process** - Iterative review and improvements
5. **⏳ Approval & Merge** - Automatic approval and merge when ready
6. **⏳ Next Issue** - Automatic progression to next issue

### 📊 Remaining Issues Queue

${allIssues.slice(currentIndex).map((issue, index) => {
  const priority = issue.labels.some(l => l.name === ISSUE_LABELS.CRITICAL) ? '🚨' :
                   issue.labels.some(l => l.name === ISSUE_LABELS.MISSING_FEATURE) ? '⚡' :
                   issue.labels.some(l => l.name === ISSUE_LABELS.IMPROVEMENT) ? '🔧' : '💡';
  return `${currentIndex + index + 1}. [#${issue.number}](${issue.html_url}) ${issue.title} ${priority}`;
}).join('\n')}

### 🎯 Monitoring

I'll monitor pull request activity and automatically manage the workflow progression. You can track progress through:
- Individual issue status updates
- Pull request comments and reviews  
- Milestone completion tracking

The workflow will continue automatically until all issues are completed and merged.`;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: workflowComment
  });

  logger.info("Posted workflow start comment");
}
