import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubContext } from "../services/task-types";

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
  priority: 'critical' | 'high' | 'normal' | 'feature';
}

// Export the plan implementation function
export async function runPlanTask(payload: GitHubContext, ctx: any) {
  logger.log("Starting comprehensive repository plan task", { payload });
  const { owner, repo, issueNumber, installationId } = payload;

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);
    
    // Post an immediate reply comment
    await postReplyComment(octokit, owner, repo, issueNumber);
    logger.log("Posted initial reply comment");

    // Phase 1: Repository Ingestion
    logger.log("Phase 1: Starting repository ingestion");
    const repositoryContent = await ingestRepository(octokit, owner, repo);
    
    // Phase 2: Comprehensive Analysis
    logger.log("Phase 2: Starting comprehensive analysis");
    const analysis = await performComprehensiveAnalysis(repositoryContent);
    
    // Phase 3: Create GitHub Milestone
    logger.log("Phase 3: Creating GitHub milestone");
    const milestone = await createProjectMilestone(octokit, owner, repo, analysis);
    
    // Phase 4: Generate Issues
    logger.log("Phase 4: Generating GitHub issues");
    const issues = await generateIssuesFromAnalysis(analysis, milestone.number);
    
    // Phase 5: Create Issues and Validation
    logger.log("Phase 5: Creating issues and validation");
    const createdIssues = await createGitHubIssues(octokit, owner, repo, issues);
    
    // Post completion comment
    await postCompletionComment(octokit, owner, repo, issueNumber, milestone, createdIssues);
    
    logger.log("Plan task completed successfully", { 
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
    throw new Error("GitHub App credentials not found in environment variables");
  }

  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId: Number(appId), privateKey, installationId }
  });
}

// Post immediate reply comment
async function postReplyComment(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: "🤖 **Plan Generation Started**\n\nI'm analyzing your repository to create a comprehensive development plan. This will include:\n\n- 📊 Repository analysis\n- 🔍 Missing components identification\n- 🚨 Critical fixes needed\n- 💡 Innovation opportunities\n- 📋 Organized milestone with issues\n\nThis process may take a few minutes..."
  });
}

// Phase 1: Repository Ingestion
async function ingestRepository(octokit: Octokit, owner: string, repo: string): Promise<string> {
  logger.log("Ingesting repository contents");
  
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
        logger.log(`File ${fileName} not found, skipping`);
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

    logger.log("Repository ingestion completed", { 
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
  logger.log("Starting LLM-powered comprehensive analysis");
  
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
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
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content;

    if (!analysisText) {
      throw new Error("No analysis content received from OpenAI");
    }

    logger.log("Received analysis from OpenAI", { 
      contentLength: analysisText.length 
    });

    // Parse JSON response
    const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis: PlanAnalysis = JSON.parse(cleanedText);

    // Validate analysis structure
    if (!analysis.missingComponents || !analysis.criticalFixes || 
        !analysis.requiredImprovements || !analysis.innovationIdeas) {
      throw new Error("Invalid analysis structure received from LLM");
    }

    logger.log("Analysis parsing completed", {
      missingComponents: analysis.missingComponents.length,
      criticalFixes: analysis.criticalFixes.length,
      requiredImprovements: analysis.requiredImprovements.length,
      innovationIdeas: analysis.innovationIdeas.length
    });

    return analysis;

  } catch (error) {
    logger.error("Error during comprehensive analysis", { error });
    
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

    logger.log("Using fallback analysis due to LLM failure");
    return fallbackAnalysis;
  }
}

// Phase 3: Create GitHub Milestone
async function createProjectMilestone(octokit: Octokit, owner: string, repo: string, analysis: PlanAnalysis): Promise<any> {
  logger.log("Creating GitHub milestone");

  const currentDate = new Date();
  const dueDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const milestoneDescription = `# AI-Generated Development Plan - ${currentDate.toISOString().split('T')[0]}

## Repository Overview
${analysis.repositoryOverview}

## Critical Fixes (ASAP) 🚨
${analysis.criticalFixes.map((fix, index) => `${index + 1}. ${fix}`).join('\n')}

## Missing Components 📋
${analysis.missingComponents.map((component, index) => `${index + 1}. ${component}`).join('\n')}

## Required Improvements 🔧
${analysis.requiredImprovements.map((improvement, index) => `${index + 1}. ${improvement}`).join('\n')}

## Innovation Ideas 💡
${analysis.innovationIdeas.map((idea, index) => `${index + 1}. ${idea}`).join('\n')}

---
*This milestone was generated automatically by AI analysis. All items have been broken down into individual GitHub issues for tracking and implementation.*`;

  try {
    const { data: milestone } = await octokit.issues.createMilestone({
      owner,
      repo,
      title: `AI Development Plan - ${currentDate.toISOString().split('T')[0]}`,
      description: milestoneDescription,
      due_on: dueDate.toISOString()
    });

    logger.log("Milestone created successfully", { milestoneId: milestone.id });
    return milestone;

  } catch (error) {
    logger.error("Error creating milestone", { error });
    throw new Error(`Milestone creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Phase 4: Generate Issues from Analysis
function generateIssuesFromAnalysis(analysis: PlanAnalysis, milestoneNumber: number): IssueTemplate[] {
  logger.log("Generating issues from analysis");

  const issues: IssueTemplate[] = [];

  // Generate critical fix issues
  analysis.criticalFixes.forEach((fix, index) => {
    issues.push({
      title: `[CRITICAL] ${fix.slice(0, 60)}${fix.length > 60 ? '...' : ''}`,
      body: `## 🚨 Critical Fix Required

**Description:** ${fix}

## Priority
This is a **critical issue** that requires immediate attention.

## Implementation Guidance
- Assess the current state and identify the root cause
- Research best practices for addressing this type of issue
- Implement the fix with proper testing
- Document the solution for future reference

## Validation Criteria
- [ ] Issue has been thoroughly investigated
- [ ] Solution implemented and tested
- [ ] No regression issues introduced
- [ ] Documentation updated if necessary

## Related
Part of AI Development Plan Milestone #${milestoneNumber}`,
      labels: ['critical', 'bug', 'security'],
      priority: 'critical'
    });
  });

  // Generate missing component issues
  analysis.missingComponents.forEach((component, index) => {
    issues.push({
      title: `[MISSING] ${component.slice(0, 60)}${component.length > 60 ? '...' : ''}`,
      body: `## 📋 Missing Component

**Description:** ${component}

## Implementation Guidance
- Research existing solutions and best practices
- Design the component architecture
- Implement with proper integration
- Add comprehensive testing
- Update documentation

## Validation Criteria
- [ ] Component successfully implemented
- [ ] Integration tests passing
- [ ] Documentation complete
- [ ] Code review completed

## Related
Part of AI Development Plan Milestone #${milestoneNumber}`,
      labels: ['enhancement', 'missing-feature'],
      priority: 'high'
    });
  });

  // Generate improvement issues
  analysis.requiredImprovements.forEach((improvement, index) => {
    issues.push({
      title: `[IMPROVEMENT] ${improvement.slice(0, 60)}${improvement.length > 60 ? '...' : ''}`,
      body: `## 🔧 Code Improvement

**Description:** ${improvement}

## Implementation Guidance
- Analyze current implementation
- Identify specific areas for improvement
- Implement incremental changes
- Ensure backward compatibility
- Add or update tests as needed

## Validation Criteria
- [ ] Current state analyzed and documented
- [ ] Improvements implemented
- [ ] Tests updated and passing
- [ ] Performance impact assessed

## Related
Part of AI Development Plan Milestone #${milestoneNumber}`,
      labels: ['improvement', 'technical-debt'],
      priority: 'normal'
    });
  });

  // Generate innovation idea issues
  analysis.innovationIdeas.forEach((idea, index) => {
    issues.push({
      title: `[FEATURE] ${idea.slice(0, 60)}${idea.length > 60 ? '...' : ''}`,
      body: `## 💡 Innovation Feature

**Description:** ${idea}

## Implementation Guidance
- Research market and user needs
- Design user experience and technical architecture
- Create development roadmap
- Implement MVP version
- Gather feedback and iterate

## Validation Criteria
- [ ] Feature requirements defined
- [ ] Technical design completed
- [ ] MVP implementation finished
- [ ] User feedback collected
- [ ] Documentation and tests complete

## Related
Part of AI Development Plan Milestone #${milestoneNumber}`,
      labels: ['feature', 'innovation', 'enhancement'],
      priority: 'feature'
    });
  });

  logger.log("Issue generation completed", { 
    totalIssues: issues.length,
    criticalIssues: issues.filter(i => i.priority === 'critical').length,
    featureIssues: issues.filter(i => i.priority === 'feature').length
  });

  return issues;
}

// Phase 5: Create GitHub Issues
async function createGitHubIssues(octokit: Octokit, owner: string, repo: string, issues: IssueTemplate[]): Promise<any[]> {
  logger.log("Creating GitHub issues", { count: issues.length });

  const createdIssues = [];
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

      createdIssues.push(issue);
      logger.log(`Created issue ${i + 1}/${issuesToCreate.length}`, { 
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

  logger.log("Issue creation completed", { 
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
  milestone: any,
  createdIssues: any[]
): Promise<void> {
  
  const priorityDistribution = {
    critical: createdIssues.filter(issue => issue.labels.some((label: any) => label.name === 'critical')).length,
    high: createdIssues.filter(issue => issue.labels.some((label: any) => label.name === 'missing-feature')).length,
    normal: createdIssues.filter(issue => issue.labels.some((label: any) => label.name === 'improvement')).length,
    feature: createdIssues.filter(issue => issue.labels.some((label: any) => label.name === 'innovation')).length
  };

  const completionComment = `## ✅ Development Plan Generated Successfully!

I've completed a comprehensive analysis of your repository and created a structured development plan.

### 📊 Plan Summary

| Type | Count | Priority Distribution |
|------|-------|-----------------------|
| **Milestones** | 1 | N/A |
| **Issues** | ${createdIssues.length} | Critical: ${priorityDistribution.critical} • High: ${priorityDistribution.high} • Normal: ${priorityDistribution.normal} • Feature: ${priorityDistribution.feature} |

### 🎯 Created Resources

**Milestone:** [${milestone.title}](${milestone.html_url})
- Due date: ${new Date(milestone.due_on).toLocaleDateString()}
- Contains the complete diagnostic report

**Issues Created:**
${createdIssues.slice(0, 10).map(issue => `- [#${issue.number}](${issue.html_url}) ${issue.title}`).join('\n')}
${createdIssues.length > 10 ? `\n...and ${createdIssues.length - 10} more issues` : ''}

### 🚀 Next Steps

1. **Review the milestone** to understand the complete analysis
2. **Prioritize critical issues** (marked with 🚨) for immediate attention
3. **Assign team members** to specific issues based on expertise
4. **Break down large issues** into smaller tasks if needed
5. **Track progress** using the milestone view

The plan is designed to be comprehensive yet actionable. Each issue includes implementation guidance and validation criteria to help your development process.

---
*Generated by @uwularpy AI Development Planning System*`;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: completionComment
  });

  logger.log("Posted completion comment");
}