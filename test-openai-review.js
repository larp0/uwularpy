#!/usr/bin/env node
// Direct test of OpenAI integration for code review
// This bypasses GitHub API calls completely

require('dotenv/config'); // Load environment variables from .env

// Use the right fetch implementation based on Node.js version
let fetch;
try {
  // Use global fetch if available (Node.js v18+)
  if (typeof global.fetch === 'function') {
    fetch = global.fetch;
    console.log("Using global fetch");
  } else {
    // Fallback to node-fetch
    fetch = require('node-fetch').default;
    console.log("Using node-fetch");
  }
} catch (e) {
  console.error("Error loading fetch:", e.message);
  // Try installing node-fetch if not found
  console.log("Installing node-fetch...");
  require('child_process').execSync('npm install node-fetch@2', { stdio: 'inherit' });
  // Now try requiring it again
  fetch = require('node-fetch').default;
}

// Sample code diff
const sampleDiff = `@@ -1,5 +1,7 @@
function feature() {
-  return "old";
+  // New implementation
+  return "new";
}`;

const sampleFile = {
  filename: 'src/feature.js',
  content: 'function feature() {\n  // New implementation\n  return "new";\n}\n'
};

// Function to directly test OpenAI API with error handling
async function testOpenAIReview(apiKey, abortEarly = false) {
  console.log(`🧪 Testing OpenAI review with${!apiKey ? ' invalid' : ''} API key`);
  
  // Set up OpenAI request
  const systemMsg = "You are a code reviewer. Review the code changes below for quality, security, and style issues.";
  const userMsg = `DIFF:\n${sampleDiff}\n\nORIGINAL FILES:\n${JSON.stringify([sampleFile])}`;
  const requestBody = {
    model: "gpt-4",
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg }
    ]
  };
  
  // Set up error handling and timeout
  let review = "";
  let errorMessage = "";
  
  try {
    console.log("Calling OpenAI API...");
    
    // Set up the fetch request with a 30-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      // Simulate early abort for testing if requested
      if (abortEarly) {
        controller.abort();
        // Use standard Error instead of DOMException for Node.js compatibility
        const abortError = new Error("The operation was aborted");
        abortError.name = "AbortError";
        throw abortError;
      }
      
      // Real API call
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "OpenAI-Beta": "assistants=v1" // Use latest API version
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check for HTTP errors
      if (!res.ok) {
        const errorText = await res.text();
        console.error("OpenAI API returned an error:", {
          status: res.status,
          statusText: res.statusText,
          errorText
        });
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const aiResponse = await res.json();
      
      // Log response structure
      console.log("OpenAI API response received:", {
        hasChoices: !!aiResponse.choices,
        choicesLength: aiResponse.choices?.length,
        hasContent: !!aiResponse.choices?.[0]?.message?.content,
        contentLength: aiResponse.choices?.[0]?.message?.content?.length
      });
      
      if (!aiResponse.choices || aiResponse.choices.length === 0) {
        throw new Error("OpenAI response missing choices array");
      }
      
      review = aiResponse.choices[0]?.message?.content || "";
      
      if (!review.trim()) {
        console.warn("OpenAI returned empty content", aiResponse);
        throw new Error("Empty content received from OpenAI");
      }
      
      console.log("Successfully received review from OpenAI:", {
        reviewLength: review.length
      });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Rethrow to outer try/catch
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to get review from OpenAI:", { error: errorMsg });
    errorMessage = errorMsg;
  }
  
  // Generate comment text similar to what would be posted to GitHub
  const commentBody = review.trim() ||
    `🛑 OpenAI returned an empty review. Please try again later.\n\n` +
    `Error details: ${errorMessage || "Unknown error"}`;
  
  return {
    success: !!review.trim(),
    review: review,
    error: errorMessage,
    comment: commentBody
  };
}

// Main test function
async function runTests() {
  console.log('🚀 STARTING OPENAI CODE REVIEW TESTS');
  
  // Ensure we have the API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }
  
  console.log('Running 3 tests: valid key, invalid key, and timeout...');
  
  try {
    // Test 1: With valid API key
    console.log('\n--- TEST 1: Valid API Key ---');
    const validResult = await testOpenAIReview(apiKey);
    
    if (validResult.success) {
      console.log('✅ Valid API key test passed');
      console.log('💬 Review preview:', validResult.review.substring(0, 100) + '...');
    } else {
      console.error('❌ Valid API key test failed:', validResult.error);
    }
    
    // Test 2: With invalid API key
    console.log('\n--- TEST 2: Invalid API Key ---');
    const invalidResult = await testOpenAIReview('sk-invalid-key');
    
    if (!invalidResult.success && invalidResult.error) {
      console.log('✅ Invalid API key test passed (error expected)');
      console.log('💬 Error message:', invalidResult.error);
    } else {
      console.error('❌ Invalid API key test failed (should have errored)');
    }
    
    // Test 3: With timeout/abort
    console.log('\n--- TEST 3: Request Abort/Timeout ---');
    const abortResult = await testOpenAIReview(apiKey, true);
    
    if (!abortResult.success && abortResult.error.includes('aborted')) {
      console.log('✅ Request abort test passed');
      console.log('💬 Error message:', abortResult.error);
    } else {
      console.error('❌ Request abort test failed:', abortResult.error);
    }
    
    // Summary
    console.log('\n📊 TEST SUMMARY');
    console.log(`Test 1 (Valid API Key): ${validResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 2 (Invalid API Key): ${!invalidResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 3 (Request Abort): ${!abortResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    
    const allPassed = 
      validResult.success && 
      !invalidResult.success && 
      !abortResult.success;
      
    console.log(`Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    return allPassed;
  } catch (error) {
    console.error('❌ Tests failed with an unexpected error:', error);
    return false;
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
