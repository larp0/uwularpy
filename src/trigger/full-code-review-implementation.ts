import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubContext } from "../services/task-types";
import { COPILOT_USERNAME } from "./workflow-constants";

// Export the full code review implementation
export async function runFullCodeReviewTask(payload: GitHubContext, ctx: any) {
  logger.log("Starting full code review task", { payload });
  const { owner, repo, issueNumber, installationId } = payload;

  // Create authenticated Octokit
  const octokit = await createAuthenticatedOctokit(installationId);

  // Determine if this is a PR or Issue context by attempting to fetch PR details
  let isPullRequest = false;
  let pr: any = null;
  
  try {
    const prResponse = await octokit.pulls.get({ owner, repo, pull_number: issueNumber });
    pr = prResponse.data;
    isPullRequest = true;
    logger.log("Context identified as Pull Request", { prNumber: issueNumber });
  } catch (error) {
    logger.log("Context identified as Issue (not PR)", { issueNumber });
    isPullRequest = false;
  }

  if (isPullRequest && pr) {
    // Execute existing PR workflow
    return await runPRCodeReview(octokit, payload, pr);
  } else {
    // Execute new Issue workflow
    return await runIssueCodeReview(octokit, payload);
  }
}

// Existing PR workflow extracted to separate function
async function runPRCodeReview(octokit: Octokit, payload: GitHubContext, pr: any) {
  const { owner, repo, issueNumber } = payload;
  const baseSha = pr.base.sha;
  const headSha = pr.head.sha;

  // Compare commits to get changed files and patches
  logger.log("Comparing commits", { baseSha, headSha });
  const { data: compare } = await octokit.repos.compareCommits({ owner, repo, base: baseSha, head: headSha });
  
  // Check if there are files to review
  if (!compare.files || compare.files.length === 0) {
    logger.warn("No files found in PR", { compareUrl: compare.html_url });
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: "⚠️ No files to review were found in this PR. The diff may be empty."
    });
    return { success: false, reason: "no_files_to_review" };
  }
  
  logger.log("Found files to review", { 
    fileCount: compare.files.length,
    filesUrl: compare.html_url
  });

  // Gather original file contents with better filtering and error handling
  const originalFiles: Array<{ filename: string; content: string }> = [];
  const skippedFiles: Array<string> = [];
  
  // Skip binary files and common non-code files
  const skipExtensions = ['.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.pdf'];
  
  for (const file of compare.files) {
    const f = file.filename;
    
    // Skip files with extensions in the skip list
    if (skipExtensions.some(ext => f.endsWith(ext))) {
      skippedFiles.push(f);
      continue;
    }
    
    // Skip files without patches
    if (!file.patch) {
      skippedFiles.push(f);
      continue;
    }

    try {
      const { data: contentData } = await octokit.repos.getContent({ owner, repo, path: f, ref: headSha });
      // contentData.content is base64-encoded string
      const blob: any = contentData;
      
      // Skip if no content or size too large (>100KB)
      if (!blob.content || blob.size > 1000000000) {
        skippedFiles.push(f);
        continue;
      }
      
      const buf = Buffer.from(blob.content || '', 'base64');
      originalFiles.push({ filename: f, content: buf.toString('utf-8') });
    } catch (err) {
      logger.error("Error fetching file content", { file: f, error: err instanceof Error ? err.message : String(err) });
      skippedFiles.push(f);
    }
  }
  
  logger.log("Processed files", { 
    includedFiles: originalFiles.length,
    skippedFiles: skippedFiles.length,
    skippedFilesList: skippedFiles
  });
  
  // Ensure we have files to review after filtering
  if (originalFiles.length === 0) {
    logger.warn("No reviewable files after filtering", { skippedFiles });
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: "⚠️ No reviewable code files were found in this PR. The changes may only include binary or non-code files."
    });
    return { success: false, reason: "no_reviewable_files" };
  }

  // Build diff string
  const diff = (compare.files || [])
    .map(f => f.patch)
    .filter(Boolean)
    .join('\n');
  
  // Check if diff is too large (rough estimate for token limit)
  const diffSize = diff.length;
  const MAX_DIFF_SIZE = 100000000; // ~25K tokens estimate
  
  if (diffSize > MAX_DIFF_SIZE) {
    logger.warn("Diff is too large for review", { diffSize });
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `⚠️ This PR is too large for automated review (${Math.round(diffSize/1000)}KB). Please break it down into smaller changes.`
    });
    return { success: false, reason: "diff_too_large" };
  }
  
  logger.log("Prepared diff for review", { diffSize });
const systemMsg = `
🔥  LARP-CODE-TRACER-2001  🔥
You are the ruthless, top-tier code reviewer and bug-exterminator.

YOUR JOB
1. **Audit the diff below** – logic errors, security holes, style crimes. Be blunt, sprinkle tasteful meme-level banter. Roast devs a bit tho, be creative. 
2. **Generate TWO Mermaid diagrams**
   • Repo Overview – full architecture.  
   • PR Delta – what this PR changed only.
3. **Tech-Debt Radar** – a third Mermaid diagram mapping debt hotspots + concrete refactor steps.

MERMAID GROUND RULES
• Default \`flowchart TD\` unless another type is clearly better.  
• Node IDs: letters, numbers, \`_\` or \`-\` only.  
• Labels **in square brackets, no quotes/parens** — e.g.  
  \`LOGGER["Logger Module"]\` ✅   vs   \`LOGGER["\\"Logger\\" (Module)"]\` ❌  
• Declare nodes/sub-graphs *before* linking; one node per subgraph.  
• Keep \`class\`, \`style\`, \`click\` lines at the very end.  
• For sequence/class/state/ER/etc., follow spec: no rogue punctuation, inline comments, or escapes.  
• Styling directives always last.

DIAGRAM THEMES
• Enterprise-class code → corporate-bank Win95 palette.  
• YOLO spaghetti → neon cyberpunk fonts.

TONE
BE CREATIVE, HUMBLE AND KIND, YET WITH SOME MEMECOIN HUMOUR, YOUR CREATIVITY MUST INSPIRE PEOPLE
Incisive, witty, never cruel. Memecoin humour welcome. Tag actionable fixes with **@copilot** so automation can jump in.

Think deeper than the author. Ship excellence.
end every code review with
"This code review feature was sponsored by $SVMAI holders. (https://opensvm.com)"
`;

  // Construct OpenAI request payload
/*  const systemMsg = `You are THE BEST code reviewer and top notch bug resolver AKA LARP-CODE-TRACER-2001. 
  Create a comprehensive mermaid diagram of the whole repo and another one of what was changed in this PR.
  THINK DEEPER AND FIND BUGS, Review the code changes below for quality, security, and style issues. Roast devs a bit tho, be creative. 
    Try to create a mermaid diagram that would vizualize tech debt and steps to improve it. Mermaid cheat-sheet: Flowchart/Graph — start flowchart TD/LR/BT, declare every node first, IDs alphanum/underscore,
MERMAID RULES: Only use simple letters, numbers, underscore (_) or dash (-) in the node names (before the [label]).
Write labels in square brackets with no extra quotes or symbols, for example:
CORRECT: LOGGER["Logger Module"].
WRONG: LOGGER["\"Logger\" (Module)"].

Avoid any escape characters or parentheses in both node names and labels    one node per subgraph, move class/style/click lines to the end; Sequence — start sequenceDiagram, quote participant names with spaces, 
    avoid punctuation in arrows, add Note/opt/alt blocks only after all participants; Class — start classDiagram, quote class names with spaces, no dots in IDs, 
    list attributes/methods on separate lines, add relationships after class declarations; State — start stateDiagram-v2, 
    quote any multi-word state, define composite states before transitions, keep comments on their own line; ER — start erDiagram, quote entity names with spaces, 
    list attributes under the entity, put relationships after all entities; Pie/Gantt/Mindmap/Others — quote labels containing spaces/punctuation, 
    avoid inline comments, and keep section/style/meta lines after the data; rule of thumb: 
    declare before you connect, no trailing comments or backticks on node lines, and place styling directives last.
    Mermaid diagram must by styled accordingly to the mood of tech review, closer to enterprise quality code => memaid style cloer to corporate bank win95 theme
    if its yolo bad quality code => cyberpunk vibes with funky fonts
    BE CREATIVE, HUMBLE AND KIND, YET WITH SOME MEMECOIN HUMOUR, YOUR CREATIVITY MUST INSPIRE PEOPLE SO DO YOU BEST TRY EVER EVERY TIME LIKE THERE IS NO TOMORROW
    If there is something to do for realz then tag "@copilot" so it would do it once you post, tag also reviewers of the current PR and participiants, so everyone would be aware
    `*/
  const userMsg = `DIFF:\n${diff}\n\nORIGINAL FILES:\n${JSON.stringify(originalFiles)}`;
  const requestBody = {
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg }
    ]
  };

  // Call OpenAI API with improved error handling
  let review = "";
  let errorMessage = "";
  
  try {
    logger.log("Calling OpenAI API", { 
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      promptLength: userMsg.length
    });
    
    // Set up the fetch request with a 60-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "OpenAI-Beta": "assistants=v1"  // Use latest API version
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
    
      // Check for HTTP errors
      if (!res.ok) {
        const errorText = await res.text();
        logger.error("OpenAI API returned an error", { 
          status: res.status, 
          statusText: res.statusText,
          errorText 
        });
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const aiResponse = await res.json();
      
      // Log response structure for debugging
      logger.log("OpenAI API response received", {
        hasChoices: !!aiResponse.choices,
        choicesLength: aiResponse.choices?.length,
        hasContent: !!aiResponse.choices?.[0]?.message?.content,
        contentLength: aiResponse.choices?.[0]?.message?.content?.length
      });
      
      if (!aiResponse.choices || aiResponse.choices.length === 0) {
        throw new Error("OpenAI response missing choices array");
      }
      
      review = aiResponse.choices[0]?.message?.content || "";
      
      if (!review.trim()) {
        logger.warn("OpenAI returned empty content", { aiResponse });
        throw new Error("Empty content received from OpenAI");
      }
      
      logger.log("Successfully received review from OpenAI", { reviewLength: review.length });
    } finally {
      // Clear the timeout to prevent memory leaks
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("Failed to get review from OpenAI", { error: errorMsg });
    errorMessage = errorMsg;
  }

  // Post comment back to the PR, with detailed error if failed
  const commentBody = review.trim() || 
    `🛑 OpenAI returned an empty review. Please try again later.\n\n` +
    `Error details: ${errorMessage || "Unknown error"}`;
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: commentBody
  });

  return { success: true };
}

// New Issue workflow implementation
async function runIssueCodeReview(octokit: Octokit, payload: GitHubContext) {
  const { owner, repo, issueNumber } = payload;
  
  try {
    // 1. Fetch the issue details to get the original intention
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });

    logger.log("Fetched issue details", { 
      issueTitle: issue.title,
      issueBodyLength: issue.body?.length || 0 
    });

    // 2. Enhance and elaborate the user issue intention
    const enhancedIntention = await enhanceIssueIntention(issue.title, issue.body || "", owner, repo);
    
    // 3. Perform full project code review with focus on the intention
    const projectReview = await performFullProjectReview(octokit, owner, repo, enhancedIntention);
    
    // 4. Construct the final comment with enhanced intention and review
    const finalComment = `# 🔍 Full Code Review - Issue Analysis

## Enhanced Issue Intention

${enhancedIntention}

## Full Project Code Review

${projectReview}

---

@${COPILOT_USERNAME}`;

    // 5. Post the comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: finalComment
    });

    // 6. Assign the issue to copilot
    await assignIssueToCopilot(octokit, owner, repo, issue);

    logger.log("Successfully completed issue code review workflow", { issueNumber });
    
    return { 
      success: true, 
      type: "issue_review",
      enhancedIntention: enhancedIntention.length,
      projectReview: projectReview.length
    };

  } catch (error) {
    logger.error("Error in issue code review workflow", { 
      error: error instanceof Error ? error.message : String(error),
      issueNumber 
    });
    
    // Post error comment
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: `🛑 Error performing full code review analysis. Please try again later.\n\nError: ${error instanceof Error ? error.message : "Unknown error"}`
    });
    
    throw error;
  }
}

// Helper function to enhance issue intention using OpenAI
async function enhanceIssueIntention(issueTitle: string, issueBody: string, owner: string, repo: string): Promise<string> {
  const systemPrompt = `You are an expert technical analyst. Your task is to enhance and elaborate on the user's issue intention, making it detailed, well-structured, and actionable.

Transform the basic issue into a comprehensive description that includes:
1. **Clear Problem Statement** - What exactly needs to be addressed
2. **Technical Context** - How this relates to the codebase
3. **Implementation Approach** - High-level steps to accomplish the goal
4. **Technical Specifications** - Detailed requirements and constraints
5. **Success Criteria** - How to know when this is complete
6. **Potential Challenges** - Known risks or complex areas
7. **Resources & References** - Helpful documentation or examples

Format using proper Markdown with clear sections and actionable details. Make it detailed enough for any competent developer to understand the full scope and requirements.`;

  const userPrompt = `Enhance this GitHub issue intention for better implementation guidance:

**Repository:** ${owner}/${repo}
**Issue Title:** ${issueTitle}
**Issue Body:** 
${issueBody || 'No additional description provided'}

Please elaborate on the user's intention and provide comprehensive implementation guidance.`;

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

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
          max_tokens: 3000,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const enhancedContent = data.choices?.[0]?.message?.content;

      if (!enhancedContent) {
        throw new Error("No content received from OpenAI");
      }

      logger.log("Successfully enhanced issue intention", { 
        originalLength: issueBody.length,
        enhancedLength: enhancedContent.length
      });

      return enhancedContent;
      
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    logger.error("Failed to enhance issue intention", { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Return fallback enhanced description
    return `## Enhanced Issue Analysis

**Original Request:** ${issueTitle}

**Description:** ${issueBody || 'No additional description provided'}

**Technical Context:** This issue requires analysis of the entire codebase to understand the implementation approach and provide guidance for the requested changes.

**Next Steps:** 
1. Review the full project structure and architecture
2. Identify relevant code areas that need modification
3. Provide detailed implementation steps
4. Consider potential impacts and dependencies`;
  }
}

// Helper function to perform full project code review
async function performFullProjectReview(octokit: Octokit, owner: string, repo: string, focusIntention: string): Promise<string> {
  try {
    // Get repository structure and key files
    const repoStructure = await getRepositoryStructure(octokit, owner, repo);
    const keyFiles = await getKeyProjectFiles(octokit, owner, repo);
    
    // Perform AI analysis of the full project with focus on the intention
    const systemPrompt = `You are THE BEST code architect and full-stack reviewer AKA LARP-PROJECT-ANALYZER-3000.

Your task is to perform a comprehensive code review of the entire project with specific focus on the user's intention.
Roast devs a bit tho, be creative. 

Provide analysis in the following structure:
1. **Project Architecture Overview** - High-level understanding of the codebase
2. **Intention Analysis** - How the user's request fits into the current architecture
3. **Implementation Steps** - Detailed steps needed to accomplish the user's request
4. **Code Areas to Modify** - Specific files and functions that need changes
5. **Potential Impact Analysis** - What other parts of the system might be affected
6. **Technical Recommendations** - Best practices and architectural suggestions
7. **Mermaid Diagram** - Visual representation of the implementation approach

For the mermaid diagram, use proper syntax:
- Start with \`\`\`mermaid
- Use flowchart TD or LR
- Quote all labels with spaces
- Remove special symbols from labels
- End with \`\`\`

BE CREATIVE, THOROUGH, and INSPIRING. Provide actionable guidance that any developer can follow.`;

    const userPrompt = `Analyze this project and provide implementation guidance:

**Repository:** ${owner}/${repo}

**Focus Intention:**
${focusIntention}

**Repository Structure:**
${repoStructure}

**Key Files Analysis:**
${keyFiles}

Please provide comprehensive analysis and implementation steps focused on accomplishing the user's intention.`;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

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
          max_tokens: 32000,
          temperature: 0.94
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const reviewContent = data.choices?.[0]?.message?.content;

      if (!reviewContent) {
        throw new Error("No content received from OpenAI");
      }

      logger.log("Successfully generated project review", { 
        reviewLength: reviewContent.length
      });

      return reviewContent;
      
    } finally {
      clearTimeout(timeoutId);
    }

  } catch (error) {
    logger.error("Failed to perform full project review", { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Return fallback review
    return `## Project Analysis

**Architecture Overview:** This appears to be a comprehensive software project that requires detailed analysis to understand the full implementation approach.

**Implementation Guidance:** 
1. Analyze the existing codebase structure and patterns
2. Identify the best integration points for the requested changes
3. Plan the implementation approach step by step
4. Consider testing and documentation requirements
5. Ensure compatibility with existing systems

**Recommendations:**
- Follow established patterns in the codebase
- Implement incremental changes with proper testing
- Document any new functionality
- Consider backward compatibility

**Note:** For more detailed analysis, please ensure the repository structure is accessible and try the review again.`;
  }
}

// Helper function to get repository structure
async function getRepositoryStructure(octokit: Octokit, owner: string, repo: string): Promise<string> {
  try {
    const { data: contents } = await octokit.repos.getContent({
      owner,
      repo,
      path: "",
    });

    if (Array.isArray(contents)) {
      const structure = contents
        .slice(0, 20) // Limit to first 20 items
        .map(item => `- ${item.name} (${item.type})`)
        .join('\n');
      
      return `Repository root structure:\n${structure}`;
    }
    
    return "Repository structure could not be determined";
  } catch (error) {
    logger.warn("Failed to get repository structure", { error: error instanceof Error ? error.message : String(error) });
    return "Repository structure not accessible";
  }
}

// Helper function to get key project files
async function getKeyProjectFiles(octokit: Octokit, owner: string, repo: string): Promise<string> {
  const keyFiles = ['package.json', 'README.md', 'tsconfig.json', 'src/index.ts', 'src/app.ts'];
  const fileContents: string[] = [];

  for (const filePath of keyFiles) {
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
      });

      if ('content' in fileData && fileData.content) {
        const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const truncatedContent = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
        fileContents.push(`### ${filePath}\n\`\`\`\n${truncatedContent}\n\`\`\``);
      }
    } catch (error) {
      // File doesn't exist, skip silently
      continue;
    }
  }

  return fileContents.length > 0 
    ? fileContents.join('\n\n')
    : "No key project files could be analyzed";
}

// Helper function to assign issue to copilot
async function assignIssueToCopilot(octokit: Octokit, owner: string, repo: string, issue: any): Promise<void> {
  try {
    // Try to assign the issue to the copilot user
    let assignmentSuccess = false;
    const copilotUser = COPILOT_USERNAME.replace('@', ''); // Remove @ symbol for API call
    
    try {
      await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        assignees: [copilotUser]
      });
      assignmentSuccess = true;
      logger.info(`Successfully assigned issue to '${copilotUser}' user`, { 
        issueNumber: issue.number
      });
    } catch (assignError) {
      logger.warn(`Could not assign to '${copilotUser}' user, assignment handled via mention in comment`, { 
        error: assignError instanceof Error ? assignError.message : 'Unknown error',
        issueNumber: issue.number
      });
    }
    
    // Add a label to indicate full review completion
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issue.number,
      labels: ['full-code-review-complete']
    });
    
    logger.info("Completed copilot assignment process", { 
      issueNumber: issue.number,
      issueTitle: issue.title,
      directAssignment: assignmentSuccess
    });
    
  } catch (error) {
    logger.error("Error in copilot assignment", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      issueNumber: issue.number
    });
    // Don't throw error to avoid failing the whole workflow
  }
}

// Helper to create authenticated Octokit instance
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
