#!/usr/bin/env node

/**
 * Debug script to test milestone pattern matching.
 * This helps diagnose why milestones "can't be found if they're there".
 */

import { testMilestonePatterns } from '../src/lib/milestone-finder.js';

console.log('🔍 Testing Milestone Pattern Matching\n');

// Sample texts that might contain milestone references
const testTexts = [
  // Standard GitHub milestone URL
  'Check out this milestone: https://github.com/larp0/uwularpy/milestone/5',
  
  // Relative URL
  'See /larp0/uwularpy/milestone/3 for details',
  
  // Simple reference
  'This is for milestone #7',
  'Working on milestone 12',
  'milestone: 8',
  
  // Markdown link
  'Progress tracked in [Development Milestone](https://github.com/larp0/uwularpy/milestone/9)',
  
  // GitHub notifications style
  'created milestone "Bug Fixes" #4',
  'assigned to milestone #15',
  
  // Mixed content
  'Planning phase complete! 🎉\n\nNext up: https://github.com/larp0/uwularpy/milestone/6\n\nLet me know if you need help.',
  
  // Edge cases
  'milestone',
  'milestone #',
  'milestone 0',
  'milestone abc',
  'not a milestone reference',
  
  // Real-world example
  `✅ **Development Plan Created**

I've created a comprehensive development plan for your uwularpy project:

📋 **Milestone: Enhanced Feature Set** 
🔗 https://github.com/larp0/uwularpy/milestone/42

This milestone includes:
- Performance improvements 
- New API endpoints
- Enhanced security features

Ready to proceed with implementation!`
];

testTexts.forEach((text, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  console.log(`Text: "${text.length > 100 ? text.substring(0, 100) + '...' : text}"`);
  
  const results = testMilestonePatterns(text);
  const hasMatches = results.some(r => r.matches.length > 0);
  
  if (hasMatches) {
    console.log('✅ FOUND MATCHES:');
    results.forEach(result => {
      if (result.matches.length > 0) {
        console.log(`  ${result.pattern}: ${result.matches.join(', ')}`);
      }
    });
  } else {
    console.log('❌ NO MATCHES FOUND');
  }
});

console.log('\n🎯 Pattern Summary:');
console.log('If milestones exist but cannot be found, check:');
console.log('1. Bot username configuration (should be "l" not "uwularpy"?)');
console.log('2. Comment search depth (default 200 comments)');
console.log('3. Comment author filtering (bot users only vs all users)');
console.log('4. Milestone URL format in actual comments');
console.log('5. API permissions for milestone access');

console.log('\n🔧 Potential Fixes:');
console.log('- Use enhanced milestone finder with debug mode');
console.log('- Search comments from all users, not just bot');
console.log('- Increase comment search depth');
console.log('- Add fallback to search milestones by date');
console.log('- Verify bot username in workflow constants');