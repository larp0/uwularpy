# Installation Guide

This guide provides instructions for setting up and deploying the UwUlarpy GitHub bot.

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- A GitHub account with permission to create GitHub Apps
- A server or hosting service for the webhook handler

## GitHub App Setup

1. Go to your GitHub account settings
2. Navigate to "Developer settings" > "GitHub Apps" > "New GitHub App"
3. Fill in the required information:
   - GitHub App name: `uwularpy` (or your preferred name)
   - Description: A bot that uwuifies markdown files in repositories
   - Homepage URL: Your website or repository URL
   - Webhook URL: The URL where your webhook handler will be deployed
   - Webhook secret: Generate a random string for security
4. Set the following permissions:
   - Repository permissions:
     - Contents: Read & write
     - Issues: Read & write
     - Pull requests: Read & write
   - Organization permissions:
     - None required
   - Account permissions:
     - None required
5. Subscribe to events:
   - Issue comment
6. Choose where the app can be installed:
   - Any account (recommended)
   - Only this account
7. Click "Create GitHub App"

## Generate a Private Key

1. After creating the GitHub App, navigate to its settings page
2. Scroll down to the "Private keys" section
3. Click "Generate a private key"
4. Save the downloaded private key file securely

## Install the GitHub App

1. Navigate to the "Install App" tab on your GitHub App's settings page
2. Choose the repositories where you want to install the app
3. Click "Install"

## Deploy the Webhook Handler

### Local Development Setup

1. Clone this repository:
   ```
   git clone https://github.com/larp0/uwularpy.git
   cd uwularpy
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the `.env.example` template:
   ```
   APP_ID=your_github_app_id
   PRIVATE_KEY=your_github_app_private_key
   WEBHOOK_SECRET=your_github_webhook_secret
   ```
   
   Note: For the `PRIVATE_KEY`, you'll need to format the key as a single line with `\n` for line breaks.

4. Start the server:
   ```
   npm start
   ```

### Production Deployment

For production deployment, you can use various hosting options:

#### Option 1: Traditional Server (VPS, AWS EC2, etc.)

1. Set up a server with Node.js installed
2. Clone the repository and install dependencies
3. Set up environment variables
4. Use a process manager like PM2:
   ```
   npm install -g pm2
   pm2 start app.js --name uwularpy
   ```
5. Set up a reverse proxy with Nginx or similar
6. Configure SSL with Let's Encrypt

#### Option 2: Serverless (Vercel, Netlify, etc.)

1. Connect your repository to the serverless platform
2. Configure environment variables in the platform's dashboard
3. Deploy according to the platform's instructions

#### Option 3: Container (Docker)

1. Build the Docker image:
   ```
   docker build -t uwularpy .
   ```
2. Run the container:
   ```
   docker run -p 3000:3000 --env-file .env uwularpy
   ```

## Update Webhook URL

After deployment, make sure to update the Webhook URL in your GitHub App settings to point to your deployed webhook handler.
