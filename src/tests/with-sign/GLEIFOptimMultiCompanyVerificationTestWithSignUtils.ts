/**
 * GLEIFOptimMultiCompanyVerificationTestWithSignUtils.ts
 * 
 * This file contains the main verification function and utility functions for GLEIF compliance verification testing.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, MerkleTree, UInt64, Bool, MerkleMap, MerkleMapWitness } from 'o1js';
import { 
  GLEIFOptim, 
  GLEIFOptimComplianceData, 
  MerkleWitness8, 
  MERKLE_TREE_HEIGHT 
} from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { 
  GLEIFOptimMultiCompanySmartContract,
  GLEIFCompanyRecord,
  CompanyMerkleWitness,
  COMPANY_MERKLE_HEIGHT,
  CompanyKey,
  RegistryInfo,
  GlobalComplianceStats
} from '../../contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js';
import { 
  getGleifDeployerAccount, 
  getGleifSenderAccount, 
  getGleifDeployerKey, 
  getGleifSenderKey, 
  getGleifSignerKey 
} from '../../core/OracleRegistry.js';
import { 
  fetchGLEIFDataWithFullLogging, 
  GLEIFAPIResponse,
  extractGLEIFSummary,
  analyzeGLEIFCompliance,
  CompanyRegistry,
  createComprehensiveGLEIFMerkleTree,
  createOptimizedGLEIFComplianceData,
  createCompanyRecord
} from './GLEIFEnhancedUtils.js';
import { GLEIF_FIELD_INDICES } from './GLEIFFieldIndices.js';

// =================================== Compliance Analysis Functions ===================================

/**
 * Type guard to check if the contract stats is RegistryInfo
 */
function isRegistryInfo(contractStats: RegistryInfo | GlobalComplianceStats): contractStats is RegistryInfo {
  return 'totalCompaniesTracked' in contractStats;
}

/**
 * ✅ ZK BEST PRACTICE: Calculate compliance percentage outside the circuit
 * Adds percentage field to raw contract data - avoids expensive division in ZK constraints
 */
function addCompliancePercentage(contractStats: RegistryInfo | GlobalComplianceStats): {
  totalCompanies: number;
  compliantCompanies: number;
  compliancePercentage: number;
} & (RegistryInfo | GlobalComplianceStats) {
  let total: number;
  let compliant: number;
  
  if (isRegistryInfo(contractStats)) {
    // RegistryInfo type
    total = Number(contractStats.totalCompaniesTracked.toString());
    compliant = Number(contractStats.compliantCompaniesCount.toString());
  } else {
    // GlobalComplianceStats type
    total = Number(contractStats.totalCompanies.toString());
    compliant = Number(contractStats.compliantCompanies.toString());
  }
  
  const percentage = total > 0 
    ? Math.round((compliant / total) * 100) 
    : 0;
    
  return {
    ...contractStats,
    totalCompanies: total,
    compliantCompanies: compliant,
    compliancePercentage: percentage
  } as any;
}

/**
 * Analyzes compliance fields for GLEIF verification
 */
export function analyzeComplianceFields(complianceData: GLEIFOptimComplianceData): {
  isEntityActive: boolean;
  isRegistrationIssued: boolean;
  isConformityOk: boolean;
  hasValidDates: boolean;
  hasValidLEI: boolean;
  allRulesPassed: boolean;
  rulesPassedCount: number;
} {
  const isEntityActive = complianceData.entity_status.toString() === 'ACTIVE';
  const isRegistrationIssued = complianceData.registration_status.toString() === 'ISSUED';
  const isConformityOk = ['CONFORMING', 'UNKNOWN', ''].includes(complianceData.conformity_flag.toString());
  const hasValidDates = complianceData.lastUpdateDate.toString() !== '' && complianceData.nextRenewalDate.toString() !== '';
  const hasValidLEI = complianceData.lei.toString() !== '';
  
  const allRulesPassed = isEntityActive && isRegistrationIssued && isConformityOk && hasValidDates && hasValidLEI;
  const rulesPassedCount = [isEntityActive, isRegistrationIssued, isConformityOk, hasValidDates, hasValidLEI].filter(Boolean).length;

  return {
    isEntityActive,
    isRegistrationIssued,
    isConformityOk,
    hasValidDates,
    hasValidLEI,
    allRulesPassed,
    rulesPassedCount
  };
}

/**
 * Logs compliance field analysis results
 */
export function logComplianceFieldAnalysis(
  complianceData: GLEIFOptimComplianceData,
  isCompliant: Bool,
  phase: 'Pre-Verification' | 'Post-Verification' = 'Pre-Verification'
): void {
  console.log(`\n🔍 COMPLIANCE FIELD ANALYSIS (${phase}):`);
  
  const analysis = analyzeComplianceFields(complianceData);
  
  console.log(`  🏢 Entity Status: "${complianceData.entity_status.toString()}" → ${analysis.isEntityActive ? '✅ ACTIVE (Pass)' : '❌ NOT ACTIVE (Fail)'}`);
  console.log(`  📋 Registration Status: "${complianceData.registration_status.toString()}" → ${analysis.isRegistrationIssued ? '✅ ISSUED (Pass)' : '❌ NOT ISSUED (Fail)'}`);
  console.log(`  🔍 Conformity Flag: "${complianceData.conformity_flag.toString()}" → ${analysis.isConformityOk ? '✅ ACCEPTABLE (Pass)' : '❌ NON-CONFORMING (Fail)'}`);
  console.log(`  📅 Date Validation: Last Update "${complianceData.lastUpdateDate.toString()}", Next Renewal "${complianceData.nextRenewalDate.toString()}" → ${analysis.hasValidDates ? '✅ VALID DATES (Pass)' : '❌ INVALID DATES (Fail)'}`);
  console.log(`  🆔 LEI Validation: "${complianceData.lei.toString()}" → ${analysis.hasValidLEI ? '✅ VALID LEI (Pass)' : '❌ EMPTY LEI (Fail)'}`);
  
  console.log(`  🏆 Overall Compliance Analysis: ${analysis.allRulesPassed ? '✅ ALL RULES PASSED' : '❌ SOME RULES FAILED'} → ZK Proof Shows: ${isCompliant.toJSON() ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
  console.log(`  📊 Business Rules: ${analysis.rulesPassedCount}/5 passed`);
  console.log(`  📈 Compliance Percentage: ${Math.round((analysis.rulesPassedCount / 5) * 100)}%`);
  
  if (phase === 'Pre-Verification') {
    console.log(`  ⏳ Chain Status: NOT YET VERIFIED - Awaiting smart contract transaction...`);
  } else {
    console.log(`  ✅ Chain Status: VERIFIED AND STORED ON BLOCKCHAIN`);
  }
  
  if (!analysis.allRulesPassed) {
    console.log(`  ⚠️ Rules That ${phase === 'Pre-Verification' ? 'Will' : 'Did'} Fail:`);
    if (!analysis.isEntityActive) console.log(`    - Entity Status must be "ACTIVE", got "${complianceData.entity_status.toString()}"`);
    if (!analysis.isRegistrationIssued) console.log(`    - Registration Status must be "ISSUED", got "${complianceData.registration_status.toString()}"`);
    if (!analysis.isConformityOk) console.log(`    - Conformity Flag must be "CONFORMING", "UNKNOWN" or empty, got "${complianceData.conformity_flag.toString()}"`);
    if (!analysis.hasValidDates) console.log(`    - Last Update and Next Renewal dates must not be empty`);
    if (!analysis.hasValidLEI) console.log(`    - LEI must not be empty`);
  }
}

/**
 * Logs smart contract state information
 */
export function logSmartContractState(
  zkApp: GLEIFOptimMultiCompanySmartContract,
  phase: 'BEFORE' | 'AFTER' = 'BEFORE'
): RegistryInfo {
  console.log(`\n📊 Smart Contract State ${phase} Verification:`);
  const state = zkApp.getRegistryInfo();
  const stateWithPercentage = addCompliancePercentage(state);
  
  console.log(`  Total Companies: ${state.totalCompaniesTracked.toString()}`);
  console.log(`  Compliant Companies: ${state.compliantCompaniesCount.toString()}`);
  console.log(`  Global Compliance Score: ${stateWithPercentage.compliancePercentage}%`);
  console.log(`  Total Verifications: ${state.totalVerificationsGlobal.toString()}`);
  console.log(`  Companies Root Hash: ${state.companiesRootHash.toString()}`);
  console.log(`  Registry Version: ${state.registryVersion.toString()}`);
  
  return state;
}

/**
 * Logs state changes between before and after verification
 */
export function logStateChanges(stateBefore: RegistryInfo, stateAfter: RegistryInfo): void {
  console.log('\n📈 STATE CHANGES:');
  const stateBeforeWithPercentage = addCompliancePercentage(stateBefore);
  const stateAfterWithPercentage = addCompliancePercentage(stateAfter);
  console.log(`  📊 Total Companies: ${stateBefore.totalCompaniesTracked.toString()} → ${stateAfter.totalCompaniesTracked.toString()}`);
  console.log(`  ✅ Compliant Companies: ${stateBefore.compliantCompaniesCount.toString()} → ${stateAfter.compliantCompaniesCount.toString()}`);
  console.log(`  📈 Global Compliance Score: ${stateBeforeWithPercentage.compliancePercentage}% → ${stateAfterWithPercentage.compliancePercentage}%`);
  console.log(`  🔢 Total Verifications: ${stateBefore.totalVerificationsGlobal.toString()} → ${stateAfter.totalVerificationsGlobal.toString()}`);
  console.log(`  🌳 Companies Root Hash: ${stateBefore.companiesRootHash.toString()} → ${stateAfter.companiesRootHash.toString()}`);
  console.log(`  📝 Registry Version: ${stateBefore.registryVersion.toString()} → ${stateAfter.registryVersion.toString()}`);
}

// =================================== Main Multi-Company Verification Function ===================================

export async function getGLEIFOptimMultiCompanyVerificationWithSignUtils(
  companyNames: string[], 
) {
  console.log(`\n🚀 GLEIF Multi-Company Verification Test Started`);
  console.log(`🏢 Companies: ${companyNames.join(', ')}`);
  console.log(`📊 Total Companies: ${companyNames.length}`);

  try {
    // =================================== Setup Local Blockchain ===================================
    console.log('\n🔧 Setting up local blockchain...');
    const { Local } = await import('../../core/OracleRegistry.js');
    Mina.setActiveInstance(Local);
    
    const deployerAccount = getGleifDeployerAccount();
    const deployerKey = getGleifDeployerKey();
    const senderAccount = getGleifSenderAccount();
    const senderKey = getGleifSenderKey();

    // =================================== Compile Programs ===================================
    console.log('\n📝 Compiling ZK programs...');
    await GLEIFOptim.compile();
    console.log('✅ GLEIFOptim ZK program compiled');
    
    const { verificationKey } = await GLEIFOptimMultiCompanySmartContract.compile();
    console.log('✅ GLEIFOptimMultiCompanySmartContract compiled');

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

    // =================================== Initialize Company Registry and Real Storage ===================================
    const companyRegistry = new CompanyRegistry(COMPANY_MERKLE_HEIGHT);
    companyRegistry.initializeMerkleTree(MerkleTree);
    
    // Initialize MerkleMap for real company storage (matches smart contract)
    const companiesMap = new MerkleMap();
    
    const proofs = [];
    const verificationResults: any[] = [];

    // =================================== Process Each Company ===================================
    for (let i = 0; i < companyNames.length; i++) {
      const companyName = companyNames[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏢 Processing Company ${i + 1}/${companyNames.length}: ${companyName}`);
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
        const { tree, extractedData, fieldCount } = createComprehensiveGLEIFMerkleTree(
          apiResponse,
          MerkleTree,
          CircuitString,
          MERKLE_TREE_HEIGHT,
          GLEIF_FIELD_INDICES
        );
        console.log(`✅ Merkle tree created with ${fieldCount} fields`);

        // =================================== Prepare ZK Proof Data ===================================
        console.log(`\n🔐 Preparing ZK proof data for ${companyName}...`);
        const merkleRoot = tree.getRoot();
        const currentTimestamp = UInt64.from(Date.now());
        
        // Create optimized compliance data
        const complianceData = createOptimizedGLEIFComplianceData(
          extractedData,
          merkleRoot,
          CircuitString,
          GLEIFOptimComplianceData
        );
        
        // Generate merkle witnesses for the 8 compliance fields (matching ZK program)
        // Add validation to ensure field indices exist before converting to BigInt
        console.log('🔍 Validating field indices before BigInt conversion...');
        
        // Validate all required field indices exist
        const requiredFields = {
          entity_status: GLEIF_FIELD_INDICES.entity_status,
          registration_status: GLEIF_FIELD_INDICES.registration_status,
          conformityFlag: GLEIF_FIELD_INDICES.conformityFlag, // Use camelCase version
          lastUpdateDate: GLEIF_FIELD_INDICES.lastUpdateDate,
          nextRenewalDate: GLEIF_FIELD_INDICES.nextRenewalDate,
          lei: GLEIF_FIELD_INDICES.lei,
          bic_codes: GLEIF_FIELD_INDICES.bic_codes,
          mic_codes: GLEIF_FIELD_INDICES.mic_codes
        };
        
        // Check for undefined indices
        for (const [fieldName, index] of Object.entries(requiredFields)) {
          if (index === undefined) {
            throw new Error(`❌ GLEIF_FIELD_INDICES.${fieldName} is undefined! Cannot convert to BigInt.`);
          }
          console.log(`  ✅ ${fieldName}: ${index}`);
        }
        
        console.log('✅ All field indices validated, proceeding with witness generation...');
        
        const entityStatusWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.entity_status)));
        const registrationStatusWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.registration_status)));
        const conformityFlagWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.conformityFlag))); // Fixed: use conformityFlag instead of conformity_flag
        const lastUpdateWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.lastUpdateDate)));
        const nextRenewalWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.nextRenewalDate)));
        const leiWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.lei)));
        const bicWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.bic_codes)));
        const micWitness = new MerkleWitness8(tree.getWitness(BigInt(GLEIF_FIELD_INDICES.mic_codes)));
        
        console.log('✅ All MerkleWitness8 instances created successfully');

        // =================================== Oracle Signature ===================================
        console.log(`\n🔏 Generating oracle signature for ${companyName}...`);
        const gleifSignerPrivateKey = getGleifSignerKey();
        const oracleSignature = Signature.create(gleifSignerPrivateKey, [merkleRoot]);
        console.log('✅ Oracle signature generated');

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
        
        // =================================== Debug and Validate Company Record Creation ===================================
        console.log(`\n🔍 DEBUGGING COMPANY RECORD CREATION...`);
        console.log(`  Compliance Data Validation:`);
        console.log(`    - complianceData: ${complianceData ? 'EXISTS' : 'NULL/UNDEFINED'}`);
        console.log(`    - complianceData.lei: "${complianceData?.lei?.toString() || 'UNDEFINED'}"`);
        console.log(`    - complianceData.name: "${complianceData?.name?.toString() || 'UNDEFINED'}"`);
        console.log(`    - isCompliant: ${isCompliant ? isCompliant.toString() : 'UNDEFINED'}`);
        console.log(`    - currentTimestamp: ${currentTimestamp ? currentTimestamp.toString() : 'UNDEFINED'}`);
        
        // Validate all required parameters before creating company record
        if (!complianceData) {
          throw new Error('❌ complianceData is null or undefined');
        }
        if (!complianceData.lei) {
          throw new Error('❌ complianceData.lei is null or undefined');
        }
        if (!complianceData.name) {
          throw new Error('❌ complianceData.name is null or undefined');
        }
        if (isCompliant === null || isCompliant === undefined) {
          throw new Error('❌ isCompliant is null or undefined');
        }
        if (!currentTimestamp) {
          throw new Error('❌ currentTimestamp is null or undefined');
        }
        
        console.log(`  ✅ All parameters validated for company record creation`);
        
        // Create company record with enhanced error handling
        let companyRecord: any;
        try {
          console.log(`  🔄 Creating company record...`);
          companyRecord = createCompanyRecord(
            complianceData,
            isCompliant,
            currentTimestamp,
            CircuitString,
            GLEIFCompanyRecord,
            Field,
            true
          );
          console.log(`  ✅ Company record created successfully`);
          
          // Validate the created company record
          console.log(`  🔍 Validating created company record fields:`);
          console.log(`    - leiHash: ${companyRecord.leiHash ? companyRecord.leiHash.toString() : 'UNDEFINED'}`);
          console.log(`    - legalNameHash: ${companyRecord.legalNameHash ? companyRecord.legalNameHash.toString() : 'UNDEFINED'}`);
          console.log(`    - jurisdictionHash: ${companyRecord.jurisdictionHash ? companyRecord.jurisdictionHash.toString() : 'UNDEFINED'}`);
          console.log(`    - isCompliant: ${companyRecord.isCompliant ? companyRecord.isCompliant.toString() : 'UNDEFINED'}`);
          console.log(`    - complianceScore: ${companyRecord.complianceScore ? companyRecord.complianceScore.toString() : 'UNDEFINED'}`);
          console.log(`    - totalVerifications: ${companyRecord.totalVerifications ? companyRecord.totalVerifications.toString() : 'UNDEFINED'}`);
          console.log(`    - passedVerifications: ${companyRecord.passedVerifications ? companyRecord.passedVerifications.toString() : 'UNDEFINED'}`);
          console.log(`    - failedVerifications: ${companyRecord.failedVerifications ? companyRecord.failedVerifications.toString() : 'UNDEFINED'}`);
          console.log(`    - consecutiveFailures: ${companyRecord.consecutiveFailures ? companyRecord.consecutiveFailures.toString() : 'UNDEFINED'}`);
          console.log(`    - lastVerificationTime: ${companyRecord.lastVerificationTime ? companyRecord.lastVerificationTime.toString() : 'UNDEFINED'}`);
          console.log(`    - firstVerificationTime: ${companyRecord.firstVerificationTime ? companyRecord.firstVerificationTime.toString() : 'UNDEFINED'}`);
          console.log(`    - lastPassTime: ${companyRecord.lastPassTime ? companyRecord.lastPassTime.toString() : 'UNDEFINED'}`);
          console.log(`    - lastFailTime: ${companyRecord.lastFailTime ? companyRecord.lastFailTime.toString() : 'UNDEFINED'}`);
          
          // Check for any undefined fields in the company record (all 13 fields)
          const undefinedFields = [];
          if (!companyRecord.leiHash) undefinedFields.push('leiHash');
          if (!companyRecord.legalNameHash) undefinedFields.push('legalNameHash');
          if (!companyRecord.jurisdictionHash) undefinedFields.push('jurisdictionHash');
          if (companyRecord.isCompliant === null || companyRecord.isCompliant === undefined) undefinedFields.push('isCompliant');
          if (!companyRecord.complianceScore) undefinedFields.push('complianceScore');
          if (!companyRecord.totalVerifications) undefinedFields.push('totalVerifications');
          if (!companyRecord.passedVerifications) undefinedFields.push('passedVerifications');
          if (!companyRecord.failedVerifications) undefinedFields.push('failedVerifications');
          if (!companyRecord.consecutiveFailures) undefinedFields.push('consecutiveFailures');
          if (!companyRecord.lastVerificationTime) undefinedFields.push('lastVerificationTime');
          if (!companyRecord.firstVerificationTime) undefinedFields.push('firstVerificationTime');
          if (!companyRecord.lastPassTime) undefinedFields.push('lastPassTime');
          if (!companyRecord.lastFailTime) undefinedFields.push('lastFailTime');
          
          if (undefinedFields.length > 0) {
            throw new Error(`❌ Company record has undefined fields: ${undefinedFields.join(', ')}`);
          }
          
          console.log(`  ✅ All company record fields validated successfully`);
          
        } catch (recordError: any) {
          console.error(`❌ Error creating company record:`, recordError.message);
          throw new Error(`Company record creation failed: ${recordError.message}`);
        }
        
        const lei = complianceData.lei.toString();
        
        // =================================== Prepare MerkleMap Witness for Real Storage ===================================
        console.log(`\n🗺️ Preparing MerkleMap witness for company storage...`);
        
        // Create company key for storage
        const companyKey = CompanyKey.create(
          complianceData.lei.hash(),
          complianceData.name.hash()
        );
        const companyKeyField = companyKey.toField();
        
        console.log(`  Company Key: ${companyKeyField.toString()}`);
        console.log(`  Map Root Before: ${companiesMap.getRoot().toString()}`);
        
        // Add company to registry and get witness
        const companyWitness = companyRegistry.addOrUpdateCompany(lei, companyRecord, CompanyMerkleWitness, Poseidon);
        console.log(`✅ Company added to registry. Total companies: ${companyRegistry.getTotalCompanies()}`);
        
        // Store company in our local MerkleMap (matches what smart contract will do)
        const companyRecordHash = Poseidon.hash([
          companyRecord.leiHash,
          companyRecord.legalNameHash,
          companyRecord.jurisdictionHash,
          companyRecord.isCompliant.toField(),
          companyRecord.complianceScore,
          companyRecord.totalVerifications,
          companyRecord.passedVerifications,
          companyRecord.failedVerifications,
          companyRecord.consecutiveFailures,
          companyRecord.lastVerificationTime.value,
          companyRecord.firstVerificationTime.value,
          companyRecord.lastPassTime.value,
          companyRecord.lastFailTime.value
        ]);
        
        companiesMap.set(companyKeyField, companyRecordHash);
        console.log(`  Map Root After Update: ${companiesMap.getRoot().toString()}`);
        console.log(`  Stored Company Record Hash: ${companyRecordHash.toString()}`);

        // =================================== Show Contract State Before Verification ===================================
        console.log(`\n📊 Smart Contract State BEFORE Verification:`);
        const stateBefore = logSmartContractState(zkApp, 'BEFORE');
        
        // Show compliance field analysis BEFORE verification
        logComplianceFieldAnalysis(complianceData, isCompliant, 'Pre-Verification');

        console.log(`\n⚡ Executing smart contract verification transaction...`);
        console.log(`🔐 Submitting ZK proof to blockchain...`);

        try {
          // Get witness for this company in the map AFTER storing the company record
          // This ensures the witness corresponds to the updated map state
          const mapWitness = companiesMap.getWitness(companyKeyField);
          console.log(`🔍 MerkleMap witness obtained for company key: ${companyKeyField.toString()}`);
          
          // Validate mapWitness before using it in transaction
          if (!mapWitness) {
            throw new Error('❌ MerkleMap witness is null or undefined');
          }
          
          console.log(`🔐 Creating blockchain transaction...`);
          const txn = await Mina.transaction(
            senderAccount,
            async () => {
              await zkApp.verifyOptimizedComplianceWithProof(proof, companyWitness, companyRecord, mapWitness);
            }
          );

          console.log(`🔐 Proving transaction...`);
          await txn.prove();
          
          console.log(`🔐 Signing and sending transaction...`);
          await txn.sign([senderKey]).send();
          
        } catch (txError: any) {
          console.error(`❌ Smart contract transaction failed:`, txError.message);
          console.error(`🔍 Error details:`, txError);
          throw new Error(`Smart contract transaction failed: ${txError.message}`);
        }

        console.log(`\n✅ SMART CONTRACT TRANSACTION COMPLETED!`);
        console.log(`🏢 Company ${companyName} verification recorded on blockchain`);
        console.log(`🔄 Status Change: Not Verified → ${isCompliant.toJSON() ? 'Now COMPLIANT' : 'Now NON-COMPLIANT'}`);
        
        // Show contract state after verification
        console.log('📊 Contract state after verification:');
        const stateAfter = logSmartContractState(zkApp, 'AFTER');
        
        // Show state changes
        logStateChanges(stateBefore, stateAfter);
        
        // Show compliance field analysis AFTER
        logComplianceFieldAnalysis(complianceData, isCompliant, 'Post-Verification');

        // Store verification result with detailed compliance data
        const analysis = analyzeComplianceFields(complianceData);
        verificationResults.push({
          companyName,
          lei: complianceData.lei.toString(),
          isCompliant: isCompliant.toJSON(),
          complianceScore: complianceAnalysis.complianceScore,
          verificationTime: currentTimestamp.toString(),
          complianceFields: {
            entityStatus: complianceData.entity_status.toString(),
            registrationStatus: complianceData.registration_status.toString(),
            conformityFlag: complianceData.conformity_flag.toString(),
            initialRegistrationDate: complianceData.initialRegistrationDate.toString(),
            lastUpdateDate: complianceData.lastUpdateDate.toString(),
            nextRenewalDate: complianceData.nextRenewalDate.toString(),
            bicCodes: complianceData.bic_codes.toString(),
            micCodes: complianceData.mic_codes.toString(),
            managingLou: complianceData.managing_lou.toString(),
          },
          businessRules: {
            entityActive: analysis.isEntityActive,
            registrationIssued: analysis.isRegistrationIssued,
            conformityOk: analysis.isConformityOk,
            validDates: analysis.hasValidDates,
            validLEI: analysis.hasValidLEI,
          },
          stateChanges: {
            totalCompaniesBefore: stateBefore.totalCompaniesTracked.toString(),
            totalCompaniesAfter: stateAfter.totalCompaniesTracked.toString(),
            compliantCompaniesBefore: stateBefore.compliantCompaniesCount.toString(),
            compliantCompaniesAfter: stateAfter.compliantCompaniesCount.toString(),
            globalScoreBefore: addCompliancePercentage(stateBefore).compliancePercentage.toString(),
            globalScoreAfter: addCompliancePercentage(stateAfter).compliancePercentage.toString(),
          }
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
          error: err.message,
          complianceFields: null,
          businessRules: null,
          stateChanges: null
        });
        continue;
      }
    }

    // =================================== Final Registry Analysis ===================================
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🎉 GLEIF Multi-Company Verification Completed!`);
    console.log(`${'='.repeat(80)}`);

    console.log('\n📈 Final Registry Statistics:');
    const finalStats = zkApp.getGlobalComplianceStats();
    const finalStatsWithPercentage = addCompliancePercentage(finalStats);
    console.log(`  • Total Companies Tracked: ${finalStatsWithPercentage.totalCompanies}`);
    console.log(`  • Compliant Companies: ${finalStatsWithPercentage.compliantCompanies}`);
    console.log(`  • Compliance Percentage: ${finalStatsWithPercentage.compliancePercentage}%`);
    console.log(`  • Total Verifications: ${finalStats.totalVerifications.toString()}`);
    if (finalStats.lastVerificationTime.toString() !== '0') {
      console.log(`  • Last Verification: ${new Date(Number(finalStats.lastVerificationTime.toString())).toISOString()}`);
    }

    console.log('\n📋 Contract Features Demonstrated:');
    console.log(`  • Multi-Company Tracking: ✅`);
    console.log(`  • Global Compliance Metrics: ✅`);
    console.log(`  • Company Registry Management: ✅`);
    console.log(`  • Merkle Tree Storage: ✅`);
    console.log(`  • Aggregate Statistics: ✅`);
    console.log(`  • Individual Company Verification: ✅`);

    return {
      proofs,
      totalCompanies: companyRegistry.getTotalCompanies(),
      companyRegistry: companyRegistry,
      contractState: zkApp.getRegistryInfo(),
      globalStats: zkApp.getGlobalComplianceStats(),
      verificationResults
    };

  } catch (error) {
    console.error('❌ Error in GLEIF Multi-Company Verification:', error);
    throw error;
  }
}
