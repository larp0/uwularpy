# UwUlarpy Next.js Documentation

This documentation provides comprehensive information about the Next.js implementation of the UwUlarpy GitHub App webhook handler.

## Overview

UwUlarpy is a GitHub App that automatically uwuifies markdown files in repositories when mentioned in issue comments. The application has been refactored from an Express.js implementation to a modern Next.js application, providing improved maintainability, type safety with TypeScript, and a clean frontend interface.

## Project Structure

```
uwularpy-nextjs/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── webhook/
│   │   │       └── route.ts    # Webhook handler API route
│   │   └── page.tsx            # Frontend landing page
│   └── lib/
│       ├── github-auth.ts      # GitHub authentication utilities
│       └── uwuify.ts           # Uwuification utilities
├── .env.local                  # Environment variables (create from .env.example)
├── next.config.ts              # Next.js configuration
└── package.json                # Project dependencies
```

## Key Components

### Webhook Handler (src/app/api/webhook/route.ts)

The webhook handler is implemented as a Next.js API route that:
- Receives GitHub webhook events
- Verifies the webhook signature
- Processes issue comment events that mention @uwularpy
- Creates a new branch
- Uwuifies all markdown files in the repository
- Creates a pull request with the uwuified content

### GitHub Authentication (src/lib/github-auth.ts)

This module provides utilities for GitHub authentication:
- `createAuthenticatedOctokit`: Creates an authenticated Octokit instance for GitHub API interactions
- `verifyWebhookSignature`: Verifies the GitHub webhook signature

### Uwuification Logic (src/lib/uwuify.ts)

This module provides utilities for uwuifying content:
- `uwuifyMarkdown`: Uwuifies markdown content while preserving code blocks
- `uwuifyRepositoryMarkdownFiles`: Processes all markdown files in a repository and uwuifies them

### Frontend Interface (src/app/page.tsx)

A clean, responsive landing page that provides:
- Information about the UwUlarpy GitHub App
- Installation instructions
- Usage guidelines

## Environment Variables

Create a `.env.local` file with the following variables:

```
# GitHub App Configuration
GITHUB_APP_ID=your_github_app_id
GITHUB_PRIVATE_KEY=your_github_app_private_key
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret

# Trigger.dev Configuration  
TRIGGER_DEV_TOKEN=your_trigger_dev_token

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key

# Optional: Trigger.dev API URL (defaults to production if not specified)
# TRIGGER_API_URL=https://api.trigger.dev
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env.local` file with the required environment variables
4. Run the development server: `npm run dev`

## Deployment

The application can be deployed to any platform that supports Next.js applications, such as:
- Vercel
- Netlify
- AWS Amplify
- Self-hosted servers

## GitHub App Configuration

1. Create a GitHub App at https://github.com/settings/apps/new
2. Set the webhook URL to your deployed application's webhook endpoint
3. Generate a private key and note the App ID
4. Set the required permissions:
   - Repository contents: Read & write
   - Issues: Read & write
5. Subscribe to events:
   - Issue comment

## Usage

Once the GitHub App is installed on repositories, users can:
1. Create or open an issue in the repository
2. Add a comment that mentions @uwularpy
3. The bot will immediately reply with "see you, uwuing..."
4. A new branch will be created with uwuified markdown files
5. A pull request will be created for review and merging

## Differences from Express Implementation

The Next.js implementation offers several improvements over the original Express implementation:
- TypeScript support for improved type safety
- Modular code structure with separation of concerns
- Built-in API routes without need for separate server setup
- Modern frontend with Tailwind CSS
- Improved error handling and logging
- Better developer experience with hot reloading
