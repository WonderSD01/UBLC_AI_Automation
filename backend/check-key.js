// check-key.js - Verify private key format
require('dotenv').config();

console.log('🔐 Checking Private Key Format\n');
console.log('='.repeat(60));

const privateKey = process.env.GOOGLE_PRIVATE_KEY;

if (!privateKey) {
  console.error('❌ GOOGLE_PRIVATE_KEY is not set');
  process.exit(1);
}

console.log('📊 Key Length:', privateKey.length, 'characters');
console.log('\n📝 First 100 characters:');
console.log(privateKey.substring(0, 100));
console.log('\n📝 Last 100 characters:');
console.log(privateKey.substring(privateKey.length - 100));

console.log('\n🔍 Checking for common issues:');

// Check 1: Should start with -----BEGIN PRIVATE KEY-----
if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
  console.log('❌ Missing "-----BEGIN PRIVATE KEY-----" header');
} else {
  console.log('✅ Has correct BEGIN header');
}

// Check 2: Should end with -----END PRIVATE KEY-----
if (!privateKey.includes('-----END PRIVATE KEY-----')) {
  console.log('❌ Missing "-----END PRIVATE KEY-----" footer');
} else {
  console.log('✅ Has correct END footer');
}

// Check 3: Check for escaped newlines
if (privateKey.includes('\\n')) {
  console.log('✅ Has escaped newlines (\\n)');
} else {
  console.log('⚠️  No escaped newlines found (should have \\n)');
}

// Check 4: Check for actual newlines
if (privateKey.includes('\n')) {
  console.log('⚠️  Has actual newlines (should use \\n instead)');
} else {
  console.log('✅ No actual newlines (good for .env file)');
}

// Check 5: Check for surrounding quotes
if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
  console.log('✅ Has surrounding quotes (correct for .env)');
} else {
  console.log('⚠️  Missing surrounding quotes (should be in quotes for .env)');
}

console.log('\n' + '='.repeat(60));
console.log('\n💡 Fixing instructions:');

// Show what a correct key looks like
console.log('\n✅ CORRECT FORMAT example:');
console.log('GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG...\\n-----END PRIVATE KEY-----\\n"');

console.log('\n❌ WRONG FORMAT example:');
console.log('GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG...\n-----END PRIVATE KEY-----\n');

console.log('\n🔄 Try regenerating your service account key:');
console.log('1. Go to https://console.cloud.google.com/');
console.log('2. IAM & Admin → Service Accounts');
console.log('3. Click your service account');
console.log('4. Keys → Add Key → Create new key → JSON');
console.log('5. Copy the "private_key" value from the JSON');
console.log('6. Replace in .env with proper formatting');