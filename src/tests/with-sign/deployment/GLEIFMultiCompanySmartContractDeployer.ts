/**
 * GLEIF Multi-Company Smart Contract Deployer
 * Pure deployment logic with o1js best practices
 * 
 * Responsibilities:
 * ✅ Environment detection and Oracle registry initialization
 * ✅ Check existing deployment from config/{env}.json  
 * ✅ Contract accessibility verification with retry logic
 * ✅ Deploy ONLY if needed with optimized fees (1.1 MINA total)
 * ✅ Save deployment info to config
 * ✅ Enhanced verification and error handling
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Import o1js directly
import { Mina, PrivateKey, PublicKey, AccountUpdate, UInt64, fetchAccount } from 'o1js';

// Import ZK programs and contracts
import { GLEIFOptim } from '../../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { GLEIFOptimMultiCompanySmartContract } from '../../../contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js';

// Import infrastructure components
import { 
  initializeOracleRegistry,
  environmentManager,
  compilationManager,
  deploymentManager,
  getDeployerAccount,
  getDeployerKey
} from '../../../infrastructure/index.js';

// Import enhanced deployment verification
import { executeDeploymentWithRealVerification } from '../../../utils/transaction/EnhancedDeploymentVerification.js';

// Import shared utilities
import {
  getTransactionFee,
  checkContractAccessibility,
  displayDeploymentCosts,
  displayDeploymentSummary,
  getContractDeploymentInfo,
  displayBuildEnvironmentInfo,
  validateBuildEnvironment
} from '../GLEIFMultiCompanySharedUtils.js';



/**
 * Main deployment function
 */
export async function deployGLEIFMultiCompanySmartContract(
  forceRedeploy: boolean = false
): Promise<{
  contractAddress: string;
  transactionHash?: string;
  wasDeployed: boolean;
  verificationKey: any;
}> {
  
  console.log('\n🚀 GLEIF Multi-Company Smart Contract Deployer');
  console.log('='.repeat(60));
  console.log(`🔧 Force Redeploy: ${forceRedeploy ? 'YES' : 'NO'}`);

  try {
    // =================================== Validate BUILD_ENV ===================================
    console.log('\n📋 Step 0: Validating BUILD_ENV configuration...');
    
    const envValidation = validateBuildEnvironment();
    if (!envValidation.isValid) {
      console.error('❌ BUILD_ENV validation failed:');
      envValidation.issues.forEach(issue => console.error(`  • ${issue}`));
      throw new Error('Invalid BUILD_ENV configuration');
    }
    
    // Display BUILD_ENV information
    const buildInfo = displayBuildEnvironmentInfo();
    console.log(`✅ BUILD_ENV validation passed`);
    console.log(`📁 Deployment will be saved to: ${buildInfo.configFile}`);
    
    // =================================== Initialize Infrastructure ===================================
    console.log('\n📋 Step 1: Initializing infrastructure components...');
    
    // Initialize Oracle Registry
    await initializeOracleRegistry();
    
    // Get environment details
    const currentEnvironment = environmentManager.getCurrentEnvironment();
    const shouldConnectToDevnet = environmentManager.shouldConnectToDevnet();
    
    console.log(`✅ Environment: ${currentEnvironment}`);
    console.log(`🌐 Connect to DEVNET: ${shouldConnectToDevnet}`);
    
    // Initialize compilation manager
    await compilationManager.initialize();
    console.log('✅ Compilation Manager initialized');

    // =================================== Setup Blockchain Environment ===================================
    console.log('\n📋 Step 2: Setting up blockchain environment...');
    
    let deployerAccount: any;
    let deployerKey: any;
    
    if (currentEnvironment === 'TESTNET' && shouldConnectToDevnet) {
      // DEVNET MODE: Use Oracle Registry funded accounts
      console.log('🌐 DEVNET environment detected - using funded Oracle accounts');
      
      // Establish DEVNET connection
      console.log('🔧 Connecting to DEVNET GraphQL endpoint...');
      const devnetNetwork = Mina.Network('https://api.minascan.io/node/devnet/v1/graphql');
      Mina.setActiveInstance(devnetNetwork);
      console.log('✅ DEVNET connection established');
      
      // Get funded Oracle accounts
      try {
        deployerAccount = getDeployerAccount('GLEIF');
        deployerKey = getDeployerKey('GLEIF');
        
        // Verify deployer account
        await fetchAccount({ publicKey: deployerAccount });
        const accountInfo = Mina.getAccount(deployerAccount);
        const balance = Number(accountInfo.balance.toString()) / 1e9;
        
        console.log('✅ Blockchain environment initialized with DEVNET Oracle accounts');
        console.log(`  🎯 GLEIF Deployer: ${deployerAccount.toBase58()}`);
        console.log(`  💰 Balance: ${balance} MINA`);
        console.log('  🌐 Connected to: MINA DEVNET via Oracle Registry');
        
        if (balance < 2) {
          throw new Error(`Insufficient balance: ${balance} MINA (need at least 2 MINA)`);
        }
        
      } catch (oracleError) {
        console.error('❌ Failed to get Oracle accounts:', oracleError);
        throw new Error(`Oracle Registry not properly initialized for DEVNET: ${oracleError}`);
      }
      
    } else {
      // LOCAL MODE: Use LocalBlockchain for development
      console.log(`🔧 ${currentEnvironment} environment - creating LocalBlockchain for development`);
      
      const useProof = false;
      const Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
      Mina.setActiveInstance(Local);

      deployerAccount = Local.testAccounts[0].key.toPublicKey();
      deployerKey = Local.testAccounts[0].key;

      console.log('✅ Blockchain environment initialized with LocalBlockchain accounts');
      console.log(`  🔧 Local Deployer: ${deployerAccount.toBase58()}`);
      console.log('  🏠 Mode: Local development blockchain');
    }

    // =================================== Compile Contracts ===================================
    console.log('\n📋 Step 3: Compiling contracts...');
    
    // Compile GLEIFOptim first
    if (!compilationManager.isCompiled('GLEIFOptim')) {
      console.log('🔧 Compiling GLEIFOptim...');
      await GLEIFOptim.compile();
      console.log('✅ GLEIFOptim compiled and cached');
    } else {
      console.log('✅ GLEIFOptim already compiled (cached)');
    }
    
    // Compile main contract
    let verificationKey: any;
    if (!compilationManager.isCompiled('GLEIFOptimMultiCompanySmartContract')) {
      console.log('🔧 Compiling GLEIFOptimMultiCompanySmartContract...');
      const compilation = await GLEIFOptimMultiCompanySmartContract.compile();
      verificationKey = compilation.verificationKey;
      console.log('✅ GLEIFOptimMultiCompanySmartContract compiled and cached');
    } else {
      console.log('✅ GLEIFOptimMultiCompanySmartContract already compiled (cached)');
      const compilation = await GLEIFOptimMultiCompanySmartContract.compile();
      verificationKey = compilation.verificationKey;
    }

    // =================================== Check Existing Deployment ===================================
    console.log('\n📋 Step 4: Checking for existing deployment...');
    
    const currentConfig = await environmentManager.getCurrentConfig();
    const existingContract = currentConfig.deployments?.contracts?.GLEIFOptimMultiCompanySmartContract;
    
    let contractAddress: string;
    let transactionHash: string | undefined;
    let wasDeployed = false;
    
    if (existingContract && existingContract.address && !forceRedeploy) {
      // Found existing contract in config
      console.log(`✅ Found existing contract in config: ${existingContract.address}`);
      console.log(`📅 Deployed at: ${existingContract.deployedAt || 'Unknown'}`);
      console.log(`🔗 Transaction: ${existingContract.transactionHash || 'Unknown'}`);
      
      // Check if contract is accessible
      const zkAppAddress = PublicKey.fromBase58(existingContract.address);
      const isAccessible = await checkContractAccessibility(zkAppAddress);
      
      if (isAccessible) {
        console.log(`✅ Existing contract is accessible and functional`);
        console.log(`🔄 Skipping deployment, using existing contract`);
        
        return {
          contractAddress: existingContract.address,
          transactionHash: existingContract.transactionHash,
          wasDeployed: false,
          verificationKey
        };
      } else {
        console.log(`❌ Existing contract not accessible`);
        console.log(`🚀 Will deploy new contract instead`);
        wasDeployed = true;
      }
    } else if (forceRedeploy) {
      console.log(`🔄 Force redeploy requested - deploying new contract`);
      wasDeployed = true;
    } else {
      console.log(`📋 No existing contract found - deploying new contract`);
      wasDeployed = true;
    }

    // =================================== Deploy New Contract ===================================
    if (wasDeployed) {
      console.log('\n📋 Step 5: Deploying new smart contract...');
      
      // Generate new contract keys
      const zkAppKey = PrivateKey.random();
      const zkAppAddress = zkAppKey.toPublicKey();
      const zkApp = new GLEIFOptimMultiCompanySmartContract(zkAppAddress);

      contractAddress = zkAppAddress.toBase58();
      
      // Display deployment costs
      const deploymentFee = getTransactionFee(currentEnvironment);
      console.log(`💰 Deployment costs (o1js best practices):`);
      console.log(`   Deployment fee: ${deploymentFee.toString()} nanomina (${Number(deploymentFee.toString()) / 1e9} MINA)`);
      console.log(`   Account creation: 1000000000 nanomina (1 MINA - protocol standard)`);
      console.log(`   Total cost: ${Number(deploymentFee.toString()) + 1000000000} nanomina (${(Number(deploymentFee.toString()) + 1000000000) / 1e9} MINA)`);

      // Deploy with enhanced verification
      console.log('\n🚀 Executing deployment with o1js best practices...');
      
      const deploymentResult = await executeDeploymentWithRealVerification(
        zkApp,
        zkAppAddress,
        zkAppKey,
        deployerAccount,
        deployerKey,
        verificationKey,
        currentEnvironment
      );
      
      if (!deploymentResult.success || !deploymentResult.verified) {
        throw new Error(`Deployment verification failed: ${deploymentResult.verificationMethod}`);
      }
      
      transactionHash = deploymentResult.transactionHash;
      
      console.log(`\n✅ DEPLOYMENT SUCCESSFUL`);
      console.log(`   📊 Success: ${deploymentResult.success}`);
      console.log(`   🔍 Verified: ${deploymentResult.verified}`);
      console.log(`   🎯 Method: ${deploymentResult.verificationMethod}`);
      console.log(`   ⏱️ Time: ${deploymentResult.deploymentTime}ms`);
      console.log(`   🔗 Hash: ${deploymentResult.transactionHash}`);
      console.log(`   🏠 Address: ${contractAddress}`);

      // =================================== Save Deployment Info ===================================
      console.log('\n📋 Step 6: Saving deployment information...');
      
      try {
        await environmentManager.saveDeployment(
          'GLEIFOptimMultiCompanySmartContract',
          contractAddress,
          verificationKey,
          transactionHash
        );
        console.log(`✅ Deployment saved to config/${currentEnvironment.toLowerCase()}.json`);
      } catch (saveError: any) {
        console.warn(`⚠️ Failed to save deployment: ${saveError.message}`);
        console.log(`📝 Manual address for reference: ${contractAddress}`);
      }
      
    } else {
      // This case should not happen given the logic above, but included for completeness
      contractAddress = existingContract?.address || '';
      transactionHash = existingContract?.transactionHash;
    }

    // =================================== Final Summary ===================================
    console.log('\n📊 DEPLOYMENT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Status: ${wasDeployed ? 'NEW DEPLOYMENT COMPLETED' : 'EXISTING CONTRACT USED'}`);
    console.log(`🏠 Contract Address: ${contractAddress}`);
    console.log(`💰 Deployer Account: ${deployerAccount.toBase58()}`);
    if (wasDeployed && transactionHash) {
      console.log(`🔗 Transaction: https://minascan.io/devnet/tx/${transactionHash}`);
      console.log(`💰 Total Cost: ${(Number(getTransactionFee(currentEnvironment).toString()) + 1000000000) / 1e9} MINA`);
    }
    console.log(`🔗 Account: https://minascan.io/devnet/account/${contractAddress}`);
    console.log(`✅ Ready for GLEIF verification process`);
    console.log('='.repeat(50));

    return {
      contractAddress,
      transactionHash,
      wasDeployed,
      verificationKey
    };

  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED');
    console.error('Error:', error);
    throw error;
  }
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const forceRedeploy = args.includes('--force-redeploy') || args.includes('-f');
  
  console.log('🚀 GLEIF Multi-Company Smart Contract Deployer');
  console.log('='.repeat(60));
  
  if (forceRedeploy) {
    console.log('⚠️  Force redeploy requested - will deploy new contract regardless of existing deployment');
  }
  
  try {
    const result = await deployGLEIFMultiCompanySmartContract(forceRedeploy);
    
    console.log('\n🎉 DEPLOYMENT PROCESS COMPLETED SUCCESSFULLY!');
    console.log(`📍 Contract Address: ${result.contractAddress}`);
    
    if (result.wasDeployed) {
      console.log(`🆕 New contract deployed`);
      console.log(`🔗 Transaction: ${result.transactionHash}`);
      console.log(`💰 Cost: 1.1 MINA (optimized with o1js best practices)`);
    } else {
      console.log(`♻️ Using existing contract (no deployment needed)`);
      console.log(`💰 Cost: FREE (reusing existing deployment)`);
    }
    
    console.log('\n📋 Next Steps:');
    console.log('  1. ✅ Contract is ready for verification');
    console.log('  2. 🔄 Run GLEIFMultiCompanyVerifier.ts to verify companies');
    console.log('  3. 🌐 Check contract on MinaScan or MinaExplorer');
    
    process.exit(0);
    
  } catch (error) {
    console.error('💥 Fatal Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
  });
}