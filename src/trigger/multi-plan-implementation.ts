import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { GitHubContext } from "../services/task-types";
import { createAuthenticatedOctokit } from "./github-auth";
import { 
  MAX_REPO_ANALYSIS_FILES,
  checkRateLimit
} from "./workflow-constants";
import {
  INITIAL_REPLY_TEMPLATE,
  MILESTONE_CREATED_TEMPLATE
} from "../templates/issue-templates";
import { createIdeaGenerationConfig, selectModelForUser } from "../lib/openai-operations";

// Import and reuse types from plan-implementation
import { 
  ISSUE_LABELS, 
  ISSUE_PRIORITIES,
  PlanAnalysis
} from "./plan-implementation";

// Define interfaces for multi-repository analysis
interface MultiRepoAnalysis {
  repositoryOverview: string;
  repositories: RepositoryAnalysis[];
  aggregatedInsights: {
    missingComponents: string[];
    criticalFixes: string[];
    requiredImprovements: string[];
    innovationIdeas: string[];
  };
  crossRepoOpportunities: string[];
  consolidatedPriorities: string[];
}

interface RepositoryAnalysis {
  owner: string;
  repo: string;
  analysis: {
    repositoryOverview: string;
    missingComponents: string[];
    criticalFixes: string[];
    requiredImprovements: string[];
    innovationIdeas: string[];
  };
  accessible: boolean;
  error?: string;
}

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

// Configuration constants
const MAX_CONCURRENT_REPOS = 5; // Limit concurrent repository processing
const REPO_TIMEOUT_MS = 300000; // 5 minutes per repository
const MAX_CONTENT_LENGTH = 8000; // Per repository content limit
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Main function for multi-repository planning task
 */
export async function runMultiPlanTask(payload: GitHubContext, ctx: any) {
  logger.info("Starting multi-repository plan task", { payload });
  
  const { owner, repo, issueNumber, installationId, requester, repositories, isMultiRepo } = payload;

  if (!isMultiRepo || !repositories || repositories.length === 0) {
    throw new Error("Invalid multi-repository request: no repositories specified");
  }

  // Rate limiting for expensive multi-plan operations
  const rateLimitKey = `multi-plan-creation-${owner}-${repo}`;
  if (!checkRateLimit(rateLimitKey, 2)) { // Allow max 2 multi-plan creations per minute per repo
    logger.warn("Multi-plan creation rate limited", { owner, repo });
    throw new Error("Rate limit exceeded for multi-plan creation");
  }

  try {
    // Create authenticated Octokit
    const octokit = await createAuthenticatedOctokit(installationId);
    
    // Post an immediate reply comment
    await postMultiRepoReplyComment(octokit, owner, repo, issueNumber, repositories);
    logger.info("Posted initial multi-repo reply comment");

    // Phase 1: Multi-Repository Ingestion
    logger.info("Phase 1: Starting multi-repository ingestion");
    const repositoryAnalyses = await ingestMultipleRepositories(octokit, repositories, requester);
    
    // Phase 2: Aggregated Analysis
    logger.info("Phase 2: Starting aggregated analysis");
    const multiRepoAnalysis = await performAggregatedAnalysis(repositoryAnalyses, requester);
    
    // Phase 3: Create GitHub Milestone
    logger.info("Phase 3: Creating GitHub milestone for multi-repository plan");
    const milestone = await createMultiRepoMilestone(octokit, owner, repo, multiRepoAnalysis);
    
    // Post milestone URL as response
    await postMultiRepoMilestoneComment(octokit, owner, repo, issueNumber, milestone);
    
    logger.info("Multi-plan task completed", { 
      milestoneId: milestone.id,
      milestoneUrl: milestone.html_url,
      repositoriesAnalyzed: repositoryAnalyses.filter(r => r.accessible).length,
      repositoriesFailed: repositoryAnalyses.filter(r => !r.accessible).length
    });
    
    return { 
      success: true, 
      milestone: milestone,
      phase: 'multi_milestone_created',
      repositoryCount: repositories.length,
      successfulRepositories: repositoryAnalyses.filter(r => r.accessible).length
    };
    
  } catch (error) {
    logger.error("Error in multi-plan task", { error });
    
    // Try to post error comment
    try {
      const octokit = await createAuthenticatedOctokit(installationId);
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: `❌ **Multi-Repository Plan Generation Failed**\n\nSorry, I encountered an error while generating the multi-repository development plan:\n\`\`\`\n${error instanceof Error ? error.message : 'Unknown error'}\n\`\`\``
      });
    } catch (commentError) {
      logger.error("Failed to post error comment", { commentError });
    }
    
    throw error;
  }
}

/**
 * Post immediate reply comment for multi-repository planning
 */
async function postMultiRepoReplyComment(
  octokit: Octokit, 
  owner: string, 
  repo: string, 
  issueNumber: number,
  repositories: Array<{ owner: string; repo: string }>
): Promise<void> {
  const repoList = repositories.map(r => `${r.owner}/${r.repo}`).join(', ');
  
  const replyBody = `🤖 **Multi-Repository Plan Generation Started**

I'm analyzing ${repositories.length} repositories to create a comprehensive aggregated development plan:

**Repositories:**
${repositories.map(r => `- \`${r.owner}/${r.repo}\``).join('\n')}

This will include:
- 📊 Cross-repository analysis and insights
- 🔍 Aggregated missing components identification  
- 🚨 Critical fixes needed across all repositories
- 💡 Innovation opportunities that span multiple repos
- 📋 Consolidated milestone with prioritized issues

This process may take several minutes to analyze all repositories...`;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: replyBody
  });
}

/**
 * Ingest and analyze multiple repositories concurrently
 */
async function ingestMultipleRepositories(
  octokit: Octokit, 
  repositories: Array<{ owner: string; repo: string }>,
  requester?: string
): Promise<RepositoryAnalysis[]> {
  
  logger.info("Ingesting multiple repositories", { count: repositories.length });
  
  // Process repositories in batches to avoid overwhelming the API
  const batchSize = Math.min(MAX_CONCURRENT_REPOS, repositories.length);
  const results: RepositoryAnalysis[] = [];
  
  for (let i = 0; i < repositories.length; i += batchSize) {
    const batch = repositories.slice(i, i + batchSize);
    logger.info(`Processing repository batch ${i / batchSize + 1}`, { 
      batchStart: i + 1, 
      batchEnd: Math.min(i + batchSize, repositories.length),
      total: repositories.length 
    });
    
    const batchPromises = batch.map(async (repoSpec) => {
      try {
        return await retryWithBackoff(
          () => analyzeRepositoryWithTimeout(octokit, repoSpec.owner, repoSpec.repo, requester),
          RETRY_ATTEMPTS,
          RETRY_DELAY_MS,
          `Repository analysis: ${repoSpec.owner}/${repoSpec.repo}`
        );
      } catch (error) {
        logger.warn(`Failed to analyze repository ${repoSpec.owner}/${repoSpec.repo}`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        return {
          owner: repoSpec.owner,
          repo: repoSpec.repo,
          accessible: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          analysis: {
            repositoryOverview: `Repository ${repoSpec.owner}/${repoSpec.repo} was not accessible`,
            missingComponents: [],
            criticalFixes: [],
            requiredImprovements: [],
            innovationIdeas: []
          }
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches to be respectful of rate limits
    if (i + batchSize < repositories.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const successfulCount = results.filter(r => r.accessible).length;
  logger.info("Multi-repository ingestion completed", {
    total: repositories.length,
    successful: successfulCount,
    failed: repositories.length - successfulCount
  });
  
  return results;
}

/**
 * Analyze a single repository with timeout protection
 */
async function analyzeRepositoryWithTimeout(
  octokit: Octokit,
  owner: string,
  repo: string,
  requester?: string
): Promise<RepositoryAnalysis> {
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REPO_TIMEOUT_MS);
  
  try {
    // Import single repository analysis functions from plan-implementation
    const { ingestRepository, performComprehensiveAnalysis } = await import('./plan-implementation');
    
    // First check if repository is accessible
    await octokit.repos.get({ owner, repo });
    
    // Get repository content
    const repositoryContent = await ingestRepository(octokit, owner, repo);
    
    // Perform analysis with user context
    const analysis = await performComprehensiveAnalysis(repositoryContent, undefined, requester);
    
    clearTimeout(timeoutId);
    
    return {
      owner,
      repo,
      accessible: true,
      analysis
    };
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Repository analysis timed out after ${REPO_TIMEOUT_MS / 1000} seconds`);
    }
    
    throw error;
  }
}

/**
 * Perform aggregated analysis across all repositories
 */
async function performAggregatedAnalysis(
  repositoryAnalyses: RepositoryAnalysis[],
  requester?: string
): Promise<MultiRepoAnalysis> {
  
  logger.info("Starting aggregated analysis", { 
    totalRepos: repositoryAnalyses.length,
    accessibleRepos: repositoryAnalyses.filter(r => r.accessible).length
  });
  
  const accessibleRepos = repositoryAnalyses.filter(r => r.accessible);
  
  if (accessibleRepos.length === 0) {
    throw new Error("No repositories were accessible for analysis");
  }
  
  // Aggregate all findings across repositories
  const allMissingComponents: string[] = [];
  const allCriticalFixes: string[] = [];
  const allRequiredImprovements: string[] = [];
  const allInnovationIdeas: string[] = [];
  
  accessibleRepos.forEach(repoAnalysis => {
    const { analysis } = repoAnalysis;
    allMissingComponents.push(...analysis.missingComponents.map(item => 
      `[${repoAnalysis.owner}/${repoAnalysis.repo}] ${item}`
    ));
    allCriticalFixes.push(...analysis.criticalFixes.map(item => 
      `[${repoAnalysis.owner}/${repoAnalysis.repo}] ${item}`
    ));
    allRequiredImprovements.push(...analysis.requiredImprovements.map(item => 
      `[${repoAnalysis.owner}/${repoAnalysis.repo}] ${item}`
    ));
    allInnovationIdeas.push(...analysis.innovationIdeas.map(item => 
      `[${repoAnalysis.owner}/${repoAnalysis.repo}] ${item}`
    ));
  });
  
  // Generate cross-repository insights using AI
  const crossRepoOpportunities = await generateCrossRepoInsights(accessibleRepos, requester);
  const consolidatedPriorities = await generateConsolidatedPriorities(accessibleRepos, requester);
  
  // Create repository overview
  const repositoryOverview = generateMultiRepoOverview(repositoryAnalyses);
  
  return {
    repositoryOverview,
    repositories: repositoryAnalyses,
    aggregatedInsights: {
      missingComponents: deduplicateAndPrioritize(allMissingComponents),
      criticalFixes: deduplicateAndPrioritize(allCriticalFixes), 
      requiredImprovements: deduplicateAndPrioritize(allRequiredImprovements),
      innovationIdeas: deduplicateAndPrioritize(allInnovationIdeas)
    },
    crossRepoOpportunities,
    consolidatedPriorities
  };
}

/**
 * Generate cross-repository insights and opportunities
 */
async function generateCrossRepoInsights(
  repositoryAnalyses: RepositoryAnalysis[],
  requester?: string
): Promise<string[]> {
  
  const selectedModel = selectModelForUser(requester || 'anonymous');
  const ideaConfig = createIdeaGenerationConfig(requester || 'anonymous');
  
  const systemPrompt = `You are an expert software architect analyzing multiple repositories to identify cross-repository opportunities and synergies. Focus on finding patterns, shared components, and opportunities for consolidation or integration.

Analyze the repositories and identify:
1. Shared/duplicate functionality that could be consolidated
2. Cross-repository integration opportunities  
3. Shared infrastructure or tooling needs
4. Common patterns that suggest architectural improvements
5. Dependencies and relationships between repositories
6. Opportunities for code sharing or monorepo benefits

Return a JSON array of specific, actionable cross-repository opportunities:
{
  "crossRepoOpportunities": [
    "Specific cross-repo opportunity or insight...",
    "Another consolidation or integration opportunity...",
    "Infrastructure sharing opportunity...",
    "... continue with 5-15 insights"
  ]
}`;

  const repositorySummary = repositoryAnalyses
    .filter(r => r.accessible)
    .map(r => `### ${r.owner}/${r.repo}\n**Overview:** ${r.analysis.repositoryOverview}`)
    .join('\n\n');

  const userPrompt = `Analyze these repositories for cross-repository opportunities:\n\n${repositorySummary}`;

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      logger.warn("No OpenAI API key, using fallback cross-repo insights");
      return [
        "Consider establishing shared component libraries across repositories",
        "Evaluate opportunities for microservice architecture consolidation",
        "Implement unified CI/CD pipeline across all repositories", 
        "Standardize development tooling and configuration across projects",
        "Create shared documentation and knowledge base"
      ];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          max_tokens: ideaConfig.maxTokens,
          temperature: ideaConfig.temperature
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        const cleanedText = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const result = JSON.parse(cleanedText);
        
        if (result.crossRepoOpportunities && Array.isArray(result.crossRepoOpportunities)) {
          return result.crossRepoOpportunities;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.warn("Failed to generate cross-repo insights with AI", {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // Fallback insights
  return [
    "Evaluate shared component libraries and design systems",
    "Consider unified authentication and authorization services",
    "Implement cross-repository monitoring and observability", 
    "Standardize API conventions and documentation formats",
    "Create shared development environment and tooling"
  ];
}

/**
 * Generate consolidated priorities across repositories
 */
async function generateConsolidatedPriorities(
  repositoryAnalyses: RepositoryAnalysis[],
  requester?: string
): Promise<string[]> {
  
  // Simple priority consolidation for now - could be enhanced with AI
  const priorities: string[] = [];
  
  const criticalCount = repositoryAnalyses
    .filter(r => r.accessible)
    .reduce((sum, r) => sum + r.analysis.criticalFixes.length, 0);
    
  if (criticalCount > 0) {
    priorities.push(`Address ${criticalCount} critical security and performance issues across repositories`);
  }
  
  const missingCount = repositoryAnalyses
    .filter(r => r.accessible)
    .reduce((sum, r) => sum + r.analysis.missingComponents.length, 0);
    
  if (missingCount > 0) {
    priorities.push(`Implement ${missingCount} missing components for feature completeness`);
  }
  
  priorities.push("Establish cross-repository development standards and tooling");
  priorities.push("Create unified documentation and knowledge sharing system");
  priorities.push("Implement consolidated monitoring and observability");
  
  return priorities;
}

/**
 * Deduplicate and prioritize items from multiple repositories
 */
function deduplicateAndPrioritize(items: string[]): string[] {
  // Simple deduplication for now - could be enhanced with semantic similarity
  const uniqueItems = [...new Set(items)];
  
  // Prioritize by repository frequency (items that appear in multiple repos)
  const itemCounts = new Map<string, number>();
  items.forEach(item => {
    itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
  });
  
  return uniqueItems.sort((a, b) => (itemCounts.get(b) || 0) - (itemCounts.get(a) || 0));
}

/**
 * Generate multi-repository overview
 */
function generateMultiRepoOverview(repositoryAnalyses: RepositoryAnalysis[]): string {
  const accessible = repositoryAnalyses.filter(r => r.accessible).length;
  const total = repositoryAnalyses.length;
  const failed = total - accessible;
  
  let overview = `Multi-repository analysis covering ${total} repositories`;
  
  if (failed > 0) {
    overview += ` (${accessible} accessible, ${failed} failed)`;
  }
  
  overview += `. This aggregated plan identifies cross-repository opportunities, shared components, and consolidated priorities for efficient development across the entire project ecosystem.`;
  
  return overview;
}

/**
 * Create milestone for multi-repository plan
 */
async function createMultiRepoMilestone(
  octokit: Octokit,
  owner: string,
  repo: string,
  analysis: MultiRepoAnalysis
): Promise<GitHubMilestone> {
  
  logger.info("Creating multi-repository GitHub milestone");

  const currentDate = new Date();
  const dueDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days for multi-repo

  const milestoneDescription = generateMultiRepoMilestoneDescription(analysis, currentDate);

  try {
    const timestamp = currentDate.toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const randomSuffix = Math.random().toString(36).substr(2, 4);
    const uniqueTitle = `Multi-Repository Development Plan - ${timestamp}-${randomSuffix}`;
    
    const { data: milestone } = await octokit.issues.createMilestone({
      owner,
      repo,
      title: uniqueTitle,
      description: milestoneDescription,
      due_on: dueDate.toISOString()
    });

    logger.info("Multi-repository milestone created successfully", { milestoneId: milestone.id });
    return milestone as GitHubMilestone;

  } catch (error) {
    logger.error("Error creating multi-repository milestone", { error });
    throw new Error(`Multi-repository milestone creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate milestone description for multi-repository plan
 */
function generateMultiRepoMilestoneDescription(analysis: MultiRepoAnalysis, currentDate: Date): string {
  const accessibleRepos = analysis.repositories.filter(r => r.accessible);
  const failedRepos = analysis.repositories.filter(r => !r.accessible);
  
  let description = `# 🌐 Multi-Repository Development Plan
  
*Generated on ${currentDate.toLocaleDateString()} by AI Development Planning*

## 📊 Repository Overview
${analysis.repositoryOverview}

### Analyzed Repositories (${accessibleRepos.length}/${analysis.repositories.length})
${accessibleRepos.map(r => `- ✅ \`${r.owner}/${r.repo}\``).join('\n')}`;

  if (failedRepos.length > 0) {
    description += `\n\n### Inaccessible Repositories (${failedRepos.length})
${failedRepos.map(r => `- ❌ \`${r.owner}/${r.repo}\` - ${r.error}`).join('\n')}`;
  }

  description += `

## 🔗 Cross-Repository Opportunities
${analysis.crossRepoOpportunities.map(opp => `- ${opp}`).join('\n')}

## 📋 Consolidated Priorities
${analysis.consolidatedPriorities.map(priority => `- ${priority}`).join('\n')}

## 🚨 Critical Fixes (${analysis.aggregatedInsights.criticalFixes.length})
${analysis.aggregatedInsights.criticalFixes.slice(0, 10).map(fix => `- ${fix}`).join('\n')}
${analysis.aggregatedInsights.criticalFixes.length > 10 ? `\n*... and ${analysis.aggregatedInsights.criticalFixes.length - 10} more critical fixes*` : ''}

## 📦 Missing Components (${analysis.aggregatedInsights.missingComponents.length})
${analysis.aggregatedInsights.missingComponents.slice(0, 10).map(comp => `- ${comp}`).join('\n')}
${analysis.aggregatedInsights.missingComponents.length > 10 ? `\n*... and ${analysis.aggregatedInsights.missingComponents.length - 10} more missing components*` : ''}

## 🔧 Required Improvements (${analysis.aggregatedInsights.requiredImprovements.length})
${analysis.aggregatedInsights.requiredImprovements.slice(0, 10).map(imp => `- ${imp}`).join('\n')}
${analysis.aggregatedInsights.requiredImprovements.length > 10 ? `\n*... and ${analysis.aggregatedInsights.requiredImprovements.length - 10} more improvements*` : ''}

## 💡 Innovation Ideas (${analysis.aggregatedInsights.innovationIdeas.length})
${analysis.aggregatedInsights.innovationIdeas.slice(0, 10).map(idea => `- ${idea}`).join('\n')}
${analysis.aggregatedInsights.innovationIdeas.length > 10 ? `\n*... and ${analysis.aggregatedInsights.innovationIdeas.length - 10} more innovation ideas*` : ''}

---

*This milestone contains aggregated insights from ${accessibleRepos.length} repositories. Use \`@l approve\` to create detailed issues for implementation.*`;

  return description;
}

/**
 * Post milestone completion comment
 */
async function postMultiRepoMilestoneComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  milestone: GitHubMilestone
): Promise<void> {
  
  const milestoneUrl = milestone.html_url;
  
  const responseBody = `## 🎯 Multi-Repository AI Development Plan Created!

I've analyzed multiple repositories and created a comprehensive aggregated development milestone.

### 📍 **Your Multi-Repository Milestone:** [View Aggregated Plan](${milestoneUrl})

## 🚀 **Next Steps:**

### **Option 1: Approve & Create Issues (Recommended)**
Comment: \`@l approve\` to automatically create all planned issues across repositories and attach them to this milestone.

### **Option 2: Review & Refine First**
- Click the milestone link above to review the detailed aggregated plan
- Comment: \`@l refine [your feedback]\` to modify the plan based on your needs

### **Option 3: Cancel Plan**
Comment: \`@l cancel\` if you want to reject this plan entirely.

## 📋 **What's in Your Multi-Repository Plan:**
The milestone contains:
- 🔗 **Cross-repository opportunities** - Synergies and integration possibilities
- 🚨 **Aggregated critical fixes** - Security & performance issues across all repos
- 📦 **Consolidated missing components** - Essential features needed
- 🔧 **Cross-cutting improvements** - Technical debt and quality items
- 💡 **Multi-repo innovation ideas** - Features spanning multiple repositories

## ⚡ **Quick Approval:**
Ready to proceed? Just comment \`@l approve\` and I'll create all the issues automatically!

---
*Powered by Multi-Repository AI Development Planning* 🌐🤖`;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: responseBody
  });

  logger.info("Posted multi-repository milestone URL comment", { milestoneUrl });
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
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
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