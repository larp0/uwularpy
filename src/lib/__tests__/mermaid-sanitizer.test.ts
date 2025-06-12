import { sanitizeMermaidDiagram, sanitizeNodeLabel, sanitizeMermaidDiagramsInResponse } from '../ai-sanitizer';

describe('Mermaid Diagram Sanitizer', () => {
  
  describe('sanitizeNodeLabel', () => {
    it('should remove problematic symbols from labels', () => {
      expect(sanitizeNodeLabel('Node (alpha)')).toBe('Node alpha');
      expect(sanitizeNodeLabel('Beta: "Hello"')).toBe('Beta Hello');
      expect(sanitizeNodeLabel('Gamma, with symbols!')).toBe('Gamma with symbols');
      expect(sanitizeNodeLabel('Test[brackets]')).toBe('Testbrackets');
      expect(sanitizeNodeLabel('Test{braces}')).toBe('Testbraces');
    });

    it('should handle quotes and special characters', () => {
      expect(sanitizeNodeLabel('"Quoted text"')).toBe('Quoted text');
      expect(sanitizeNodeLabel("'Single quotes'")).toBe('Single quotes');
      expect(sanitizeNodeLabel('`Backticks`')).toBe('Backticks');
      expect(sanitizeNodeLabel('Text with; semicolon: colon, comma')).toBe('Text with semicolon colon comma');
    });

    it('should handle symbols that break Mermaid syntax', () => {
      expect(sanitizeNodeLabel('Pipe | symbol')).toBe('Pipe symbol');
      expect(sanitizeNodeLabel('Slash / backslash \\')).toBe('Slash backslash');
      expect(sanitizeNodeLabel('Symbols <>&$#@!%^*+=~?')).toBe('Symbols');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeNodeLabel('Multiple    spaces   here')).toBe('Multiple spaces here');
      expect(sanitizeNodeLabel('  Leading and trailing  ')).toBe('Leading and trailing');
      expect(sanitizeNodeLabel('\t\nTabs and\nnewlines\t')).toBe('Tabs and newlines');
    });

    it('should handle empty or invalid input', () => {
      expect(sanitizeNodeLabel('')).toBe('node');
      expect(sanitizeNodeLabel('   ')).toBe('node');
      expect(sanitizeNodeLabel(null as any)).toBe('');
      expect(sanitizeNodeLabel(undefined as any)).toBe('');
      expect(sanitizeNodeLabel(123 as any)).toBe('');
    });

    it('should handle labels that start with numbers', () => {
      expect(sanitizeNodeLabel('123 Start with number')).toBe('n123 Start with number');
      expect(sanitizeNodeLabel('9Test')).toBe('n9Test');
    });

    it('should provide fallback for completely invalid labels', () => {
      expect(sanitizeNodeLabel('()[]{}:;,|\\/<>&$#@!%^*+=~?')).toBe('node');
      expect(sanitizeNodeLabel('   ()[]{}   ')).toBe('node');
    });
  });

  describe('sanitizeMermaidDiagram', () => {
    it('should sanitize the example from the comment', () => {
      const input = `flowchart TD
  alpha("Node (alpha)") --> beta["Beta: \"Hello\""]
  beta --> gamma('Gamma, with symbols!');`;

      const expected = `flowchart TD
  alpha["Node alpha"] --> beta["Beta Hello"]
  beta --> gamma["Gamma with symbols"];`;

      expect(sanitizeMermaidDiagram(input)).toBe(expected);
    });

    it('should preserve flowchart structure and arrows', () => {
      const input = `flowchart TD
  A["Start (node)"] --> B{"Decision: Yes/No?"}
  B --> C["End; Success!"]
  B --> D["Failure: 'Error'"]`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('flowchart TD');
      expect(result).toContain('-->');
      expect(result).toContain('A["Start node"]');
      expect(result).toContain('B["Decision YesNo"]');
      expect(result).toContain('C["End Success"]');
      expect(result).toContain('D["Failure Error"]');
    });

    it('should handle different node shape syntaxes', () => {
      const input = `flowchart TD
  A["Square (brackets)"]
  B("Round (parentheses)")
  C{"Diamond: {braces}"}
  D{{"Double braces: 'test'"}}`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('A["Square brackets"]');
      expect(result).toContain('B["Round parentheses"]');
      expect(result).toContain('C["Diamond braces"]');
      expect(result).toContain('D["Double braces test"]');
    });

    it('should preserve diagram type declarations', () => {
      const diagrams = [
        'flowchart TD',
        'graph LR',
        'sequenceDiagram',
        'classDiagram',
        'stateDiagram-v2',
        'erDiagram',
        'gantt',
        'pie title Test',
        'mindmap',
        'gitGraph',
        'journey',
        'C4Context'
      ];

      diagrams.forEach(diagramType => {
        const input = `${diagramType}\n  A["Test (node)"]`;
        const result = sanitizeMermaidDiagram(input);
        expect(result).toContain(diagramType);
        expect(result).toContain('A["Test node"]');
      });
    });

    it('should preserve comments and style definitions', () => {
      const input = `flowchart TD
  %% This is a comment
  A["Node (with) symbols"] --> B
  class A className
  style A fill:#f9f,stroke:#333,stroke-width:4px
  click A "http://example.com"`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('%% This is a comment');
      expect(result).toContain('class A className');
      expect(result).toContain('style A fill:#f9f,stroke:#333,stroke-width:4px');
      expect(result).toContain('click A "http://example.com"');
      expect(result).toContain('A["Node with symbols"]');
    });

    it('should handle complex flowcharts with multiple connections', () => {
      const input = `flowchart TD
  Start["Start: (Process)"] --> Decision{"Check: Status?"}
  Decision -->|"Yes: 'Success'"| Success["Complete: 'Done!'"]
  Decision -->|"No: 'Failed'"| Retry["Retry: {Again}"]
  Retry --> Decision
  Success --> End["End: (Finished)"]`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('Start["Start Process"]');
      expect(result).toContain('Decision["Check Status"]');
      expect(result).toContain('Success["Complete Done"]');
      expect(result).toContain('Retry["Retry Again"]');
      expect(result).toContain('End["End Finished"]');
      // Arrows should be preserved
      expect(result).toContain('-->');
      expect(result).toContain('|"Yes: \'Success\'"|'); // Edge labels should be preserved
    });

    it('should handle sequence diagrams', () => {
      const input = `sequenceDiagram
  participant A as "User: (Client)"
  participant B as "Server: 'API'"
  A->>B: "Request: {data}"
  B-->>A: "Response: [result]"`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('sequenceDiagram');
      expect(result).toContain('participant A as "User Client"');
      expect(result).toContain('participant B as "Server API"');
    });

    it('should handle empty lines and whitespace', () => {
      const input = `flowchart TD

  A["Node (1)"]

  B["Node (2)"]
  
  A --> B`;

      const result = sanitizeMermaidDiagram(input);
      
      // Should preserve empty lines
      expect(result.split('\n')).toHaveLength(7);
      expect(result).toContain('A["Node 1"]');
      expect(result).toContain('B["Node 2"]');
    });

    it('should handle invalid input gracefully', () => {
      expect(sanitizeMermaidDiagram('')).toBe('');
      expect(sanitizeMermaidDiagram(null as any)).toBe('');
      expect(sanitizeMermaidDiagram(undefined as any)).toBe('');
      expect(sanitizeMermaidDiagram(123 as any)).toBe('');
    });

    it('should handle edge cases with special node patterns', () => {
      const input = `flowchart TD
  A[""]
  B["   "]
  C["123Start"]
  D["()[]{}"]
  E["Multiple    spaces   here"]`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('A["node"]'); // Empty label gets fallback
      expect(result).toContain('B["node"]'); // Whitespace only gets fallback
      expect(result).toContain('C["n123Start"]'); // Number prefix handled
      expect(result).toContain('D["node"]'); // Fallback for invalid content
      expect(result).toContain('E["Multiple spaces here"]'); // Normalized whitespace
    });

    it('should handle unicode and special characters', () => {
      const input = `flowchart TD
  A["Unicode: 🚀 (rocket)"]
  B["Accents: café, naïve"]
  C["Math: α + β = γ"]`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('A["Unicode 🚀 rocket"]');
      expect(result).toContain('B["Accents café naïve"]');
      expect(result).toContain('C["Math α β γ"]'); // + symbols removed
    });

    it('should handle nested quotes and complex escaping', () => {
      const input = `flowchart TD
  A["Text with 'nested' \\"quotes\\" and \`backticks\`"]
  B['Single "quoted" text with (parens)']
  C{"Mixed: 'test' with [brackets]"}`;

      const result = sanitizeMermaidDiagram(input);
      
      expect(result).toContain('A["Text with nested quotes and backticks"]');
      expect(result).toContain('B["Single quoted text with parens"]');
      expect(result).toContain('C["Mixed test with brackets"]');
    });
  });

  describe('sanitizeMermaidDiagramsInResponse', () => {
    it('should sanitize Mermaid diagrams within response text', () => {
      const input = `Here is my analysis:

\`\`\`mermaid
flowchart TD
  A("Start: (Process)") --> B["Middle: 'Step'"]
  B --> C{"Decision: (Yes/No)"}
\`\`\`

And here's another diagram:

\`\`\`mermaid
graph LR
  X["Input: {data}"] --> Y["Output: (result)"]
\`\`\`

End of analysis.`;

      const result = sanitizeMermaidDiagramsInResponse(input);
      
      // Should preserve the structure but sanitize diagram content
      expect(result).toContain('Here is my analysis:');
      expect(result).toContain('```mermaid');
      expect(result).toContain('End of analysis.');
      
      // Should have sanitized diagram content
      expect(result).toContain('A["Start Process"]');
      expect(result).toContain('B["Middle Step"]');
      expect(result).toContain('C["Decision YesNo"]'); // Slash is removed by sanitization
      expect(result).toContain('X["Input data"]');
      expect(result).toContain('Y["Output result"]');
      
      // Should preserve arrows and structure
      expect(result).toContain('-->');
      expect(result).toContain('flowchart TD');
      expect(result).toContain('graph LR');
    });

    it('should handle response with no Mermaid diagrams', () => {
      const input = `This is a regular response without any Mermaid diagrams.
      
It has multiple lines but no code blocks.`;

      const result = sanitizeMermaidDiagramsInResponse(input);
      
      expect(result).toBe(input); // Should be unchanged
    });

    it('should handle multiple Mermaid diagrams in one response', () => {
      const input = `First diagram:
\`\`\`mermaid
flowchart TD
  A("Bad: (Node)") --> B
\`\`\`

Second diagram:
\`\`\`mermaid
sequenceDiagram
  participant X as "User: (Client)"
  X->>Y: "Message: {data}"
\`\`\`

Third diagram:
\`\`\`mermaid
graph LR
  Z["Test: 'Value'"] --> W
\`\`\``;

      const result = sanitizeMermaidDiagramsInResponse(input);
      
      // All diagrams should be sanitized
      expect(result).toContain('A["Bad Node"]');
      expect(result).toContain('participant X as "User Client"');
      expect(result).toContain('Z["Test Value"]');
      
      // Structure should be preserved
      expect(result).toContain('First diagram:');
      expect(result).toContain('Second diagram:');
      expect(result).toContain('Third diagram:');
    });

    it('should handle invalid input gracefully', () => {
      expect(sanitizeMermaidDiagramsInResponse('')).toBe('');
      expect(sanitizeMermaidDiagramsInResponse(null as any)).toBe('');
      expect(sanitizeMermaidDiagramsInResponse(undefined as any)).toBe('');
    });

    it('should handle malformed Mermaid blocks', () => {
      const input = `\`\`\`mermaid
This is not a valid mermaid diagram
with bad syntax: (test)
\`\`\``;

      const result = sanitizeMermaidDiagramsInResponse(input);
      
      // Should still process it through sanitization even if malformed
      expect(result).toContain('```mermaid');
      // The content is passed through sanitization but since it doesn't match node patterns,
      // it may remain largely unchanged. The sanitizer primarily targets node definitions.
      expect(result).toContain('This is not a valid mermaid diagram');
    });
  });
});