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
      expect(result.command).toBe('alert("xss")plan'); // Script tags removed but content remains
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
    it('should return plan-task for plan command', async () => {
      const parsed = parseCommand('@uwularpy plan');
      expect(await getTaskType(parsed)).toBe('plan-task');
    });

    it('should return plan-task for planning alias', async () => {
      const parsed = parseCommand('@uwularpy planning');
      expect(await getTaskType(parsed)).toBe('plan-task');
    });

    it('should return plan-task for analyze alias', async () => {
      const parsed = parseCommand('@uwularpy analyze');
      expect(await getTaskType(parsed)).toBe('plan-task');
    });

    it('should return full-code-review for r command', async () => {
      const parsed = parseCommand('@uwularpy r');
      expect(await getTaskType(parsed)).toBe('full-code-review');
    });

    it('should return full-code-review for review alias', async () => {
      const parsed = parseCommand('@uwularpy review');
      expect(await getTaskType(parsed)).toBe('full-code-review');
    });

    // it('should return uwuify-repository for empty command', async () => {
    //   const parsed = parseCommand('@uwularpy');
    //   expect(await getTaskType(parsed)).toBe('uwuify-repository');
    // });

    it('should return general-response-task for unknown non-dev commands', async () => {
      const parsed = parseCommand('@uwularpy unknown-command');
      expect(await getTaskType(parsed)).toBe('general-response-task'); // Changed: non-dev commands now return general-response-task
    });

    it('should return null for non-mentions', async () => {
      const parsed = parseCommand('regular comment');
      expect(await getTaskType(parsed)).toBeNull();
    });

    it('should handle null/undefined input', async () => {
      expect(await getTaskType(null as any)).toBeNull();
      expect(await getTaskType(undefined as any)).toBeNull();
    });

    it('should be case insensitive', async () => {
      const parsed = parseCommand('@uwularpy PLAN');
      expect(await getTaskType(parsed)).toBe('plan-task');
    });

    it('should handle commands with extra whitespace', async () => {
      const parsed = parseCommand('@uwularpy   plan   ');
      expect(await getTaskType(parsed)).toBe('plan-task');
    });

    // Tests for approval commands - the main issue
    it('should return plan-approval-task for approve command', async () => {
      const parsed = parseCommand('@l approve');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for yes command', async () => {
      const parsed = parseCommand('@l yes');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for y command', async () => {
      const parsed = parseCommand('@l y');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for ok command', async () => {
      const parsed = parseCommand('@l ok');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for okay command', async () => {
      const parsed = parseCommand('@l okay');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for i approve command', async () => {
      const parsed = parseCommand('@l i approve');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for lgtm command', async () => {
      const parsed = parseCommand('@l lgtm');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should be case insensitive for approval commands', async () => {
      const parsed = parseCommand('@l APPROVE');
      expect(await getTaskType(parsed)).toBe('plan-approval-task');
    });

    it('should return plan-approval-task for multi-word approval commands', async () => {
      const parsed1 = parseCommand('@l i approve');
      expect(await getTaskType(parsed1)).toBe('plan-approval-task');
      
      const parsed2 = parseCommand('@l ship it');
      expect(await getTaskType(parsed2)).toBe('plan-approval-task');
      
      const parsed3 = parseCommand('@l looks good');
      expect(await getTaskType(parsed3)).toBe('plan-approval-task');
      
      const parsed4 = parseCommand('@l go ahead');
      expect(await getTaskType(parsed4)).toBe('plan-approval-task');
    });

    it('should handle edge cases for approval commands', async () => {
      // Test with extra spaces and mixed case
      const parsed1 = parseCommand('@l   APPROVE   ');
      expect(await getTaskType(parsed1)).toBe('plan-approval-task');
      
      // Test with newlines (should be cleaned up by parsing)
      const parsed2 = parseCommand('@l approve\n');
      expect(await getTaskType(parsed2)).toBe('plan-approval-task');
      
      // Test commands that should NOT be approval
      const parsed3 = parseCommand('@l approves'); // not exact match
      expect(await getTaskType(parsed3)).toBe('general-response-task'); // Changed: should return general-response-task for non-dev commands
      
      const parsed4 = parseCommand('@l approval'); // not exact match  
      expect(await getTaskType(parsed4)).toBe('general-response-task'); // Changed: should return general-response-task for non-dev commands
      
      const parsed5 = parseCommand('@l not approve'); // contains but not approval
      expect(await getTaskType(parsed5)).toBe('general-response-task'); // Changed: should return general-response-task for non-dev commands
    });

    // Tests for the new "@l dev " specific routing
    it('should return codex-task only for "@l dev " commands', async () => {
      const parsed1 = parseCommand('@l dev fix the issue');
      expect(parsed1.isDevCommand).toBe(true);
      expect(await getTaskType(parsed1)).toBe('codex-task');
      
      const parsed2 = parseCommand('@l dev implement feature');
      expect(parsed2.isDevCommand).toBe(true);
      expect(await getTaskType(parsed2)).toBe('codex-task');
      
      const parsed3 = parseCommand('@l DEV update code');
      expect(parsed3.isDevCommand).toBe(true);
      expect(await getTaskType(parsed3)).toBe('codex-task');
    });

    it('should return general-response-task for non-dev @l commands', async () => {
      const parsed1 = parseCommand('@l help');
      expect(parsed1.isDevCommand).toBe(false);
      expect(await getTaskType(parsed1)).toBe('general-response-task');
      
      const parsed2 = parseCommand('@l what is this');
      expect(parsed2.isDevCommand).toBe(false);
      expect(await getTaskType(parsed2)).toBe('general-response-task');
      
      const parsed3 = parseCommand('@l unknown-command');
      expect(parsed3.isDevCommand).toBe(false);
      expect(await getTaskType(parsed3)).toBe('general-response-task');
      
      const parsed4 = parseCommand('@l developing'); // should not match "dev "
      expect(parsed4.isDevCommand).toBe(false);
      expect(await getTaskType(parsed4)).toBe('general-response-task');
    });

    it('should detect isDevCommand correctly in parseCommand', () => {
      const result1 = parseCommand('@l dev fix this');
      expect(result1.isDevCommand).toBe(true);
      expect(result1.command).toBe('dev fix this');
      
      const result2 = parseCommand('@l help me');
      expect(result2.isDevCommand).toBe(false);
      expect(result2.command).toBe('help me');
      
      const result3 = parseCommand('@l developing'); // should not match
      expect(result3.isDevCommand).toBe(false);
      expect(result3.command).toBe('developing');
      
      const result4 = parseCommand('@l DEV fix this'); // case insensitive
      expect(result4.isDevCommand).toBe(true);
      expect(result4.command).toBe('dev fix this');
    });

    // Tests for the main issue: @l should only trigger when at beginning
    it('should only trigger @l parsing when at beginning of message', () => {
      // These should trigger parsing (at beginning)
      const result1 = parseCommand('@l plan');
      expect(result1.isMention).toBe(true);
      expect(result1.command).toBe('plan');
      
      const result2 = parseCommand('  @l dev fix this  '); // leading whitespace ok
      expect(result2.isMention).toBe(true);
      expect(result2.command).toBe('dev fix this');
      
      const result3 = parseCommand('@l approve');
      expect(result3.isMention).toBe(true);
      expect(result3.command).toBe('approve');
    });

    it('should NOT trigger @l parsing when not at beginning of message', () => {
      // These should NOT trigger parsing (not at beginning)
      const result1 = parseCommand('Some text @l plan');
      expect(result1.isMention).toBe(false);
      expect(result1.command).toBe('');
      
      const result2 = parseCommand('I think @l should help with this');
      expect(result2.isMention).toBe(false);
      expect(result2.command).toBe('');
      
      const result3 = parseCommand('Please @l approve this');
      expect(result3.isMention).toBe(false);
      expect(result3.command).toBe('');
      
      const result4 = parseCommand('Can someone @l dev fix this?');
      expect(result4.isMention).toBe(false);
      expect(result4.command).toBe('');
      
      const result5 = parseCommand('This is a comment with @l mentioned');
      expect(result5.isMention).toBe(false);
      expect(result5.command).toBe('');
    });

    it('should still work normally for @uwularpy anywhere in message', () => {
      // @uwularpy should work anywhere (existing behavior should remain)
      const result1 = parseCommand('Some text @uwularpy plan');
      expect(result1.isMention).toBe(true);
      expect(result1.command).toBe('plan');
      
      const result2 = parseCommand('Please @uwularpy help with this');
      expect(result2.isMention).toBe(true);
      expect(result2.command).toBe('help with this');
    });
  });
});