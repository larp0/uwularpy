// src/services/github-auth.ts

import crypto from "crypto";

/**
 * Verify GitHub webhook signature using HMAC-SHA256
 * Implements timing-safe comparison to prevent timing attacks
 * 
 * @param payload The raw request body
 * @param signature The signature from the x-hub-signature-256 header
 * @returns boolean indicating if the signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  // Validate signature format
  if (!signature || typeof signature !== 'string') {
    console.warn("Invalid or missing webhook signature");
    return false;
  }

  // Check signature format (should start with "sha256=")
  if (!signature.startsWith('sha256=')) {
    console.warn("Webhook signature does not have expected sha256= prefix");
    return false;
  }

  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret || typeof webhookSecret !== 'string') {
    console.error("GITHUB_WEBHOOK_SECRET environment variable not set or invalid");
    return false;
  }

  // Validate payload
  if (typeof payload !== 'string') {
    console.warn("Invalid payload type for signature verification");
    return false;
  }

  try {
    const hmac = crypto.createHmac("sha256", webhookSecret);
    const digest = "sha256=" + hmac.update(payload, 'utf8').digest("hex");
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (error) {
    console.error("Error during signature verification:", error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}
