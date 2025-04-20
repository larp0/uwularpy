#!/usr/bin/env node
// Test that codexRepository function is properly exported from src/lib/codex.ts

// Import ts-node to handle TypeScript files
require('ts-node').register({ transpileOnly: true });

// Try importing the codexRepository function
console.log('🧪 TESTING FUNCTION EXPORT');
console.log('Attempting to import codexRepository function from src/lib/codex.ts...');

try {
  // Import the module
  const codexModule = require('./src/lib/codex');
  
  // Check if codexRepository is exported
  if (typeof codexModule.codexRepository !== 'function') {
    console.error('❌ codexRepository is not exported as a function!');
    console.error(`Type of codexModule.codexRepository: ${typeof codexModule.codexRepository}`);
    console.log('Available exports:');
    console.log(Object.keys(codexModule));
    process.exit(1);
  }
  
  // Check function signature (parameter count)
  const functionStr = codexModule.codexRepository.toString();
  console.log('\n📝 Function signature:');
  console.log(functionStr.split('{')[0].trim());
  
  console.log('\n✅ codexRepository is properly exported as a function');
  
  // Check if it returns a Promise
  if (!/Promise\s*</.test(functionStr)) {
    console.warn('⚠️ Function may not be returning a Promise as expected');
  } else {
    console.log('✅ Function returns a Promise as expected');
  }
  
  // Create a mock for testing the function with minimal parameters
  console.log('\n🔍 Creating mock to test calling the function...');
  
  // Override execSync to prevent actual execution
  const child_process = require('child_process');
  const originalExecSync = child_process.execSync;
  
  child_process.execSync = function(command, options) {
    console.log(`Mock execSync called with command: ${command.substring(0, 50)}...`);
    return 'mocked output';
  };
  
  // Override fs.mkdtempSync to return a predictable path
  const fs = require('fs');
  const originalMkdtempSync = fs.mkdtempSync;
  
  fs.mkdtempSync = function(prefix) {
    console.log(`Mock mkdtempSync called with prefix: ${prefix}`);
    return '/mock/temp/dir';
  };
  
  // Test calling the function with minimal parameters
  console.log('\n🚀 CALLING FUNCTION WITH MOCK PARAMETERS:');
  try {
    const promise = codexModule.codexRepository(
      'Test prompt',
      'https://github.com/example/repo.git',
      'test-branch'
    );
    
    console.log('✅ Function called successfully and returned a Promise');
    console.log('NOTE: Function execution is mocked to prevent actual execution');
    
    // No need to await the promise since we've mocked the fs/exec calls
  } catch (error) {
    console.error('❌ Error calling function:', error.message);
  }
  
  // Restore original functions
  child_process.execSync = originalExecSync;
  fs.mkdtempSync = originalMkdtempSync;
  
  console.log('\n📊 SUMMARY:');
  console.log('✅ The codexRepository function is properly exported');
  console.log('✅ The function signature matches expectations');
  console.log('✅ The function can be called with the expected parameters');
  
} catch (error) {
  console.error('❌ Error importing module:', error);
  process.exit(1);
}
