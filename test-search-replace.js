const fs = require('fs');
const path = require('path');

// Read the input files
const inputTextPath = 'simple-changes.txt';
const inputText = fs.readFileSync(inputTextPath, 'utf-8');
const targetDir = '.'; // Current directory

// Core search-replace function
function processSearchReplaceBlocks(text, dir) {
  const changes = [];
  
  console.log("Processing search-replace blocks");
  
  // Find all search-replace blocks
  const searchReplaceRegex = /```search-replace\n([\s\S]*?)```/g;
  let match;
  
  while ((match = searchReplaceRegex.exec(text)) !== null) {
    const block = match[1];
    console.log("Found block:", block.substring(0, 50) + "...");
    
    // Extract file path
    const fileMatch = block.match(/FILE:\s*(.*)/);
    if (!fileMatch) {
      console.log("No file path found in block");
      continue;
    }
    
    const filePath = path.join(dir, fileMatch[1].trim());
    console.log("Target file:", filePath);
    
    if (!fs.existsSync(filePath)) {
      console.log("Target file does not exist:", filePath);
      changes.push({ file: fileMatch[1].trim(), applied: false });
      continue;
    }
    
    // Find all SEARCH/REPLACE operations
    const operationRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    let fileContent = fs.readFileSync(filePath, "utf-8");
    console.log("Original file content:", fileContent);
    
    let operationMatch;
    let fileModified = false;
    
    while ((operationMatch = operationRegex.exec(block)) !== null) {
      const searchText = operationMatch[1];
      const replaceText = operationMatch[2];
      
      console.log("Search text:", searchText);
      console.log("Replace text:", replaceText);
      
      if (fileContent.includes(searchText)) {
        console.log("Match found in file!");
        fileContent = fileContent.replace(searchText, replaceText);
        fileModified = true;
      } else {
        console.log("Search text not found in file!");
      }
    }
    
    if (fileModified) {
      console.log("Writing modified content to file...");
      console.log("New content:", fileContent);
      fs.writeFileSync(filePath, fileContent, "utf-8");
      changes.push({ file: fileMatch[1].trim(), applied: true });
    } else {
      changes.push({ file: fileMatch[1].trim(), applied: false });
    }
  }
  
  return changes;
}

// Run the processor
const changes = processSearchReplaceBlocks(inputText, targetDir);
console.log("Applied changes:", changes);
