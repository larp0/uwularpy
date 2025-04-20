// Test script for codex.ts
require('dotenv/config'); // Load environment variables from .env
const path = require('path');
const fs = require('fs');

// Require the TypeScript register to load TS files
require('ts-node').register({
  transpileOnly: true
});

// Reimplement the processSearchReplaceBlocks function from codex.ts
function processSearchReplaceBlocks(reply, repoPath) {
  const changes = [];

  // Find all search-replace blocks
  const searchReplaceRegex = /```search-replace\n([\s\S]*?)```/g;
  let match;

  while ((match = searchReplaceRegex.exec(reply)) !== null) {
    const block = match[1];

    // Extract file path
    const fileMatch = block.match(/FILE:\s*(.*)/);
    if (!fileMatch) continue;

    const filePath = path.join(repoPath, fileMatch[1].trim());
    if (!fs.existsSync(filePath)) {
      console.warn("Search/replace target file does not exist", { filePath });
      changes.push({ file: fileMatch[1].trim(), applied: false });
      continue;
    }

    // Find all SEARCH/REPLACE operations
    const operationRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let fileContent = fs.readFileSync(filePath, "utf-8");
    let operationMatch;
    let fileModified = false;

    while ((operationMatch = operationRegex.exec(block)) !== null) {
      const searchText = operationMatch[1];
      const replaceText = operationMatch[2];

      if (fileContent.includes(searchText)) {
        fileContent = fileContent.replace(searchText, replaceText);
        fileModified = true;
      } else {
        console.warn("Search text not found in file", {
          filePath,
          searchTextLength: searchText.length
        });
      }
    }

    if (fileModified) {
      fs.writeFileSync(filePath, fileContent, "utf-8");
      changes.push({ file: fileMatch[1].trim(), applied: true });
    } else {
      changes.push({ file: fileMatch[1].trim(), applied: false });
    }
  }

  return changes;
}

// Test function that simulates what codex.ts would do
async function testCodexE2E() {
  console.log('Starting codex.ts e2e test...');
  
  const promptText = fs.readFileSync('test-prompt.txt', 'utf-8');
  const repoPath = path.resolve(__dirname, 'test-repo');
  
  console.log(`Using test repo: ${repoPath}`);
  console.log(`Prompt: ${promptText}`);
  
  try {
    // 1. Simulate the response from Codex CLI
    const mockCodexResponse = `I'll add a simple logging function to the beginning of app.js that logs "Application started" when the application runs.

\`\`\`search-replace
FILE: src/app.js
<<<<<<< SEARCH
// Simple test application

function greet(name) {
=======
// Simple test application

// Log application start
console.log("Application started");

function greet(name) {
>>>>>>> REPLACE
\`\`\`

The change has been successfully implemented. The logging statement will now execute when the application is run, before any other functions are called.`;

    console.log("Testing processSearchReplaceBlocks function with mock Codex response");
    
    // 2. Process the search/replace blocks directly
    const changes = processSearchReplaceBlocks(mockCodexResponse, repoPath);
    console.log("Changes applied:", changes);
    
    if (changes.length > 0 && changes.some(c => c.applied)) {
      console.log("✅ Successfully processed search/replace blocks");
      
      // 3. Verify the changes in the file
      const updatedAppJs = fs.readFileSync(path.join(repoPath, 'src/app.js'), 'utf-8');
      if (updatedAppJs.includes('console.log("Application started")')) {
        console.log("✅ Verified changes were correctly applied to app.js");
        console.log("Updated app.js content:");
        console.log("--------------------");
        console.log(updatedAppJs);
        console.log("--------------------");
      } else {
        console.error("❌ Changes were not applied correctly to app.js");
        console.log("Current app.js content:", updatedAppJs);
      }
    } else {
      console.error("❌ Failed to apply any changes");
    }
    
    console.log(`Test completed. You can examine the changes in: ${repoPath}/src/app.js`);
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

testCodexE2E();
