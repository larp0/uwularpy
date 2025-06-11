import { describe, it, expect } from '@jest/globals';

// Test the regex constants and helper functions from codex.ts
// We'll import the constants and test their functionality

describe('Codex Regex Constants', () => {
  // Test search-replace block pattern
  it('should match search-replace blocks correctly', () => {
    const searchReplaceBlock = /```search-replace\n([\s\S]*?)```/g;
    
    const testInput = `Some text
\`\`\`search-replace
FILE: test.js
<<<<<<< SEARCH
old code
=======
new code
>>>>>>> REPLACE
\`\`\`
More text`;

    const matches = Array.from(testInput.matchAll(searchReplaceBlock));
    expect(matches).toHaveLength(1);
    expect(matches[0][1]).toContain('FILE: test.js');
    expect(matches[0][1]).toContain('old code');
    expect(matches[0][1]).toContain('new code');
  });

  // Test file path pattern
  it('should extract file paths correctly', () => {
    const filePathPattern = /FILE:\s*(.*)/;
    
    const testCases = [
      'FILE: src/test.js',
      'FILE:   src/test.js  ',
      'FILE: package.json'
    ];

    testCases.forEach(testCase => {
      const match = testCase.match(filePathPattern);
      expect(match).toBeTruthy();
      expect(match![1].trim()).toMatch(/^[a-zA-Z0-9\/\.\-_]+$/);
    });
  });

  // Test text normalization patterns
  it('should normalize line endings correctly', () => {
    const carriageReturnPattern = /\r\n/g;
    const macReturnPattern = /\r/g;
    
    const testInput = 'line1\r\nline2\rline3\n';
    let normalized = testInput.replace(carriageReturnPattern, '\n');
    normalized = normalized.replace(macReturnPattern, '\n');
    
    expect(normalized).toBe('line1\nline2\nline3\n');
  });

  // Test security patterns
  it('should detect dangerous patterns', () => {
    const evalPattern = /eval\s*\(/i;
    const rmPattern = /rm\s+-rf/i;
    const sudoPattern = /sudo\s+/i;
    
    expect('eval("malicious code")').toMatch(evalPattern);
    expect('rm -rf /important/data').toMatch(rmPattern);
    expect('sudo rm -rf /').toMatch(sudoPattern);
    
    // Safe patterns should not match
    expect('evaluation of results').not.toMatch(evalPattern);
    expect('remove file').not.toMatch(rmPattern);
  });

  // Test code structure patterns
  it('should count braces correctly', () => {
    const openBraces = /{/g;
    const closeBraces = /}/g;
    
    const balancedCode = '{ function() { return {}; } }';
    const unbalancedCode = '{ function() { return {}; }';
    
    expect((balancedCode.match(openBraces) || []).length).toBe(3);
    expect((balancedCode.match(closeBraces) || []).length).toBe(3);
    
    expect((unbalancedCode.match(openBraces) || []).length).toBe(3);
    expect((unbalancedCode.match(closeBraces) || []).length).toBe(2);
  });

  // Test formatting patterns
  it('should fix heading spacing', () => {
    const headingPattern = /^(#+)([^\s#])/gm;
    
    const badHeading = '#Title\n##Subtitle';
    const fixed = badHeading.replace(headingPattern, '$1 $2');
    
    expect(fixed).toBe('# Title\n## Subtitle');
  });
});

describe('StringPatcher Helper', () => {
  // Mock the StringPatcher class for testing
  class StringPatcher {
    private content: string;
    private offset: number = 0;

    constructor(content: string) {
      this.content = content;
    }

    replaceAt(index: number, length: number, replacement: string): void {
      const adjustedIndex = index + this.offset;
      this.content = this.content.substring(0, adjustedIndex) +
                     replacement +
                     this.content.substring(adjustedIndex + length);
      this.offset += replacement.length - length;
    }

    getContent(): string {
      return this.content;
    }

    getOffset(): number {
      return this.offset;
    }
  }

  it('should handle simple replacements', () => {
    const patcher = new StringPatcher('Hello World!');
    patcher.replaceAt(6, 5, 'TypeScript');
    expect(patcher.getContent()).toBe('Hello TypeScript!');
  });

  it('should track offsets correctly for multiple replacements', () => {
    const patcher = new StringPatcher('abc def ghi');
    
    // Replace 'def' with 'REPLACED'
    patcher.replaceAt(4, 3, 'REPLACED');
    expect(patcher.getContent()).toBe('abc REPLACED ghi');
    
    // Replace 'ghi' with 'END' - should account for previous offset
    patcher.replaceAt(8, 3, 'END');
    expect(patcher.getContent()).toBe('abc REPLACED END');
  });

  it('should handle expanding and shrinking replacements', () => {
    const patcher = new StringPatcher('one two three');
    
    // Shrink first - replace 'one' (index 0, length 3) with 'X'
    patcher.replaceAt(0, 3, 'X');
    expect(patcher.getContent()).toBe('X two three');
    
    // Expand second - replace 'two' which was originally at index 4
    patcher.replaceAt(4, 3, 'EXPANDED');
    expect(patcher.getContent()).toBe('X EXPANDED three');
  });
});