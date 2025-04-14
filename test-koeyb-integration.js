// Test script for the Koeyb worker integration
const axios = require('axios');

// Koeyb API configuration
const KOEYB_API_URL = 'https://app.koyeb.com/v1';
const KOEYB_API_KEY = '2sdajy2jvjuskub3qnx11e067fdrjnrdizyx6q7wicl1t18fhoajjue4q4dix0nl';

// Mock GitHub context
const mockContext = {
  owner: 'test-owner',
  repo: 'test-repo',
  issueNumber: 123,
  requester: 'test-user',
  installationId: 456789,
  branch: 'uwuify-issue-123',
  repoStats: {
    totalFiles: 50,
    markdownFiles: 10,
    totalMarkdownSize: 50000,
    avgMarkdownSize: 5000,
    largestFile: {
      name: 'README.md',
      size: 15000,
    },
    contributors: 5,
    lastUpdated: '2025-04-14T14:00:00Z',
    topLanguages: {
      JavaScript: 70000,
      TypeScript: 50000,
      HTML: 10000
    }
  }
};

/**
 * Test function to trigger the Koeyb worker
 */
async function testTriggerUwuifyWorker() {
  try {
    console.log('Testing Koeyb worker integration...');
    
    // Configure the API request
    const headers = {
      'Authorization': `Bearer ${KOEYB_API_KEY}`,
      'Content-Type': 'application/json'
    };

    // Create the request payload
    const payload = {
      task: 'uwuify',
      context: {
        ...mockContext,
        requestTimestamp: new Date().toISOString(),
        requestId: `test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      }
    };

    console.log('Sending request to Koeyb API...');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Make the API request to trigger the worker
    const response = await axios.post(
      `${KOEYB_API_URL}/worker-tasks`, 
      payload,
      { 
        headers,
        timeout: 10000 // 10 second timeout for the API request
      }
    );

    console.log('Response received:', response.data);
    
    // Return the job ID or other identifier from the response
    const jobId = response.data.id || 'task-submitted';
    console.log('Job ID:', jobId);
    
    return jobId;
  } catch (error) {
    console.error('Error in test:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error('API error response:', {
          status: error.response.status,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error setting up request:', error.message);
      }
    }
    
    throw error;
  }
}

// Run the test
testTriggerUwuifyWorker()
  .then(jobId => {
    console.log('Test completed successfully with job ID:', jobId);
  })
  .catch(error => {
    console.error('Test failed:', error.message);
  });
