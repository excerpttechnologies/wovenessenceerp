/* Location Mapping for ERP V0 → V1

   When importing data from ERP V0 (erp.orbiteerp.com), location and stock
   point names may differ from the canonical V1 names. This module provides
   a robust mapping system that tries multiple strategies to resolve V0
   source names to V1 location/stock-point IDs.

   Matching Priority:
   1. Exact database ID/code match
   2. Exact name match
   3. Case-insensitive match
   4. Normalized name match (handles &/AND, spacing, punctuation)
   5. Explicit alias mapping
   6. Safe fuzzy/similarity match
   7. Unmapped

   Never use fuzzy matching when multiple candidates exist with similar scores. */

import CompanyLocation from '@/models/CompanyLocation';
import StockPoint from '@/models/StockPoint';
import Business from '@/models/Business';

/* Normalize a location/business name for comparison.
   Handles common variations:
   - Case differences
   - Multiple/trailing spaces
   - "&" vs "AND"
   - Punctuation variations
   - Common abbreviations */
export function normalizeLocationName(value) {
  if (!value) return '';
  
  let normalized = String(value)
    .trim()
    .toLowerCase()
    // Normalize multiple spaces to single space
    .replace(/\s+/g, ' ')
    // Normalize & and "and"
    .replace(/\s+and\s+/gi, ' & ')
    .replace(/\s*&\s*/g, ' & ')
    // Remove common punctuation that doesn't affect identity
    .replace(/[,\.]/g, '')
    // Collapse spaces again after punctuation removal
    .replace(/\s+/g, ' ')
    .trim();
  
  return normalized;
}

/* Calculate similarity score between two strings (0-1).
   Uses a simple character-based approach. */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Exact match
  if (s1 === s2) return 1;
  
  // Calculate Jaccard similarity on character bigrams
  const bigrams1 = new Set();
  const bigrams2 = new Set();
  
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substr(i, 2));
  }
  for (let i = 0; i < s2.length - 1; i++) {
    bigrams2.add(s2.substr(i, 2));
  }
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  const union = new Set([...bigrams1, ...bigrams2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/* Explicit V0 → V1 location name mappings.
   Add entries here for known location name changes between ERP versions.
   
   NOTE: This is a starter list. To discover ALL V0 → V1 mappings automatically:
   1. Run an import from V0
   2. Check the unmapped locations in the import preview
   3. Add mappings here for any that didn't auto-match
   4. Re-run the import
*/
const LOCATION_ALIASES = [
  {
    v0Names: [
      'TEMPLE FABRICS, SILKS AND SAREES',
      'temple fabrics, silks and sarees',
      'Temple Fabrics, Silks And Sarees',
      'TEMPLE FABRICS SILKS AND SAREES',
    ],
    v1Name: 'TEMPLE FABRICS, SILKS & SAREES HSR',
    priority: 'high',
  },
  // Common variations that normalize() should handle automatically:
  // - Case differences (handled by case-insensitive matching)
  // - "AND" vs "&" (handled by normalization)
  // - Multiple spaces (handled by normalization)
  // - Trailing/leading spaces (handled by trim)
  
  // Add more explicit mappings as needed:
  // {
  //   v0Names: ['OLD WAREHOUSE NAME', 'old warehouse name'],
  //   v1Name: 'NEW WAREHOUSE NAME',
  //   priority: 'high',
  // },
];

/* Find V1 location by checking explicit aliases first. */
function findByAlias(v0Name, v1Locations) {
  const normalized = normalizeLocationName(v0Name);
  
  for (const alias of LOCATION_ALIASES) {
    // Check if this V0 name matches any alias pattern
    const matches = alias.v0Names.some(v0 => 
      normalizeLocationName(v0) === normalized
    );
    
    if (matches) {
      // Find the corresponding V1 location
      const v1Normalized = normalizeLocationName(alias.v1Name);
      const found = v1Locations.find(loc => 
        normalizeLocationName(loc.name) === v1Normalized
      );
      
      if (found) {
        return {
          location: found,
          matchType: 'alias',
          confidence: 'high',
          v0Name,
          v1Name: found.name,
        };
      }
    }
  }
  
  return null;
}

/* Find V1 location through various matching strategies.
   
   Parameters:
   - v0Name: source location name from ERP V0
   - businessId: target business ID for filtering
   - allLocations: all V1 locations
   - options: { fuzzyThreshold = 0.85, allowMultiple = false }
   
   Returns: { location, matchType, confidence, v0Name, v1Name, candidates } */
export async function resolveLocation(v0Name, businessId, allLocations, options = {}) {
  const {
    fuzzyThreshold = 0.85,
    allowMultiple = false,
  } = options;
  
  if (!v0Name) {
    return {
      location: null,
      matchType: 'empty',
      confidence: 'none',
      v0Name: '',
      v1Name: null,
      error: 'No location name provided',
    };
  }
  
  // Filter locations by business if provided
  const locations = businessId
    ? allLocations.filter(l => String(l.businessId) === String(businessId))
    : allLocations;
  
  if (locations.length === 0) {
    return {
      location: null,
      matchType: 'no_candidates',
      confidence: 'none',
      v0Name,
      v1Name: null,
      error: 'No locations found for this business',
    };
  }
  
  // 1. Check explicit aliases first
  const aliasMatch = findByAlias(v0Name, locations);
  if (aliasMatch) {
    return aliasMatch;
  }
  
  const v0Clean = v0Name.trim();
  const v0Normalized = normalizeLocationName(v0Name);
  
  // 2. Exact match (case-sensitive)
  const exactMatch = locations.find(loc => loc.name === v0Clean);
  if (exactMatch) {
    return {
      location: exactMatch,
      matchType: 'exact',
      confidence: 'high',
      v0Name,
      v1Name: exactMatch.name,
    };
  }
  
  // 3. Case-insensitive match
  const caseMatch = locations.find(loc => 
    loc.name.toLowerCase() === v0Clean.toLowerCase()
  );
  if (caseMatch) {
    return {
      location: caseMatch,
      matchType: 'case_insensitive',
      confidence: 'high',
      v0Name,
      v1Name: caseMatch.name,
    };
  }
  
  // 4. Normalized match
  const normalizedMatch = locations.find(loc => 
    normalizeLocationName(loc.name) === v0Normalized
  );
  if (normalizedMatch) {
    return {
      location: normalizedMatch,
      matchType: 'normalized',
      confidence: 'high',
      v0Name,
      v1Name: normalizedMatch.name,
    };
  }
  
  // 5. Fuzzy matching (with caution)
  const candidates = locations.map(loc => ({
    location: loc,
    similarity: calculateSimilarity(v0Normalized, normalizeLocationName(loc.name)),
  }))
  .filter(c => c.similarity >= fuzzyThreshold)
  .sort((a, b) => b.similarity - a.similarity);
  
  if (candidates.length === 0) {
    return {
      location: null,
      matchType: 'unmapped',
      confidence: 'none',
      v0Name,
      v1Name: null,
      error: 'No matching location found',
      candidates: locations.slice(0, 5).map(l => ({ name: l.name, id: String(l._id) })),
    };
  }
  
  // Check for ambiguous matches
  if (candidates.length > 1) {
    const topScore = candidates[0].similarity;
    const closeMatches = candidates.filter(c => 
      Math.abs(c.similarity - topScore) < 0.05
    );
    
    if (closeMatches.length > 1 && !allowMultiple) {
      return {
        location: null,
        matchType: 'ambiguous',
        confidence: 'low',
        v0Name,
        v1Name: null,
        error: `Multiple similar locations found: ${closeMatches.map(c => c.location.name).join(', ')}`,
        candidates: closeMatches.map(c => ({ 
          name: c.location.name, 
          id: String(c.location._id),
          similarity: c.similarity.toFixed(2),
        })),
      };
    }
  }
  
  // Single strong fuzzy match
  const bestMatch = candidates[0];
  return {
    location: bestMatch.location,
    matchType: 'fuzzy',
    confidence: bestMatch.similarity > 0.9 ? 'medium' : 'low',
    v0Name,
    v1Name: bestMatch.location.name,
    similarity: bestMatch.similarity.toFixed(2),
  };
}

/* Batch resolve multiple V0 location names to V1 locations.
   
   Returns: Map<v0Name, resolutionResult> */
export async function batchResolveLocations(v0Names, businessId, session = null) {
  // Load all locations once
  const allLocations = await CompanyLocation.find({})
    .select('name businessId _id')
    .session(session || null)
    .lean()
    .exec();
  
  const results = new Map();
  
  for (const v0Name of v0Names) {
    const result = await resolveLocation(v0Name, businessId, allLocations);
    results.set(v0Name, result);
  }
  
  return results;
}

/* Generate a mapping report for debugging/validation.
   
   Returns: { matched, unmapped, ambiguous, total, details } */
export async function generateMappingReport(v0Names, businessId, session = null) {
  const resolutions = await batchResolveLocations(v0Names, businessId, session);
  
  const matched = [];
  const unmapped = [];
  const ambiguous = [];
  
  for (const [v0Name, result] of resolutions.entries()) {
    const entry = {
      v0Name,
      v1Name: result.v1Name,
      matchType: result.matchType,
      confidence: result.confidence,
      locationId: result.location ? String(result.location._id) : null,
    };
    
    if (result.matchType === 'unmapped') {
      unmapped.push({ ...entry, candidates: result.candidates });
    } else if (result.matchType === 'ambiguous') {
      ambiguous.push({ ...entry, candidates: result.candidates });
    } else {
      matched.push(entry);
    }
  }
  
  return {
    total: v0Names.length,
    matched: matched.length,
    unmapped: unmapped.length,
    ambiguous: ambiguous.length,
    details: {
      matched,
      unmapped,
      ambiguous,
    },
  };
}

/* Stock Point resolution - similar to location resolution. */
export async function resolveStockPoint(v0StockPoint, locationId, allStockPoints, options = {}) {
  if (!v0StockPoint) {
    return {
      stockPoint: null,
      matchType: 'empty',
      confidence: 'none',
      v0Name: '',
      v1Name: null,
    };
  }
  
  // Filter by location if provided
  const points = locationId
    ? allStockPoints.filter(sp => String(sp.locationId) === String(locationId))
    : allStockPoints;
  
  if (points.length === 0) {
    return {
      stockPoint: null,
      matchType: 'not_in_master',
      confidence: 'none',
      v0Name: v0StockPoint,
      v1Name: null,
      note: 'Stock point not in master - text value will be kept',
    };
  }
  
  const v0Normalized = normalizeLocationName(v0StockPoint);
  
  // Exact match
  const exactMatch = points.find(sp => sp.stockPoint === v0StockPoint);
  if (exactMatch) {
    return {
      stockPoint: exactMatch,
      matchType: 'exact',
      confidence: 'high',
      v0Name: v0StockPoint,
      v1Name: exactMatch.stockPoint,
    };
  }
  
  // Normalized match
  const normalizedMatch = points.find(sp => 
    normalizeLocationName(sp.stockPoint) === v0Normalized
  );
  if (normalizedMatch) {
    return {
      stockPoint: normalizedMatch,
      matchType: 'normalized',
      confidence: 'high',
      v0Name: v0StockPoint,
      v1Name: normalizedMatch.stockPoint,
    };
  }
  
  return {
    stockPoint: null,
    matchType: 'not_in_master',
    confidence: 'none',
    v0Name: v0StockPoint,
    v1Name: null,
    note: 'Stock point not in master - text value will be kept',
  };
}
