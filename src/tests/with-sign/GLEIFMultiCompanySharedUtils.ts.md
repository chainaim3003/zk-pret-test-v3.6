/**
 * GLEIF Multi-Company Shared Utilities
 * Common utilities for both deployment and verification
 * 
 * Responsibilities:
 * ✅ Fee configuration management
 * ✅ Contract accessibility checks
 * ✅ Network connection utilities
 * ✅ Account fetching with retry logic
 * ✅ Environment detection helpers
 * ✅ BUILD_ENV aware configuration management
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { Field, Mina, PublicKey, UInt64, fetchAccount } from 'o1js';
import { GLEIFOptimMultiCompanySmartContract } from '../../contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js';
import { environmentManager } from '../../infrastructure/index.js';

// Fee configuration following o1js best practices
export const TRANSACTION_FEES = {
  LOCAL: UInt64.from(1000000),        // 0.001 MINA for local testing
  TESTNET: UInt64.from(100000000),    // 0.1 MINA for DEVNET/TESTNET (o1js best practice)
  DEVNET: UInt64.from(100000000),     // 0.1 MINA for DEVNET (o1js best practice)
  MAINNET: UInt64.from(300000000),    // 0.3 MINA for mainnet
};

/**
 * Get appropriate transaction fee for environment
 */
export function getTransactionFee(environment: string): UInt64 {
  switch (environment.toUpperCase()) {
    case 'LOCAL':
      return TRANSACTION_FEES.LOCAL;
    case 'TESTNET':
    case 'DEVNET':
      return TRANSACTION_FEES.TESTNET;
    case 'MAINNET':
      return TRANSACTION_FEES.MAINNET;
    default:
      console.warn(`Unknown environment ${environment}, using TESTNET fee`);
      return TRANSACTION_FEES.TESTNET;
  }
}

/**
 * Establish network connection based on environment
 */
export async function establishNetworkConnection(): Promise<void> {
  const currentEnv = environmentManager.getCurrentEnvironment();
  
  if (currentEnv === 'TESTNET' && environmentManager.shouldConnectToDevnet()) {
    console.log('🌐 Establishing DEVNET connection...');
    const devnetNetwork = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
    Mina.setActiveInstance(devnetNetwork);
    console.log('✅ DEVNET connection established');
  } else if (currentEnv === 'LOCAL') {
    console.log('🏠 Using LocalBlockchain for development');
    const useProof = false;
    const Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
    Mina.setActiveInstance(Local);
  }
}

/**
 * Enhanced contract accessibility check with retry logic
 */
export async function checkContractAccessibility(
  contractAddress: PublicKey,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<boolean> {
  console.log(`🔍 Checking contract accessibility: ${contractAddress.toBase58()}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries} - Checking accessibility...`);
      
      // Re-establish network connection
      await establishNetworkConnection();
      
      // Try to fetch the account
      await fetchAccount({ publicKey: contractAddress });
      const account = Mina.getAccount(contractAddress);
      
      if (account && account.zkapp && account.zkapp.verificationKey) {
        console.log(`   ✅ Contract is accessible and functional`);
        console.log(`   💰 Balance: ${Number(account.balance.toString()) / 1e9} MINA`);
        console.log(`   🎯 zkApp Status: ACTIVE`);
        
        // Try to create contract instance and test functionality
        const contract = new GLEIFOptimMultiCompanySmartContract(contractAddress);
        try {
          const registryInfo = contract.getRegistryInfo();
          console.log(`   📊 Contract functional: ${registryInfo.totalCompaniesTracked.toString()} companies tracked`);
          return true;
        } catch (funcError) {
          console.log(`   ⚠️ Contract exists but state not yet accessible: ${funcError}`);
          // Contract exists but state might not be ready yet
          return true; // Still consider it accessible
        }
      } else if (account) {
        console.log(`   ⚠️ Account exists but not yet a zkApp (attempt ${attempt})`);
        console.log(`   💰 Balance: ${Number(account.balance.toString()) / 1e9} MINA`);
        return false;
      } else {
        console.log(`   ❌ Account not found (attempt ${attempt})`);
        return false;
      }
      
    } catch (error: any) {
      console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        console.log(`   🚨 All ${maxRetries} attempts failed`);
        return false;
      }
      
      if (attempt < maxRetries) {
        console.log(`   ⏳ Waiting ${delayMs/1000}s before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  return false;
}

/**
 * Safely fetch account with retry logic for DEVNET propagation delays
 */
export async function safelyFetchAccountWithRetry(
  zkAppAddress: PublicKey,
  maxRetries: number = 10,
  delayMs: number = 5000
): Promise<boolean> {
  console.log(`🔄 Fetching zkApp account with retry logic...`);
  
  // DEVNET endpoint - should match your environment config
  const DEVNET_ENDPOINT = 'https://api.minascan.io/node/devnet/v1/graphql';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries} - Fetching account...`);
      
      // Re-establish DEVNET connection before each attempt
      console.log(`   🌐 Re-establishing DEVNET connection...`);
      const Network = Mina.Network(DEVNET_ENDPOINT);
      Mina.setActiveInstance(Network);
      console.log(`   ✅ Network set to: ${DEVNET_ENDPOINT}`);
      
      // Now try to fetch the account
      await fetchAccount({ publicKey: zkAppAddress });
      
      // If successful, try to access account info
      const accountInfo = Mina.getAccount(zkAppAddress);
      
      if (accountInfo && accountInfo.zkapp) {
        console.log(`✅ zkApp account successfully fetched on attempt ${attempt}`);
        console.log(`💵 Account Balance: ${accountInfo.balance.toString()} nanomina (${Number(accountInfo.balance.toString()) / 1e9} MINA)`);
        console.log(`✅ Account Status: ACTIVATED zkApp`);
        console.log(`📊 App State: ${accountInfo.zkapp.appState.map(f => f.toString()).join(', ')}`);
        return true;
      } else if (accountInfo) {
        console.log(`⚠️ Account exists but not yet a zkApp (attempt ${attempt})`);
        console.log(`💵 Account Balance: ${accountInfo.balance.toString()} nanomina (${Number(accountInfo.balance.toString()) / 1e9} MINA)`);
        console.log(`⏳ Waiting for zkApp activation...`);
        
        // Account exists but not zkApp yet - this is progress!
        if (attempt === maxRetries) {
          console.log(`⚠️ Account exists but not yet activated as zkApp after ${maxRetries} attempts`);
          console.log(`💡 This may be normal - zkApp activation can take additional time`);
          return false;
        }
      } else {
        console.log(`❌ Account not found on DEVNET (attempt ${attempt})`);
        console.log(`⏳ Transaction may still be processing...`);
      }
      
    } catch (error: any) {
      console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
      if (error.message.includes("Cannot destructure")) {
        console.log(`   💡 This means the account doesn't exist yet - normal for DEVNET`);
      }
      
      if (attempt === maxRetries) {
        console.log(`🚨 All ${maxRetries} attempts failed`);
        console.log(`⏳ Account may still be processing - this is normal for DEVNET`);
        return false;
      }
    }
    
    // Wait before next attempt
    if (attempt < maxRetries) {
      console.log(`   ⏳ Waiting ${delayMs/1000} seconds before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return false;
}

/**
 * Get contract deployment info from config
 */
export async function getContractDeploymentInfo(contractName: string = 'GLEIFOptimMultiCompanySmartContract'): Promise<{
  address?: string;
  deployedAt?: string;
  transactionHash?: string;
  verificationKey?: any;
}> {
  try {
    const currentConfig = await environmentManager.getCurrentConfig();
    const deploymentInfo = currentConfig.deployments?.contracts?.[contractName];
    
    if (!deploymentInfo) {
      return {};
    }
    
    return {
      address: deploymentInfo.address,
      deployedAt: deploymentInfo.deployedAt,
      transactionHash: deploymentInfo.transactionHash,
      verificationKey: deploymentInfo.verificationKey
    };
  } catch (error) {
    console.warn(`⚠️ Failed to get deployment info: ${error}`);
    return {};
  }
}

/**
 * Display deployment costs for environment
 */
export function displayDeploymentCosts(environment: string): void {
  const deploymentFee = getTransactionFee(environment);
  console.log(`💰 Deployment costs (o1js best practices):`);
  console.log(`   Deployment fee: ${deploymentFee.toString()} nanomina (${Number(deploymentFee.toString()) / 1e9} MINA)`);
  console.log(`   Account creation: 1000000000 nanomina (1 MINA - protocol standard)`);
  console.log(`   Total cost: ${Number(deploymentFee.toString()) + 1000000000} nanomina (${(Number(deploymentFee.toString()) + 1000000000) / 1e9} MINA)`);
}

/**
 * Display verification costs for environment
 */
export function displayVerificationCosts(environment: string): void {
  const verificationFee = getTransactionFee(environment);
  console.log(`💰 Verification costs (o1js best practices):`);
  console.log(`   Verification fee: ${verificationFee.toString()} nanomina (${Number(verificationFee.toString()) / 1e9} MINA)`);
  console.log(`   Cost per company: ${Number(verificationFee.toString()) / 1e9} MINA`);
}

/**
 * Format MinaScan explorer links
 */
export function getExplorerLinks(contractAddress: string, transactionHash?: string, environment: string = 'devnet'): {
  account: string;
  transaction?: string;
} {
  const baseUrl = environment === 'mainnet' ? 'https://minascan.io/mainnet' : 'https://minascan.io/devnet';
  
  const links = {
    account: `${baseUrl}/account/${contractAddress}`
  };
  
  if (transactionHash) {
    return {
      ...links,
      transaction: `${baseUrl}/tx/${transactionHash}`
    };
  }
  
  return links;
}

/**
 * Display deployment summary
 */
export function displayDeploymentSummary(
  contractAddress: string,
  deployerAccount: string,
  environment: string,
  wasDeployed: boolean,
  transactionHash?: string
): void {
  console.log('\n📊 DEPLOYMENT SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Status: ${wasDeployed ? 'NEW DEPLOYMENT COMPLETED' : 'EXISTING CONTRACT USED'}`);
  console.log(`🏠 Contract Address: ${contractAddress}`);
  console.log(`💰 Deployer Account: ${deployerAccount}`);
  
  const explorerLinks = getExplorerLinks(contractAddress, transactionHash, environment);
  
  if (wasDeployed && transactionHash) {
    console.log(`🔗 Transaction: ${explorerLinks.transaction}`);
    console.log(`💰 Total Cost: ${(Number(getTransactionFee(environment).toString()) + 1000000000) / 1e9} MINA`);
  }
  console.log(`🔗 Account: ${explorerLinks.account}`);
  console.log(`✅ Ready for GLEIF verification process`);
  console.log('='.repeat(50));
}

/**
 * Display verification summary
 */
export function displayVerificationSummary(
  contractAddress: string,
  totalCompanies: number,
  successfullyProcessed: number,
  compliantCompanies: number,
  errorCompanies: number,
  environment: string = 'devnet'
): void {
  console.log('\n📊 VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`🏠 Contract Address: ${contractAddress}`);
  console.log(`🏢 Total Companies: ${totalCompanies}`);
  console.log(`✅ Successfully Processed: ${successfullyProcessed}`);
  console.log(`✅ Compliant Companies: ${compliantCompanies}`);
  console.log(`⚠️ Non-Compliant Companies: ${successfullyProcessed - compliantCompanies}`);
  console.log(`❌ Error Companies: ${errorCompanies}`);
  
  if (successfullyProcessed > 0) {
    const overallComplianceRate = Math.round((compliantCompanies / successfullyProcessed) * 100);
    console.log(`📊 Overall Compliance Rate: ${overallComplianceRate}%`);
  }
  
  const explorerLinks = getExplorerLinks(contractAddress, undefined, environment);
  console.log(`🔗 Account: ${explorerLinks.account}`);
  console.log(`✅ Verification process completed`);
  console.log('='.repeat(50));
}

/**
 * Display BUILD_ENV information and which config file will be used
 */
export function displayBuildEnvironmentInfo(): { buildEnv: string; configFile: string; environment: string } {
  const buildEnv = process.env.BUILD_ENV || 'LOCAL';
  const currentEnvironment = environmentManager.getCurrentEnvironment();
  const configFile = `config/environments/${buildEnv.toLowerCase()}.json`;
  
  console.log('\n📋 BUILD ENVIRONMENT CONFIGURATION');
  console.log('='.repeat(50));
  console.log(`🔧 BUILD_ENV: ${buildEnv}`);
  console.log(`🎯 Environment Manager: ${currentEnvironment}`);
  console.log(`📁 Config File: ${configFile}`);
  console.log(`🌐 Network Type: ${environmentManager.shouldConnectToDevnet() ? 'DEVNET' : currentEnvironment}`);
  console.log(`📊 Registry Type: ${environmentManager.getExpectedRegistryType()}`);
  console.log('='.repeat(50));
  
  return {
    buildEnv,
    configFile,
    environment: currentEnvironment
  };
}

/**
 * Validate that BUILD_ENV is properly set
 */
export function validateBuildEnvironment(): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  const buildEnv = process.env.BUILD_ENV;
  
  if (!buildEnv) {
    issues.push('BUILD_ENV is not set in .env file');
  } else {
    const validEnvs = ['LOCAL', 'TESTNET', 'MAINNET'];
    if (!validEnvs.includes(buildEnv.toUpperCase())) {
      issues.push(`BUILD_ENV "${buildEnv}" is not valid. Must be one of: ${validEnvs.join(', ')}`);
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}