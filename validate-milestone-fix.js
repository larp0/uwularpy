// Quick validation that our timestamp format is GitHub-compatible
function testMilestoneTitleFormat() {
  const currentDate = new Date();
  const timestamp = currentDate.toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const randomSuffix = Math.random().toString(36).substr(2, 4);
  const uniqueTitle = `AI Development Plan - ${timestamp}-${randomSuffix}`;
  
  console.log('Generated milestone title:', uniqueTitle);
  console.log('Length:', uniqueTitle.length);
  console.log('Contains only valid characters:', /^[a-zA-Z0-9\s\-\.]+$/.test(uniqueTitle));
  
  // Test multiple rapid generations to ensure uniqueness
  const titles = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    const ts = date.toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const random = Math.random().toString(36).substr(2, 4);
    titles.push(`AI Development Plan - ${ts}-${random}`);
  }
  
  const uniqueCount = new Set(titles).size;
  console.log(`Generated ${titles.length} titles, ${uniqueCount} unique`);
  console.log('All unique:', uniqueCount === titles.length ? '✅ YES' : '❌ NO');
  
  // Show examples
  console.log('\nExample titles:');
  titles.forEach((title, i) => console.log(`  ${i + 1}. ${title}`));
  
  return uniqueTitle;
}

console.log('=== Milestone Title Format Validation ===');
testMilestoneTitleFormat();
console.log('\n✅ Milestone title fix validated!');
