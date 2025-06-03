import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import {
  CRITICAL_ISSUE_TEMPLATE,
  MISSING_COMPONENT_TEMPLATE,
  IMPROVEMENT_TEMPLATE,
  FEATURE_TEMPLATE,
  MILESTONE_DESCRIPTION_TEMPLATE,
  COMPLETION_COMMENT_TEMPLATE,
  INITIAL_REPLY_TEMPLATE,
  MILESTONE_CREATED_TEMPLATE
} from "../templates/issue-templates";

// Define interfaces for GitHub objects to improve type safety
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

// Define constants for configuration
const MAX_ISSUES_DEFAULT = 20;
const MAX_CONTENT_LENGTH = 8000; // Prevent token limit issues
const OPENAI_TIMEOUT_MS = 120000; // 2 minutes
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// Configuration interface for better maintainability
interface PlanConfig {
  maxIssues: number;
  maxContentLength: number;
  openaiTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

// Get configuration with fallbacks
function getPlanConfig(): PlanConfig {
  return {
    maxIssues: parseInt(process.env.PLAN_MAX_ISSUES || MAX_ISSUES_DEFAULT.toString(), 10),
    maxContentLength: parseInt(process.env.PLAN_MAX_CONTENT_LENGTH || MAX_CONTENT_LENGTH.toString(), 10),
    openaiTimeout: parseInt(process.env.OPENAI_TIMEOUT_MS || OPENAI_TIMEOUT_MS.toString(), 10),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || RETRY_ATTEMPTS.toString(), 10),
    retryDelay: parseInt(process.env.RETRY_DELAY_MS || RETRY_DELAY_MS.toString(), 10)
  };
}

/**
 * Utility function for retrying operations with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number,
  baseDelay: number,
  context: string
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt === maxAttempts) {
        logger.error(`${context} failed after ${maxAttempts} attempts`, {
          error: lastError.message,
          attempts: maxAttempts
        });
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      logger.warn(`${context} attempt ${attempt} failed, retrying in ${delay}ms`, {
        error: lastError.message,
        attempt,
        maxAttempts,
        nextDelay: delay
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error(`${context} failed after all attempts`);
}

/**
 * Truncate content to prevent token limit issues
 */
function truncateContent(content: string, maxLength: number): string {
  if (!content || typeof content !== 'string') return '';
  
  if (content.length <= maxLength) return content;
  
  const truncated = content.slice(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');
  
  // Try to break at a natural line boundary
  if (lastNewline > maxLength * 0.8) {
    return truncated.slice(0, lastNewline) + '\n\n... (content truncated to prevent token limits)';
  }
  
  return truncated + '\n\n... (content truncated to prevent token limits)';
}

// Define constants for labels and priorities to prevent typos
export const ISSUE_LABELS = {
  CRITICAL: 'critical',
  BUG: 'bug',
  SECURITY: 'security',
  ENHANCEMENT: 'enhancement',
  MISSING_FEATURE: 'missing-feature',
  IMPROVEMENT: 'improvement',
  TECHNICAL_DEBT: 'technical-debt',
  FEATURE: 'feature',
  INNOVATION: 'innovation'
} as const;

export const ISSUE_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  NORMAL: 'normal',
  FEATURE: 'feature'
} as const;

// Define interfaces for the plan structure
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

// Export the plan implementation function
export async function runPlanTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting repository plan task - creating milestone only", { payload });
  const { owner, repo, issueNumber, installationId } = payload;

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);
    
    // Post an immediate reply comment
    await postReplyComment(octokit, owner, repo, issueNumber);
    logger.info("Posted initial reply comment");

    // Phase 1: Repository Ingestion
    logger.info("Phase 1: Starting repository ingestion");
    const repositoryContent = await ingestRepository(octokit, owner, repo);
    
    // Phase 2: Comprehensive Analysis
    logger.info("Phase 2: Starting comprehensive analysis");
    const analysis = await performComprehensiveAnalysis(repositoryContent);
    
    // Phase 3: Create GitHub Milestone ONLY
    logger.info("Phase 3: Creating GitHub milestone");
    const milestone = await createProjectMilestone(octokit, owner, repo, analysis);
    
    // Post milestone URL as response (sole response per requirements)
    await postMilestoneUrlComment(octokit, owner, repo, issueNumber, milestone);
    
    logger.info("Plan task completed - milestone created", { 
      milestoneId: milestone.id,
      milestoneUrl: milestone.html_url
    });
    
    return { 
      success: true, 
      milestone: milestone,
      phase: 'milestone_created'
    };
    
  } catch (error) {
    logger.error("Error in plan task", { error });
    
    // Try to post error comment
    try {
      const octokit = await createAuthenticatedOctokit(installationId);
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `❌ **Plan Generation Failed**\n\nSorry, I encountered an error while generating the development plan:\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``
      });
    } catch (commentError) {
      logger.error("Failed to post error comment", { commentError });
    }
    
    throw error;
  }
}

// Create authenticated Octokit instance with enhanced security validation
// Post immediate reply comment
async function postReplyComment(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: INITIAL_REPLY_TEMPLATE()
  });
}

// Phase 1: Repository Ingestion with improved performance and error handling
async function ingestRepository(octokit: Octokit, owner: string, repo: string): Promise<string> {
  logger.info("Ingesting repository contents");
  
  const config = getPlanConfig();
  
  try {
    // Parallelize initial API calls for better performance
    const [repoData, languages, commits] = await Promise.all([
      retryWithBackoff(
        () => octokit.repos.get({ owner, repo }),
        config.retryAttempts,
        config.retryDelay,
        "Repository metadata fetch"
      ),
      retryWithBackoff(
        () => octokit.repos.listLanguages({ owner, repo }),
        config.retryAttempts,
        config.retryDelay,
        "Languages fetch"
      ),
      retryWithBackoff(
        () => octokit.repos.listCommits({ owner, repo, per_page: 10 }),
        config.retryAttempts,
        config.retryDelay,
        "Recent commits fetch"
      )
    ]);
    
    // Get the commit SHA of the default branch for tree access
    const { data: defaultBranchData } = await retryWithBackoff(
      () => octokit.repos.getBranch({
        owner,
        repo,
        branch: repoData.data.default_branch
      }),
      config.retryAttempts,
      config.retryDelay,
      "Default branch commit fetch"
    );
    
    // Get repository structure using recursive tree with proper commit SHA
    const { data: tree } = await retryWithBackoff(
      () => octokit.git.getTree({
        owner,
        repo,
        tree_sha: defaultBranchData.commit.sha,
        recursive: 'true'
      }),
      config.retryAttempts,
      config.retryDelay,
      "Repository tree fetch"
    );
    
    // Get key files content in parallel (limited to prevent rate limiting)
    const keyFiles = ['README.md', 'package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'setup.py'];
    const fileContents: { [key: string]: string } = {};
    
    // Process files in batches to avoid overwhelming the API
    const BATCH_SIZE = 3;
    for (let i = 0; i < keyFiles.length; i += BATCH_SIZE) {
      const batch = keyFiles.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (fileName) => {
        try {
          const { data: fileData } = await retryWithBackoff(
            () => octokit.repos.getContent({ owner, repo, path: fileName }),
            2, // Fewer retries for individual files
            config.retryDelay,
            `File fetch: ${fileName}`
          );
          
          if ('content' in fileData && fileData.content) {
            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            return { fileName, content };
          }
          return null;
        } catch (error) {
          logger.warn(`File ${fileName} not found or inaccessible, skipping`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          return null;
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(result => {
        if (result) {
          fileContents[result.fileName] = result.content;
        }
      });
      
      // Small delay between batches to be respectful of rate limits
      if (i + BATCH_SIZE < keyFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Build comprehensive repository summary with content truncation
    const repoSummary = buildRepositorySummary(
      repoData.data,
      tree.tree,
      languages.data,
      commits.data,
      fileContents,
      config.maxContentLength
    );
    
    logger.info("Repository ingestion completed", { 
      summaryLength: repoSummary.length,
      filesAnalyzed: tree.tree.length,
      keyFilesFound: Object.keys(fileContents).length
    });
    
    return repoSummary;
    
  } catch (error) {
    logger.error("Error during repository ingestion", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      owner,
      repo
    });
    throw new Error(`Repository ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper function to build repository summary with content management
function buildRepositorySummary(
  repoData: any,
  treeItems: any[],
  languages: any,
  commits: any[],
  fileContents: { [key: string]: string },
  maxContentLength: number
): string {
  const summary = `
# Repository Analysis for ${repoData.owner.login}/${repoData.name}

## Repository Metadata
- **Name**: ${repoData.name}
- **Description**: ${repoData.description || 'No description'}
- **Primary Language**: ${repoData.language || 'Unknown'}
- **Stars**: ${repoData.stargazers_count}
- **Forks**: ${repoData.forks_count}
- **Open Issues**: ${repoData.open_issues_count}
- **Default Branch**: ${repoData.default_branch}
- **Created**: ${repoData.created_at}
- **Last Updated**: ${repoData.updated_at}

## Languages Distribution
${Object.entries(languages).map(([lang, bytes]) => `- ${lang}: ${bytes} bytes`).join('\n')}

## Repository Structure (${treeItems.length} files total)
${treeItems
  .filter((item: any) => item.type === 'tree') // Only directories
  .slice(0, 20) // Limit to prevent overwhelming LLM
  .map((item: any) => `- 📁 ${item.path}`)
  .join('\n')}

### Key Files Found:
${treeItems
  .filter((item: any) => item.type === 'blob' && (
    item.path!.endsWith('.md') ||
    item.path!.endsWith('.json') ||
    item.path!.endsWith('.yml') ||
    item.path!.endsWith('.yaml') ||
    item.path!.includes('config') ||
    item.path!.includes('README') ||
    item.path!.includes('LICENSE')
  ))
  .slice(0, 30)
  .map((item: any) => `- 📄 ${item.path}`)
  .join('\n')}

## Key File Contents

${Object.entries(fileContents).map(([fileName, content]) => `
### ${fileName}
\`\`\`
${truncateContent(content, Math.floor(maxContentLength / Object.keys(fileContents).length))}
\`\`\`
`).join('\n')}

## Recent Commits
${commits.map((commit: any) => `- ${commit.sha.slice(0, 7)}: ${commit.commit.message.split('\n')[0]} (${commit.commit.author?.name})`).join('\n')}
`;

  return truncateContent(summary, maxContentLength);
}

// Phase 2: Comprehensive Analysis using LLM with enhanced security and reliability
async function performComprehensiveAnalysis(repositoryContent: string): Promise<PlanAnalysis> {
  logger.info("Starting LLM-powered comprehensive analysis");
  
  const config = getPlanConfig();
  
  const systemPrompt = `You are an expert software architect and project manager. Analyze the provided repository and generate a comprehensive development plan.

Your analysis should identify:
1. Missing Components - What essential features, files, or infrastructure is missing
2. Critical Fixes - Security issues, bugs, broken functionality that needs immediate attention (ASAP)
3. Required Improvements - Technical debt, code quality, performance, maintainability issues
4. Innovation Ideas - 5 creative feature enhancements that would add significant value

Be specific, actionable, and prioritize based on impact and urgency. Each item should be detailed enough to become a GitHub issue.

Return your analysis in the following JSON format:
{
  "repositoryOverview": "Brief 2-3 sentence summary of what this project does and its current state",
  "missingComponents": ["Specific missing component 1", "Specific missing component 2", ...],
  "criticalFixes": ["Critical issue that needs immediate attention", "Another urgent fix", ...],
  "requiredImprovements": ["Technical debt item 1", "Code quality improvement", ...],
  "innovationIdeas": ["Innovative feature idea 1", "Creative enhancement 2", ...]
}

Make each item specific and actionable. Include context about why each item is important.`;

  // Truncate repository content to prevent token limits
  const truncatedContent = truncateContent(repositoryContent, config.maxContentLength);
  const userPrompt = `Analyze this repository:\n\n${truncatedContent}`;

  try {
    // Validate OpenAI API key without logging it
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || typeof openaiApiKey !== 'string') {
      logger.error("OpenAI API key not found or invalid in environment variables");
      throw new Error("OpenAI API key not configured");
    }

    // Perform OpenAI API call with retries
    const analysisText = await retryWithBackoff(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.openaiTimeout);

        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openaiApiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "gpt-4",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
              ],
              max_tokens: 2000,
              temperature: 0.7
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error response');
            
            // Log error without exposing sensitive information
            logger.error("OpenAI API request failed", { 
              status: response.status, 
              statusText: response.statusText,
              hasErrorText: !!errorText,
              // Don't log the actual error text as it might contain sensitive info
              contentLength: userPrompt.length
            });
            
            if (response.status === 429) {
              throw new Error("Rate limit exceeded - will retry");
            } else if (response.status >= 500) {
              throw new Error("Server error - will retry");
            } else {
              throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }
          }

          const data = await response.json();
          const content = data.choices?.[0]?.message?.content;

          if (!content) {
            logger.error("No analysis content received from OpenAI", { 
              hasChoices: !!data.choices,
              choicesLength: data.choices?.length || 0
            });
            throw new Error("No analysis content received from OpenAI");
          }

          return content;
          
        } finally {
          clearTimeout(timeoutId);
        }
      },
      config.retryAttempts,
      config.retryDelay,
      "OpenAI API call"
    );

    logger.info("Received analysis from OpenAI", { 
      contentLength: analysisText.length,
      modelUsed: "gpt-4"
    });

    // Parse JSON response with error handling
    let analysis: PlanAnalysis;
    try {
      const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysis = JSON.parse(cleanedText);
    } catch (parseError) {
      logger.error("Failed to parse OpenAI response as JSON", {
        parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        responseLength: analysisText.length
      });
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate analysis structure
    const requiredFields = ['missingComponents', 'criticalFixes', 'requiredImprovements', 'innovationIdeas'];
    const missingFields = requiredFields.filter(field => !analysis[field as keyof PlanAnalysis]);
    
    if (missingFields.length > 0) {
      logger.error("Invalid analysis structure received from LLM", {
        missingFields,
        hasRepositoryOverview: !!analysis.repositoryOverview
      });
      throw new Error(`Invalid analysis structure: missing fields ${missingFields.join(', ')}`);
    }

    // Validate that fields are arrays
    requiredFields.forEach(field => {
      if (!Array.isArray(analysis[field as keyof PlanAnalysis])) {
        throw new Error(`Field ${field} must be an array`);
      }
    });

    logger.info("Analysis parsing completed successfully", {
      missingComponents: analysis.missingComponents.length,
      criticalFixes: analysis.criticalFixes.length,
      requiredImprovements: analysis.requiredImprovements.length,
      innovationIdeas: analysis.innovationIdeas.length
    });

    return analysis;

  } catch (error) {
    logger.error("Error during comprehensive analysis", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : typeof error
    });
    
    // Enhanced fallback analysis
    const fallbackAnalysis: PlanAnalysis = {
      repositoryOverview: "Analysis temporarily unavailable due to LLM service issues. Using fallback assessment - this repository appears to be an active project that would benefit from systematic improvements and comprehensive review.",
      missingComponents: [
        "Comprehensive documentation and setup instructions",
        "Automated testing infrastructure and CI/CD pipeline",
        "Security scanning and vulnerability assessment tools",
        "Code quality metrics and linting configuration",
        "Dependency management and update automation"
      ],
      criticalFixes: [
        "Review and update dependencies for security vulnerabilities",
        "Implement comprehensive error handling and logging throughout codebase",
        "Add proper input validation and sanitization for all user inputs",
        "Establish backup and recovery procedures for critical data",
        "Audit authentication and authorization mechanisms"
      ],
      requiredImprovements: [
        "Code organization and modularization for better maintainability",
        "Performance optimization and profiling implementation",
        "Comprehensive code documentation and inline commenting",
        "Consistent coding standards and automated linting setup",
        "Database optimization and query performance tuning"
      ],
      innovationIdeas: [
        "Implement advanced monitoring and analytics dashboard with real-time metrics",
        "Add machine learning capabilities for predictive features and user behavior analysis",
        "Create comprehensive API integration capabilities for third-party services",
        "Develop mobile companion application for enhanced user experience",
        "Add real-time collaboration features with live updates and notifications"
      ]
    };

    logger.warn("Using enhanced fallback analysis due to LLM failure", {
      fallbackItemsCount: {
        missingComponents: fallbackAnalysis.missingComponents.length,
        criticalFixes: fallbackAnalysis.criticalFixes.length,
        requiredImprovements: fallbackAnalysis.requiredImprovements.length,
        innovationIdeas: fallbackAnalysis.innovationIdeas.length
      }
    });
    
    return fallbackAnalysis;
  }
}

// Phase 3: Create GitHub Milestone
async function createProjectMilestone(octokit: Octokit, owner: string, repo: string, analysis: PlanAnalysis): Promise<GitHubMilestone> {
  logger.info("Creating GitHub milestone");

  const currentDate = new Date();
  const dueDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const milestoneDescription = MILESTONE_DESCRIPTION_TEMPLATE(analysis, currentDate);

  try {
    const { data: milestone } = await octokit.issues.createMilestone({
      owner,
      repo,
      title: `AI Development Plan - ${currentDate.toISOString().split('T')[0]}`,
      description: milestoneDescription,
      due_on: dueDate.toISOString()
    });

    logger.info("Milestone created successfully", { milestoneId: milestone.id });
    return milestone as GitHubMilestone;

  } catch (error) {
    logger.error("Error creating milestone", { error });
    throw new Error(`Milestone creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Phase 4: Generate Issues from Analysis
function generateIssuesFromAnalysis(analysis: PlanAnalysis, milestoneNumber: number): IssueTemplate[] {
  logger.info("Generating issues from analysis");

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

// Phase 5: Create GitHub Issues with enhanced rate limiting and error handling
async function createGitHubIssues(octokit: Octokit, owner: string, repo: string, issues: IssueTemplate[]): Promise<GitHubIssue[]> {
  const config = getPlanConfig();
  logger.info("Creating GitHub issues", { count: issues.length, maxIssues: config.maxIssues });

  const createdIssues: GitHubIssue[] = [];
  
  // Limit issues to prevent overwhelming the repository
  const issuesToCreate = issues.slice(0, config.maxIssues);
  
  if (issues.length > config.maxIssues) {
    logger.warn(`Limiting issues creation from ${issues.length} to ${config.maxIssues} to prevent repository overwhelming`);
  }

  // Process issues in batches to respect rate limits
  const BATCH_SIZE = 3;
  const BATCH_DELAY_MS = 2000; // 2 second delay between batches
  
  for (let i = 0; i < issuesToCreate.length; i += BATCH_SIZE) {
    const batch = issuesToCreate.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (issueTemplate, batchIndex) => {
      const issueIndex = i + batchIndex;
      
      try {
        const issueData = await retryWithBackoff(
          async () => {
            // Validate issue template before creation
            if (!issueTemplate.title || !issueTemplate.body) {
              throw new Error(`Invalid issue template at index ${issueIndex}: missing title or body`);
            }
            
            if (issueTemplate.title.length > 256) {
              logger.warn(`Issue title too long, truncating`, { 
                originalLength: issueTemplate.title.length,
                issueIndex 
              });
              issueTemplate.title = issueTemplate.title.slice(0, 253) + '...';
            }
            
            const { data: issue } = await octokit.issues.create({
              owner,
              repo,
              title: issueTemplate.title,
              body: issueTemplate.body,
              labels: issueTemplate.labels
            });
            
            return issue;
          },
          2, // Limited retries for individual issue creation
          1000,
          `Issue creation ${issueIndex + 1}`
        );

        logger.info(`Created issue ${issueIndex + 1}/${issuesToCreate.length}`, { 
          issueNumber: issueData.number, 
          title: issueData.title,
          labels: issueTemplate.labels
        });

        return issueData as GitHubIssue;

      } catch (error) {
        logger.error(`Error creating issue ${issueIndex + 1}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          issueTitle: issueTemplate.title,
          issueIndex
        });
        
        // Continue with other issues even if one fails
        return null;
      }
    });

    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Add successful creations to results
    batchResults.forEach(result => {
      if (result) {
        createdIssues.push(result);
      }
    });

    // Add delay between batches (except for the last batch)
    if (i + BATCH_SIZE < issuesToCreate.length) {
      logger.info(`Waiting ${BATCH_DELAY_MS}ms before next batch to respect rate limits`);
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  logger.info("Issue creation completed", { 
    requested: issuesToCreate.length,
    created: createdIssues.length,
    failed: issuesToCreate.length - createdIssues.length
  });

  return createdIssues;
}

// Post milestone URL comment (sole response per requirements)
async function postMilestoneUrlComment(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  milestone: GitHubMilestone
): Promise<void> {
  const milestoneUrl = milestone.html_url;
  
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: MILESTONE_CREATED_TEMPLATE(milestoneUrl)
  });

  logger.info("Posted milestone URL comment", { milestoneUrl });
}

// Post completion comment
async function postCompletionComment(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  milestone: GitHubMilestone,
  createdIssues: GitHubIssue[]
): Promise<void> {
  
  const priorityDistribution = {
    critical: createdIssues.filter(issue => issue.labels.some((label: GitHubLabel) => label.name === ISSUE_LABELS.CRITICAL)).length,
    high: createdIssues.filter(issue => issue.labels.some((label: GitHubLabel) => label.name === ISSUE_LABELS.MISSING_FEATURE)).length,
    normal: createdIssues.filter(issue => issue.labels.some((label: GitHubLabel) => label.name === ISSUE_LABELS.IMPROVEMENT)).length,
    feature: createdIssues.filter(issue => issue.labels.some((label: GitHubLabel) => label.name === ISSUE_LABELS.INNOVATION)).length
  };

  const completionComment = COMPLETION_COMMENT_TEMPLATE(milestone, createdIssues, priorityDistribution);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: completionComment
  });

  logger.info("Posted completion comment");
}
