import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubContext } from "../services/task-types";
import {
  CRITICAL_ISSUE_TEMPLATE,
  MISSING_COMPONENT_TEMPLATE,
  IMPROVEMENT_TEMPLATE,
  FEATURE_TEMPLATE,
  MILESTONE_DESCRIPTION_TEMPLATE,
  COMPLETION_COMMENT_TEMPLATE,
  INITIAL_REPLY_TEMPLATE
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
  logger.info("Starting comprehensive repository plan task", { payload });
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
    
    // Phase 3: Create GitHub Milestone
    logger.info("Phase 3: Creating GitHub milestone");
    const milestone = await createProjectMilestone(octokit, owner, repo, analysis);
    
    // Phase 4: Generate Issues
    logger.info("Phase 4: Generating GitHub issues");
    const issues = await generateIssuesFromAnalysis(analysis, milestone.number);
    
    // Phase 5: Create Issues and Validation
    logger.info("Phase 5: Creating issues and validation");
    const createdIssues = await createGitHubIssues(octokit, owner, repo, issues);
    
    // Post completion comment
    await postCompletionComment(octokit, owner, repo, issueNumber, milestone, createdIssues);
    
    logger.info("Plan task completed successfully", { 
      milestoneId: milestone.id,
      issuesCreated: createdIssues.length 
    });
    
    return { 
      success: true, 
      milestone: milestone,
      issuesCreated: createdIssues.length 
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

// Create authenticated Octokit instance
async function createAuthenticatedOctokit(installationId: number): Promise<Octokit> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!appId || !privateKey) {
    logger.error("GitHub App credentials missing", { 
      hasAppId: !!appId, 
      hasPrivateKey: !!privateKey 
    });
    throw new Error("GitHub App credentials not found in environment variables");
  }

  try {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: { 
        appId: Number(appId), 
        privateKey, 
        installationId 
      }
    });
  } catch (error) {
    logger.error("Failed to create authenticated Octokit instance", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      installationId 
    });
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Post immediate reply comment
async function postReplyComment(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: INITIAL_REPLY_TEMPLATE()
  });
}

// Phase 1: Repository Ingestion
async function ingestRepository(octokit: Octokit, owner: string, repo: string): Promise<string> {
  logger.info("Ingesting repository contents");
  
  try {
    // Get repository metadata
    const { data: repoData } = await octokit.repos.get({ owner, repo });
    
    // Get repository structure using recursive tree
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: repoData.default_branch,
      recursive: 'true'
    });
    
    // Get key files content (README, package.json, etc.)
    const keyFiles = ['README.md', 'package.json', 'requirements.txt', 'Cargo.toml', 'go.mod', 'setup.py'];
    const fileContents: { [key: string]: string } = {};
    
    for (const fileName of keyFiles) {
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner,
          repo,
          path: fileName
        });
        
        if ('content' in fileData && fileData.content) {
          fileContents[fileName] = Buffer.from(fileData.content, 'base64').toString('utf-8');
        }
      } catch (error) {
        // File doesn't exist, skip
        logger.warn(`File ${fileName} not found, skipping`);
      }
    }
    
    // Get recent commits for activity analysis
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 10
    });
    
    // Get languages
    const { data: languages } = await octokit.repos.listLanguages({ owner, repo });
    
    // Build comprehensive repository summary
    const repoSummary = `
# Repository Analysis for ${owner}/${repo}

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

## Repository Structure (${tree.tree.length} files total)
${tree.tree
  .filter(item => item.type === 'tree') // Only directories
  .slice(0, 20) // Limit to prevent overwhelming LLM
  .map(item => `- 📁 ${item.path}`)
  .join('\n')}

### Key Files Found:
${tree.tree
  .filter(item => item.type === 'blob' && (
    item.path!.endsWith('.md') ||
    item.path!.endsWith('.json') ||
    item.path!.endsWith('.yml') ||
    item.path!.endsWith('.yaml') ||
    item.path!.includes('config') ||
    item.path!.includes('README') ||
    item.path!.includes('LICENSE')
  ))
  .slice(0, 30)
  .map(item => `- 📄 ${item.path}`)
  .join('\n')}

## Key File Contents

${Object.entries(fileContents).map(([fileName, content]) => `
### ${fileName}
\`\`\`
${content.slice(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
`).join('\n')}

## Recent Commits
${commits.map(commit => `- ${commit.sha.slice(0, 7)}: ${commit.commit.message.split('\n')[0]} (${commit.commit.author?.name})`).join('\n')}
`;

    logger.info("Repository ingestion completed", { 
      summaryLength: repoSummary.length,
      filesAnalyzed: tree.tree.length,
      keyFilesFound: Object.keys(fileContents).length
    });
    
    return repoSummary;
    
  } catch (error) {
    logger.error("Error during repository ingestion", { error });
    throw new Error(`Repository ingestion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Phase 2: Comprehensive Analysis using LLM
async function performComprehensiveAnalysis(repositoryContent: string): Promise<PlanAnalysis> {
  logger.info("Starting LLM-powered comprehensive analysis");
  
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

  const userPrompt = `Analyze this repository:\n\n${repositoryContent}`;

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logger.error("OpenAI API key not found in environment variables");
      throw new Error("OpenAI API key not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

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
      logger.error("OpenAI API request failed", { 
        status: response.status, 
        statusText: response.statusText,
        hasErrorText: !!errorText
      });
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText = data.choices?.[0]?.message?.content;

    if (!analysisText) {
      logger.error("No analysis content received from OpenAI", { 
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length || 0
      });
      throw new Error("No analysis content received from OpenAI");
    }

    logger.info("Received analysis from OpenAI", { 
      contentLength: analysisText.length,
      modelUsed: "gpt-4"
    });

    // Parse JSON response
    const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis: PlanAnalysis = JSON.parse(cleanedText);

    // Validate analysis structure
    if (!analysis.missingComponents || !analysis.criticalFixes || 
        !analysis.requiredImprovements || !analysis.innovationIdeas) {
      logger.error("Invalid analysis structure received from LLM", {
        hasMissingComponents: !!analysis.missingComponents,
        hasCriticalFixes: !!analysis.criticalFixes,
        hasRequiredImprovements: !!analysis.requiredImprovements,
        hasInnovationIdeas: !!analysis.innovationIdeas
      });
      throw new Error("Invalid analysis structure received from LLM");
    }

    logger.info("Analysis parsing completed", {
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
    
    // Fallback analysis if LLM fails
    const fallbackAnalysis: PlanAnalysis = {
      repositoryOverview: "Repository analysis failed, but basic structure assessment indicates this is an active project that could benefit from systematic improvements.",
      missingComponents: [
        "Comprehensive documentation and setup instructions",
        "Automated testing infrastructure",
        "CI/CD pipeline configuration",
        "Security scanning and vulnerability assessment"
      ],
      criticalFixes: [
        "Review and update dependencies for security vulnerabilities",
        "Add error handling and logging throughout the codebase",
        "Implement proper input validation and sanitization",
        "Add backup and recovery procedures"
      ],
      requiredImprovements: [
        "Code organization and modularization",
        "Performance optimization and profiling",
        "Code documentation and commenting",
        "Consistent coding standards and linting"
      ],
      innovationIdeas: [
        "Implement advanced monitoring and analytics dashboard",
        "Add machine learning capabilities for predictive features",
        "Create API integration capabilities for third-party services",
        "Develop mobile companion application",
        "Add real-time collaboration features"
      ]
    };

    logger.warn("Using fallback analysis due to LLM failure", {
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

// Phase 5: Create GitHub Issues
async function createGitHubIssues(octokit: Octokit, owner: string, repo: string, issues: IssueTemplate[]): Promise<GitHubIssue[]> {
  logger.info("Creating GitHub issues", { count: issues.length });

  const createdIssues: GitHubIssue[] = [];
  const MAX_ISSUES = 20; // Limit to prevent overwhelming the repository

  const issuesToCreate = issues.slice(0, MAX_ISSUES);

  for (let i = 0; i < issuesToCreate.length; i++) {
    const issueTemplate = issuesToCreate[i];
    
    try {
      const { data: issue } = await octokit.issues.create({
        owner,
        repo,
        title: issueTemplate.title,
        body: issueTemplate.body,
        labels: issueTemplate.labels
      });

      createdIssues.push(issue as GitHubIssue);
      logger.info(`Created issue ${i + 1}/${issuesToCreate.length}`, { 
        issueNumber: issue.number, 
        title: issue.title 
      });

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      logger.error(`Error creating issue ${i + 1}`, { 
        error, 
        issueTitle: issueTemplate.title 
      });
      // Continue with other issues even if one fails
    }
  }

  logger.info("Issue creation completed", { 
    requested: issuesToCreate.length,
    created: createdIssues.length 
  });

  return createdIssues;
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