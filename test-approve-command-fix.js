// Test script to verify the approve command fix
const { parseCommand, getTaskType } = require('./src/lib/command-parser');

console.log('Testing @l approve command routing fix\n');

// Test cases that should route to plan-approval-task
const approvalTests = [
  '@l approve',
  '@l yes',
  '@l y',
  '@l ok',
  '@l okay',
  '@l i approve',
  '@l APPROVE',     // uppercase
  '@l  approve',    // extra space
  '@l approve ',    // trailing space
  '@l approve\n',   // with newline
];

console.log('=== APPROVAL COMMAND TESTS ===\n');

approvalTests.forEach(test => {
  const parsed = parseCommand(test);
  const taskType = getTaskType(parsed);
  
  console.log(`Input: "${test}"`);
  console.log(`Parsed:`, JSON.stringify(parsed, null, 2));
  console.log(`Task type: ${taskType}`);
  console.log(`Expected: plan-approval-task`);
  console.log(`Result: ${taskType === 'plan-approval-task' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('---\n');
});

// Test cases that should NOT route to plan-approval-task
const nonApprovalTests = [
  '@l plan',
  '@l codex',
  '@l review',
  '@l approves',    // not exact match
  '@l approval',    // not exact match
  '@l not approve',
];

console.log('=== NON-APPROVAL COMMAND TESTS ===\n');

nonApprovalTests.forEach(test => {
  const parsed = parseCommand(test);
  const taskType = getTaskType(parsed);
  
  console.log(`Input: "${test}"`);
  console.log(`Task type: ${taskType}`);
  console.log(`Should NOT be: plan-approval-task`);
  console.log(`Result: ${taskType !== 'plan-approval-task' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('---\n');
});

// Summary
console.log('\n=== TEST SUMMARY ===');
console.log('The fix adds:');
console.log('1. Debug logging to trace command processing');
console.log('2. Better whitespace handling');
console.log('3. Edge case handling for approval patterns');
console.log('4. Webhook-level debugging');
console.log('\nWith these changes, "@l approve" should correctly route to plan-approval-task');
console.log('instead of codex-task (devving mode).');