import { logger } from "@trigger.dev/sdk/v3";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { GitHubContext } from "../services/task-types";

// Export the full code review implementation
export async function runFullCodeReviewTask(payload: GitHubContext, ctx: any) {
  logger.log("Starting full code review task", { payload });
  const { owner, repo, issueNumber, installationId } = payload;

  // Create authenticated Octokit
  const octokit = await createAuthenticatedOctokit(installationId);

  // Fetch PR details to get base and head SHAs
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: issueNumber });
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

  // Construct OpenAI request payload
  const systemMsg = "You are a code reviewer and top notch bug resolver. Create a comprehensive mermaid diagram of the whole repo and another one of what was changed in this PR. THINK DEEPER AND FIND BUGS, Review the code changes below for quality, security, and style issues. Roast devs a bit tho, be creative. Try to create a mermaid diagram that would vizualize tech debt and steps to improve it. Mermaid cheat-sheet: Flowchart/Graph — start flowchart TD/LR/BT, declare every node first, IDs alphanum/underscore, put labels with spaces/punctuation in double-quotes, escape +/\" inside, one node per subgraph, move class/style/click lines to the end; Sequence — start sequenceDiagram, quote participant names with spaces, avoid punctuation in arrows, add Note/opt/alt blocks only after all participants; Class — start classDiagram, quote class names with spaces, no dots in IDs, list attributes/methods on separate lines, add relationships after class declarations; State — start stateDiagram-v2, quote any multi-word state, define composite states before transitions, keep comments on their own line; ER — start erDiagram, quote entity names with spaces, list attributes under the entity, put relationships after all entities; Pie/Gantt/Mindmap/Others — quote labels containing spaces/punctuation, avoid inline comments, and keep section/style/meta lines after the data; rule of thumb: quote anything that isn’t a plain A-Z0-9_, declare before you connect, no trailing comments or backticks on node lines, and place styling directives last."
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
