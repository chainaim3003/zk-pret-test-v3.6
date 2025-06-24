import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Enhanced GLEIF utility with full JSON structure analysis
 */

/**
 * Fetch company data from GLEIF API with detailed structure logging
 */
export async function fetchGLEIFCompanyDataDetailed(companyName: string): Promise<any> {
  let BASEURL;
  let url;

  let typeOfNet = process.env.BUILD_ENV;
  if (!typeOfNet) {
    typeOfNet = 'TESTNET';
  }

  console.log('🌐 Type of Network:', typeOfNet);

  if (typeOfNet === 'TESTNET') {
    console.log('🧪 Using GLEIF Sandbox Environment');
    BASEURL = process.env.GLEIF_URL_SANDBOX;
    url = `${BASEURL}?filter[entity.legalName]=${encodeURIComponent(companyName)}`;
  } else if (typeOfNet === 'LOCAL') {
    console.log('🏠 Using Local Mock Environment');
    BASEURL = process.env.GLEIF_URL_MOCK;
    url = `${BASEURL}/${companyName}`;
  } else {
    console.log('🌍 Using GLEIF Production Environment');
    BASEURL = process.env.GLEIF_URL_PROD;
    url = `${BASEURL}?filter[entity.legalName]=${encodeURIComponent(companyName)}`;
  }

  if (!BASEURL) {
    throw new Error('BASEURL is not set in the environment variables.');
  }
  if (!companyName) {
    throw new Error('Company name is required.');
  }

  console.log('📡 Fetching data from:', url);
  const response = await axios.get(url);
  const parsedData = response.data;

  // Check for data existence
  if (!parsedData.data || (Array.isArray(parsedData.data) && parsedData.data.length === 0)) {
    throw new Error('No company found with that name.');
  }

  return parsedData;
}

/**
 * Print the entire GLEIF JSON structure with proper formatting
 */
export function printFullGLEIFStructure(gleifData: any): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPLETE GLEIF API RESPONSE STRUCTURE');
  console.log('='.repeat(80));

  // Print with full depth and proper formatting
  console.log(JSON.stringify(gleifData, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('📊 DETAILED STRUCTURE ANALYSIS');
  console.log('='.repeat(80));

  // Analyze top-level structure
  console.log('\n🔍 Top-level structure:');
  Object.keys(gleifData).forEach(key => {
    console.log(`  • ${key}: ${typeof gleifData[key]} ${Array.isArray(gleifData[key]) ? '(array)' : ''}`);
  });

  // Analyze data array structure
  if (gleifData.data && Array.isArray(gleifData.data) && gleifData.data.length > 0) {
    const record = gleifData.data[0];
    console.log('\n🏢 LEI Record structure:');
    Object.keys(record).forEach(key => {
      console.log(`  • ${key}: ${typeof record[key]} ${Array.isArray(record[key]) ? '(array)' : ''}`);
    });

    // Deep dive into attributes
    if (record.attributes) {
      console.log('\n📋 Attributes structure:');
      analyzeObjectStructure(record.attributes, '  ');
    }

    // Deep dive into relationships
    if (record.relationships) {
      console.log('\n🔗 Relationships structure:');
      analyzeObjectStructure(record.relationships, '  ');
    }

    // Deep dive into links
    if (record.links) {
      console.log('\n🌐 Links structure:');
      analyzeObjectStructure(record.links, '  ');
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * Recursively analyze object structure
 */
function analyzeObjectStructure(obj: any, indent: string = '', maxDepth: number = 3, currentDepth: number = 0): void {
  if (currentDepth >= maxDepth || obj === null || typeof obj !== 'object') {
    return;
  }

  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const type = typeof value;
    const isArray = Array.isArray(value);
    
    if (isArray) {
      console.log(`${indent}• ${key}: array[${value.length}]`);
      if (value.length > 0 && typeof value[0] === 'object') {
        console.log(`${indent}  └─ Array item structure:`);
        analyzeObjectStructure(value[0], indent + '    ', maxDepth, currentDepth + 1);
      }
    } else if (type === 'object' && value !== null) {
      console.log(`${indent}• ${key}: object`);
      analyzeObjectStructure(value, indent + '  ', maxDepth, currentDepth + 1);
    } else {
      // Show actual value for strings/numbers (truncated if too long)
      let displayValue = value;
      if (typeof value === 'string' && value.length > 50) {
        displayValue = value.substring(0, 47) + '...';
      }
      console.log(`${indent}• ${key}: ${type} = "${displayValue}"`);
    }
  });
}

/**
 * Extract all possible fields for ZK optimization analysis
 */
export function analyzeGLEIFFieldsForZKOptimization(gleifData: any): ZKOptimizationAnalysis {
  const record = gleifData.data[0];
  const attributes = record.attributes || {};
  
  console.log('\n' + '🔧'.repeat(80));
  console.log('⚡ ZK CIRCUIT OPTIMIZATION ANALYSIS');
  console.log('🔧'.repeat(80));

  const analysis: ZKOptimizationAnalysis = {
    totalFields: 0,
    fieldCategories: {},
    optimizationRecommendations: {},
    constraintEstimates: {}
  };

  // Category 1: Core Identity Fields (High Privacy, Always Individual)
  const coreIdentityFields = extractFieldsFromPath(attributes, [
    'lei',
    'entity.legalName.name',
    'entity.status',
    'entity.jurisdiction'
  ]);

  analysis.fieldCategories.coreIdentity = {
    fields: coreIdentityFields,
    count: Object.keys(coreIdentityFields).length,
    recommendation: 'Keep as individual fields for maximum privacy and selective disclosure',
    constraintCost: Object.keys(coreIdentityFields).length * (960 + 1046) // Per field cost
  };

  // Category 2: Address Information (Good for Concatenation)
  const addressFields = extractFieldsFromPath(attributes, [
    'entity.legalAddress.language',
    'entity.legalAddress.addressLines',
    'entity.legalAddress.additionalAddressLines', 
    'entity.legalAddress.city',
    'entity.legalAddress.region',
    'entity.legalAddress.country',
    'entity.legalAddress.postalCode'
  ]);

  const headquartersFields = extractFieldsFromPath(attributes, [
    'entity.headquartersAddress.language',
    'entity.headquartersAddress.addressLines',
    'entity.headquartersAddress.additionalAddressLines',
    'entity.headquartersAddress.city', 
    'entity.headquartersAddress.region',
    'entity.headquartersAddress.country',
    'entity.headquartersAddress.postalCode'
  ]);

  analysis.fieldCategories.addressInfo = {
    fields: { ...addressFields, ...headquartersFields },
    count: Object.keys(addressFields).length + Object.keys(headquartersFields).length,
    recommendation: 'Concatenate into "legal_address_bundle" and "headquarters_address_bundle"',
    constraintCost: 2 * (960 + 1046) // Two bundles instead of many individual fields
  };

  // Category 3: Business Metadata (Good for Concatenation)
  const businessMetadataFields = extractFieldsFromPath(attributes, [
    'entity.legalForm.id',
    'entity.legalForm.other',
    'entity.creationDate',
    'entity.subCategory',
    'registration.initialRegistrationDate',
    'registration.lastUpdateDate',
    'registration.nextRenewalDate',
    'registration.managingLou',
    'registration.corroborationLevel'
  ]);

  analysis.fieldCategories.businessMetadata = {
    fields: businessMetadataFields,
    count: Object.keys(businessMetadataFields).length,
    recommendation: 'Concatenate into "business_metadata_bundle"',
    constraintCost: 1 * (960 + 1046) // Single bundle
  };

  // Category 4: Rarely Used Fields (Individual, Minimal Cost)
  const rarelyUsedFields = extractFieldsFromPath(attributes, [
    'entity.expiration.date',
    'entity.expiration.reason',
    'entity.successorEntity',
    'registration.validationSources',
    'bic'
  ]);

  analysis.fieldCategories.rarelyUsed = {
    fields: rarelyUsedFields,
    count: Object.keys(rarelyUsedFields).length,
    recommendation: 'Store individually but rarely reveal',
    constraintCost: 0 // Usually not revealed, so minimal cost
  };

  // Calculate totals
  analysis.totalFields = Object.values(analysis.fieldCategories).reduce((sum, cat) => sum + cat.count, 0);

  // Generate optimization recommendations
  analysis.optimizationRecommendations = {
    naive: {
      description: 'All fields as individual CircuitStrings',
      constraintCost: analysis.totalFields * (960 + 1046),
      feasible: analysis.totalFields * (960 + 1046) < 65536
    },
    optimized: {
      description: 'Smart field grouping with bundles',
      constraintCost: analysis.fieldCategories.coreIdentity.constraintCost + 
                     analysis.fieldCategories.addressInfo.constraintCost + 
                     analysis.fieldCategories.businessMetadata.constraintCost,
      feasible: true
    },
    minimal: {
      description: 'Only core identity fields',
      constraintCost: analysis.fieldCategories.coreIdentity.constraintCost,
      feasible: true
    }
  };

  // Print the analysis
  console.log('\n📊 Field Categorization:');
  Object.entries(analysis.fieldCategories).forEach(([category, info]) => {
    console.log(`\n🏷️  ${category.toUpperCase()}:`);
    console.log(`   Fields: ${info.count}`);
    console.log(`   Recommendation: ${info.recommendation}`);
    console.log(`   Constraint Cost: ${info.constraintCost}`);
    console.log(`   Sample Fields: ${Object.keys(info.fields).slice(0, 3).join(', ')}${Object.keys(info.fields).length > 3 ? '...' : ''}`);
  });

  console.log('\n⚡ Optimization Strategies:');
  Object.entries(analysis.optimizationRecommendations).forEach(([strategy, info]) => {
    console.log(`\n🎯 ${strategy.toUpperCase()}:`);
    console.log(`   Description: ${info.description}`);
    console.log(`   Constraint Cost: ${info.constraintCost}`);
    console.log(`   Feasible: ${info.feasible ? '✅ Yes' : '❌ No (exceeds 65K limit)'}`);
  });

  console.log('\n🔧'.repeat(80));

  return analysis;
}

/**
 * Extract fields from nested object paths
 */
function extractFieldsFromPath(obj: any, paths: string[]): Record<string, any> {
  const fields: Record<string, any> = {};
  
  paths.forEach(path => {
    const value = getNestedValue(obj, path);
    if (value !== undefined && value !== null && value !== '') {
      fields[path.replace(/\./g, '_')] = value;
    }
  });
  
  return fields;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      if (Array.isArray(current[key]) && current[key].length > 0) {
        return current[key][0]; // Take first element of arrays
      }
      return current[key];
    }
    return undefined;
  }, obj);
}

/**
 * Interface for ZK optimization analysis
 */
interface ZKOptimizationAnalysis {
  totalFields: number;
  fieldCategories: Record<string, {
    fields: Record<string, any>;
    count: number;
    recommendation: string;
    constraintCost: number;
  }>;
  optimizationRecommendations: Record<string, {
    description: string;
    constraintCost: number;
    feasible: boolean;
  }>;
  constraintEstimates: Record<string, number>;
}

/**
 * Enhanced main function with full analysis
 */
export async function analyzeGLEIFCompanyData(companyName: string): Promise<void> {
  try {
    console.log('🚀 Starting Enhanced GLEIF Analysis');
    console.log(`📋 Company: ${companyName}`);
    //console.log(`🌐 Network: ${typeOfNet}`);

    // Fetch data
    const gleifData = await fetchGLEIFCompanyDataDetailed(companyName);

    // Print full JSON structure
    printFullGLEIFStructure(gleifData);

    // Analyze for ZK optimization
    const zkAnalysis = analyzeGLEIFFieldsForZKOptimization(gleifData);

    // Check compliance
    const firstRecord = gleifData.data[0];
    const status = firstRecord?.attributes?.entity?.status;
    console.log(`\n✅ Company Status: ${status}`);
    console.log(`🏆 GLEIF Compliant: ${status === 'ACTIVE' ? 'YES' : 'NO'}`);

    console.log('\n🎉 Analysis Complete!');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
    throw error;
  }
}

// Export the original functions for backward compatibility
export { fetchGLEIFCompanyData, isCompanyGLEIFCompliant } from './GLEIFUtils.js';

// Main execution function
async function main() {
  const companyName = process.argv[2];
  //const typeOfNet = process.argv[3] || 'TESTNET';

  if (!companyName) {
    console.error('❌ Please provide a company name');
    console.log('Usage: node GLEIFUtilsDetailed.js "Company Name" [TESTNET|LOCAL|PROD]');
    process.exit(1);
  }

  await analyzeGLEIFCompanyData(companyName);
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
