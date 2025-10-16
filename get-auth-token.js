/**
 * Helper script to get a JWT token for Artillery testing
 * Run: node get-auth-token.js
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔐 JWT Token Retriever for Artillery Testing\n');
console.log('Option 1: Get token from your application');
console.log('  1. Log in to your application');
console.log('  2. Open Developer Tools (F12)');
console.log('  3. Go to Application > Local Storage');
console.log('  4. Find your JWT token (usually under "token" or "auth_token")');
console.log('  5. Copy the token value\n');

console.log('Option 2: Use your database to get a user ID and generate manually');
console.log('  Run this in your Node.js environment:');
console.log('  ```javascript');
console.log('  const jwt = require("jsonwebtoken");');
console.log('  const token = jwt.sign(');
console.log('    { id: "YOUR_USER_ID", agency_id: 1, role: "AGENCY_ADMIN" },');
console.log('    process.env.JWT_SECRET || "your-secret-key",');
console.log('    { expiresIn: "24h" }');
console.log('  );');
console.log('  console.log(token);');
console.log('  ```\n');

rl.question('Paste your JWT token here: ', (token) => {
  if (token && token.trim().length > 0) {
    console.log('\n✅ Token received! Length:', token.trim().length);
    console.log('\n📝 To use this token in Artillery:');
    console.log('   1. Open artillery-light.yml or artillery-test.yml');
    console.log('   2. Find the line: Authorization: "Bearer YOUR_JWT_TOKEN_HERE"');
    console.log('   3. Replace YOUR_JWT_TOKEN_HERE with your token');
    console.log('\n   Full line should look like:');
    console.log(`   Authorization: "Bearer ${token.trim().substring(0, 20)}..."\n`);
  } else {
    console.log('\n❌ No token provided');
  }
  rl.close();
});

