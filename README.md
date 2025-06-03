# UwUlarpy

A Next.js application that uwuifies markdown files, performs code reviews, and generates comprehensive development plans for GitHub repositories when mentioned in issue comments.

## Features

- **Webhook Handler**: Processes GitHub webhook events for issue comments
- **Automatic UwUification**: Transforms markdown content while preserving code blocks
- **Code Review**: Performs comprehensive code reviews on pull requests using AI
- **Development Planning**: Generates comprehensive development plans with milestones and GitHub issues
- **Immediate Feedback**: Replies to mentions with instant status updates
- **Pull Request Creation**: Creates PRs with changes for review

## Tech Stack

- **Next.js**: Modern React framework with API routes
- **TypeScript**: Type-safe code for improved maintainability
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Octokit**: GitHub API client for JavaScript/TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A GitHub account
- A registered GitHub App with appropriate permissions

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/larp0/uwularpy.git
   cd uwularpy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your GitHub App credentials:
   ```
   APP_ID=your_github_app_id
   PRIVATE_KEY=your_github_app_private_key
   WEBHOOK_SECRET=your_github_webhook_secret
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) to view the application

## Usage

1. Install the UwUlarpy GitHub App on your repositories
2. Create or open an issue in your repository
3. Add a comment that mentions `@uwularpy` with one of these commands:
   - `@uwularpy` - Uwuify all markdown files in the repository
   - `@uwularpy r` - Perform a comprehensive code review (use in pull requests)
   - `@uwularpy plan` - Generate a comprehensive development plan with milestones and issues
   - `@uwularpy <custom message>` - Process repository with custom instructions using AI
4. The bot will immediately reply and process your request

### Plan Command Details

The `@uwularpy plan` command creates a comprehensive development analysis including:

- **Repository Analysis**: Complete codebase structure and metadata review
- **Missing Components**: Identification of essential features or infrastructure gaps
- **Critical Fixes**: Security issues and bugs requiring immediate attention
- **Required Improvements**: Technical debt and code quality enhancements
- **Innovation Ideas**: 5 creative feature suggestions for project enhancement
- **GitHub Integration**: Automatically creates a milestone and individual issues for tracking

Example workflow:
1. Comment `@uwularpy plan` on any issue
2. The bot analyzes your entire repository
3. A milestone is created with the complete plan
4. Individual GitHub issues are generated for each action item
5. Issues are categorized by priority (Critical, High, Normal, Feature)

## Deployment

This application can be deployed to any platform that supports Next.js:

- **Vercel**: Recommended for seamless deployment
- **Netlify**: Great alternative with similar features
- **Self-hosted**: For complete control over your environment

## Documentation

For detailed documentation, see [DOCUMENTATION.md](DOCUMENTATION.md)

## License

MIT

## Acknowledgements

- [uwuify](https://www.npmjs.com/package/uwuify) - The JavaScript library for uwuifying text
- [Octokit](https://github.com/octokit) - GitHub API client for JavaScript
- [Next.js](https://nextjs.org/) - The React framework for production
