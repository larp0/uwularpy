# UwUlarpy

Backend for the uwularpy GitHub bot that uwuifies repository markdown files when mentioned.

## Overview

UwUlarpy is a GitHub bot that responds to mentions in issues by creating a new branch, uwuifying all markdown files in the repository, and creating a pull request with the changes.

This repository contains the backend code for the UwUlarpy bot, including:

- Webhook handler for processing GitHub events
- Logic for detecting mentions in issue comments
- Code for creating branches and pull requests
- The uwuification script that transforms markdown content

## Features

- Responds to "@uwularpy" mentions in GitHub issue comments
- Immediately replies with "see you, uwuing..." for instant validation
- Creates a new branch from main with naming convention "uwuify-issue-{X}"
- Uwuifies all markdown files in the repository
- Creates a pull request with the uwuified content
- Mentions the requester in the PR description

## Installation and Usage

See the [INSTALLATION.md](INSTALLATION.md) and [USAGE.md](USAGE.md) files for detailed instructions.

## Deployment Options

The UwUlarpy bot can be deployed in several ways:

1. **Standalone Webhook Handler**: Deploy the Node.js application to a server
2. **GitHub Action**: Use the GitHub Action workflow for repository-specific deployment
3. **Inngest Serverless**: Deploy using Inngest for a serverless webhook handler

See the [DEPLOYMENT.md](DEPLOYMENT.md) file for detailed deployment instructions.

## License

MIT
