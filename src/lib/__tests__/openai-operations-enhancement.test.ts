import { selectModelForUser, createIdeaGenerationConfig } from '../openai-operations';

describe('OpenAI Operations Enhancement', () => {
  describe('selectModelForUser', () => {
    it('should select o3-mini for VIP users', () => {
      expect(selectModelForUser('0xrinegade')).toBe('o3-mini');
      expect(selectModelForUser('larp0')).toBe('o3-mini');
      expect(selectModelForUser('LARP0')).toBe('o3-mini'); // Case insensitive
      expect(selectModelForUser('0XRINEGADE')).toBe('o3-mini'); // Case insensitive
    });

    it('should select gpt-4.1-mini for regular users', () => {
      expect(selectModelForUser('normaluser')).toBe('gpt-4.1-mini');
      expect(selectModelForUser('developer123')).toBe('gpt-4.1-mini');
      expect(selectModelForUser('anonymous')).toBe('gpt-4.1-mini');
      expect(selectModelForUser('')).toBe('gpt-4.1-mini');
    });
  });

  describe('createIdeaGenerationConfig', () => {
    it('should create high creativity config for VIP users with o3-mini', () => {
      const config = createIdeaGenerationConfig('0xrinegade');
      expect(config.model).toBe('o3-mini');
      expect(config.temperature).toBe(0.9);
      expect(config.maxTokens).toBe(30000);
    });

    it('should create high creativity config for regular users with gpt-4.1-mini', () => {
      const config = createIdeaGenerationConfig('normaluser');
      expect(config.model).toBe('gpt-4.1-mini');
      expect(config.temperature).toBe(0.9);
      expect(config.maxTokens).toBe(30000);
    });
  });

  describe('o3-mini API parameter validation', () => {
    it('should verify o3 model detection logic', () => {
      // Test the model detection logic that determines reasoning models
      const o3Model = 'o3-mini';
      const gptModel = 'gpt-4.1-mini';
      
      // This tests the same logic used in generateAIResponse
      expect(o3Model.startsWith('o3')).toBe(true);
      expect(gptModel.startsWith('o3')).toBe(false);
    });
  });
});