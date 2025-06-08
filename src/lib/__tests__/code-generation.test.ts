// Test for new code generation functionality
import { generateCodeChanges } from '../openai-operations';

describe('Code Generation with OpenAI API', () => {
  // Mock environment for testing
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up test environment
    process.env = { ...originalEnv };
    // Mock OPENAI_API_KEY for testing
    process.env.OPENAI_API_KEY = 'test-key';
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
    
    await expect(generateCodeChanges('test prompt')).rejects.toThrow();
  });

  test('should accept prompt and repository context parameters', () => {
    // This test just verifies the function signature
    expect(() => {
      generateCodeChanges('test prompt', 'repository context');
    }).not.toThrow();
  });
});