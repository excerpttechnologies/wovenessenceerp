/* Location Mapping Diagnostic Tool

   This script helps discover V0 → V1 location mappings by analyzing:
   1. All V1 locations in the database
   2. Sample V0 location names from barcode imports
   3. Auto-matching results using the location mapping system
   
   Usage:
     node --env-file=.env scripts/diagnoseLocationMappings.mjs
   
   Or with specific V0 location names to test:
     node --env-file=.env scripts/diagnoseLocationMappings.mjs "TEMPLE FABRICS, SILKS AND SAREES" "ANOTHER LOCATION"
*/

import mongoose from 'mongoose';
import CompanyLocation from '../models/CompanyLocation.js';
import Business from '../models/Business.js';
import StockPoint from '../models/StockPoint.js';
import { resolveLocation, normalizeLocationName, generateMappingReport } from '../lib/locationMapping.js';

const uri = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB\n');
  
  // Get all businesses
  const businesses = await Business.find({}).select('name _id').lean();
  console.log('=== BUSINESSES IN V1 ===');
  businesses.forEach(b => {
    console.log(`  ${b.name} (${b._id})`);
  });
  console.log('');
  
  // Get all locations
  const locations = await CompanyLocation.find({}).select('name businessId _id').lean();
  console.log('=== LOCATIONS IN V1 ===');
  for (const loc of locations) {
    const biz = businesses.find(b => String(b._id) === String(loc.businessId));
    console.log(`  ${loc.name}`);
    console.log(`    ID: ${loc._id}`);
    console.log(`    Business: ${biz ? biz.name : 'Unknown'} (${loc.businessId})`);
    console.log(`    Normalized: "${normalizeLocationName(loc.name)}"`);
    console.log('');
  }
  
  // Get all stock points
  const stockPoints = await StockPoint.find({}).select('stockPoint locationId businessId _id').lean();
  console.log('=== STOCK POINTS IN V1 ===');
  stockPoints.forEach(sp => {
    const loc = locations.find(l => String(l._id) === String(sp.locationId));
    console.log(`  ${sp.stockPoint}`);
    console.log(`    ID: ${sp._id}`);
    console.log(`    Location: ${loc ? loc.name : 'Unknown'} (${sp.locationId})`);
    console.log('');
  });
  
  // Test specific V0 location names if provided as arguments
  const v0NamesToTest = process.argv.slice(2);
  
  if (v0NamesToTest.length === 0) {
    // Default test cases
    v0NamesToTest.push(
      'TEMPLE FABRICS, SILKS AND SAREES',
      'temple fabrics, silks and sarees',
      'Temple Fabrics, Silks & Sarees HSR',
      'TEMPLE FABRICS SILKS AND SAREES HSR',
    );
  }
  
  console.log('=== TESTING V0 → V1 LOCATION RESOLUTION ===\n');
  
  for (const v0Name of v0NamesToTest) {
    console.log(`V0 Location: "${v0Name}"`);
    console.log(`  Normalized: "${normalizeLocationName(v0Name)}"`);
    
    // Test against each business
    for (const business of businesses) {
      const result = await resolveLocation(v0Name, business._id, locations, {
        fuzzyThreshold: 0.85,
        allowMultiple: false,
      });
      
      console.log(`\n  Business: ${business.name}`);
      console.log(`    Match Type: ${result.matchType}`);
      console.log(`    Confidence: ${result.confidence}`);
      
      if (result.location) {
        console.log(`    ✓ Resolved to: "${result.v1Name}"`);
        console.log(`      Location ID: ${result.location._id}`);
        if (result.similarity) {
          console.log(`      Similarity: ${result.similarity}`);
        }
      } else {
        console.log(`    ✗ No match found`);
        if (result.error) {
          console.log(`      Error: ${result.error}`);
        }
        if (result.candidates && result.candidates.length > 0) {
          console.log(`      Candidates:`);
          result.candidates.forEach(c => {
            console.log(`        - ${c.name}${c.similarity ? ` (${c.similarity})` : ''}`);
          });
        }
      }
    }
    console.log('');
  }
  
  // Generate comprehensive report
  console.log('=== GENERATING COMPREHENSIVE MAPPING REPORT ===\n');
  
  const allV0Names = [
    ...v0NamesToTest,
    ...locations.map(l => l.name), // Test current V1 names as V0 names
  ];
  
  const uniqueV0Names = [...new Set(allV0Names)];
  
  for (const business of businesses) {
    console.log(`\nBusiness: ${business.name}`);
    console.log('─'.repeat(60));
    
    const report = await generateMappingReport(uniqueV0Names, business._id);
    
    console.log(`Total V0 locations tested: ${report.total}`);
    console.log(`  ✓ Matched: ${report.matched}`);
    console.log(`  ⚠ Unmapped: ${report.unmapped}`);
    console.log(`  ⚠ Ambiguous: ${report.ambiguous}`);
    
    if (report.details.unmapped.length > 0) {
      console.log('\n  Unmapped locations:');
      report.details.unmapped.forEach(entry => {
        console.log(`    - "${entry.v0Name}"`);
        if (entry.candidates && entry.candidates.length > 0) {
          console.log(`      Possible matches:`);
          entry.candidates.slice(0, 3).forEach(c => {
            console.log(`        - "${c.name}"`);
          });
        }
      });
    }
    
    if (report.details.ambiguous.length > 0) {
      console.log('\n  Ambiguous locations (multiple matches):');
      report.details.ambiguous.forEach(entry => {
        console.log(`    - "${entry.v0Name}"`);
        if (entry.candidates) {
          console.log(`      Candidates:`);
          entry.candidates.forEach(c => {
            console.log(`        - "${c.name}"${c.similarity ? ` (${c.similarity})` : ''}`);
          });
        }
      });
    }
  }
  
  await mongoose.disconnect();
  console.log('\nDone!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
