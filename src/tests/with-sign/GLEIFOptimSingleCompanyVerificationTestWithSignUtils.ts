import * as dotenv from 'dotenv';
dotenv.config();

import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64 } from 'o1js';
import { 
  GLEIFOptim, 
  GLEIFOptimComplianceData, 
  MerkleWitness8, 
  MERKLE_TREE_HEIGHT 
} from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { GLEIFOptimSingleCompanySmartContract } from '../../contracts/with-sign/GLEIFOptimSingleCompanySmartContract.js';
import { GLEIFdeployerAccount, GLEIFsenderAccount, GLEIFdeployerKey, GLEIFsenderKey, getPrivateKeyFor } from '../../core/OracleRegistry.js';
import { 
  fetchGLEIFDataWithFullLogging, 
  GLEIFAPIResponse,
  extractGLEIFSummary,
  analyzeGLEIFCompliance
} from './GLEIFEnhancedUtils.js';
import { GLEIF_FIELD_INDICES } from './GLEIFFieldIndices.js';

// =================================== Merkle Tree Creation Functions ===================================

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
  function setTreeField(fieldName: string, value: string | undefined, index: number) {
    const safeValue = value || '';
    const circuitValue = CircuitString.fromString(safeValue);
    const hash = circuitValue.hash();
    tree.setLeaf(BigInt(index), hash);
    extractedData[fieldName] = circuitValue;
    fieldCount++;
    console.log(`  Set field ${fieldName} (${index}): "${safeValue.substring(0, 50)}${safeValue.length > 50 ? '...' : ''}"`);  
  }

  try {
    // Since LOCAL now uses live GLEIF API (same as TESTNET/MAINNET), use the same processing logic
    // Handle live GLEIF API structure for all modes
    console.log('📋 Processing live GLEIF API structure...');
    // Extract the first record from GLEIF API response
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

// =================================== Main Single Company Verification Function ===================================
export async function getGLEIFOptimSingleCompanyVerificationWithSignUtils(companyName: string) {
  console.log(`\n🚀 GLEIF Single Company Verification Test Started`);
  console.log(`🏢 Company: ${companyName}`);
  //console.log(`🌐 Network: ${typeOfNet}`);
  console.log(`📡 Using LIVE API for all environments`);

  try {
    // =================================== Setup Local Blockchain ===================================
    console.log('\n🔧 Setting up local blockchain...');
    // Import and use the existing Local blockchain instance from OracleRegistry
    const { Local } = await import('../../core/OracleRegistry.js');
    Mina.setActiveInstance(Local);
    
    // Use existing account setup from OracleRegistry
    const deployerAccount = GLEIFdeployerAccount;
    const deployerKey = GLEIFdeployerKey;
    const senderAccount = GLEIFsenderAccount;
    const senderKey = GLEIFsenderKey;

    // =================================== Compile Programs ===================================
    console.log('\n📝 Compiling ZK programs...');
    await GLEIFOptim.compile();
    console.log('✅ GLEIFOptim ZK program compiled');
    
    const { verificationKey } = await GLEIFOptimSingleCompanySmartContract.compile();
    console.log('✅ GLEIFOptimSingleCompanySmartContract compiled');

    // =================================== Deploy Smart Contract ===================================
    console.log('\n🚀 Deploying single company smart contract...');
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new GLEIFOptimSingleCompanySmartContract(zkAppAddress);

    const deployTxn = await Mina.transaction(
      deployerAccount,
      async () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        await zkApp.deploy({ verificationKey });
      }
    );
    await deployTxn.sign([deployerKey, zkAppKey]).send();
    console.log('✅ Single company smart contract deployed successfully');

    // =================================== Fetch GLEIF Data ===================================
    console.log('\n📡 Fetching GLEIF data...');
    let apiResponse: GLEIFAPIResponse;
    try {
      apiResponse = await fetchGLEIFDataWithFullLogging(companyName);
      console.log('✅ GLEIF data fetched successfully');
    } catch (err: any) {
      console.error('❌ Error fetching GLEIF data:', err.message);
      throw err;
    }

    // =================================== Analyze Compliance ===================================
    console.log('\n🔍 Analyzing compliance...');
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
    console.log('\n🌳 Creating comprehensive Merkle tree...');
    const { tree, extractedData, fieldCount } = createComprehensiveGLEIFMerkleTree(apiResponse);
    console.log(`✅ Merkle tree created with ${fieldCount} fields`);

    // =================================== Prepare ZK Proof Data ===================================
    console.log('\n🔐 Preparing ZK proof data...');
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

    // =================================== Oracle Signature ===================================
    console.log('\n🔏 Generating oracle signature...');
    const registryPrivateKey = getPrivateKeyFor('GLEIF');
    const oracleSignature = Signature.create(registryPrivateKey, [merkleRoot]);
    console.log('✅ Oracle signature generated');

    // =================================== Generate ZK Proof ===================================
    console.log('\n⚡ Generating ZK proof...');
    console.log(`📊 Proving compliance for: ${complianceData.name.toString()}`);
    console.log(`🆔 LEI: ${complianceData.lei.toString()}`);
    console.log(`📋 Entity Status: ${complianceData.entity_status.toString()}`);
    console.log(`📍 Jurisdiction: ${extractedData.jurisdiction ? extractedData.jurisdiction.toString() : 'N/A'}`);

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

    // =================================== Verify Proof on Single Company Smart Contract ===================================
    console.log('\n🔍 Verifying proof on single company smart contract...');
    console.log('📊 Initial smart contract state:');
    console.log(`  Company Identifier Hash: "${zkApp.companyIdentifierHash.get().toString()}"`);
    console.log(`  Company Name Hash: "${zkApp.companyNameHash.get().toString()}"`);
    console.log(`  Jurisdiction Hash: "${zkApp.jurisdictionHash.get().toString()}"`);
    console.log(`  GLEIFCompliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  Total Verifications: ${zkApp.totalVerifications.get().toJSON()}`);
    console.log(`  Last Verification Time: ${zkApp.lastVerificationTime.get().toJSON()}`);

    const txn = await Mina.transaction(
      senderAccount,
      async () => {
        await zkApp.verifyOptimizedComplianceWithProof(proof);
      }
    );

    await txn.prove();
    await txn.sign([senderKey]).send();

    console.log('✅ Proof verified on single company smart contract!');
    console.log('📊 Final smart contract state:');
    console.log(`  Company Identifier Hash: "${zkApp.companyIdentifierHash.get().toString()}"`);
    console.log(`  Company Name Hash: "${zkApp.companyNameHash.get().toString()}"`);
    console.log(`  Jurisdiction Hash: "${zkApp.jurisdictionHash.get().toString()}"`);
    console.log(`  GLEIFCompliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  Current Compliance Score: ${zkApp.currentComplianceScore.get().toJSON()}`);
    console.log(`  Total Verifications: ${zkApp.totalVerifications.get().toJSON()}`);
    console.log(`  First Verification Time: ${zkApp.firstVerificationTime.get().toJSON()}`);
    console.log(`  Last Verification Time: ${zkApp.lastVerificationTime.get().toJSON()}`);

    // =================================== Demonstrate Company Tracking ===================================
    console.log('\n🔍 Testing company tracking capabilities...');
    const companyInfo = zkApp.getCompanyInfo();
    const currentCompliance = zkApp.getCurrentCompliance();
    const verificationStats = zkApp.getVerificationStats();
    
    console.log('📋 Company Information:');
    console.log(`  • Identifier Hash (LEI): ${companyInfo.companyIdentifierHash.toString()}`);
    console.log(`  • Legal Name Hash: ${companyInfo.companyNameHash.toString()}`);
    console.log(`  • Jurisdiction Hash: ${companyInfo.jurisdictionHash.toString()}`);
    console.log(`  • Is Compliant: ${companyInfo.isCompliant.toJSON()}`);
    console.log(`  • Compliance Score: ${companyInfo.complianceScore.toJSON()}`);
    
    console.log('📊 Current Compliance Status:');
    console.log(`  • Status: ${currentCompliance.isCompliant.toJSON()}`);
    console.log(`  • Last Verification: ${new Date(Number(currentCompliance.lastVerificationTime.toString())).toISOString()}`);
    console.log(`  • Score: ${currentCompliance.complianceScore.toJSON()}`);
    
    console.log('📈 Verification Statistics:');
    console.log(`  • Total Verifications: ${verificationStats.totalVerifications.toJSON()}`);
    console.log(`  • First Verification: ${new Date(Number(verificationStats.firstVerificationTime.toString())).toISOString()}`);
    console.log(`  • Last Verification: ${new Date(Number(verificationStats.lastVerificationTime.toString())).toISOString()}`);
    console.log(`  • Has Been Verified: ${verificationStats.hasBeenVerified.toJSON()}`);

    // =================================== Summary ===================================
    console.log('\n🎉 GLEIF Single Company Verification Completed Successfully!');
    console.log('📈 Summary:');
    console.log(`  • Contract Type: Single Company (Enhanced)`);
    console.log(`  • Legal Entity: ${complianceData.name.toString()}`);
    console.log(`  • LEI: ${complianceData.lei.toString()}`);
    console.log(`  • Entity Status: ${complianceData.entity_status.toString()}`);
    console.log(`  • Legal Form: ${extractedData.legalForm ? extractedData.legalForm.toString() : 'N/A'}`);
    console.log(`  • Jurisdiction: ${extractedData.jurisdiction ? extractedData.jurisdiction.toString() : 'N/A'}`);
    console.log(`  • GLEIF Compliant: ${zkApp.GLEIFCompliant.get().toJSON()}`);
    console.log(`  • Compliance Score: ${complianceAnalysis.complianceScore}%`);
    console.log(`  • Contract Verification Count: ${zkApp.totalVerifications.get().toJSON()}`);
    console.log(`  • LEI Identity Locked: ✅`);
    console.log(`  • Historical Tracking: ✅`);
    console.log(`  • Multiple Verifications Support: ✅`);

    return proof;

  } catch (error) {
    console.error('❌ Error in GLEIF Single Company Verification:', error);
    throw error;
  }
}
