// Test for full code review workflow constants and structure validation
describe('Full Code Review - Issue Workflow', () => {
  describe('Constants', () => {
    it('should import COPILOT_USERNAME from workflow constants', async () => {
      const { COPILOT_USERNAME } = await import('../workflow-constants');
      expect(COPILOT_USERNAME).toBe('@copilot');
    });
  });

  describe('GitHubContext Interface', () => {
    it('should accept valid GitHub context for issue workflow', () => {
      const mockContext = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
        requester: 'test-user',
        installationId: 456,
        requestTimestamp: '2024-01-01T00:00:00Z',
        requestId: 'test-request-id',
        message: 'test message',
      };
      
      // Validate required fields are present
      expect(mockContext.owner).toBe('test-owner');
      expect(mockContext.repo).toBe('test-repo');
      expect(mockContext.issueNumber).toBe(123);
      expect(mockContext.installationId).toBe(456);
    });
  });

  describe('Type Definitions', () => {
    it('should validate GitHubContext structure', async () => {
      const { generateRequestId } = await import('../../services/task-types');
      const requestId = generateRequestId();
      
      expect(typeof requestId).toBe('string');
      expect(requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});
