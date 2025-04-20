/**
 * Mock implementation of the full code review task for testing purposes.
 * This bypasses GitHub authentication and other external dependencies.
 */

// Create a simple mock logger
const mockLogger = {
  log: console.log,
  info: console.log,
  warn: console.warn,
  error: console.error
};

// Mock the review task with simplified implementation focused on OpenAI error handling
async function runFullCodeReviewMock(payload, ctx, mockFetch) {
  mockLogger.log("Starting full code review mock", { payload });
  
  // Mock file content
  const diff = '@@ -1,5 +1,7 @@\n function feature() {\n-  return "old";\n+  // New implementation\n+  return "new";\n }\n';
  const originalFiles = [{ 
    filename: 'src/feature.js', 
    content: 'function feature() {\n  // New implementation\n  return "new";\n}\n' 
  }];

  // Prepare OpenAI request
  const systemMsg = "You are a code reviewer. Review the code changes below for quality, security, and style issues.";
  const userMsg = `DIFF:\n${diff}\n\nORIGINAL FILES:\n${JSON.stringify(originalFiles)}`;
  const requestBody = {
    model: "gpt-4",
    messages: [
      { role: "system", content: systemMsg },
      { role: "user", content: userMsg }
    ]
  };

  // Handle OpenAI API call with improved error handling
  let review = "";
  let errorMessage = "";
  let commentBody = "";
  let comment = null;
  
  try {
    mockLogger.log("Calling OpenAI API", { 
      model: requestBody.model,
      messagesCount: requestBody.messages.length,
      promptLength: userMsg.length
    });
    
    // Set up the fetch request with a 60-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    try {
      // Use the provided mock fetch implementation
      const res = await mockFetch();
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check for HTTP errors
      if (!res.ok) {
        const errorText = await res.text();
        mockLogger.error("OpenAI API returned an error", { 
          status: res.status, 
          statusText: res.statusText,
          errorText 
        });
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      
      const aiResponse = await res.json();
      
      // Log response structure for debugging
      mockLogger.log("OpenAI API response received", {
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
        mockLogger.warn("OpenAI returned empty content", { aiResponse });
        throw new Error("Empty content received from OpenAI");
      }
      
      mockLogger.log("Successfully received review from OpenAI", { reviewLength: review.length });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error; // Rethrow to be caught by the outer try/catch
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    mockLogger.error("Failed to get review from OpenAI", { error: errorMsg });
    errorMessage = errorMsg;
  }

  // Build comment body
  commentBody = review.trim() || 
    `🛑 OpenAI returned an empty review. Please try again later.\n\n` +
    `Error details: ${errorMessage || "Unknown error"}`;
  
  // Create mock comment object instead of posting to GitHub
  comment = {
    owner: payload.owner,
    repo: payload.repo,
    issue_number: payload.issueNumber,
    body: commentBody
  };
  
  mockLogger.log("Generated comment", { commentLength: commentBody.length });
  
  return { 
    success: !!review.trim(),
    comment: comment
  };
}

module.exports = {
  runFullCodeReviewMock
};
