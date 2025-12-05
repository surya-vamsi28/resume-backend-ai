require('dotenv').config();

const rawKey = process.env.FIREBASE_PRIVATE_KEY;

console.log('Original key length:', rawKey.length);

// Proposed fix:
// 1. Replace literal "\n" with real newline (existing logic)
// 2. Remove any remaining backslashes (new logic)
const fixedKey = rawKey.replace(/\\n/g, '\n').replace(/\\/g, '');

console.log('Fixed key length:', fixedKey.length);
console.log('Starts with header:', fixedKey.startsWith('-----BEGIN PRIVATE KEY-----'));
console.log('Ends with footer:', fixedKey.trim().endsWith('-----END PRIVATE KEY-----'));

// Check if it looks like valid PEM
const lines = fixedKey.split('\n');
console.log('Number of lines:', lines.length);
console.log('First line:', lines[0]);
console.log('Last line:', lines[lines.length - 1]);

// Try to parse it with firebase-admin logic (simulated)
try {
  // Just checking if it looks sane, we can't fully parse without crypto
  if (fixedKey.includes('-----BEGIN PRIVATE KEY-----') && fixedKey.includes('-----END PRIVATE KEY-----')) {
    console.log('SUCCESS: Key looks valid after fix.');
  } else {
    console.error('FAILURE: Key still looks invalid.');
  }
} catch (e) {
  console.error('Error:', e);
}
