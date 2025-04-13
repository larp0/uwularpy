# Testing the Webhook Functionality

After deploying your uwularpy webhook to Vercel, follow these steps to test that everything is working correctly.

## Prerequisites

1. Your GitHub App is installed on a repository
2. The webhook URL in your GitHub App settings is pointing to your Vercel deployment
3. All environment variables are properly set in Vercel:
   - `APP_ID`: Your GitHub App ID
   - `PRIVATE_KEY`: Your GitHub App private key
   - `WEBHOOK_SECRET`: Your GitHub webhook secret

## Testing Steps

1. **Create a new issue in a repository** where your GitHub App is installed
   - Any simple issue title will work, e.g., "Testing uwularpy webhook"

2. **Add a comment mentioning "@uwularpy"**
   - The comment should include the text "@uwularpy" to trigger the webhook
   - Example: "Hey @uwularpy, can you uwuify this repository?"

3. **Verify the immediate reply**
   - You should immediately see a reply comment saying "see you, uwuing..."
   - This confirms that the webhook received your mention and is processing it

4. **Check for the new branch and PR**
   - After a short time, a new branch named `uwuify-issue-X` should be created
   - A pull request with uwuified markdown files should be created
   - You should receive a notification in the issue when the PR is ready

## Troubleshooting

If the webhook doesn't respond:

1. **Check Vercel logs**
   - Go to your Vercel dashboard → Project → Deployments → Latest deployment → Functions
   - Look for the webhook function logs to see any errors

2. **Verify GitHub App settings**
   - Ensure your GitHub App has the necessary permissions:
     - Repository contents: Read & write
     - Issues: Read & write
   - Confirm the webhook URL is correct and points to `/api/webhook` on your Vercel deployment

3. **Check environment variables**
   - Verify all environment variables are correctly set in Vercel
   - Make sure the private key includes the BEGIN/END lines and all newlines are preserved

4. **Test webhook delivery**
   - In your GitHub App settings, go to the Advanced tab
   - Find a recent delivery and click "Redeliver" to test again

## Next Steps

Once you've confirmed the webhook is working correctly, you can:

1. Install your GitHub App on more repositories
2. Share the GitHub App with others
3. Consider adding more features to the uwuification process
