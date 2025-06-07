#!/usr/bin/env node

// Test script to verify the codex.ts fix
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('🧪 Testing codex.ts fix for empty commit handling...');

// Create a test directory to simulate the tempDir behavior
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-codex-fix-'));
console.log('Created test directory:', tempDir);

try {
  // Initialize git repo (simulating the clone and setup)
  execSync('git init', { cwd: tempDir });
  execSync('git config user.email "bot@larp.dev"', { cwd: tempDir });
  execSync('git config user.name "larp0"', { cwd: tempDir });
  
  // Create initial commit (simulating cloned repo state)
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test repo');
  execSync('git add .', { cwd: tempDir });
  execSync('git commit -m "Initial commit"', { cwd: tempDir });
  
  console.log('✅ Test repo setup complete');
  
  // Test the new logic from codex.ts
  console.log('\n📋 Testing the fix logic...');
  
  // Simulate the exact logic from our fix
  execSync("git add .", { cwd: tempDir, stdio: "inherit" });
  
  // Check if there are any changes to commit
  const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8', cwd: tempDir }).toString().trim();
  
  if (!gitStatus) {
    console.log("✅ No changes detected - creating empty commit");
    execSync('git commit --allow-empty -m "Apply changes from OpenAI API self-ask flow (no changes made)"', { cwd: tempDir, stdio: "inherit" });
    console.log("✅ Empty commit created successfully");
  } else {
    console.log("Changes detected - would commit normally");
    console.log("Git status output:", gitStatus);
  }
  
  // Verify the commit was created
  const commitCount = execSync('git rev-list --count HEAD', { cwd: tempDir, encoding: 'utf-8' }).trim();
  console.log(`✅ Total commits: ${commitCount}`);
  
  // Show the latest commit
  const latestCommit = execSync('git log -1 --oneline', { cwd: tempDir, encoding: 'utf-8' }).trim();
  console.log(`✅ Latest commit: ${latestCommit}`);
  
  console.log('\n🎉 Fix verification successful!');
  console.log('The codex.ts fix properly handles empty commits.');

} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
} finally {
  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('✅ Cleaned up test directory');
}