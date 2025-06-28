/**
 * Refactored GLEIF Verification Test with Infrastructure (Updated)
 * Demonstrates the new centralized compilation and deployment system - fixed version
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64 } from 'o1js';
import { 
  environmentManager,
  compilationManager,
  deploymentManager,
  OracleRegistryFactory,
  initializeOracleRegistry
} from '../../infrastructure/index.js';
import { fetchGLEIFCompanyData, GLEIFAPIResponse } from './GLEIFUtils.js';

// Import the ZK program and smart contract (these will be compiled by the infrastructure)
import { GLEIFOptim, GLEIFOptimComplianceData, MerkleWitness8, MERKLE_TREE_HEIGHT } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { GLEIFOptimSmartContract } from '../../contracts/with-sign/GLEIFOptimSmartContract.js';

// =================================== Field Indices (abbreviated for space) ===================================
const GLEIF_FIELD_INDICES = {
  type: 0, id: 1, lei: 2, name: 3, entity_status: 4, registration_status: 5, conformity_flag: 6,
  initialRegistrationDate: 10, lastUpdateDate: 11, nextRenewalDate: 12,
  legalAddress_city: 32, legalAddress_country: 34, legalAddress_postalCode: 35,
  jurisdiction: 53, legalForm_id: 54, managingLou: 60, corroborationLevel: 61,
  bic_codes: 70, mic_codes: 71
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
    console.log(`  Set field ${fieldName} (${index}): "${safeValue.substring(0, 30)}${safeValue.length > 30 ? '...' : ''}"`);  
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

// =================================== Main Test Function ===================================
async function runGLEIFOptimTestWithInfrastructure(companyName: string) {
  console.log(`\n🚀 GLEIF Optimized Verification Test Started (INFRASTRUCTURE)`);
  console.log(`🏢 Company: ${companyName}`);

  try {
    // =================================== Initialize Infrastructure ===================================
    console.log('\n🔧 Initializing infrastructure...');
    await initializeOracleRegistry();
    await compilationManager.initialize();
    
    const oracleRegistry = await OracleRegistryFactory.create();
    console.log(`✅ Infrastructure initialized for ${environmentManager.getCurrentEnvironment()}`);

    // =================================== Centralized Compilation ===================================
    console.log('\n📝 Compiling ZK programs through infrastructure...');
    
    const gleifCompilation = await compilationManager.compileProgram('GLEIFOptim');
    if (!gleifCompilation.success) {
      throw new Error(`Failed to compile GLEIFOptim: ${gleifCompilation.error}`);
    }
    console.log('✅ GLEIFOptim compiled via infrastructure');

    const contractCompilation = await compilationManager.compileProgram('GLEIFOptimSmartContract');
    if (!contractCompilation.success) {
      throw new Error(`Failed to compile GLEIFOptimSmartContract: ${contractCompilation.error}`);
    }
    console.log('✅ GLEIFOptimSmartContract compiled via infrastructure');

    // =================================== Smart Contract Deployment ===================================
    console.log('\n🚀 Deploying smart contract through infrastructure...');
    
    const { contract: zkApp, deployment } = await deploymentManager.deployContract(
      'GLEIFOptimSmartContract',
      GLEIFOptimSmartContract,
      'GLEIF',
      {
        useExisting: true,
        verificationKey: contractCompilation.verificationKey
      }
    );

    console.log(`✅ Contract: ${deployment.contractAddress}`);

    // =================================== Fetch GLEIF Data ===================================
    console.log('\n📡 Fetching GLEIF data...');
    const apiResponse = await fetchGLEIFCompanyData(companyName);
    console.log('✅ GLEIF data fetched successfully');

    // =================================== Create Merkle Tree ===================================
    console.log('\n🌳 Creating Merkle tree...');
    const { tree, extractedData, fieldCount } = createComprehensiveGLEIFMerkleTree(apiResponse);

    // =================================== Generate ZK Proof ===================================
    console.log('\n⚡ Generating ZK proof...');
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

    // Generate oracle signature
    const registryPrivateKey = oracleRegistry.getPrivateKeyFor('GLEIF');
    const oracleSignature = Signature.create(registryPrivateKey, [merkleRoot]);

    // Generate proof
    const compiledGLEIFOptim = await compilationManager.getCompiledProgram('GLEIFOptim');
    
    const proof = await compiledGLEIFOptim.proveOptimizedCompliance(
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

    // =================================== Verify on Smart Contract ===================================
    console.log('\n🔍 Verifying proof on smart contract...');
    const senderAccount = oracleRegistry.getSenderAccount('GLEIF');
    const senderKey = oracleRegistry.getSenderKey('GLEIF');

    const txn = await Mina.transaction(senderAccount, async () => {
      await zkApp.verifyOptimizedComplianceWithProof(proof);
    });

    await txn.prove();
    await txn.sign([senderKey]).send();

    console.log('✅ Proof verified on smart contract!');
    console.log(`✅ GLEIF Compliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);

    // =================================== Summary ===================================
    console.log('\n🎉 INFRASTRUCTURE TEST COMPLETED SUCCESSFULLY!');
    console.log(`📊 Company: ${complianceData.name.toString()}`);
    console.log(`🆔 LEI: ${complianceData.lei.toString()}`);
    console.log(`🌐 Environment: ${environmentManager.getCurrentEnvironment()}`);
    console.log(`📈 Compilation cached: ${compilationManager.isCompiled('GLEIFOptim')}`);

    return proof;

  } catch (error) {
    console.error('❌ Infrastructure test failed:', error);
    throw error;
  }
}

// =================================== Main Entry Point ===================================
async function main() {
  const companyName = process.argv[2];
  
  if (!companyName) {
    console.error('❌ Error: Company name is required');
    console.log('📖 Usage: node GLEIFInfrastructureTest.js "COMPANY NAME"');
    console.log('📝 Example: node GLEIFInfrastructureTest.js "APPLE INC"');
    process.exit(1);
  }
  
  try {
    await runGLEIFOptimTestWithInfrastructure(companyName);
    console.log('\n🎯 Infrastructure test completed successfully!');
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
  });
}
