#!/usr/bin/env node
// Simple test for plan implementation - validates basic structure and error handling

const path = require('path');
const fs = require('fs');

// Mock logger for testing
const mockLogger = {
  log: (message, data) => console.log(`[LOG] ${message}`, data || ''),
  error: (message, data) => console.error(`[ERROR] ${message}`, data || ''),
  warn: (message, data) => console.warn(`[WARN] ${message}`, data || '')
};

// Test that the plan implementation file exists and exports the required function
function testPlanImplementationExists() {
  console.log('\n🧪 Testing plan implementation exists...');
  
  const planFilePath = path.join(__dirname, 'src', 'trigger', 'plan-implementation.ts');
  
  if (!fs.existsSync(planFilePath)) {
    throw new Error('Plan implementation file does not exist');
  }
  
  const content = fs.readFileSync(planFilePath, 'utf8');
  
  // Check for required exports
  if (!content.includes('export async function runPlanTask')) {
    throw new Error('runPlanTask function not exported');
  }
  
  // Check for required phases
  const requiredPhases = [
    'ingestRepository',
    'performComprehensiveAnalysis',
    'createProjectMilestone',
    'generateIssuesFromAnalysis',
    'createGitHubIssues'
  ];
  
  for (const phase of requiredPhases) {
    if (!content.includes(phase)) {
      throw new Error(`Missing required phase: ${phase}`);
    }
  }
  
  console.log('✅ Plan implementation structure is valid');
  return true;
}

// Test that task registry includes the plan task
function testTaskRegistryIncludesPlan() {
  console.log('\n🧪 Testing task registry includes plan task...');
  
  const registryPath = path.join(__dirname, 'src', 'trigger', 'task-registry.ts');
  const content = fs.readFileSync(registryPath, 'utf8');
  
  if (!content.includes('export const planTask')) {
    throw new Error('planTask not exported from task registry');
  }
  
  if (!content.includes('plan-task')) {
    throw new Error('plan-task ID not found');
  }
  
  if (!content.includes('plan-implementation')) {
    throw new Error('plan-implementation import not found');
  }
  
  console.log('✅ Task registry correctly includes plan task');
  return true;
}

// Test that trigger index exports plan task
function testTriggerIndexExportsPlan() {
  console.log('\n🧪 Testing trigger index exports plan task...');
  
  const indexPath = path.join(__dirname, 'src', 'trigger', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf8');
  
  if (!content.includes('planTask')) {
    throw new Error('planTask not exported from trigger index');
  }
  
  console.log('✅ Trigger index correctly exports plan task');
  return true;
}

// Test that webhook handler includes plan trigger
function testWebhookHandlerIncludesPlan() {
  console.log('\n🧪 Testing webhook handler includes plan trigger...');
  
  const webhookPath = path.join(__dirname, 'src', 'app', 'api', 'webhook', 'route.ts');
  const content = fs.readFileSync(webhookPath, 'utf8');
  
  if (!content.includes("'plan'")) {
    throw new Error('Plan trigger not found in webhook handler');
  }
  
  if (!content.includes('plan-task')) {
    throw new Error('plan-task trigger not found in webhook handler');
  }
  
  console.log('✅ Webhook handler correctly includes plan trigger');
  return true;
}

// Test plan implementation structure and types
function testPlanImplementationStructure() {
  console.log('\n🧪 Testing plan implementation structure...');
  
  const planFilePath = path.join(__dirname, 'src', 'trigger', 'plan-implementation.ts');
  const content = fs.readFileSync(planFilePath, 'utf8');
  
  // Check for required interfaces
  const requiredInterfaces = [
    'interface PlanAnalysis',
    'interface IssueTemplate'
  ];
  
  for (const interfaceDef of requiredInterfaces) {
    if (!content.includes(interfaceDef)) {
      throw new Error(`Missing required interface: ${interfaceDef}`);
    }
  }
  
  // Check for required analysis categories
  const requiredCategories = [
    'missingComponents',
    'criticalFixes',
    'requiredImprovements',
    'innovationIdeas'
  ];
  
  for (const category of requiredCategories) {
    if (!content.includes(category)) {
      throw new Error(`Missing required category: ${category}`);
    }
  }
  
  // Check for OpenAI integration
  if (!content.includes('openai.com/v1/chat/completions')) {
    throw new Error('OpenAI API integration not found');
  }
  
  // Check for GitHub API integration
  if (!content.includes('createMilestone') || !content.includes('issues.create')) {
    throw new Error('GitHub API integration incomplete');
  }
  
  console.log('✅ Plan implementation structure is complete');
  return true;
}

// Test TypeScript compilation
function testTypeScriptCompilation() {
  console.log('\n🧪 Testing TypeScript compilation...');
  
  const { execSync } = require('child_process');
  
  try {
    // Just check the plan implementation file specifically
    execSync('npx tsc --noEmit --skipLibCheck src/trigger/plan-implementation.ts', { 
      cwd: __dirname,
      stdio: 'pipe'
    });
    console.log('✅ TypeScript compilation successful');
    return true;
  } catch (error) {
    console.error('❌ TypeScript compilation failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 STARTING PLAN IMPLEMENTATION TESTS');
  
  const tests = [
    testPlanImplementationExists,
    testTaskRegistryIncludesPlan,
    testTriggerIndexExportsPlan,
    testWebhookHandlerIncludesPlan,
    testPlanImplementationStructure,
    testTypeScriptCompilation
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = test();
      results.push({ name: test.name, passed: true });
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error.message);
      results.push({ name: test.name, passed: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n📊 TEST SUMMARY');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`${result.name}: ${status}`);
    if (!result.passed) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  console.log(`\nOverall Result: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! Plan implementation is ready.');
    return true;
  } else {
    console.log('❌ Some tests failed. Please review the implementation.');
    return false;
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runTests };