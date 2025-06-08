/**
 * Comprehensive integration and e2e tests for the git utilities
 * Focus on testing the core improvements we made
 */

import { describe, it, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { safeGitCommit, hasStageChanges, getStagedDiff, setGitUser } from '../git-utils';

// Mock the logger to avoid external dependencies
jest.mock('../structured-logger', () => ({
  loggers: {
    git: {
      child: jest.fn().mockReturnValue({
        startOperation: jest.fn(),
        completeOperation: jest.fn(),
        failOperation: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      })
    }
  }
}));

describe('Git Utilities E2E Tests', () => {
  let testRepoPath: string;
  let tempDir: string;

  beforeAll(async () => {
    // Create a temporary directory for test repositories
    tempDir = await fs.mkdtemp(join(tmpdir(), 'git-utils-e2e-'));
  });

  afterEach(async () => {
    // Clean up any test repositories
    if (testRepoPath) {
      try {
        await fs.rm(testRepoPath, { recursive: true, force: true });
      } catch (_error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Safe Git Commit with spawn', () => {
    beforeEach(async () => {
      // Create a test git repository
      testRepoPath = join(tempDir, `test-repo-${Date.now()}`);
      await fs.mkdir(testRepoPath, { recursive: true });
      
      // Initialize git repo
      execSync('git init', { cwd: testRepoPath });
      setGitUser(testRepoPath, 'test@example.com', 'Test User');
      
      // Create initial file and commit
      await fs.writeFile(join(testRepoPath, 'README.md'), '# Test Repository\n');
      execSync('git add .', { cwd: testRepoPath });
      execSync('git commit -m "Initial commit"', { cwd: testRepoPath });
    });

    it('should safely commit changes using spawn', async () => {
      // Arrange: Create changes
      await fs.writeFile(join(testRepoPath, 'test.txt'), 'Test content\n');
      execSync('git add .', { cwd: testRepoPath });

      // Act: Use safe git commit
      await safeGitCommit('Test commit with spawn', {
        cwd: testRepoPath,
        allowEmpty: false
      });

      // Assert: Verify commit was created
      const log = execSync('git log --oneline -1', { cwd: testRepoPath, encoding: 'utf-8' });
      expect(log).toContain('Test commit with spawn');
    });

    it('should safely commit empty changes with allow-empty flag', async () => {
      // Act: Use safe git commit with no changes
      await safeGitCommit('Empty commit test', {
        cwd: testRepoPath,
        allowEmpty: true
      });

      // Assert: Verify empty commit was created
      const log = execSync('git log --oneline -1', { cwd: testRepoPath, encoding: 'utf-8' });
      expect(log).toContain('Empty commit test');
    });

    it('should detect staged changes correctly', () => {
      // Test with no changes
      expect(hasStageChanges(testRepoPath)).toBe(false);

      // Add changes and stage them
      execSync('echo "new content" > newfile.txt', { cwd: testRepoPath });
      execSync('git add .', { cwd: testRepoPath });

      // Test with staged changes
      expect(hasStageChanges(testRepoPath)).toBe(true);
    });

    it('should get staged diff correctly', async () => {
      // Arrange: Create and stage changes
      await fs.writeFile(join(testRepoPath, 'diff-test.txt'), 'Original content\n');
      execSync('git add .', { cwd: testRepoPath });
      execSync('git commit -m "Add file for diff test"', { cwd: testRepoPath });

      // Modify file and stage changes
      await fs.writeFile(join(testRepoPath, 'diff-test.txt'), 'Modified content\n');
      execSync('git add .', { cwd: testRepoPath });

      // Act: Get staged diff
      const diff = getStagedDiff(testRepoPath);

      // Assert: Verify diff contains expected content
      expect(diff).toContain('-Original content');
      expect(diff).toContain('+Modified content');
    });

    it('should sanitize commit messages to prevent shell injection', async () => {
      // Arrange: Create changes and dangerous commit message
      await fs.writeFile(join(testRepoPath, 'security-test.txt'), 'Test content\n');
      execSync('git add .', { cwd: testRepoPath });

      const dangerousMessage = 'Test message; echo "injected" > hacked.txt';

      // Act: Use safe git commit with dangerous message
      await safeGitCommit(dangerousMessage, {
        cwd: testRepoPath,
        allowEmpty: false
      });

      // Assert: Verify injection was prevented
      const hackedFileExists = await fs.access(join(testRepoPath, 'hacked.txt')).then(() => true).catch(() => false);
      expect(hackedFileExists).toBe(false);

      // Verify commit message was sanitized but commit was created
      const log = execSync('git log --oneline -1', { cwd: testRepoPath, encoding: 'utf-8' });
      expect(log).toContain('Test message echo'); // Sanitized version (should not contain shell injection)
      expect(log).not.toContain('; echo'); // Should not contain original injection
    });
  });

  describe('Error Handling', () => {
    it('should handle git command failures gracefully', async () => {
      // Arrange: Invalid repository path
      const invalidPath = '/nonexistent/path';

      // Act & Assert: Should throw appropriate error
      await expect(safeGitCommit('Test commit', {
        cwd: invalidPath,
        allowEmpty: false
      })).rejects.toThrow('Git commit failed');
    });

    it('should handle empty commit messages after sanitization', async () => {
      testRepoPath = join(tempDir, `empty-msg-repo-${Date.now()}`);
      await fs.mkdir(testRepoPath, { recursive: true });
      execSync('git init', { cwd: testRepoPath });

      // Act & Assert: Should reject empty message
      await expect(safeGitCommit('', {
        cwd: testRepoPath,
        allowEmpty: true
      })).rejects.toThrow('Commit message cannot be empty after sanitization');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large commit messages efficiently', async () => {
      testRepoPath = join(tempDir, `perf-repo-${Date.now()}`);
      await fs.mkdir(testRepoPath, { recursive: true });
      
      execSync('git init', { cwd: testRepoPath });
      setGitUser(testRepoPath, 'test@example.com', 'Test User');
      
      // Create changes
      await fs.writeFile(join(testRepoPath, 'perf-test.txt'), 'Performance test content\n');
      execSync('git add .', { cwd: testRepoPath });

      // Create a large commit message
      const largeMessage = 'Performance test: ' + 'x'.repeat(1000);

      // Act: Measure performance
      const startTime = Date.now();
      await safeGitCommit(largeMessage, {
        cwd: testRepoPath,
        allowEmpty: false
      });
      const duration = Date.now() - startTime;

      // Assert: Should complete in reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);

      const log = execSync('git log --oneline -1', { cwd: testRepoPath, encoding: 'utf-8' });
      expect(log).toContain('Performance test');
    });
  });

  describe('Structured Logging Integration', () => {
    it('should use structured logging throughout git operations', async () => {
      testRepoPath = join(tempDir, `logging-repo-${Date.now()}`);
      await fs.mkdir(testRepoPath, { recursive: true });
      
      execSync('git init', { cwd: testRepoPath });
      setGitUser(testRepoPath, 'test@example.com', 'Test User');
      
      // Create changes
      await fs.writeFile(join(testRepoPath, 'log-test.txt'), 'Test content\n');
      execSync('git add .', { cwd: testRepoPath });

      // Act: Perform git operations that should generate structured logs
      const hasChanges = hasStageChanges(testRepoPath);
      const diff = getStagedDiff(testRepoPath);
      await safeGitCommit('Test structured logging', {
        cwd: testRepoPath,
        allowEmpty: false
      });

      // Assert: Verify operations completed successfully
      expect(hasChanges).toBe(true);
      expect(diff).toContain('Test content');

      const log = execSync('git log --oneline -1', { cwd: testRepoPath, encoding: 'utf-8' });
      expect(log).toContain('Test structured logging');
    });
  });
});
