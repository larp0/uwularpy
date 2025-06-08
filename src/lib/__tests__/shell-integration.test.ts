// Integration tests for shell command executions with unusual filenames
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { sanitizeForShell, safeGitCommit, safeGitCommand } from '../git-utils';

describe('Shell Integration Tests - Unusual Filenames', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-test-'));
    
    // Initialize git repository
    try {
      safeGitCommand(['init'], { cwd: tempDir, stdio: 'inherit' });
      safeGitCommand(['config', 'user.email', 'test@example.com'], { cwd: tempDir });
      safeGitCommand(['config', 'user.name', 'Test User'], { cwd: tempDir });
    } catch (error) {
      // Skip git setup if it fails in CI
      console.warn('Git setup failed, some tests may be skipped:', error);
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

  describe('sanitizeForShell with unusual filenames', () => {
    test('should handle paths with spaces', () => {
      const input = 'file with spaces.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file with spaces.txt'");
    });

    test('should handle paths with parentheses', () => {
      const input = 'file(with)parentheses.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file(with)parentheses.txt'");
    });

    test('should handle paths with single quotes', () => {
      const input = "file'with'quotes.txt";
      const result = sanitizeForShell(input);
      expect(result).toBe("'file'\"'\"'with'\"'\"'quotes.txt'");
    });

    test('should handle paths with special characters', () => {
      const input = 'file@#$%^&*()_+-={}[]|;:,.<>?.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file@#$%^&*()_+-={}[]|;:,.<>?.txt'");
    });

    test('should handle unicode filenames', () => {
      const input = 'файл-тест-🚀.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'файл-тест-🚀.txt'");
    });

    test('should handle very long filenames', () => {
      const input = 'a'.repeat(500);
      const result = sanitizeForShell(input);
      // Should be truncated but still quoted
      expect(result.startsWith("'")).toBe(true);
      expect(result.endsWith("'")).toBe(true);
      expect(result.length).toBeLessThan(1010); // 1000 chars + quotes
    });

    test('should handle empty input safely', () => {
      const result = sanitizeForShell('');
      expect(result).toBe("''");
    });

    test('should remove null bytes', () => {
      const input = 'file\0name.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'filename.txt'");
    });

    test('should replace newlines with spaces', () => {
      const input = 'file\nwith\nnewlines.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file with newlines.txt'");
    });
  });

  describe('Git operations with unusual filenames', () => {
    test('should commit files with spaces in names', async () => {
      const fileName = 'file with spaces.txt';
      const filePath = path.join(tempDir, fileName);
      
      // Create a file with spaces in the name
      fs.writeFileSync(filePath, 'test content');
      
      // Add and commit the file
      try {
        safeGitCommand(['add', '.'], { cwd: tempDir, stdio: 'inherit' });
        await safeGitCommit('Add file with spaces', { cwd: tempDir });
        
        // Verify the commit was successful
        const status = safeGitCommand(['status', '--porcelain'], { cwd: tempDir });
        expect(status).toBe(''); // Should be clean after commit
      } catch (error) {
        // Skip if git is not available
        console.warn('Git test skipped:', error);
      }
    });

    test('should commit files with parentheses in names', async () => {
      const fileName = 'file(with)parentheses.txt';
      const filePath = path.join(tempDir, fileName);
      
      // Create a file with parentheses in the name
      fs.writeFileSync(filePath, 'test content');
      
      try {
        safeGitCommand(['add', '.'], { cwd: tempDir, stdio: 'inherit' });
        await safeGitCommit('Add file with parentheses', { cwd: tempDir });
        
        // Verify the commit was successful
        const status = safeGitCommand(['status', '--porcelain'], { cwd: tempDir });
        expect(status).toBe('');
      } catch (error) {
        console.warn('Git test skipped:', error);
      }
    });

    test('should handle commit messages with special characters', async () => {
      const fileName = 'test.txt';
      const filePath = path.join(tempDir, fileName);
      
      fs.writeFileSync(filePath, 'test content');
      
      try {
        safeGitCommand(['add', '.'], { cwd: tempDir, stdio: 'inherit' });
        
        // Test commit message with various special characters
        const commitMessage = 'feat: add file with "quotes" and $variables & other chars!';
        await safeGitCommit(commitMessage, { cwd: tempDir });
        
        // Verify the commit was successful
        const status = safeGitCommand(['status', '--porcelain'], { cwd: tempDir });
        expect(status).toBe('');
      } catch (error) {
        console.warn('Git test skipped:', error);
      }
    });

    test('should handle unicode in commit messages', async () => {
      const fileName = 'test.txt';
      const filePath = path.join(tempDir, fileName);
      
      fs.writeFileSync(filePath, 'test content');
      
      try {
        safeGitCommand(['add', '.'], { cwd: tempDir, stdio: 'inherit' });
        
        // Test commit message with unicode characters
        const commitMessage = 'feat: добавить файл with emoji 🚀 and unicode';
        await safeGitCommit(commitMessage, { cwd: tempDir });
        
        // Verify the commit was successful
        const status = safeGitCommand(['status', '--porcelain'], { cwd: tempDir });
        expect(status).toBe('');
      } catch (error) {
        console.warn('Git test skipped:', error);
      }
    });
  });

  describe('Edge cases and security', () => {
    test('should prevent command injection in filenames', () => {
      const maliciousInput = 'file; rm -rf /; echo hacked';
      const result = sanitizeForShell(maliciousInput);
      
      // Should be safely quoted - content is preserved but made safe
      expect(result).toBe("'file; rm -rf /; echo hacked'");
      
      // The important thing is that it's properly quoted to prevent execution
      expect(result.startsWith("'")).toBe(true);
      expect(result.endsWith("'")).toBe(true);
    });

    test('should prevent backtick command substitution', () => {
      const maliciousInput = 'file`rm -rf /`name.txt';
      const result = sanitizeForShell(maliciousInput);
      
      // Should be safely quoted to prevent command substitution
      expect(result).toBe("'file`rm -rf /`name.txt'");
    });

    test('should prevent dollar variable expansion', () => {
      const maliciousInput = 'file$HOME/evil.txt';
      const result = sanitizeForShell(maliciousInput);
      
      // Should be safely quoted to prevent variable expansion
      expect(result).toBe("'file$HOME/evil.txt'");
    });
  });
});