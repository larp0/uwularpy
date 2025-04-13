# GitHub Authentication Configuration for Next.js

This file contains the implementation of GitHub authentication for the Next.js version of the uwularpy webhook handler.

## Environment Variables

Create a `.env.local` file in the root of your Next.js project with the following variables:

```
APP_ID=your_github_app_id
PRIVATE_KEY=your_github_app_private_key
WEBHOOK_SECRET=your_github_webhook_secret
```

## Authentication Implementation

The GitHub authentication is implemented in the webhook route handler using the `@octokit/auth-app` package. The authentication flow works as follows:

1. The webhook receives a request from GitHub
2. The request signature is verified using the webhook secret
3. For authenticated actions (like creating branches and PRs), an Octokit instance is created with the GitHub App credentials
4. The Octokit instance uses the installation ID from the webhook payload to authenticate as the GitHub App installation

## Security Considerations

- The private key should be kept secure and never committed to the repository
- Environment variables should be properly set in both development and production environments
- The webhook secret should be randomly generated and kept secure
