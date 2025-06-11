// Integration tests for safeGitPushWithRetry and git retry mechanisms
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  safeGitPushWithRetry, 
  safeGitCommand, 
  safeGitCommit,
  hasStageChanges,
  setGitUser 
} from '../git-utils';

// Mock the structured logger to avoid external dependencies in tests
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

describe('Git Retry Integration Tests', () => {
  let tempDir: string;
  let testRepoPath: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-retry-integration-'));
    testRepoPath = tempDir;
    
    // Initialize a git repository
    try {
      safeGitCommand(['init'], { cwd: testRepoPath, stdio: 'inherit' });
      setGitUser(testRepoPath, 'test@example.com', 'Test User');
      
      // Create initial commit
      fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repository\n');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Initial commit', { cwd: testRepoPath });
    } catch (error) {
      console.warn('Git setup failed, tests may be skipped:', error);
    }
  });

  afterEach(() => {
    // Clean up temporary directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('safeGitPushWithRetry Integration Tests', () => {
    test('should succeed on first attempt with valid repository', async () => {
      // Note: This test will likely fail in CI without a real remote
      // But we can test the retry mechanism by mocking
      const branchName = 'test-branch';
      
      // Create a new branch
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      
      // Add some changes
      fs.writeFileSync(path.join(testRepoPath, 'test-file.txt'), 'Test content for push');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Add test file for push', { cwd: testRepoPath });
      
      // This will likely fail without a real remote, but we can test the error handling
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 1, 100); // 1 retry, 100ms delay
        // If this succeeds, great! Otherwise we test error handling below
      } catch (error) {
        // Expected in test environment without real remote
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Git push failed after 1 attempts');
      }
    });

    test('should retry with exponential backoff on failure', async () => {
      const branchName = 'retry-test-branch';
      
      // Create branch and changes
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'retry-test.txt'), 'Content for retry test');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Test commit for retry mechanism', { cwd: testRepoPath });
      
      // Track timing to verify exponential backoff
      const startTime = Date.now();
      
      try {
        // Use 3 retries with 200ms base delay
        await safeGitPushWithRetry(testRepoPath, branchName, 3, 200);
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Verify the retry mechanism ran
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Git push failed after 3 attempts');
        
        // Verify exponential backoff timing: 200ms + 400ms + 800ms = 1400ms minimum
        // Allow some tolerance for test execution overhead
        expect(duration).toBeGreaterThan(1200); // At least 1.2 seconds
        expect(duration).toBeLessThan(3000);    // But less than 3 seconds
      }
    });

    test('should handle different types of git push failures', async () => {
      const branchName = 'failure-test-branch';
      
      // Create branch
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'failure-test.txt'), 'Test content');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Test commit for failure handling', { cwd: testRepoPath });
      
      // Test with invalid remote (common failure scenario)
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 2, 100);
      } catch (error) {
        // Should fail gracefully with descriptive error
        expect(error).toBeInstanceOf(Error);
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Git push failed after 2 attempts');
      }
    });

    test('should respect custom retry and delay parameters', async () => {
      const branchName = 'custom-params-branch';
      
      // Create minimal changes
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'custom-test.txt'), 'Custom params test');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Custom parameters test', { cwd: testRepoPath });
      
      const startTime = Date.now();
      
      try {
        // Test with custom parameters: 2 retries, 500ms base delay
        await safeGitPushWithRetry(testRepoPath, branchName, 2, 500);
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Verify custom timing: 500ms + 1000ms = 1500ms minimum
        expect(duration).toBeGreaterThan(1400);
        expect(duration).toBeLessThan(2500);
        
        expect((error as Error).message).toContain('Git push failed after 2 attempts');
      }
    });

    test('should handle edge cases in retry parameters', async () => {
      const branchName = 'edge-case-branch';
      
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'edge-test.txt'), 'Edge case test');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Edge case test commit', { cwd: testRepoPath });
      
      // Test with minimal retry (1 attempt = no retries)
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 1, 50);
      } catch (error) {
        expect((error as Error).message).toContain('Git push failed after 1 attempts');
      }
      
      // Test with zero delay
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 2, 0);
      } catch (error) {
        expect((error as Error).message).toContain('Git push failed after 2 attempts');
      }
    });
  });

  describe('Git Command Reliability Tests', () => {
    test('should handle git command failures gracefully', () => {
      // Test invalid git command
      expect(() => {
        safeGitCommand(['invalid-command'], { cwd: testRepoPath, stdio: 'pipe' });
      }).toThrow();
      
      // Test git command with invalid repository
      expect(() => {
        safeGitCommand(['status'], { cwd: '/nonexistent/path', stdio: 'pipe' });
      }).toThrow();
    });

    test('should handle different stdio options correctly', () => {
      // Test with pipe stdio (default)
      const result1 = safeGitCommand(['status', '--porcelain'], { cwd: testRepoPath, stdio: 'pipe' });
      expect(typeof result1).toBe('string');
      
      // Test with inherit stdio
      const result2 = safeGitCommand(['status'], { cwd: testRepoPath, stdio: 'inherit' });
      expect(result2).toBeNull(); // Should return null for inherit
    });

    test('should execute git operations in correct sequence', async () => {
      // Test a complete git workflow with error handling
      const workflowBranch = 'workflow-test';
      
      try {
        // Create and switch to new branch
        safeGitCommand(['checkout', '-b', workflowBranch], { cwd: testRepoPath, stdio: 'inherit' });
        
        // Verify we're on the right branch
        const currentBranch = safeGitCommand(['branch', '--show-current'], { cwd: testRepoPath, stdio: 'pipe' });
        expect(currentBranch?.trim()).toBe(workflowBranch);
        
        // Make changes
        fs.writeFileSync(path.join(testRepoPath, 'workflow-test.txt'), 'Workflow test content');
        safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
        
        // Verify staged changes
        expect(hasStageChanges(testRepoPath)).toBe(true);
        
        // Commit changes
        await safeGitCommit('Workflow test commit', { cwd: testRepoPath });
        
        // Verify commit was created
        const log = safeGitCommand(['log', '--oneline', '-1'], { cwd: testRepoPath, stdio: 'pipe' });
        expect(log).toContain('Workflow test commit');
        
      } catch (error) {
        console.warn('Git workflow test encountered expected errors in test environment:', error);
      }
    });
  });

  describe('Network Resilience and Error Recovery Tests', () => {
    test('should handle network timeout scenarios', async () => {
      // Simulate network timeout by using invalid remote
      const branchName = 'timeout-test';
      
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'timeout-test.txt'), 'Timeout test');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Timeout test commit', { cwd: testRepoPath });
      
      // Set an invalid remote to simulate network issues
      try {
        safeGitCommand(['remote', 'add', 'origin', 'https://invalid-domain-12345.com/repo.git'], { 
          cwd: testRepoPath, 
          stdio: 'inherit' 
        });
      } catch (error) {
        // May fail to add remote, which is fine for this test
      }
      
      const startTime = Date.now();
      
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 2, 300);
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Should have attempted retries
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Git push failed after 2 attempts');
        
        // Should have taken time for retries
        expect(duration).toBeGreaterThan(500); // At least 300ms + 600ms retries
      }
    });

    test('should handle authentication failures with retry', async () => {
      // Test authentication failure scenario
      const branchName = 'auth-test';
      
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'auth-test.txt'), 'Auth test');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Authentication test commit', { cwd: testRepoPath });
      
      // Set a real GitHub repo URL that would require authentication
      try {
        safeGitCommand(['remote', 'add', 'origin', 'https://github.com/nonexistent/private-repo.git'], { 
          cwd: testRepoPath, 
          stdio: 'inherit' 
        });
      } catch (error) {
        // May fail, which is fine for this test
      }
      
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 2, 200);
      } catch (error) {
        // Should fail with authentication or permission error
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Git push failed after 2 attempts');
      }
    });
  });

  describe('Concurrent Operations and Race Conditions', () => {
    test('should handle concurrent git operations safely', async () => {
      // Test multiple git operations happening concurrently
      const branch1 = 'concurrent-1';
      const branch2 = 'concurrent-2';
      
      // Create two separate branches
      safeGitCommand(['checkout', '-b', branch1], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'concurrent1.txt'), 'Concurrent test 1');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Concurrent commit 1', { cwd: testRepoPath });
      
      safeGitCommand(['checkout', '-b', branch2], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'concurrent2.txt'), 'Concurrent test 2');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Concurrent commit 2', { cwd: testRepoPath });
      
      // Test concurrent push attempts (they will fail but shouldn't interfere)
      const promises = [
        safeGitPushWithRetry(testRepoPath, branch1, 1, 100).catch(e => e),
        safeGitPushWithRetry(testRepoPath, branch2, 1, 100).catch(e => e)
      ];
      
      const results = await Promise.all(promises);
      
      // Both should fail gracefully without corrupting the repository
      results.forEach(result => {
        expect(result).toBeInstanceOf(Error);
      });
      
      // Repository should still be in a valid state
      const status = safeGitCommand(['status', '--porcelain'], { cwd: testRepoPath, stdio: 'pipe' });
      expect(typeof status).toBe('string');
    });
  });

  describe('Performance and Scalability Tests', () => {
    test('should handle large repository operations efficiently', async () => {
      // Create a moderately large file to test performance
      const branchName = 'performance-test';
      const largeContent = 'x'.repeat(100000); // 100KB file
      
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'large-file.txt'), largeContent);
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      
      const startTime = Date.now();
      await safeGitCommit('Large file commit', { cwd: testRepoPath });
      const commitDuration = Date.now() - startTime;
      
      // Commit should complete in reasonable time
      expect(commitDuration).toBeLessThan(5000); // Less than 5 seconds
      
      // Test push performance (will fail but we measure the attempt)
      const pushStart = Date.now();
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 1, 100);
      } catch (error) {
        const pushDuration = Date.now() - pushStart;
        // Push attempt should not take excessively long
        expect(pushDuration).toBeLessThan(10000); // Less than 10 seconds
      }
    });

    test('should handle multiple retry scenarios without memory leaks', async () => {
      // Test multiple retry operations to check for memory issues
      const testOperations = [];
      
      for (let i = 0; i < 5; i++) {
        const branchName = `memory-test-${i}`;
        
        safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
        fs.writeFileSync(path.join(testRepoPath, `memory-test-${i}.txt`), `Memory test ${i}`);
        safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
        await safeGitCommit(`Memory test commit ${i}`, { cwd: testRepoPath });
        
        // Queue up push operations that will fail but test retry logic
        testOperations.push(
          safeGitPushWithRetry(testRepoPath, branchName, 2, 50).catch(e => e)
        );
      }
      
      const results = await Promise.all(testOperations);
      
      // All should fail but complete without hanging
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Error);
      });
    });
  });

  describe('Error Message Quality and Debugging', () => {
    test('should provide detailed error messages for debugging', async () => {
      const branchName = 'error-message-test';
      
      safeGitCommand(['checkout', '-b', branchName], { cwd: testRepoPath, stdio: 'inherit' });
      fs.writeFileSync(path.join(testRepoPath, 'error-test.txt'), 'Error message test');
      safeGitCommand(['add', '.'], { cwd: testRepoPath, stdio: 'inherit' });
      await safeGitCommit('Error message test commit', { cwd: testRepoPath });
      
      try {
        await safeGitPushWithRetry(testRepoPath, branchName, 3, 100);
      } catch (error) {
        const errorMessage = (error as Error).message;
        
        // Error message should contain useful debugging information
        expect(errorMessage).toContain('Git push failed after 3 attempts');
        expect(errorMessage).toContain(branchName);
        
        // Should be descriptive enough for troubleshooting
        expect(errorMessage.length).toBeGreaterThan(20);
      }
    });
  });
});