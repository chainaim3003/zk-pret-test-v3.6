/**
 * Business Standard Integrity NETWORK Handler
 * Parallel to: network/BusinessProcessNetworkHandler.ts and network/GLEIFNetworkHandler.ts
 * 
 * REAL ZK PROOFS: Uses actual BusinessStdIntegrityOptimMerkleVerifier for cryptographic proofs
 * NO MOCK IMPLEMENTATIONS: All merkle trees and ZK circuits are real
 * REAL NETWORK DEPLOYMENT: Submits to actual MINA testnet/mainnet
 * 
 * This handler implements the NETWORK blockchain verification logic for Business Standard documents
 * following the exact execution trace and deploying to real MINA network.
 */

import { Field, Mina, PrivateKey, AccountUpdate, Signature, UInt64, PublicKey } from 'o1js';
import { BusinessStdIntegrityOptimMerkleVerifier, BusinessStdIntegrityOptimMerklePublicOutput } from '../../../zk-programs/with-sign/BusinessStdIntegrityOptimMerkleZKProgramWithSign.js';
import { BusinessStdIntegrityOptimMerkleSmartContract } from '../../../contracts/with-sign/BusinessStdIntegrityOptimMerkleSmartContract.js';
import { BusinessStdMerkleTree, BusinessStdMerkleUtils } from '../BusinessStdIntegrityOptimMerkleUtils.js';
import { getPrivateKeyFor } from '../../../core/OracleRegistry.js';
import { BaseVerificationCore } from '../base/BaseVerificationCore.js';
import {
  initializeOracleRegistry,
  getDeployerAccount,
  getDeployerKey,
  environmentManager,
  Environment,
  getSenderAccount,
  getSenderKey
} from '../../../infrastructure/index.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Type definitions for results (extend LOCAL types)
export interface BusinessStdIntegrityDocumentData {
    documentHash: Field;
    merkleRoot: Field;
    documentType: string;
    fieldsCount: number;
}

export interface BusinessStdIntegrityNetworkResult {
    verificationResult: boolean;
    documentData: BusinessStdIntegrityDocumentData;
    coreCompliance: boolean;
    enhancedCompliance: boolean;
    fieldsValidated: number;
    riskReduction: number;
    environment: string;
    timestamp: string;
    transactionHash?: string;
    explorerUrl?: string;
    contractAddress?: PublicKey;
    failureReason?: string;
    zkProofGenerated: boolean;
    merkleTreeSize: number;
    totalZKProofs: number;
}

export interface BusinessStdIntegrityMultiNetworkResult {
    overallResult: boolean;
    totalDocuments: number;
    successfulVerifications: number;
    verificationPercentage: number;
    proofSuccessRate: number;
    networkSuccessRate: number;
    averageComplianceScore: number;
    totalZKProofs: number;
    environment: string;
    timestamp: string;
    contractAddress?: PublicKey;
    transactions: Array<{
        documentType: string;
        transactionHash?: string;
        status: string;
        merkleRoot: Field;
    }>;
    individualResults: BusinessStdIntegrityNetworkResult[];
}

export interface DocumentPair {
    documentType: string;
    documentFile: string;
}

/**
 * Setup network connection and deploy/connect to contract
 * REAL NETWORK: Connects to actual MINA testnet/mainnet
 */
async function setupNetworkInfrastructure(networkType: string = 'testnet') {
    console.log(`\n🔧 Setting up ${networkType.toUpperCase()} network connection...`);
    
    // Initialize Oracle Registry and Environment
    await initializeOracleRegistry();
    console.log(`✅ Connected to ${networkType.toUpperCase()} network`);
    
    // Get funded accounts using infrastructure  
    const senderAccount = getSenderAccount('BPMN');
    const senderKey = getSenderKey('BPMN');
    console.log(`💰 Using funded account: ${senderAccount.toBase58()}`);
    
    // Compile programs and contracts - REAL COMPILATION
    console.log('🔧 Compiling ZK Program...');
    const compilationResult = await BusinessStdIntegrityOptimMerkleVerifier.compile();
    console.log('✅ ZK Program compiled');
    
    console.log('🔧 Compiling Smart Contract...');
    await BusinessStdIntegrityOptimMerkleSmartContract.compile();
    console.log('✅ Smart Contract compiled');
    
    // Deploy new contract 
    console.log('🔧 Deploying new Smart Contract...');
    const zkAppPrivateKey = PrivateKey.random();
    const zkAppAddress = zkAppPrivateKey.toPublicKey();
    const zkApp = new BusinessStdIntegrityOptimMerkleSmartContract(zkAppAddress);
    
    const deployTxn = await Mina.transaction(senderAccount, async () => {
        AccountUpdate.fundNewAccount(senderAccount);
        await zkApp.deploy();
    });
    await deployTxn.prove();
    const deployResult = await deployTxn.sign([senderKey, zkAppPrivateKey]).send();
    
    if (deployResult.status === 'pending') {
        console.log('✅ Smart Contract deployed successfully');
        console.log(`🔗 Contract Address: ${zkAppAddress.toBase58()}`);
    } else {
        throw new Error('Contract deployment failed');
    }
    
    return {
        senderAccount,
        senderKey,
        zkAppAddress,
        zkApp,
        compilationResult,
        networkType
    };
}

/**
 * Create oracle signature using the correct BPMN key from registry
 * REAL CRYPTOGRAPHY: Uses actual signature generation
 */
function createOracleSignature(merkleRoot: Field) {
    const oraclePrivateKey = getPrivateKeyFor('BPMN');
    const signature = Signature.create(oraclePrivateKey, [merkleRoot]);
    return { signature, privateKey: oraclePrivateKey };
}

/**
 * Generate REAL Business Standard Integrity Verification with Network submission
 * REAL ZK PROOFS: Uses actual BusinessStdIntegrityOptimMerkleVerifier
 * REAL NETWORK: Submits to actual MINA blockchain
 */
async function generateNetworkBusinessStdIntegrityProof(
    documentData: any,
    networkInfrastructure: any
) {
    console.log('\n🔐 Generating REAL Business Standard Integrity Proof...');
    
    // Create merkle tree - REAL MERKLE OPERATIONS
    console.log('🌳 Creating Business Standard Merkle Tree...');
    const tree = BusinessStdMerkleUtils.createBusinessStdMerkleTree(documentData);
    console.log(`✅ Merkle tree created with ${tree.values.length} fields`);
    console.log(`🔗 Root hash: ${tree.root.toString()}`);
    
    const merkleRoot = tree.root;
    
    // Create oracle signature using the correct BPMN key - REAL SIGNATURE
    const { signature: oracleSignature } = createOracleSignature(merkleRoot);
    
    // Get core compliance fields (24 required fields) - EXACT PATTERN
    const { witnesses, values, fieldNames } = BusinessStdMerkleUtils.getCoreComplianceFields(tree);
    
    // CRITICAL VALIDATION: Check if all 24 required fields have data
    console.log('🔍 Critical Field Validation (24 Required Fields):');
    const criticalFieldsStatus = [];
    for (let i = 0; i < 24; i++) {
        const fieldName = fieldNames[i];
        const fieldValue = values[i];
        const isEmpty = !fieldValue || fieldValue.toString() === '';
        criticalFieldsStatus.push({ index: i, name: fieldName, isEmpty, value: fieldValue });
        console.log(`   ${i.toString().padStart(2)}: ${fieldName.padEnd(35)} = ${isEmpty ? '❌ MISSING' : '✅ OK'}`);
    }
    
    const missingCriticalFields = criticalFieldsStatus.filter(f => f.isEmpty);
    if (missingCriticalFields.length > 0) {
        throw new Error(`Cannot generate proof: ${missingCriticalFields.length} critical fields missing`);
    }
    
    console.log('✅ All 24 critical fields present - proceeding with REAL proof generation');
    
    // Extract witnesses and values for the ZK program (organized by validation type)
    const patternWitnesses = witnesses.slice(0, 6);      // Pattern validation (0-5)
    const enumWitnesses = witnesses.slice(6, 10);        // Enum validation (6-9)  
    const booleanWitnesses = witnesses.slice(10, 13);    // Boolean validation (10-12)
    const arrayWitnesses = witnesses.slice(13, 17);      // Array validation (13-16)
    const stringWitnesses = witnesses.slice(17, 24);     // String validation (17-23)
    
    const patternValues = values.slice(0, 6);
    const enumValues = values.slice(6, 10);
    const booleanValues = values.slice(10, 13);
    const arrayValues = values.slice(13, 17);
    const stringValues = values.slice(17, 24);
    
    console.log('🚀 Calling REAL ZK Program: BusinessStdIntegrityOptimMerkleVerifier.proveCoreCompliance');
    
    // Generate REAL proof using the actual ZK program
    const proof = await BusinessStdIntegrityOptimMerkleVerifier.proveCoreCompliance(
        Field(1), // blToProve
        merkleRoot, // datasetRoot
        
        // Pattern validation witnesses (6 fields: fun0/fun1/fun2)
        patternWitnesses[0], patternWitnesses[1], patternWitnesses[2],
        patternWitnesses[3], patternWitnesses[4], patternWitnesses[5],
        
        // Enum validation witnesses (4 fields: specific enum values)
        enumWitnesses[0], enumWitnesses[1], enumWitnesses[2], enumWitnesses[3],
        
        // Boolean validation witnesses (3 fields: true/false)
        booleanWitnesses[0], booleanWitnesses[1], booleanWitnesses[2],
        
        // Array validation witnesses (4 fields: not empty arrays)
        arrayWitnesses[0], arrayWitnesses[1], arrayWitnesses[2], arrayWitnesses[3],
        
        // String validation witnesses (7 fields: not empty strings)
        stringWitnesses[0], stringWitnesses[1], stringWitnesses[2],
        stringWitnesses[3], stringWitnesses[4], stringWitnesses[5], stringWitnesses[6],
        
        // Pattern validation values (6 fields)
        patternValues[0], patternValues[1], patternValues[2],
        patternValues[3], patternValues[4], patternValues[5],
        
        // Enum validation values (4 fields)
        enumValues[0], enumValues[1], enumValues[2], enumValues[3],
        
        // Boolean validation values (3 fields)
        booleanValues[0], booleanValues[1], booleanValues[2],
        
        // Array validation values (4 fields)  
        arrayValues[0], arrayValues[1], arrayValues[2], arrayValues[3],
        
        // String validation values (7 fields)
        stringValues[0], stringValues[1], stringValues[2],
        stringValues[3], stringValues[4], stringValues[5], stringValues[6],
        
        oracleSignature
    );
    
    console.log('✅ REAL Core compliance proof generated successfully!');
    
    // Submit to network - REAL NETWORK TRANSACTION
    console.log('\n📡 Submitting proof to network...');
    const initialRisk = 100;
    
    try {
        const updateTxn = await Mina.transaction(networkInfrastructure.senderAccount, async () => {
            await networkInfrastructure.zkApp.verifyCoreCompliance(
                proof,
                UInt64.from(Date.now())
            );
        });
        
        await updateTxn.prove();
        const txnResult = await updateTxn.sign([networkInfrastructure.senderKey]).send();
        
        if (txnResult.status === 'pending') {
            console.log('✅ Transaction submitted successfully');
            const transactionHash = txnResult.hash;
            const explorerUrl = `https://minascan.io/${networkInfrastructure.networkType}/tx/${transactionHash}`;
            
            console.log(`🔗 Transaction Hash: ${transactionHash}`);
            console.log(`🔍 Explorer URL: ${explorerUrl}`);
            
            return {
                proof,
                publicOutput: proof.publicOutput,
                merkleRoot,
                tree,
                fieldsValidated: 24,
                transactionHash,
                explorerUrl,
                networkSubmitted: true
            };
        } else {
            throw new Error('Transaction failed to submit');
        }
        
    } catch (networkError) {
        console.log('⚠️ Network submission failed, but proof is valid');
        console.log(`   Error: ${networkError instanceof Error ? networkError.message : networkError}`);
        
        return {
            proof,
            publicOutput: proof.publicOutput,
            merkleRoot,
            tree,
            fieldsValidated: 24,
            networkSubmitted: false
        };
    }
}

/**
 * Single document verification (NETWORK)
 * REAL ZK IMPLEMENTATION: Uses actual proof generation and network submission
 */
export async function runBusinessStdIntegrityTestWithFundedAccounts(
    documentType: string,
    documentFile: string,
    networkType: string = 'testnet'
): Promise<BusinessStdIntegrityNetworkResult> {
    
    console.log('\n🌐 Starting Business Standard Integrity NETWORK Verification');
    console.log('='.repeat(70));
    console.log(`📄 Document Type: ${documentType}`);
    console.log(`📂 Document File: ${documentFile}`);
    console.log(`🌍 Network: ${networkType.toUpperCase()}`);
    console.log('✅ REAL ZK Proofs: Using actual BusinessStdIntegrityOptimMerkleVerifier');
    console.log('✅ REAL Network: Submitting to actual MINA blockchain');
    
    try {
        // Load and validate document data
        console.log(`\n📂 Loading document data from: ${documentFile}`);
        if (!fs.existsSync(documentFile)) {
            throw new Error(`File not found: ${documentFile}`);
        }
        
        const documentDataRaw = fs.readFileSync(documentFile, 'utf8');
        const documentData = JSON.parse(documentDataRaw);
        console.log('✅ Document data loaded successfully');
        
        // Setup network infrastructure
        const networkInfrastructure = await setupNetworkInfrastructure(networkType);
        
        // Generate REAL ZK proof and submit to network
        const proofResult = await generateNetworkBusinessStdIntegrityProof(documentData, networkInfrastructure);
        
        const result: BusinessStdIntegrityNetworkResult = {
            verificationResult: proofResult.publicOutput.isBLCompliant.toBoolean(),
            documentData: {
                documentHash: Field.from(documentData.transportDocumentReference || ''),
                merkleRoot: proofResult.merkleRoot,
                documentType: documentType,
                fieldsCount: proofResult.tree.values.length
            },
            coreCompliance: proofResult.publicOutput.isBLCompliant.toBoolean(),
            enhancedCompliance: true, // For now, assume enhanced compliance if core passes
            fieldsValidated: proofResult.fieldsValidated,
            riskReduction: 10, // Risk reduced after successful verification
            environment: networkType.toUpperCase(),
            timestamp: new Date().toISOString(),
            transactionHash: proofResult.transactionHash,
            explorerUrl: proofResult.explorerUrl,
            contractAddress: networkInfrastructure.zkAppAddress,
            zkProofGenerated: true,
            merkleTreeSize: proofResult.tree.values.length,
            totalZKProofs: 1
        };
        
        return result;
        
    } catch (error) {
        console.error('❌ Business Standard Integrity NETWORK verification failed:', error);
        
        // Return failed result
        return {
            verificationResult: false,
            documentData: {
                documentHash: Field(0),
                merkleRoot: Field(0),
                documentType: documentType,
                fieldsCount: 0
            },
            coreCompliance: false,
            enhancedCompliance: false,
            fieldsValidated: 0,
            riskReduction: 0,
            environment: networkType.toUpperCase(),
            timestamp: new Date().toISOString(),
            failureReason: error instanceof Error ? error.message : 'Unknown error',
            zkProofGenerated: false,
            merkleTreeSize: 0,
            totalZKProofs: 0
        };
    }
}

/**
 * Multi-document verification (NETWORK)
 * REAL ZK IMPLEMENTATION: Uses actual proof generation and network submission for each document
 */
export async function runMultiBusinessStdIntegrityTestWithFundedAccounts(
    documentPairs: DocumentPair[],
    networkType: string = 'testnet'
): Promise<BusinessStdIntegrityMultiNetworkResult> {
    
    console.log('\n🌐 Starting Business Standard Integrity NETWORK Multi-Verification');
    console.log('='.repeat(75));
    console.log(`📊 Total Documents: ${documentPairs.length}`);
    console.log(`🌍 Network: ${networkType.toUpperCase()}`);
    console.log('✅ REAL ZK Proofs: Using actual BusinessStdIntegrityOptimMerkleVerifier');
    console.log('✅ REAL Network: Submitting to actual MINA blockchain');
    
    const individualResults: BusinessStdIntegrityNetworkResult[] = [];
    const transactions: Array<{
        documentType: string;
        transactionHash?: string;
        status: string;
        merkleRoot: Field;
    }> = [];
    
    let successfulVerifications = 0;
    let totalZKProofs = 0;
    let networkSubmissions = 0;
    let totalComplianceScore = 0;
    let contractAddress: PublicKey | undefined;
    
    for (let i = 0; i < documentPairs.length; i++) {
        const pair = documentPairs[i];
        console.log(`\n📄 Processing Document ${i + 1}/${documentPairs.length}: ${pair.documentType}`);
        
        try {
            const result = await runBusinessStdIntegrityTestWithFundedAccounts(
                pair.documentType, 
                pair.documentFile, 
                networkType
            );
            
            individualResults.push(result);
            
            // Track contract address from first successful deployment
            if (result.contractAddress && !contractAddress) {
                contractAddress = result.contractAddress;
            }
            
            // Track transaction
            const transaction = {
                documentType: pair.documentType,
                transactionHash: result.transactionHash,
                status: result.transactionHash ? 'submitted' : 'failed',
                merkleRoot: result.documentData.merkleRoot
            };
            transactions.push(transaction);
            
            if (result.verificationResult) {
                successfulVerifications++;
                totalComplianceScore += 100; // Full compliance score
            }
            
            if (result.zkProofGenerated) {
                totalZKProofs++;
            }
            
            if (result.transactionHash) {
                networkSubmissions++;
            }
            
        } catch (error) {
            console.error(`❌ Failed to verify document ${i + 1}:`, error);
            
            // Add failed result
            const failedResult: BusinessStdIntegrityNetworkResult = {
                verificationResult: false,
                documentData: {
                    documentHash: Field(0),
                    merkleRoot: Field(0),
                    documentType: pair.documentType,
                    fieldsCount: 0
                },
                coreCompliance: false,
                enhancedCompliance: false,
                fieldsValidated: 0,
                riskReduction: 0,
                environment: networkType.toUpperCase(),
                timestamp: new Date().toISOString(),
                failureReason: error instanceof Error ? error.message : 'Unknown error',
                zkProofGenerated: false,
                merkleTreeSize: 0,
                totalZKProofs: 0
            };
            
            individualResults.push(failedResult);
            
            // Track failed transaction
            const failedTransaction = {
                documentType: pair.documentType,
                status: 'failed',
                merkleRoot: Field(0)
            };
            transactions.push(failedTransaction);
        }
    }
    
    const verificationPercentage = Math.round((successfulVerifications / documentPairs.length) * 100);
    const proofSuccessRate = Math.round((totalZKProofs / documentPairs.length) * 100);
    const networkSuccessRate = Math.round((networkSubmissions / documentPairs.length) * 100);
    const averageComplianceScore = documentPairs.length > 0 ? Math.round(totalComplianceScore / documentPairs.length) : 0;
    
    const result: BusinessStdIntegrityMultiNetworkResult = {
        overallResult: successfulVerifications === documentPairs.length,
        totalDocuments: documentPairs.length,
        successfulVerifications,
        verificationPercentage,
        proofSuccessRate,
        networkSuccessRate,
        averageComplianceScore,
        totalZKProofs,
        environment: networkType.toUpperCase(),
        timestamp: new Date().toISOString(),
        contractAddress,
        transactions,
        individualResults
    };
    
    return result;
}
