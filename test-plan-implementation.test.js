// test-plan-implementation.test.js
// Proper Jest test for plan implementation with structured assertions

const path = require('path');
const fs = require('fs');

describe('Plan Implementation', () => {
  const planFilePath = path.join(__dirname, 'src', 'trigger', 'plan-implementation.ts');
  const registryPath = path.join(__dirname, 'src', 'trigger', 'task-registry.ts');
  const indexPath = path.join(__dirname, 'src', 'trigger', 'index.ts');
  const webhookPath = path.join(__dirname, 'src', 'app', 'api', 'webhook', 'route.ts');

  describe('File Structure', () => {
    test('plan implementation file should exist', () => {
      expect(fs.existsSync(planFilePath)).toBe(true);
    });

    test('task registry file should exist', () => {
      expect(fs.existsSync(registryPath)).toBe(true);
    });

    test('trigger index file should exist', () => {
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    test('webhook route file should exist', () => {
      expect(fs.existsSync(webhookPath)).toBe(true);
    });
  });

  describe('Plan Implementation Structure', () => {
    let planContent;

    beforeAll(() => {
      planContent = fs.readFileSync(planFilePath, 'utf8');
    });

    test('should export runPlanTask function', () => {
      expect(planContent).toContain('export async function runPlanTask');
    });

    test('should have required interfaces', () => {
      expect(planContent).toContain('interface PlanAnalysis');
      expect(planContent).toContain('interface IssueTemplate');
    });

    test('should include all required phases', () => {
      const requiredPhases = [
        'ingestRepository',
        'performComprehensiveAnalysis',
        'createProjectMilestone',
        'generateIssuesFromAnalysis',
        'createGitHubIssues'
      ];

      requiredPhases.forEach(phase => {
        expect(planContent).toContain(phase);
      });
    });

    test('should have required analysis categories', () => {
      const requiredCategories = [
        'missingComponents',
        'criticalFixes',
        'requiredImprovements',
        'innovationIdeas'
      ];

      requiredCategories.forEach(category => {
        expect(planContent).toContain(category);
      });
    });

    test('should use OpenAI API integration', () => {
      expect(planContent).toContain('openai.com/v1/chat/completions');
    });

    test('should have GitHub API integration', () => {
      expect(planContent).toContain('createMilestone');
      expect(planContent).toContain('issues.create');
    });

    test('should use consistent logging levels', () => {
      expect(planContent).toContain('logger.info');
      expect(planContent).toContain('logger.warn');
      expect(planContent).toContain('logger.error');
    });

    test('should define constants for labels and priorities', () => {
      expect(planContent).toContain('ISSUE_LABELS');
      expect(planContent).toContain('ISSUE_PRIORITIES');
    });

    test('should import and use templates', () => {
      expect(planContent).toContain('CRITICAL_ISSUE_TEMPLATE');
      expect(planContent).toContain('MISSING_COMPONENT_TEMPLATE');
      expect(planContent).toContain('IMPROVEMENT_TEMPLATE');
      expect(planContent).toContain('FEATURE_TEMPLATE');
    });
  });

  describe('Task Registry Integration', () => {
    let registryContent;

    beforeAll(() => {
      registryContent = fs.readFileSync(registryPath, 'utf8');
    });

    test('should export planTask', () => {
      expect(registryContent).toContain('export const planTask');
    });

    test('should have plan-task ID', () => {
      expect(registryContent).toContain('plan-task');
    });

    test('should import plan-implementation', () => {
      expect(registryContent).toContain('plan-implementation');
    });
  });

  describe('Trigger Index Exports', () => {
    let indexContent;

    beforeAll(() => {
      indexContent = fs.readFileSync(indexPath, 'utf8');
    });

    test('should export planTask', () => {
      expect(indexContent).toContain('planTask');
    });
  });

  describe('Webhook Handler Integration', () => {
    let webhookContent;

    beforeAll(() => {
      webhookContent = fs.readFileSync(webhookPath, 'utf8');
    });

    test('should handle plan trigger', () => {
      // The plan trigger is now handled in the command parser
      const commandParserPath = path.join(__dirname, 'src', 'lib', 'command-parser.ts');
      const commandParserContent = fs.readFileSync(commandParserPath, 'utf8');
      expect(commandParserContent).toContain("'plan'");
    });

    test('should trigger plan-task', () => {
      // The plan-task is now handled in the command parser
      const commandParserPath = path.join(__dirname, 'src', 'lib', 'command-parser.ts');
      const commandParserContent = fs.readFileSync(commandParserPath, 'utf8');
      expect(commandParserContent).toContain('plan-task');
    });

    test('should use command parser utility', () => {
      expect(webhookContent).toContain('parseCommand');
      expect(webhookContent).toContain('getTaskType');
    });
  });

  describe('Command Parser Utility', () => {
    const commandParserPath = path.join(__dirname, 'src', 'lib', 'command-parser.ts');

    test('command parser file should exist', () => {
      expect(fs.existsSync(commandParserPath)).toBe(true);
    });

    test('should export required functions', () => {
      const content = fs.readFileSync(commandParserPath, 'utf8');
      expect(content).toContain('export function parseCommand');
      expect(content).toContain('export function getTaskType');
    });
  });

  describe('Issue Templates', () => {
    const templatesPath = path.join(__dirname, 'src', 'templates', 'issue-templates.ts');

    test('issue templates file should exist', () => {
      expect(fs.existsSync(templatesPath)).toBe(true);
    });

    test('should export all required templates', () => {
      const content = fs.readFileSync(templatesPath, 'utf8');
      const requiredTemplates = [
        'CRITICAL_ISSUE_TEMPLATE',
        'MISSING_COMPONENT_TEMPLATE',
        'IMPROVEMENT_TEMPLATE',
        'FEATURE_TEMPLATE',
        'MILESTONE_DESCRIPTION_TEMPLATE',
        'COMPLETION_COMMENT_TEMPLATE',
        'INITIAL_REPLY_TEMPLATE'
      ];

      requiredTemplates.forEach(template => {
        expect(content).toContain(template);
      });
    });
  });

  describe('Code Quality', () => {
    test('should not have obvious code duplication in plan implementation', () => {
      const planContent = fs.readFileSync(planFilePath, 'utf8');
      
      // Check that templates are being used instead of inline strings
      expect(planContent).not.toContain('## 🚨 Critical Fix Required');
      expect(planContent).not.toContain('## 📋 Missing Component');
      expect(planContent).not.toContain('## 🔧 Code Improvement');
      expect(planContent).not.toContain('## 💡 Innovation Feature');
    });

    test('should use constants instead of magic strings for labels', () => {
      const planContent = fs.readFileSync(planFilePath, 'utf8');
      
      // Should use constants
      expect(planContent).toContain('ISSUE_LABELS.CRITICAL');
      expect(planContent).toContain('ISSUE_PRIORITIES.CRITICAL');
      
      // Should not use magic strings in function calls (allow 2 for constants definitions)
      const criticalMatches = (planContent.match(/'critical'/g) || []).length;
      expect(criticalMatches).toBeLessThanOrEqual(2); // Only in constants definitions
    });
  });
});