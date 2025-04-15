// src/services/github-auth.ts

import crypto from "crypto";

/**
 * Verify GitHub webhook signature
 * 
 * @param payload The raw request body
 * @param signature The signature from the x-hub-signature-256 header
 * @returns boolean indicating if the signature is valid
 */
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
