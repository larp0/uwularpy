import { execSync, spawnSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from "@octokit/auth-app";

/**
 * Clone a repository, run OpenAI Codex CLI by piping prompt to stdin, commit & push.
 * @param prompt - The textual prompt for Codex.
 * @param repoUrl - HTTPS clone URL of the repository.
 * @param branchName - Name of the branch to create and push.
 * @param installationId - Optional GitHub App installation ID for authentication.
 * @returns Local path to the cloned repository.
 */
export async function codexRepository(
  prompt: string,
  repoUrl: string,
  branchName: string,
  installationId?: string
): Promise<string> {
  logger.log("codexRepository start", { repoUrl, branchName });

  // create temporary workspace
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "repo-"));
  logger.log("created temp dir", { tempDir });

  // prepare authenticated URL if GitHub App creds provided
  let cloneUrl = repoUrl;
  if (process.env.GITHUB_APP_ID && process.env.GITHUB_PRIVATE_KEY && installationId) {
    try {
      const auth = createAppAuth({
        appId: parseInt(process.env.GITHUB_APP_ID, 10),
        privateKey: process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n"),
      });
      const installation = await auth({
        type: "installation",
        installationId: parseInt(installationId, 10),
      });
      const originHost = repoUrl.replace(/^https?:\/\//, "");
      cloneUrl = `https://x-access-token:${installation.token}@${originHost}`;
      logger.log("using authenticated GitHub URL");
    } catch (err) {
      logger.warn("GitHub authentication failed, using original URL", { error: (err as Error).message });
    }
  }

  // clone and checkout branch
  execSync(`git clone ${cloneUrl} ${tempDir}`, { stdio: "inherit" });
  execSync(`git checkout -b ${branchName}`, { cwd: tempDir, stdio: "inherit" });

  // set git identity
  execSync('git config user.email "bot@uwularpy.dev"', { cwd: tempDir, stdio: "inherit" });
  execSync('git config user.name "uwularpy"', { cwd: tempDir, stdio: "inherit" });

  // Write prompt to file and pass file path to Codex CLI
  const promptFilePath = path.join(tempDir, "prompt.txt");
  fs.writeFileSync(promptFilePath, prompt, "utf-8");

  const run = spawnSync(
    "bunx",
    ["@openai/codex", "--approval-mode", "full-auto", "--model", "gpt-4.1-2025-04-14", "--quiet", "--no-tty", promptFilePath],
    {
      cwd: tempDir,
      stdio: "inherit",
      shell: true,
      env: process.env
    }
  );
  if (run.status !== 0) {
    logger.error("codex CLI exited non-zero", { status: run.status });
  } else {
    logger.log("codex CLI completed successfully");
  }

  // commit and push changes
  execSync("git add .", { cwd: tempDir, stdio: "inherit" });
  execSync('git commit -m "Apply changes from Codex CLI"', { cwd: tempDir, stdio: "inherit" });
  execSync(`git push -u origin ${branchName}`, {
    cwd: tempDir,
    stdio: "inherit",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  });

  return tempDir;
}

/**
 * Return top contributors by number of merged pull requests.
 * @param repoPath - Local path of the repository.
 * @param limit - Maximum number of contributors to return.
 */
export function getTopContributorsByMergedPRs(
  repoPath: string,
  limit: number = 5
): Array<{ name: string; count: number }> {
  logger.log("getTopContributorsByMergedPRs", { repoPath, limit });

  if (!fs.existsSync(repoPath)) {
    logger.warn("repository path does not exist", { repoPath });
    return [];
  }

  const cmd = 'git log --merges --format="%an" | sort | uniq -c | sort -nr';
  const output = execSync(cmd, { cwd: repoPath, encoding: "utf-8" }).trim();
  if (!output) return [];

  return output
    .split("\n")
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const count = parseInt(parts[0], 10);
      const name = parts.slice(1).join(" ");
      return { name, count };
    })
    .slice(0, limit);
}
