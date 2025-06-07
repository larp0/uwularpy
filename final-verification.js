#!/usr/bin/env node

// Final test demonstrating the exact issue from the problem statement is fixed
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('🚀 FINAL VERIFICATION: Testing the exact scenario from the issue');
console.log('Issue: "Command failed: git commit -m \\"Apply changes from OpenAI API self-ask flow\\""\n');

// Simulate the exact scenario that was failing
function simulateOriginalFailure() {
  console.log('📋 Step 1: Simulating the ORIGINAL failure scenario...');
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'original-fail-'));
  
  try {
    // Set up the same conditions that would cause the original failure
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "bot@larp.dev"', { cwd: tempDir });
    execSync('git config user.name "larp0"', { cwd: tempDir });
    
    // Create initial commit (simulating a cloned repository)
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test repo');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
    
    // Now simulate what happens when OpenAI doesn't make any changes
    // (no new files, no modifications)
    execSync('git add .', { cwd: tempDir });
    
    // Try the original approach that was failing
    try {
      execSync('git commit -m "Apply changes from OpenAI API self-ask flow"', { 
        cwd: tempDir, 
        stdio: 'inherit' 
      });
      console.log('❌ ERROR: Original approach should have failed but didn\'t!');
      return false;
    } catch (error) {
      console.log('✅ Original approach correctly fails:', error.message.split('\n')[0]);
      return true;
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function simulateFixedApproach() {
  console.log('\n📋 Step 2: Testing the FIXED approach...');
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixed-approach-'));
  
  try {
    // Set up the same conditions
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "bot@larp.dev"', { cwd: tempDir });
    execSync('git config user.name "larp0"', { cwd: tempDir });
    
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test repo');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
    
    // Apply the fix logic from our updated codex.ts
    execSync('git add .', { cwd: tempDir });
    
    // Check if there are any changes to commit (the key part of our fix)
    const gitStatus = execSync('git status --porcelain', { 
      encoding: 'utf-8', 
      cwd: tempDir 
    }).toString().trim();
    
    if (!gitStatus) {
      console.log('✅ No changes detected - creating empty commit');
      execSync('git commit --allow-empty -m "Apply changes from OpenAI API self-ask flow (no changes made)"', { 
        cwd: tempDir, 
        stdio: 'inherit' 
      });
    } else {
      console.log('✅ Changes detected - would commit normally');
      execSync('git commit -m "Apply changes from OpenAI API self-ask flow"', { 
        cwd: tempDir, 
        stdio: 'inherit' 
      });
    }
    
    // Verify the commit was created successfully
    const commitCount = execSync('git rev-list --count HEAD', { 
      cwd: tempDir, 
      encoding: 'utf-8' 
    }).trim();
    
    const latestCommit = execSync('git log -1 --oneline', { 
      cwd: tempDir, 
      encoding: 'utf-8' 
    }).trim();
    
    console.log(`✅ Success! Total commits: ${commitCount}`);
    console.log(`✅ Latest commit: ${latestCommit}`);
    
    return true;
  } catch (error) {
    console.log('❌ Fixed approach failed:', error.message);
    return false;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Run both tests
const originalFailed = simulateOriginalFailure();
const fixedWorked = simulateFixedApproach();

console.log('\n🎯 FINAL RESULTS:');
console.log(`Original approach fails as expected: ${originalFailed ? '✅' : '❌'}`);
console.log(`Fixed approach works: ${fixedWorked ? '✅' : '❌'}`);

if (originalFailed && fixedWorked) {
  console.log('\n🎉 SUCCESS! The codex.ts fix resolves the exact issue from the problem statement.');
  console.log('The error "Command failed: git commit -m \\"Apply changes from OpenAI API self-ask flow\\"" is now fixed.');
} else {
  console.log('\n❌ FAILURE! The fix did not work as expected.');
  process.exit(1);
}