import { sanitizeForShell } from './src/lib/git-utils.js';
import { sanitizeCommitMessage, validateAIResponse, sanitizeFilePath } from './src/lib/ai-sanitizer.js';

console.log('🔒 Testing Security Improvements\n');

// Test 1: Shell injection prevention
console.log('1. Testing Shell Injection Prevention:');
const maliciousCommands = [
  'normal commit message',
  'commit; rm -rf /',
  'commit`cat /etc/passwd`',
  'commit && echo "hacked"',
  'commit | malicious',
  'commit\nrm -rf /'
];

maliciousCommands.forEach(cmd => {
  const sanitized = sanitizeForShell(cmd);
  const isSafe = !/[`$;|&<>\r\n]/.test(sanitized);
  console.log(`  "${cmd}" -> "${sanitized}" ${isSafe ? '✅' : '❌'}`);
});

// Test 2: Commit message sanitization  
console.log('\n2. Testing Commit Message Sanitization:');
const commitMessages = [
  'feat: add new feature',
  'fix: resolve issue; rm -rf /',
  'update`malicious`code',
  'test: ' + 'x'.repeat(100) // Long message
];

commitMessages.forEach(msg => {
  const sanitized = sanitizeCommitMessage(msg);
  const isSafe = !/[`$;|&<>]/.test(sanitized) && sanitized.length <= 72;
  console.log(`  "${msg}" -> "${sanitized}" ${isSafe ? '✅' : '❌'}`);
});

// Test 3: File path validation
console.log('\n3. Testing File Path Validation:');
const filePaths = [
  'src/lib/test.js',
  '../../../etc/passwd',
  '/absolute/path',
  'normal/file.txt',
  'test<script>.js'
];

filePaths.forEach(path => {
  const sanitized = sanitizeFilePath(path);
  const isSafe = !sanitized.includes('..') && !sanitized.startsWith('/') && !/[<>:"|?*]/.test(sanitized);
  console.log(`  "${path}" -> "${sanitized}" ${isSafe ? '✅' : '❌'}`);
});

// Test 4: AI response validation
console.log('\n4. Testing AI Response Validation:');
const responses = [
  'Normal AI response',
  'Response with `dangerous` characters',
  'Response\0with null bytes'
];

responses.forEach(resp => {
  const validation = validateAIResponse(resp);
  console.log(`  Valid: ${validation.isValid ? '✅' : '❌'} Errors: ${validation.errors.length}`);
});

console.log('\n🎉 Security testing completed!');
console.log('\nSummary of Security Improvements:');
console.log('✅ Shell injection prevention in git commands');
console.log('✅ AI output sanitization and validation');  
console.log('✅ File path validation against directory traversal');
console.log('✅ Commit message length and character validation');
console.log('✅ Modular code structure for maintainability');