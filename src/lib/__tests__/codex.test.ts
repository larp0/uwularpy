/**
 * Test for codex.ts fix - ensure empty commits are handled properly
 */

import { jest } from '@jest/globals';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Mock the dependencies
jest.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@octokit/auth-app', () => ({
  createAppAuth: jest.fn(),
}));

const mockOpenAICreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate,
      },
    },
  }));
});

// Mock child_process.execSync
const originalExecSync = execSync;
const mockExecSync = jest.fn();

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('codex.ts git commit fix', () => {
  let tempDir: string;
  const { execSync: mockedExecSync } = require('child_process');

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a real temp directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-test-'));

    // Set up default mock behaviors for OpenAI
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'feat: add new functionality' } }],
    });

    // Set up default mock behaviors
    mockedExecSync.mockImplementation((command: string, options?: any) => {
      const cmd = command.toString();

      // Mock git status to return empty (no changes)
      if (cmd.includes('git status --porcelain')) {
        return '';
      }

      // Mock git diff for commit message generation
      if (cmd.includes('git diff --cached')) {
        return '';
      }

      // Mock other git commands to succeed silently
      if (cmd.includes('git')) {
        return '';
      }

      // For any other commands, use the original implementation
      return originalExecSync(command, options);
    });
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should handle empty commits when no changes are made', async () => {
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-key';

    // Import the module after setting up mocks
    const { codexRepository } = await import('../codex');

    try {
      await codexRepository(
        'test prompt',
        'https://github.com/test/repo.git',
        'test-branch'
      );
    } catch (error) {
      // We expect this to fail due to other mocked operations, but we want to check the git commands
    }

    // Verify that git status was checked
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git status --porcelain',
      expect.objectContaining({
        encoding: 'utf-8',
        cwd: expect.any(String),
      })
    );

    // Verify that empty commit was created with fallback message (since no diff)
    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/git commit --allow-empty -m ".+"/),
      expect.objectContaining({
        cwd: expect.any(String),
        stdio: 'inherit',
      })
    );
  });

  test('should handle normal commits when changes are made', async () => {
    // Mock git status to return some changes
    mockedExecSync.mockImplementation((command: string, options?: any) => {
      const cmd = command.toString();

      if (cmd.includes('git status --porcelain')) {
        return 'M  test.txt\n';
      }

      if (cmd.includes('git diff --cached')) {
        return 'diff --git a/test.txt b/test.txt\nindex 1234567..abcdefg 100644\n--- a/test.txt\n+++ b/test.txt\n@@ -1 +1 @@\n-old content\n+new content\n';
      }

      if (cmd.includes('git')) {
        return '';
      }

      return originalExecSync(command, options);
    });

    // Mock OpenAI to return a specific commit message
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'feat: update test.txt content' } }],
    });

    process.env.OPENAI_API_KEY = 'test-key';

    const { codexRepository } = await import('../codex');

    try {
      await codexRepository(
        'test prompt',
        'https://github.com/test/repo.git',
        'test-branch'
      );
    } catch (error) {
      // We expect this to fail due to other mocked operations
    }

    // Verify that git status was checked
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git status --porcelain',
      expect.objectContaining({
        encoding: 'utf-8',
        cwd: expect.any(String),
      })
    );

    // Verify that git diff was called for commit message generation
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git diff --cached',
      expect.objectContaining({
        encoding: 'utf-8',
        cwd: expect.any(String),
      })
    );

    // Verify that OpenAI was called to generate commit message
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Generate a commit message for this git diff:'),
          }),
        ]),
      })
    );

    // Verify that normal commit was created with AI-generated message
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git commit -m "feat: update test.txt content"',
      expect.objectContaining({
        cwd: expect.any(String),
        stdio: 'inherit',
      })
    );

    // Verify that empty commit was NOT called
    expect(mockedExecSync).not.toHaveBeenCalledWith(
      expect.stringContaining('--allow-empty'),
      expect.any(Object)
    );
  });

  test('should handle OpenAI failure and use fallback commit message', async () => {
    // Mock git status to return changes
    mockedExecSync.mockImplementation((command: string, options?: any) => {
      const cmd = command.toString();

      if (cmd.includes('git status --porcelain')) {
        return 'M  test.txt\n';
      }

      if (cmd.includes('git diff --cached')) {
        return 'diff --git a/test.txt b/test.txt\nindex 1234567..abcdefg 100644\n--- a/test.txt\n+++ b/test.txt\n@@ -1 +1 @@\n-old content\n+new content\n';
      }

      if (cmd.includes('git')) {
        return '';
      }

      return originalExecSync(command, options);
    });

    // Mock OpenAI to work for the main flow but fail for commit message generation
    let callCount = 0;
    mockOpenAICreate.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call for main self-ask flow - succeed
        return Promise.resolve({
          choices: [{ message: { content: '' } }] // Empty response to end the loop
        });
      } else {
        // Second call for commit message generation - fail
        return Promise.reject(new Error('OpenAI API error'));
      }
    });

    process.env.OPENAI_API_KEY = 'test-key';

    const { codexRepository } = await import('../codex');

    try {
      await codexRepository(
        'test prompt',
        'https://github.com/test/repo.git',
        'test-branch'
      );
    } catch (error) {
      // We expect this to fail due to other mocked operations
    }

    // Verify that fallback commit message was used
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git commit -m "Apply changes from OpenAI API self-ask flow"',
      expect.objectContaining({
        cwd: expect.any(String),
        stdio: 'inherit',
      })
    );
  });
});