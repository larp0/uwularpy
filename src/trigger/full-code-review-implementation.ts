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
  const { data: compare } = await octokit.repos.compareCommits({ owner, repo, base: baseSha, head: headSha });

  // Gather original file contents
  const originalFiles: Array<{ filename: string; content: string }> = [];
  for (const file of compare.files || []) {
    const f = file.filename;
    if (f.endsWith('.json') || f.endsWith('.png')) continue;
    if (!file.patch) continue;

    try {
      const { data: contentData } = await octokit.repos.getContent({ owner, repo, path: f, ref: headSha });
      // contentData.content is base64-encoded string
      const blob: any = contentData;
      const buf = Buffer.from(blob.content || '', 'base64');
      originalFiles.push({ filename: f, content: buf.toString('utf-8') });
    } catch (err) {
      logger.error("Error fetching file content", { file: f, error: err });
    }
  }

  // Build diff string
  const diff = (compare.files || [])
    .map(f => f.patch)
    .filter(Boolean)
    .join('\n');

  // Construct OpenAI request payload
  const systemMsg = "You are a code reviewer. Review the code changes below for quality, security, and style issues.";
  const userMsg = `DIFF:\n${diff}\n\nORIGINAL FILES:\n${JSON.stringify(originalFiles)}`;
  const requestBody = {
    model: "gpt-4",
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg }
    ]
  };

  // Call OpenAI API
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(requestBody)
  });
  const aiResponse = await res.json();
  const review = aiResponse.choices?.[0]?.message?.content || "";
  logger.log("Received review from OpenAI");

  // Post comment back to the PR
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: review
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