import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { BOT_USERNAME } from "./workflow-constants";
import { findMostRecentMilestoneEnhanced, findMilestonesByDate } from "../lib/milestone-finder";
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

    // Find the most recent milestone using enhanced search with fallbacks
    let milestone = await findMostRecentMilestone(octokit, owner, repo, issueNumber);
    
    // If standard search fails, try enhanced search with broader parameters
    if (!milestone) {
      logger.info("Standard milestone search failed, trying enhanced search");
      milestone = await findMostRecentMilestoneEnhanced(octokit, owner, repo, issueNumber, {
        includeAllUsers: true, // Search all users, not just bot
        debugMode: true, // Enable detailed logging
        searchDepth: 500 // Increase search depth
      });
    }
    
    // If still no milestone found, try date-based search as last resort
    if (!milestone) {
      logger.info("Enhanced search failed, trying date-based search");
      const recentMilestones = await findMilestonesByDate(octokit, owner, repo, 14); // Last 14 days
      if (recentMilestones.length > 0) {
        milestone = recentMilestones[0]; // Use most recent
        if (milestone) {
          logger.info("Found milestone using date-based search", { 
            milestoneNumber: milestone.number,
            title: milestone.title 
          });
        }
      }
    }
    
    if (!milestone) {
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: "❌ **No Recent Milestone Found**\n\nI couldn't find a recent milestone to approve after trying multiple search methods:\n- Comment-based search\n- Enhanced pattern matching\n- Date-based milestone search\n\nPlease run `@l plan` first to create a milestone, or ensure the milestone reference is clearly visible in recent comments."
      });
      return { success: false, error: "No milestone found after comprehensive search" };
    }

    // Search for mermaid diagrams in the thread
    const mermaidDiagrams = await findMermaidDiagrams(octokit, owner, repo, issueNumber);
    
    // Add mermaid diagram information to the response
    if (mermaidDiagrams.length > 0) {
      logger.info(`Found ${mermaidDiagrams.length} mermaid diagrams in the thread - will reference them in the approval`);
    }

    // Parse milestone description to extract analysis
    const analysis = parseMilestoneDescription(milestone.description || '');
    
    // Generate basic issues from the milestone analysis
    const basicIssues = generateIssuesFromAnalysis(analysis, milestone.number);
    
    // Validate milestone number before creating issues
    if (!milestone.number || milestone.number <= 0) {
      logger.error("Invalid milestone number", { milestoneNumber: milestone.number });
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: "❌ **Invalid Milestone**\n\nThe milestone found has an invalid number. Please try creating a new plan."
      });
      return { success: false, error: "Invalid milestone number" };
    }

    // Extract repository context for better enhancement suggestions
    const repositoryContext = await extractRepositoryContext(octokit, owner, repo, analysis);

    // Enhance issues with detailed implementation guidance using GPT-4.1-nano
    logger.info("Enhancing issues with detailed implementation guidance", { 
      issueCount: basicIssues.length 
    });
    
    const issues = await enhanceIssueDetails(basicIssues, repositoryContext);

    logger.info("Creating enhanced issues for milestone", { 
      milestoneNumber: milestone.number, 
      milestoneTitle: milestone.title,
      issueCount: issues.length 
    });
    
    // Create issues and link them to the milestone
    const createdIssues = await createGitHubIssues(octokit, owner, repo, issues, milestone.number);
    
    // Verify all issues are properly attached to the milestone
    const attachmentResults = await verifyMilestoneAttachments(octokit, owner, repo, createdIssues, milestone.number);
    
    logger.info("Milestone attachment verification completed", {
      totalIssues: createdIssues.length,
      successfulAttachments: attachmentResults.successful,
      failedAttachments: attachmentResults.failed
    });
    
    // Attempt to fix failed attachments
    let finalAttachmentResults = attachmentResults;
    if (attachmentResults.failed > 0) {
      logger.info("Attempting to fix failed milestone attachments");
      const fixedCount = await retryMilestoneAttachments(octokit, owner, repo, attachmentResults.failures, milestone.number);
      
      // Update results
      finalAttachmentResults = {
        successful: attachmentResults.successful + fixedCount,
        failed: attachmentResults.failed - fixedCount,
        failures: attachmentResults.failures.slice(fixedCount) // Remove fixed issues
      };
      
      logger.info("Milestone attachment retry completed", {
        originalFailed: attachmentResults.failed,
        fixed: fixedCount,
        remainingFailed: finalAttachmentResults.failed
      });
    }
    
    // Post task overview and ask for confirmation, including mermaid diagram info
    await postTaskOverviewAndConfirmation(octokit, owner, repo, issueNumber, milestone, createdIssues, finalAttachmentResults, mermaidDiagrams);
    
    logger.info("Plan approval task completed", { 
      milestoneId: milestone.id,
      issuesCreated: createdIssues.length,
      mermaidDiagramsFound: mermaidDiagrams.length
    });
    
    return { 
      success: true, 
      milestone: milestone,
      issuesCreated: createdIssues.length,
      mermaidDiagramsFound: mermaidDiagrams.length,
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
    logger.info("Searching for milestone in recent comments", { issueNumber });
    
    // Get recent comments to find milestone URL (increased to 200 for long threads)
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 200,
      sort: 'created',
      direction: 'desc'
    });
    
    logger.info(`Found ${comments.length} comments to search`, { issueNumber });
    
    // Track all milestones found and their creation times
    const foundMilestones: Array<{ milestone: GitHubMilestone; commentCreatedAt: string }> = [];
    
    // Look for milestone URL in recent comments with improved patterns
    for (const comment of comments) {
      if (comment.body) {
        logger.debug(`Checking comment from ${comment.user.login}`, { 
          commentId: comment.id,
          createdAt: comment.created_at,
          bodyLength: comment.body.length 
        });
        
        // Extract milestone URL with multiple patterns
        const milestoneUrlPatterns = [
          /https:\/\/github\.com\/[^\/]+\/[^\/]+\/milestone\/(\d+)/g,
          /\/milestone\/(\d+)/g,
          /milestone(?:\s+#?)?(\d+)/ig
        ];
        
        for (const pattern of milestoneUrlPatterns) {
          let match;
          while ((match = pattern.exec(comment.body)) !== null) {
            const milestoneNumber = parseInt(match[1], 10);
            
            if (milestoneNumber && milestoneNumber > 0) {
              try {
                logger.info(`Found milestone reference #${milestoneNumber} in comment`, { 
                  commentId: comment.id 
                });
                
                // Get the milestone details
                const { data: milestone } = await octokit.issues.getMilestone({
                  owner,
                  repo,
                  milestone_number: milestoneNumber
                });
                
                foundMilestones.push({
                  milestone: milestone as GitHubMilestone,
                  commentCreatedAt: comment.created_at
                });
                
                logger.info(`Successfully retrieved milestone #${milestoneNumber}`, {
                  title: milestone.title,
                  state: milestone.state,
                  createdAt: milestone.created_at
                });
                
              } catch (milestoneError) {
                logger.warn(`Failed to retrieve milestone #${milestoneNumber}`, { 
                  error: milestoneError instanceof Error ? milestoneError.message : 'Unknown error'
                });
              }
            }
          }
        }
      }
    }
    
    if (foundMilestones.length === 0) {
      logger.warn("No milestone URLs found in recent comments", { 
        commentsSearched: comments.length,
        botComments: comments.filter(c => c.user?.login === BOT_USERNAME).length
      });
      return null;
    }
    
    // Sort by comment creation time (most recent first) and return the most recent
    foundMilestones.sort((a, b) => 
      new Date(b.commentCreatedAt).getTime() - new Date(a.commentCreatedAt).getTime()
    );
    
    const mostRecentMilestone = foundMilestones[0].milestone;
    logger.info("Selected most recent milestone", {
      milestoneNumber: mostRecentMilestone.number,
      title: mostRecentMilestone.title,
      totalFound: foundMilestones.length
    });
    
    return mostRecentMilestone;
    
  } catch (error) {
    logger.error("Error finding recent milestone", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber 
    });
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

// Find and extract mermaid diagrams from thread comments
async function findMermaidDiagrams(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<string[]> {
  try {
    logger.info("Searching for mermaid diagrams in thread", { issueNumber });
    
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 200,
      sort: 'created',
      direction: 'desc'
    });
    
    const mermaidDiagrams: string[] = [];
    
    for (const comment of comments) {
      if (comment.body) {
        // Find mermaid code blocks
        const mermaidPattern = /```mermaid\s*\n([\s\S]*?)\n```/gi;
        let match;
        
        while ((match = mermaidPattern.exec(comment.body)) !== null) {
          const diagramContent = match[1].trim();
          if (diagramContent) {
            mermaidDiagrams.push(diagramContent);
            logger.info(`Found mermaid diagram in comment ${comment.id}`, {
              diagramLength: diagramContent.length,
              author: comment.user?.login
            });
          }
        }
      }
    }
    
    logger.info(`Found ${mermaidDiagrams.length} mermaid diagrams in thread`);
    return mermaidDiagrams;
    
  } catch (error) {
    logger.error("Error searching for mermaid diagrams", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber 
    });
    return [];
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

/**
 * Enhances issue bodies with detailed implementation guidance using GPT-4.1-nano
 * @param issues Array of basic issue templates to enhance
 * @param repositoryContext Context about the repository for better suggestions
 * @returns Enhanced issues with detailed, actionable bodies
 */
async function enhanceIssueDetails(
  issues: IssueTemplate[],
  repositoryContext: string = ''
): Promise<IssueTemplate[]> {
  logger.info("Enhancing issue bodies with GPT-4.1-nano", { issueCount: issues.length });

  const enhancedIssues: IssueTemplate[] = [];

  // Process issues in batches to manage API calls efficiently
  const BATCH_SIZE = 3;
  const BATCH_DELAY_MS = 1000;

  for (let i = 0; i < issues.length; i += BATCH_SIZE) {
    const batch = issues.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (issue, batchIndex) => {
      const issueIndex = i + batchIndex;
      
      try {
        logger.info(`Enhancing issue ${issueIndex + 1}/${issues.length}`, { title: issue.title });
        
        const enhancedBody = await enhanceIssueBody(issue, repositoryContext);
        
        return {
          ...issue,
          body: enhancedBody
        };
        
      } catch (error) {
        logger.error(`Failed to enhance issue ${issueIndex + 1}, using original`, { 
          title: issue.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Return original issue if enhancement fails
        return issue;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    enhancedIssues.push(...batchResults);

    // Add delay between batches
    if (i + BATCH_SIZE < issues.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  logger.info("Issue enhancement completed", { 
    originalCount: issues.length,
    enhancedCount: enhancedIssues.length
  });

  return enhancedIssues;
}

/**
 * Enhances a single issue body using GPT-4.1-nano
 * @param issue The issue template to enhance
 * @param repositoryContext Additional context about the repository
 * @returns Enhanced issue body with detailed implementation guidance
 */
async function enhanceIssueBody(
  issue: IssueTemplate,
  repositoryContext: string
): Promise<string> {
  const systemPrompt = `You are a senior software engineer and technical writer creating detailed, actionable GitHub issue descriptions. Your task is to enhance basic issue descriptions with comprehensive implementation guidance.

Transform the basic issue into a professional, detailed GitHub issue that includes:

1. **Clear Problem Statement** - What exactly needs to be done and why
2. **Technical Context** - Background information and current state
3. **Detailed Implementation Steps** - Step-by-step breakdown of the work
4. **Technical Specifications** - Specific requirements, APIs, patterns to follow
5. **Acceptance Criteria** - Clear, testable conditions for completion
6. **Testing Requirements** - What testing is needed
7. **Documentation Needs** - What docs should be updated
8. **Potential Challenges** - Known risks or complex areas
9. **Resources & References** - Helpful links, docs, or examples

Format using proper Markdown with clear sections, code blocks where relevant, and checkbox lists for actionable items.

Keep the tone unhinged and nerdy but approachable and motivating, be humble yet inspire for impossible. Make it detailed enough that any competent developer could pick up the issue and implement it successfully.`;

  const userPrompt = `Enhance this GitHub issue for better implementation:

**Issue Title:** ${issue.title}
**Priority:** ${issue.priority}
**Labels:** ${issue.labels.join(', ')}

**Current Description:**
${issue.body}

**Repository Context:**
${repositoryContext || 'General software development project'}

Please transform this into a comprehensive, actionable GitHub issue with detailed implementation guidance.`;

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: 31500,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const enhancedContent = data.choices?.[0]?.message?.content;

      if (!enhancedContent) {
        throw new Error("No content received from OpenAI");
      }

      logger.info("Successfully enhanced issue body", { 
        originalLength: issue.body.length,
        enhancedLength: enhancedContent.length,
        title: issue.title
      });

      return enhancedContent;
      
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    logger.error("Failed to enhance issue body with GPT-4.1-nano", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      title: issue.title
    });
    
    // Return original body if enhancement fails
    return issue.body;
  }
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
        logger.info(`Creating issue ${issueIndex + 1}/${issues.length} with milestone ${milestoneNumber}`, {
          title: issueTemplate.title,
          milestone: milestoneNumber
        });

        const { data: issue } = await octokit.issues.create({
          owner,
          repo,
          title: issueTemplate.title,
          body: issueTemplate.body,
          labels: issueTemplate.labels,
          milestone: milestoneNumber
        });

        // Verify milestone attachment immediately after creation
        if (issue.milestone?.number !== milestoneNumber) {
          logger.warn(`Milestone attachment failed during creation`, {
            expected: milestoneNumber,
            actual: issue.milestone?.number,
            issueNumber: issue.number
          });
          
          // Attempt immediate fix
          try {
            await octokit.issues.update({
              owner,
              repo,
              issue_number: issue.number,
              milestone: milestoneNumber
            });
            
            // Re-fetch to verify fix
            const { data: fixedIssue } = await octokit.issues.get({
              owner,
              repo,
              issue_number: issue.number
            });
            
            if (fixedIssue.milestone?.number === milestoneNumber) {
              logger.info(`✅ Fixed milestone attachment immediately for issue #${issue.number}`);
              // Update the issue object with fixed milestone
              issue.milestone = fixedIssue.milestone;
            } else {
              logger.error(`❌ Failed to fix milestone attachment for issue #${issue.number}`);
            }
          } catch (fixError) {
            logger.error(`Error attempting immediate milestone fix for issue #${issue.number}`, { fixError });
          }
        } else {
          logger.info(`✅ Issue ${issue.number} successfully attached to milestone ${milestoneNumber}`);
        }

        logger.info(`Created issue ${issueIndex + 1}/${issues.length}`, { 
          issueNumber: issue.number, 
          title: issue.title,
          milestone: milestoneNumber,
          attachedMilestone: issue.milestone?.number
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

/**
 * Verifies that all created issues are properly attached to the milestone
 * @param octokit GitHub API client
 * @param owner Repository owner
 * @param repo Repository name
 * @param issues Created issues to verify
 * @param expectedMilestoneNumber Expected milestone number
 * @returns Object with successful and failed attachment counts
 */
async function verifyMilestoneAttachments(
  octokit: Octokit,
  owner: string,
  repo: string,
  issues: GitHubIssue[],
  expectedMilestoneNumber: number
): Promise<{ successful: number; failed: number; failures: Array<{ issueNumber: number; title: string }> }> {
  logger.info("Verifying milestone attachments", { 
    issueCount: issues.length, 
    expectedMilestone: expectedMilestoneNumber 
  });

  let successful = 0;
  let failed = 0;
  const failures: Array<{ issueNumber: number; title: string }> = [];

  for (const issue of issues) {
    try {
      // Re-fetch the issue to get current milestone state
      const { data: currentIssue } = await octokit.issues.get({
        owner,
        repo,
        issue_number: issue.number
      });

      if (currentIssue.milestone?.number === expectedMilestoneNumber) {
        successful++;
        logger.debug(`✅ Issue #${issue.number} correctly attached to milestone ${expectedMilestoneNumber}`);
      } else {
        failed++;
        failures.push({ issueNumber: issue.number, title: issue.title });
        logger.warn(`❌ Issue #${issue.number} not attached to milestone ${expectedMilestoneNumber}`, {
          currentMilestone: currentIssue.milestone?.number,
          expectedMilestone: expectedMilestoneNumber
        });
      }
    } catch (error) {
      failed++;
      failures.push({ issueNumber: issue.number, title: issue.title });
      logger.error(`Error verifying issue #${issue.number}`, { error });
    }
  }

  return { successful, failed, failures };
}

/**
 * Attempts to fix milestone attachment for issues that failed
 * @param octokit GitHub API client
 * @param owner Repository owner
 * @param repo Repository name
 * @param failedIssues Issues that failed milestone attachment
 * @param milestoneNumber Target milestone number
 * @returns Number of successfully fixed attachments
 */
async function retryMilestoneAttachments(
  octokit: Octokit,
  owner: string,
  repo: string,
  failedIssues: Array<{ issueNumber: number; title: string }>,
  milestoneNumber: number
): Promise<number> {
  logger.info("Attempting to fix milestone attachments", { 
    failedCount: failedIssues.length, 
    targetMilestone: milestoneNumber 
  });

  let fixed = 0;
  
  for (const failedIssue of failedIssues) {
    try {
      // Update the issue to attach it to the milestone
      await octokit.issues.update({
        owner,
        repo,
        issue_number: failedIssue.issueNumber,
        milestone: milestoneNumber
      });
      
      // Verify the fix worked
      const { data: updatedIssue } = await octokit.issues.get({
        owner,
        repo,
        issue_number: failedIssue.issueNumber
      });
      
      if (updatedIssue.milestone?.number === milestoneNumber) {
        fixed++;
        logger.info(`✅ Fixed milestone attachment for issue #${failedIssue.issueNumber}`);
      } else {
        logger.warn(`❌ Failed to fix milestone attachment for issue #${failedIssue.issueNumber}`);
      }
    } catch (error) {
      logger.error(`Error fixing milestone attachment for issue #${failedIssue.issueNumber}`, { error });
    }
  }
  
  return fixed;
}

// Extracts repository context for better enhancement suggestions
async function extractRepositoryContext(
  octokit: Octokit,
  owner: string,
  repo: string,
  analysis: PlanAnalysis
): Promise<string> {
  try {
    logger.info("Extracting repository context for enhancement");

    // Get repository information
    const { data: repository } = await octokit.repos.get({
      owner,
      repo
    });

    // Get package.json to understand the tech stack
    let packageJsonContent = '';
    try {
      const { data: packageJson } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'package.json'
      });
      
      if ('content' in packageJson) {
        const content = Buffer.from(packageJson.content, 'base64').toString('utf8');
        const parsed = JSON.parse(content);
        packageJsonContent = `
**Tech Stack:**
- Framework/Runtime: ${parsed.dependencies ? Object.keys(parsed.dependencies).slice(0, 5).join(', ') : 'Unknown'}
- Dev Dependencies: ${parsed.devDependencies ? Object.keys(parsed.devDependencies).slice(0, 3).join(', ') : 'None'}
- Scripts: ${parsed.scripts ? Object.keys(parsed.scripts).join(', ') : 'None'}`;
      }
    } catch (error) {
      logger.debug("Could not fetch package.json", { error });
    }

    // Get README.md for project overview
    let readmeContent = '';
    try {
      const { data: readme } = await octokit.repos.getContent({
        owner,
        repo,
        path: 'README.md'
      });
      
      if ('content' in readme) {
        const content = Buffer.from(readme.content, 'base64').toString('utf8');
        // Extract first few paragraphs for context
        const firstParagraphs = content.split('\n').slice(0, 10).join('\n');
        readmeContent = `
**Project Overview:**
${firstParagraphs.slice(0, 500)}${firstParagraphs.length > 500 ? '...' : ''}`;
      }
    } catch (error) {
      logger.debug("Could not fetch README.md", { error });
    }

    // Get recent commits to understand development patterns
    let recentActivity = '';
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 5
      });
      
      const commitMessages = commits.map(commit => commit.commit.message).join(', ');
      recentActivity = `
**Recent Development:**
- Repository: ${repository.full_name}
- Language: ${repository.language || 'Unknown'}
- Recent commits: ${commitMessages.slice(0, 200)}${commitMessages.length > 200 ? '...' : ''}`;
    } catch (error) {
      logger.debug("Could not fetch recent commits", { error });
    }

    const context = `
**Repository Context for ${owner}/${repo}:**
${repository.description ? `- Description: ${repository.description}` : ''}
- Primary Language: ${repository.language || 'Unknown'}
- Repository Size: ${repository.size} KB
- Open Issues: ${repository.open_issues_count}
${packageJsonContent}
${readmeContent}
${recentActivity}

**Plan Analysis Context:**
- Repository Overview: ${analysis.repositoryOverview}
- Focus Areas: ${[...analysis.missingComponents, ...analysis.criticalFixes].slice(0, 3).join(', ')}
    `.trim();

    logger.info("Repository context extracted successfully", { 
      contextLength: context.length,
      hasPackageJson: packageJsonContent.length > 0,
      hasReadme: readmeContent.length > 0
    });

    return context;

  } catch (error) {
    logger.warn("Failed to extract repository context, using minimal context", { error });
    
    // Return minimal context on failure
    return `
**Repository Context:**
- Repository: ${owner}/${repo}
- Focus Areas: ${analysis.repositoryOverview}
    `.trim();
  }
}

// Post task overview and ask for confirmation
async function postTaskOverviewAndConfirmation(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  milestone: GitHubMilestone,
  createdIssues: GitHubIssue[],
  attachmentResults?: { successful: number; failed: number; failures: Array<{ issueNumber: number; title: string }> },
  mermaidDiagrams?: string[]
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

  // Build milestone attachment status message
  let attachmentStatus = '';
  if (attachmentResults) {
    if (attachmentResults.failed > 0) {
      attachmentStatus = `\n\n⚠️ **Milestone Attachment Warning:** ${attachmentResults.failed} out of ${createdIssues.length} issues may not be properly linked to the milestone. This could affect project tracking.`;
      if (attachmentResults.failures.length > 0) {
        attachmentStatus += `\n\nIssues with attachment issues:\n${attachmentResults.failures.map(f => `- #${f.issueNumber}: ${f.title}`).join('\n')}`;
      }
    } else {
      attachmentStatus = `\n\n✅ **All ${attachmentResults.successful} issues successfully linked to milestone.**`;
    }
  }

  // Build mermaid diagram status message
  let mermaidStatus = '';
  if (mermaidDiagrams && mermaidDiagrams.length > 0) {
    mermaidStatus = `\n\n📊 **Mermaid Diagrams Found:** I found ${mermaidDiagrams.length} mermaid diagram(s) in this thread. These will be considered in the implementation guidance.`;
  }

  const overviewComment = `## ✅ Issues Created Successfully!

I've decomposed the milestone into ${createdIssues.length} actionable GitHub issues and linked them to the milestone.${attachmentStatus}${mermaidStatus}

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
