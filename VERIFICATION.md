# Verifying Uwularpy Deployment on Vercel

This guide will help you verify that your uwularpy webhook is properly deployed and functioning on Vercel.

## Prerequisites

Before testing, ensure:

1. Your Vercel deployment is complete and showing as "Ready"
2. You've set the following environment variables in your Vercel project:
   - `APP_ID`: Your GitHub App ID
   - `PRIVATE_KEY`: Your GitHub App private key (including BEGIN/END lines)
   - `WEBHOOK_SECRET`: Your GitHub webhook secret
3. Your GitHub App webhook URL is pointing to your Vercel deployment URL + `/api/webhook`
   - Example: `https://uwularpy.vercel.app/api/webhook`

## Testing the Webhook

### Step 1: Create a Test Issue
1. Go to a repository where your GitHub App is installed
2. Create a new issue with any title (e.g., "Testing uwularpy webhook")

### Step 2: Mention @uwularpy
1. Add a comment to the issue that includes "@uwularpy"
2. Example: "Hey @uwularpy, can you uwuify this repository?"

### Step 3: Verify Immediate Response
1. You should immediately see a reply comment saying "see you, uwuing..."
2. This confirms that the webhook received your mention and is processing it

### Step 4: Check for Branch and PR Creation
1. After a short time (usually within a minute), a new branch named `uwuify-issue-X` should be created
2. A pull request with uwuified markdown files should be created
3. You should receive a notification in the issue when the PR is ready

## Troubleshooting

If the webhook doesn't respond:

### Check Vercel Logs
1. Go to your Vercel dashboard
2. Navigate to your project
3. Click on "Deployments" and select the latest deployment
4. Click on "Functions" to view function logs
5. Look for any errors in the webhook function

### Verify Environment Variables
1. In your Vercel project, go to "Settings" → "Environment Variables"
2. Ensure all required variables are set correctly
3. Make sure the private key includes the BEGIN/END lines and all newlines are preserved

### Check GitHub App Configuration
1. Go to your GitHub App settings
2. Verify the webhook URL is correct and points to your Vercel deployment
3. Ensure the App has the necessary permissions:
   - Repository contents: Read & write
   - Issues: Read & write
4. Confirm the App is subscribed to "Issue comment" events

### Test Webhook Manually
1. In your GitHub App settings, go to the "Advanced" tab
2. Find a recent delivery and click "Redeliver" to test again
3. Check the response status and body for any errors

## Next Steps

Once you've confirmed the webhook is working correctly:
1. Install your GitHub App on more repositories
2. Share the GitHub App with others
3. Consider adding more features to the uwuification process
