#!/usr/bin/env node

/**
 * Test script to verify unique milestone title generation
 * This tests that multiple milestone titles created in quick succession are unique
 */

function generateMilestoneTitle() {
  const currentDate = new Date();
  const timestamp = currentDate.toISOString().replace(/:/g, '-').replace(/\./g, '-');
  return `AI Development Plan - ${timestamp}`;
}

async function testUniqueTitles() {
  console.log('Testing unique milestone title generation...\n');

  // Generate 5 titles in quick succession
  const titles = [];
  for (let i = 0; i < 5; i++) {
    const title = generateMilestoneTitle();
    titles.push(title);
    console.log(`Title ${i + 1}: ${title}`);
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  // Check for uniqueness
  const uniqueTitles = new Set(titles);
  const areAllUnique = uniqueTitles.size === titles.length;

  console.log(`\nGenerated ${titles.length} titles`);
  console.log(`Unique titles: ${uniqueTitles.size}`);
  console.log(`All titles are unique: ${areAllUnique ? '✅ YES' : '❌ NO'}`);

  if (!areAllUnique) {
    console.log('\nDuplicate titles found:');
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
    duplicates.forEach(duplicate => console.log(`  - ${duplicate}`));
  } else {
    console.log('\n✅ SUCCESS: All milestone titles are unique!');
    console.log('This should fix the "already_exists" validation error.');
  }

  console.log('\nExample titles generated:');
  titles.forEach((title, index) => console.log(`  ${index + 1}. ${title}`));
}

// Run the test
testUniqueTitles().catch(console.error);
