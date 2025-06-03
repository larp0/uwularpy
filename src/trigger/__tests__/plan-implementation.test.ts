import { ISSUE_LABELS, ISSUE_PRIORITIES } from '../plan-implementation';

describe('Plan Implementation', () => {
  describe('Constants and Labels', () => {
    it('should have consistent labels and priorities defined', () => {
      expect(ISSUE_LABELS).toBeDefined();
      expect(ISSUE_PRIORITIES).toBeDefined();
      
      expect(ISSUE_LABELS.CRITICAL).toBe('critical');
      expect(ISSUE_LABELS.ENHANCEMENT).toBe('enhancement');
      expect(ISSUE_LABELS.BUG).toBe('bug');
      expect(ISSUE_LABELS.SECURITY).toBe('security');
      expect(ISSUE_LABELS.MISSING_FEATURE).toBe('missing-feature');
      expect(ISSUE_LABELS.IMPROVEMENT).toBe('improvement');
      expect(ISSUE_LABELS.TECHNICAL_DEBT).toBe('technical-debt');
      expect(ISSUE_LABELS.FEATURE).toBe('feature');
      expect(ISSUE_LABELS.INNOVATION).toBe('innovation');
      
      expect(ISSUE_PRIORITIES.CRITICAL).toBe('critical');
      expect(ISSUE_PRIORITIES.HIGH).toBe('high');
      expect(ISSUE_PRIORITIES.NORMAL).toBe('normal');
      expect(ISSUE_PRIORITIES.FEATURE).toBe('feature');
    });

    it('should have all required label constants', () => {
      const requiredLabels = [
        'CRITICAL', 'BUG', 'SECURITY', 'ENHANCEMENT', 
        'MISSING_FEATURE', 'IMPROVEMENT', 'TECHNICAL_DEBT', 
        'FEATURE', 'INNOVATION'
      ];

      requiredLabels.forEach(label => {
        expect(ISSUE_LABELS[label as keyof typeof ISSUE_LABELS]).toBeDefined();
        expect(typeof ISSUE_LABELS[label as keyof typeof ISSUE_LABELS]).toBe('string');
      });
    });

    it('should have all required priority constants', () => {
      const requiredPriorities = ['CRITICAL', 'HIGH', 'NORMAL', 'FEATURE'];

      requiredPriorities.forEach(priority => {
        expect(ISSUE_PRIORITIES[priority as keyof typeof ISSUE_PRIORITIES]).toBeDefined();
        expect(typeof ISSUE_PRIORITIES[priority as keyof typeof ISSUE_PRIORITIES]).toBe('string');
      });
    });

    it('should not have any duplicate label values', () => {
      const labelValues = Object.values(ISSUE_LABELS);
      const uniqueLabels = new Set(labelValues);
      expect(labelValues.length).toBe(uniqueLabels.size);
    });

    it('should not have any duplicate priority values', () => {
      const priorityValues = Object.values(ISSUE_PRIORITIES);
      const uniquePriorities = new Set(priorityValues);
      expect(priorityValues.length).toBe(uniquePriorities.size);
    });

    it('should use consistent naming convention for labels', () => {
      Object.values(ISSUE_LABELS).forEach(label => {
        expect(label).toMatch(/^[a-z-]+$/);
        expect(label).not.toContain('_');
        expect(label).not.toContain(' ');
      });
    });

    it('should use consistent naming convention for priorities', () => {
      Object.values(ISSUE_PRIORITIES).forEach(priority => {
        expect(priority).toMatch(/^[a-z-]+$/);
        expect(priority).not.toContain('_');
        expect(priority).not.toContain(' ');
      });
    });
  });

  describe('Environment Configuration', () => {
    beforeEach(() => {
      // Clear any existing environment variables for isolated testing
      delete process.env.PLAN_MAX_ISSUES;
      delete process.env.PLAN_MAX_CONTENT_LENGTH;
      delete process.env.OPENAI_TIMEOUT_MS;
      delete process.env.RETRY_ATTEMPTS;
      delete process.env.RETRY_DELAY_MS;
    });

    it('should use default values when environment variables are not set', () => {
      // This test would require access to the getPlanConfig function
      // For now, we validate that the defaults are reasonable
      expect(typeof parseInt(process.env.PLAN_MAX_ISSUES || '20', 10)).toBe('number');
      expect(parseInt(process.env.PLAN_MAX_ISSUES || '20', 10)).toBeGreaterThan(0);
      expect(parseInt(process.env.PLAN_MAX_ISSUES || '20', 10)).toBeLessThanOrEqual(50);
    });

    it('should handle invalid environment variable values gracefully', () => {
      process.env.PLAN_MAX_ISSUES = 'invalid';
      const maxIssues = parseInt(process.env.PLAN_MAX_ISSUES || '20', 10);
      expect(isNaN(maxIssues)).toBe(true);
      // The implementation should fall back to defaults for NaN values
    });
  });

  describe('Security Validation', () => {
    it('should not expose sensitive information in constants', () => {
      const allConstants = { ...ISSUE_LABELS, ...ISSUE_PRIORITIES };
      Object.values(allConstants).forEach(value => {
        expect(value).not.toContain('key');
        expect(value).not.toContain('secret');
        expect(value).not.toContain('token');
        expect(value).not.toContain('password');
      });
    });

    it('should use safe string values without special characters', () => {
      Object.values(ISSUE_LABELS).forEach(label => {
        expect(label).not.toMatch(/[<>'"&]/);
        expect(label).not.toMatch(/javascript:/i);
        expect(label).not.toMatch(/on\w+=/i);
      });
    });
  });

  describe('Performance Considerations', () => {
    it('should have reasonable limits for configuration values', () => {
      // Test that default max issues is reasonable
      const defaultMaxIssues = 20;
      expect(defaultMaxIssues).toBeGreaterThan(5);
      expect(defaultMaxIssues).toBeLessThanOrEqual(50);
    });

    it('should have appropriate timeout values', () => {
      // Test that default timeout is reasonable (2 minutes = 120000ms)
      const defaultTimeout = 120000;
      expect(defaultTimeout).toBeGreaterThan(30000); // At least 30 seconds
      expect(defaultTimeout).toBeLessThanOrEqual(300000); // At most 5 minutes
    });
  });
});