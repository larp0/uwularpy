// Diagnostic script to troubleshoot why "@l approve" might still trigger codex-task

const { parseCommand, getTaskType } = require('./src/lib/command-parser');
const { classifyCommandIntent, intentToTaskType } = require('./src/lib/ai-command-parser');

async function diagnoseApproveCommand() {
  console.log('=== DIAGNOSTIC: "@l approve" Command Routing ===\n');
  
  // Check environment
  console.log('1. ENVIRONMENT CHECK:');
  console.log(`   OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   Node Version: ${process.version}`);
  console.log();
  
  // Test command parsing
  console.log('2. COMMAND PARSING TEST:');
  const testCommand = '@l approve';
  const parsed = parseCommand(testCommand);
  console.log(`   Input: "${testCommand}"`);
  console.log(`   Parsed:`, JSON.stringify(parsed, null, 2));
  console.log();
  
  // Test AI classification (if API key is set)
  if (process.env.OPENAI_API_KEY) {
    console.log('3. AI CLASSIFICATION TEST:');
    try {
      const classification = await classifyCommandIntent('approve', { recentMilestone: true });
      console.log(`   AI Classification:`, JSON.stringify(classification, null, 2));
      
      const mappedTask = intentToTaskType(classification.intent);
      console.log(`   Mapped Task Type: ${mappedTask}`);
    } catch (error) {
      console.log(`   ❌ AI Classification Error: ${error.message}`);
    }
    console.log();
  } else {
    console.log('3. AI CLASSIFICATION TEST: ⚠️ SKIPPED (No API Key)');
    console.log();
  }
  
  // Test task type determination
  console.log('4. TASK TYPE DETERMINATION:');
  try {
    const taskType = await getTaskType(parsed, { recentMilestone: true });
    console.log(`   Final Task Type: ${taskType}`);
    console.log(`   Expected: plan-approval-task`);
    console.log(`   Result: ${taskType === 'plan-approval-task' ? '✅ CORRECT' : '❌ INCORRECT'}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log();
  
  // Show decision flow
  console.log('5. DECISION FLOW:');
  console.log('   Command: "@l approve"');
  console.log('   ↓');
  console.log('   Parse: Extract "approve"');
  console.log('   ↓');
  if (process.env.OPENAI_API_KEY) {
    console.log('   AI: Classify intent');
    console.log('   ↓');
    console.log('   Map: intent → task type');
  } else {
    console.log('   Fallback: Pattern matching');
    console.log('   ↓');
    console.log('   Check: isApprovalCommand("approve")');
  }
  console.log('   ↓');
  console.log('   Result: Should be "plan-approval-task"');
  console.log();
  
  // Common issues
  console.log('6. COMMON ISSUES & SOLUTIONS:');
  console.log();
  console.log('   ❓ ISSUE: Still getting codex-task');
  console.log('   ✅ SOLUTIONS:');
  console.log('      1. Set OPENAI_API_KEY environment variable');
  console.log('      2. Restart/redeploy the application');
  console.log('      3. Check logs for AI classification errors');
  console.log('      4. Verify webhook is calling the updated code');
  console.log();
  console.log('   ❓ ISSUE: Changes not taking effect');
  console.log('   ✅ SOLUTIONS:');
  console.log('      1. Run: npm run build');
  console.log('      2. Deploy: trigger deploy');
  console.log('      3. Verify deployment completed successfully');
  console.log();
}

// Run diagnostics
diagnoseApproveCommand().catch(console.error);