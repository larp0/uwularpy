#!/usr/bin/env node
// E2E test for full-code-review-implementation.ts using real OpenAI API
// but mocking GitHub API interactions

require('dotenv/config'); // Load environment variables from .env
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// Import TS modules
require('ts-node').register({
  transpileOnly: true
});

// Global store for Octokit mock data
const octokitMock = {
  lastComment: null,
  pulls: {
    get: async () => ({
      data: {
        base: { sha: 'base-sha-1234' },
        head: { sha: 'head-sha-5678' }
      }
    })
  },
  repos: {
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
  },
  issues: {
    createComment: async (params) => {
      console.log('Mock comment created:', params.body.substring(0, 150) + '...');
      octokitMock.lastComment = params;
      return { data: { id: 12345 } };
    }
  }
};

// Setup manual mocks for Octokit
class MockOctokit {
  constructor() {
    this.pulls = octokitMock.pulls;
    this.repos = octokitMock.repos;
    this.issues = octokitMock.issues;
  }
}

// Patch required modules to use our mocks
const originalModuleRequire = module.require;
module.require = function(id) {
  if (id === '@octokit/rest') {
    return { Octokit: MockOctokit };
  }
  
  if (id === '@octokit/auth-app') {
    return {
      createAppAuth: () => () => Promise.resolve({ token: 'mock-token' })
    };
  }
  
  return originalModuleRequire.apply(this, arguments);
};

// Reset mock state
function resetMocks() {
  octokitMock.lastComment = null;
  // Reset logs
  Object.keys(logs).forEach(key => logs[key] = []);
}

// Mock the logger to capture logs
const logs = {
  info: [],
  warn: [],
  error: [],
  debug: []
};

const mockLogger = {
  log: function(msg, params) {
    console.log(`[LOG] ${msg}`, params || '');
    logs.info.push({ msg, params });
  },
  info: function(msg, params) {
    console.log(`[INFO] ${msg}`, params || '');
    logs.info.push({ msg, params });
  },
  warn: function(msg, params) {
    console.warn(`[WARN] ${msg}`, params || '');
    logs.warn.push({ msg, params });
  },
  error: function(msg, params) {
    console.error(`[ERROR] ${msg}`, params || '');
    logs.error.push({ msg, params });
  },
  debug: function(msg, params) {
    console.log(`[DEBUG] ${msg}`, params || '');
    logs.debug.push({ msg, params });
  }
};

// Patch the logger module to use our mock
const loggerModulePath = path.resolve(__dirname, 'node_modules/@trigger.dev/sdk/v3/index.js');
if (fs.existsSync(loggerModulePath)) {
  // If the module exists on disk, we need to patch it
  try {
    const originalContent = fs.readFileSync(loggerModulePath, 'utf8');
    if (!originalContent.includes('PATCHED_FOR_TESTING')) {
      // Only patch once to avoid multiple patching
      const patchedContent = originalContent.replace(
        'exports.logger',
        '// PATCHED_FOR_TESTING\nexports.logger = ' + JSON.stringify(mockLogger) + ';\n// Original logger:'
      );
      fs.writeFileSync(loggerModulePath + '.bak', originalContent, 'utf8');
      fs.writeFileSync(loggerModulePath, patchedContent, 'utf8');
    }
  } catch (e) {
    console.warn('Could not patch logger module, using runtime override instead');
  }
}

// If patching fails, we'll monkey patch at runtime
try {
  const triggerSdk = require('@trigger.dev/sdk/v3');
  triggerSdk.logger = mockLogger;
} catch (e) {
  console.warn('Could not load @trigger.dev/sdk/v3 for monkey patching');
}

// Function to run a test with the full code review implementation
async function runTest(testName, mockPayload) {
  console.log(`\n🧪 RUNNING TEST: ${testName}`);
  
  try {
    // Reset all mocks and logs
    resetMocks();
    
    // Load the implementation dynamically to get fresh instance with mocked dependencies
    delete require.cache[require.resolve('./src/trigger/full-code-review-implementation')];
    const { runFullCodeReviewTask } = require('./src/trigger/full-code-review-implementation');
    
    // Run the implementation
    const result = await runFullCodeReviewTask(mockPayload, {});
    
    // Check for expected outputs
    if (octokitMock.lastComment) {
      console.log('✅ Comment was created successfully');
      return {
        success: true,
        comment: octokitMock.lastComment
      };
    } else {
      console.error('❌ No comment was created');
      return { 
        success: false,
        error: 'No comment was created'
      };
    }
  } catch (error) {
    console.error(`❌ Test failed with error:`, error);
    return {
      success: false,
      error
    };
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 STARTING FULL CODE REVIEW REAL API TESTS');
  
  // Ensure we have necessary environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }
  
  // Create a sample payload for testing
  const mockPayload = {
    owner: 'test-owner',
    repo: 'test-repo',
    issueNumber: 123,
    installationId: 456,
    requestId: randomUUID()
  };
  
  // Run tests
  try {
    // Run a standard successful test
    const normalResult = await runTest('Standard successful review', mockPayload);
    
    if (normalResult.success) {
      console.log('✅ Standard test passed');
      console.log('💬 Review comment preview:', normalResult.comment.body.substring(0, 150) + '...');
    } else {
      console.error('❌ Standard test failed');
    }
    
    // Intentionally cause an error by using an invalid API key
    console.log('\n🧪 TESTING ERROR HANDLING: Invalid API Key');
    
    // Save the original API key
    const originalApiKey = process.env.OPENAI_API_KEY;
    
    // Replace with an invalid key
    process.env.OPENAI_API_KEY = 'sk-invalid-key';
    
    // Run the test with the invalid key
    const errorResult = await runTest('Invalid API Key', mockPayload);
    
    // Should still create a comment with an error message
    if (errorResult.success && errorResult.comment.body.includes('Error details:')) {
      console.log('✅ Error handling test passed');
      console.log('💬 Error comment preview:', errorResult.comment.body.substring(0, 150) + '...');
    } else {
      console.error('❌ Error handling test failed');
    }
    
    // Restore the original API key
    process.env.OPENAI_API_KEY = originalApiKey;
    
    console.log('\n📊 TEST SUMMARY');
    console.log(`Standard test: ${normalResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Error handling test: ${errorResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    
    return normalResult.success && errorResult.success;
  } catch (error) {
    console.error('❌ Tests failed with an unexpected error:', error);
    return false;
  }
}

// Run all tests
runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
