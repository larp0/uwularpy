#!/usr/bin/env node

// Simple test to understand the codex.ts issue
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Create a minimal test repo
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-repo-'));
console.log('Created test repo:', tempDir);

// Initialize git repo
execSync('git init', { cwd: tempDir });
execSync('git config user.email "test@example.com"', { cwd: tempDir });
execSync('git config user.name "Test User"', { cwd: tempDir });

// Create a simple file
fs.writeFileSync(path.join(tempDir, 'test.txt'), 'Hello world');
execSync('git add .', { cwd: tempDir });
execSync('git commit -m "Initial commit"', { cwd: tempDir });

console.log('✅ Test repo initialized');

// Try to reproduce the git commit issue
console.log('\n🔬 Testing git commit scenarios...');

// Test 1: Commit with no changes (should fail)
try {
  execSync('git commit -m "Apply changes from OpenAI API self-ask flow"', { 
    cwd: tempDir, 
    stdio: 'inherit' 
  });
  console.log('✅ Commit succeeded (unexpected)');
} catch (error) {
  console.log('❌ Commit failed as expected:', error.message);
}

// Test 2: Make a change and commit
fs.writeFileSync(path.join(tempDir, 'test.txt'), 'Hello world updated');
execSync('git add .', { cwd: tempDir });
try {
  execSync('git commit -m "Apply changes from OpenAI API self-ask flow"', { 
    cwd: tempDir, 
    stdio: 'inherit' 
  });
  console.log('✅ Commit with changes succeeded');
} catch (error) {
  console.log('❌ Commit with changes failed:', error.message);
}

// Test 3: Check git status
const status = execSync('git status --porcelain', { cwd: tempDir, encoding: 'utf-8' });
console.log('Git status output:', JSON.stringify(status.trim()));

// Cleanup
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('✅ Cleaned up test repo');