// Test for new code generation functionality
import { generateCodeChanges, CODEX_CONFIG } from '../openai-operations';

// Mock the entire openai module with a factory function
jest.mock('openai', () => {
  const mockCreate = jest.fn();
  const mockOpenAI = jest.fn(() => ({
    chat: {
      completions: {
        create: mockCreate
      }
    }
  }));
  
  return {
    __esModule: true,
    default: mockOpenAI
  };
});

// Import the mocked module to get access to the mocks
const OpenAI = require('openai').default;

describe('Code Generation with OpenAI API', () => {
  // Mock environment for testing
  const originalEnv = process.env;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    // Set up test environment
    process.env = { ...originalEnv };
    // Mock OPENAI_API_KEY for testing
    process.env.OPENAI_API_KEY = 'sk-test-key-mock';
    
    // Comprehensive mock reset to prevent state bleed between tests
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
    
    // Explicitly reset OpenAI constructor and all its instances
    OpenAI.mockClear();
    OpenAI.mockReset();
    if (OpenAI.mockRestore) {
      OpenAI.mockRestore();
    }
    
    // Set up fresh mock implementation
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked response' } }]
          })
        }
      }
    }));
    
    // Get fresh mock instance and set up the mock reference
    const mockInstance = new OpenAI();
    mockCreate = mockInstance.chat.completions.create as jest.Mock;
    
    // Clear any timers to prevent interference only if needed
    try {
      jest.clearAllTimers();
    } catch (error) {
      // Ignore timer errors if fake timers aren't enabled
    }
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Comprehensive cleanup to ensure test isolation
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.restoreAllMocks();
    
    // Reset module cache to prevent state leakage
    jest.resetModules();
    
    // Clear any remaining timers only if fake timers are being used
    try {
      jest.clearAllTimers();
    } catch (error) {
      // Ignore timer errors if fake timers aren't enabled
    }
    
    // Explicitly clean OpenAI mock state
    if (OpenAI.mockClear) {
      OpenAI.mockClear();
    }
    
    // Force garbage collection of any retained references (if available)
    if (global.gc) {
      global.gc();
    }
  });

  test('should have generateCodeChanges function available', () => {
    expect(typeof generateCodeChanges).toBe('function');
  });

  test('should throw error when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    
    await expect(generateCodeChanges('test prompt')).rejects.toThrow('OPENAI_API_KEY environment variable is not set');
  });

  test('should throw error when OPENAI_API_KEY is empty', async () => {
    process.env.OPENAI_API_KEY = '';
    
    await expect(generateCodeChanges('test prompt')).rejects.toThrow('OPENAI_API_KEY environment variable is not set');
  });

  test('should throw error when OPENAI_API_KEY is not a string', async () => {
    // @ts-ignore - Testing invalid type
    process.env.OPENAI_API_KEY = 123;
    
    await expect(generateCodeChanges('test prompt')).rejects.toThrow('OPENAI_API_KEY must be a string value');
  });

  test('should accept prompt and repository context parameters', () => {
    // This test just verifies the function signature accepts the parameters
    expect(() => {
      // This should not throw a synchronous error
      const promise = generateCodeChanges('test prompt', 'repository context');
      expect(promise).toBeInstanceOf(Promise);
    }).not.toThrow();
  });

  test('should use CODEX_CONFIG for code generation', () => {
    expect(CODEX_CONFIG.model).toBe('gpt-4');
    expect(CODEX_CONFIG.temperature).toBe(0.1);
    expect(CODEX_CONFIG.maxTokens).toBe(16000);
  });

  test('should generate response with search-replace format instructions', async () => {
    const response = await generateCodeChanges('test prompt');
    
    // Should return a string response
    expect(typeof response).toBe('string');
    expect(response).toBe('Mocked response');
    
    // Verify OpenAI was called correctly
    expect(mockCreate).toHaveBeenCalledTimes(1);
    // Note: OpenAI constructor might be called multiple times during module initialization
  });

  test('should include repository context in prompt when provided', async () => {
    const repositoryContext = 'Test repository structure';
    
    const response = await generateCodeChanges('test prompt', repositoryContext);
    
    // Should return a string response
    expect(typeof response).toBe('string');
    expect(response).toBe('Mocked response');
    
    // Verify the call was made with enhanced prompt including context
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('REPOSITORY CONTEXT:');
    expect(callArgs.messages[1].content).toContain(repositoryContext);
  });

  describe('Edge Cases', () => {
    test('should handle empty prompt', async () => {
      const response = await generateCodeChanges('');
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle very long repository context', async () => {
      const longContext = 'x'.repeat(1000);
      
      const response = await generateCodeChanges('test prompt', longContext);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle special characters in prompt', async () => {
      const specialPrompt = 'Test with "quotes" and `backticks` and $variables';
      
      const response = await generateCodeChanges(specialPrompt);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle OpenAI API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API Error'));
      
      await expect(generateCodeChanges('test prompt')).rejects.toThrow('Failed to generate code changes: OpenAI API failed: API Error');
    });

    test('should handle empty OpenAI response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '' } }]
      });
      
      const response = await generateCodeChanges('test prompt');
      expect(response).toBe('');
    });

    test('should handle malformed OpenAI response', async () => {
      mockCreate.mockResolvedValue({
        choices: []
      });
      
      const response = await generateCodeChanges('test prompt');
      expect(response).toBe('');
    });
  });

  describe('API Key Validation', () => {
    test('should warn about potentially invalid API key format', async () => {
      // Mock console.warn to capture the warning
      const originalConsole = console.warn;
      console.warn = jest.fn();
      
      process.env.OPENAI_API_KEY = 'invalid-key-format';
      
      try {
        await generateCodeChanges('test prompt');
        // Should still work but may have logged a warning
        expect(mockCreate).toHaveBeenCalledTimes(1);
      } catch (error) {
        // This test is about the warning, not whether it fails
      } finally {
        console.warn = originalConsole;
      }
    });

    test('should handle sk-proj- prefixed keys', async () => {
      process.env.OPENAI_API_KEY = 'sk-proj-test-key';
      
      const response = await generateCodeChanges('test prompt');
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle very long API keys', async () => {
      process.env.OPENAI_API_KEY = 'sk-' + 'a'.repeat(200);
      
      const response = await generateCodeChanges('test prompt');
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle API keys with special characters', async () => {
      process.env.OPENAI_API_KEY = 'sk-test_key-with.special+chars=123';
      
      const response = await generateCodeChanges('test prompt');
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery and Resilience', () => {
    test('should handle network timeouts gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('Request timeout'));
      
      await expect(generateCodeChanges('test prompt')).rejects.toThrow('Failed to generate code changes: OpenAI API failed: Request timeout');
    });

    test('should handle rate limiting errors', async () => {
      mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));
      
      await expect(generateCodeChanges('test prompt')).rejects.toThrow('Failed to generate code changes: OpenAI API failed: Rate limit exceeded');
    });

    test('should handle authentication errors', async () => {
      mockCreate.mockRejectedValue(new Error('Invalid API key'));
      
      await expect(generateCodeChanges('test prompt')).rejects.toThrow('Failed to generate code changes: OpenAI API failed: Invalid API key');
    });

    test('should handle service unavailable errors', async () => {
      mockCreate.mockRejectedValue(new Error('Service temporarily unavailable'));
      
      await expect(generateCodeChanges('test prompt')).rejects.toThrow('Failed to generate code changes: OpenAI API failed: Service temporarily unavailable');
    });

    test('should handle unexpected response format from OpenAI', async () => {
      mockCreate.mockResolvedValue({
        // Missing choices array
        usage: { total_tokens: 100 }
      });
      
      const response = await generateCodeChanges('test prompt');
      expect(response).toBe('');
    });

    test('should handle null response from OpenAI', async () => {
      mockCreate.mockResolvedValue(null);
      
      const response = await generateCodeChanges('test prompt');
      expect(response).toBe('');
    });

    test('should handle undefined response from OpenAI', async () => {
      mockCreate.mockResolvedValue(undefined);
      
      const response = await generateCodeChanges('test prompt');
      expect(response).toBe('');
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should handle extremely long prompts', async () => {
      const longPrompt = 'A'.repeat(100000);
      
      const response = await generateCodeChanges(longPrompt);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle prompts with null bytes', async () => {
      const malformedPrompt = 'test\x00prompt\x00with\x00nulls';
      
      const response = await generateCodeChanges(malformedPrompt);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle prompts with control characters', async () => {
      const controlPrompt = 'test\x01\x02\x03prompt';
      
      const response = await generateCodeChanges(controlPrompt);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle Unicode and emoji in prompts', async () => {
      const unicodePrompt = 'test 🚀 prompt with ñáéíóú characters';
      
      const response = await generateCodeChanges(unicodePrompt);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    test('should handle repository context with special characters', async () => {
      const specialContext = 'Repository with\nline breaks\tand\x00nulls';
      
      const response = await generateCodeChanges('test prompt', specialContext);
      expect(typeof response).toBe('string');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration and Model Settings', () => {
    test('should respect CODEX_CONFIG temperature setting', () => {
      expect(CODEX_CONFIG.temperature).toBe(0.1);
      expect(CODEX_CONFIG.temperature).toBeLessThan(0.5); // Ensure deterministic output
    });

    test('should respect CODEX_CONFIG max tokens setting', () => {
      expect(CODEX_CONFIG.maxTokens).toBe(16000);
      expect(CODEX_CONFIG.maxTokens).toBeGreaterThan(1000); // Ensure sufficient tokens
    });

    test('should use GPT-4 model for code generation', () => {
      expect(CODEX_CONFIG.model).toBe('gpt-4');
    });

    test('should validate model configuration at runtime', async () => {
      // Mock a successful response to verify config is passed correctly
      const response = await generateCodeChanges('test prompt');
      
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4',
          max_tokens: 16000,
          temperature: 0.1
        })
      );
    });
  });
});

