#!/usr/bin/env node
// Final test script to verify the shell command approach
require('dotenv/config');
const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

console.log('🔍 FINAL VERIFICATION FOR PRODUCTION ENVIRONMENT');

// Create a test directory
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'final-verify-'));
console.log(`Created test directory: ${tempDir}`);

// Create a test prompt
const prompt = "Test prompt for codex verification";
const formattedPrompt = `*** Begin Patch ***\n${prompt}\n*** End Patch ***`;

try {
  // Create prompt file
  const promptFile = path.join(tempDir, "prompt.txt");
  fs.writeFileSync(promptFile, formattedPrompt, "utf-8");
  console.log(`Created prompt file at ${promptFile}`);
  
  // Create the command exactly as it will be used in production
  const shellCmd = `/bin/bash -c "npx @openai/codex --approval-mode full-auto < ${promptFile}"`;
  console.log(`Shell command: ${shellCmd}`);
  
  console.log('\n🚀 EXECUTING SHELL COMMAND...');
  console.log('This should succeed if the approach is compatible with production...');
  
  try {
    const output = child_process.execSync(shellCmd, {
      cwd: tempDir,
      env: { 
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        FORCE_COLOR: "0", 
        CI: "true",
        NODE_OPTIONS: "--no-warnings"
      },
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000 // 10 second timeout
    });
    
    console.log('\n✅ COMMAND EXECUTED SUCCESSFULLY!');
    console.log('First 100 characters of output:');
    console.log(output.substring(0, 100) + '...');
  } catch (e) {
    console.error('\n❌ COMMAND FAILED:');
    console.error(e.message);
    
    // Try a few different variations to help debug production issues
    console.log('\n🔄 TRYING ALTERNATIVE APPROACHES...');
    
    // Try with just npx
    try {
      console.log('Attempting direct npx execution...');
      child_process.execSync(`npx --version`, { encoding: 'utf-8' });
      console.log('✅ npx is available');
    } catch (e) {
      console.error('❌ npx is not available');
    }
    
    // Try with npx @openai/codex
    try {
      console.log('Attempting with npx instead of npx...');
      const npxCmd = `/bin/bash -c "echo '${formattedPrompt}' | npx @openai/codex --approval-mode full-auto"`;
      child_process.execSync(npxCmd, {
        cwd: tempDir,
        env: { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY },
        encoding: 'utf-8',
        timeout: 5000
      });
      console.log('✅ npx approach works');
    } catch (e) {
      console.error('❌ npx approach failed:', e.message);
    }
  }
  
  console.log('\n📊 ENVIRONMENT INFORMATION:');
  console.log(`- Node.js version: ${process.version}`);
  console.log(`- Platform: ${process.platform}`);
  console.log(`- Shell: ${process.env.SHELL || 'unknown'}`);
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Make sure npx is installed and available in the production environment');
  console.log('2. Verify the OPENAI_API_KEY is correctly set');
  console.log('3. Check if bash is available and supports redirection');
  console.log('4. Try using a direct echo pipe if shell redirection fails');
  
} catch (error) {
  console.error('Test script error:', error);
} finally {
  // Clean up
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`\nCleaned up test directory: ${tempDir}`);
  } catch (e) {
    console.error('Failed to clean up test directory:', e);
  }
}
