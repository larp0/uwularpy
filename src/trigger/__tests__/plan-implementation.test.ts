import { ISSUE_LABELS, ISSUE_PRIORITIES } from '../plan-implementation';

describe('Plan Implementation Constants', () => {
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
  });
});