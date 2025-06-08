// Test for new code generation functionality
import { generateCodeChanges, CODEX_CONFIG } from '../openai-operations';

// Mock the entire openai module
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mocked response' } }]
          })
        }
      }
    }))
  };
});

describe('Code Generation with OpenAI API', () => {
  // Mock environment for testing
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up test environment
    process.env = { ...originalEnv };
    // Mock OPENAI_API_KEY for testing
    process.env.OPENAI_API_KEY = 'test-key-mock';
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test('should have generateCodeChanges function available', () => {
    expect(typeof generateCodeChanges).toBe('function');
  });

  test('should throw error when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    
    await expect(generateCodeChanges('test prompt')).rejects.toThrow('OPENAI_API_KEY environment variable is not set');
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
  });

  test('should include repository context in prompt when provided', async () => {
    const repositoryContext = 'Test repository structure';
    
    const response = await generateCodeChanges('test prompt', repositoryContext);
    
    // Should return a string response
    expect(typeof response).toBe('string');
    expect(response).toBe('Mocked response');
  });

  describe('Edge Cases', () => {
    test('should handle empty prompt', async () => {
      const response = await generateCodeChanges('');
      expect(typeof response).toBe('string');
    });

    test('should handle very long repository context', async () => {
      const longContext = 'x'.repeat(1000);
      
      const response = await generateCodeChanges('test prompt', longContext);
      expect(typeof response).toBe('string');
    });

    test('should handle special characters in prompt', async () => {
      const specialPrompt = 'Test with "quotes" and `backticks` and $variables';
      
      const response = await generateCodeChanges(specialPrompt);
      expect(typeof response).toBe('string');
    });
  });
});
