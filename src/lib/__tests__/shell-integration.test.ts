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

    test('should handle complex escape sequences', () => {
      const input = 'file\\x20with\\x09escape\\x0Asequences.txt';
      const result = sanitizeForShell(input);
      
      // Should preserve escape sequences within quotes
      expect(result).toBe("'file\\x20with\\x09escape\\x0Asequences.txt'");
    });

    test('should handle ANSI escape sequences', () => {
      const input = 'file\x1B[31mred\x1B[0mcolor.txt';
      const result = sanitizeForShell(input);
      
      // Should preserve ANSI codes within quotes
      expect(result).toBe("'file\x1B[31mred\x1B[0mcolor.txt'");
    });

    test('should handle UTF-8 byte order mark', () => {
      const input = '\uFEFFfile_with_bom.txt';
      const result = sanitizeForShell(input);
      
      // BOM should be preserved (it's stripped by sanitizeForShell)
      expect(result).toBe("'file_with_bom.txt'");
    });

    test('should handle zero-width characters', () => {
      const input = 'file\u200Bwith\u200Czero\u200Dwidth\uFEFFchars.txt';
      const result = sanitizeForShell(input);
      
      // Zero-width chars should be preserved within quotes
      expect(result).toBe("'file\u200Bwith\u200Czero\u200Dwidth\uFEFFchars.txt'");
    });

    test('should handle mixed quote types', () => {
      const input = 'file"with\'mixed`quotes.txt';
      const result = sanitizeForShell(input);
      
      // Should properly escape single quotes within the single-quoted string
      expect(result).toBe("'file\"with'\"'\"'mixed`quotes.txt'");
    });

    test('should handle path separators on different systems', () => {
      const unixPath = 'path/to/file.txt';
      const windowsPath = 'path\\to\\file.txt';
      
      expect(sanitizeForShell(unixPath)).toBe("'path/to/file.txt'");
      expect(sanitizeForShell(windowsPath)).toBe("'path\\to\\file.txt'");
    });

    test('should handle files with multiple dots', () => {
      const input = 'file.name.with.many.dots.tar.gz';
      const result = sanitizeForShell(input);
      
      expect(result).toBe("'file.name.with.many.dots.tar.gz'");
    });

    test('should handle control characters 0x00-0x1F', () => {
      const input = 'file\x01\x02\x03control\x1E\x1Fchars.txt';
      const result = sanitizeForShell(input);
      
      // Control chars should be preserved within quotes
      expect(result).toBe("'file\x01\x02\x03control\x1E\x1Fchars.txt'");
    });

    test('should handle high ASCII characters 0x80-0xFF', () => {
      const input = 'file\x80\x9F\xA0\xFFhigh.txt';
      const result = sanitizeForShell(input);
      
      expect(result).toBe("'file\x80\x9F\xA0\xFFhigh.txt'");
    });

    test('should handle environment variable patterns', () => {
      const patterns = [
        '$VAR',
        '${VAR}',
        '$1',
        '$$',
        '$#',
        '$?',
        '$*',
        '$@'
      ];
      
      for (const pattern of patterns) {
        const input = `file${pattern}name.txt`;
        const result = sanitizeForShell(input);
        
        // Should be safely quoted to prevent variable expansion
        expect(result).toBe(`'file${pattern}name.txt'`);
        expect(result.startsWith("'")).toBe(true);
        expect(result.endsWith("'")).toBe(true);
      }
    });

    test('should handle glob patterns', () => {
      const patterns = ['*', '?', '[abc]', '{a,b,c}', '**'];
      
      for (const pattern of patterns) {
        const input = `file${pattern}name.txt`;
        const result = sanitizeForShell(input);
        
        // Should be safely quoted to prevent glob expansion
        expect(result).toBe(`'file${pattern}name.txt'`);
      }
    });

    test('should handle tilde expansion patterns', () => {
      const input = '~/file.txt';
      const result = sanitizeForShell(input);
      
      // Should be safely quoted to prevent tilde expansion
      expect(result).toBe("'~/file.txt'");
    });

    test('should handle command substitution patterns', () => {
      const patterns = [
        '$(command)',
        '`command`',
        '$((expression))'
      ];
      
      for (const pattern of patterns) {
        const input = `file${pattern}name.txt`;
        const result = sanitizeForShell(input);
        
        // Should be safely quoted to prevent command substitution
        expect(result).toBe(`'file${pattern}name.txt'`);
      }
    });

    test('should handle process substitution patterns', () => {
      const patterns = ['<(command)', '>(command)'];
      
      for (const pattern of patterns) {
        const input = `file${pattern}name.txt`;
        const result = sanitizeForShell(input);
        
        // Should be safely quoted to prevent process substitution
        expect(result).toBe(`'file${pattern}name.txt'`);
      }
    });
  });
});
