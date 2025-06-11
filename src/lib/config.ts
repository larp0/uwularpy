/**
 * Configuration interface for file operations and security settings.
 * Provides flexibility for backup TTL and security thresholds.
 */

export interface FileOperationsConfig {
  // Backup settings
  backupTTL?: number;                    // Backup time-to-live in milliseconds (default: 60000)
  enableBackups?: boolean;               // Enable/disable backup creation (default: true)
  maxBackupsPerFile?: number;            // Maximum number of backups to keep per file (default: 5)
  
  // Security thresholds
  minSecurityScore?: number;             // Minimum security score to allow operation (default: 50)
  maxFileSize?: number;                  // Maximum file size for operations in bytes (default: 50MB)
  maxSearchReplaceSize?: number;         // Maximum search/replace text size in bytes (default: 50KB)
  
  // Complexity and validation settings
  enableSyntaxValidation?: boolean;      // Enable file-type specific syntax validation (default: true)
  enableComplexityAnalysis?: boolean;    // Enable complexity analysis (default: true)
  maxComplexityForHighSecurity?: string; // Max complexity level for high security operations (default: 'medium')
  
  // Performance settings
  maxContextLength?: number;             // Maximum repository context length (default: 8000)
  maxFileContentSize?: number;           // Maximum file content size for context (default: 1000)
  maxFilesPerCategory?: number;          // Maximum files to show per category (default: 20)
  
  // Dangerous pattern settings
  customDangerousPatterns?: Array<{      // Additional custom dangerous patterns
    pattern: RegExp;
    severity: number;
    description: string;
  }>;
  
  // Error handling
  strictMode?: boolean;                  // Strict mode for enhanced security (default: false)
  enableDetailedLogging?: boolean;       // Enable detailed operation logging (default: true)
}

/**
 * Default configuration for file operations.
 */
export const DEFAULT_FILE_OPERATIONS_CONFIG: Required<FileOperationsConfig> = {
  // Backup settings
  backupTTL: 60000,                     // 1 minute
  enableBackups: true,
  maxBackupsPerFile: 5,
  
  // Security thresholds
  minSecurityScore: 50,
  maxFileSize: 50 * 1024 * 1024,       // 50MB
  maxSearchReplaceSize: 50 * 1024,      // 50KB
  
  // Complexity and validation settings
  enableSyntaxValidation: true,
  enableComplexityAnalysis: true,
  maxComplexityForHighSecurity: 'medium',
  
  // Performance settings
  maxContextLength: 8000,
  maxFileContentSize: 1000,
  maxFilesPerCategory: 20,
  
  // Dangerous pattern settings
  customDangerousPatterns: [],
  
  // Error handling
  strictMode: false,
  enableDetailedLogging: true
};

/**
 * Git operations configuration interface.
 */
export interface GitOperationsConfig {
  // Retry settings
  maxRetries?: number;                   // Maximum number of retry attempts (default: 3)
  baseDelay?: number;                    // Base delay for exponential backoff in ms (default: 1000)
  maxDelay?: number;                     // Maximum delay between retries in ms (default: 30000)
  
  // Security settings
  enableShellSanitization?: boolean;     // Enable shell input sanitization (default: true)
  maxCommitMessageLength?: number;       // Maximum commit message length (default: 1000)
  
  // Performance settings
  commandTimeout?: number;               // Timeout for git commands in ms (default: 30000)
  enableStructuredLogging?: boolean;     // Enable structured logging (default: true)
  
  // Repository settings
  defaultBranch?: string;                // Default branch name for operations (default: 'main')
  enableGitLFS?: boolean;                // Enable Git LFS support (default: false)
}

/**
 * Default configuration for git operations.
 */
export const DEFAULT_GIT_OPERATIONS_CONFIG: Required<GitOperationsConfig> = {
  // Retry settings
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  
  // Security settings
  enableShellSanitization: true,
  maxCommitMessageLength: 1000,
  
  // Performance settings
  commandTimeout: 30000,
  enableStructuredLogging: true,
  
  // Repository settings
  defaultBranch: 'main',
  enableGitLFS: false
};

/**
 * Code generation configuration interface.
 */
export interface CodeGenerationConfig {
  // Security settings
  enableContentValidation?: boolean;     // Enable AI response content validation (default: true)
  maxResponseSize?: number;              // Maximum AI response size in bytes (default: 100KB)
  enablePatternFiltering?: boolean;      // Enable dangerous pattern filtering (default: true)
  
  // Performance settings
  enableRepositoryContext?: boolean;     // Include repository context in prompts (default: true)
  enableAsyncOperations?: boolean;       // Use async operations where possible (default: true)
  
  // Optimization settings
  enableResponseOptimization?: boolean;  // Enable response optimization (default: true)
  enableAdvancedValidation?: boolean;    // Enable advanced validation checks (default: true)
}

/**
 * Default configuration for code generation.
 */
export const DEFAULT_CODE_GENERATION_CONFIG: Required<CodeGenerationConfig> = {
  // Security settings
  enableContentValidation: true,
  maxResponseSize: 100 * 1024,          // 100KB
  enablePatternFiltering: true,
  
  // Performance settings
  enableRepositoryContext: true,
  enableAsyncOperations: true,
  
  // Optimization settings
  enableResponseOptimization: true,
  enableAdvancedValidation: true
};

/**
 * Global configuration interface combining all subsystem configurations.
 */
export interface GlobalConfig {
  fileOperations?: Partial<FileOperationsConfig>;
  gitOperations?: Partial<GitOperationsConfig>;
  codeGeneration?: Partial<CodeGenerationConfig>;
}

// Global configuration instance
let globalConfig: GlobalConfig = {};

/**
 * Set global configuration for the application.
 */
export function setGlobalConfig(config: GlobalConfig): void {
  if (!config || typeof config !== 'object') {
    return; // Ignore invalid config
  }
  
  globalConfig = {
    fileOperations: { ...globalConfig.fileOperations, ...config.fileOperations },
    gitOperations: { ...globalConfig.gitOperations, ...config.gitOperations },
    codeGeneration: { ...globalConfig.codeGeneration, ...config.codeGeneration }
  };
}

/**
 * Get current global configuration.
 */
export function getGlobalConfig(): GlobalConfig {
  return { ...globalConfig };
}

/**
 * Get merged file operations configuration.
 */
export function getFileOperationsConfig(): Required<FileOperationsConfig> {
  return {
    ...DEFAULT_FILE_OPERATIONS_CONFIG,
    ...globalConfig.fileOperations
  };
}

/**
 * Get merged git operations configuration.
 */
export function getGitOperationsConfig(): Required<GitOperationsConfig> {
  return {
    ...DEFAULT_GIT_OPERATIONS_CONFIG,
    ...globalConfig.gitOperations
  };
}

/**
 * Get merged code generation configuration.
 */
export function getCodeGenerationConfig(): Required<CodeGenerationConfig> {
  return {
    ...DEFAULT_CODE_GENERATION_CONFIG,
    ...globalConfig.codeGeneration
  };
}

/**
 * Reset configuration to defaults.
 */
export function resetConfig(): void {
  globalConfig = {};
}

/**
 * Environment-based configuration loader.
 * Loads configuration from environment variables with sensible defaults.
 */
export function loadConfigFromEnvironment(): GlobalConfig {
  const config: GlobalConfig = {};
  
  // File operations config from environment
  if (process.env.BACKUP_TTL && !isNaN(parseInt(process.env.BACKUP_TTL, 10))) {
    config.fileOperations = {
      ...config.fileOperations,
      backupTTL: parseInt(process.env.BACKUP_TTL, 10)
    };
  }
  
  if (process.env.MIN_SECURITY_SCORE && !isNaN(parseInt(process.env.MIN_SECURITY_SCORE, 10))) {
    config.fileOperations = {
      ...config.fileOperations,
      minSecurityScore: parseInt(process.env.MIN_SECURITY_SCORE, 10)
    };
  }
  
  if (process.env.ENABLE_STRICT_MODE) {
    config.fileOperations = {
      ...config.fileOperations,
      strictMode: process.env.ENABLE_STRICT_MODE === 'true'
    };
  }
  
  // Git operations config from environment
  if (process.env.GIT_MAX_RETRIES && !isNaN(parseInt(process.env.GIT_MAX_RETRIES, 10))) {
    config.gitOperations = {
      ...config.gitOperations,
      maxRetries: parseInt(process.env.GIT_MAX_RETRIES, 10)
    };
  }
  
  if (process.env.GIT_BASE_DELAY && !isNaN(parseInt(process.env.GIT_BASE_DELAY, 10))) {
    config.gitOperations = {
      ...config.gitOperations,
      baseDelay: parseInt(process.env.GIT_BASE_DELAY, 10)
    };
  }
  
  if (process.env.GIT_COMMAND_TIMEOUT && !isNaN(parseInt(process.env.GIT_COMMAND_TIMEOUT, 10))) {
    config.gitOperations = {
      ...config.gitOperations,
      commandTimeout: parseInt(process.env.GIT_COMMAND_TIMEOUT, 10)
    };
  }
  
  // Code generation config from environment
  if (process.env.MAX_RESPONSE_SIZE && !isNaN(parseInt(process.env.MAX_RESPONSE_SIZE, 10))) {
    config.codeGeneration = {
      ...config.codeGeneration,
      maxResponseSize: parseInt(process.env.MAX_RESPONSE_SIZE, 10)
    };
  }
  
  if (process.env.ENABLE_REPOSITORY_CONTEXT) {
    config.codeGeneration = {
      ...config.codeGeneration,
      enableRepositoryContext: process.env.ENABLE_REPOSITORY_CONTEXT === 'true'
    };
  }
  
  return config;
}

/**
 * Validate configuration values for consistency and security.
 */
export function validateConfig(config: GlobalConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate file operations config
  if (config.fileOperations) {
    const fileConfig = config.fileOperations;
    
    if (fileConfig.backupTTL !== undefined && fileConfig.backupTTL < 0) {
      errors.push('Backup TTL cannot be negative');
    }
    
    if (fileConfig.minSecurityScore !== undefined && 
        (fileConfig.minSecurityScore < 0 || fileConfig.minSecurityScore > 100)) {
      errors.push('Minimum security score must be between 0 and 100');
    }
    
    if (fileConfig.maxFileSize !== undefined && fileConfig.maxFileSize < 0) {
      errors.push('Maximum file size cannot be negative');
    }
    
    if (fileConfig.maxSearchReplaceSize !== undefined && fileConfig.maxSearchReplaceSize < 0) {
      errors.push('Maximum search/replace size cannot be negative');
    }
  }
  
  // Validate git operations config
  if (config.gitOperations) {
    const gitConfig = config.gitOperations;
    
    if (gitConfig.maxRetries !== undefined && gitConfig.maxRetries < 0) {
      errors.push('Maximum retries cannot be negative');
    }
    
    if (gitConfig.baseDelay !== undefined && gitConfig.baseDelay < 0) {
      errors.push('Base delay cannot be negative');
    }
    
    if (gitConfig.maxDelay !== undefined && gitConfig.maxDelay < 0) {
      errors.push('Maximum delay cannot be negative');
    }
    
    if (gitConfig.baseDelay !== undefined && gitConfig.maxDelay !== undefined &&
        gitConfig.baseDelay > gitConfig.maxDelay) {
      errors.push('Base delay cannot be greater than maximum delay');
    }
    
    if (gitConfig.commandTimeout !== undefined && gitConfig.commandTimeout < 1000) {
      errors.push('Command timeout should be at least 1000ms');
    }
    
    if (gitConfig.maxCommitMessageLength !== undefined && gitConfig.maxCommitMessageLength < 10) {
      errors.push('Maximum commit message length should be at least 10 characters');
    }
  }
  
  // Validate code generation config
  if (config.codeGeneration) {
    const codeConfig = config.codeGeneration;
    
    if (codeConfig.maxResponseSize !== undefined && codeConfig.maxResponseSize < 1024) {
      errors.push('Maximum response size should be at least 1024 bytes');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create a preset configuration for different environments.
 */
export function createPresetConfig(preset: 'development' | 'testing' | 'production' | 'strict'): GlobalConfig {
  switch (preset) {
    case 'development':
      return {
        fileOperations: {
          enableDetailedLogging: true,
          minSecurityScore: 30,
          strictMode: false,
          backupTTL: 120000, // 2 minutes
        },
        gitOperations: {
          maxRetries: 2,
          enableStructuredLogging: true,
        },
        codeGeneration: {
          enableAdvancedValidation: true,
          enableRepositoryContext: true,
        }
      };
      
    case 'testing':
      return {
        fileOperations: {
          enableBackups: false,
          enableDetailedLogging: false,
          minSecurityScore: 20,
          backupTTL: 5000, // 5 seconds
        },
        gitOperations: {
          maxRetries: 1,
          baseDelay: 100,
          enableStructuredLogging: false,
        },
        codeGeneration: {
          enableRepositoryContext: false,
          maxResponseSize: 10 * 1024, // 10KB
        }
      };
      
    case 'production':
      return {
        fileOperations: {
          minSecurityScore: 70,
          strictMode: true,
          enableDetailedLogging: false,
          maxBackupsPerFile: 3,
          backupTTL: 30000, // 30 seconds
        },
        gitOperations: {
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 60000,
        },
        codeGeneration: {
          enableContentValidation: true,
          enablePatternFiltering: true,
        }
      };
      
    case 'strict':
      return {
        fileOperations: {
          minSecurityScore: 90,
          strictMode: true,
          enableDetailedLogging: true,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          maxSearchReplaceSize: 10 * 1024, // 10KB
          backupTTL: 300000, // 5 minutes
        },
        gitOperations: {
          maxRetries: 3,
          enableShellSanitization: true,
          maxCommitMessageLength: 500,
        },
        codeGeneration: {
          enableContentValidation: true,
          enablePatternFiltering: true,
          enableAdvancedValidation: true,
          maxResponseSize: 50 * 1024, // 50KB
        }
      };
      
    default:
      return {};
  }
}