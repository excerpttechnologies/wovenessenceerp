/* Quick test of location mapping functionality */

import { normalizeLocationName, resolveLocation } from '../lib/locationMapping.js';

console.log('=== Testing Location Normalization ===\n');

const testCases = [
  'TEMPLE FABRICS, SILKS AND SAREES',
  'temple fabrics, silks and sarees',
  'Temple Fabrics, Silks & Sarees',
  'TEMPLE FABRICS  ,  SILKS AND SAREES',
  '  TEMPLE FABRICS, SILKS AND SAREES  ',
];

testCases.forEach(name => {
  console.log(`Input:      "${name}"`);
  console.log(`Normalized: "${normalizeLocationName(name)}"`);
  console.log('');
});

console.log('=== Testing Location Resolution ===\n');

// Mock V1 locations
const mockLocations = [
  {
    _id: '507f1f77bcf86cd799439012',
    name: 'TEMPLE FABRICS, SILKS & SAREES HSR',
    businessId: '507f1f77bcf86cd799439011',
  },
  {
    _id: '507f1f77bcf86cd799439013',
    name: 'TEMPLE FABRICS WAREHOUSE',
    businessId: '507f1f77bcf86cd799439011',
  },
  {
    _id: '507f1f77bcf86cd799439014',
    name: 'TEMPLE FABRICS JNR',
    businessId: '507f1f77bcf86cd799439011',
  },
];

const businessId = '507f1f77bcf86cd799439011';

async function testResolution() {
  const tests = [
    'TEMPLE FABRICS, SILKS AND SAREES',
    'temple fabrics, silks and sarees',
    'TEMPLE FABRICS, SILKS & SAREES HSR',
    'UNKNOWN LOCATION',
    'TEMPLE FABRICS', // Should be ambiguous
  ];
  
  for (const v0Name of tests) {
    console.log(`Testing: "${v0Name}"`);
    const result = await resolveLocation(v0Name, businessId, mockLocations, {
      fuzzyThreshold: 0.85,
    });
    
    console.log(`  Match Type: ${result.matchType}`);
    console.log(`  Confidence: ${result.confidence}`);
    if (result.location) {
      console.log(`  ✓ Resolved to: "${result.v1Name}"`);
      console.log(`    Location ID: ${result.location._id}`);
    } else {
      console.log(`  ✗ Not resolved`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
      if (result.candidates) {
        console.log(`    Candidates: ${result.candidates.map(c => c.name).join(', ')}`);
      }
    }
    console.log('');
  }
}

testResolution().then(() => {
  console.log('Test complete!');
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
