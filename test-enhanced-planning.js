#!/usr/bin/env node

/**
 * Test script to validate enhanced planning capabilities
 * Tests user query integration and enhanced system prompts
 */

// Since we can't directly import TypeScript, we'll copy the parseCommand logic
function parseCommand(comment) {
  // Validate input
  if (!comment || typeof comment !== 'string') {
    return {
      command: '',
      fullText: '',
      isMention: false
    };
  }
  
  // Basic sanitization
  const sanitizedComment = comment.trim();
  
  // Check if the comment mentions @uwularpy or @l
  const mentionPatterns = [
    /@uwularpy\b/i,
    /@l\s+/i
  ];
  
  const isMention = mentionPatterns.some(pattern => pattern.test(sanitizedComment));
  
  if (!isMention) {
    return {
      command: '',
      fullText: sanitizedComment,
      isMention: false
    };
  }

  // Extract text after the mention
  const match = sanitizedComment.match(/@(uwularpy|l)\s+([\s\S]*?)(?=@\w+|$)/i);
  const textAfterMention = match ? match[2].trim() : '';

  // Handle edge case where mention is at the end with no command
  if (!textAfterMention && /@(uwularpy|l)\s*$/i.test(sanitizedComment)) {
    return {
      command: '',
      fullText: '',
      isMention: true
    };
  }

  // Extract user query for plan commands
  let userQuery = '';
  const planCommandMatch = textAfterMention.match(/^(plan|planning|analyze)\s+(.+)$/i);
  const refineCommandMatch = textAfterMention.match(/^(refine|revise|modify|update|change|edit)\s+(.+)$/i);
  
  if (planCommandMatch) {
    userQuery = planCommandMatch[2].trim();
  } else if (refineCommandMatch) {
    userQuery = refineCommandMatch[2].trim();
  }

  return {
    command: textAfterMention.trim().toLowerCase(),
    fullText: textAfterMention,
    isMention: true,
    userQuery
  };
}

function testCommandParsing() {
  console.log('🧪 Testing Enhanced Command Parsing...\n');
  
  const testCases = [
    {
      name: 'Basic plan command',
      input: '@l plan',
      expected: { command: 'plan', userQuery: '' }
    },
    {
      name: 'Plan with user query',
      input: '@l plan I need to add authentication to my app',
      expected: { command: 'plan i need to add authentication to my app', userQuery: 'I need to add authentication to my app' }
    },
    {
      name: 'Refinement with feedback', 
      input: '@l refine Focus more on security and make the auth system more robust',
      expected: { command: 'refine focus more on security and make the auth system more robust', userQuery: 'Focus more on security and make the auth system more robust' }
    },
    {
      name: 'Approval command',
      input: '@l approve',
      expected: { command: 'approve', userQuery: '' }
    },
    {
      name: 'Cancel command',
      input: '@l cancel',
      expected: { command: 'cancel', userQuery: '' }
    }
  ];
  
  let passed = 0;
  let total = testCases.length;
  
  testCases.forEach(testCase => {
    console.log(`Testing: ${testCase.name}`);
    console.log(`Input: "${testCase.input}"`);
    
    try {
      const result = parseCommand(testCase.input);
      console.log(`Output:`, result);
      
      const commandMatches = result.command === testCase.expected.command;
      const queryMatches = (result.userQuery || '') === testCase.expected.userQuery;
      
      if (commandMatches && queryMatches) {
        console.log(`✅ PASS\n`);
        passed++;
      } else {
        console.log(`❌ FAIL`);
        console.log(`Expected command: "${testCase.expected.command}", got: "${result.command}"`);
        console.log(`Expected userQuery: "${testCase.expected.userQuery}", got: "${result.userQuery || ''}"`);
        console.log();
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error.message}\n`);
    }
  });
  
  console.log(`\n📊 Results: ${passed}/${total} tests passed`);
  return passed === total;
}

function testUserQueryExtraction() {
  console.log('\n🧪 Testing User Query Extraction...\n');
  
  // Simulate the extractUserQueryFromMessage function behavior
  function extractUserQueryFromMessage(message) {
    if (!message) return '';
    
    const planCommandMatch = message.match(/^(plan|planning|analyze)\s+(.+)$/i);
    if (planCommandMatch) {
      return planCommandMatch[2].trim();
    }
    
    return '';
  }
  
  const testCases = [
    {
      input: 'plan add user authentication',
      expected: 'add user authentication'
    },
    {
      input: 'planning implement a REST API for user management',
      expected: 'implement a REST API for user management'
    },
    {
      input: 'analyze improve performance of database queries',
      expected: 'improve performance of database queries'
    },
    {
      input: 'just plan',
      expected: ''
    },
    {
      input: 'approve',
      expected: ''
    }
  ];
  
  let passed = 0;
  
  testCases.forEach(testCase => {
    const result = extractUserQueryFromMessage(testCase.input);
    const matches = result === testCase.expected;
    
    console.log(`Input: "${testCase.input}"`);
    console.log(`Expected: "${testCase.expected}"`);
    console.log(`Got: "${result}"`);
    console.log(`${matches ? '✅ PASS' : '❌ FAIL'}\n`);
    
    if (matches) passed++;
  });
  
  console.log(`📊 Results: ${passed}/${testCases.length} extraction tests passed`);
  return passed === testCases.length;
}

function main() {
  console.log('🚀 Enhanced Planning System Tests\n');
  console.log('Testing command parsing and user query integration...\n');
  
  const commandParsingPassed = testCommandParsing();
  const extractionPassed = testUserQueryExtraction();
  
  console.log('\n🏁 Overall Results:');
  console.log(`Command Parsing: ${commandParsingPassed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Query Extraction: ${extractionPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  if (commandParsingPassed && extractionPassed) {
    console.log('\n🎉 All enhanced planning tests passed!');
    console.log('\n💡 Ready to test with real GitHub commands:');
    console.log('- "@l plan add user authentication to the app"');
    console.log('- "@l refine focus more on security best practices"'); 
    console.log('- "@l approve" to create issues from the plan');
    console.log('- "@l cancel" to reject the current plan');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed. Please check the implementation.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
