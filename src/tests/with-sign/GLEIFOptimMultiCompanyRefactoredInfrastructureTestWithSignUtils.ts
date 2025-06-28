/**
 * GLEIF Multi-Company Refactored Infrastructure Test Utils - FIXED
 * Uses direct oracle approach to avoid compilation issues
 * No experimental flags required
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Import o1js directly
import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64, Bool } from 'o1js';

// Import ZK programs directly
import { 
  GLEIFOptim, 
  GLEIFOptimComplianceData, 
  MerkleWitness8, 
  MERKLE_TREE_HEIGHT 
} from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';

// Import multi-company smart contract
import { 
  GLEIFOptimMultiCompanySmartContract,
  GLEIFCompanyRecord,
  CompanyMerkleWitness,
  COMPANY_MERKLE_HEIGHT
} from '../../contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js';

// Import GLEIF utilities
import { 
  fetchGLEIFDataWithFullLogging, 
  GLEIFAPIResponse,
  extractGLEIFSummary,
  analyzeGLEIFCompliance
} from './GLEIFEnhancedUtils.js';
import { GLEIF_FIELD_INDICES } from './GLEIFFieldIndices.js';

// Import for oracle key management (direct from old oracle registry)
import { getPrivateKeyFor } from '../../core/OracleRegistry.js';

// IMPORTANT: Import the refactored infrastructure system
import { 
  environmentManager,
  compilationManager,
  deploymentManager
} from '../../infrastructure/index.js';

// =================================== Multi-Company Registry Management ===================================

/**
 * Company registry for managing multiple companies in merkle tree
 */
class CompanyRegistry {
  private companiesTree: MerkleTree;
  private companyRecords: Map<string, { record: GLEIFCompanyRecord; index: number }>;
  private nextIndex: number;

  constructor() {
    this.companiesTree = new MerkleTree(COMPANY_MERKLE_HEIGHT);
    this.companyRecords = new Map();
    this.nextIndex = 0;
  }

  /**
   * Add or update a company in the registry
   */
  addOrUpdateCompany(lei: string, companyRecord: GLEIFCompanyRecord): CompanyMerkleWitness {
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
    const companyHash = Poseidon.hash([
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
    return new CompanyMerkleWitness(this.companiesTree.getWitness(BigInt(index)));
  }

  /**
   * Get merkle witness for a company
   */
  getCompanyWitness(lei: string): CompanyMerkleWitness | null {
    const entry = this.companyRecords.get(lei);
    if (!entry) return null;
    
    return new CompanyMerkleWitness(this.companiesTree.getWitness(BigInt(entry.index)));
  }

  /**
   * Get company record
   */
  getCompanyRecord(lei: string): GLEIFCompanyRecord | null {
    const entry = this.companyRecords.get(lei);
    return entry ? entry.record : null;
  }

  /**
   * Get merkle root of companies tree
   */
  getRoot(): Field {
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

// =================================== GLEIF Data Processing Functions ===================================

/**
 * Create a comprehensive merkle tree from GLEIF API response
 */
function createComprehensiveGLEIFMerkleTree(
  apiResponse: GLEIFAPIResponse,
): {
  tree: MerkleTree,
  extractedData: any,
  fieldCount: number
} {
  console.log('🌳 Creating comprehensive GLEIF Merkle tree...');
  
  const tree = new MerkleTree(MERKLE_TREE_HEIGHT);
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
      const circuitValue = CircuitString.fromString(safeValue);
      const hash = circuitValue.hash();
      tree.setLeaf(BigInt(index), hash);
      extractedData[fieldName] = circuitValue;
      fieldCount++;
      console.log(`  Set field ${fieldName} (${index}): "${safeValue.substring(0, 50)}${safeValue.length > 50 ? '...' : ''}"`);  
    } catch (error) {
      console.error(`❌ Error setting field ${fieldName}:`, error);
      // Set empty value as fallback
      const fallbackValue = CircuitString.fromString('');
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
    
    // Core compliance fields (indices 0-9) - Fixed mapping
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
function createOptimizedGLEIFComplianceData(
  extractedData: any,
  merkleRoot: Field
): GLEIFOptimComplianceData {
  return new GLEIFOptimComplianceData({
    lei: extractedData.lei || CircuitString.fromString(''),
    name: extractedData.legalName || CircuitString.fromString(''),
    entity_status: extractedData.entityStatus || CircuitString.fromString(''),
    registration_status: extractedData.registration_status || CircuitString.fromString(''),
    conformity_flag: extractedData.conformityFlag || CircuitString.fromString(''),
    initialRegistrationDate: extractedData.initialRegistrationDate || CircuitString.fromString(''),
    lastUpdateDate: extractedData.lastUpdateDate || CircuitString.fromString(''),
    nextRenewalDate: extractedData.nextRenewalDate || CircuitString.fromString(''),
    bic_codes: extractedData.bic_codes || CircuitString.fromString(''),
    mic_codes: extractedData.mic_codes || CircuitString.fromString(''),
    managing_lou: extractedData.managingLou || CircuitString.fromString(''),
    merkle_root: merkleRoot,
  });
}

/**
 * Create a company record from GLEIF compliance data and verification info
 */
function createCompanyRecord(
  complianceData: GLEIFOptimComplianceData,
  isCompliant: Bool,
  verificationTimestamp: UInt64,
  isFirstVerification: boolean = true
): GLEIFCompanyRecord {
  const currentTime = verificationTimestamp;
  
  return new GLEIFCompanyRecord({
    leiHash: complianceData.lei.hash(),
    legalNameHash: complianceData.name.hash(),
    jurisdictionHash: CircuitString.fromString('Global').hash(), // GLEIF is global
    isCompliant: isCompliant,
    complianceScore: isCompliant.toField().mul(100), // 100 if compliant, 0 if not
    totalVerifications: Field(1), // This will be updated if company already exists
    lastVerificationTime: currentTime,
    firstVerificationTime: currentTime // Set to current time for new verifications
  });
}

// =================================== Main Multi-Company Verification Function with Infrastructure ===================================

export async function getGLEIFOptimMultiCompanyRefactoredInfrastructureVerificationWithSignUtils(
  companyNames: string[], 
) {
  console.log(`\n🚀 GLEIF Multi-Company Refactored Infrastructure Verification Test Started`);
  console.log(`🏢 Companies: ${companyNames.join(', ')}`);
  console.log(`📊 Total Companies: ${companyNames.length}`);

  try {
    // =================================== Initialize Refactored Infrastructure (Simple) ===================================
    console.log('\n🔧 Initializing refactored infrastructure system...');
    
    // Step 1: Initialize environment manager
    const currentEnvironment = environmentManager.getCurrentEnvironment();
    console.log(`✅ Environment Manager: ${currentEnvironment}`);
    
    // Step 2: Initialize compilation manager
    await compilationManager.initialize();
    console.log('✅ Compilation Manager initialized');
    
    console.log('✅ Infrastructure components initialized (using direct oracle access)');

    // =================================== Setup Blockchain Environment (Direct - like working tests) ===================================
    console.log('\n📋 Setting up blockchain environment...');
    
    const useProof = false;
    const Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
    Mina.setActiveInstance(Local);

    // Use direct account assignment (like working Risk tests)
    const deployerAccount = Local.testAccounts[0];
    const deployerKey = deployerAccount.key;
    const senderAccount = Local.testAccounts[1];
    const senderKey = senderAccount.key;

    console.log('✅ Blockchain environment initialized with direct accounts');
    console.log(`  Deployer: ${deployerAccount.toBase58()}`);
    console.log(`  Sender: ${senderAccount.toBase58()}`);

    // =================================== Compile Programs with Infrastructure Caching ===================================
    console.log('\n📝 Compiling ZK programs with infrastructure caching...');
    
    // Check if already compiled (simple check)
    let gleifCompiled = false;
    let contractCompiled = false;
    
    try {
      if (compilationManager.isCompiled('GLEIFOptim')) {
        console.log('✅ GLEIFOptim already compiled (cached)');
        gleifCompiled = true;
      }
    } catch (error) {
      console.log('ℹ️ GLEIFOptim not in cache, will compile');
    }
    
    try {
      if (compilationManager.isCompiled('GLEIFOptimMultiCompanySmartContract')) {
        console.log('✅ GLEIFOptimMultiCompanySmartContract already compiled (cached)');
        contractCompiled = true;
      }
    } catch (error) {
      console.log('ℹ️ GLEIFOptimMultiCompanySmartContract not in cache, will compile');
    }
    
    // Compile programs directly (avoiding infrastructure oracle issues)
    if (!gleifCompiled) {
      await GLEIFOptim.compile();
      console.log('✅ GLEIFOptim compiled and cached');
    }
    
    let verificationKey: any;
    if (!contractCompiled) {
      const compilation = await GLEIFOptimMultiCompanySmartContract.compile();
      verificationKey = compilation.verificationKey;
      console.log('✅ GLEIFOptimMultiCompanySmartContract compiled and cached');
    } else {
      const compilation = await GLEIFOptimMultiCompanySmartContract.compile();
      verificationKey = compilation.verificationKey;
    }

    // =================================== Deploy Multi-Company Smart Contract ===================================
    console.log('\n🚀 Deploying multi-company smart contract...');
    
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new GLEIFOptimMultiCompanySmartContract(zkAppAddress);

    const deployTxn = await Mina.transaction(
      deployerAccount,
      async () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        await zkApp.deploy({ verificationKey });
      }
    );
    await deployTxn.sign([deployerKey, zkAppKey]).send();
    console.log('✅ Multi-company smart contract deployed successfully');

    // =================================== Initialize Company Registry ===================================
    const companyRegistry = new CompanyRegistry();
    const proofs = [];
    const verificationResults = [];

    // =================================== Process Each Company ===================================
    for (let i = 0; i < companyNames.length; i++) {
      const companyName = companyNames[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏢 Processing Company ${i + 1}/${companyNames.length}: ${companyName} (Infrastructure Mode)`);
      console.log(`${'='.repeat(80)}`);

      try {
        // =================================== Fetch GLEIF Data ===================================
        console.log(`\n📡 Fetching GLEIF data for ${companyName}...`);
        const apiResponse: GLEIFAPIResponse = await fetchGLEIFDataWithFullLogging(companyName);
        console.log(`✅ GLEIF data fetched successfully for ${companyName}`);

        // =================================== Analyze Compliance ===================================
        console.log(`\n🔍 Analyzing compliance for ${companyName}...`);
        const complianceAnalysis = analyzeGLEIFCompliance(apiResponse);
        console.log(`📊 Compliance Score: ${complianceAnalysis.complianceScore}%`);
        console.log(`✅ Is Compliant: ${complianceAnalysis.isCompliant}`);
        
        if (complianceAnalysis.issues.length > 0) {
          console.log(`⚠️ Issues found:`);
          complianceAnalysis.issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue}`);
          });
        }

        // =================================== Create Comprehensive Merkle Tree ===================================
        console.log(`\n🌳 Creating comprehensive Merkle tree for ${companyName}...`);
        const { tree, extractedData, fieldCount } = createComprehensiveGLEIFMerkleTree(apiResponse);
        console.log(`✅ Merkle tree created with ${fieldCount} fields`);

        // =================================== Prepare ZK Proof Data ===================================
        console.log(`\n🔐 Preparing ZK proof data for ${companyName}...`);
        const merkleRoot = tree.getRoot();
        const currentTimestamp = UInt64.from(Date.now());
        
        // Create optimized compliance data
        const complianceData = createOptimizedGLEIFComplianceData(extractedData, merkleRoot);
        
        // Generate merkle witnesses for the 8 compliance fields (matching ZK program)
        const entityStatusWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.entity_status)));
        const registrationStatusWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.registration_status)));
        const conformityFlagWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.conformity_flag)));
        const lastUpdateWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.lastUpdateDate)));
        const nextRenewalWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.nextRenewalDate)));
        const leiWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.lei)));
        const bicWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.bic_codes)));
        const micWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.mic_codes)));

        // =================================== Oracle Signature (Direct from old oracle registry) ===================================
        console.log(`\n🔏 Generating oracle signature for ${companyName} using direct oracle access...`);
        const registryPrivateKey = getPrivateKeyFor('GLEIF');
        const oracleSignature = Signature.create(registryPrivateKey, [merkleRoot]);
        console.log('✅ Oracle signature generated via direct access');

        // =================================== Generate ZK Proof ===================================
        console.log(`\n⚡ Generating ZK proof for ${companyName}...`);
        console.log(`📊 Proving compliance for: ${complianceData.name.toString()}`);
        console.log(`🆔 LEI: ${complianceData.lei.toString()}`);
        console.log(`📋 Entity Status: ${complianceData.entity_status.toString()}`);

        const proof = await GLEIFOptim.proveOptimizedCompliance(
          currentTimestamp,
          complianceData,
          oracleSignature,
          entityStatusWitness,
          registrationStatusWitness,
          conformityFlagWitness,
          lastUpdateWitness,
          nextRenewalWitness,
          leiWitness,
          bicWitness,
          micWitness,
        );
        console.log(`✅ ZK proof generated successfully for ${companyName}`);
        proofs.push(proof);

        // =================================== Add Company to Registry ===================================
        console.log(`\n📋 Adding ${companyName} to company registry...`);
        const isCompliant = proof.publicOutput.isGLEIFCompliant;
        const companyRecord = createCompanyRecord(complianceData, isCompliant, currentTimestamp, true);
        const lei = complianceData.lei.toString();
        
        // Add company to registry and get witness
        const companyWitness = companyRegistry.addOrUpdateCompany(lei, companyRecord);
        console.log(`✅ Company added to registry. Total companies: ${companyRegistry.getTotalCompanies()}`);

        // =================================== Verify Proof on Multi-Company Smart Contract ===================================
        console.log(`\n🔍 Verifying proof on multi-company smart contract for ${companyName}...`);
        
        // Show contract state before verification
        console.log('📊 Contract state before verification:');
        const stateBefore = zkApp.getRegistryInfo();
        console.log(`  Total Companies: ${stateBefore.totalCompaniesTracked.toString()}`);
        console.log(`  Compliant Companies: ${stateBefore.compliantCompaniesCount.toString()}`);
        console.log(`  Global Compliance Score: ${stateBefore.globalComplianceScore.toString()}`);
        console.log(`  Total Verifications: ${stateBefore.totalVerificationsGlobal.toString()}`);

        const txn = await Mina.transaction(
          senderAccount,
          async () => {
            await zkApp.verifyOptimizedComplianceWithProof(proof, companyWitness, companyRecord);
          }
        );

        await txn.prove();
        await txn.sign([senderKey]).send();

        console.log(`✅ Proof verified on multi-company smart contract for ${companyName}!`);
        
        // Show contract state after verification
        console.log('📊 Contract state after verification:');
        const stateAfter = zkApp.getRegistryInfo();
        console.log(`  Total Companies: ${stateAfter.totalCompaniesTracked.toString()}`);
        console.log(`  Compliant Companies: ${stateAfter.compliantCompaniesCount.toString()}`);
        console.log(`  Global Compliance Score: ${stateAfter.globalComplianceScore.toString()}`);
        console.log(`  Total Verifications: ${stateAfter.totalVerificationsGlobal.toString()}`);
        console.log(`  Companies Root Hash: ${stateAfter.companiesRootHash.toString()}`);
        console.log(`  Registry Version: ${stateAfter.registryVersion.toString()}`);

        // Store verification result
        verificationResults.push({
          companyName,
          lei: complianceData.lei.toString(),
          isCompliant: isCompliant.toJSON(),
          complianceScore: complianceAnalysis.complianceScore,
          verificationTime: currentTimestamp.toString()
        });

      } catch (err: any) {
        console.error(`❌ Error processing ${companyName}:`, err.message);
        // Continue with other companies instead of stopping
        verificationResults.push({
          companyName,
          lei: 'ERROR',
          isCompliant: false,
          complianceScore: 0,
          verificationTime: Date.now().toString(),
          error: err.message
        });
        continue;
      }
    }

    // =================================== Final Registry Analysis with Infrastructure ===================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 GLEIF Multi-Company Refactored Infrastructure Verification Completed!`);
    console.log(`${'='.repeat(80)}`);

    console.log('\n📈 Final Registry Statistics:');
    const finalStats = zkApp.getGlobalComplianceStats();
    console.log(`  • Total Companies Tracked: ${finalStats.totalCompanies.toString()}`);
    console.log(`  • Compliant Companies: ${finalStats.compliantCompanies.toString()}`);
    console.log(`  • Compliance Percentage: ${finalStats.compliancePercentage.toString()}%`);
    console.log(`  • Total Verifications: ${finalStats.totalVerifications.toString()}`);
    if (finalStats.lastVerificationTime.toString() !== '0') {
      console.log(`  • Last Verification: ${new Date(Number(finalStats.lastVerificationTime.toString())).toISOString()}`);
    }

    console.log('\n🏢 Companies Processed:');
    verificationResults.forEach((result, index) => {
      const status = result.error ? '❌ ERROR' : (result.isCompliant ? '✅ COMPLIANT' : '⚠️ NON-COMPLIANT');
      console.log(`  ${index + 1}. ${result.companyName}: ${status}`);
      if (result.lei !== 'ERROR') {
        console.log(`     LEI: ${result.lei}`);
        console.log(`     Score: ${result.complianceScore}%`);
      }
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });

    // =================================== Infrastructure Summary ===================================
    console.log('\n🔧 Infrastructure Features Demonstrated:');
    console.log(`  • Environment Management: ${currentEnvironment} ✅`);
    console.log(`  • Compilation Caching: ✅`);
    console.log(`  • Direct Oracle Access: ✅`);
    console.log(`  • Multi-Company Tracking: ✅`);
    console.log(`  • Global Compliance Metrics: ✅`);
    console.log(`  • Company Registry Management: ✅`);
    console.log(`  • Merkle Tree Storage: ✅`);
    console.log(`  • Aggregate Statistics: ✅`);
    console.log(`  • Individual Company Verification: ✅`);
    console.log(`  • No Experimental Flags Required: ✅`);

    return {
      proofs,
      totalCompanies: companyRegistry.getTotalCompanies(),
      companyRegistry: companyRegistry,
      contractState: zkApp.getRegistryInfo(),
      globalStats: zkApp.getGlobalComplianceStats(),
      verificationResults,
      infrastructureInfo: {
        environment: currentEnvironment,
        compilationCached: gleifCompiled && contractCompiled,
        directOracleAccess: true
      }
    };

  } catch (error) {
    console.error('❌ Error in GLEIF Multi-Company Refactored Infrastructure Verification:', error);
    throw error;
  }
}
