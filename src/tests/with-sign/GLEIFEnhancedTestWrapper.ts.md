/**
 * Enhanced GLEIF Test Wrapper
 * Ensures proper DEVNET connection and funded account usage
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { fetchAccount } from 'o1js';
import { 
  initializeOracleRegistry,
  getDeployerAccount,
  getDeployerKey,
  environmentManager,
  deploymentManager
} from '../../infrastructure/index.js';
import { getEnvironmentDisplayName } from './GLEIFEnvironmentAwareUtils.js';

//import { 
//  getGLEIFOptimMultiCompanyRefactoredInfrastructureVerificationWithSignUtils 
//} from './GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSignUtils.js';

//import { getGLEIFMultiCompanyVerifierUtils} from './GLEIFNetworkMultiVerifierUtils.js';
import { getGLEIFNetworkMultiVerifierUtils} from './GLEIFNetworkMultiVerifierUtils.js';

/**
 * Enhanced GLEIF verification with proper account management
 * Ensures DEVNET connection and funded account usage
 */
export async function runGLEIFTestWithFundedAccounts(companyNames: string[]) {
  console.log('\n🔧 ENHANCED GLEIF TEST - ENSURING FUNDED ACCOUNT USAGE');
  console.log('='.repeat(70));
  
  try {
    // Step 1: Environment-aware Oracle Registry initialization
    console.log('\n📋 Step 1: Initializing Oracle Registry with environment-aware accounts...');
    
    // ✅ CRITICAL: Initialize Oracle Registry BEFORE the utils function runs
    await initializeOracleRegistry();
    
    // Verify Oracle Registry is properly initialized with environment awareness
    const currentEnv = environmentManager.getCurrentEnvironment();
    const shouldConnectToDevnet = environmentManager.shouldConnectToDevnet();
    
    console.log(`🌐 Environment: ${currentEnv}`);
    console.log(`🔗 Connect to DEVNET: ${shouldConnectToDevnet}`);
    
    if (currentEnv === 'TESTNET' && shouldConnectToDevnet) {
      console.log('✅ CONFIRMED: Oracle Registry initialized for DEVNET with funded accounts');
      
      // Verify we can access the funded accounts
      try {
        const gleifDeployer = getDeployerAccount('GLEIF');
        const gleifDeployerKey = getDeployerKey('GLEIF');
        
        console.log(`🎯 GLEIF Deployer Account: ${gleifDeployer.toBase58()}`);
        console.log(`📋 Role: Contract deployment and management`);
        console.log(`🌐 Network: ${getEnvironmentDisplayName()}`);
        
        // Fetch actual balance dynamically
        try {
          const deployerBalance = await fetchAccount({ publicKey: gleifDeployer });
          const actualBalance = Number(deployerBalance.account?.balance?.toString() || '0') / 1e9;
          console.log(`💰 Current Balance: ${actualBalance.toFixed(3)} MINA (Real-time from TESTNET)`);
        } catch (balanceError) {
          console.log(`💰 Balance: Unable to fetch (will be verified during deployment)`);
          console.log(`💡 This is normal if the account is not yet deployed on the network`);
        }
        
        console.log('✅ DEVNET Oracle accounts accessible');
        
      } catch (accountError) {
        console.error('❌ Failed to access Oracle accounts:', accountError);
        throw new Error(`Oracle accounts not accessible: ${accountError}`);
      }
      
    } else if (currentEnv === 'LOCAL') {
      console.log('✅ LOCAL environment confirmed - will use local blockchain only');
    } else if (currentEnv === 'MAINNET') {
      console.log('✅ MAINNET environment confirmed - will use mainnet');
    } else {
      console.warn(`⚠️ Environment: ${currentEnv}, DEVNET: ${shouldConnectToDevnet} - using detected mode`);
    }
    
    // Step 2: Run the actual GLEIF test with proper Oracle setup
    console.log('\n📋 Step 2: Running GLEIF verification with enhanced setup...');
    console.log('🚀 Starting GLEIF Multi-Company verification...');
    console.log('🎯 Oracle Registry initialized - utils will use environment-aware accounts');
    
    const result = await getGLEIFNetworkMultiVerifierUtils(companyNames);
    
    console.log('\n✅ ENHANCED GLEIF TEST COMPLETED SUCCESSFULLY!');
    
    if (currentEnv === 'TESTNET' && shouldConnectToDevnet) {
      console.log('🎯 Transactions should now appear in DEVNET explorer');
      console.log('🔗 Check: https://minascan.io/devnet/');
      console.log('🔗 Check: https://devnet.minaexplorer.com/');
    } else if (currentEnv === 'MAINNET') {
      console.log('🎯 Transactions should now appear in MAINNET explorer');
      console.log('🔗 Check: https://minascan.io/mainnet/');
    } else {
      console.log('🏠 Local blockchain transactions completed');
    }
    
    return result;
    
  } catch (error) {
    console.error('\n❌ ENHANCED GLEIF TEST FAILED');
    if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }
    throw error;
  }
}
