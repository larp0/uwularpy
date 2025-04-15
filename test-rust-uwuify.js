// test-rust-uwuify.js
const { uwuify } = require('uwuify-rs');

// Test text to uwuify
const testText = `# Sample Markdown
This is a test of the Rust uwuify implementation.

## Features
- No JavaScript fallback
- Uses Rust implementation exclusively
- Better performance

Let's see if it works correctly!`;

console.log("Original text:");
console.log(testText);
console.log("\n-------------------------------\n");

try {
  // Use the Rust implementation directly
  console.log("Uwuified text using Rust implementation:");
  const uwuifiedText = uwuify(testText);
  console.log(uwuifiedText);
  console.log("\nRust uwuify implementation test successful!");
} catch (error) {
  console.error("Error using Rust uwuify implementation:", error);
}
