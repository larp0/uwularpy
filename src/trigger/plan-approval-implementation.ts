import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { BOT_USERNAME } from "./workflow-constants";
import {
  CRITICAL_ISSUE_TEMPLATE,
  MISSING_COMPONENT_TEMPLATE,
  IMPROVEMENT_TEMPLATE,
  FEATURE_TEMPLATE,
  MILESTONE_DESCRIPTION_TEMPLATE,
  COMPLETION_COMMENT_TEMPLATE
} from "../templates/issue-templates";
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

interface PlanAnalysis {
  missingComponents: string[];
  criticalFixes: string[];
  requiredImprovements: string[];
  innovationIdeas: string[];
  repositoryOverview: string;
}

interface IssueTemplate {
  title: string;
  body: string;
  labels: string[];
  priority: typeof ISSUE_PRIORITIES[keyof typeof ISSUE_PRIORITIES];
}

// Export the plan approval implementation function
export async function runPlanApprovalTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting plan approval task - decomposing milestone into issues", { payload });
  const { owner, repo, issueNumber, installationId } = payload;

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);

    // Find the most recent milestone created by parsing recent comments
    const milestone = await findMostRecentMilestone(octokit, owner, repo, issueNumber);
    
    if (!milestone) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: "❌ **No Recent Milestone Found**\n\nI couldn't find a recent milestone to approve. Please run `@l plan` first to create a milestone."
      });
      return { success: false, error: "No milestone found" };
    }

    // Parse milestone description to extract analysis
    const analysis = parseMilestoneDescription(milestone.description || '');
    
    // Generate issues from the milestone analysis
    const issues = generateIssuesFromAnalysis(analysis, milestone.number);
    
    // Create issues and link them to the milestone
    const createdIssues = await createGitHubIssues(octokit, owner, repo, issues, milestone.number);
    
    // Post task overview and ask for confirmation
    await postTaskOverviewAndConfirmation(octokit, owner, repo, issueNumber, milestone, createdIssues);
    
    logger.info("Plan approval task completed", { 
      milestoneId: milestone.id,
      issuesCreated: createdIssues.length 
    });
    
    return { 
      success: true, 
      milestone: milestone,
      issuesCreated: createdIssues.length,
      phase: 'issues_created_awaiting_confirmation'
    };
    
  } catch (error) {
    logger.error("Error in plan approval task", { error });
    
    // Try to post error comment
    try {
      const octokit = await createAuthenticatedOctokit(installationId);
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `❌ **Plan Approval Failed**\n\nSorry, I encountered an error while processing your approval:\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``
      });
    } catch (commentError) {
      logger.error("Failed to post error comment", { commentError });
    }
    
    throw error;
  }
}

// Create authenticated Octokit instance
// Find the most recent milestone created by looking at recent comments
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

// Parse milestone description to extract analysis data
function parseMilestoneDescription(description: string): PlanAnalysis {
  logger.info("Parsing milestone description to extract analysis");
  
  // Default fallback analysis if parsing fails
  const fallbackAnalysis: PlanAnalysis = {
    repositoryOverview: "Repository analysis extracted from milestone",
    missingComponents: ["Extracted missing component from milestone"],
    criticalFixes: ["Extracted critical fix from milestone"],
    requiredImprovements: ["Extracted improvement from milestone"],
    innovationIdeas: ["Extracted innovation idea from milestone"]
  };
  
  try {
    // Extract sections from milestone description
    const analysis: PlanAnalysis = {
      repositoryOverview: extractSection(description, "Repository Overview") || fallbackAnalysis.repositoryOverview,
      missingComponents: extractListItems(description, "Missing Components") || fallbackAnalysis.missingComponents,
      criticalFixes: extractListItems(description, "Critical Fixes") || fallbackAnalysis.criticalFixes,
      requiredImprovements: extractListItems(description, "Required Improvements") || fallbackAnalysis.requiredImprovements,
      innovationIdeas: extractListItems(description, "Innovation Ideas") || fallbackAnalysis.innovationIdeas
    };
    
    logger.info("Successfully parsed milestone description", {
      missingComponents: analysis.missingComponents.length,
      criticalFixes: analysis.criticalFixes.length,
      requiredImprovements: analysis.requiredImprovements.length,
      innovationIdeas: analysis.innovationIdeas.length
    });
    
    return analysis;
    
  } catch (error) {
    logger.warn("Failed to parse milestone description, using fallback", { error });
    return fallbackAnalysis;
  }
}

// Extract a section from the milestone description
function extractSection(description: string, sectionName: string): string | null {
  const regex = new RegExp(`## ${sectionName}[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = description.match(regex);
  return match ? match[1].trim() : null;
}

// Extract list items from a section
function extractListItems(description: string, sectionName: string): string[] | null {
  const regex = new RegExp(`## ${sectionName}[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = description.match(regex);
  
  if (!match) return null;
  
  const section = match[1];
  const listItems = section
    .split('\n')
    .filter(line => line.trim().match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(item => item.length > 0);
    
  return listItems.length > 0 ? listItems : null;
}

// Generate issues from analysis (similar to plan-implementation.ts)
function generateIssuesFromAnalysis(analysis: PlanAnalysis, milestoneNumber: number): IssueTemplate[] {
  logger.info("Generating issues from milestone analysis");

  const issues: IssueTemplate[] = [];

  // Generate critical fix issues
  analysis.criticalFixes.forEach((fix, index) => {
    issues.push({
      title: `[CRITICAL] ${fix.slice(0, 60)}${fix.length > 60 ? '...' : ''}`,
      body: CRITICAL_ISSUE_TEMPLATE(fix, milestoneNumber),
      labels: [ISSUE_LABELS.CRITICAL, ISSUE_LABELS.BUG, ISSUE_LABELS.SECURITY],
      priority: ISSUE_PRIORITIES.CRITICAL
    });
  });

  // Generate missing component issues
  analysis.missingComponents.forEach((component, index) => {
    issues.push({
      title: `[MISSING] ${component.slice(0, 60)}${component.length > 60 ? '...' : ''}`,
      body: MISSING_COMPONENT_TEMPLATE(component, milestoneNumber),
      labels: [ISSUE_LABELS.ENHANCEMENT, ISSUE_LABELS.MISSING_FEATURE],
      priority: ISSUE_PRIORITIES.HIGH
    });
  });

  // Generate improvement issues
  analysis.requiredImprovements.forEach((improvement, index) => {
    issues.push({
      title: `[IMPROVEMENT] ${improvement.slice(0, 60)}${improvement.length > 60 ? '...' : ''}`,
      body: IMPROVEMENT_TEMPLATE(improvement, milestoneNumber),
      labels: [ISSUE_LABELS.IMPROVEMENT, ISSUE_LABELS.TECHNICAL_DEBT],
      priority: ISSUE_PRIORITIES.NORMAL
    });
  });

  // Generate innovation idea issues
  analysis.innovationIdeas.forEach((idea, index) => {
    issues.push({
      title: `[FEATURE] ${idea.slice(0, 60)}${idea.length > 60 ? '...' : ''}`,
      body: FEATURE_TEMPLATE(idea, milestoneNumber),
      labels: [ISSUE_LABELS.FEATURE, ISSUE_LABELS.INNOVATION, ISSUE_LABELS.ENHANCEMENT],
      priority: ISSUE_PRIORITIES.FEATURE
    });
  });

  logger.info("Issue generation completed", { 
    totalIssues: issues.length,
    criticalIssues: issues.filter(i => i.priority === ISSUE_PRIORITIES.CRITICAL).length,
    featureIssues: issues.filter(i => i.priority === ISSUE_PRIORITIES.FEATURE).length
  });

  return issues;
}

// Create GitHub Issues with milestone linking
async function createGitHubIssues(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issues: IssueTemplate[],
  milestoneNumber: number
): Promise<GitHubIssue[]> {
  logger.info("Creating GitHub issues linked to milestone", { count: issues.length, milestoneNumber });

  const createdIssues: GitHubIssue[] = [];
  
  // Process issues in batches to respect rate limits
  const BATCH_SIZE = 3;
  const BATCH_DELAY_MS = 2000;
  
  for (let i = 0; i < issues.length; i += BATCH_SIZE) {
    const batch = issues.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (issueTemplate, batchIndex) => {
      const issueIndex = i + batchIndex;
      
      try {
        const { data: issue } = await octokit.issues.create({
          owner,
          repo,
          title: issueTemplate.title,
          body: issueTemplate.body,
          labels: issueTemplate.labels,
          milestone: milestoneNumber
        });

        logger.info(`Created issue ${issueIndex + 1}/${issues.length}`, { 
          issueNumber: issue.number, 
          title: issue.title,
          milestone: milestoneNumber
        });

        return issue as GitHubIssue;

      } catch (error) {
        logger.error(`Error creating issue ${issueIndex + 1}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          issueTitle: issueTemplate.title
        });
        
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach(result => {
      if (result) {
        createdIssues.push(result);
      }
    });

    // Add delay between batches
    if (i + BATCH_SIZE < issues.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  logger.info("Issue creation completed", { 
    requested: issues.length,
    created: createdIssues.length,
    failed: issues.length - createdIssues.length
  });

  return createdIssues;
}

// Post task overview and ask for confirmation
async function postTaskOverviewAndConfirmation(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  milestone: GitHubMilestone,
  createdIssues: GitHubIssue[]
): Promise<void> {
  
  // Sort issues by priority for better presentation
  const sortedIssues = createdIssues.sort((a, b) => {
    const priorityOrder = { 'critical': 0, 'high': 1, 'normal': 2, 'feature': 3 };
    const aPriority = a.labels.some(l => l.name === ISSUE_LABELS.CRITICAL) ? 0 :
                     a.labels.some(l => l.name === ISSUE_LABELS.MISSING_FEATURE) ? 1 :
                     a.labels.some(l => l.name === ISSUE_LABELS.IMPROVEMENT) ? 2 : 3;
    const bPriority = b.labels.some(l => l.name === ISSUE_LABELS.CRITICAL) ? 0 :
                     b.labels.some(l => l.name === ISSUE_LABELS.MISSING_FEATURE) ? 1 :
                     b.labels.some(l => l.name === ISSUE_LABELS.IMPROVEMENT) ? 2 : 3;
    return aPriority - bPriority;
  });

  const overviewComment = `## ✅ Issues Created Successfully!

I've decomposed the milestone into ${createdIssues.length} actionable GitHub issues and linked them to the milestone.

### 📋 Task Overview (Execution Order)

${sortedIssues.map((issue, index) => {
  const priority = issue.labels.some(l => l.name === ISSUE_LABELS.CRITICAL) ? '🚨 CRITICAL' :
                   issue.labels.some(l => l.name === ISSUE_LABELS.MISSING_FEATURE) ? '⚡ HIGH' :
                   issue.labels.some(l => l.name === ISSUE_LABELS.IMPROVEMENT) ? '🔧 NORMAL' : '💡 FEATURE';
  return `${index + 1}. [#${issue.number}](${issue.html_url}) ${issue.title} (${priority})`;
}).join('\n')}

### 🎯 Execution Plan

Issues will be assigned to GitHub Copilot sequentially based on priority and dependencies. Each issue will go through:
1. **Assignment** to GitHub Copilot
2. **Implementation** and PR creation
3. **Automated review** (I'll post "@l r" to trigger review)
4. **Review iterations** as needed
5. **Approval and merge** when ready
6. **Progression** to the next issue

### 🚀 Ready to Start?

Reply with a positive confirmation (e.g., "y", "yes", "go", "lfg") to begin the automated workflow, or let me know if you'd like to modify anything first.`;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: overviewComment
  });

  logger.info("Posted task overview and confirmation request");
}
