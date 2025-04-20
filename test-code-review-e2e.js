#!/usr/bin/env node
// E2E test for full-code-review-implementation.ts

require('dotenv/config'); // Load environment variables from .env
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// Import TS modules
require('ts-node').register({
  transpileOnly: true
});

// Setup manual mocks for required modules
const originalOctokit = require('@octokit/rest');
const originalAuthApp = require('@octokit/auth-app');

// Store the original implementations
const originalOctokitImpl = originalOctokit.Octokit;
const originalAuthAppImpl = originalAuthApp.createAppAuth;

// Manual mock for Octokit
class MockOctokit {
  constructor() {
    this.pulls = {
      get: async () => ({
        data: {
          base: { sha: 'base-sha-1234' },
          head: { sha: 'head-sha-5678' }
        }
      })
    };
    this.repos = {
      compareCommits: async () => ({
        data: {
          html_url: 'https://github.com/example/repo/compare/base...head',
          files: [
            {
              filename: 'src/feature.js',
              patch: '@@ -1,5 +1,7 @@\n function feature() {\n-  return "old";\n+  // New implementation\n+  return "new";\n }\n',
              status: 'modified'
            }
          ]
        }
      }),
      getContent: async () => ({
        data: {
          content: Buffer.from('function feature() {\n  // New implementation\n  return "new";\n}\n').toString('base64'),
          size: 50
        }
      })
    };
    this.issues = {
      createComment: async (params) => {
        console.log('Mock comment created:', params.body.substring(0, 100) + '...');
        this.lastComment = params;
        return { data: { id: 12345 } };
      }
    };
  }
}

// Apply the mocks
originalOctokit.Octokit = MockOctokit;
originalAuthApp.createAppAuth = () => () => Promise.resolve({ token: 'mock-token' });

// Mock environment variables
const originalEnv = process.env;
process.env = { 
  ...process.env,
  GITHUB_APP_ID: '12345',
  GITHUB_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMOCK_KEY_CONTENT\n-----END PRIVATE KEY-----',
  OPENAI_API_KEY: 'sk-mock-openai-api-key'
};

// Setup a function to restore original implementations
function restoreMocks() {
  originalOctokit.Octokit = originalOctokitImpl;
  originalAuthApp.createAppAuth = originalAuthAppImpl;
  global.fetch = originalFetch;
  global.AbortController = originalAbortController;
  console.log = originalLog;
  console.error = originalError;
  process.env = originalEnv;
}

// Define test cases for different OpenAI API responses
const TEST_CASES = [
  {
    name: "Successful review",
    mockFetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "This is a good PR. The changes look appropriate and follow best practices."
            }
          }
        ]
      })
    }),
    expectedCommentContains: "This is a good PR",
    expectedLogMessage: "Successfully received review from OpenAI"
  },
  {
    name: "Empty review content",
    mockFetch: async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: ""
            }
          }
        ]
      })
    }),
    expectedCommentContains: "OpenAI returned an empty review",
    expectedLogMessage: "OpenAI returned empty content"
  },
  {
    name: "No choices array",
    mockFetch: async () => ({
      ok: true,
      json: async () => ({})
    }),
    expectedCommentContains: "OpenAI returned an empty review",
    expectedLogMessage: "OpenAI response missing choices array"
  },
  {
    name: "API error response",
    mockFetch: async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => JSON.stringify({ error: { message: "Rate limit exceeded" } })
    }),
    expectedCommentContains: "API error: 429 Too Many Requests",
    expectedLogMessage: "OpenAI API returned an error"
  },
  {
    name: "Timeout error",
    mockFetch: async () => {
      // Simulate AbortController signal being triggered
      throw new DOMException("The operation was aborted", "AbortError");
    },
    expectedCommentContains: "The operation was aborted",
    expectedLogMessage: "Failed to get review from OpenAI"
  }
];

// Mock console.log and console.error to capture logs
const originalLog = console.log;
const originalError = console.error;
const logs = [];
const errors = [];

console.log = (...args) => {
  logs.push(args.join(' '));
  originalLog(...args);
};

console.error = (...args) => {
  errors.push(args.join(' '));
  originalError(...args);
};

// Store the original fetch implementation
const originalFetch = global.fetch;
const originalAbortController = global.AbortController;

// Create a mock fetch
let mockFetchImpl;
global.fetch = (...args) => {
  return mockFetchImpl(...args);
};

// Mock AbortController
global.AbortController = class MockAbortController {
  constructor() {
    this.signal = { aborted: false };
  }
  abort() {
    this.signal.aborted = true;
    if (this.onabort) this.onabort();
  }
};

// Run the tests
async function runTests() {
  try {
    const { runFullCodeReviewTask } = require('./src/trigger/full-code-review-implementation');
    
    console.log('🚀 STARTING FULL CODE REVIEW E2E TESTS');
    
    const testResults = [];
    
    // Run each test case
    for (const testCase of TEST_CASES) {
      console.log(`\n🧪 TESTING: ${testCase.name}`);
      logs.length = 0;
      errors.length = 0;
      
      // Set the mock fetch implementation for this test case
      mockFetchImpl = testCase.mockFetch;
      
      // Create a specific Octokit instance for this test to capture the comment
      const testOctokit = new MockOctokit();
      originalOctokit.Octokit = function() { return testOctokit; };
      
      // Create a mock payload
      const mockPayload = {
        owner: 'test-owner',
        repo: 'test-repo',
        issueNumber: 123,
        installationId: 456,
        requestId: randomUUID()
      };
      
      try {
        // Call the full code review implementation
        const result = await runFullCodeReviewTask(mockPayload, {});
        
        // Check if the right comment was created
        if (!testOctokit.lastComment) {
          console.error('❌ No comment was created');
          testResults.push({ name: testCase.name, passed: false });
          continue;
        }
        
        const commentBody = testOctokit.lastComment.body;
        
        // Check if comment contains expected content
        if (commentBody.includes(testCase.expectedCommentContains)) {
          console.log(`✅ Comment contains expected text: "${testCase.expectedCommentContains}"`);
        } else {
          console.error(`❌ Comment does not contain expected text. Comment: "${commentBody.substring(0, 100)}..."`);
          testResults.push({ name: testCase.name, passed: false });
          continue;
        }
        
        // Check if expected log message was generated
        const foundExpectedLog = logs.some(log => log.includes(testCase.expectedLogMessage));
        if (foundExpectedLog) {
          console.log(`✅ Found expected log message: "${testCase.expectedLogMessage}"`);
        } else {
          console.error(`❌ Did not find expected log message: "${testCase.expectedLogMessage}"`);
          testResults.push({ name: testCase.name, passed: false });
          continue;
        }
        
        console.log(`✅ Test case "${testCase.name}" passed`);
        testResults.push({ name: testCase.name, passed: true });
        
      } catch (error) {
        console.error(`❌ Test case "${testCase.name}" failed with error:`, error);
        testResults.push({ name: testCase.name, passed: false });
      }
    }
    
    // Print summary
    console.log('\n📊 TEST SUMMARY');
    for (const result of testResults) {
      console.log(`${result.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    const allPassed = testResults.every(r => r.passed);
    console.log(`Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return allPassed;
  } finally {
    // Make sure we always restore all mocks
    restoreMocks();
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  restoreMocks(); // Make sure we still restore mocks in case of error
  process.exit(1);
});
