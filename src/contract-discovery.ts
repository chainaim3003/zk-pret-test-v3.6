/**
 * Contract Address Discovery Tool - TypeScript Version
 * Maps GLEIF deployment transactions to actual contract addresses
 * Uses MINA DevNet GraphQL API for reliable data retrieval
 */

import fetch from 'node-fetch';
import { promises as fs } from 'fs';

// MINA DevNet GraphQL endpoint
const MINA_GRAPHQL_ENDPOINT = 'https://api.minascan.io/node/devnet/v1/graphql';

// Transaction hashes to investigate (in chronological order, oldest first)
const TRANSACTION_HASHES = [
    '5Jtm3eE3D8UUn5M92WJHKy8mbgukccAhGk6QgGxMzVXXEUHZ6SG7', // Contract #1 (first deployment, 3d ago)
    '5JtiKeBuBR8N55SAG8XGdyoVUeBikFPtFjPgyrf2ZJ1uE6e8Tv6D', // Contract #2 (3d ago)
    '5JuBhF1n1dhtZGNs8PA1pFNfm76q6oEZ8nipbo8z5jcJqpuFKfY3', // Contract #3 (3d ago)
    '5JuyiLK3KMqPbLSN2iEv63EzH3LtMkAnKVLpRr61oYn87p6wHxjn', // Contract #4 (10h 48m ago)
    '5JubAPQ2JYwhKuJx8suvCMGEFvawwVJK7CotBNLfWrodVrXph8od', // Contract #5 (10h 12m ago)
    '5JujMetGHEkT92pYdFwtwR5ybkJtFhRPd84Q1kEeeLgHTuhg7kUE', // Contract #6 (9h 51m ago)
    '5JtrwBTfAtHjRtVNqfU8kcQXZyhekeMRwz2LLCLHHYxRuE6fCn4p', // Contract #7 (1h 15m ago)
    '5JtZzRLfpV4QW2i6Uv7xJ1PQpxmoSH5tAd3NeM2GRy6eGU3HTKVF'  // Contract #8 (38m ago, latest)
];

const GLEIF_DEPLOYER = 'B62qjusDqJsqnh9hunqT2yRzxnxWn52XAbwUQM3o4vocn3WfTjoREP3';
const WORKING_CONTRACT = 'B62qoMdRZ5G386t3TiV2MKVEpG9jQgbzBHJyybae2PPckctoKndhh8j';

// Type definitions
interface TransactionData {
    hash: string;
    kind: string;
    blockHeight?: number;
    dateTime?: string;
    failureReason?: string;
    from?: string;
    to?: string;
    amount?: string;
    fee?: string;
    memo?: string;
    zkappCommand?: {
        memo?: string;
        feePayer?: {
            body?: {
                publicKey?: string;
                fee?: string;
                nonce?: number;
            };
        };
        accountUpdates?: Array<{
            body?: {
                publicKey?: string;
                balanceChange?: {
                    magnitude?: string;
                    sgn?: string;
                };
                incrementNonce?: boolean;
                useFullCommitment?: boolean;
                implicitAccountCreationFee?: boolean;
            };
            authorization?: {
                proof?: string;
                signature?: string;
            };
        }>;
    };
}

interface ContractVerification {
    exists: boolean;
    isZkApp: boolean;
    balance?: string;
    nonce?: number;
    zkappState?: any;
    permissions?: any;
    error?: any;
}

interface ContractResult {
    contractNumber: number;
    transactionHash: string;
    contractAddress: string | null;
    status: string;
    blockHeight?: number;
    dateTime?: string;
    memo?: string;
    balance?: string;
    isZkApp?: boolean;
    isWorkingContract?: boolean;
    verification?: ContractVerification;
    error?: string;
}

interface MappingResults {
    results: ContractResult[];
    summary: {
        totalTransactions: number;
        successfulContracts: number;
        workingContractFound: boolean;
        workingContractMatch?: ContractResult;
        timestamp: string;
    };
}

/**
 * GraphQL query to get transaction details with account updates
 */
const GET_TRANSACTION_QUERY = `
query GetTransaction($hash: String!) {
  transaction(signature: $hash) {
    hash
    kind
    blockHeight
    dateTime
    failureReason
    from
    to
    amount
    fee
    memo
    token
    nonce
    isDelegation
    zkappCommand {
      memo
      feePayer {
        body {
          publicKey
          fee
          nonce
        }
      }
      accountUpdates {
        body {
          publicKey
          balanceChange {
            magnitude
            sgn
          }
          incrementNonce
          useFullCommitment
          implicitAccountCreationFee
        }
        authorization {
          proof
          signature
        }
      }
    }
  }
}
`;

/**
 * GraphQL query to get account details
 */
const GET_ACCOUNT_QUERY = `
query GetAccount($publicKey: String!) {
  account(publicKey: $publicKey) {
    publicKey
    balance {
      total
    }
    nonce
    receiptChainHash
    delegate
    votingFor
    zkappState
    zkappUri
    tokenSymbol
    permissions {
      editState
      send
      receive
    }
    timing {
      initialMinimumBalance
      cliffTime
      cliffAmount
      vestingPeriod
      vestingIncrement
    }
  }
}
`;

/**
 * Fetch transaction details from MINA GraphQL API
 */
async function fetchTransactionDetails(hash: string): Promise<TransactionData | null> {
    try {
        const response = await fetch(MINA_GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: GET_TRANSACTION_QUERY,
                variables: { hash }
            })
        });

        const data: any = await response.json();
        
        if (data.errors) {
            console.error(`   ❌ GraphQL errors for ${hash}:`, data.errors);
            return null;
        }

        if (!data.data || !data.data.transaction) {
            console.error(`   ❌ No transaction data found for ${hash}`);
            return null;
        }

        return data.data.transaction;
    } catch (error) {
        console.error(`   ❌ Error fetching transaction ${hash}:`, error);
        return null;
    }
}

/**
 * Extract contract address from zkApp transaction
 */
function extractContractAddress(transaction: TransactionData): string | null {
    if (!transaction || !transaction.zkappCommand || !transaction.zkappCommand.accountUpdates) {
        return null;
    }

    const accountUpdates = transaction.zkappCommand.accountUpdates;
    
    // Find account update that's NOT the fee payer (deployer)
    for (const update of accountUpdates) {
        const publicKey = update.body?.publicKey;
        
        // Skip the GLEIF deployer address and return the contract address
        if (publicKey && publicKey !== GLEIF_DEPLOYER) {
            return publicKey;
        }
    }
    
    return null;
}

/**
 * Verify if an address exists and is a zkApp
 */
async function verifyContractAddress(address: string): Promise<ContractVerification> {
    try {
        const response = await fetch(MINA_GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: GET_ACCOUNT_QUERY,
                variables: { publicKey: address }
            })
        });

        const data: any = await response.json();
        
        if (data.errors) {
            return { exists: false, isZkApp: false, error: data.errors };
        }

        const account = data.data?.account;
        if (!account) {
            return { exists: false, isZkApp: false };
        }

        // Check if it's a zkApp (has zkApp state or specific permissions)
        const isZkApp = !!(account.zkappState || 
                          account.permissions?.editState || 
                          account.permissions?.send || 
                          account.permissions?.receive);

        return {
            exists: true,
            isZkApp,
            balance: account.balance?.total || '0',
            nonce: account.nonce || 0,
            zkappState: account.zkappState,
            permissions: account.permissions
        };
    } catch (error) {
        return { 
            exists: false, 
            isZkApp: false, 
            error: error instanceof Error ? error.message : String(error) 
        };
    }
}

/**
 * Main function to map all transactions to contract addresses
 */
async function mapTransactionsToContracts(): Promise<MappingResults> {
    console.log('🔍 GLEIF CONTRACT ADDRESS DISCOVERY');
    console.log('='.repeat(50));
    console.log(`📊 Analyzing ${TRANSACTION_HASHES.length} deployment transactions...`);
    console.log(`🎯 Looking for working contract: ${WORKING_CONTRACT}`);
    console.log('');

    const results: ContractResult[] = [];
    
    for (let i = 0; i < TRANSACTION_HASHES.length; i++) {
        const hash = TRANSACTION_HASHES[i];
        const contractNumber = i + 1; // Sequential numbering
        
        console.log(`🔍 Contract #${contractNumber}: ${hash.substring(0, 20)}...`);
        
        // Fetch transaction details
        const transaction = await fetchTransactionDetails(hash);
        
        if (!transaction) {
            console.log(`   ❌ Failed to fetch transaction details`);
            results.push({
                contractNumber,
                transactionHash: hash,
                contractAddress: null,
                status: 'FETCH_FAILED',
                error: 'Could not fetch transaction'
            });
            continue;
        }

        // Extract contract address
        const contractAddress = extractContractAddress(transaction);
        
        if (!contractAddress) {
            console.log(`   ❌ No contract address found in account updates`);
            results.push({
                contractNumber,
                transactionHash: hash,
                contractAddress: null,
                status: 'NO_CONTRACT_FOUND',
                blockHeight: transaction.blockHeight,
                dateTime: transaction.dateTime,
                memo: transaction.zkappCommand?.memo
            });
            continue;
        }

        console.log(`   📍 Contract Address: ${contractAddress}`);
        
        // Verify contract exists and is zkApp
        console.log(`   🔍 Verifying contract...`);
        const verification = await verifyContractAddress(contractAddress);
        
        console.log(`   ✅ Exists: ${verification.exists}`);
        console.log(`   ⚙️ Is zkApp: ${verification.isZkApp}`);
        
        if (verification.exists) {
            const balanceInMina = verification.balance ? (parseInt(verification.balance) / 1e9).toFixed(3) : '0';
            console.log(`   💰 Balance: ${balanceInMina} MINA`);
        }
        
        // Check if this matches the working contract
        const isWorkingContract = contractAddress === WORKING_CONTRACT;
        if (isWorkingContract) {
            console.log(`   🎯 *** THIS IS THE WORKING CONTRACT! ***`);
        }
        
        results.push({
            contractNumber,
            transactionHash: hash,
            contractAddress,
            status: verification.exists ? (verification.isZkApp ? 'ZKAPP_SUCCESS' : 'ACCOUNT_EXISTS') : 'NOT_FOUND',
            blockHeight: transaction.blockHeight,
            dateTime: transaction.dateTime,
            memo: transaction.zkappCommand?.memo,
            balance: verification.balance,
            isZkApp: verification.isZkApp,
            isWorkingContract,
            verification
        });
        
        console.log('');
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate summary report
    console.log('📊 COMPREHENSIVE SUMMARY REPORT');
    console.log('='.repeat(35));
    
    const successfulContracts = results.filter(r => r.contractAddress && r.status === 'ZKAPP_SUCCESS');
    const workingContractMatch = results.find(r => r.isWorkingContract);
    
    console.log(`✅ Total transactions analyzed: ${TRANSACTION_HASHES.length}`);
    console.log(`✅ Successful zkApp deployments: ${successfulContracts.length}`);
    console.log(`🎯 Working contract found in deployments: ${workingContractMatch ? 'YES' : 'NO'}`);
    
    if (workingContractMatch) {
        console.log(`   📍 Working contract transaction: ${workingContractMatch.transactionHash}`);
        console.log(`   📅 Deployed: ${workingContractMatch.dateTime}`);
        console.log(`   🔢 Contract #${workingContractMatch.contractNumber}`);
    }
    
    console.log('');
    console.log('📋 ALL DISCOVERED CONTRACT ADDRESSES:');
    results.forEach(result => {
        if (result.contractAddress) {
            const status = result.isWorkingContract ? '🎯 WORKING CONTRACT' : 
                          result.status === 'ZKAPP_SUCCESS' ? '✅ DEPLOYED SUCCESS' : 
                          result.status === 'ACCOUNT_EXISTS' ? '⚠️ ACCOUNT EXISTS' : '❌ FAILED';
            console.log(`   Contract #${result.contractNumber}: ${result.contractAddress}`);
            console.log(`      Status: ${status}`);
            console.log(`      Date: ${result.dateTime || 'Unknown'}`);
            console.log(`      Memo: ${result.memo || 'None'}`);
            console.log('');
        }
    });

    // Save results to file
    const outputData: MappingResults = {
        results,
        summary: {
            totalTransactions: TRANSACTION_HASHES.length,
            successfulContracts: successfulContracts.length,
            workingContractFound: !!workingContractMatch,
            workingContractMatch,
            timestamp: new Date().toISOString()
        }
    };

    const outputFile = 'gleif-contract-mapping-results.json';
    await fs.writeFile(outputFile, JSON.stringify(outputData, null, 2));
    
    console.log(`💾 Detailed results saved to: ${outputFile}`);
    console.log('');

    return outputData;
}

/**
 * Verify the working contract separately
 */
async function verifyWorkingContract(): Promise<ContractVerification> {
    console.log('🔍 VERIFYING WORKING CONTRACT');
    console.log('='.repeat(35));
    console.log(`📍 Address: ${WORKING_CONTRACT}`);
    
    const verification = await verifyContractAddress(WORKING_CONTRACT);
    
    console.log(`✅ Exists: ${verification.exists}`);
    console.log(`⚙️ Is zkApp: ${verification.isZkApp}`);
    
    if (verification.exists) {
        const balanceInMina = verification.balance ? (parseInt(verification.balance) / 1e9).toFixed(3) : '0';
        console.log(`💰 Balance: ${balanceInMina} MINA`);
        console.log(`🔢 Nonce: ${verification.nonce}`);
        
        if (verification.zkappState) {
            console.log(`🔧 zkApp State: Available`);
        }
        
        if (verification.permissions) {
            console.log(`🔐 Permissions: Configured`);
        }
    }
    
    console.log('');
    return verification;
}

/**
 * Generate cleanup recommendations
 */
function generateCleanupRecommendations(results: MappingResults): void {
    console.log('🧹 CLEANUP RECOMMENDATIONS');
    console.log('='.repeat(30));
    
    const { workingContractFound, successfulContracts } = results.summary;
    const contractsToCleanup = results.results.filter(r => 
        r.contractAddress && 
        r.status === 'ZKAPP_SUCCESS' && 
        !r.isWorkingContract
    );
    
    if (workingContractFound) {
        console.log('✅ RECOMMENDED STRATEGY: Keep Working Contract');
        console.log(`   🎯 Official Contract: ${WORKING_CONTRACT}`);
        console.log(`   🗑️ Contracts to clean up: ${contractsToCleanup.length}`);
        console.log('');
        
        if (contractsToCleanup.length > 0) {
            console.log('📋 Cleanup Actions:');
            console.log('   1. Update config files to use ONLY the working contract');
            console.log('   2. Remove references to these addresses:');
            contractsToCleanup.forEach(contract => {
                console.log(`      - ${contract.contractAddress} (Contract #${contract.contractNumber})`);
            });
            console.log('   3. Document others as "abandoned deployments"');
            console.log('   4. Fix deployment system to prevent future duplicates');
        }
    } else {
        console.log('⚠️ WORKING CONTRACT NOT FOUND IN DEPLOYMENTS');
        console.log('   This means:');
        console.log('   - Working contract was deployed by different method');
        console.log('   - OR working contract address is incorrect');
        console.log('   - All 8 discovered contracts are from broken deployment system');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('   1. Verify working contract actually works');
        console.log('   2. Choose best contract from the 8 discovered (if working contract fails)');
        console.log('   3. Clean up all unused contracts');
    }
    
    console.log('');
    console.log('🔧 System Fixes Needed:');
    console.log('   1. Fix address generation (remove PrivateKey.random())');
    console.log('   2. Fix deployment status detection');
    console.log('   3. Add deployment state management');
    console.log('   4. Implement duplicate deployment prevention');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
    try {
        console.log('🚀 GLEIF CONTRACT DISCOVERY TOOL');
        console.log('='.repeat(40));
        console.log('📅 Started:', new Date().toISOString());
        console.log('');
        
        // First verify the working contract
        const workingVerification = await verifyWorkingContract();
        
        // Then map all deployment transactions
        const results = await mapTransactionsToContracts();
        
        // Generate cleanup recommendations
        generateCleanupRecommendations(results);
        
        console.log('🎉 CONTRACT DISCOVERY COMPLETED SUCCESSFULLY!');
        console.log('📁 Check gleif-contract-mapping-results.json for detailed data');
        console.log('');
        
        // Quick summary for immediate action
        if (results.summary.workingContractFound) {
            console.log('✅ IMMEDIATE ACTION: Working contract found in deployments');
            console.log('   → Update configs to use working contract only');
            console.log(`   → Clean up ${results.results.filter(r => r.contractAddress && !r.isWorkingContract).length} other contracts`);
        } else {
            console.log('⚠️ IMMEDIATE ACTION: Working contract not in deployments');
            console.log('   → Verify working contract actually works');
            console.log('   → Choose best alternative from discovered contracts');
        }
        
    } catch (error) {
        console.error('💥 Error during contract discovery:', error);
        process.exit(1);
    }
}

// Export for module use
export {
    mapTransactionsToContracts,
    verifyWorkingContract,
    generateCleanupRecommendations,
    type ContractResult,
    type MappingResults,
    type ContractVerification
};

// Run the main function
main().catch(console.error);
