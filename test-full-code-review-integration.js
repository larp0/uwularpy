#!/usr/bin/env node

// Simple integration test for the full code review issue workflow
// This simulates the workflow without making actual API calls

async function testIssueWorkflow() {
  console.log('🧪 Testing Full Code Review Issue Workflow...\n');

  // Test context detection logic
  console.log('1. Testing Context Detection');
  
  // Mock PR context (should use PR workflow)
  const prContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    issueNumber: 123, // This is actually a PR number
    requester: 'test-user',
    installationId: 456,
    requestTimestamp: '2024-01-01T00:00:00Z',
    requestId: 'test-pr-request',
    message: '@l r',
  };

  // Mock Issue context (should use Issue workflow)
  const issueContext = {
    owner: 'test-owner',
    repo: 'test-repo',
    issueNumber: 456, // This is an actual issue number
    requester: 'test-user',
    installationId: 456,
    requestTimestamp: '2024-01-01T00:00:00Z',
    requestId: 'test-issue-request',
    message: '@l r',
  };

  console.log('✅ PR Context:', prContext.issueNumber);
  console.log('✅ Issue Context:', issueContext.issueNumber);

  // Test workflow constants
  console.log('\n2. Testing Workflow Constants');
  try {
    const { COPILOT_USERNAME } = require('./src/trigger/workflow-constants');
    console.log('✅ COPILOT_USERNAME:', COPILOT_USERNAME);
  } catch (error) {
    console.log('❌ Failed to load constants:', error.message);
  }

  // Test task type determination
  console.log('\n3. Testing Task Type Determination');
  try {
    const { getTaskType, parseCommand } = require('./src/lib/command-parser');
    
    const reviewCommand = parseCommand('@l r');
    const taskType = await getTaskType(reviewCommand);
    
    console.log('✅ Review command parsed:', reviewCommand);
    console.log('✅ Task type determined:', taskType);
    
    if (taskType === 'full-code-review') {
      console.log('✅ Correct task type for review command');
    } else {
      console.log('❌ Unexpected task type:', taskType);
    }
  } catch (error) {
    console.log('❌ Failed to test command parsing:', error.message);
  }

  // Test GitHub context generation
  console.log('\n4. Testing GitHub Context Generation');
  try {
    const { generateRequestId } = require('./src/services/task-types');
    const requestId = generateRequestId();
    
    if (requestId && requestId.startsWith('req_')) {
      console.log('✅ Request ID generated:', requestId);
    } else {
      console.log('❌ Invalid request ID format:', requestId);
    }
  } catch (error) {
    console.log('❌ Failed to generate request ID:', error.message);
  }

  console.log('\n🎉 Integration test completed!');
  console.log('\nTo test the full workflow:');
  console.log('1. Create a GitHub issue with a clear description');
  console.log('2. Comment "@l r" on the issue');
  console.log('3. Verify the bot responds with enhanced intention and project analysis');
  console.log('4. Verify @copilot is mentioned and assigned to the issue');
  console.log('5. Verify the "full-code-review-complete" label is added');
}

// Run the test
testIssueWorkflow().catch(console.error);