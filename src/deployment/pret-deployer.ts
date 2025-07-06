/**
 * PRETDeployer - Enhanced o1js Best Practices Implementation
 * Race condition safe, comprehensive microstep tracing, detailed status tracking
 */

import { PrivateKey, PublicKey, Mina, AccountUpdate, fetchAccount, UInt64, Field } from 'o1js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DeploymentResult {
  success: boolean;
  contractAddress: string;
  transactionHash: string;
  alias: string;
  verificationKey?: any;
  deploymentTime: number;
  steps: DeploymentStep[];
  accountTracking: AccountTrackingResult;
  zkAppState: string[];
  finalBalance: number;
}

interface DeploymentStep {
  name: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startTime: number;
  endTime?: number;
  duration?: number;
  details?: any;
  error?: string;
  microsteps?: MicroStep[];
}

interface MicroStep {
  name: string;
  timestamp: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  duration?: number;
  details?: any;
  error?: string;
}

interface AccountTrackingResult {
  deployer: {
    address: string;
    initialBalance: number;
    finalBalance: number;
    balanceChange: number;
    initialNonce: number;
    finalNonce: number;
    nonceChange: number;
  };
  sender: {
    address: string;
    initialBalance: number;
    finalBalance: number;
    balanceChange: number;
    initialNonce: number;
    finalNonce: number;
    nonceChange: number;
    feePaid: number;
  };
  contract: {
    address: string;
    exists: boolean;
    balance: number;
    nonce: number;
    zkAppState: string[];
    verificationKeyHash?: string;
  };
}

interface DeploymentContext {
  environment: string;
  alias: any;
  config: any;
  networkConfig: any;
  contractName: string;
  deployerKey: PrivateKey;
  senderKey: PrivateKey;
}

export class PRETDeployer {
  private static steps: DeploymentStep[] = [];
  private static deploymentLock: Set<string> = new Set();

  /**
   * Main deployment entry point with race condition protection
   * ✅ Race condition safe with deployment locking
   * ✅ Comprehensive microstep tracing
   * ✅ Detailed account and balance tracking
   */
  static async deploy(aliasName: string): Promise<DeploymentResult> {
    // Race condition protection
    if (this.deploymentLock.has(aliasName)) {
      throw new Error(`Deployment already in progress for alias: ${aliasName}`);
    }
    
    this.deploymentLock.add(aliasName);
    
    try {
      return await this.executeDeploymentInternal(aliasName);
    } finally {
      this.deploymentLock.delete(aliasName);
    }
  }

  private static async executeDeploymentInternal(aliasName: string): Promise<DeploymentResult> {
    const deploymentStart = Date.now();
    this.steps = [];
    let accountTracking: AccountTrackingResult;

    try {
      console.log(`🚀 Starting deployment for alias: ${aliasName}`);
      console.log(`⏰ Start time: ${new Date().toISOString()}`);
      console.log(''.padEnd(80, '='));
      
      // Step 1: Load and validate configuration
      const context = await this.executeStep('CONFIG_LOADING', async (step) => {
        return this.loadAndValidateConfig(aliasName, step);
      });

      // Step 2: Initialize network connection
      await this.executeStep('NETWORK_INIT', async (step) => {
        await this.initializeNetwork(context.environment, context.networkConfig, step);
        return context;
      });

      // Step 3: Initial account tracking and validation
      const initialTracking = await this.executeStep('ACCOUNT_VALIDATION', async (step) => {
        return await this.validateAndTrackAccounts(context.deployerKey, context.senderKey, step);
      });

      // Step 4: Compile contract
      const compilationResult = await this.executeStep('COMPILATION', async (step) => {
        return await this.compileContract(context.contractName, step);
      });

      // Step 5: Pre-deployment account snapshot
      const preDeploymentSnapshot = await this.executeStep('PRE_DEPLOYMENT_SNAPSHOT', async (step) => {
        return await this.captureAccountSnapshot(context.deployerKey, context.senderKey, "pre-deployment", step);
      });

      // Step 6: Create and execute deployment transaction
      const deploymentResult = await this.executeStep('DEPLOYMENT', async (step) => {
        return await this.executeContractDeployment(
          compilationResult.ContractClass,
          context.deployerKey,
          context.senderKey,
          aliasName,
          step
        );
      });

      // Step 7: Wait for transaction confirmation with race-safe polling
      const confirmationResult = await this.executeStep('CONFIRMATION', async (step) => {
        return await this.waitForConfirmationSafe(
          deploymentResult.transactionHash,
          deploymentResult.contractAddress,
          step
        );
      });

      // Step 8: Post-deployment account tracking
      const postDeploymentSnapshot = await this.executeStep('POST_DEPLOYMENT_TRACKING', async (step) => {
        return await this.captureCompleteAccountTracking(
          context.deployerKey,
          context.senderKey,
          deploymentResult.contractAddress,
          preDeploymentSnapshot,
          step
        );
      });

      // Step 9: Update deployment records
      await this.executeStep('RECORD_UPDATE', async (step) => {
        await this.updateDeploymentRecord(aliasName, deploymentResult, compilationResult.verificationKey, step);
        return deploymentResult;
      });

      accountTracking = postDeploymentSnapshot;
      const totalTime = Date.now() - deploymentStart;
      
      console.log(''.padEnd(80, '='));
      console.log(`✅ Deployment completed successfully in ${totalTime}ms`);
      console.log(`⏰ End time: ${new Date().toISOString()}`);

      return {
        ...deploymentResult,
        verificationKey: compilationResult.verificationKey,
        deploymentTime: totalTime,
        steps: this.steps,
        accountTracking,
        zkAppState: confirmationResult.appState || [],
        finalBalance: accountTracking.contract.balance
      };

    } catch (error) {
      const totalTime = Date.now() - deploymentStart;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(''.padEnd(80, '='));
      console.log(`❌ Deployment failed after ${totalTime}ms: ${errorMessage}`);
      console.log(`⏰ Failed at: ${new Date().toISOString()}`);
      
      return {
        success: false,
        contractAddress: '',
        transactionHash: '',
        alias: aliasName,
        deploymentTime: totalTime,
        steps: this.steps,
        accountTracking: {} as AccountTrackingResult,
        zkAppState: [],
        finalBalance: 0
      };
    }
  }

  /**
   * Load configuration from environment files with detailed tracing
   */
  private static loadAndValidateConfig(aliasName: string, step: DeploymentStep): DeploymentContext {
    this.addMicroStep(step, 'DETERMINE_ENVIRONMENT', () => {
      // Determine environment from alias
      let environment: string;
      if (aliasName.startsWith('local-')) environment = 'local';
      else if (aliasName.startsWith('testnet-')) environment = 'testnet';
      else if (aliasName.startsWith('mainnet-')) environment = 'mainnet';
      else throw new Error(`Cannot determine environment from alias: ${aliasName}`);
      
      // Set BUILD_ENV for consistency with existing infrastructure
      if (environment === 'testnet') {
        process.env.BUILD_ENV = 'TESTNET';
      } else if (environment === 'mainnet') {
        process.env.BUILD_ENV = 'MAINNET';
      } else {
        process.env.BUILD_ENV = 'LOCAL';
      }
      
      return { environment };
    });

    const configData = this.addMicroStep(step, 'LOAD_CONFIG_FILE', () => {
      const environment = step.microsteps![0].details.environment;
      const configPath = path.join(__dirname, `../../config/environments/${environment}.json`);
      
      if (!fs.existsSync(configPath)) {
        throw new Error(`Environment config not found: ${configPath}`);
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { config, configPath, environment };
    });

    const aliasValidation = this.addMicroStep(step, 'VALIDATE_ALIAS', () => {
      const { config, environment } = configData;
      
      if (!config.deployAliases || !config.deployAliases[aliasName]) {
        throw new Error(`Deployment alias '${aliasName}' not found in ${environment} config`);
      }

      const alias = config.deployAliases[aliasName];
      const oracleConfig = config.oracles[alias.oracle];

      if (!oracleConfig) {
        throw new Error(`Oracle '${alias.oracle}' not configured in ${environment}`);
      }

      return { alias, oracleConfig };
    });

    const keyValidation = this.addMicroStep(step, 'VALIDATE_PRODUCTION_KEYS', () => {
      const { environment } = configData;
      const { oracleConfig } = aliasValidation;
      
      // Validate production keys for mainnet
      if (environment === 'mainnet') {
        if (oracleConfig.deployer.privateKey.includes('PLACEHOLDER') || 
            oracleConfig.sender.privateKey.includes('PLACEHOLDER')) {
          throw new Error('Production keys must be configured before mainnet deployment');
        }
      }
      return { validated: true };
    });

    const keyLoading = this.addMicroStep(step, 'LOAD_PRIVATE_KEYS', () => {
      const { oracleConfig } = aliasValidation;
      
      // Load and validate keys (config-only, no random generation)
      const deployerKey = PrivateKey.fromBase58(oracleConfig.deployer.privateKey);
      const senderKey = PrivateKey.fromBase58(oracleConfig.sender.privateKey);

      return {
        deployerKey,
        senderKey,
        deployerAddress: deployerKey.toPublicKey().toBase58(),
        senderAddress: senderKey.toPublicKey().toBase58()
      };
    });

    const { config, environment } = configData;
    const { alias } = aliasValidation;
    const { deployerKey, senderKey, deployerAddress, senderAddress } = keyLoading;

    console.log(`📋 Configuration loaded:`);
    console.log(`   Environment: ${environment}`);
    console.log(`   Alias: ${aliasName}`);
    console.log(`   Contract: ${alias.contractName}`);
    console.log(`   Oracle: ${alias.oracle}`);
    console.log(`   Deployer: ${deployerAddress}`);
    console.log(`   Sender: ${senderAddress}`);

    return {
      environment,
      alias,
      config,
      networkConfig: config.network,
      contractName: alias.contractName,
      deployerKey,
      senderKey
    };
  }

  /**
   * Initialize network connection with detailed connection tracking
   */
  private static async initializeNetwork(environment: string, networkConfig: any, step: DeploymentStep): Promise<void> {
    console.log(`🌐 Connecting to ${environment} network...`);
    console.log(`   Mina Endpoint: ${networkConfig.minaEndpoint}`);
    console.log(`   Archive Endpoint: ${networkConfig.archiveEndpoint}`);

    await this.addMicroStepAsync(step, 'SETUP_NETWORK_INSTANCE', async () => {
      const Network = Mina.Network({
        mina: networkConfig.minaEndpoint,
        archive: networkConfig.archiveEndpoint
      });

      Mina.setActiveInstance(Network);
      return { networkConfigured: true };
    });

    await this.addMicroStepAsync(step, 'TEST_NETWORK_CONNECTION', async () => {
      try {
        const networkId = await Mina.getNetworkId();
        console.log(`✅ Connected to network: ${networkId}`);
        return { networkId, connected: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to connect to ${environment} network: ${errorMessage}`);
      }
    });
  }

  /**
   * Validate and track initial account states
   */
  private static async validateAndTrackAccounts(deployerKey: PrivateKey, senderKey: PrivateKey, step: DeploymentStep): Promise<any> {
    console.log(`👤 Validating accounts...`);

    const deployerValidation = await this.addMicroStepAsync(step, 'VALIDATE_DEPLOYER_ACCOUNT', async () => {
      const deployerAccount = await fetchAccount({ publicKey: deployerKey.toPublicKey() });
      if (!deployerAccount.account) {
        throw new Error('Deployer account not found on chain');
      }

      const balance = Number(deployerAccount.account.balance.toString()) / 10**9;
      const nonce = Number(deployerAccount.account.nonce.toString());
      
      return {
        address: deployerKey.toPublicKey().toBase58(),
        balance,
        nonce,
        exists: true
      };
    });

    const senderValidation = await this.addMicroStepAsync(step, 'VALIDATE_SENDER_ACCOUNT', async () => {
      const senderAccount = await fetchAccount({ publicKey: senderKey.toPublicKey() });
      if (!senderAccount.account) {
        throw new Error('Sender account not found on chain');
      }

      const balance = Number(senderAccount.account.balance.toString()) / 10**9;
      const nonce = Number(senderAccount.account.nonce.toString());

      if (balance < 1) {
        throw new Error(`Insufficient sender balance: ${balance} MINA (minimum 1 MINA required)`);
      }

      return {
        address: senderKey.toPublicKey().toBase58(),
        balance,
        nonce,
        exists: true
      };
    });

    console.log(`✅ Accounts validated:`);
    console.log(`   Deployer balance: ${deployerValidation.balance} MINA (nonce: ${deployerValidation.nonce})`);
    console.log(`   Sender balance: ${senderValidation.balance} MINA (nonce: ${senderValidation.nonce})`);

    return { deployerValidation, senderValidation };
  }

  /**
   * Compile contract with detailed compilation tracking
   */
  private static async compileContract(contractName: string, step: DeploymentStep): Promise<any> {
    console.log(`⚙️  Compiling ${contractName}...`);
    
    const contractLoading = await this.addMicroStepAsync(step, 'LOAD_CONTRACT_CLASS', async () => {
      const contractPath = `../contracts/with-sign/${contractName}.js`;
      
      try {
        const contractModule = await import(contractPath);
        const ContractClass = contractModule[contractName];

        if (!ContractClass) {
          throw new Error(`Contract class '${contractName}' not found in ${contractPath}`);
        }

        return { ContractClass, contractPath };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to load contract ${contractName}: ${errorMessage}`);
      }
    });

    // Compile dependencies first (GLEIFOptim ZK program)
    await this.addMicroStepAsync(step, 'COMPILE_DEPENDENCIES', async () => {
      console.log(`   🔄 Compiling dependencies... (GLEIFOptim ZK program)`);
      
      try {
        // Import and compile GLEIFOptim ZK program
        const zkProgramPath = `../zk-programs/with-sign/GLEIFOptimZKProgram.js`;
        const zkProgramModule = await import(zkProgramPath);
        const GLEIFOptim = zkProgramModule.GLEIFOptim;
        
        if (!GLEIFOptim) {
          throw new Error('GLEIFOptim ZK program not found');
        }
        
        const dependencyStart = Date.now();
        await GLEIFOptim.compile();
        const dependencyTime = Date.now() - dependencyStart;
        
        console.log(`   ✅ GLEIFOptim ZK program compiled in ${dependencyTime}ms`);
        return { dependencyTime };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to compile dependencies: ${errorMessage}`);
      }
    });

    const compilation = await this.addMicroStepAsync(step, 'COMPILE_CONTRACT', async () => {
      const { ContractClass } = contractLoading;
      const compilationStart = Date.now();
      
      console.log(`   🔄 Compiling main contract... (this may take 30-60 seconds)`);
      const { verificationKey } = await ContractClass.compile();
      const compilationTime = Date.now() - compilationStart;

      console.log(`✅ Compilation completed in ${compilationTime}ms`);
      console.log(`🔑 Verification Key Hash: ${verificationKey.hash}`);

      return { verificationKey, compilationTime };
    });

    return {
      ContractClass: contractLoading.ContractClass,
      verificationKey: compilation.verificationKey,
      compilationTime: compilation.compilationTime
    };
  }

  /**
   * Capture detailed account snapshot
   */
  private static async captureAccountSnapshot(deployerKey: PrivateKey, senderKey: PrivateKey, phase: string, step: DeploymentStep): Promise<any> {
    console.log(`📸 Capturing ${phase} account snapshot...`);

    const deployerSnapshot = await this.addMicroStepAsync(step, `SNAPSHOT_DEPLOYER_${phase.toUpperCase()}`, async () => {
      const account = await fetchAccount({ publicKey: deployerKey.toPublicKey() });
      return {
        address: deployerKey.toPublicKey().toBase58(),
        balance: Number(account.account!.balance.toString()) / 10**9,
        nonce: Number(account.account!.nonce.toString()),
        timestamp: Date.now()
      };
    });

    const senderSnapshot = await this.addMicroStepAsync(step, `SNAPSHOT_SENDER_${phase.toUpperCase()}`, async () => {
      const account = await fetchAccount({ publicKey: senderKey.toPublicKey() });
      return {
        address: senderKey.toPublicKey().toBase58(),
        balance: Number(account.account!.balance.toString()) / 10**9,
        nonce: Number(account.account!.nonce.toString()),
        timestamp: Date.now()
      };
    });

    console.log(`📊 ${phase} snapshot:`);
    console.log(`   Deployer: ${deployerSnapshot.balance} MINA (nonce: ${deployerSnapshot.nonce})`);
    console.log(`   Sender: ${senderSnapshot.balance} MINA (nonce: ${senderSnapshot.nonce})`);

    return { deployer: deployerSnapshot, sender: senderSnapshot };
  }

  /**
   * Execute contract deployment with detailed transaction tracking
   */
  private static async executeContractDeployment(
    ContractClass: any,
    deployerKey: PrivateKey,
    senderKey: PrivateKey,
    aliasName: string,
    step: DeploymentStep
  ): Promise<any> {
    console.log(`🚀 Executing deployment...`);

    const addressGeneration = this.addMicroStep(step, 'GENERATE_CONTRACT_ADDRESS', () => {
      // ✅ CORRECT o1js pattern: Generate fresh zkApp account (official best practice)
      const zkAppPrivateKey = PrivateKey.random(); // Fresh account for zkApp!
      const contractAddress = zkAppPrivateKey.toPublicKey();
      const senderAddress = senderKey.toPublicKey();

      console.log(`📍 Contract will be deployed at: ${contractAddress.toBase58()} (NEW zkApp account)`);
      console.log(`🔑 zkApp private key: ${zkAppPrivateKey.toBase58()}`); // SAVE THIS SECURELY!
      console.log(`💼 Deployer stays at: ${deployerKey.toPublicKey().toBase58()} (unchanged)`);
      console.log(`💳 Sender pays fees: ${senderAddress.toBase58()}`);
      
      // ⚠️ CRITICAL: Save zkApp key securely for future interactions
      // TODO: Save zkAppPrivateKey to secure storage/config
      
      return {
        contractAddress: contractAddress.toBase58(),
        contractPublicKey: contractAddress,
        zkAppPrivateKey, // Include for signing
        senderAddress: senderAddress.toBase58(),
        senderPublicKey: senderAddress
      };
    });

    const contractInstance = this.addMicroStep(step, 'CREATE_CONTRACT_INSTANCE', () => {
      const { contractPublicKey } = addressGeneration;
      const contract = new ContractClass(contractPublicKey);
      return { contract };
    });

    const transactionCreation = await this.addMicroStepAsync(step, 'CREATE_DEPLOYMENT_TRANSACTION', async () => {
      const { senderPublicKey } = addressGeneration;
      const { contract } = contractInstance;
      
      console.log(`🔄 Creating deployment transaction...`);
      
      // ✅ o1js transaction pattern with proper account funding
      const deployTx = await Mina.transaction(
        {
          sender: senderPublicKey,
          fee: 100_000_000, // 0.1 MINA
          memo: `Deploy via ${aliasName}`
        },
        async () => {
          // ✅ CRITICAL: Fund the new zkApp account (required for new accounts)
          AccountUpdate.fundNewAccount(senderPublicKey);
          await contract.deploy();
        }
      );

      return { deployTx };
    });

    const proving = await this.addMicroStepAsync(step, 'GENERATE_PROOF', async () => {
      const { deployTx } = transactionCreation;
      
      console.log(`🔄 Generating proof... (this may take 10-30 seconds)`);
      const proofStart = Date.now();
      await deployTx.prove();
      const proofTime = Date.now() - proofStart;
      
      console.log(`✅ Proof generated in ${proofTime}ms`);
      return { proofTime };
    });

    const signing = this.addMicroStep(step, 'SIGN_TRANSACTION', () => {
      const { deployTx } = transactionCreation;
      const { zkAppPrivateKey } = addressGeneration;
      
      console.log(`✍️  Signing transaction...`);
      deployTx.sign([senderKey, zkAppPrivateKey]); // Include zkApp key!
      return { signed: true };
    });

    const broadcasting = await this.addMicroStepAsync(step, 'BROADCAST_TRANSACTION', async () => {
      const { deployTx } = transactionCreation;
      
      console.log(`📡 Broadcasting transaction...`);
      const broadcastStart = Date.now();
      const txResult = await deployTx.send();
      const broadcastTime = Date.now() - broadcastStart;

      if (txResult.status !== 'pending') {
        throw new Error(`Transaction failed: ${JSON.stringify(txResult.errors)}`);
      }

      console.log(`✅ Transaction broadcast successful in ${broadcastTime}ms`);
      console.log(`🆔 Transaction Hash: ${txResult.hash}`);

      return { 
        txResult, 
        transactionHash: txResult.hash,
        broadcastTime,
        status: txResult.status
      };
    });

    return {
      success: true,
      contractAddress: addressGeneration.contractAddress,
      transactionHash: broadcasting.transactionHash,
      zkAppPrivateKey: addressGeneration.zkAppPrivateKey.toBase58(),
      proofTime: proving.proofTime,
      broadcastTime: broadcasting.broadcastTime
    };
  }

  /**
   * Wait for transaction confirmation with race-safe polling
   */
  private static async waitForConfirmationSafe(txHash: string, contractAddress: string, step: DeploymentStep): Promise<any> {
    console.log(`⏳ Waiting for transaction confirmation...`);
    
    const pollingSetup = this.addMicroStep(step, 'SETUP_CONFIRMATION_POLLING', () => {
      const maxWaitTime = 10 * 60 * 1000; // 10 minutes
      const checkInterval = 30 * 1000; // 30 seconds
      const startTime = Date.now();
      
      return { maxWaitTime, checkInterval, startTime };
    });

    const { maxWaitTime, checkInterval, startTime } = pollingSetup;
    let pollCount = 0;

    while (Date.now() - startTime < maxWaitTime) {
      pollCount++;
      
      const pollResult = await this.addMicroStepAsync(step, `CONFIRMATION_POLL_${pollCount}`, async () => {
        try {
          const pollStart = Date.now();
          
          // Check if contract exists and is properly deployed
          const accountResult = await fetchAccount({ publicKey: PublicKey.fromBase58(contractAddress) });
          const pollTime = Date.now() - pollStart;
          
          // Handle case where account doesn't exist yet (normal during deployment)
          if (!accountResult.account) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`⏳ Still waiting for account creation... (${elapsed}s elapsed, poll #${pollCount}, ${pollTime}ms)`);
            
            return {
              confirmed: false,
              pollTime,
              elapsed,
              pollCount,
              status: 'account_not_created'
            };
          }
          
          if (accountResult.account && accountResult.account.zkapp) {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            
            // Log contract state
            const balance = Number(accountResult.account.balance.toString()) / 10**9;
            const nonce = accountResult.account.nonce.toString();
            const appState = accountResult.account.zkapp.appState.map(f => f.toString());
            
            console.log(`✅ Transaction confirmed! (${elapsed}s, poll #${pollCount})`);
            console.log(`📋 Contract deployed successfully:`);
            console.log(`   📍 Address: ${contractAddress}`);
            console.log(`   💰 Balance: ${balance} MINA`);
            console.log(`   🔢 Nonce: ${nonce}`);
            console.log(`   📊 State: [${appState.join(', ')}]`);
            
            return {
              confirmed: true,
              balance,
              nonce,
              appState,
              pollTime,
              elapsed,
              pollCount
            };
          }

          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`⏳ Still waiting for confirmation... (${elapsed}s elapsed, poll #${pollCount}, ${pollTime}ms)`);
          
          return {
            confirmed: false,
            pollTime,
            elapsed,
            pollCount
          };
          
        } catch (error) {
          const pollStart = Date.now();
          const pollTime = Date.now() - pollStart;
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.log(`⚠️  Error in poll #${pollCount}: ${errorMessage} (${pollTime}ms)`);
          
          return {
            confirmed: false,
            error: errorMessage,
            pollTime,
            pollCount
          };
        }
      });

      if (pollResult.confirmed) {
        return pollResult;
      }

      // Wait before next poll (race condition safe)
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Transaction confirmation timeout after ${maxWaitTime / 1000}s (${pollCount} polls)`);
  }

  /**
   * Capture complete account tracking post-deployment
   */
  private static async captureCompleteAccountTracking(
    deployerKey: PrivateKey,
    senderKey: PrivateKey,
    contractAddress: string,
    preSnapshot: any,
    step: DeploymentStep
  ): Promise<AccountTrackingResult> {
    console.log(`📊 Capturing complete account tracking...`);

    const postSnapshot = await this.captureAccountSnapshot(deployerKey, senderKey, "post-deployment", step);

    const contractTracking = await this.addMicroStepAsync(step, 'TRACK_CONTRACT_STATE', async () => {
      try {
        const accountResult = await fetchAccount({ publicKey: PublicKey.fromBase58(contractAddress) });
        
        if (accountResult.account && accountResult.account.zkapp) {
          const balance = Number(accountResult.account.balance.toString()) / 10**9;
          const nonce = Number(accountResult.account.nonce.toString());
          const appState = accountResult.account.zkapp.appState.map(f => f.toString());
          const verificationKeyHash = accountResult.account.zkapp.verificationKey?.hash?.toString() || '';
          
          return {
            address: contractAddress,
            exists: true,
            balance,
            nonce,
            zkAppState: appState,
            verificationKeyHash
          };
        } else {
          return {
            address: contractAddress,
            exists: false,
            balance: 0,
            nonce: 0,
            zkAppState: [],
            verificationKeyHash: ''
          };
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`⚠️  Error tracking contract state: ${errorMessage}`);
        return {
          address: contractAddress,
          exists: false,
          balance: 0,
          nonce: 0,
          zkAppState: [],
          verificationKeyHash: '',
          error: errorMessage
        };
      }
    });

    // Calculate changes
    const deployerChange = postSnapshot.deployer.balance - preSnapshot.deployer.balance;
    const senderChange = postSnapshot.sender.balance - preSnapshot.sender.balance;
    const deployerNonceChange = postSnapshot.deployer.nonce - preSnapshot.deployer.nonce;
    const senderNonceChange = postSnapshot.sender.nonce - preSnapshot.sender.nonce;
    const feePaid = Math.abs(senderChange) - (contractTracking.balance || 0); // Approximate fee calculation

    console.log(`📈 Account changes:`);
    console.log(`   Deployer balance change: ${deployerChange >= 0 ? '+' : ''}${deployerChange} MINA (nonce +${deployerNonceChange})`);
    console.log(`   Sender balance change: ${senderChange >= 0 ? '+' : ''}${senderChange} MINA (nonce +${senderNonceChange})`);
    console.log(`   Estimated fee paid: ${feePaid} MINA`);
    console.log(`   Contract balance: ${contractTracking.balance} MINA`);

    return {
      deployer: {
        address: postSnapshot.deployer.address,
        initialBalance: preSnapshot.deployer.balance,
        finalBalance: postSnapshot.deployer.balance,
        balanceChange: deployerChange,
        initialNonce: preSnapshot.deployer.nonce,
        finalNonce: postSnapshot.deployer.nonce,
        nonceChange: deployerNonceChange
      },
      sender: {
        address: postSnapshot.sender.address,
        initialBalance: preSnapshot.sender.balance,
        finalBalance: postSnapshot.sender.balance,
        balanceChange: senderChange,
        initialNonce: preSnapshot.sender.nonce,
        finalNonce: postSnapshot.sender.nonce,
        nonceChange: senderNonceChange,
        feePaid
      },
      contract: {
        address: contractTracking.address,
        exists: contractTracking.exists,
        balance: contractTracking.balance,
        nonce: contractTracking.nonce,
        zkAppState: contractTracking.zkAppState,
        verificationKeyHash: contractTracking.verificationKeyHash
      }
    };
  }

  /**
   * Update deployment record with comprehensive tracking
   */
  private static async updateDeploymentRecord(aliasName: string, result: any, verificationKey: any, step: DeploymentStep): Promise<void> {
    console.log(`📝 Updating deployment record...`);

    this.addMicroStep(step, 'UPDATE_CONFIG_FILE', () => {
      // Determine environment and config path
      let environment: string;
      if (aliasName.startsWith('local-')) environment = 'local';
      else if (aliasName.startsWith('testnet-')) environment = 'testnet';
      else if (aliasName.startsWith('mainnet-')) environment = 'mainnet';
      else throw new Error(`Cannot determine environment from alias: ${aliasName}`);

      const configPath = path.join(__dirname, `../../config/environments/${environment}.json`);
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // Ensure deployment structure exists
      if (!config.deployments) config.deployments = {};
      if (!config.deployments.contracts) config.deployments.contracts = {};

      const alias = config.deployAliases[aliasName];
      
      // Create comprehensive deployment record
      const deploymentRecord = {
        address: result.contractAddress,
        status: 'DEPLOYED',
        deployedAt: new Date().toISOString(),
        transactionHash: result.transactionHash,
        alias: aliasName,
        oracle: alias.oracle,
        zkAppPrivateKey: result.zkAppPrivateKey || 'NOT_SAVED',
        verificationKey: {
          data: verificationKey.data,
          hash: verificationKey.hash
        },
        deploymentMetrics: {
          proofTime: result.proofTime,
          broadcastTime: result.broadcastTime,
          totalDeploymentTime: Date.now() - (this.steps[0]?.startTime || Date.now())
        }
      };

      config.deployments.contracts[alias.contractName] = deploymentRecord;

      // Write back to config file
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      return { configPath, updated: true, deploymentRecord };
    });

    console.log(`✅ Deployment record updated`);
  }

  /**
   * Execute deployment step with comprehensive monitoring
   */
  private static async executeStep<T>(stepName: string, stepFunction: (step: DeploymentStep) => Promise<T>): Promise<T> {
    const step: DeploymentStep = {
      name: stepName,
      status: 'RUNNING',
      startTime: Date.now(),
      microsteps: []
    };

    this.steps.push(step);
    console.log(`\n🔄 Step ${this.steps.length}: ${stepName}`);

    try {
      const result = await stepFunction(step);
      
      step.status = 'COMPLETED';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      
      console.log(`✅ Step ${this.steps.length}: ${stepName} completed in ${step.duration}ms (${step.microsteps?.length || 0} microsteps)`);
      return result;

    } catch (error) {
      step.status = 'FAILED';
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      step.error = errorMessage;
      
      console.log(`❌ Step ${this.steps.length}: ${stepName} failed after ${step.duration}ms`);
      console.log(`   Error: ${errorMessage}`);
      console.log(`   Completed ${step.microsteps?.length || 0} microsteps before failure`);
      throw error;
    }
  }

  /**
   * Add synchronous microstep with tracking
   */
  private static addMicroStep<T>(step: DeploymentStep, microStepName: string, microStepFunction: () => T): T {
    const microStep: MicroStep = {
      name: microStepName,
      timestamp: Date.now(),
      status: 'RUNNING'
    };

    step.microsteps = step.microsteps || [];
    step.microsteps.push(microStep);

    try {
      const result = microStepFunction();
      
      microStep.status = 'COMPLETED';
      microStep.duration = Date.now() - microStep.timestamp;
      microStep.details = result;
      
      console.log(`   ✓ ${microStepName} (${microStep.duration}ms)`);
      return result;

    } catch (error) {
      microStep.status = 'FAILED';
      microStep.duration = Date.now() - microStep.timestamp;
      const errorMessage = error instanceof Error ? error.message : String(error);
      microStep.error = errorMessage;
      
      console.log(`   ✗ ${microStepName} failed (${microStep.duration}ms): ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Add asynchronous microstep with tracking
   */
  private static async addMicroStepAsync<T>(step: DeploymentStep, microStepName: string, microStepFunction: () => Promise<T>): Promise<T> {
    const microStep: MicroStep = {
      name: microStepName,
      timestamp: Date.now(),
      status: 'RUNNING'
    };

    step.microsteps = step.microsteps || [];
    step.microsteps.push(microStep);

    try {
      const result = await microStepFunction();
      
      microStep.status = 'COMPLETED';
      microStep.duration = Date.now() - microStep.timestamp;
      microStep.details = result;
      
      console.log(`   ✓ ${microStepName} (${microStep.duration}ms)`);
      return result;

    } catch (error) {
      microStep.status = 'FAILED';
      microStep.duration = Date.now() - microStep.timestamp;
      const errorMessage = error instanceof Error ? error.message : String(error);
      microStep.error = errorMessage;
      
      console.log(`   ✗ ${microStepName} failed (${microStep.duration}ms): ${errorMessage}`);
      throw error;
    }
  }
}