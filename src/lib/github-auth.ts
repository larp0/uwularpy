// src/lib/github-auth.ts

import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';

/**
 * Creates an authenticated Octokit instance for GitHub API interactions
 * 
 * @param installationId - The installation ID of the GitHub App
 * @returns An authenticated Octokit instance
 */
export async function createAuthenticatedOctokit(installationId: number): Promise<Octokit> {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    throw new Error('GitHub App credentials not configured. Please set APP_ID and PRIVATE_KEY environment variables.');
  }
  
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });
}

/**
 * Verifies the GitHub webhook signature
 * 
 * @param payload - The raw request payload
 * @param signature - The signature from the X-Hub-Signature-256 header
 * @returns Boolean indicating if the signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    throw new Error('Webhook secret not configured. Please set WEBHOOK_SECRET environment variable.');
  }
  
  if (!signature) {
    return false;
  }
  
  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
    return false;
  }
}
