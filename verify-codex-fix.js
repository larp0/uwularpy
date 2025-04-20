#!/usr/bin/env node
// Simple verification script for the codex.ts fix
require('dotenv/config');
const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('🔍 VERIFYING CODEX CLI INVOCATION FIX');

// Create a test directory
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-verify-'));
console.log(`Created test directory: ${tempDir}`);

// Create a test prompt
const testPrompt = 'Add a simple logging function that logs "Test successful!"';
console.log(`Test prompt: "${testPrompt}"`);

// Save original execSync function
const originalExecSync = childProcess.execSync;

// Track called commands
const calledCommands = [];

// Mock execSync to verify how the commands are invoked
childProcess.execSync = function(command, options) {
  calledCommands.push({ command, options });
  
  // When Codex CLI is invoked, return mock response
  if (command.includes('@openai/codex')) {
    console.log('✅ Codex CLI was invoked');
    
    // Check if prompt was passed via stdin (options.input)
    if (options && options.input) {
      console.log('✅ Prompt was correctly passed via stdin');
      console.log(`   Input length: ${options.input.length} characters`);
    } else {
      console.log('❌ Prompt was NOT passed via stdin');
    }
    
    // Check for quiet flag
    if (command.includes('--quiet') || command.includes('-q')) {
      console.log('❌ Command still includes quiet flag');
    } else {
      console.log('✅ Quiet flag was correctly removed');
    }
    
    return 'Mock response from Codex CLI';
  }
  
  // Return empty string for other commands
  return '';
};

try {
  // Import the fixed code
  require('ts-node').register({ transpileOnly: true });
  const { codexRepository } = require('./src/lib/codex');
  
  console.log('\n📋 TESTING FIX WITH ISOLATED CODEX CLI INVOCATION');
  
  // Set up our mocks to only execute the first part of codexRepository
  const tempRepoPath = path.join(tempDir, 'repo');
  fs.mkdirSync(tempRepoPath);
  
  // We'll run just enough to trigger the codex CLI invocation
  try {
    console.log('Attempting to run codexRepository (will be interrupted)...');
    codexRepository(testPrompt, 'file:///fake/repo', 'test-branch');
  } catch (error) {
    // We expect this to fail since we're not executing all commands
    console.log('Expected interruption occurred');
  }
  
  // Check if any command matches our fix expectations
  console.log('\n📊 RESULTS');
  
  const codexCommands = calledCommands.filter(c => c.command.includes('@openai/codex'));
  if (codexCommands.length > 0) {
    console.log(`Found ${codexCommands.length} Codex CLI invocations`);
    
    codexCommands.forEach((cmd, i) => {
      console.log(`\nCommand #${i+1}:`);
      console.log(`  ${cmd.command}`);
      
      const hasQuiet = cmd.command.includes('--quiet') || cmd.command.includes('-q');
      const hasStdin = cmd.options && cmd.options.input;
      
      if (!hasQuiet && hasStdin) {
        console.log('✅ VERIFICATION PASSED: Codex CLI is correctly invoked without quiet flag and with stdin input');
      } else {
        console.log('❌ VERIFICATION FAILED: Codex CLI invocation does not match the expected fix');
        console.log(`   - Quiet flag removed: ${!hasQuiet ? 'Yes' : 'No'}`);
        console.log(`   - Using stdin: ${hasStdin ? 'Yes' : 'No'}`);
      }
    });
  } else {
    console.log('❌ No Codex CLI invocations were found');
  }
  
  console.log('\n👉 CONCLUSION:');
  if (codexCommands.length > 0 && !codexCommands[0].command.includes('--quiet') && codexCommands[0].options && codexCommands[0].options.input) {
    console.log('✅ The fix was successfully applied and verified!');
    console.log('   Codex CLI is now being invoked without the quiet flag and with the prompt passed via stdin.');
  } else {
    console.log('❌ The fix does not appear to be working as expected.');
    console.log('   Please check the codex.ts file to ensure the change was properly applied.');
  }
} catch (error) {
  console.error('Error during verification:', error);
} finally {
  // Restore original execSync
  childProcess.execSync = originalExecSync;
  
  // Clean up
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`\nCleaned up test directory: ${tempDir}`);
  } catch (e) {
    console.error('Failed to clean up test directory:', e);
  }
}
