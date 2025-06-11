# 🐾 UwUlarpy

[![Next.js](https://img.shields.io/badge/Next.js-15.3.3-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Issues](https://img.shields.io/github/issues/larp0/uwularpy)](https://github.com/larp0/uwularpy/issues)
[![GitHub Stars](https://img.shields.io/github/stars/larp0/uwularpy)](https://github.com/larp0/uwularpy/stargazers)

A powerful Next.js GitHub App that transforms your repository workflow with AI-powered features: automatic markdown uwuification, comprehensive code reviews, and intelligent development planning through simple issue comments.

## ✨ Features

- **🤖 Webhook Handler**: Processes GitHub webhook events for seamless integration
- **🌸 Automatic UwUification**: Transforms markdown content while intelligently preserving code blocks
- **🔍 AI Code Review**: Performs comprehensive code reviews on pull requests using advanced AI
- **📋 Development Planning**: Generates detailed development plans with milestones and GitHub issues
- **⚡ Immediate Feedback**: Provides instant status updates and replies to mentions
- **🔄 Pull Request Automation**: Creates PRs with changes for streamlined review workflows

## 🛠️ Tech Stack

- **[Next.js](https://nextjs.org/)**: Modern React framework with API routes for optimal performance
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe development for improved maintainability and fewer bugs
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework for rapid, responsive styling
- **[Octokit](https://github.com/octokit)**: Official GitHub API client for JavaScript/TypeScript
- **[OpenAI API](https://openai.com/api/)**: AI-powered code analysis and review capabilities

## 🚀 Getting Started

### Prerequisites

Before setting up UwUlarpy, ensure you have:

- **Node.js 18+** and **npm** installed on your system
- A **GitHub account** with repository access
- A **registered GitHub App** with appropriate webhook permissions
- An **OpenAI API key** for AI-powered features (optional but recommended)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/larp0/uwularpy.git
   cd uwularpy
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Add your credentials:
   ```env
   # GitHub App Configuration
   APP_ID=your_github_app_id
   PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
   your_github_app_private_key_here
   -----END RSA PRIVATE KEY-----"
   WEBHOOK_SECRET=your_github_webhook_secret
   
   # OpenAI Configuration (optional)
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   
   Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### GitHub App Setup

For detailed GitHub App configuration, see our **[Deployment Guide](docs/deployment.md)**.

## 💬 Usage

### Quick Start

1. **Install the UwUlarpy GitHub App** on your repositories
2. **Open or create an issue** in your repository  
3. **Mention UwUlarpy** with one of the available commands
4. **Watch the magic happen** - UwUlarpy replies instantly and processes your request

### Available Commands

| Command | Description | Use Case |
|---------|-------------|----------|
| `@uwularpy` | Uwuify all markdown files in the repository | Transform documentation with kawaii style |
| `@uwularpy r` | Perform comprehensive AI code review | Get detailed feedback on pull requests |
| `@uwularpy plan` | Generate development plan with milestones | Create structured roadmap for your project |
| `@uwularpy <message>` | Process custom AI instructions | Handle specific requirements with AI |

### Example Usage

**UwUify Documentation:**
```
@uwularpy
```
*Result: Creates a PR with all markdown files transformed to uwu style*

**Code Review:**
```
@uwularpy r
```
*Result: Provides detailed code analysis and improvement suggestions*

**Development Planning:**
```
@uwularpy plan
```
*Result: Creates milestone with organized issues for project development*

**Custom Instructions:**
```
@uwularpy can you analyze our testing coverage and suggest improvements?
```
*Result: AI-powered analysis with actionable recommendations*

### 📋 Plan Command Deep Dive

The `@uwularpy plan` command is our flagship feature that creates comprehensive development analysis including:

#### What It Analyzes
- **📊 Repository Analysis**: Complete codebase structure and metadata review
- **🔍 Missing Components**: Identification of essential features or infrastructure gaps  
- **🚨 Critical Fixes**: Security issues and bugs requiring immediate attention
- **⚡ Required Improvements**: Technical debt and code quality enhancements
- **💡 Innovation Ideas**: 5 creative feature suggestions for project enhancement

#### GitHub Integration
- **🎯 Milestone Creation**: Automatically creates a milestone with the complete plan
- **📝 Issue Generation**: Individual GitHub issues for each action item
- **🏷️ Smart Categorization**: Issues categorized by priority (Critical, High, Normal, Feature)
- **📈 Progress Tracking**: Built-in milestone tracking for development progress

#### Example Workflow
1. Comment `@uwularpy plan` on any issue
2. UwUlarpy analyzes your entire repository  
3. A milestone is created with the complete development plan
4. Individual GitHub issues are generated for each action item
5. Issues are automatically categorized and prioritized
6. Track progress through the milestone view

## 🚀 Deployment

UwUlarpy can be deployed to any platform that supports Next.js. We recommend these options:

| Platform | Difficulty | Features | Documentation |
|----------|------------|----------|---------------|
| **[Vercel](https://vercel.com/)** | ⭐ Easy | Zero-config, instant deploys, edge functions | [Deploy Guide](docs/deployment.md) |
| **[Netlify](https://netlify.com/)** | ⭐⭐ Medium | Great CI/CD, form handling, edge functions | [Deploy Guide](docs/deployment.md) |
| **Self-hosted** | ⭐⭐⭐ Advanced | Complete control, custom infrastructure | [Deploy Guide](docs/deployment.md) |

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/import/project?template=https://github.com/larp0/uwularpy)

For detailed deployment instructions, see our **[Deployment Documentation](docs/deployment.md)**.

## 📚 Documentation

### Complete Documentation
- **[📖 Technical Documentation](docs/technical.md)** - Architecture, API reference, and implementation details
- **[🚀 Deployment Guide](docs/deployment.md)** - Step-by-step deployment for all platforms  
- **[🧪 Testing Guide](docs/testing.md)** - How to test and validate your UwUlarpy installation
- **[📋 Documentation Index](docs/README.md)** - Navigate all available documentation

### Quick Links
- **[GitHub Repository](https://github.com/larp0/uwularpy)** - Source code and issue tracking
- **[Release Notes](https://github.com/larp0/uwularpy/releases)** - Latest updates and features
- **[Contributing Guidelines](https://github.com/larp0/uwularpy/blob/main/CONTRIBUTING.md)** - How to contribute to the project

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **🐛 Report Bugs**: [Open an issue](https://github.com/larp0/uwularpy/issues/new) with detailed information
2. **💡 Suggest Features**: Share your ideas through [GitHub Discussions](https://github.com/larp0/uwularpy/discussions)
3. **🔧 Submit Code**: Fork the repo, make changes, and submit a pull request
4. **📖 Improve Docs**: Help us make documentation clearer and more comprehensive

### Development Setup

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/uwularpy.git
cd uwularpy

# Install dependencies
npm install

# Create your feature branch
git checkout -b feature/amazing-feature

# Start development server
npm run dev

# Run tests
npm test

# Build and verify
npm run build
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

We're grateful to these amazing open source projects that make UwUlarpy possible:

- **[uwuify](https://www.npmjs.com/package/uwuify)** - The JavaScript library that brings the kawaii magic ✨
- **[Octokit](https://github.com/octokit)** - Powerful GitHub API client for seamless integration 🐙
- **[Next.js](https://nextjs.org/)** - The React framework that powers our modern web experience ⚡
- **[OpenAI](https://openai.com/)** - AI capabilities that enable intelligent code review and planning 🤖
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety that keeps our code reliable 🛡️

## ❓ Support

Need help? We're here for you:

- **📖 Check the [Documentation](docs/README.md)** for comprehensive guides
- **🐛 Found a bug?** [Report it here](https://github.com/larp0/uwularpy/issues/new)
- **💬 Have questions?** [Start a discussion](https://github.com/larp0/uwularpy/discussions)
- **📧 Need direct help?** Contact the maintainers through GitHub

---

<div align="center">

**Made with 💖 by the UwUlarpy team**

[⭐ Star us on GitHub](https://github.com/larp0/uwularpy) • [🐛 Report Issues](https://github.com/larp0/uwularpy/issues) • [💬 Join Discussions](https://github.com/larp0/uwularpy/discussions)

</div>
