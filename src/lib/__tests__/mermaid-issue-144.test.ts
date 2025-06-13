import { sanitizeNodeLabel, sanitizeMermaidDiagram } from '../ai-sanitizer';

describe('Mermaid Sanitizer - Issue #144 Requirements', () => {
  describe('sanitizeNodeLabel - only letters allowed', () => {
    it('should remove ALL non-letter characters as per issue requirement', () => {
      // Test the specific requirement: "remove any special symbols inside graph node name, ANY
      // LEAVE ONLY LETTERS SURROUNDED WITH BRACKETS THATS ALL NOTHING ELSE ALLOWED"
      
      // Remove numbers
      expect(sanitizeNodeLabel('Test123Node')).toBe('TestNode');
      expect(sanitizeNodeLabel('123OnlyLetters456')).toBe('OnlyLetters');
      
      // Remove spaces
      expect(sanitizeNodeLabel('Hello World')).toBe('HelloWorld');
      expect(sanitizeNodeLabel('   Multiple   Spaces   ')).toBe('MultipleSpaces');
      
      // Remove ALL special symbols
      expect(sanitizeNodeLabel('Test!@#$%^&*()Node')).toBe('TestNode');
      expect(sanitizeNodeLabel('Node-with_symbols')).toBe('Nodewithsymbols');
      expect(sanitizeNodeLabel('Brackets[brackets]')).toBe('Bracketsbrackets');
      expect(sanitizeNodeLabel('Braces{braces}')).toBe('Bracesbraces');
      expect(sanitizeNodeLabel('Quotes"quotes"')).toBe('Quotesquotes');
      expect(sanitizeNodeLabel('Pipes|pipes')).toBe('Pipespipes');
      expect(sanitizeNodeLabel('Slashes/slashes\\')).toBe('Slashesslashes');
      
      // Keep only letters (including accented and Greek)
      expect(sanitizeNodeLabel('OnlyLettersABC')).toBe('OnlyLettersABC');
      expect(sanitizeNodeLabel('café')).toBe('café');
      expect(sanitizeNodeLabel('αβγ')).toBe('αβγ');
      
      // Mixed content
      expect(sanitizeNodeLabel('Mix3d C0nt3nt W1th Numb3rs!')).toBe('MixdCntntWthNumbrs');
    });

    it('should handle edge cases correctly', () => {
      // Empty or all-invalid input gets fallback
      expect(sanitizeNodeLabel('123456')).toBe('node');
      expect(sanitizeNodeLabel('!@#$%^')).toBe('node');
      expect(sanitizeNodeLabel('   ')).toBe('node');
      expect(sanitizeNodeLabel('')).toBe('node');
      
      // Single letter should be preserved
      expect(sanitizeNodeLabel('A')).toBe('A');
      expect(sanitizeNodeLabel('z')).toBe('z');
      
      // Unicode letters preserved
      expect(sanitizeNodeLabel('α')).toBe('α');
      expect(sanitizeNodeLabel('é')).toBe('é');
    });
  });

  describe('sanitizeMermaidDiagram - complete flow with stricter sanitization', () => {
    it('should produce cleaner node labels in real diagrams', () => {
      const input = `flowchart TD
  A["User Input: 123 (validation)"] --> B{"Check Status: OK/FAIL?"}
  B -->|"Success: ✓"| C["Process Data: {important}"]
  B -->|"Error: ✗"| D["Show Error: 404 Not Found!"]`;

      const result = sanitizeMermaidDiagram(input);
      
      // All node labels should have only letters now
      expect(result).toContain('A["UserInputvalidation"]');
      expect(result).toContain('B["CheckStatusOKFAIL"]');
      expect(result).toContain('C["ProcessDataimportant"]');
      expect(result).toContain('D["ShowErrorNotFound"]');
      
      // Structure preserved
      expect(result).toContain('flowchart TD');
      expect(result).toContain('-->');
      expect(result).toContain('|"Success: ✓"|');
      expect(result).toContain('|"Error: ✗"|');
    });

    it('should handle real-world complex examples', () => {
      const input = `graph LR
  Start["🚀 App Start (v1.2.3)"] --> Auth{"Authentication Check: Valid?"}
  Auth -->|"✓ Valid User"| Dashboard["📊 User Dashboard: Welcome!"]
  Auth -->|"✗ Invalid"| Login["🔐 Login Form: Enter Credentials"]
  Dashboard --> Settings["⚙️ Settings Page: Configure Options"]`;

      const result = sanitizeMermaidDiagram(input);
      
      // Verify extreme sanitization - only letters remain
      expect(result).toContain('Start["AppStartv"]');
      expect(result).toContain('Auth["AuthenticationCheckValid"]');
      expect(result).toContain('Dashboard["UserDashboardWelcome"]');
      expect(result).toContain('Login["LoginFormEnterCredentials"]');
      expect(result).toContain('Settings["SettingsPageConfigureOptions"]');
      
      // Arrows and edge labels preserved
      expect(result).toContain('graph LR');
      expect(result).toContain('-->');
      expect(result).toContain('|"✓ Valid User"|');
      expect(result).toContain('|"✗ Invalid"|');
    });
  });
});