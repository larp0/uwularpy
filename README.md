# UwUlarpy

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

A powerful Next.js application that transforms your GitHub repositories through AI-powered automation. UwUlarpy provides uwuification of markdown files, comprehensive code reviews, and intelligent development planning when mentioned in issue comments.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Support](#support)
- [Documentation](#documentation)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Features

UwUlarpy offers a comprehensive suite of AI-powered automation tools designed to enhance your GitHub workflow:

- 🤖 **Intelligent Webhook Processing**: Automatically processes GitHub webhook events for seamless issue comment integration
- ✨ **Advanced UwUification Engine**: Transforms markdown content with sophisticated text processing while intelligently preserving code blocks and formatting structures
- 🔍 **AI-Powered Code Review**: Delivers comprehensive, context-aware code reviews on pull requests using cutting-edge AI analysis and best practices
- 📋 **Automated Development Planning**: Generates detailed development roadmaps with strategic milestones and organized GitHub issue creation
- ⚡ **Real-time Feedback System**: Provides immediate status updates and progress tracking for all bot interactions
- 🔄 **Seamless Pull Request Management**: Automatically creates well-formatted PRs with proposed changes for streamlined review and merging
- 🎯 **Custom AI Task Processing**: Handles complex custom instructions and repository-specific requests using advanced AI reasoning
- 📊 **Deep Repository Analysis**: Performs complete codebase structure analysis, metadata review, and architectural assessment
- 🔒 **Security-First Approach**: Built with security best practices and safe handling of sensitive repository data
- 🌐 **Multi-Platform Compatibility**: Works seamlessly across different GitHub repository types and project structures

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

## Installation

### Prerequisites

Before installing UwUlarpy, ensure you have the following:

- **Node.js** version 18 or higher ([Download here](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Git** for repository management
- A **GitHub account** with administrative access to target repositories
- A **registered GitHub App** with appropriate webhook and repository permissions

### Method 1: Clone and Setup (Recommended)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/larp0/uwularpy.git
   cd uwularpy
   ```

2. **Install dependencies**:
   ```bash
   # Using npm
   npm install
   
   # Or using yarn
   yarn install
   ```

3. **Environment configuration**:
   ```bash
   # Copy the example environment file
   cp .env.example .env.local
   ```

4. **Configure your GitHub App credentials** in `.env.local`:
   ```env
   # GitHub App Configuration
   APP_ID=your_github_app_id
   PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nyour_github_app_private_key\n-----END RSA PRIVATE KEY-----"
   WEBHOOK_SECRET=your_github_webhook_secret
   
   # Optional: AI Service Configuration
   OPENAI_API_KEY=your_openai_api_key
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Verify installation**:
   Open [http://localhost:3000](http://localhost:3000) to confirm the application is running

### Method 2: Docker Setup (Alternative)

1. **Using Docker Compose**:
   ```bash
   git clone https://github.com/larp0/uwularpy.git
   cd uwularpy
   cp .env.example .env.local
   # Configure your .env.local file
   docker-compose up -d
   ```

### Method 3: Direct Deployment

For production deployments, see the [Deployment](#deployment) section below.

### GitHub App Registration

To use UwUlarpy, you'll need to create a GitHub App:

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Configure the required permissions and webhook URL
4. Generate and download your private key
5. Note your App ID and webhook secret

For detailed GitHub App setup instructions, see [DOCUMENTATION.md](DOCUMENTATION.md).

## Usage

### Quick Start

1. **Install the UwUlarpy GitHub App** on your target repositories
2. **Navigate to any repository issue** where you want to use the bot
3. **Mention the bot** with `@uwularpy` followed by your command
4. **Wait for processing** - the bot will reply immediately and process your request

### Available Commands

| Command | Description | Usage Context |
|---------|-------------|---------------|
| `@uwularpy` | Uwuifies all markdown files in the repository | Any issue comment |
| `@uwularpy r` | Performs comprehensive AI code review | Pull request comments |
| `@uwularpy plan` | Generates development plan with milestones | Any issue comment |
| `@uwularpy <custom>` | Processes custom AI-powered requests | Any issue comment |

### Command Examples

#### Basic UwUification
```bash
# Transform all markdown files in the repository
@uwularpy

# The bot will:
# 1. Scan all .md files in the repo
# 2. Apply uwuification while preserving code blocks
# 3. Create a pull request with the changes
```

#### Code Review
```bash
# Request comprehensive code review (use in PR comments)
@uwularpy r

# The bot will analyze:
# - Code quality and best practices
# - Security vulnerabilities  
# - Performance optimizations
# - Documentation completeness
# - Test coverage
```

#### Development Planning
```bash
# Generate a comprehensive development plan
@uwularpy plan

# Creates:
# - Repository analysis report
# - Strategic development roadmap
# - GitHub milestone with categorized issues
# - Priority-based task organization
```

#### Custom AI Requests
```bash
# Documentation improvement suggestions
@uwularpy please help me improve the documentation structure and add missing API references

# Security analysis
@uwularpy analyze the security vulnerabilities in this codebase and suggest improvements

# Performance optimization
@uwularpy suggest performance improvements for the database queries and API endpoints

# Architecture review
@uwularpy review the current architecture and suggest scalability improvements
```

### Advanced Usage Patterns

#### Combining Commands
```bash
# Sequential workflow example:
# 1. First, generate a plan
@uwularpy plan

# 2. Then request specific analysis
@uwularpy analyze the authentication system for security issues

# 3. Finally, review implementation
@uwularpy r
```

#### Repository-Specific Requests
```bash
# Framework-specific improvements
@uwularpy suggest Next.js specific optimizations for this application

# Language-specific analysis  
@uwularpy review TypeScript code for type safety improvements

# Infrastructure suggestions
@uwularpy analyze the deployment configuration and suggest improvements
```

## Configuration

### Environment Variables

UwUlarpy uses environment variables for configuration. Create a `.env.local` file with:

```env
# Required: GitHub App Configuration
APP_ID=123456                          # Your GitHub App ID
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
WEBHOOK_SECRET=your_webhook_secret      # GitHub webhook secret

# Optional: AI Service Configuration  
OPENAI_API_KEY=sk-...                  # OpenAI API key for enhanced features
MODEL_NAME=gpt-4                       # AI model to use (default: gpt-3.5-turbo)

# Optional: Application Configuration
PORT=3000                              # Server port (default: 3000)
NODE_ENV=development                   # Environment mode
LOG_LEVEL=info                         # Logging level (debug, info, warn, error)

# Optional: Rate Limiting
RATE_LIMIT_REQUESTS=100                # Max requests per window
RATE_LIMIT_WINDOW=3600                 # Rate limit window in seconds
```

### GitHub App Permissions

Your GitHub App requires the following permissions:

**Repository Permissions:**
- Contents: Read & Write (for file modifications)
- Issues: Write (for creating issues and comments)
- Pull Requests: Write (for creating and reviewing PRs)
- Metadata: Read (for repository information)

**Organization Permissions:**
- Members: Read (for team information)

**Webhook Events:**
- Issue comments
- Pull request reviews
- Pull requests

### Customization Options

#### UwUification Settings
```javascript
// Configure in your environment or code
const uwuSettings = {
  preserveCodeBlocks: true,    // Keep code blocks unchanged
  preserveLinks: true,         // Keep URLs intact
  intensity: 'medium'          // uwu intensity: low, medium, high
};
```

#### AI Review Parameters
```javascript
const reviewConfig = {
  includeSecurityCheck: true,   // Include security analysis
  checkPerformance: true,       // Analyze performance issues
  reviewTests: true,           // Review test coverage
  suggestionLevel: 'detailed'   // brief, standard, detailed
};
```

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

UwUlarpy supports multiple deployment options to fit your infrastructure needs:

### Vercel (Recommended)

1. **Fork the repository** to your GitHub account
2. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "New Project" and import your fork
   - Configure environment variables in Vercel dashboard
3. **Set environment variables** in Vercel:
   ```
   APP_ID=your_github_app_id
   PRIVATE_KEY=your_private_key
   WEBHOOK_SECRET=your_webhook_secret
   ```
4. **Deploy** - Vercel will automatically deploy on push

### Netlify

1. **Build command**: `npm run build`
2. **Publish directory**: `dist`
3. **Environment variables**: Same as Vercel setup
4. **Functions**: Enable Netlify Functions for API routes

### Self-Hosted

#### Using PM2 (Production)
```bash
# Install PM2 globally
npm install -g pm2

# Build the application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Using Docker
```bash
# Build the image
docker build -t uwularpy .

# Run the container
docker run -d \
  --name uwularpy \
  -p 3000:3000 \
  -e APP_ID=your_app_id \
  -e PRIVATE_KEY="your_private_key" \
  -e WEBHOOK_SECRET=your_webhook_secret \
  uwularpy
```

#### Using Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  uwularpy:
    build: .
    ports:
      - "3000:3000"
    environment:
      - APP_ID=${APP_ID}
      - PRIVATE_KEY=${PRIVATE_KEY}
      - WEBHOOK_SECRET=${WEBHOOK_SECRET}
    restart: unless-stopped
```

### Production Considerations

- **HTTPS Required**: GitHub webhooks require HTTPS endpoints
- **Environment Security**: Use secure environment variable management
- **Monitoring**: Implement logging and monitoring for production use
- **Rate Limiting**: Configure appropriate rate limits for your usage
- **Scaling**: Consider horizontal scaling for high-traffic scenarios

## Contributing

We enthusiastically welcome contributions to UwUlarpy! Whether you're fixing bugs, adding features, improving documentation, or sharing ideas, your involvement helps make this project better for everyone.

### Development Workflow


```mermaid
flowchart TD
  A["Next.js Frontend"] --> B["API Routes"]
  B --> C["GitHub Webhook Handler"]
  B --> D["AI Integration Module"]
  C --> E["GitHub API Client (Octokit)"]
  D --> F["OpenAI API (ChatGPT)"]
  E --> G["Repository Analysis"]
  E --> H["Issue & PR Management"]
  G --> I["UWUification Engine"]
  G --> J["Code Review Engine"]
  G --> K["Development Planning Engine"]
  H --> L["Milestone & Issue Creator"]
  H --> M["Pull Request Creator"]
  
  subgraph CONFIG["Configuration"]
    N["Environment Variables"]
    O["GitHub App Credentials"]
  end
  CONFIG --> B
  CONFIG --> D
  
  subgraph SUPPORT["Support & Contributing"]
    P["Issue Templates"]
    Q["Documentation"]
  end
```

#### 1. Initial Setup
```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/uwularpy.git
cd uwularpy

# Add upstream remote for syncing
git remote add upstream https://github.com/larp0/uwularpy.git
```

#### 2. Development Environment
```bash
# Install dependencies
npm install

# Copy environment file and configure
cp .env.example .env.local
# Edit .env.local with your GitHub App credentials

# Start development server
npm run dev
```

#### 3. Feature Development
```bash
# Create a feature branch from main
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# Make your changes and test thoroughly
npm run test
npm run lint
npm run type-check

# Commit your changes with conventional commits
git add .
git commit -m "feat: add new feature description"
```

#### 4. Quality Assurance
```bash
# Run comprehensive quality checks
npm run quality-check

# This includes:
# - TypeScript type checking
# - ESLint code quality analysis  
# - Prettier code formatting
# - Jest unit tests
# - Integration tests
```

#### 5. Submission
```bash
# Push to your fork
git push origin feature/your-feature-name

# Create a Pull Request on GitHub
# - Use a clear, descriptive title
# - Fill out the PR template completely
# - Link any related issues
```

### Contribution Guidelines

#### Code Standards
- **TypeScript**: Use strict TypeScript with proper type definitions
- **ESLint**: Follow the configured ESLint rules
- **Prettier**: Code must be formatted with Prettier
- **Testing**: Include tests for new functionality
- **Documentation**: Update relevant documentation

#### Commit Convention
We use [Conventional Commits](https://www.conventionalcommits.org/):
```bash
feat: add new feature
fix: resolve bug in webhook handler
docs: update README with new examples
test: add unit tests for uwuification
refactor: improve code organization
style: fix code formatting
chore: update dependencies
```

#### Branching Strategy
- `main`: Stable production branch
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `hotfix/*`: Critical bug fixes
- `release/*`: Release preparation branches

#### Pull Request Requirements
- [ ] Clear, descriptive title and description
- [ ] All CI checks pass (linting, testing, type checking)
- [ ] Code follows project conventions
- [ ] Tests added/updated for new functionality
- [ ] Documentation updated if needed
- [ ] No breaking changes (unless discussed)
- [ ] Reviewed and approved by maintainers

### Types of Contributions

#### 🐛 Bug Reports
When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce the problem
- Expected vs. actual behavior
- Environment details (Node.js version, OS, etc.)
- Screenshots or logs if applicable

**Template:**
```markdown
**Bug Description**
A clear description of what the bug is.

**To Reproduce**
1. Go to '...'
2. Click on '....'
3. See error

**Expected Behavior**
What you expected to happen.

**Environment**
- OS: [e.g. iOS]
- Node.js Version: [e.g. 18.17.0]
- UwUlarpy Version: [e.g. 1.2.3]
```

#### ✨ Feature Requests
For feature requests, please provide:
- Clear description of the proposed feature
- Use case and motivation
- Potential implementation approach
- Impact on existing functionality

#### 📚 Documentation
Documentation improvements are always welcome:
- Fix typos or unclear explanations
- Add missing examples or use cases
- Improve API documentation
- Translate content (if applicable)

#### 🧪 Testing
Help improve test coverage:
- Add unit tests for existing functionality
- Create integration tests for complex workflows
- Develop performance benchmarks
- Test on different platforms and environments

### Development Tips

#### Local Testing
```bash
# Test webhook locally using ngrok
npm install -g ngrok
ngrok http 3000

# Update your GitHub App webhook URL to the ngrok URL
# Test with real GitHub events
```

#### Debugging
```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Use Node.js debugger
node --inspect-brk ./node_modules/.bin/next dev
```

#### Database and Dependencies
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Update dependencies (be careful with breaking changes)
npm update
```

### Community Guidelines

- **Be Respectful**: Treat all community members with respect and kindness
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Maintainers and contributors volunteer their time
- **Be Collaborative**: Work together to find the best solutions
- **Follow Code of Conduct**: Adhere to our community standards

### Recognition

Contributors are recognized in several ways:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes for significant contributions
- GitHub contributor badges and statistics
- Optional attribution in documentation

### Getting Help

If you need help with contributing:
- Check existing documentation and issues
- Ask questions in GitHub Discussions
- Reach out to maintainers directly
- Join our community chat (if available)

Thank you for contributing to UwUlarpy! 🎉

## Documentation

For detailed documentation, see [DOCUMENTATION.md](DOCUMENTATION.md)

## Support

We're committed to providing excellent support for UwUlarpy users and contributors. Here are multiple ways to get help:

### 📚 Documentation Resources

- **[Comprehensive Documentation](DOCUMENTATION.md)**: Complete guides, API references, and tutorials
- **[Getting Started Guide](DOCUMENTATION.md#getting-started)**: Step-by-step setup and first-use instructions
- **[FAQ Section](DOCUMENTATION.md#faq)**: Answers to frequently asked questions
- **[Troubleshooting Guide](DOCUMENTATION.md#troubleshooting)**: Solutions to common issues
- **[API Reference](DOCUMENTATION.md#api-reference)**: Detailed API documentation

### 🐛 Bug Reports & Feature Requests

- **[GitHub Issues](https://github.com/larp0/uwularpy/issues)**: Report bugs, request features, or ask technical questions
  - Use issue templates for better organization
  - Search existing issues before creating new ones
  - Provide detailed reproduction steps and environment information
  - Label issues appropriately for faster processing

### 💬 Community Support

- **[GitHub Discussions](https://github.com/larp0/uwularpy/discussions)**: Community-driven support and discussions
  - General questions and usage help
  - Feature discussions and feedback
  - Community showcase and examples
  - Best practices and tips sharing

### 📧 Direct Contact

For urgent matters, security issues, or maintainer-specific questions:

- **Security Issues**: [security@uwularpy.dev](mailto:security@uwularpy.dev)
- **General Inquiries**: [support@uwularpy.dev](mailto:support@uwularpy.dev)
- **Maintainer Contact**: [@larp0](https://github.com/larp0)

### 🔄 Response Times

We strive to provide timely responses:

- **Critical Security Issues**: Within 24 hours
- **Bug Reports**: 2-5 business days
- **Feature Requests**: 1-2 weeks for initial response
- **General Questions**: 3-7 business days
- **Community Discussions**: Community-driven, varies

### 🆘 Getting Better Help

To receive faster and more accurate support:

#### For Bug Reports
- Include your Node.js and npm versions
- Provide complete error messages and stack traces
- Share relevant configuration files (remove sensitive data)
- Describe your expected vs. actual behavior
- Include steps to reproduce the issue

#### For Feature Requests
- Explain your use case and motivation
- Describe the desired behavior
- Consider implementation complexity
- Suggest alternative solutions if applicable

#### For Usage Questions
- Check the documentation first
- Search existing issues and discussions
- Provide context about what you're trying to achieve
- Share relevant code snippets (anonymized if needed)

### 🌍 Community Guidelines

When seeking support:

- **Be Respectful**: Treat community members with kindness and respect
- **Be Patient**: Maintainers and contributors volunteer their time
- **Be Specific**: Provide clear, detailed information about your issue
- **Be Helpful**: Help others when you can, and contribute back to the community
- **Follow Templates**: Use provided issue and discussion templates when available

### 📈 Contributing to Support

Help us improve support for everyone:

- **Answer Questions**: Help other users in discussions and issues
- **Improve Documentation**: Submit PRs for unclear or missing documentation
- **Report Documentation Issues**: Let us know about outdated or incorrect information
- **Share Examples**: Contribute usage examples and tutorials
- **Provide Feedback**: Share your experience and suggestions for improvement

### 🔗 Additional Resources

- **[GitHub Repository](https://github.com/larp0/uwularpy)**: Source code and latest updates
- **[Release Notes](https://github.com/larp0/uwularpy/releases)**: Information about new features and bug fixes
- **[Contributing Guide](CONTRIBUTING.md)**: How to contribute to the project
- **[Code of Conduct](CODE_OF_CONDUCT.md)**: Community standards and expectations

## License

MIT

## Acknowledgements

- [uwuify](https://www.npmjs.com/package/uwuify) - The JavaScript library for uwuifying text
- [Octokit](https://github.com/octokit) - GitHub API client for JavaScript
- [Next.js](https://nextjs.org/) - The React framework for production
