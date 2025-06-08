// Test script for multi-repository command parsing and functionality
const { parseCommand } = require('./test-build/command-parser');

console.log('🧪 Testing Multi-Repository Command Parsing...\n');

// Test 1: Basic multi-plan command
console.log('Test 1: Basic multi-plan command');
const test1 = parseCommand('@l multi-plan repo1,repo2,repo3');
console.log('Input:', '@l multi-plan repo1,repo2,repo3');
console.log('Output:', JSON.stringify(test1, null, 2));
console.log('✅ Expected: isMultiRepoCommand=true, repositories=[{owner:"",repo:"repo1"},{owner:"",repo:"repo2"},{owner:"",repo:"repo3"}]');
console.log('');

// Test 2: Multi-plan with owner/repo format
console.log('Test 2: Multi-plan with owner/repo format');
const test2 = parseCommand('@l multi-plan owner1/repo1,owner2/repo2');
console.log('Input:', '@l multi-plan owner1/repo1,owner2/repo2');
console.log('Output:', JSON.stringify(test2, null, 2));
console.log('✅ Expected: isMultiRepoCommand=true, repositories=[{owner:"owner1",repo:"repo1"},{owner:"owner2",repo:"repo2"}]');
console.log('');

// Test 3: Mixed format
console.log('Test 3: Mixed format');
const test3 = parseCommand('@l multi-plan owner1/repo1,repo2,owner3/repo3');
console.log('Input:', '@l multi-plan owner1/repo1,repo2,owner3/repo3');
console.log('Output:', JSON.stringify(test3, null, 2));
console.log('✅ Expected: isMultiRepoCommand=true, mixed formats');
console.log('');

// Test 4: Aggregate command variant
console.log('Test 4: Aggregate command variant');
const test4 = parseCommand('@l aggregate repo-a,repo-b');
console.log('Input:', '@l aggregate repo-a,repo-b');
console.log('Output:', JSON.stringify(test4, null, 2));
console.log('✅ Expected: isMultiRepoCommand=true');
console.log('');

// Test 5: Single repo command (should not be multi-repo)
console.log('Test 5: Single repo command');
const test5 = parseCommand('@l plan');
console.log('Input:', '@l plan');
console.log('Output:', JSON.stringify(test5, null, 2));
console.log('✅ Expected: isMultiRepoCommand=false or undefined');
console.log('');

// Test 6: Invalid repository names
console.log('Test 6: Invalid repository names');
const test6 = parseCommand('@l multi-plan invalid..repo,valid-repo');
console.log('Input:', '@l multi-plan invalid..repo,valid-repo');
console.log('Output:', JSON.stringify(test6, null, 2));
console.log('✅ Expected: only valid-repo should be parsed');
console.log('');

console.log('🎉 Multi-repository command parsing tests completed!');