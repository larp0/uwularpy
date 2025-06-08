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

    test('should handle complex escape sequences', () => {
      const input = 'file\\with\\backslashes.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file\\with\\backslashes.txt'");
    });

    test('should handle unicode and emoji characters', () => {
      const input = 'файл_🚀_test.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'файл_🚀_test.txt'");
    });

    test('should handle multiple consecutive special characters', () => {
      const input = "file''with''multiple''quotes.txt";
      const result = sanitizeForShell(input);
      expect(result).toBe("'file'\"'\"''\"'\"'with'\"'\"''\"'\"'multiple'\"'\"''\"'\"'quotes.txt'");
    });

    test('should handle paths with embedded newlines', () => {
      const input = 'file\nwith\nnewlines.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file with newlines.txt'");
    });

    test('should handle paths with tab characters', () => {
      const input = 'file\twith\ttabs.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'file with tabs.txt'");
    });

    test('should handle very long paths', () => {
      const input = 'a'.repeat(2000);
      const result = sanitizeForShell(input);
      expect(result.length).toBeLessThanOrEqual(1002); // 1000 chars + 2 quotes
      expect(result).toMatch(/^'.*'$/);
    });

    test('should handle null bytes', () => {
      const input = 'file\x00with\x00nulls.txt';
      const result = sanitizeForShell(input);
      expect(result).toBe("'filewithnulls.txt'");
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
