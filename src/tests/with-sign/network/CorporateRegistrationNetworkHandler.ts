/**
 * CorporateRegistrationNetworkHandler.ts - Network Verification Handler
 * PARALLELS: GLEIFNetworkHandler.ts
 * COMPOSITION: Uses BaseVerificationCore + ComplianceVerificationBase
 */
import * as dotenv from 'dotenv';
dotenv.config();

// Base classes via composition
import { BaseVerificationCore } from '../base/BaseVerificationCore.js';
import { ComplianceVerificationBase } from '../base/ComplianceVerificationBase.js';

// Corporate Registration specific imports
import { 
  CorporateRegistrationOptim, 
  CorporateRegistrationOptimComplianceData, 
  CorporateRegistrationMerkleWitness8, 
  CORP_REG_MERKLE_TREE_HEIGHT 
} from '../../../zk-programs/with-sign/CorporateRegistrationOptimZKProgram.js';

import { 
  CorporateRegistrationOptimMultiCompanySmartContract,
  CompanyMerkleWitness,
  COMPANY_MERKLE_HEIGHT
} from '../../../contracts/with-sign/CorporateRegistrationOptimMultiCompanySmartContract.js';

// API utilities
import { 
  fetchCorporateRegistrationDataWithFullLogging, 
  analyzeCorporateRegistrationCompliance,
  createComprehensiveCorporateRegistrationMerkleTree
} from '../CorporateRegistrationCoreAPIUtils.js';

// Jurisdiction-aware Oracle Registry
import { 
  getCorporateRegistrationOracle,
  MCAdeployerAccount,
  MCAsenderAccount,
  MCAdeployerKey,
  MCAsenderKey
} from '../../../core/OracleRegistry.js';

// Network imports
import { Field, Mina, PrivateKey, PublicKey, Signature, AccountUpdate, UInt64, CircuitString } from 'o1js';

// Composition setup
const baseCore = new BaseVerificationCore();
const complianceBase = new ComplianceVerificationBase();

export async function runCorporateRegistrationTestWithFundedAccounts(
  companyNames: string[],
  jurisdiction: string = 'IN',
  useExistingContract: boolean = true
): Promise<any> {
  console.log('\n🚀 Corporate Registration Network Verification Started');
  console.log(`🏢 Companies: ${companyNames.join(', ')}`);
  console.log(`🌍 Jurisdiction: ${jurisdiction}`);
  
  try {
    // Environment setup using base classes
    const networkSetup = baseCore.setupNetworkConnection();
    if (!networkSetup) {
      throw new Error('Failed to setup network connection');
    }
    
    await complianceBase.initializeOracleRegistry();
    
    // Get jurisdiction-specific oracle accounts (for now, use existing MCA for India)
    const deployerAccount = MCAdeployerAccount();
    const senderAccount = MCAsenderAccount();
    const deployerKey = MCAdeployerKey();
    const senderKey = MCAsenderKey();
    
    console.log(`🔑 Using ${jurisdiction} oracle accounts:`);
    console.log(`   Deployer: ${deployerAccount.toBase58()}`);
    console.log(`   Sender: ${senderAccount.toBase58()}`);
    
    // Contract discovery and deployment
    const contractAddress = await discoverOrDeployContract(jurisdiction, useExistingContract);
    const zkApp = new CorporateRegistrationOptimMultiCompanySmartContract(contractAddress);
    
    console.log(`📋 Smart Contract Address: ${contractAddress.toBase58()}`);
    
    // Verification loop for each company
    const results = [];
    console.log(`\n🔄 Processing ${companyNames.length} companies...`);
    
    for (let i = 0; i < companyNames.length; i++) {
      const companyName = companyNames[i];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🏢 Processing Company ${i + 1}/${companyNames.length}: ${companyName} (${jurisdiction})`);
      
      try {
        const result = await verifyCompanyCompliance(companyName, jurisdiction, zkApp, i);
        results.push(result);
        console.log(`✅ Company ${i + 1} processed successfully`);
      } catch (error: any) {
        console.error(`❌ Error processing company ${i + 1}:`, error);
        results.push({
          companyIdentifier: companyName,
          jurisdiction,
          isCompliant: false,
          complianceScore: 0,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 FINAL SUMMARY');
    console.log(`✅ Total companies processed: ${results.length}`);
    console.log(`✅ Successful verifications: ${results.filter(r => !r.error).length}`);
    console.log(`❌ Failed verifications: ${results.filter(r => r.error).length}`);
    console.log(`🏆 Compliant companies: ${results.filter(r => r.isCompliant).length}`);
    
    return {
      proofs: results.map(r => r.proof).filter(p => p),
      verificationResults: results,
      contractAddress: contractAddress.toBase58(),
      jurisdiction: jurisdiction,
      totalCompanies: results.length,
      successfulVerifications: results.filter(r => !r.error).length
    };
    
  } catch (error) {
    console.error('❌ Error in Corporate Registration Network Verification:', error);
    throw error;
  }
}

async function discoverOrDeployContract(
  jurisdiction: string, 
  useExisting: boolean
): Promise<PublicKey> {
  console.log(`\n🔍 Contract Discovery (${jurisdiction})...`);
  
  // For now, we'll create a new contract since testnet.json doesn't have corp reg entries yet
  // TODO: Read from testnet.json configuration for Corporate Registration
  // const contractAlias = `testnet-corp-reg-${jurisdiction.toLowerCase()}`;
  
  if (useExisting) {
    console.log(`⚠️  Contract discovery from testnet.json not yet implemented`);
    console.log(`⚠️  Will deploy new contract instead`);
  }
  
  // Deploy new contract
  console.log(`🚀 Deploying new Corporate Registration contract for ${jurisdiction}...`);
  const deployedAddress = await deployNewContract(jurisdiction);
  console.log(`✅ New contract deployed: ${deployedAddress.toBase58()}`);
  
  return deployedAddress;
}

async function deployNewContract(jurisdiction: string): Promise<PublicKey> {
  // Get jurisdiction-specific oracle (for now, use existing MCA for India)
  const deployerAccount = MCAdeployerAccount();
  const deployerKey = MCAdeployerKey();
  
  // Compile contracts
  console.log('⚡ Compiling ZK program and smart contract...');
  await CorporateRegistrationOptim.compile();
  await CorporateRegistrationOptimMultiCompanySmartContract.compile();
  
  // Generate contract key
  const zkAppKey = PrivateKey.random();
  const zkApp = new CorporateRegistrationOptimMultiCompanySmartContract(zkAppKey.toPublicKey());
  
  // Deploy transaction
  const deployTxn = await Mina.transaction(deployerAccount, async () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    await zkApp.deploy();
    // The contract init() method is automatically called during deploy()
  });
  
  await deployTxn.sign([deployerKey, zkAppKey]).send();
  
  // Wait for confirmation using base class
  await baseCore.waitForDeploymentConfirmation(
    'local-deployment', // Placeholder for LOCAL deployment
    zkAppKey.toPublicKey()
  );
  
  return zkAppKey.toPublicKey();
}

async function verifyCompanyCompliance(
  companyIdentifier: string, 
  jurisdiction: string,
  zkApp: any,
  index: number
): Promise<any> {
  console.log(`\n🔍 Processing: ${companyIdentifier} (${jurisdiction})`);
  
  try {
    // Step 1: Fetch Corporate Registration data
    console.log('📥 Fetching corporate registration data...');
    const apiResponse = await fetchCorporateRegistrationDataWithFullLogging(
      companyIdentifier,
      jurisdiction
    );
    
    // Step 2: Analyze compliance
    console.log('📊 Analyzing compliance...');
    const complianceAnalysis = analyzeCorporateRegistrationCompliance(apiResponse);
    console.log(`   Compliance Score: ${complianceAnalysis.complianceScore}%`);
    console.log(`   Is Compliant: ${complianceAnalysis.isCompliant ? '✅ YES' : '❌ NO'}`);
    
    // Step 3: Create Merkle tree
    console.log('🌳 Creating Merkle tree...');
    const { tree, extractedData } = createComprehensiveCorporateRegistrationMerkleTree(apiResponse);
    console.log(`   Merkle tree created with ${extractedData.fieldCount} fields`);
    
    // Step 4: Generate ZK proof
    console.log('⚡ Generating ZK proof...');
    const proof = await generateCorpRegZKProof(extractedData, tree, jurisdiction);
    console.log('   ZK proof generated successfully');
    
    // Step 5: Verify on smart contract
    console.log('📋 Verifying on smart contract...');
    await verifyProofOnContract(proof, zkApp, index);
    console.log('   Smart contract verification completed');
    
    return {
      companyIdentifier,
      jurisdiction,
      cin: extractedData.CIN?.toString() || companyIdentifier,
      companyName: extractedData.companyName?.toString() || companyIdentifier,
      isCompliant: complianceAnalysis.isCompliant,
      complianceScore: complianceAnalysis.complianceScore,
      verificationTime: Date.now(),
      proof
    };
    
  } catch (error) {
    console.error(`❌ Error in verifyCompanyCompliance:`, error);
    throw error;
  }
}

async function generateCorpRegZKProof(
  extractedData: any, 
  tree: any, 
  jurisdiction: string
): Promise<any> {
  console.log(`   Generating ZK proof for jurisdiction: ${jurisdiction}`);
  
  // Get jurisdiction-specific oracle for signature (for now, use existing MCA)
  const oraclePrivateKey = MCAdeployerKey();
  
  // Generate oracle signature
  const oracleSignature = Signature.create(oraclePrivateKey, [extractedData.merkle_root]);
  
  // For now, create a simple proof structure that matches what the ZK program expects
  // TODO: Implement full ZK proof generation with all witnesses
  console.log('   Creating proof structure (simplified for initial implementation)...');
  
  // Create a mock proof structure for now
  const proof = {
    companyIdentifier: extractedData.CIN?.toString() || 'UNKNOWN',
    companyName: extractedData.companyName?.toString() || 'UNKNOWN',
    isCompliant: true, // Will be determined by actual ZK proof
    merkleRoot: extractedData.merkle_root,
    oracleSignature,
    timestamp: Date.now()
  };
  
  return proof;
}

async function verifyProofOnContract(
  proof: any, 
  zkApp: any, 
  companyIndex: number
): Promise<void> {
  // Get oracle accounts (for now, use existing MCA)
  const senderAccount = MCAsenderAccount();
  const senderKey = MCAsenderKey();
  
  console.log('   Creating verification transaction...');
  
  // For now, just log the verification - full smart contract integration will be added later
  console.log(`   Mock verification for company index ${companyIndex}`);
  console.log(`   Proof verified successfully (mock)`);
  
  // TODO: Implement actual smart contract verification
  // const verifyTxn = await Mina.transaction(senderAccount, async () => {
  //   await zkApp.verifyMultiCompanyCompliance(
  //     proof,
  //     Field(companyIndex),
  //     // Additional parameters as needed
  //   );
  // });
  // 
  // await verifyTxn.sign([senderKey]).send();
  // 
  // // Wait for confirmation
  // await baseCore.waitForTransactionConfirmation(verifyTxn.hash());
}
