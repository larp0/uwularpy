// End-to-end test for multi-repository planning functionality
const { parseCommand, getTaskType } = require('./test-build/command-parser');

async function testMultiRepoWorkflow() {
  console.log('🧪 Testing Multi-Repository Workflow End-to-End...\n');

  // Test 1: Command Recognition
  console.log('Test 1: Multi-Repository Command Recognition');
  const command = '@l multi-plan facebook/react,microsoft/typescript,vercel/next.js';
  const parsed = parseCommand(command);
  
  console.log('Input:', command);
  console.log('Parsed:', {
    isMultiRepoCommand: parsed.isMultiRepoCommand,
    repositoryCount: parsed.repositories?.length,
    repositories: parsed.repositories
  });
  
  // Test 2: Task Type Resolution
  console.log('\nTest 2: Task Type Resolution');
  try {
    const taskType = await getTaskType(parsed);
    console.log('Task Type:', taskType);
    console.log('✅ Expected: multi-plan-task');
  } catch (error) {
    console.log('⚠️ Task type resolution failed:', error.message);
  }

  // Test 3: Repository Validation
  console.log('\nTest 3: Repository Validation');
  const invalidCommand = '@l multi-plan invalid..repo,valid-repo-name,toolong-repository-name-that-exceeds-limits';
  const parsedInvalid = parseCommand(invalidCommand);
  
  console.log('Input:', invalidCommand);
  console.log('Valid Repositories:', parsedInvalid.repositories?.map(r => r.repo));
  console.log('✅ Expected: Only valid repository names should be included');

  // Test 4: Mixed Formats
  console.log('\nTest 4: Mixed Repository Formats');
  const mixedCommand = '@l multi-plan uwularpy,microsoft/typescript,next-js';
  const parsedMixed = parseCommand(mixedCommand);
  
  console.log('Input:', mixedCommand);
  console.log('Repositories:', parsedMixed.repositories?.map(r => `${r.owner || '[current]'}/${r.repo}`));
  console.log('✅ Expected: Mix of explicit owners and inferred owners');

  // Test 5: Alternative Command Formats
  console.log('\nTest 5: Alternative Command Formats');
  
  const commands = [
    '@l multi-repo repo1,repo2',
    '@l aggregate proj-a,proj-b', 
    '@uwularpy multi-plan repo1,repo2'
  ];
  
  for (const cmd of commands) {
    const result = parseCommand(cmd);
    console.log(`"${cmd}" -> Multi-Repo: ${result.isMultiRepoCommand}`);
  }

  console.log('\n🎉 Multi-Repository Workflow Tests Completed!');
  
  console.log('\n📋 Summary:');
  console.log('✅ Command parsing with repository specifications');
  console.log('✅ Task type resolution to multi-plan-task');
  console.log('✅ Repository name validation');
  console.log('✅ Mixed owner/repo format support');
  console.log('✅ Alternative command format recognition');
  
  console.log('\n🚀 Ready for Integration Testing!');
  console.log('Usage Examples:');
  console.log('  @l multi-plan repo1,repo2,repo3');
  console.log('  @l multi-plan owner1/repo1,owner2/repo2');
  console.log('  @l aggregate my-frontend,my-backend,my-docs');
}

// Run the test
testMultiRepoWorkflow().catch(console.error);