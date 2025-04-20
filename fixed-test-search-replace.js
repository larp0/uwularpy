const fs = require('fs');
const path = require('path');

// Allow input file as command line argument or use default
const inputTextPath = process.argv[2] || 'simple-changes.txt';
const targetDir = '.'; // Current directory

// Read the input file
console.log(`Reading from file: ${inputTextPath}`);
const inputText = fs.readFileSync(inputTextPath, 'utf-8');

// Core search-replace function
function processSearchReplaceBlocks(text, dir) {
  const changes = [];
  
  console.log("Processing search-replace blocks");
  
  // Find all search-replace blocks
  const searchReplaceRegex = /```search-replace\n([\s\S]*?)```/g;
  let match;
  
  while ((match = searchReplaceRegex.exec(text)) !== null) {
    const block = match[1];
    console.log(`Found block: ${block.substring(0, 50)}...`);
    
    // Extract file path
    const fileMatch = block.match(/FILE:\s*(.*)/);
    if (!fileMatch) {
      console.log("No file path found in block");
      continue;
    }
    
    const filePath = path.join(dir, fileMatch[1].trim());
    console.log(`Target file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`Target file does not exist: ${filePath}`);
      changes.push({ file: fileMatch[1].trim(), applied: false, reason: "file_not_found" });
      continue;
    }
    
    // Find all SEARCH/REPLACE operations
    const operationRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let fileContent = fs.readFileSync(filePath, "utf-8");
    console.log(`File content length: ${fileContent.length} bytes`);
    
    let operationMatch;
    let fileModified = false;
    
    while ((operationMatch = operationRegex.exec(block)) !== null) {
      const searchText = operationMatch[1];
      const replaceText = operationMatch[2];
      
      console.log(`Search text (${searchText.length} bytes):\n${searchText}`);
      console.log(`Replace text (${replaceText.length} bytes):\n${replaceText}`);
      
      // Check exact match
      if (fileContent.includes(searchText)) {
        console.log("Exact match found in file!");
        fileContent = fileContent.replace(searchText, replaceText);
        fileModified = true;
      } else {
        console.log("Exact search text not found in file!");
        
        // Debugging: check if there's a similar but not exact match
        const searchLines = searchText.split('\n');
        const fileLines = fileContent.split('\n');
        
        let foundSimilar = false;
        for (let i = 0; i <= fileLines.length - searchLines.length; i++) {
          let matchCount = 0;
          for (let j = 0; j < searchLines.length; j++) {
            if (fileLines[i + j].trim() === searchLines[j].trim()) {
              matchCount++;
            }
          }
          
          if (matchCount > 0) {
            console.log(`Found ${matchCount}/${searchLines.length} similar lines at position ${i}`);
            foundSimilar = true;
            
            // Log the differences in context
            console.log("Context in file:");
            for (let j = Math.max(0, i - 1); j < Math.min(fileLines.length, i + searchLines.length + 1); j++) {
              console.log(`${j}: ${fileLines[j]}`);
            }
            
            console.log("Expected search text:");
            searchLines.forEach((line, idx) => {
              console.log(`${idx}: ${line}`);
            });
            
            break;
          }
        }
        
        if (!foundSimilar) {
          console.log("No similar lines found in file");
        }
      }
    }
    
    if (fileModified) {
      console.log("Writing modified content to file...");
      fs.writeFileSync(filePath, fileContent, "utf-8");
      changes.push({ file: fileMatch[1].trim(), applied: true });
    } else {
      changes.push({ file: fileMatch[1].trim(), applied: false, reason: "no_match" });
    }
  }
  
  return changes;
}

// Run the processor
const changes = processSearchReplaceBlocks(inputText, targetDir);
console.log("Applied changes:", changes);
