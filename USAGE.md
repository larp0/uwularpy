# Usage Guide

This guide explains how to use the UwUlarpy GitHub bot once it's installed.

## Mentioning the Bot

The UwUlarpy bot responds to mentions in GitHub issue comments. To use it:

1. Open or create an issue in a repository where the UwUlarpy bot is installed
2. Add a comment that includes the text `@uwularpy`
3. The bot will immediately reply with "see you, uwuing..." to confirm it received your request
4. The bot will then:
   - Create a new branch named `uwuify-issue-{issue-number}`
   - Add the uwuification script to the repository
   - Run the script to uwuify all markdown files
   - Create a pull request with the changes
   - Mention you in the pull request

## Example

1. Create an issue titled "Test uwularpy bot"
2. Add a comment: "Hey @uwularpy can you uwuify this repository?"
3. The bot will reply: "see you, uwuing..."
4. Shortly after, the bot will create a pull request with uwuified markdown files
5. You'll receive a notification when the pull request is created

## What Gets Uwuified

The bot uwuifies all markdown (`.md`) files in the repository. The uwuification process:

- Preserves code blocks (content between backticks)
- Transforms regular text using the uwuify library
- Maintains the original file structure and formatting

## Pull Request Review

After the bot creates a pull request:

1. Repository maintainers can review the changes
2. The pull request can be merged, modified, or closed like any other PR
3. If merged, all markdown files will be uwuified in the main branch

## Limitations

- The bot only uwuifies markdown files (`.md` extension)
- Code blocks and inline code are preserved (not uwuified)
- The bot requires appropriate permissions to create branches and pull requests
- Large repositories with many markdown files may take longer to process

## Troubleshooting

If the bot doesn't respond to your mention:

1. Verify the bot is installed in the repository
2. Check that you used the correct mention format (`@uwularpy`)
3. Ensure the bot has the necessary permissions
4. Check the repository's webhook delivery logs for errors

For additional help, contact the repository maintainer or open an issue in the UwUlarpy repository.
