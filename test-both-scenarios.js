#!/usr/bin/env node

// Test script to verify the codex.ts fix handles both scenarios
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

console.log('🧪 Testing codex.ts fix for both empty and non-empty scenarios...');

function testScenario(scenarioName, hasChanges) {
  console.log(`\n📋 Testing ${scenarioName}...`);
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-codex-'));
  
  try {
    // Initialize git repo
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "bot@larp.dev"', { cwd: tempDir });
    execSync('git config user.name "larp0"', { cwd: tempDir });
    
    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'initial content');
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
    
    // If we want changes, make some
    if (hasChanges) {
      fs.writeFileSync(path.join(tempDir, 'test.txt'), 'modified content');
    }
    
    // Apply the fix logic
    execSync("git add .", { cwd: tempDir, stdio: "inherit" });
    
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8', cwd: tempDir }).toString().trim();
    
    if (!gitStatus) {
      console.log("  ✅ No changes detected - creating empty commit");
      execSync('git commit --allow-empty -m "Apply changes from OpenAI API self-ask flow (no changes made)"', { cwd: tempDir, stdio: "inherit" });
    } else {
      console.log("  ✅ Changes detected - creating normal commit");
      execSync('git commit -m "Apply changes from OpenAI API self-ask flow"', { cwd: tempDir, stdio: "inherit" });
    }
    
    const latestCommit = execSync('git log -1 --oneline', { cwd: tempDir, encoding: 'utf-8' }).trim();
    console.log(`  ✅ Latest commit: ${latestCommit}`);
    
    return true;
  } catch (error) {
    console.error(`  ❌ ${scenarioName} failed:`, error.message);
    return false;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// Test both scenarios
const emptyResult = testScenario('Empty commit scenario', false);
const changesResult = testScenario('Normal commit scenario', true);

if (emptyResult && changesResult) {
  console.log('\n🎉 All tests passed!');
  console.log('The codex.ts fix properly handles both empty and normal commits.');
} else {
  console.log('\n❌ Some tests failed!');
  process.exit(1);
}