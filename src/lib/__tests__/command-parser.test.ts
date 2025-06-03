import { parseCommand, getTaskType } from '../command-parser';

describe('Command Parser', () => {
  describe('parseCommand', () => {
    it('should handle valid @uwularpy mentions', () => {
      const result = parseCommand('@uwularpy plan');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('plan');
      expect(result.fullText).toBe('plan');
    });

    it('should handle @l mentions', () => {
      const result = parseCommand('@l r');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('r');
      expect(result.fullText).toBe('r');
    });

    it('should handle mentions without commands', () => {
      const result = parseCommand('@uwularpy');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('');
      expect(result.fullText).toBe('');
    });

    it('should handle case insensitive mentions', () => {
      const result = parseCommand('@UWULARPY PLAN');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('plan');
      expect(result.fullText).toBe('PLAN');
    });

    it('should reject non-mentions', () => {
      const result = parseCommand('This is just a regular comment');
      expect(result.isMention).toBe(false);
      expect(result.command).toBe('');
    });

    it('should sanitize HTML tags', () => {
      const result = parseCommand('@uwularpy <script>alert("xss")</script>plan');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('plan');
      expect(result.fullText).not.toContain('<script>');
    });

    it('should sanitize markdown links', () => {
      const result = parseCommand('@uwularpy [link text](http://example.com) plan');
      expect(result.isMention).toBe(true);
      expect(result.fullText).toContain('link text');
      expect(result.fullText).not.toContain('http://example.com');
    });

    it('should remove javascript: attempts', () => {
      const result = parseCommand('@uwularpy javascript:alert("xss") plan');
      expect(result.isMention).toBe(true);
      expect(result.fullText).not.toContain('javascript:');
    });

    it('should handle null/undefined input', () => {
      expect(parseCommand(null as any).isMention).toBe(false);
      expect(parseCommand(undefined as any).isMention).toBe(false);
      expect(parseCommand('').isMention).toBe(false);
    });

    it('should handle very long comments by truncating', () => {
      const longComment = '@uwularpy ' + 'a'.repeat(15000);
      const result = parseCommand(longComment);
      expect(result.isMention).toBe(true);
      expect(result.fullText.length).toBeLessThan(15000);
    });

    it('should handle multiple mentions by taking the first', () => {
      const result = parseCommand('@uwularpy plan @othertag review');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('plan');
      expect(result.fullText).not.toContain('@othertag');
    });

    it('should handle whitespace variations', () => {
      const result = parseCommand('  @uwularpy   plan   ');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('plan');
    });

    it('should handle mentions at end of comment', () => {
      const result = parseCommand('Some text @uwularpy');
      expect(result.isMention).toBe(true);
      expect(result.command).toBe('');
    });
  });

  describe('getTaskType', () => {
    it('should return plan-task for plan command', () => {
      const parsed = parseCommand('@uwularpy plan');
      expect(getTaskType(parsed)).toBe('plan-task');
    });

    it('should return plan-task for planning alias', () => {
      const parsed = parseCommand('@uwularpy planning');
      expect(getTaskType(parsed)).toBe('plan-task');
    });

    it('should return plan-task for analyze alias', () => {
      const parsed = parseCommand('@uwularpy analyze');
      expect(getTaskType(parsed)).toBe('plan-task');
    });

    it('should return full-code-review for r command', () => {
      const parsed = parseCommand('@uwularpy r');
      expect(getTaskType(parsed)).toBe('full-code-review');
    });

    it('should return full-code-review for review alias', () => {
      const parsed = parseCommand('@uwularpy review');
      expect(getTaskType(parsed)).toBe('full-code-review');
    });

    it('should return uwuify-repository for empty command', () => {
      const parsed = parseCommand('@uwularpy');
      expect(getTaskType(parsed)).toBe('uwuify-repository');
    });

    it('should return codex-task for unknown commands', () => {
      const parsed = parseCommand('@uwularpy unknown-command');
      expect(getTaskType(parsed)).toBe('codex-task');
    });

    it('should return null for non-mentions', () => {
      const parsed = parseCommand('regular comment');
      expect(getTaskType(parsed)).toBeNull();
    });

    it('should handle null/undefined input', () => {
      expect(getTaskType(null as any)).toBeNull();
      expect(getTaskType(undefined as any)).toBeNull();
    });

    it('should be case insensitive', () => {
      const parsed = parseCommand('@uwularpy PLAN');
      expect(getTaskType(parsed)).toBe('plan-task');
    });

    it('should handle commands with extra whitespace', () => {
      const parsed = parseCommand('@uwularpy   plan   ');
      expect(getTaskType(parsed)).toBe('plan-task');
    });
  });
});