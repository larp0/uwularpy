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

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'No changes needed.' } }],
        }),
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

    // Set up default mock behaviors
    mockedExecSync.mockImplementation((command: string, options?: any) => {
      const cmd = command.toString();

      // Mock git status to return empty (no changes)
      if (cmd.includes('git status --porcelain')) {
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

    // Verify that empty commit was created
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git commit --allow-empty -m "Apply changes from OpenAI API self-ask flow (no changes made)"',
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

      if (cmd.includes('git')) {
        return '';
      }

      return originalExecSync(command, options);
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

    // Verify that normal commit was created (not empty)
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git commit -m "Apply changes from OpenAI API self-ask flow"',
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
});