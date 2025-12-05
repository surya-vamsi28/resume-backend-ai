require('dotenv').config();

const key = process.env.FIREBASE_PRIVATE_KEY;

console.log('--- Debugging FIREBASE_PRIVATE_KEY ---');

if (!key) {
  console.error('ERROR: FIREBASE_PRIVATE_KEY is undefined or empty.');
  process.exit(1);
}

console.log(`Length: ${key.length}`);
console.log(`Starts with correct header: ${key.startsWith('-----BEGIN PRIVATE KEY-----')}`);
console.log(`Ends with correct footer: ${key.endsWith('-----END PRIVATE KEY-----')}`);

const hasLiteralSlashN = key.includes('\\n');
const hasRealNewline = key.includes('\n');

console.log(`Contains literal "\\n": ${hasLiteralSlashN}`);
console.log(`Contains real newline character: ${hasRealNewline}`);

// Check what happens after replacement
const replacedKey = key.replace(/\\n/g, '\n');
console.log(`After replace(/\\\\n/g, '\\n'):`);
console.log(`  Starts with header: ${replacedKey.startsWith('-----BEGIN PRIVATE KEY-----')}`);
console.log(`  Ends with footer: ${replacedKey.endsWith('-----END PRIVATE KEY-----')}`);
console.log(`  Contains real newline: ${replacedKey.includes('\n')}`);

// Check for surrounding quotes that might have been included in the value
if (key.startsWith('"') || key.startsWith("'")) {
  console.warn('WARNING: The key seems to start with a quote character. Check if .env has extra quotes.');
}

console.log('Last 50 characters:');
console.log(JSON.stringify(key.slice(-50)));

