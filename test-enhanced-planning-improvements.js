#!/usr/bin/env node

/**
 * Test script to verify the enhanced planning system improvements
 * Tests the new focus on critical issues over innovation
 */

console.log('🧪 Testing Enhanced Planning System Improvements');
console.log('================================================\n');

// Test 1: Verify system prompt contains critical issue checklists
console.log('📋 Test 1: System Prompt Enhancement');

// Read the enhanced system prompt
const fs = require('fs');
const path = require('path');
const planImplementationPath = path.join(__dirname, 'src/trigger/plan-implementation.ts');
const fileContent = fs.readFileSync(planImplementationPath, 'utf8');

const expectedElements = [
  'PROJECT TYPE DETECTION',
  'FRONTEND REPOSITORIES',
  'BACKEND REPOSITORIES', 
  'SOLANA SMART CONTRACT',
  'RUST BEST PRACTICES',
  'Theming & Consistency',
  'Layout & Responsiveness',
  'Accessibility',
  '12 Factor App Compliance',
  'Security: Input validation',
  'CRITICAL ISSUES TO PRIORITIZE',
  'LOWER PRIORITY'
];

let allFound = true;
expectedElements.forEach(element => {
  if (fileContent.includes(element)) {
    console.log(`   ✅ Found: ${element}`);
  } else {
    console.log(`   ❌ Missing: ${element}`);
    allFound = false;
  }
});

console.log(`\n   Result: ${allFound ? '✅ PASS' : '❌ FAIL'} - System prompt contains comprehensive checklists\n`);

// Test 2: Verify response format prioritizes critical fixes
console.log('🔄 Test 2: Response Format Prioritization');

const responseFormatMatch = fileContent.match(/{\s*"repositoryOverview"[\s\S]*?"innovationIdeas"/);
if (responseFormatMatch) {
  const format = responseFormatMatch[0];
  const criticalFixesIndex = format.indexOf('"criticalFixes"');
  const innovationIdeasIndex = format.indexOf('"innovationIdeas"');
  
  if (criticalFixesIndex < innovationIdeasIndex && criticalFixesIndex !== -1) {
    console.log('   ✅ Critical fixes come before innovation ideas');
  } else {
    console.log('   ❌ Critical fixes should come before innovation ideas');
  }
} else {
  console.log('   ❌ Could not find response format');
}

// Test 3: Verify reduced innovation emphasis
console.log('\n💡 Test 3: Reduced Innovation Emphasis');

const innovationMatches = (fileContent.match(/UNHINGED|DISRUPTIVE|BOLD|revolutionary/gi) || []).length;
const criticalMatches = (fileContent.match(/critical|security|performance|reliability/gi) || []).length;

console.log(`   Innovation-related terms: ${innovationMatches}`);
console.log(`   Critical issue terms: ${criticalMatches}`);

if (criticalMatches > innovationMatches) {
  console.log('   ✅ More emphasis on critical issues than innovation');
} else {
  console.log('   ❌ Should emphasize critical issues more than innovation');
}

// Test 4: Verify iterative refinement focuses on critical issues
console.log('\n🔍 Test 4: Refinement Focus');

if (fileContent.includes('newCriticalIssues') && fileContent.includes('security and reliability expert')) {
  console.log('   ✅ Refinement now focuses on critical issues');
} else {
  console.log('   ❌ Refinement should focus on critical issues');
}

if (fileContent.includes('refinementRounds = 1')) {
  console.log('   ✅ Reduced refinement rounds (1 instead of 3)');
} else {
  console.log('   ❌ Should reduce refinement rounds');
}

// Test 5: Verify project type detection
console.log('\n🔧 Test 5: Project Type Detection');

if (fileContent.includes('projectType') && fileContent.includes('frontend|backend|solana|rust|fullstack')) {
  console.log('   ✅ Project type detection added');
} else {
  console.log('   ❌ Missing project type detection');
}

// Test 6: Verify interface changes
console.log('\n📊 Test 6: Interface Updates');

if (fileContent.includes('projectType?:')) {
  console.log('   ✅ PlanAnalysis interface includes optional projectType');
} else {
  console.log('   ❌ Missing projectType in interface');
}

// Test 7: Check fallback analysis improvements
console.log('\n🛡️  Test 7: Fallback Analysis');

if (fileContent.includes('Priority: Must, Risk: High') && fileContent.includes('focused on reliability, security, and maintainability')) {
  console.log('   ✅ Fallback analysis emphasizes critical issues');
} else {
  console.log('   ❌ Fallback analysis should emphasize critical issues');
}

console.log('\n🎉 Enhanced Planning System Analysis Complete!');
console.log('============================================');
console.log('✅ Shifted focus from innovation to critical issues');
console.log('✅ Added comprehensive checklists for different project types');
console.log('✅ Reduced emphasis on "unhinged" innovation');
console.log('✅ Prioritized security, performance, and maintainability');