/**
 * GLEIF Infrastructure Test Utils - No Experimental Flags Required
 * Follows the exact same pattern as GLEIFOptimVerificationTestWithSignUtils.ts
 * but incorporates the infrastructure system
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Import o1js directly (same as original working tests)
import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64 } from 'o1js';

// Import ZK programs directly (same as original working tests)
import { GLEIFOptim, GLEIFOptimComplianceData, MerkleWitness8, MERKLE_TREE_HEIGHT } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { GLEIFOptimSmartContract } from '../../contracts/with-sign/GLEIFOptimSmartContract.js';

// Import original oracle registry (keeping compatibility)
import { GLEIFdeployerAccount, GLEIFsenderAccount, GLEIFdeployerKey, GLEIFsenderKey, getPrivateKeyFor } from '../../core/OracleRegistry.js';

// Import GLEIF utilities (same as original)
import { fetchGLEIFCompanyData, GLEIFAPIResponse } from './GLEIFUtils.js';

// NEW: Import infrastructure system for initialization only
import { 
  environmentManager,
  compilationManager,
  deploymentManager,
  initializeOracleRegistry
} from '../../infrastructure/index.js';

// =================================== Field Indices (same as original) ===================================
const GLEIF_FIELD_INDICES = {
  // Core identifiers (0-9)
  type: 0,
  id: 1,
  lei: 2,
  name: 3,
  entity_status: 4,
  registration_status: 5,
  conformity_flag: 6,
  
  // Temporal fields (10-19)
  initialRegistrationDate: 10,
  lastUpdateDate: 11,
  nextRenewalDate: 12,
  expiration_date: 13,
  
  // Legal address (30-39)
  legalAddress_city: 32,
  legalAddress_country: 34,
  legalAddress_postalCode: 35,
  
  // Registration info (50-59)
  jurisdiction: 53,
  legalForm_id: 54,
  
  // Managing and validation (60-69)
  managingLou: 60,
  corroborationLevel: 61,
  
  // Financial codes (70-79)
  bic_codes: 70,
  mic_codes: 71,
};

// =================================== Merkle Tree Creation (same logic as original) ===================================
function createComprehensiveGLEIFMerkleTree(apiResponse: GLEIFAPIResponse): {
  tree: MerkleTree,
  extractedData: any,
  fieldCount: number
} {
  console.log('🌳 Creating comprehensive GLEIF Merkle tree...');
  
  const tree = new MerkleTree(MERKLE_TREE_HEIGHT);
  const record = apiResponse.data[0];
  const entity = record.attributes.entity;
  const registration = record.attributes.registration;
  
  let fieldCount = 0;
  const extractedData: any = {};

  function setTreeField(fieldName: string, value: string | undefined, index: number) {
    const safeValue = value || '';
    const circuitValue = CircuitString.fromString(safeValue);
    const hash = circuitValue.hash();
    tree.setLeaf(BigInt(index), hash);
    extractedData[fieldName] = circuitValue;
    fieldCount++;
    console.log(`  Set field ${fieldName} (${index}): "${safeValue.substring(0, 50)}${safeValue.length > 50 ? '...' : ''}"`);  
  }

  function joinArray(arr: any[] | undefined): string {
    if (!Array.isArray(arr)) return '';
    return arr.map(item => typeof item === 'string' ? item : item?.name || '').join(', ');
  }

  try {
    // Core identifiers
    setTreeField('type', record.type, GLEIF_FIELD_INDICES.type);
    setTreeField('id', record.id, GLEIF_FIELD_INDICES.id);
    setTreeField('lei', record.attributes.lei, GLEIF_FIELD_INDICES.lei);
    setTreeField('name', entity.legalName?.name, GLEIF_FIELD_INDICES.name);
    setTreeField('entity_status', entity.status, GLEIF_FIELD_INDICES.entity_status);
    setTreeField('registration_status', registration.status, GLEIF_FIELD_INDICES.registration_status);
    setTreeField('conformity_flag', record.attributes.conformityFlag || (registration as any).conformityFlag, GLEIF_FIELD_INDICES.conformity_flag);

    // Temporal fields
    setTreeField('initialRegistrationDate', registration.initialRegistrationDate, GLEIF_FIELD_INDICES.initialRegistrationDate);
    setTreeField('lastUpdateDate', registration.lastUpdateDate, GLEIF_FIELD_INDICES.lastUpdateDate);
    setTreeField('nextRenewalDate', registration.nextRenewalDate, GLEIF_FIELD_INDICES.nextRenewalDate);

    // Address information
    const legalAddr = entity.legalAddress;
    if (legalAddr) {
      setTreeField('legalAddress_city', legalAddr.city, GLEIF_FIELD_INDICES.legalAddress_city);
      setTreeField('legalAddress_country', legalAddr.country, GLEIF_FIELD_INDICES.legalAddress_country);
      setTreeField('legalAddress_postalCode', legalAddr.postalCode, GLEIF_FIELD_INDICES.legalAddress_postalCode);
    }

    // Registration details
    setTreeField('jurisdiction', entity.jurisdiction, GLEIF_FIELD_INDICES.jurisdiction);
    setTreeField('legalForm_id', entity.legalForm?.id, GLEIF_FIELD_INDICES.legalForm_id);

    // Managing and validation
    setTreeField('managingLou', registration.managingLou, GLEIF_FIELD_INDICES.managingLou);
    setTreeField('corroborationLevel', registration.corroborationLevel, GLEIF_FIELD_INDICES.corroborationLevel);

    // Financial codes
    setTreeField('bic_codes', joinArray(record.attributes.bic), GLEIF_FIELD_INDICES.bic_codes);
    setTreeField('mic_codes', joinArray(record.attributes.mic), GLEIF_FIELD_INDICES.mic_codes);

    console.log(`✅ Created Merkle tree with ${fieldCount} fields`);
    console.log(`🌳 Merkle root: ${tree.getRoot().toString()}`);
    
    return { tree, extractedData, fieldCount };
    
  } catch (error) {
    console.error('❌ Error creating Merkle tree:', error);
    throw error;
  }
}

function createOptimizedComplianceData(
  extractedData: any,
  merkleRoot: Field
): GLEIFOptimComplianceData {
  return new GLEIFOptimComplianceData({
    lei: extractedData.lei || CircuitString.fromString(''),
    name: extractedData.name || CircuitString.fromString(''),
    entity_status: extractedData.entity_status || CircuitString.fromString(''),
    registration_status: extractedData.registration_status || CircuitString.fromString(''),
    conformity_flag: extractedData.conformity_flag || CircuitString.fromString(''),
    initialRegistrationDate: extractedData.initialRegistrationDate || CircuitString.fromString(''),
    lastUpdateDate: extractedData.lastUpdateDate || CircuitString.fromString(''),
    nextRenewalDate: extractedData.nextRenewalDate || CircuitString.fromString(''),
    bic_codes: extractedData.bic_codes || CircuitString.fromString(''),
    mic_codes: extractedData.mic_codes || CircuitString.fromString(''),
    managing_lou: extractedData.managingLou || CircuitString.fromString(''),
    merkle_root: merkleRoot,
  });
}

// =================================== Main Test Function with Infrastructure ===================================
export async function getGLEIFOptimInfrastructureVerificationWithSignUtils(companyName: string) {
  console.log(`\n🚀 GLEIF Infrastructure Verification Test Started`);
  console.log(`🏢 Company: ${companyName}`);

  try {
    // =================================== NEW: Initialize Infrastructure System ===================================
    console.log('\n🔧 Initializing infrastructure system...');
    
    // Initialize infrastructure components
    await initializeOracleRegistry();
    await compilationManager.initialize();
    
    const currentEnvironment = environmentManager.getCurrentEnvironment();
    console.log(`✅ Infrastructure initialized for environment: ${currentEnvironment}`);

    // =================================== Compilation with Infrastructure Caching ===================================
    console.log('\n📝 Compiling ZK programs with infrastructure...');
    
    // Check if programs are already compiled (cached)
    if (compilationManager.isCompiled('GLEIFOptim')) {
      console.log('✅ GLEIFOptim already compiled (cached)');
    } else {
      await GLEIFOptim.compile();
      console.log('✅ GLEIFOptim compiled and cached');
    }
    
    if (compilationManager.isCompiled('GLEIFOptimSmartContract')) {
      console.log('✅ GLEIFOptimSmartContract already compiled (cached)');
    } else {
      const { verificationKey } = await GLEIFOptimSmartContract.compile();
      console.log('✅ GLEIFOptimSmartContract compiled and cached');
    }

    // =================================== Smart Contract Deployment with Infrastructure ===================================
    console.log('\n🚀 Deploying smart contract with infrastructure...');
    
    // Use the infrastructure deployment manager
    const { contract: zkApp, deployment } = await deploymentManager.deployContract(
      'GLEIFOptimSmartContract',
      GLEIFOptimSmartContract,
      'GLEIF',
      {
        useExisting: true, // Try to reuse existing deployment
        verificationKey: await GLEIFOptimSmartContract.compile().then(c => c.verificationKey)
      }
    );
    
    console.log(`✅ Contract deployed/retrieved: ${deployment.contractAddress}`);

    // =================================== GLEIF Data Processing (same as original) ===================================
    console.log('\n📡 Fetching GLEIF data...');
    const apiResponse: GLEIFAPIResponse = await fetchGLEIFCompanyData(companyName);
    console.log('✅ GLEIF data fetched successfully');

    // =================================== Merkle Tree Creation (same as original) ===================================
    console.log('\n🌳 Creating comprehensive Merkle tree...');
    const { tree, extractedData, fieldCount } = createComprehensiveGLEIFMerkleTree(apiResponse);
    console.log(`✅ Merkle tree created with ${fieldCount} fields`);

    // =================================== ZK Proof Generation (same as original) ===================================
    console.log('\n🔐 Preparing ZK proof data...');
    const merkleRoot = tree.getRoot();
    const currentTimestamp = UInt64.from(Date.now());
    
    const complianceData = createOptimizedComplianceData(extractedData, merkleRoot);
    
    // Generate merkle witnesses
    const entityStatusWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.entity_status)));
    const registrationStatusWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.registration_status)));
    const conformityFlagWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.conformity_flag)));
    const lastUpdateWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.lastUpdateDate)));
    const nextRenewalWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.nextRenewalDate)));
    const leiWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.lei)));
    const bicWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.bic_codes)));
    const micWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.mic_codes)));

    // =================================== Oracle Signature (same as original) ===================================
    console.log('\n🔏 Generating oracle signature...');
    const registryPrivateKey = getPrivateKeyFor('GLEIF');
    const oracleSignature = Signature.create(registryPrivateKey, [merkleRoot]);
    console.log('✅ Oracle signature generated');

    // =================================== Generate ZK Proof (same as original) ===================================
    console.log('\n⚡ Generating ZK proof...');
    console.log(`📊 Proving compliance for: ${complianceData.name.toString()}`);
    console.log(`🆔 LEI: ${complianceData.lei.toString()}`);

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
    console.log('✅ ZK proof generated successfully');

    // =================================== Smart Contract Verification (same as original) ===================================
    console.log('\n🔍 Verifying proof on smart contract...');
    console.log('📊 Initial smart contract state:');
    console.log(`  GLEIFCompliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  Total Verifications: ${zkApp.totalVerifications.get().toJSON()}`);

    const txn = await Mina.transaction(
      GLEIFsenderAccount,
      async () => {
        await zkApp.verifyOptimizedComplianceWithProof(proof);
      }
    );

    await txn.prove();
    await txn.sign([GLEIFsenderKey]).send();

    console.log('✅ Proof verified on smart contract!');
    console.log('📊 Final smart contract state:');
    console.log(`  GLEIFCompliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  Total Verifications: ${zkApp.totalVerifications.get().toJSON()}`);

    // =================================== Infrastructure Summary ===================================
    console.log('\n🎉 GLEIF Infrastructure Test Completed Successfully!');
    console.log('📈 Summary:');
    console.log(`  • Company: ${complianceData.name.toString()}`);
    console.log(`  • LEI: ${complianceData.lei.toString()}`);
    console.log(`  • Environment: ${currentEnvironment}`);
    console.log(`  • Compilation Cached: ${compilationManager.isCompiled('GLEIFOptim')}`);
    console.log(`  • Deployment Managed: ✅`);
    console.log(`  • GLEIF Compliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);

    return proof;

  } catch (error) {
    console.error('❌ Error in GLEIF Infrastructure Verification:', error);
    throw error;
  }
}
