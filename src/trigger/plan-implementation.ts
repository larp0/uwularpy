import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { 
  MAX_REPO_ANALYSIS_FILES,
  checkRateLimit
} from "./workflow-constants";
import {
  CRITICAL_ISSUE_TEMPLATE,
  MISSING_COMPONENT_TEMPLATE,
  IMPROVEMENT_TEMPLATE,
  FEATURE_TEMPLATE,
  MILESTONE_DESCRIPTION_TEMPLATE,
  COMPLETION_COMMENT_TEMPLATE,
  INITIAL_REPLY_TEMPLATE,
  MILESTONE_CREATED_TEMPLATE,
  PLAN_REFINEMENT_TEMPLATE,
  PLAN_CANCELLED_TEMPLATE
} from "../templates/issue-templates";
import { createIdeaGenerationConfig, selectModelForUser, generateAIResponse } from "../lib/openai-operations";

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
export interface PlanAnalysis {
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

/**
 * Extracts user query from plan command message
 * @param message The full message from the command
 * @returns The user query or empty string if not found
 */
function extractUserQueryFromMessage(message: string): string {
  if (!message) return '';
  
  // Look for plan command followed by user query
  const planCommandMatch = message.match(/^(plan|planning|analyze)\s+(.+)$/i);
  if (planCommandMatch) {
    return planCommandMatch[2].trim();
  }
  
  return '';
}

// Export the plan implementation function
export async function runPlanTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting repository plan task - creating milestone only", { payload });
  const { owner, repo, issueNumber, installationId, requester } = payload;

  // Rate limiting for expensive plan operations
  const rateLimitKey = `plan-creation-${owner}-${repo}`;
  if (!checkRateLimit(rateLimitKey, 5)) { // Allow max 5 plan creations per minute per repo
    logger.warn("Plan creation rate limited", { owner, repo });
    throw new Error("Rate limit exceeded for plan creation");
  }

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);
    
    // Extract user query from the message if available
    const userQuery = extractUserQueryFromMessage(payload.message || '');
    logger.info("Extracted user query", { userQuery: userQuery || 'none', requester });
    
    // Post an immediate reply comment
    await postReplyComment(octokit, owner, repo, issueNumber);
    logger.info("Posted initial reply comment");

    // Phase 1: Repository Ingestion
    logger.info("Phase 1: Starting repository ingestion");
    const repositoryContent = await ingestRepository(octokit, owner, repo);
    
    // Phase 2: Comprehensive Analysis
    logger.info("Phase 2: Starting comprehensive analysis");
    const analysis = await performComprehensiveAnalysis(repositoryContent, userQuery, requester);
    
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
export async function ingestRepository(octokit: Octokit, owner: string, repo: string): Promise<string> {
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
    
    // DoS protection: Limit the number of files analyzed
    if (tree.tree.length > MAX_REPO_ANALYSIS_FILES) {
      logger.warn(`Repository has ${tree.tree.length} files, limiting analysis to ${MAX_REPO_ANALYSIS_FILES} for performance`, {
        owner,
        repo,
        totalFiles: tree.tree.length
      });
      // Truncate to prevent excessive processing
      tree.tree = tree.tree.slice(0, MAX_REPO_ANALYSIS_FILES);
    }
    
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

// Helper function for iterative refinement of innovation ideas
async function performIterativeRefinement(
  initialAnalysis: PlanAnalysis, 
  selectedModel: string, 
  ideaConfig: any, 
  config: any
): Promise<PlanAnalysis> {
  logger.info("Starting iterative refinement of innovation ideas");
  
  const refinementRounds = 3;
  const currentAnalysis = { ...initialAnalysis };
  
  for (let round = 1; round <= refinementRounds; round++) {
    logger.info(`Iterative refinement round ${round}/${refinementRounds}`);
    
    const refinementPrompt = `You are an innovation expert tasked with expanding and improving existing ideas. 

CURRENT IDEAS (${currentAnalysis.innovationIdeas.length} total):
${currentAnalysis.innovationIdeas.map((idea, i) => `${i + 1}. ${idea}`).join('\n')}

Your task for Round ${round}:
1. **EXPAND**: Add 2-3 NEW disruptive innovation ideas that build on or complement the existing ones
2. **FAST**: Ensure ideas are relevant to the project roadmap and fast to implement (1h - 24h max)
3. **ESCALATE CREATIVITY**: Each new idea should be bolder and more unconventional than typical suggestions
4. **CHALLENGE ASSUMPTIONS**: Think about impossible-seeming concepts that could become reality
5. **REVENUE FOCUSED**: Ideas must be focused on creating new revenue channel or enhancing current ones, no buzzword fancy ai slop

Return ONLY a JSON array of NEW innovation ideas (don't repeat existing ones):
{
  "newInnovationIdeas": [
    "Revolutionary concept 1 that pushes boundaries...",
    "Disruptive integration 2 that creates new market...",
    "Bold architectural innovation 3 that enables impossible scale...",
    "... continue with 20-30 more creative, game-changing ideas"
  ]
}

Be UNHINGED in creativity - think bigger, bolder, more disruptive than normal AI responses.`;

    try {
      // Create config with slightly higher creativity for refinement
      const refinementConfig = {
        model: selectedModel,
        maxTokens: ideaConfig.maxTokens,
        temperature: Math.min(ideaConfig.temperature + 0.1, 1.0) // Slightly higher creativity for refinement
      };

      const content = await generateAIResponse(
        refinementPrompt,
        "You are a creative innovation expert who generates disruptive, unconventional ideas.",
        refinementConfig
      );

      if (!content) {
        logger.warn(`No content received for refinement round ${round}, continuing`);
        continue;
      }

        // Parse the new ideas
        try {
          const cleanedText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const refinementResult = JSON.parse(cleanedText);
          
          if (refinementResult.newInnovationIdeas && Array.isArray(refinementResult.newInnovationIdeas)) {
            const beforeCount = currentAnalysis.innovationIdeas.length;
            currentAnalysis.innovationIdeas = [
              ...currentAnalysis.innovationIdeas,
              ...refinementResult.newInnovationIdeas
            ];
            logger.info(`Refinement round ${round} added ${refinementResult.newInnovationIdeas.length} new ideas (${beforeCount} -> ${currentAnalysis.innovationIdeas.length})`);
          } else {
            logger.warn(`Invalid refinement result structure for round ${round}`);
          }
        } catch (parseError) {
          logger.warn(`Failed to parse refinement result for round ${round}`, {
            error: parseError instanceof Error ? parseError.message : 'Unknown error'
          });
        }

    } catch (error) {
      logger.warn(`Refinement round ${round} failed`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Continue with next round or finish with what we have
    }

    // Small delay between rounds to respect rate limits
    if (round < refinementRounds) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return currentAnalysis;
}

// Phase 2: Comprehensive Analysis using LLM with enhanced security and reliability
export async function performComprehensiveAnalysis(repositoryContent: string, userQuery?: string, requester?: string): Promise<PlanAnalysis> {
  logger.info("Starting LLM-powered comprehensive analysis", { requester });
  
  const config = getPlanConfig();
  const selectedModel = selectModelForUser(requester || 'anonymous');
  const ideaConfig = createIdeaGenerationConfig(requester || 'anonymous');
  
  logger.info("Model selection for user", { 
    requester, 
    selectedModel, 
    temperature: ideaConfig.temperature 
  });

  const systemPrompt = `You are a seasoned Engineering Manager and Technical Architect with 15+ years of experience leading successful software delivery. Apply proven project management methodologies, realistic estimation practices, and critical business thinking to analyze this repository.

🎯 MANAGEMENT FRAMEWORK:
- Apply the MoSCoW method (Must/Should/Could/Won't) for prioritization
- Use T-shirt sizing (XS/S/M/L/XL) for effort estimation with actual hour ranges
- Consider dependencies, blockers, and risk factors that could derail timelines
- Think about team capacity, skill gaps, and knowledge transfer needs
- Evaluate technical debt impact on velocity and maintainability
- Assess market timing and competitive positioning for features

📊 REALISTIC ESTIMATION GUIDELINES:
- XS (1-3 hours): Simple config changes, minor bug fixes
- S (4-8 hours): Small features, straightforward refactoring  
- M (1-3 days): Medium features, significant improvements
- L (1-2 weeks): Complex features, major architectural changes
- XL (3+ weeks): Platform rewrites, major system integrations

🚨 CRITICAL THINKING APPROACH:
- Question assumptions: What could go wrong? What are we missing?
- Consider opportunity cost: What are we NOT doing by prioritizing this?
- Evaluate ROI: Does effort justify expected business impact?
- Think about maintenance burden: How will this age over time?
- Consider team dynamics: Do we have the right skills? Knowledge gaps?
- Assess external dependencies: Third-party APIs, infrastructure, compliance

⚠️ RED FLAGS TO IDENTIFY:
- Security vulnerabilities that could lead to breaches
- Performance bottlenecks affecting user experience  
- Scalability limitations preventing growth
- Technical debt creating development friction
- Missing testing/monitoring creating blind spots
- Outdated dependencies with known vulnerabilities

🎨 INNOVATION CRITERIA - GENERATE AT LEAST 5 MORE IDEAS THAN USUAL:
- Revenue, revenue, revenue
- Market differentiation potential
- User experience enhancement  
- Developer productivity gains
- Revenue generation opportunities
- Competitive advantage creation
- DISRUPTIVE and UNCONVENTIONAL thinking - avoid "sheep AI innovator" ideas
- BOLD concepts that challenge industry norms
- UNHINGED creativity that pushes boundaries
- Consider ideas that seem impossible but could revolutionize the space

**CRITICAL: For innovation ideas, generate AT LEAST 5 distinct ideas covering:**
- Revolutionary feature concepts that don't exist yet
- Completely new business models enabled by this technology
- Unconventional user interaction paradigms
- Bold architectural innovations
- Creative monetization strategies
- Experimental user experience concepts
- Cutting-edge technical implementations
- Industry-disrupting workflows
- Next-generation collaboration models

Return analysis with realistic timelines, clear dependencies, and honest assessment of risks:

{
  "repositoryOverview": "Executive summary: what this does, current state, key challenges (2-3 sentences)",
  "missingComponents": [
    "Component description [Size: S-M, Priority: Must] - Business justification and risk if not addressed",
    "Another missing piece [Size: L, Priority: Should] - Why this matters for product success"
  ],
  "criticalFixes": [
    "Security/performance issue [Size: XS-S, Priority: Must, Risk: High] - Immediate business impact if unfixed",
    "System reliability issue [Size: M, Priority: Must, Dependencies: Infrastructure team] - What could break"
  ],
  "requiredImprovements": [
    "Technical debt item [Size: M, Priority: Should, ROI: High] - How this blocks future development",
    "Code quality issue [Size: S-M, Priority: Could] - Long-term maintenance burden"
  ],
  "innovationIdeas": [
    "GENERATE MANY MORE IDEAS HERE - minimum 5 creative, disruptive concepts",
    "Breakthrough integration with emerging tech that creates new market category",
    "Disruptive business model that challenges industry assumptions",
    "Bold architectural innovation that enables impossible scale",
    "... continue with at least 10+ more creative, boundary-pushing ideas"
  ]
}

Be brutally honest about effort, realistic about timelines, and crystal clear about business justification. Be UNHINGED and REVENUE-focused with innovation ideas - think bigger, bolder, more disruptive than normal AI responses.`;

  // Truncate repository content to prevent token limits
  const truncatedContent = truncateContent(repositoryContent, config.maxContentLength);
  // Construct user prompt with repository content and optional user query
  let userPrompt = `Analyze this repository:\n\n${truncatedContent}`;
  
  if (userQuery && userQuery.trim()) {
    userPrompt += `\n\n🎯 USER SPECIFIC REQUEST:\n"${userQuery.trim()}"\n\nPlease prioritize tasks that address this specific user need while maintaining the comprehensive analysis framework.`;
  }

  try {
    // Perform OpenAI API call with proper o3-mini support
    const analysisText = await generateAIResponse(userPrompt, systemPrompt, ideaConfig);

    logger.info("Received analysis from OpenAI", { 
      contentLength: analysisText.length,
      modelUsed: selectedModel
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

    logger.info("Initial analysis parsing completed successfully", {
      missingComponents: analysis.missingComponents.length,
      criticalFixes: analysis.criticalFixes.length,
      requiredImprovements: analysis.requiredImprovements.length,
      innovationIdeas: analysis.innovationIdeas.length
    });

    // ITERATIVE REFINEMENT: Enhance innovation ideas through 2-3 refinement rounds
    analysis = await performIterativeRefinement(analysis, selectedModel, ideaConfig, config);

    logger.info("Final analysis after iterative refinement", {
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
// Uses unique timestamp-based title to prevent duplicate milestone errors
// when multiple plans are created on the same day
async function createProjectMilestone(octokit: Octokit, owner: string, repo: string, analysis: PlanAnalysis): Promise<GitHubMilestone> {
  logger.info("Creating GitHub milestone");

  const currentDate = new Date();
  const dueDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  const milestoneDescription = MILESTONE_DESCRIPTION_TEMPLATE(analysis, currentDate);

  try {
    // Generate unique milestone title with timestamp and random component to avoid duplicates
    const timestamp = currentDate.toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const randomSuffix = Math.random().toString(36).substr(2, 4); // 4 random characters
    const uniqueTitle = `AI Development Plan - ${timestamp}-${randomSuffix}`;
    
    const { data: milestone } = await octokit.issues.createMilestone({
      owner,
      repo,
      title: uniqueTitle,
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
