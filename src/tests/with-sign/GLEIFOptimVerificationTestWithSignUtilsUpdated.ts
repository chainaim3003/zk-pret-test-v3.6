/**
 * Updated GLEIF Verification Test Utils with Infrastructure Support
 * Maintains backward compatibility while using the new infrastructure system
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64 } from 'o1js';
import { GLEIFOptim, GLEIFOptimComplianceData, MerkleWitness8, MERKLE_TREE_HEIGHT } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { GLEIFOptimSmartContract } from '../../contracts/with-sign/GLEIFOptimSmartContract.js';
import { fetchGLEIFCompanyData, GLEIFAPIResponse } from './GLEIFUtils.js';

// Import infrastructure (with fallback to original if not available)
let infrastructureAvailable = false;
let environmentManager: any = null;
let compilationManager: any = null;
let deploymentManager: any = null;
let oracleRegistry: any = null;

try {
  const infrastructure = await import('../../infrastructure/index.js');
  environmentManager = infrastructure.environmentManager;
  compilationManager = infrastructure.compilationManager;
  deploymentManager = infrastructure.deploymentManager;
  await infrastructure.initializeOracleRegistry();
  const { OracleRegistryFactory } = infrastructure;
  oracleRegistry = await OracleRegistryFactory.create();
  infrastructureAvailable = true;
  console.log('✅ Infrastructure system available and initialized');
} catch (error) {
  console.log('ℹ️ Infrastructure system not available, falling back to original implementation');
  // Fallback to original OracleRegistry
  const originalOracle = await import('../../core/OracleRegistry.js');
  console.log('✅ Using original Oracle Registry system');
}

// =================================== Field Indices for Complete GLEIF Merkle Tree ===================================
const GLEIF_FIELD_INDICES = {
  type: 0, id: 1, lei: 2, name: 3, entity_status: 4, registration_status: 5, conformity_flag: 6,
  initialRegistrationDate: 10, lastUpdateDate: 11, nextRenewalDate: 12, expiration_date: 13,
  legalName_language: 20, otherNames_first: 21, otherNames_second: 22,
  legalAddress_language: 30, legalAddress_addressLines: 31, legalAddress_city: 32, 
  legalAddress_region: 33, legalAddress_country: 34, legalAddress_postalCode: 35,
  headquartersAddress_language: 40, headquartersAddress_addressLines: 41, 
  headquartersAddress_city: 42, headquartersAddress_region: 43, 
  headquartersAddress_country: 44, headquartersAddress_postalCode: 45,
  registeredAt_id: 50, jurisdiction: 53, legalForm_id: 54, category: 56,
  managingLou: 60, corroborationLevel: 61, validatedAt_id: 62,
  bic_codes: 70, mic_codes: 71, associatedEntity_lei: 90, successorEntity_lei: 91
};

// =================================== Merkle Tree Creation Functions ===================================

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

// =================================== Main Test Function (Enhanced with Infrastructure) ===================================
export async function getGLEIFOptimVerificationWithSignUtils(companyName: string) {
  console.log(`\n🚀 GLEIF Optimized Verification Test Started`);
  console.log(`🏢 Company: ${companyName}`);
  
  if (infrastructureAvailable) {
    console.log(`🌐 Environment: ${environmentManager.getCurrentEnvironment()}`);
    console.log(`🔧 Using Infrastructure System`);
  } else {
    console.log(`🔧 Using Original Implementation`);
  }

  try {
    // =================================== Compile Programs ===================================
    console.log('\n📝 Compiling ZK programs...');
    
    if (infrastructureAvailable && compilationManager) {
      // Use infrastructure compilation with caching
      await compilationManager.initialize();
      
      const gleifCompilation = await compilationManager.compileProgram('GLEIFOptim');
      if (!gleifCompilation.success) {
        throw new Error(`Failed to compile GLEIFOptim: ${gleifCompilation.error}`);
      }
      console.log('✅ GLEIFOptim compiled via infrastructure (cached if available)');

      const contractCompilation = await compilationManager.compileProgram('GLEIFOptimSmartContract');
      if (!contractCompilation.success) {
        throw new Error(`Failed to compile GLEIFOptimSmartContract: ${contractCompilation.error}`);
      }
      console.log('✅ GLEIFOptimSmartContract compiled via infrastructure (cached if available)');
    } else {
      // Fallback to inline compilation
      await GLEIFOptim.compile();
      console.log('✅ GLEIFOptim ZK program compiled (inline)');
      
      const { verificationKey } = await GLEIFOptimSmartContract.compile();
      console.log('✅ GLEIFOptimSmartContract compiled (inline)');
    }

    // =================================== Deploy Smart Contract ===================================
    console.log('\n🚀 Deploying smart contract...');
    
    let zkApp: GLEIFOptimSmartContract;
    let zkAppAddress: any;
    
    if (infrastructureAvailable && deploymentManager) {
      // Use infrastructure deployment with persistence
      const { contract, deployment } = await deploymentManager.deployContract(
        'GLEIFOptimSmartContract',
        GLEIFOptimSmartContract,
        'GLEIF',
        { useExisting: true }
      );
      zkApp = contract;
      zkAppAddress = deployment.contractAddress;
      console.log(`✅ Smart contract deployed/reused via infrastructure: ${zkAppAddress}`);
    } else {
      // Fallback to inline deployment
      const { GLEIFdeployerAccount, GLEIFdeployerKey } = await import('../../core/OracleRegistry.js');
      
      const zkAppKey = PrivateKey.random();
      zkAppAddress = zkAppKey.toPublicKey();
      zkApp = new GLEIFOptimSmartContract(zkAppAddress);

      const deployTxn = await Mina.transaction(
        GLEIFdeployerAccount,
        async () => {
          AccountUpdate.fundNewAccount(GLEIFdeployerAccount);
          await zkApp.deploy({ verificationKey: await GLEIFOptimSmartContract.compile().then(r => r.verificationKey) });
        }
      );
      await deployTxn.sign([GLEIFdeployerKey, zkAppKey]).send();
      console.log('✅ Smart contract deployed (inline)');
    }

    // =================================== Fetch GLEIF Data ===================================
    console.log('\n📡 Fetching GLEIF data...');
    let apiResponse: GLEIFAPIResponse;
    try {
      apiResponse = await fetchGLEIFCompanyData(companyName);
      console.log('✅ GLEIF data fetched successfully');
    } catch (err: any) {
      console.error('❌ Error fetching GLEIF data:', err.message);
      throw err;
    }

    // =================================== Create Comprehensive Merkle Tree ===================================
    console.log('\n🌳 Creating comprehensive Merkle tree...');
    const { tree, extractedData, fieldCount } = createComprehensiveGLEIFMerkleTree(apiResponse);
    console.log(`✅ Merkle tree created with ${fieldCount} fields`);

    // =================================== Prepare ZK Proof Data ===================================
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

    // =================================== Oracle Signature ===================================
    console.log('\n🔏 Generating oracle signature...');
    let registryPrivateKey: PrivateKey;
    
    if (infrastructureAvailable && oracleRegistry) {
      registryPrivateKey = oracleRegistry.getPrivateKeyFor('GLEIF');
      console.log('✅ Oracle signature generated via infrastructure');
    } else {
      const { getPrivateKeyFor } = await import('../../core/OracleRegistry.js');
      registryPrivateKey = getPrivateKeyFor('GLEIF');
      console.log('✅ Oracle signature generated (original)');
    }
    
    const oracleSignature = Signature.create(registryPrivateKey, [merkleRoot]);

    // =================================== Generate ZK Proof ===================================
    console.log('\n⚡ Generating ZK proof...');
    console.log(`📊 Proving compliance for: ${complianceData.name.toString()}`);
    console.log(`🆔 LEI: ${complianceData.lei.toString()}`);
    console.log(`📈 Entity Status: ${complianceData.entity_status.toString()}`);
    console.log(`📋 Registration Status: ${complianceData.registration_status.toString()}`);

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

    // =================================== Verify Proof on Smart Contract ===================================
    console.log('\n🔍 Verifying proof on smart contract...');
    console.log('📊 Initial smart contract state:');
    console.log(`  GLEIFCompliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  Total Verifications: ${zkApp.totalVerifications.get().toJSON()}`);
    console.log(`  Last Verification Time: ${zkApp.lastVerificationTime.get().toJSON()}`);

    let senderAccount: any, senderKey: any;
    
    if (infrastructureAvailable && oracleRegistry) {
      senderAccount = oracleRegistry.getSenderAccount('GLEIF');
      senderKey = oracleRegistry.getSenderKey('GLEIF');
    } else {
      const { GLEIFsenderAccount, GLEIFsenderKey } = await import('../../core/OracleRegistry.js');
      senderAccount = GLEIFsenderAccount;
      senderKey = GLEIFsenderKey;
    }

    const txn = await Mina.transaction(
      senderAccount,
      async () => {
        await zkApp.verifyOptimizedComplianceWithProof(proof);
      }
    );

    await txn.prove();
    await txn.sign([senderKey]).send();

    console.log('✅ Proof verified on smart contract!');
    console.log('📊 Final smart contract state:');
    console.log(`  GLEIFCompliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  Total Verifications: ${zkApp.totalVerifications.get().toJSON()}`);
    console.log(`  Last Verification Time: ${zkApp.lastVerificationTime.get().toJSON()}`);

    // =================================== Summary ===================================
    console.log('\n🎉 GLEIF Optimized Verification Completed Successfully!');
    console.log('📈 Summary:');
    console.log(`  • Company: ${complianceData.name.toString()}`);
    console.log(`  • LEI: ${complianceData.lei.toString()}`);
    console.log(`  • Entity Status: ${complianceData.entity_status.toString()}`);
    console.log(`  • Registration Status: ${complianceData.registration_status.toString()}`);
    console.log(`  • GLEIF Compliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  • Verification Count: ${zkApp.totalVerifications.get().toJSON()}`);
    console.log(`  • Last Verification: ${zkApp.lastVerificationTime.get().toJSON()}`);
    console.log(`  • Merkle Tree Fields: ${fieldCount}`);
    console.log(`  • Infrastructure Used: ${infrastructureAvailable ? '✅ Yes' : '❌ No (fallback)'}`);

    if (infrastructureAvailable) {
      const environmentInfo = environmentManager.getEnvironmentInfo();
      console.log(`  • Environment: ${environmentInfo.environment}`);
      console.log(`  • Proofs Enabled: ${environmentInfo.proofsEnabled}`);
      
      const compilationStats = compilationManager.getStats();
      console.log(`  • Compiled Programs: ${compilationStats.compiledPrograms}/${compilationStats.totalPrograms}`);
    }

    return proof;

  } catch (error) {
    console.error('❌ Error in GLEIF Optimized Verification:', error);
    throw error;
  }
}
