import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Enhanced GLEIF Utils with complete JSON printing and ZK optimization analysis
 */

// =================================== Type Definitions ===================================
export interface GLEIFAPIResponse {
  data?: any;
  [key: string]: any;
}

export interface GLEIFComplianceAnalysis {
  isCompliant: boolean;
  complianceScore: number;
  issues: string[];
  summary: string;
}

export interface GLEIFDataSummary {
  legalName: string;
  lei: string;
  entityStatus: string;
  jurisdiction: string;
  legalForm: string;
  complianceScore: number;
}

/**
 * ✅ ENHANCED: Two-Stage Lookup Implementation
 * Fetch company data from GLEIF API with enhanced Stage 1 logging
 */
export async function fetchGLEIFDataWithFullLogging(companyName: string): Promise<GLEIFAPIResponse> {
  console.log(`🔍 STAGE 1: Two-Stage Lookup - Resolving company name to LEI`);
  console.log(`📋 Company Name: "${companyName}"`);
  
  // ✅ Enhanced: Clean the company name first
  const cleanCompanyName = companyName
    .trim()
    .replace(/\^/g, '') // Remove any ^ characters
    .replace(/[^\w\s\&\.\'\_]/g, '') // Keep only safe characters
    .replace(/\s+/g, ' '); // Normalize spaces
    
  console.log(`🧹 Normalized: "${cleanCompanyName}"`);
  
  try {
    const apiResponse = await fetchGLEIFCompanyDataWithFullDetails(cleanCompanyName);
    
    // ✅ Enhanced LEI extraction and validation
    const lei = extractLEIFromGLEIFResponse(apiResponse);
    const legalName = apiResponse.data[0].attributes?.entity?.legalName?.name;
    
    console.log(`✅ STAGE 1 SUCCESS: Name resolved to LEI`);
    console.log(`   LEI: ${lei}`);
    console.log(`   Legal Name: ${legalName}`);
    console.log(`   Status: ${apiResponse.data[0].attributes?.entity?.status}`);
    
    return apiResponse;
    
  } catch (error) {
    console.error(`❌ STAGE 1 FAILED: Could not resolve "${companyName}" to LEI`);
    // FIXED: Properly handle unknown error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Company name resolution failed: ${errorMessage}`);
  }
}

/**
 * ✅ NEW: LEI extraction utility for two-stage lookup
 */
export function extractLEIFromGLEIFResponse(apiResponse: GLEIFAPIResponse): string {
  if (!apiResponse.data || apiResponse.data.length === 0) {
    throw new Error('No GLEIF data available for LEI extraction');
  }
  
  const lei = apiResponse.data[0].attributes?.lei;
  if (!lei) {
    throw new Error('LEI not found in GLEIF response');
  }
  
  // ✅ LEI format validation
  if (!validateLEI(lei)) {
    throw new Error(`Invalid LEI format: ${lei}`);
  }
  
  return lei;
}

/**
 * ✅ NEW: Enhanced company name normalization
 */
export function normalizeCompanyName(companyName: string): string {
  return companyName
    .trim()
    .toUpperCase()
    .replace(/\b(INC|CORP|LTD|LIMITED|PRIVATE|PVT|LLC|CORPORATION)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ✅ NEW: LEI validation (ISO 17442 standard)
 */
export function validateLEI(lei: string): boolean {
  // LEI format: 20 alphanumeric characters
  const leiRegex = /^[A-Z0-9]{20}$/;
  return leiRegex.test(lei);
}

/**
 * ✅ NEW: Check if two company names might refer to same entity
 */
export function compareCompanyNames(name1: string, name2: string): number {
  const normalized1 = normalizeCompanyName(name1);
  const normalized2 = normalizeCompanyName(name2);
  
  if (normalized1 === normalized2) return 100; // Exact match
  
  // Simple similarity scoring
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length) * 100;
  
  return Math.round(similarity);
}

/**
 * ✅ INTERNAL: Original GLEIF API function (used by enhanced wrapper)
 */
export async function fetchGLEIFCompanyDataWithFullDetails(companyName: string): Promise<any> {
  let BASEURL;
  let url;

  let typeOfNet = process.env.BUILD_ENV; // Use environment variable for network type
  if (!typeOfNet) {
    typeOfNet = 'TESTNET';
  }

  console.log('Company Name:', companyName);
  console.log('Type of Network:', typeOfNet);

  if (typeOfNet === 'TESTNET') {
    console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++in sandbox++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
    BASEURL = process.env.GLEIF_URL_SANDBOX;
    url = `${BASEURL}?filter[entity.legalName]=${encodeURIComponent(companyName)}`;
  } 
  else if (typeOfNet === 'LOCAL') {
    console.log('------------------------------------------------using live GLEIF API--------------------------------------------------');
    BASEURL = process.env.GLEIF_URL_MOCK; // Use live GLEIF API for LOCAL too
    url = `${BASEURL}/${encodeURIComponent(companyName)}`; // Assuming mock API uses company name directly
  } 
  else {
    console.log('///////////////////////////////////////////////in prod//////////////////////////////////////////////');
    BASEURL = process.env.GLEIF_URL_PROD;
    url = `${BASEURL}?filter[entity.legalName]=${encodeURIComponent(companyName)}`;
  }

  if (!BASEURL) {
    throw new Error('BASEURL is not set in the environment variables.');
  }
  if (!companyName) {
    throw new Error('Company name is required.');
  }

  const response = await axios.get(url);
  const parsedData = response.data;

  // ✅ SOLUTION 1: Print complete JSON with unlimited depth
  console.log('\n🔍 COMPLETE GLEIF API RESPONSE:');
  console.log('='.repeat(100));
  console.log(JSON.stringify(parsedData, null, 2)); // Full JSON with proper formatting

  // ✅ SOLUTION 2: Print specific sections with enhanced detail
  if (parsedData.data && parsedData.data.length > 0) {
    const record = parsedData.data[0];
    
    console.log('\n📊 DETAILED RECORD ANALYSIS:');
    console.log('='.repeat(100));
    
    console.log('\n🏢 BASIC RECORD INFO:');
    console.log(`Type: ${record.type}`);
    console.log(`ID (LEI): ${record.id}`);
    
    console.log('\n📋 ATTRIBUTES SECTION (Complete Object):');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(record.attributes, null, 2));
    
    console.log('\n🔗 RELATIONSHIPS SECTION (Complete Object):');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(record.relationships, null, 2));
    
    console.log('\n🌐 LINKS SECTION (Complete Object):');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(record.links, null, 2));

    // ✅ SOLUTION 3: ZK Circuit optimization analysis
    console.log('\n🎯 ZK CIRCUIT OPTIMIZATION ANALYSIS:');
    console.log('='.repeat(100));
    analyzeGLEIFStructureForZK(record);

    // ✅ SOLUTION 4: Show company compliance status  
    console.log('\n✅ COMPLIANCE STATUS:');
    console.log('─'.repeat(50));
    const status = record.attributes?.entity?.status;
    console.log(`Company Status: ${status}`);
    const isCompliant = !!status && status === 'ACTIVE';
    console.log(`Is company "${companyName}" GLEIF compliant? ${isCompliant}`);
  }

  // Check for data existence and non-empty array/object
  if (
    !parsedData.data ||
    (Array.isArray(parsedData.data) && parsedData.data.length === 0)
  ) {
    throw new Error('No company found with that name.');
  }

  return parsedData;
}

/**
 * Analyze GLEIF structure for ZK circuit optimization
 */
function analyzeGLEIFStructureForZK(record: any): void {
  console.log('🔬 ANALYZING DATA STRUCTURE FOR ZK OPTIMIZATION...\n');
  
  const zkOptimizationSuggestions = {
    tier1Individual: [] as string[],
    tier2Grouped: {} as Record<string, string[]>,
    tier3Metadata: [] as string[],
    relationshipData: [] as string[],
    totalFields: 0
  };

  // Analyze attributes structure
  if (record.attributes) {
    console.log('📊 ATTRIBUTES STRUCTURE ANALYSIS:');
    
    // Core LEI information
    if (record.attributes.lei) {
      zkOptimizationSuggestions.tier1Individual.push('attributes.lei');
      console.log(`  ✅ LEI: ${record.attributes.lei}`);
    }

    // Entity information analysis
    if (record.attributes.entity) {
      console.log('\n🏢 ENTITY DATA STRUCTURE:');
      const entity = record.attributes.entity;
      
      // High-priority individual fields
      if (entity.legalName?.name) {
        zkOptimizationSuggestions.tier1Individual.push('entity.legalName.name');
        console.log(`  ✅ Legal Name: ${entity.legalName.name}`);
      }
      
      if (entity.status) {
        zkOptimizationSuggestions.tier1Individual.push('entity.status');
        console.log(`  ✅ Status: ${entity.status}`);
      }

      if (entity.jurisdiction) {
        zkOptimizationSuggestions.tier1Individual.push('entity.jurisdiction');
        console.log(`  ✅ Jurisdiction: ${entity.jurisdiction}`);
      }

      // Legal address grouping
      if (entity.legalAddress) {
        const addressFields = [];
        console.log('\n  📍 LEGAL ADDRESS DATA:');
        console.log(JSON.stringify(entity.legalAddress, null, 4));
        
        if (entity.legalAddress.addressLines) addressFields.push('entity.legalAddress.addressLines');
        if (entity.legalAddress.city) addressFields.push('entity.legalAddress.city');
        if (entity.legalAddress.region) addressFields.push('entity.legalAddress.region');
        if (entity.legalAddress.country) addressFields.push('entity.legalAddress.country');
        if (entity.legalAddress.postalCode) addressFields.push('entity.legalAddress.postalCode');
        
        if (addressFields.length > 0) {
          zkOptimizationSuggestions.tier2Grouped['legal_address_bundle'] = addressFields;
        }
      }

      // Headquarters address grouping
      if (entity.headquartersAddress) {
        const hqFields = [];
        console.log('\n  🏢 HEADQUARTERS ADDRESS DATA:');
        console.log(JSON.stringify(entity.headquartersAddress, null, 4));
        
        if (entity.headquartersAddress.addressLines) hqFields.push('entity.headquartersAddress.addressLines');
        if (entity.headquartersAddress.city) hqFields.push('entity.headquartersAddress.city');
        if (entity.headquartersAddress.region) hqFields.push('entity.headquartersAddress.region');
        if (entity.headquartersAddress.country) hqFields.push('entity.headquartersAddress.country');
        if (entity.headquartersAddress.postalCode) hqFields.push('entity.headquartersAddress.postalCode');
        
        if (hqFields.length > 0) {
          zkOptimizationSuggestions.tier2Grouped['headquarters_address_bundle'] = hqFields;
        }
      }

      // Business information bundle
      const businessFields = [];
      if (entity.legalForm?.id) {
        businessFields.push('entity.legalForm.id');
        console.log(`  ✅ Legal Form: ${entity.legalForm.id}`);
      }
      if (entity.category) {
        businessFields.push('entity.category');
        console.log(`  ✅ Category: ${entity.category}`);
      }
      if (entity.subCategory) {
        businessFields.push('entity.subCategory');
        console.log(`  ✅ Sub Category: ${entity.subCategory}`);
      }
      
      if (businessFields.length > 0) {
        zkOptimizationSuggestions.tier2Grouped['business_info_bundle'] = businessFields;
      }

      // Other names grouping
      if (entity.otherNames && entity.otherNames.length > 0) {
        console.log('\n  📝 OTHER NAMES:');
        console.log(JSON.stringify(entity.otherNames, null, 4));
        zkOptimizationSuggestions.tier2Grouped['other_names_bundle'] = ['entity.otherNames'];
      }
    }
    
    // Registration information analysis
    if (record.attributes.registration) {
      console.log('\n📝 REGISTRATION DATA STRUCTURE:');
      console.log(JSON.stringify(record.attributes.registration, null, 2));
      
      const registration = record.attributes.registration;
      const regFields = [];
      
      if (registration.initialRegistrationDate) regFields.push('registration.initialRegistrationDate');
      if (registration.lastUpdateDate) regFields.push('registration.lastUpdateDate');
      if (registration.nextRenewalDate) regFields.push('registration.nextRenewalDate');
      if (registration.managingLou) regFields.push('registration.managingLou');
      if (registration.corroborationLevel) regFields.push('registration.corroborationLevel');
      
      zkOptimizationSuggestions.tier3Metadata.push(...regFields);
    }
  }

  // Analyze relationships structure
  if (record.relationships) {
    console.log('\n🔗 RELATIONSHIPS STRUCTURE ANALYSIS:');
    console.log(JSON.stringify(record.relationships, null, 2));
    
    Object.keys(record.relationships).forEach(key => {
      zkOptimizationSuggestions.relationshipData.push(`relationships.${key}`);
      console.log(`  📊 Relationship type: ${key}`);
      if (record.relationships[key]?.data) {
        const dataType = Array.isArray(record.relationships[key].data) ? 'Array' : 'Object';
        const dataLength = Array.isArray(record.relationships[key].data) ? record.relationships[key].data.length : 1;
        console.log(`    └─ Data: ${dataType} (${dataLength} items)`);
      }
    });
  }

  // Generate ZK optimization recommendations
  //generateZKOptimizationRecommendations(zkOptimizationSuggestions);

}

/**
 * Standard GLEIF API functions (existing compatibility)
 */
export async function fetchGLEIFCompanyData(companyName: string): Promise<any> {
  // Keep existing function for backward compatibility
  return await fetchGLEIFCompanyDataWithFullDetails(companyName);
}

export async function isCompanyGLEIFCompliant(companyName: string): Promise<boolean> {
  const res = await fetchGLEIFCompanyData(companyName);

  let firstRecord;
  if (Array.isArray(res.data)) {
    firstRecord = res.data[0];
  } else if (res.data) {
    firstRecord = res.data;
  }

  const status = firstRecord?.attributes?.entity?.status;
  console.log('Company Status:', status);

  return !!status && status === 'ACTIVE';
}

// Main execution for testing
async function main() {
  const companyName = process.argv[2];
  //let typeOfNet = process.argv[3] || 'TESTNET';

  if (!companyName) {
    console.error('❌ Please provide a company name');
    console.log('Usage: node GLEIFEnhancedUtils.js "Company Name" [TESTNET|LOCAL|PROD]');
    process.exit(1);
  }

  console.log('\n🌟 ENHANCED GLEIF API DATA ANALYSIS');
  console.log('='.repeat(100));

  try {
    await fetchGLEIFCompanyDataWithFullDetails(companyName);
    console.log('\n✅ Complete analysis finished successfully!');
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

export function extractGLEIFSummary(apiResponse: GLEIFAPIResponse): GLEIFDataSummary {
  let firstRecord;
  if (Array.isArray(apiResponse.data)) {
    firstRecord = apiResponse.data[0];
  } else if (apiResponse.data) {
    firstRecord = apiResponse.data;
  }

  const attributes = firstRecord?.attributes;
  const entity = attributes?.entity;
  
  return {
    legalName: entity?.legalName?.name || '',
    lei: attributes?.lei || firstRecord?.id || '',
    entityStatus: entity?.status || '',
    jurisdiction: entity?.jurisdiction || '',
    legalForm: entity?.legalForm?.id || '',
    complianceScore: entity?.status === 'ACTIVE' ? 100 : 0
  };
}

export function analyzeGLEIFCompliance(apiResponse: GLEIFAPIResponse, typeOfNet?: string): GLEIFComplianceAnalysis {
  const summary = extractGLEIFSummary(apiResponse);
  const issues: string[] = [];
  
  // Check compliance criteria
  if (!summary.legalName) issues.push('Missing legal name');
  if (!summary.lei) issues.push('Missing LEI');
  if (summary.entityStatus !== 'ACTIVE') issues.push('Entity status is not ACTIVE');
  if (!summary.jurisdiction) issues.push('Missing jurisdiction');
  
  const isCompliant = issues.length === 0;
  const complianceScore = isCompliant ? 100 : Math.max(0, 100 - (issues.length * 25));
  
  return {
    isCompliant,
    complianceScore,
    issues,
    summary: `Company ${summary.legalName} has ${isCompliant ? 'passed' : 'failed'} GLEIF compliance check`
  };
}

// =================================== MULTI-COMPANY UTILITIES (CONSOLIDATION) ===================================

/**
 * Company registry for managing multiple companies in merkle tree
 */
export class CompanyRegistry {
  private companiesTree: any; // MerkleTree imported from o1js in actual usage
  private companyRecords: Map<string, { record: any; index: number }>;
  private nextIndex: number;
  private COMPANY_MERKLE_HEIGHT: number;

  constructor(merkleHeight: number = 8) {
    // MerkleTree will be imported in the actual usage files
    this.COMPANY_MERKLE_HEIGHT = merkleHeight;
    this.companyRecords = new Map();
    this.nextIndex = 0;
    // this.companiesTree = new MerkleTree(this.COMPANY_MERKLE_HEIGHT); // Set in actual usage
  }

  /**
   * Initialize the merkle tree (called from usage files with proper MerkleTree import)
   */
  initializeMerkleTree(MerkleTreeClass: any) {
    this.companiesTree = new MerkleTreeClass(this.COMPANY_MERKLE_HEIGHT);
  }

  /**
   * Add or update a company in the registry
   */
  addOrUpdateCompany(lei: string, companyRecord: any, CompanyMerkleWitnessClass: any, PoseidonClass: any): any {
    let index: number;
    
    if (this.companyRecords.has(lei)) {
      // Update existing company
      index = this.companyRecords.get(lei)!.index;
      console.log(`📝 Updating existing company at index ${index}: ${lei}`);
    } else {
      // Add new company
      index = this.nextIndex++;
      console.log(`➕ Adding new company at index ${index}: ${lei}`);
    }
    
    // Calculate company record hash using the same method as the smart contract
    const companyHash = PoseidonClass.hash([
      companyRecord.leiHash,
      companyRecord.legalNameHash,
      companyRecord.jurisdictionHash,
      companyRecord.isCompliant.toField(),
      companyRecord.complianceScore,
      companyRecord.totalVerifications,
      companyRecord.lastVerificationTime.value,
      companyRecord.firstVerificationTime.value
    ]);
    
    // Update merkle tree
    this.companiesTree.setLeaf(BigInt(index), companyHash);
    
    // Store company record
    this.companyRecords.set(lei, { record: companyRecord, index });
    
    // Return witness for this company
    return new CompanyMerkleWitnessClass(this.companiesTree.getWitness(BigInt(index)));
  }

  /**
   * Get merkle witness for a company
   */
  getCompanyWitness(lei: string, CompanyMerkleWitnessClass: any): any | null {
    const entry = this.companyRecords.get(lei);
    if (!entry) return null;
    
    return new CompanyMerkleWitnessClass(this.companiesTree.getWitness(BigInt(entry.index)));
  }

  /**
   * Get company record
   */
  getCompanyRecord(lei: string): any | null {
    const entry = this.companyRecords.get(lei);
    return entry ? entry.record : null;
  }

  /**
   * Get merkle root of companies tree
   */
  getRoot(): any {
    return this.companiesTree.getRoot();
  }

  /**
   * Get all tracked companies
   */
  getAllCompanies(): string[] {
    return Array.from(this.companyRecords.keys());
  }

  /**
   * Get total number of companies
   */
  getTotalCompanies(): number {
    return this.companyRecords.size;
  }
}

/**
 * Create a comprehensive merkle tree from GLEIF API response
 * FIXED: Restored from working version with correct field indices mapping
 */
export function createComprehensiveGLEIFMerkleTree(
  apiResponse: GLEIFAPIResponse,
  MerkleTreeClass: any,
  CircuitStringClass: any,
  MERKLE_TREE_HEIGHT: number,
  GLEIF_FIELD_INDICES: any
): {
  tree: any,
  extractedData: any,
  fieldCount: number
} {
  console.log('🌳 Creating comprehensive GLEIF Merkle tree...');
  
  const tree = new MerkleTreeClass(MERKLE_TREE_HEIGHT);
  let fieldCount = 0;
  const extractedData: any = {};

  // Helper function to safely set field in tree
  function setTreeField(fieldName: string, value: string | undefined | any[] | null, index: number) {
    let safeValue: string;
    
    // Handle different data types from GLEIF API
    if (value === null || value === undefined) {
      safeValue = '';
    } else if (Array.isArray(value)) {
      // Handle arrays (like bic, mic codes) by joining them
      safeValue = value.filter(v => v != null).join(',');
    } else if (typeof value === 'object') {
      // Handle objects by converting to string representation
      safeValue = JSON.stringify(value);
    } else {
      // Handle strings and primitives
      safeValue = String(value);
    }
    
    try {
      const circuitValue = CircuitStringClass.fromString(safeValue);
      const hash = circuitValue.hash();
      tree.setLeaf(BigInt(index), hash);
      extractedData[fieldName] = circuitValue;
      fieldCount++;
      console.log(`  Set field ${fieldName} (${index}): "${safeValue.substring(0, 50)}${safeValue.length > 50 ? '...' : ''}"`);
    } catch (error) {
      console.error(`❌ Error setting field ${fieldName}:`, error);
      // Set empty value as fallback
      const fallbackValue = CircuitStringClass.fromString('');
      const hash = fallbackValue.hash();
      tree.setLeaf(BigInt(index), hash);
      extractedData[fieldName] = fallbackValue;
      fieldCount++;
      console.log(`  Set field ${fieldName} (${index}) with fallback: ""`);
    }
  }

  try {
    console.log('📋 Processing live GLEIF API structure...');
    const firstRecord = apiResponse.data && apiResponse.data[0] ? apiResponse.data[0] : null;
    if (!firstRecord) {
      throw new Error('No GLEIF records found in API response');
    }
    
    const attributes = firstRecord.attributes || {};
    const entity = attributes.entity || {};
    const registration = attributes.registration || {};
    
    // Core compliance fields - FIXED mapping with correct sequential indices
    setTreeField('legalName', entity.legalName?.name, GLEIF_FIELD_INDICES.legalName);
    setTreeField('lei', attributes.lei, GLEIF_FIELD_INDICES.lei);
    setTreeField('entityStatus', entity.status, GLEIF_FIELD_INDICES.entityStatus);
    setTreeField('legalForm', entity.legalForm?.id, GLEIF_FIELD_INDICES.legalForm);
    setTreeField('jurisdiction', entity.jurisdiction, GLEIF_FIELD_INDICES.jurisdiction);
    setTreeField('legalAddress', entity.legalAddress?.addressLines?.[0], GLEIF_FIELD_INDICES.legalAddress);
    setTreeField('legalCity', entity.legalAddress?.city, GLEIF_FIELD_INDICES.legalCity);
    setTreeField('legalCountry', entity.legalAddress?.country, GLEIF_FIELD_INDICES.legalCountry);
    setTreeField('registrationAuthority', entity.registeredAt?.id, GLEIF_FIELD_INDICES.registrationAuthority);
    setTreeField('entityCategory', entity.category, GLEIF_FIELD_INDICES.entityCategory);
    
    // Additional GLEIF fields
    if (GLEIF_FIELD_INDICES.businessRegisterEntityId !== undefined) {
      setTreeField('businessRegisterEntityId', entity.registeredAs, GLEIF_FIELD_INDICES.businessRegisterEntityId);
    }
    if (GLEIF_FIELD_INDICES.leiStatus !== undefined) {
      setTreeField('leiStatus', registration.status, GLEIF_FIELD_INDICES.leiStatus);
    }
    if (GLEIF_FIELD_INDICES.initialRegistrationDate !== undefined) {
      setTreeField('initialRegistrationDate', registration.initialRegistrationDate, GLEIF_FIELD_INDICES.initialRegistrationDate);
    }
    if (GLEIF_FIELD_INDICES.lastUpdateDate !== undefined) {
      setTreeField('lastUpdateDate', registration.lastUpdateDate, GLEIF_FIELD_INDICES.lastUpdateDate);
    }
    if (GLEIF_FIELD_INDICES.nextRenewalDate !== undefined) {
      setTreeField('nextRenewalDate', registration.nextRenewalDate, GLEIF_FIELD_INDICES.nextRenewalDate);
    }
    
    // Required fields for ZK program witnesses (must be present even if empty)
    if (GLEIF_FIELD_INDICES.registration_status !== undefined) {
      setTreeField('registration_status', registration.status, GLEIF_FIELD_INDICES.registration_status);
    }
    if (GLEIF_FIELD_INDICES.bic_codes !== undefined) {
      setTreeField('bic_codes', attributes.bic, GLEIF_FIELD_INDICES.bic_codes);
    }
    if (GLEIF_FIELD_INDICES.mic_codes !== undefined) {
      setTreeField('mic_codes', attributes.mic, GLEIF_FIELD_INDICES.mic_codes);
    }
    
    // Additional fields from attributes
    if (GLEIF_FIELD_INDICES.conformityFlag !== undefined) {
      setTreeField('conformityFlag', attributes.conformityFlag, GLEIF_FIELD_INDICES.conformityFlag);
    }
    if (GLEIF_FIELD_INDICES.managingLou !== undefined) {
      setTreeField('managingLou', registration.managingLou, GLEIF_FIELD_INDICES.managingLou);
    }

    console.log(`✅ Created Merkle tree with ${fieldCount} fields`);
    console.log(`🌳 Merkle root: ${tree.getRoot().toString()}`);
    
    return { tree, extractedData, fieldCount };
    
  } catch (error) {
    console.error('❌ Error creating Merkle tree:', error);
    throw error;
  }
}

/**
 * Create optimized compliance data from extracted fields
 */
export function createOptimizedGLEIFComplianceData(
  extractedData: any,
  merkleRoot: any,
  CircuitStringClass: any,
  GLEIFOptimComplianceDataClass: any
): any {
  return new GLEIFOptimComplianceDataClass({
    lei: extractedData.lei || CircuitStringClass.fromString(''),
    name: extractedData.legalName || CircuitStringClass.fromString(''),
    entity_status: extractedData.entityStatus || CircuitStringClass.fromString(''),
    registration_status: extractedData.registration_status || CircuitStringClass.fromString(''),
    conformity_flag: extractedData.conformityFlag || CircuitStringClass.fromString(''),
    initialRegistrationDate: extractedData.initialRegistrationDate || CircuitStringClass.fromString(''),
    lastUpdateDate: extractedData.lastUpdateDate || CircuitStringClass.fromString(''),
    nextRenewalDate: extractedData.nextRenewalDate || CircuitStringClass.fromString(''),
    bic_codes: extractedData.bic_codes || CircuitStringClass.fromString(''),
    mic_codes: extractedData.mic_codes || CircuitStringClass.fromString(''),
    managing_lou: extractedData.managingLou || CircuitStringClass.fromString(''),
    merkle_root: merkleRoot,
  });
}

/**
 * Create a company record from GLEIF compliance data and verification info
 */
export function createCompanyRecord(
  complianceData: any,
  isCompliant: any,
  verificationTimestamp: any,
  CircuitStringClass: any,
  GLEIFCompanyRecordClass: any,
  FieldClass: any,
  isFirstVerification: boolean = true
): any {
  console.log(`    🔍 createCompanyRecord: Validating input parameters...`);
  
  // Validate all input parameters
  if (!complianceData) {
    throw new Error('createCompanyRecord: complianceData is null or undefined');
  }
  if (!complianceData.lei) {
    throw new Error('createCompanyRecord: complianceData.lei is null or undefined');
  }
  if (!complianceData.name) {
    throw new Error('createCompanyRecord: complianceData.name is null or undefined');
  }
  if (isCompliant === null || isCompliant === undefined) {
    throw new Error('createCompanyRecord: isCompliant is null or undefined');
  }
  if (!verificationTimestamp) {
    throw new Error('createCompanyRecord: verificationTimestamp is null or undefined');
  }
  if (!CircuitStringClass) {
    throw new Error('createCompanyRecord: CircuitStringClass is null or undefined');
  }
  if (!GLEIFCompanyRecordClass) {
    throw new Error('createCompanyRecord: GLEIFCompanyRecordClass is null or undefined');
  }
  if (!FieldClass) {
    throw new Error('createCompanyRecord: FieldClass is null or undefined');
  }
  
  console.log(`    ✅ createCompanyRecord: All input parameters validated`);
  
  const currentTime = verificationTimestamp;
  
  try {
    console.log(`    🔄 createCompanyRecord: Creating hashes...`);
    
    // Create hashes with error handling
    let leiHash, legalNameHash, jurisdictionHash;
    
    try {
      leiHash = complianceData.lei.hash();
      console.log(`      ✅ leiHash created: ${leiHash.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create leiHash - ${error}`);
    }
    
    try {
      legalNameHash = complianceData.name.hash();
      console.log(`      ✅ legalNameHash created: ${legalNameHash.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create legalNameHash - ${error}`);
    }
    
    try {
      jurisdictionHash = CircuitStringClass.fromString('Global').hash();
      console.log(`      ✅ jurisdictionHash created: ${jurisdictionHash.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create jurisdictionHash - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating compliance score...`);
    let complianceScore;
    try {
      complianceScore = isCompliant.toField().mul(100);
      console.log(`      ✅ complianceScore created: ${complianceScore.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create complianceScore - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating verification counts...`);
    let totalVerifications, passedVerifications, failedVerifications, consecutiveFailures;
    try {
      totalVerifications = FieldClass(1); // This is the first verification
      passedVerifications = isCompliant.toField(); // 1 if passed, 0 if failed
      failedVerifications = isCompliant.not().toField(); // 1 if failed, 0 if passed
      consecutiveFailures = isCompliant.not().toField(); // 1 if this verification failed, 0 if passed
      
      console.log(`      ✅ totalVerifications created: ${totalVerifications.toString()}`);
      console.log(`      ✅ passedVerifications created: ${passedVerifications.toString()}`);
      console.log(`      ✅ failedVerifications created: ${failedVerifications.toString()}`);
      console.log(`      ✅ consecutiveFailures created: ${consecutiveFailures.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create verification counts - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating timestamp fields...`);
    let lastPassTime, lastFailTime;
    try {
      // Import UInt64 from the modules that should be available
      const UInt64 = verificationTimestamp.constructor; // Get UInt64 constructor from the timestamp
      
      // Set lastPassTime to current time if compliant, 0 if not
      lastPassTime = isCompliant.toField().equals(FieldClass(1)) ? currentTime : UInt64.from(0);
      // Set lastFailTime to current time if not compliant, 0 if compliant 
      lastFailTime = isCompliant.toField().equals(FieldClass(0)) ? currentTime : UInt64.from(0);
      
      console.log(`      ✅ lastPassTime created: ${lastPassTime.toString()}`);
      console.log(`      ✅ lastFailTime created: ${lastFailTime.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create timestamp fields - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating GLEIFCompanyRecord with all 13 fields...`);
    const record = new GLEIFCompanyRecordClass({
      leiHash: leiHash,
      legalNameHash: legalNameHash,
      jurisdictionHash: jurisdictionHash,
      isCompliant: isCompliant,
      complianceScore: complianceScore,
      totalVerifications: totalVerifications,
      passedVerifications: passedVerifications,         // NEW FIELD
      failedVerifications: failedVerifications,         // NEW FIELD
      consecutiveFailures: consecutiveFailures,         // NEW FIELD
      lastVerificationTime: currentTime,
      firstVerificationTime: currentTime,
      lastPassTime: lastPassTime,                       // NEW FIELD
      lastFailTime: lastFailTime                        // NEW FIELD
    });
    
    console.log(`    ✅ createCompanyRecord: GLEIFCompanyRecord created successfully with all 13 fields`);
    return record;
    
  } catch (error) {
    console.error(`    ❌ createCompanyRecord: Error creating company record:`, error);
    throw error;
  }
}

// =================================== GLEIF Field Indices (FIXED) ===================================
/**
 * GLEIF Field Indices for Merkle Tree Structure
 * FIXED: Restored correct sequential mapping from working version
 */
export const GLEIF_FIELD_INDICES = {
  // Core compliance fields (0-9) - CORRECT SEQUENTIAL ORDER
  legalName: 0,
  lei: 1,
  entityStatus: 2,
  entity_status: 2, // alias for consistency
  legalForm: 3,
  jurisdiction: 4,
  legalAddress: 5,
  legalCity: 6,
  legalCountry: 7,
  registrationAuthority: 8,
  entityCategory: 9,
  
  // Extended GLEIF fields (10-19)
  businessRegisterEntityId: 10,
  leiStatus: 11,
  initialRegistrationDate: 12,
  lastUpdateDate: 13,
  nextRenewalDate: 14,
  registration_status: 15,
  conformity_flag: 16,
  conformityFlag: 16, // alias for camelCase consistency
  bic_codes: 17,
  mic_codes: 18,
  managingLou: 19,
  
  // Additional fields for extended verification (20-29)
  headquartersAddress: 20,
  headquartersCity: 21,
  headquartersCountry: 22,
  otherNames: 23,
  subCategory: 24,
  corroborationLevel: 25,
  validationSources: 26,
  
  // Reserved for future use (27-255)
  reserved_27: 27,
  reserved_28: 28,
  reserved_29: 29
} as const;

// Type for field indices
export type GLEIFFieldIndex = typeof GLEIF_FIELD_INDICES[keyof typeof GLEIF_FIELD_INDICES];

/**
 * Validation function for GLEIF field indices
 */
export function isValidGLEIFFieldIndex(index: number): boolean {
  return Object.values(GLEIF_FIELD_INDICES).includes(index as GLEIFFieldIndex);
}

/**
 * Helper function to get field name by index
 */
export function getGLEIFFieldName(index: number): string | undefined {
  const entry = Object.entries(GLEIF_FIELD_INDICES).find(([_, value]) => value === index);
  return entry ? entry[0] : undefined;
}

// Maintain backward compatibility - export as default as well
export default GLEIF_FIELD_INDICES;

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}
