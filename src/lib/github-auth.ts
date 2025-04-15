// src/lib/github-auth.ts

import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import crypto from "crypto";

// Verify webhook signature
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("GITHUB_WEBHOOK_SECRET environment variable not set");
    return false;
  }

  const hmac = crypto.createHmac("sha256", webhookSecret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
