/**
 * GLEIF Environment-Aware Utilities - ENHANCED VERSION
 * Handles LOCAL, TESTNET, and MAINNET environments properly
 * Fixes all hardcoded DEVNET references
 */

import { PublicKey, Mina, fetchAccount } from 'o1js';
import { environmentManager } from '../../infrastructure/index.js';

export interface NetworkEndpoints {
  LOCAL: null;
  TESTNET: string;
  MAINNET: string;
}

export const NETWORK_ENDPOINTS: NetworkEndpoints = {
  LOCAL: null, // Use local blockchain
  TESTNET: 'https://api.minascan.io/node/devnet/v1/graphql',
  MAINNET: 'https://api.minaexplorer.com/mainnet/graphql'
};

/**
 * Environment-aware network connection
 */
export function getNetworkEndpoint(): string | null {
  const env = environmentManager.getCurrentEnvironment();
  console.log(`🌍 Current environment: ${env}`);
  
  switch (env) {
    case 'LOCAL':
      console.log('🏠 Using local blockchain for LOCAL environment');
      return null;
    
    case 'TESTNET':
      console.log('🧪 Using DEVNET endpoint for TESTNET environment');
      return NETWORK_ENDPOINTS.TESTNET;
    
    case 'MAINNET':
      console.log('🌐 Using MAINNET endpoint for MAINNET environment');
      return NETWORK_ENDPOINTS.MAINNET;
    
    default:
      console.warn(`⚠️ Unknown environment ${env}, defaulting to LOCAL`);
      return null;
  }
}

/**
 * Get environment name for display purposes
 */
export function getEnvironmentDisplayName(): string {
  const env = environmentManager.getCurrentEnvironment();
  
  switch (env) {
    case 'LOCAL':
      return 'LOCAL';
    case 'TESTNET':
      return 'DEVNET';  // Display as DEVNET since TESTNET maps to DEVNET
    case 'MAINNET':
      return 'MAINNET';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Get environment-specific explorer URLs
 */
export function getExplorerUrl(type: 'tx' | 'account', identifier: string): string {
  const env = environmentManager.getCurrentEnvironment();
  
  switch (env) {
    case 'LOCAL':
      return `Local blockchain ${type}: ${identifier}`;
    
    case 'TESTNET':
      return type === 'tx' 
        ? `https://minascan.io/devnet/tx/${identifier}`
        : `https://minascan.io/devnet/account/${identifier}`;
    
    case 'MAINNET':
      return type === 'tx'
        ? `https://minascan.io/mainnet/tx/${identifier}`
        : `https://minascan.io/mainnet/account/${identifier}`;
    
    default:
      return `Unknown environment ${type}: ${identifier}`;
  }
}

/**
 * Environment-aware network setup
 */
export function setupNetworkConnection(): boolean {
  const endpoint = getNetworkEndpoint();
  const env = environmentManager.getCurrentEnvironment();
  
  if (!endpoint) {
    console.log('🏠 LOCAL environment - using local blockchain');
    return true;
  }
  
  try {
    console.log(`🔗 Connecting to ${getEnvironmentDisplayName()} via ${endpoint}`);
    const Network = Mina.Network(endpoint);
    Mina.setActiveInstance(Network);
    console.log(`✅ Network connection established for ${getEnvironmentDisplayName()}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to ${getEnvironmentDisplayName()}:`, error);
    return false;
  }
}

/**
 * Environment-aware account fetching with retry logic
 */
export async function safelyFetchAccountWithRetry(
  zkAppAddress: PublicKey,
  maxRetries: number = 10,
  delayMs: number = 5000
): Promise<boolean> {
  const env = environmentManager.getCurrentEnvironment();
  const envDisplay = getEnvironmentDisplayName();
  console.log(`🔄 Fetching zkApp account with retry logic for ${envDisplay}...`);
  
  // LOCAL environment - check local blockchain only
  if (env === 'LOCAL') {
    console.log('🏠 LOCAL environment detected - checking local blockchain');
    
    try {
      const account = Mina.getAccount(zkAppAddress);
      
      if (account && account.zkapp) {
        console.log(`✅ zkApp account found in local blockchain`);
        console.log(`💰 Balance: ${Number(account.balance.toString()) / 1e9} MINA`);
        console.log(`📊 App State: ${account.zkapp.appState.map(f => f.toString()).join(', ')}`);
        return true;
      } else if (account) {
        console.log(`⚠️ Account exists locally but not yet a zkApp`);
        return false;
      } else {
        console.log(`❌ Account not found in local blockchain`);
        return false;
      }
    } catch (error: any) {
      console.log(`❌ Local account check failed: ${error.message}`);
      return false;
    }
  }
  
  // Network environments (TESTNET/MAINNET) - use retry logic
  const endpoint = getNetworkEndpoint();
  if (!endpoint) {
    console.log(`❌ No endpoint configured for environment: ${envDisplay}`);
    return false;
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries} - Fetching account from ${envDisplay}...`);
      
      // Re-establish network connection for each attempt
      const Network = Mina.Network(endpoint);
      Mina.setActiveInstance(Network);
      console.log(`   ✅ Network set to: ${endpoint}`);
      
      // Fetch account
      await fetchAccount({ publicKey: zkAppAddress });
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
        
        if (attempt === maxRetries) {
          console.log(`⚠️ Account exists but not yet activated as zkApp after ${maxRetries} attempts`);
          console.log(`💡 This may be normal - zkApp activation can take additional time`);
          return false;
        }
      } else {
        console.log(`❌ Account not found on ${envDisplay} (attempt ${attempt})`);
        console.log(`⏳ Transaction may still be processing...`);
      }
      
    } catch (error: any) {
      console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
      if (error.message.includes("Cannot destructure")) {
        console.log(`   💡 This means the account doesn't exist yet - normal for ${envDisplay}`);
      }
      
      if (attempt === maxRetries) {
        console.log(`🚨 All ${maxRetries} attempts failed`);
        console.log(`⏳ Account may still be processing - this is normal for ${envDisplay}`);
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
 * Environment-aware deployment confirmation
 */
export async function waitForDeploymentConfirmation(
  transactionHash: string,
  contractAddress: PublicKey
): Promise<boolean> {
  const env = environmentManager.getCurrentEnvironment();
  const envDisplay = getEnvironmentDisplayName();
  
  if (env === 'LOCAL') {
    console.log(`✅ Skipping ${envDisplay} verification for LOCAL environment`);
    console.log('🏠 Using LOCAL blockchain environment as configured');
    
    // For local blockchain, just verify the account exists
    try {
      const account = Mina.getAccount(contractAddress);
      if (account && account.zkapp) {
        console.log('✅ Local deployment verified - zkApp account active');
        return true;
      } else {
        console.log('⚠️ Local deployment pending - account not yet active');
        return false;
      }
    } catch (error) {
      console.log('❌ Local deployment verification failed');
      return false;
    }
  }
  
  // For network environments, wait for confirmation
  console.log(`⏳ Waiting for deployment transaction to be confirmed on ${envDisplay}...`);
  
  const confirmed = await safelyFetchAccountWithRetry(contractAddress);
  
  if (confirmed) {
    console.log(`✅ Deployment transaction confirmed on ${envDisplay}`);
    return true;
  } else {
    console.log(`❌ Deployment confirmation timeout on ${envDisplay}`);
    return false;
  }
}

/**
 * Environment-aware account fetching with proper logging
 */
export async function fetchDeployedZkAppAccount(contractAddress: PublicKey): Promise<boolean> {
  const env = environmentManager.getCurrentEnvironment();
  const envDisplay = getEnvironmentDisplayName();
  
  console.log(`📋 Fetching deployed zkApp account from ${envDisplay}...`);
  console.log(`📋 Account Details:`);
  console.log(`   • zkApp Address: ${contractAddress.toBase58()}`);
  console.log(`   • Environment: ${envDisplay}`);
  
  if (env === 'LOCAL') {
    console.log(`   • Mode: Local blockchain verification`);
  } else {
    console.log(`   • Endpoint: ${getNetworkEndpoint()}`);
  }
  
  return await safelyFetchAccountWithRetry(contractAddress);
}

/**
 * Environment-aware transaction wait
 */
export async function waitForTransactionConfirmation(
  transactionResult: any,
  description: string = 'transaction'
): Promise<void> {
  const env = environmentManager.getCurrentEnvironment();
  const envDisplay = getEnvironmentDisplayName();
  
  if (env === 'LOCAL') {
    console.log(`✅ LOCAL environment - skipping network confirmation for ${description}`);
    return;
  }
  
  console.log(`⏳ Waiting for ${description} to be included in ${envDisplay}...`);
  try {
    await transactionResult.wait();
    console.log(`✅ Transaction confirmed on ${envDisplay}`);
  } catch (waitError: any) {
    console.log(`⚠️ Transaction wait failed, but proceeding: ${waitError.message}`);
  }
}

/**
 * Log explorer links in environment-aware way
 */
export function logExplorerLinks(transactionHash: string, contractAddress: string): void {
  const env = environmentManager.getCurrentEnvironment();
  
  console.log(`🔗 Explorer Links:`);
  if (env === 'LOCAL') {
    console.log(`   • Transaction: Local blockchain tx: ${transactionHash}`);
    console.log(`   • Account: Local blockchain account: ${contractAddress}`);
  } else {
    console.log(`   • Transaction: ${getExplorerUrl('tx', transactionHash)}`);
    console.log(`   • Account: ${getExplorerUrl('account', contractAddress)}`);
  }
}

/**
 * Environment validation for GLEIF operations
 */
export function validateEnvironmentForGLEIF(): void {
  const env = environmentManager.getCurrentEnvironment();
  const envDisplay = getEnvironmentDisplayName();
  const shouldUseNetwork = environmentManager.shouldUseNetworkRegistry();
  const shouldConnectToDevnet = environmentManager.shouldConnectToDevnet();
  
  console.log(`🔍 GLEIF Environment Validation:`);
  console.log(`  Environment: ${envDisplay}`);
  console.log(`  Should use Network Registry: ${shouldUseNetwork}`);
  console.log(`  Should connect to DEVNET: ${shouldConnectToDevnet}`);
  
  if (env === 'LOCAL') {
    console.log(`✅ LOCAL environment - will use local blockchain only`);
  } else if (env === 'TESTNET') {
    console.log(`✅ TESTNET environment - will connect to DEVNET`);
  } else if (env === 'MAINNET') {
    console.log(`✅ MAINNET environment - will connect to MAINNET`);
  }
}
