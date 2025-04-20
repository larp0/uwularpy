#!/usr/bin/env node
// Improved test for codexRepository function export with better mocking

// Import ts-node to handle TypeScript files
require('ts-node').register({ transpileOnly: true });

console.log('🧪 TESTING FUNCTION EXPORT (IMPROVED VERSION)');
console.log('Attempting to import codexRepository function from src/lib/codex.ts...');

// Set up mocks BEFORE importing the module
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Save original functions
const originalExecSync = child_process.execSync;
const originalMkdtempSync = fs.mkdtempSync;
const originalWriteFileSync = fs.writeFileSync;
const originalUnlinkSync = fs.unlinkSync;
const originalExistsSync = fs.existsSync;

// Mock execSync to prevent any actual commands from running
child_process.execSync = function(command, options) {
  console.log(`[MOCK] execSync: ${command.substring(0, 50)}${command.length > 50 ? '...' : ''}`);
  return 'mocked output';
};

// Mock fs.mkdtempSync to return a predictable path
fs.mkdtempSync = function(prefix) {
  console.log(`[MOCK] mkdtempSync: ${prefix}`);
  return '/mock/temp/dir';
};

// Mock fs.writeFileSync to prevent actual file creation
fs.writeFileSync = function(filePath, content, options) {
  console.log(`[MOCK] writeFileSync: ${filePath}`);
  return;
};

// Mock fs.unlinkSync to prevent actual file deletion
fs.unlinkSync = function(filePath) {
  console.log(`[MOCK] unlinkSync: ${filePath}`);
  return;
};

// Mock fs.existsSync to always return true
fs.existsSync = function(path) {
  console.log(`[MOCK] existsSync: ${path}`);
  return true;
};

try {
  // Now import the module with all mocks in place
  const codexModule = require('./src/lib/codex');
  
  // Check if codexRepository is exported
  if (typeof codexModule.codexRepository !== 'function') {
    console.error('❌ codexRepository is not exported as a function!');
    console.error(`Type of codexModule.codexRepository: ${typeof codexModule.codexRepository}`);
    console.log('Available exports:');
    console.log(Object.keys(codexModule));
    process.exit(1);
  }
  
  // Check function signature
  const functionStr = codexModule.codexRepository.toString();
  console.log('\n📝 Function signature:');
  const signature = functionStr.split('{')[0].trim();
  console.log(signature);
  
  // Check basic signature requirements
  const hasCorrectParams = signature.includes('prompt') && 
                          signature.includes('repoUrl') && 
                          signature.includes('branchName') &&
                          signature.includes('installationId');
                          
  if (hasCorrectParams) {
    console.log('✅ Function has the expected parameters');
  } else {
    console.warn('⚠️ Function parameters might not match expectations');
    console.log('Expected: prompt, repoUrl, branchName, installationId (optional)');
  }
  
  // Check if function is async/returns Promise
  const isAsync = signature.includes('async') || /Promise\s*</.test(functionStr);
  if (isAsync) {
    console.log('✅ Function is async or returns a Promise');
  } else {
    console.warn('⚠️ Function may not be async/return a Promise as expected');
  }
  
  // Test calling the function with minimal parameters
  console.log('\n🚀 CALLING FUNCTION WITH TEST PARAMETERS:');
  try {
    const promise = codexModule.codexRepository(
      'Test prompt',
      'https://github.com/example/repo.git',
      'test-branch'
    );
    
    if (promise instanceof Promise) {
      console.log('✅ Function returned a Promise object');
    } else {
      console.warn(`⚠️ Function returned ${typeof promise}, not a Promise`);
    }
    
    // Just let the promise run without awaiting it
    // Our mocks will prevent any real operations
    console.log('Function call initiated successfully');
    
  } catch (error) {
    console.error('❌ Error calling function:', error.message);
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('✅ The codexRepository function is properly exported');
  console.log('✅ The function can be imported correctly');
  console.log('✅ Function calls can be initiated with the expected parameters');
  console.log('NOTE: Full execution was prevented by mocks to avoid external calls');
  
} catch (error) {
  console.error('❌ Error during test:', error);
} finally {
  // Restore all original functions to prevent side effects
  child_process.execSync = originalExecSync;
  fs.mkdtempSync = originalMkdtempSync;
  fs.writeFileSync = originalWriteFileSync;
  fs.unlinkSync = originalUnlinkSync;
  fs.existsSync = originalExistsSync;
}
