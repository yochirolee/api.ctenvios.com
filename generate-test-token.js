/**
 * Quick script to generate a JWT token for Artillery testing
 * Run: node generate-test-token.js
 */

const jwt = require('jsonwebtoken');

// Get JWT secret from environment or use a default
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// You can change these values based on your test user
const payload = {
  id: "uQImPtS41N0AWPfLJKXUYALHHYas07w9", // Your user ID
  agency_id: 1,
  role: "ROOT"
};

// Generate token that expires in 24 hours
const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

console.log('\n🔐 Generated JWT Token for Artillery Testing\n');
console.log('Token:', token);
console.log('\n📝 Copy the token above and paste it in your Artillery YAML files:');
console.log('   File: artillery-test.yml (line 7)');
console.log('   File: artillery-light.yml (line 7)');
console.log('   File: artillery-ultra.yml (line 7)');
console.log('   File: artillery-endurance.yml (line 7)');
console.log('   File: artillery-spike.yml (line 7)');
console.log('\n   Replace the line:');
console.log('   Authorization: "Bearer OLD_TOKEN"');
console.log('\n   With:');
console.log(`   Authorization: "Bearer ${token}"`);
console.log('\n✅ Token expires in 24 hours\n');

