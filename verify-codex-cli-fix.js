#!/usr/bin/env node

// Simple test to verify the updated codex CLI usage
const fs = require('fs');
const path = require('path');

// Read the codex.ts file and check the command construction
const codexFilePath = path.join(__dirname, 'src', 'lib', 'codex.ts');
const codexContent = fs.readFileSync(codexFilePath, 'utf-8');

console.log('🔍 Checking @openai/codex CLI command construction...');

// Extract the command construction part
const commandMatch = codexContent.match(/const command = \[([\s\S]*?)\];/);

if (!commandMatch) {
  console.error('❌ Could not find command array construction');
  process.exit(1);
}

const commandSection = commandMatch[1];
console.log('Found command construction:');
console.log('---');
console.log('const command = [' + commandSection + '];');
console.log('---');

// Check for correct components
const expectedComponents = [
  "'npx'",
  "'@openai/codex'", 
  "'exec'",
  "'--full-auto'",
  "'--cd'",
  "repoPath",
  "enhancedPrompt"
];

let allComponentsFound = true;
for (const component of expectedComponents) {
  if (!commandSection.includes(component)) {
    console.error(`❌ Missing expected component: ${component}`);
    allComponentsFound = false;
  } else {
    console.log(`✅ Found: ${component}`);
  }
}

if (allComponentsFound) {
  console.log('\n🎉 All expected command components are present!');
  console.log('✅ The @openai/codex CLI usage has been correctly updated');
} else {
  console.log('\n💥 Some command components are missing');
  process.exit(1);
}

// Also check if the old incorrect usage is removed
if (codexContent.includes('--approval-mode')) {
  console.error('❌ Old incorrect --approval-mode flag still present');
  process.exit(1);
} else {
  console.log('✅ Old incorrect --approval-mode flag has been removed');
}

console.log('\n✨ Command construction verification complete!');