import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { logger } from "@trigger.dev/sdk/v3";

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
      logger.warn(`${context} failed, retrying in ${delay}ms`, { 
        error: lastError.message,
        attempt,
        maxAttempts
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Retry operation failed');
}

/**
 * Create an authenticated Octokit instance using GitHub App credentials
 * Shared utility to eliminate code duplication across implementations
 */
export async function createAuthenticatedOctokit(installationId: number): Promise<Octokit> {
  // Validate installation ID
  if (!installationId || typeof installationId !== 'number' || installationId <= 0) {
    logger.error("Invalid installation ID provided", { installationId });
    throw new Error("Invalid installation ID");
  }

  // Get and validate environment variables
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  
  // Enhanced validation without logging sensitive data
  if (!appId || typeof appId !== 'string') {
    logger.error("GITHUB_APP_ID environment variable missing or invalid");
    throw new Error("GitHub App ID not configured");
  }
  
  if (!privateKey || typeof privateKey !== 'string') {
    logger.error("GITHUB_PRIVATE_KEY environment variable missing or invalid");
    throw new Error("GitHub Private Key not configured");
  }
  
  // Validate App ID format
  const appIdNumber = parseInt(appId, 10);
  if (isNaN(appIdNumber) || appIdNumber <= 0) {
    logger.error("GITHUB_APP_ID must be a valid positive number");
    throw new Error("Invalid GitHub App ID format");
  }
  
  // Process private key securely
  const processedPrivateKey = privateKey.replace(/\\n/g, '\n');
  
  // Basic validation of private key format (without logging the key)
  if (!processedPrivateKey.includes('-----BEGIN') || !processedPrivateKey.includes('-----END')) {
    logger.error("GITHUB_PRIVATE_KEY does not appear to be in valid PEM format");
    throw new Error("Invalid private key format");
  }

  try {
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { 
        appId: appIdNumber, 
        privateKey: processedPrivateKey, 
        installationId 
      }
    });
    
    // Test authentication by making a simple API call
    await retryWithBackoff(
      async () => {
        await octokit.apps.getAuthenticated();
      },
      2, // Limited retries for auth test
      1000,
      "Authentication test"
    );
    
    logger.info("Successfully created authenticated Octokit instance", { 
      installationId,
      appId: appIdNumber
    });
    
    return octokit;
    
  } catch (error) {
    logger.error("Failed to create or test authenticated Octokit instance", { 
      error: error instanceof Error ? error.message : 'Unknown error',
      installationId,
      hasAppId: !!appId,
      hasPrivateKey: !!privateKey
    });
    throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
