// src/lib/binary-uwuify.ts
// Optimized with GitHub App authentication: Bash-based markdown processing with parallel execution

import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from "@trigger.dev/sdk/v3";
import { createAppAuth } from '@octokit/auth-app';

/**
 * Process a repository with the uwuify binary
 * @param repoUrl - URL of the repository to clone
 * @param branchName - Name of the branch to create
 * @returns Path to the cloned repository
 */
export async function uwuifyRepository(repoUrl: string, branchName: string): Promise<string> {
  logger.log("Starting repository uwuification", { repoUrl, branchName });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-'));
  const uwuifyBinaryPath = path.join(process.cwd(), 'src', 'lib', 'bin', 'uwuify');

  const githubAppId = process.env.GITHUB_APP_ID;
  const githubPrivateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const githubWebhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const installationId = process.env.GITHUB_INSTALLATION_ID;

  if (!githubAppId || !githubPrivateKey || !githubWebhookSecret || !installationId) {
    logger.warn("GitHub App credentials missing. Git operations may fail.");
  }

  const repoUrlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/.]+)(?:\.git)?$/);
  const [owner, repo] = repoUrlMatch ? [repoUrlMatch[1], repoUrlMatch[2]] : [null, null];

  let authenticatedRepoUrl = repoUrl;
  let installationAuthentication;

  if (githubPrivateKey && githubAppId && owner && repo && installationId) {
    const auth = createAppAuth({
      appId: githubAppId,
      privateKey: githubPrivateKey,
    });

    installationAuthentication = await auth({
      type: "installation",
      installationId: parseInt(installationId, 10),
    });

    authenticatedRepoUrl = `https://x-access-token:${installationAuthentication.token}@github.com/${owner}/${repo}.git`;
  }

  try {
    logger.log(`Cloning repository: ${repoUrl}`);
    execSync(`git clone ${authenticatedRepoUrl} ${tempDir}`, { stdio: 'inherit' });

    logger.log(`Creating branch: ${branchName}`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit', cwd: tempDir });

    logger.log("Running uwuify via optimized bash script");

    const bashScript = `#!/usr/bin/env bash
set -e
REPO_DIR="$1"
UWUIFY="$2"

if ! command -v fd &>/dev/null; then
  echo "fd not found. Installing..."
  if command -v apt &>/dev/null; then
    sudo apt update && sudo apt install -y fd-find
    ln -sf $(command -v fdfind) /usr/local/bin/fd
  elif command -v brew &>/dev/null; then
    brew install fd
  else
    echo "No supported package manager found. Install fd manually."
    exit 1
  fi
fi

export -f uwuify_file
uwuify_file() {
  local FILE="$1"
  echo "Uwuifying: $FILE"
  "$UWUIFY" -t 32 "$FILE" > "$FILE.tmp" && mv "$FILE.tmp" "$FILE"
}

fd -e md -t f . "$REPO_DIR" --exclude node_modules --exclude .git --hidden | xargs -P $(nproc) -I {} bash -c 'uwuify_file "$@"' _ {}
`;

    const bashScriptPath = path.join(os.tmpdir(), `uwuify-script-${Date.now()}.sh`);
    fs.writeFileSync(bashScriptPath, bashScript, { mode: 0o755 });

    spawnSync(bashScriptPath, [tempDir, uwuifyBinaryPath], { stdio: 'inherit' });
    fs.unlinkSync(bashScriptPath);

    logger.log("Committing changes");
    execSync('git add .', { stdio: 'inherit', cwd: tempDir });
    execSync('git commit -m "uwu"', { stdio: 'inherit', cwd: tempDir });

    if (installationAuthentication && owner && repo) {
      logger.log("Configuring Git with GitHub App authentication");
      execSync(`git remote set-url origin https://x-access-token:${installationAuthentication.token}@github.com/${owner}/${repo}.git`, { stdio: 'inherit', cwd: tempDir });
    }

    logger.log("Pushing changes");
    execSync(`git push origin ${branchName}`, { stdio: 'inherit', cwd: tempDir });

    return tempDir;
  } catch (error) {
    logger.error(`Error during uwuifyRepository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Get the top contributors by merged PRs
 */
export function getTopContributorsByMergedPRs(repoDir: string, count: number = 5): Array<{name: string, count: number}> {
  try {
    const gitLogOutput = execSync(
      'git log --merges --pretty=format:"%an" | grep -v "^$"',
      { encoding: 'utf-8', cwd: repoDir }
    );

    const authorCounts: Record<string, number> = {};
    gitLogOutput.split('\n').forEach(author => {
      author = author.trim();
      if (author) authorCounts[author] = (authorCounts[author] || 0) + 1;
    });

    return Object.entries(authorCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, count);
  } catch (error) {
    logger.error(`Error retrieving top contributors: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}
