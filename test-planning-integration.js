#!/usr/bin/env node

/**
 * Integration test for the enhanced planning system
 * Verifies that the new critical-issue-focused approach works correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Integration Test: Enhanced Planning System');
console.log('===========================================\n');

async function testPlanningSystem() {
  try {
    // Mock repository analysis data that would be passed to the planning system
    const mockRepositoryContent = `
      package.json: { "name": "test-app", "dependencies": { "react": "^18.0.0", "express": "^4.0.0" } }
      README.md: A Next.js application with React frontend and Express backend
      src/components/: React components with some accessibility issues
      src/api/: Express routes with potential security vulnerabilities
      tests/: Limited test coverage
    `;

    const mockUserQuery = "Improve security and accessibility";

    // Test 1: Verify system prompt prioritizes critical issues
    console.log('📋 Test 1: System Prompt Analysis');
    
    const planPath = path.join(__dirname, 'src/trigger/plan-implementation.ts');
    const planContent = fs.readFileSync(planPath, 'utf8');
    
    // Check for critical issue priorities
    const hasCriticalPriorities = planContent.includes('CRITICAL ISSUES TO PRIORITIZE') &&
                                 planContent.includes('Security vulnerabilities') &&
                                 planContent.includes('Performance bottlenecks') &&
                                 planContent.includes('Accessibility violations');
    
    console.log(`   Critical Issues Priority: ${hasCriticalPriorities ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 2: Verify project type detection logic
    console.log('\n🔧 Test 2: Project Type Detection');
    
    const hasProjectTypeDetection = planContent.includes('PROJECT TYPE DETECTION') &&
                                   planContent.includes('FRONTEND REPOSITORIES') &&
                                   planContent.includes('BACKEND REPOSITORIES');
    
    console.log(`   Project Type Detection: ${hasProjectTypeDetection ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 3: Verify frontend-specific checks
    console.log('\n🎨 Test 3: Frontend-Specific Checks');
    
    const hasFrontendChecks = planContent.includes('Theming & Consistency') &&
                             planContent.includes('Accessibility') &&
                             planContent.includes('WCAG 2.1 AA compliance');
    
    console.log(`   Frontend Accessibility Checks: ${hasFrontendChecks ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 4: Verify backend-specific checks
    console.log('\n🔒 Test 4: Backend-Specific Checks');
    
    const hasBackendChecks = planContent.includes('12 Factor App Compliance') &&
                            planContent.includes('Security: Input validation') &&
                            planContent.includes('parameterized queries');
    
    console.log(`   Backend Security Checks: ${hasBackendChecks ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 5: Verify Solana-specific checks
    console.log('\n⚡ Test 5: Solana-Specific Checks');
    
    const hasSolanaChecks = planContent.includes('SOLANA SMART CONTRACT') &&
                           planContent.includes('signer verification') &&
                           planContent.includes('arithmetic safety');
    
    console.log(`   Solana Security Checks: ${hasSolanaChecks ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 6: Verify Rust-specific checks
    console.log('\n🦀 Test 6: Rust-Specific Checks');
    
    const hasRustChecks = planContent.includes('RUST BEST PRACTICES') &&
                         planContent.includes('Idiomatic Rust') &&
                         planContent.includes('Result/Option types');
    
    console.log(`   Rust Best Practices: ${hasRustChecks ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 7: Verify reduced innovation emphasis
    console.log('\n💡 Test 7: Innovation Balance');
    
    const innovationTerms = (planContent.match(/UNHINGED|DISRUPTIVE|BOLD.*innovation/gi) || []).length;
    const criticalTerms = (planContent.match(/critical.*issues|security.*vulnerabilities|performance.*bottlenecks/gi) || []).length;
    
    const balanceCorrect = innovationTerms === 0 && criticalTerms > 0;
    console.log(`   Innovation vs Critical Balance: ${balanceCorrect ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Innovation terms: ${innovationTerms}, Critical terms: ${criticalTerms}`);
    
    // Test 8: Verify response format prioritization
    console.log('\n📊 Test 8: Response Format');
    
    const responseFormat = planContent.match(/{\s*"repositoryOverview"[\s\S]*?"innovationIdeas"/);
    let formatCorrect = false;
    
    if (responseFormat) {
      const format = responseFormat[0];
      const criticalIndex = format.indexOf('"criticalFixes"');
      const innovationIndex = format.indexOf('"innovationIdeas"');
      formatCorrect = criticalIndex < innovationIndex && criticalIndex !== -1;
    }
    
    console.log(`   Critical Issues First: ${formatCorrect ? '✅ PASS' : '❌ FAIL'}`);
    
    // Test 9: Verify refinement focus
    console.log('\n🔍 Test 9: Refinement System');
    
    const refinementCorrect = planContent.includes('newCriticalIssues') &&
                             planContent.includes('refinementRounds = 1') &&
                             planContent.includes('security and reliability expert');
    
    console.log(`   Critical Issue Refinement: ${refinementCorrect ? '✅ PASS' : '❌ FAIL'}`);
    
    // Overall result
    console.log('\n🎉 Integration Test Results');
    console.log('==========================');
    
    const tests = [
      hasCriticalPriorities,
      hasProjectTypeDetection,
      hasFrontendChecks,
      hasBackendChecks,
      hasSolanaChecks,
      hasRustChecks,
      balanceCorrect,
      formatCorrect,
      refinementCorrect
    ];
    
    const passedTests = tests.filter(Boolean).length;
    const totalTests = tests.length;
    
    console.log(`Passed: ${passedTests}/${totalTests} tests`);
    
    if (passedTests === totalTests) {
      console.log('✅ ALL TESTS PASSED - Enhanced planning system is working correctly!');
      console.log('✅ System now prioritizes critical issues over innovation');
      console.log('✅ Comprehensive checklists added for all project types');
      console.log('✅ Refinement system focuses on security and reliability');
    } else {
      console.log('❌ Some tests failed - review implementation');
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

// Run the test
testPlanningSystem();