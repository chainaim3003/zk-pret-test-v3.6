import * as dotenv from 'dotenv';
dotenv.config();

import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64 } from 'o1js';
import { GLEIFOptim, GLEIFOptimComplianceData, MerkleWitness8, MERKLE_TREE_HEIGHT } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { GLEIFOptimSmartContract } from '../../contracts/with-sign/GLEIFOptimSmartContract.js';
import { GLEIFdeployerAccount, GLEIFsenderAccount, GLEIFdeployerKey, GLEIFsenderKey, getPrivateKeyFor } from '../../core/OracleRegistry.js';
import { fetchGLEIFCompanyData, GLEIFAPIResponse } from './GLEIFUtils.js';

// =================================== Field Indices for Complete GLEIF Merkle Tree ===================================
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
  creationDate: 14,
  
  // Legal name and other names (20-29)
  legalName_language: 20,
  otherNames_first: 21,
  otherNames_second: 22,
  transliteratedOtherNames: 23,
  
  // Legal address (30-39)
  legalAddress_language: 30,
  legalAddress_addressLines: 31,
  legalAddress_city: 32,
  legalAddress_region: 33,
  legalAddress_country: 34,
  legalAddress_postalCode: 35,
  legalAddress_mailRouting: 36,
  
  // Headquarters address (40-49)
  headquartersAddress_language: 40,
  headquartersAddress_addressLines: 41,
  headquartersAddress_city: 42,
  headquartersAddress_region: 43,
  headquartersAddress_country: 44,
  headquartersAddress_postalCode: 45,
  
  // Registration info (50-59)
  registeredAt_id: 50,
  registeredAt_other: 51,
  registeredAs: 52,
  jurisdiction: 53,
  legalForm_id: 54,
  legalForm_other: 55,
  category: 56,
  subCategory: 57,
  
  // Managing and validation (60-69)
  managingLou: 60,
  corroborationLevel: 61,
  validatedAt_id: 62,
  validatedAt_other: 63,
  validatedAs: 64,
  
  // Financial codes (70-79)
  bic_codes: 70,
  mic_codes: 71,
  ocid_codes: 72,
  spglobal_codes: 73,
  isin_codes: 74,
  
  // Relationships (80-89)
  directParent_lei: 80,
  ultimateParent_lei: 81,
  directChildren_count: 82,
  managingLou_related: 83,
  leiIssuer_related: 84,
  
  // Additional fields (90-99)
  associatedEntity_lei: 90,
  successorEntity_lei: 91,
  predecessorEntity_lei: 92,
  
  // Extended address info (100-109)
  otherAddresses_first: 100,
  otherAddresses_second: 101,
  
  // Business metadata (110-119)
  eventGroups: 110,
  fund_info: 111,
  branch_info: 112,
  
  // Compliance and status (120-129)
  registration_validatedStatus: 120,
  entity_expiration_reason: 121,
  registration_conformityFlag: 122,
  
  // Reserve for future expansion (130-255)
  reserved_130: 130,
  reserved_140: 140,
  reserved_150: 150,
};

// =================================== Merkle Tree Creation Functions ===================================

/**
 * Create a comprehensive merkle tree from GLEIF API response
 */
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

  // Helper function to safely join arrays
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
    setTreeField('expiration_date', entity.expiration?.date, GLEIF_FIELD_INDICES.expiration_date);

    // Legal name details
    setTreeField('legalName_language', entity.legalName?.language, GLEIF_FIELD_INDICES.legalName_language);
    setTreeField('otherNames_first', entity.otherNames?.[0]?.name, GLEIF_FIELD_INDICES.otherNames_first);
    setTreeField('otherNames_second', entity.otherNames?.[1]?.name, GLEIF_FIELD_INDICES.otherNames_second);
    setTreeField('transliteratedOtherNames', joinArray(entity.transliteratedOtherNames), GLEIF_FIELD_INDICES.transliteratedOtherNames);

    // Legal address
    const legalAddr = entity.legalAddress;
    if (legalAddr) {
      setTreeField('legalAddress_language', legalAddr.language, GLEIF_FIELD_INDICES.legalAddress_language);
      setTreeField('legalAddress_addressLines', joinArray(legalAddr.addressLines), GLEIF_FIELD_INDICES.legalAddress_addressLines);
      setTreeField('legalAddress_city', legalAddr.city, GLEIF_FIELD_INDICES.legalAddress_city);
      setTreeField('legalAddress_region', legalAddr.region, GLEIF_FIELD_INDICES.legalAddress_region);
      setTreeField('legalAddress_country', legalAddr.country, GLEIF_FIELD_INDICES.legalAddress_country);
      setTreeField('legalAddress_postalCode', legalAddr.postalCode, GLEIF_FIELD_INDICES.legalAddress_postalCode);
      setTreeField('legalAddress_mailRouting', legalAddr.mailRouting, GLEIF_FIELD_INDICES.legalAddress_mailRouting);
    }

    // Headquarters address
    const hqAddr = entity.headquartersAddress;
    if (hqAddr) {
      setTreeField('headquartersAddress_language', hqAddr.language, GLEIF_FIELD_INDICES.headquartersAddress_language);
      setTreeField('headquartersAddress_addressLines', joinArray(hqAddr.addressLines), GLEIF_FIELD_INDICES.headquartersAddress_addressLines);
      setTreeField('headquartersAddress_city', hqAddr.city, GLEIF_FIELD_INDICES.headquartersAddress_city);
      setTreeField('headquartersAddress_region', hqAddr.region, GLEIF_FIELD_INDICES.headquartersAddress_region);
      setTreeField('headquartersAddress_country', hqAddr.country, GLEIF_FIELD_INDICES.headquartersAddress_country);
      setTreeField('headquartersAddress_postalCode', hqAddr.postalCode, GLEIF_FIELD_INDICES.headquartersAddress_postalCode);
    }

    // Registration details
    setTreeField('registeredAt_id', entity.registeredAt?.id, GLEIF_FIELD_INDICES.registeredAt_id);
    setTreeField('registeredAt_other', entity.registeredAt?.other, GLEIF_FIELD_INDICES.registeredAt_other);
    setTreeField('registeredAs', entity.registeredAs, GLEIF_FIELD_INDICES.registeredAs);
    setTreeField('jurisdiction', entity.jurisdiction, GLEIF_FIELD_INDICES.jurisdiction);
    setTreeField('legalForm_id', entity.legalForm?.id, GLEIF_FIELD_INDICES.legalForm_id);
    setTreeField('legalForm_other', entity.legalForm?.other, GLEIF_FIELD_INDICES.legalForm_other);
    setTreeField('category', entity.category, GLEIF_FIELD_INDICES.category);

    // Managing and validation
    setTreeField('managingLou', registration.managingLou, GLEIF_FIELD_INDICES.managingLou);
    setTreeField('corroborationLevel', registration.corroborationLevel, GLEIF_FIELD_INDICES.corroborationLevel);
    setTreeField('validatedAt_id', registration.validatedAt?.id, GLEIF_FIELD_INDICES.validatedAt_id);
    setTreeField('validatedAt_other', registration.validatedAt?.other, GLEIF_FIELD_INDICES.validatedAt_other);
    setTreeField('validatedAs', registration.validatedAs, GLEIF_FIELD_INDICES.validatedAs);

    // Financial codes
    setTreeField('bic_codes', joinArray(record.attributes.bic), GLEIF_FIELD_INDICES.bic_codes);
    setTreeField('mic_codes', joinArray(record.attributes.mic), GLEIF_FIELD_INDICES.mic_codes);
    setTreeField('ocid_codes', joinArray(record.attributes.ocid), GLEIF_FIELD_INDICES.ocid_codes);
    setTreeField('spglobal_codes', joinArray(record.attributes.spglobal), GLEIF_FIELD_INDICES.spglobal_codes);

    // Associated entities
    setTreeField('associatedEntity_lei', entity.associatedEntity?.lei, GLEIF_FIELD_INDICES.associatedEntity_lei);
    setTreeField('successorEntity_lei', entity.successorEntity?.lei, GLEIF_FIELD_INDICES.successorEntity_lei);

    // Other addresses
    setTreeField('otherAddresses_first', entity.otherAddresses?.[0]?.type, GLEIF_FIELD_INDICES.otherAddresses_first);
    setTreeField('otherAddresses_second', entity.otherAddresses?.[1]?.type, GLEIF_FIELD_INDICES.otherAddresses_second);

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
export async function getGLEIFOptimVerificationWithSignUtils(companyName: string) {
  console.log(`\n🚀 GLEIF Optimized Verification Test Started`);
  console.log(`🏢 Company: ${companyName}`);
  //console.log(`🌐 Network: ${typeOfNet}`);

  try {
    // =================================== Compile Programs ===================================
    console.log('\n📝 Compiling ZK programs...');
    await GLEIFOptim.compile();
    console.log('✅ GLEIFOptim ZK program compiled');
    
    const { verificationKey } = await GLEIFOptimSmartContract.compile();
    console.log('✅ GLEIFOptimSmartContract compiled');

    // =================================== Deploy Smart Contract ===================================
    console.log('\n🚀 Deploying smart contract...');
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new GLEIFOptimSmartContract(zkAppAddress);

    const deployTxn = await Mina.transaction(
      GLEIFdeployerAccount,
      async () => {
        AccountUpdate.fundNewAccount(GLEIFdeployerAccount);
        await zkApp.deploy({ verificationKey });
      }
    );
    await deployTxn.sign([GLEIFdeployerKey, zkAppKey]).send();
    console.log('✅ Smart contract deployed successfully');

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
    
    // Create optimized compliance data
    const complianceData = createOptimizedComplianceData(extractedData, merkleRoot);
    
    // Generate merkle witnesses for the specific fields we want to prove
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
    console.log(`📈 Entity Status: ${complianceData.entity_status.toString()}`);
    console.log(`📋 Registration Status: ${complianceData.registration_status.toString()}`);
    console.log(`🏷️ Conformity Flag: ${complianceData.conformity_flag.toString()}`);

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
    console.log(`  • Witnesses Generated: 8 fields`);
    console.log(`  • Privacy: ${fieldCount - 8} fields remain hidden`);

    return proof;

  } catch (error) {
    console.error('❌ Error in GLEIF Optimized Verification:', error);
    throw error;
  }
}
