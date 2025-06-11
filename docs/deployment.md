# Vercel Deployment Guide for UwUlarpy

This guide will help you deploy the UwUlarpy Next.js application to Vercel without encountering dependency errors.

## Prerequisites

- A GitHub account
- A Vercel account linked to your GitHub
- A GitHub App for webhook processing (if you plan to use the webhook functionality)

## Step 1: Deploy from GitHub

1. Log in to your Vercel account
2. Click "Add New..." → "Project"
3. Select the "uwularpy" repository
4. Vercel will automatically detect it as a Next.js project
5. Click "Deploy"

## Step 2: Configure Environment Variables

For the webhook functionality to work properly, you need to add these environment variables in Vercel:

1. Go to your project settings in Vercel
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `APP_ID`: Your GitHub App ID
   - `PRIVATE_KEY`: Your GitHub App private key (include BEGIN/END lines)
   - `WEBHOOK_SECRET`: Your GitHub webhook secret

## Step 3: Update GitHub App Webhook URL

1. Go to your GitHub App settings
2. Update the webhook URL to point to your Vercel deployment:
   `https://your-vercel-deployment.vercel.app/api/webhook`

## Troubleshooting

If you encounter any issues:

1. Check Vercel build logs for errors
2. Verify that all environment variables are correctly set
3. Ensure your GitHub App has the necessary permissions:
   - Repository contents: Read & write
   - Issues: Read & write

## Testing the Deployment

1. Create an issue in a repository where your GitHub App is installed
2. Add a comment mentioning "@uwularpy"
3. You should see an immediate reply and a new PR with uwuified content
