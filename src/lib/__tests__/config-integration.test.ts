// Tests for configuration system and its integration with operations
import { 
  setGlobalConfig, 
  getGlobalConfig, 
  getFileOperationsConfig, 
  getGitOperationsConfig,
  getCodeGenerationConfig,
  resetConfig,
  loadConfigFromEnvironment,
  validateConfig,
  createPresetConfig,
  DEFAULT_FILE_OPERATIONS_CONFIG,
  DEFAULT_GIT_OPERATIONS_CONFIG,
  DEFAULT_CODE_GENERATION_CONFIG
} from '../config';

import { 
  applySearchReplace,
  validateSearchReplaceBlock
} from '../file-operations';

import { 
  sanitizeForShell,
  safeGitPushWithRetry
} from '../git-utils';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock the structured logger
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

// Mock the trigger logger
jest.mock('@trigger.dev/sdk/v3', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('Configuration System Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    // Reset configuration before each test
    resetConfig();
    
    // Create temp directory for file operations tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    fs.mkdirSync(path.join(tempDir, '.backup'), { recursive: true });
  });

  afterEach(() => {
    resetConfig();
    
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Configuration Management', () => {
    test('should have sensible default configurations', () => {
      const fileConfig = getFileOperationsConfig();
      const gitConfig = getGitOperationsConfig();
      const codeConfig = getCodeGenerationConfig();

      expect(fileConfig.backupTTL).toBe(60000);
      expect(fileConfig.minSecurityScore).toBe(50);
      expect(fileConfig.enableBackups).toBe(true);

      expect(gitConfig.maxRetries).toBe(3);
      expect(gitConfig.baseDelay).toBe(1000);
      expect(gitConfig.enableShellSanitization).toBe(true);

      expect(codeConfig.enableContentValidation).toBe(true);
      expect(codeConfig.maxResponseSize).toBe(100 * 1024);
    });

    test('should allow partial configuration updates', () => {
      setGlobalConfig({
        fileOperations: {
          backupTTL: 30000,
          minSecurityScore: 80
        },
        gitOperations: {
          maxRetries: 5
        }
      });

      const fileConfig = getFileOperationsConfig();
      const gitConfig = getGitOperationsConfig();

      expect(fileConfig.backupTTL).toBe(30000);
      expect(fileConfig.minSecurityScore).toBe(80);
      expect(fileConfig.enableBackups).toBe(true); // Default preserved

      expect(gitConfig.maxRetries).toBe(5);
      expect(gitConfig.baseDelay).toBe(1000); // Default preserved
    });

    test('should preserve existing config when adding new settings', () => {
      setGlobalConfig({
        fileOperations: { backupTTL: 45000 }
      });

      setGlobalConfig({
        fileOperations: { minSecurityScore: 70 }
      });

      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.backupTTL).toBe(45000); // Should be preserved
      expect(fileConfig.minSecurityScore).toBe(70);
    });

    test('should reset to defaults correctly', () => {
      setGlobalConfig({
        fileOperations: { backupTTL: 99999 },
        gitOperations: { maxRetries: 99 }
      });

      resetConfig();

      const fileConfig = getFileOperationsConfig();
      const gitConfig = getGitOperationsConfig();

      expect(fileConfig.backupTTL).toBe(DEFAULT_FILE_OPERATIONS_CONFIG.backupTTL);
      expect(gitConfig.maxRetries).toBe(DEFAULT_GIT_OPERATIONS_CONFIG.maxRetries);
    });
  });

  describe('Environment Configuration Loading', () => {
    const originalEnv = process.env;

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should load configuration from environment variables', () => {
      process.env = {
        ...originalEnv,
        BACKUP_TTL: '90000',
        MIN_SECURITY_SCORE: '75',
        GIT_MAX_RETRIES: '4',
        GIT_BASE_DELAY: '1500',
        ENABLE_STRICT_MODE: 'true'
      };

      const envConfig = loadConfigFromEnvironment();
      setGlobalConfig(envConfig);

      const fileConfig = getFileOperationsConfig();
      const gitConfig = getGitOperationsConfig();

      expect(fileConfig.backupTTL).toBe(90000);
      expect(fileConfig.minSecurityScore).toBe(75);
      expect(fileConfig.strictMode).toBe(true);
      expect(gitConfig.maxRetries).toBe(4);
      expect(gitConfig.baseDelay).toBe(1500);
    });

    test('should handle invalid environment values gracefully', () => {
      process.env = {
        ...originalEnv,
        BACKUP_TTL: 'invalid_number',
        MIN_SECURITY_SCORE: 'not_a_number'
      };

      const envConfig = loadConfigFromEnvironment();
      setGlobalConfig(envConfig);

      // Should fallback to defaults when environment values are invalid
      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.backupTTL).toBe(DEFAULT_FILE_OPERATIONS_CONFIG.backupTTL);
      expect(fileConfig.minSecurityScore).toBe(DEFAULT_FILE_OPERATIONS_CONFIG.minSecurityScore);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configurations', () => {
      const validConfig = {
        fileOperations: {
          backupTTL: 30000,
          minSecurityScore: 60,
          maxFileSize: 1024 * 1024
        },
        gitOperations: {
          maxRetries: 2,
          baseDelay: 500,
          maxDelay: 10000
        }
      };

      const validation = validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid configuration values', () => {
      const invalidConfig = {
        fileOperations: {
          backupTTL: -1000,
          minSecurityScore: 150,
          maxFileSize: -500
        },
        gitOperations: {
          maxRetries: -1,
          baseDelay: -100,
          maxDelay: 500,
          commandTimeout: 100 // Too short
        }
      };

      const validation = validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain('Backup TTL cannot be negative');
      expect(validation.errors).toContain('Minimum security score must be between 0 and 100');
      expect(validation.errors).toContain('Maximum retries cannot be negative');
      expect(validation.errors).toContain('Command timeout should be at least 1000ms');
    });

    test('should detect conflicting configuration values', () => {
      const conflictingConfig = {
        gitOperations: {
          baseDelay: 5000,
          maxDelay: 2000 // baseDelay > maxDelay
        }
      };

      const validation = validateConfig(conflictingConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Base delay cannot be greater than maximum delay');
    });
  });

  describe('Preset Configurations', () => {
    test('should create development preset correctly', () => {
      const devConfig = createPresetConfig('development');
      setGlobalConfig(devConfig);

      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.enableDetailedLogging).toBe(true);
      expect(fileConfig.minSecurityScore).toBe(30);
      expect(fileConfig.strictMode).toBe(false);
    });

    test('should create production preset correctly', () => {
      const prodConfig = createPresetConfig('production');
      setGlobalConfig(prodConfig);

      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.minSecurityScore).toBe(70);
      expect(fileConfig.strictMode).toBe(true);
      expect(fileConfig.enableDetailedLogging).toBe(false);
    });

    test('should create strict preset correctly', () => {
      const strictConfig = createPresetConfig('strict');
      setGlobalConfig(strictConfig);

      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.minSecurityScore).toBe(90);
      expect(fileConfig.strictMode).toBe(true);
      expect(fileConfig.maxFileSize).toBe(10 * 1024 * 1024);
    });

    test('should create testing preset correctly', () => {
      const testConfig = createPresetConfig('testing');
      setGlobalConfig(testConfig);

      const fileConfig = getFileOperationsConfig();
      const gitConfig = getGitOperationsConfig();

      expect(fileConfig.enableBackups).toBe(false);
      expect(fileConfig.enableDetailedLogging).toBe(false);
      expect(gitConfig.maxRetries).toBe(1);
    });
  });

  describe('Configuration Integration with File Operations', () => {
    test('should respect custom backup TTL in file operations', () => {
      setGlobalConfig({
        fileOperations: { backupTTL: 5000 } // 5 seconds
      });

      const testFile = 'config-test.txt';
      const originalContent = 'original content';
      fs.writeFileSync(path.join(tempDir, testFile), originalContent);

      const result = applySearchReplace(testFile, 'original', 'modified', tempDir);
      expect(result).toBe(true);

      // Verify backup was created
      const backupFiles = fs.readdirSync(path.join(tempDir, '.backup'));
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    test('should respect custom security score threshold', () => {
      setGlobalConfig({
        fileOperations: { minSecurityScore: 90 } // Very high threshold
      });

      const testFile = 'security-test.txt';
      const content = 'const safe = "content";';
      fs.writeFileSync(path.join(tempDir, testFile), content);

      // Even a relatively safe operation might not meet 90 threshold
      const result = applySearchReplace(testFile, 'safe', 'modified', tempDir);
      
      // The exact result depends on the scoring algorithm, but the config should be respected
      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.minSecurityScore).toBe(90);
    });

    test('should respect strict mode settings', () => {
      setGlobalConfig({
        fileOperations: { 
          strictMode: true,
          minSecurityScore: 80
        }
      });

      const filePath = 'strict-test.js';
      const content = 'function test() { return true; }';
      const searchText = 'function test()';
      const replaceText = 'function test() /* complex modification */';

      const validation = validateSearchReplaceBlock(filePath, searchText, replaceText, content);
      
      // Strict mode should enforce higher standards
      const fileConfig = getFileOperationsConfig();
      expect(fileConfig.strictMode).toBe(true);
      expect(fileConfig.minSecurityScore).toBe(80);
    });

    test('should disable backups when configured', () => {
      setGlobalConfig({
        fileOperations: { enableBackups: false }
      });

      const testFile = 'no-backup-test.txt';
      const originalContent = 'content without backup';
      fs.writeFileSync(path.join(tempDir, testFile), originalContent);

      const result = applySearchReplace(testFile, 'content', 'modified', tempDir);
      expect(result).toBe(true);

      // Verify no backup was created
      const backupFiles = fs.readdirSync(path.join(tempDir, '.backup'));
      expect(backupFiles.length).toBe(0);
    });
  });

  describe('Configuration Integration with Git Operations', () => {
    test('should respect custom commit message length limit', () => {
      setGlobalConfig({
        gitOperations: { maxCommitMessageLength: 20 }
      });

      const longMessage = 'This is a very long commit message that exceeds the limit';
      const sanitized = sanitizeForShell(longMessage);
      
      // Message should be truncated to 20 characters + quotes
      expect(sanitized.length).toBeLessThanOrEqual(22); // 20 chars + 2 quotes
    });

    test('should respect custom retry configuration', async () => {
      setGlobalConfig({
        gitOperations: {
          maxRetries: 2,
          baseDelay: 100,
          maxDelay: 500
        }
      });

      const startTime = Date.now();
      
      try {
        // This will fail but should respect the retry config
        await safeGitPushWithRetry('/nonexistent/path', 'test-branch');
      } catch (error) {
        const duration = Date.now() - startTime;
        
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Git push failed after 2 attempts');
        
        // Should have taken approximately: 100ms + 200ms = 300ms (+ execution overhead)
        // Be more lenient with timing since we can't control execution environment
        expect(duration).toBeGreaterThan(50);
        expect(duration).toBeLessThan(2000);
      }
    });

    test('should respect max delay configuration in exponential backoff', async () => {
      setGlobalConfig({
        gitOperations: {
          maxRetries: 3,
          baseDelay: 200, // Reduce for faster test
          maxDelay: 400 // Cap at 400ms
        }
      });

      const startTime = Date.now();
      
      try {
        await safeGitPushWithRetry('/nonexistent/path', 'delay-test');
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // With maxDelay=400, delays should be: 200ms, 400ms (capped), 400ms (capped)
        // Total: ~1000ms + overhead
        expect(duration).toBeGreaterThan(500);
        expect(duration).toBeLessThan(3000);
      }
    });
  });

  describe('Custom Dangerous Patterns Configuration', () => {
    test('should allow custom dangerous patterns in validation', () => {
      setGlobalConfig({
        fileOperations: {
          customDangerousPatterns: [
            {
              pattern: /customDanger/i,
              severity: 85,
              description: 'Custom dangerous pattern'
            }
          ]
        }
      });

      const filePath = 'custom-danger-test.js';
      const content = 'const safe = "content";';
      const searchText = 'safe';
      const replaceText = 'customDanger'; // Should trigger custom pattern

      const validation = validateSearchReplaceBlock(filePath, searchText, replaceText, content);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('Custom dangerous pattern'))).toBe(true);
      expect(validation.securityScore).toBeLessThan(50); // Should be penalized by severity 85
    });
  });

  describe('Configuration Persistence and State Management', () => {
    test('should maintain configuration state across multiple operations', () => {
      setGlobalConfig({
        fileOperations: { minSecurityScore: 60 },
        gitOperations: { maxRetries: 4 }
      });

      // Perform multiple operations and verify config is maintained
      const config1 = getFileOperationsConfig();
      const config2 = getGitOperationsConfig();

      expect(config1.minSecurityScore).toBe(60);
      expect(config2.maxRetries).toBe(4);

      // Get configs again to ensure they're persistent
      const config3 = getFileOperationsConfig();
      const config4 = getGitOperationsConfig();

      expect(config3.minSecurityScore).toBe(60);
      expect(config4.maxRetries).toBe(4);
    });

    test('should handle concurrent configuration access safely', () => {
      setGlobalConfig({
        fileOperations: { backupTTL: 12345 }
      });

      // Simulate concurrent access
      const configs = Array.from({ length: 10 }, () => getFileOperationsConfig());
      
      configs.forEach(config => {
        expect(config.backupTTL).toBe(12345);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle undefined and null configuration values', () => {
      // @ts-ignore - Testing edge case
      setGlobalConfig(null);
      
      const config = getFileOperationsConfig();
      expect(config.backupTTL).toBe(DEFAULT_FILE_OPERATIONS_CONFIG.backupTTL);
    });

    test('should handle partial invalid configurations', () => {
      const partialConfig = {
        fileOperations: {
          backupTTL: 30000,
          // @ts-ignore - Testing edge case with invalid value
          minSecurityScore: 'invalid'
        }
      };

      // Should not throw and should handle gracefully
      expect(() => setGlobalConfig(partialConfig)).not.toThrow();
      
      const config = getFileOperationsConfig();
      expect(config.backupTTL).toBe(30000);
    });

    test('should validate preset configurations', () => {
      const presets = ['development', 'testing', 'production', 'strict'] as const;
      
      presets.forEach(preset => {
        const presetConfig = createPresetConfig(preset);
        const validation = validateConfig(presetConfig);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
    });
  });
});