// test-uwuify-binary.js
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Path to the uwuify binary
const UWUIFY_BINARY_PATH = path.join(__dirname, 'src', 'lib', 'bin', 'uwuify');

// Test text to uwuify
const testText = `# Sample Markdown
This is a test of the Rust uwuify binary.

## Features
- No JavaScript fallback
- Uses Rust binary directly
- Better performance

Let's see if it works correctly!`;

async function testUwuifyBinary() {
  try {
    console.log("Original text:");
    console.log(testText);
    console.log("\n-------------------------------\n");
    
    // Execute the uwuify binary with the input text
    const { stdout, stderr } = await execAsync(`echo "${testText.replace(/"/g, '\\"')}" | ${UWUIFY_BINARY_PATH}`);
    
    if (stderr) {
      console.error('Error from uwuify binary:', stderr);
      return;
    }
    
    console.log("Uwuified text using Rust binary:");
    console.log(stdout.trim());
    console.log("\nRust uwuify binary test successful!");
  } catch (error) {
    console.error('Error testing uwuify binary:', error);
  }
}

// Run the test
testUwuifyBinary();
