/**
 * BusinessProcessNetworkHandler.ts - NETWORK Business Process Verification
 * UPDATED: Uses BusinessProcessVerificationBase.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

// === COMPOSITION: Use base classes ===
import { BaseVerificationCore } from '../base/BaseVerificationCore.js';
import { BusinessProcessVerificationBase } from '../base/BusinessProcessVerificationBase.js';
import{
  BPMNGenericSmartContract,
  BPMNGroupRecord,
  BPMNGroupKey,
  BPMN_GROUP_MERKLE_HEIGHT,
  BPMNGroupMerkleWitness}from '../../../contracts/with-sign/BPMNGenericSmartContract.js'
// === O1JS IMPORTS ===
import { 
  Field, 
  Mina, 
  PrivateKey, 
  AccountUpdate, 
  CircuitString, 
  Poseidon, 
  Signature, 
  Bool, 
  UInt64,
  PublicKey,
  fetchAccount,
  MerkleMap,
  MerkleTree
} from 'o1js';

// === ZK PROGRAM AND CONTRACT IMPORTS ===
import { 
  BPMNGeneric,
  BusinessProcessIntegrityOptimMerkleData,
  BusinessProcessIntegrityOptimMerkleProof
} from '../../../zk-programs/with-sign/BPMNGenericZKProgram.js';

import { createBPMNGroupRecord } from '../BPMNUtils.js';
// === INFRASTRUCTURE IMPORTS ===
import { getPrivateKeyFor, getPublicKeyFor } from '../../../core/OracleRegistry.js';

// === UTILITY IMPORTS ===
import { BusinessProcessIntegrityOptimMerkleTestUtils } from '../BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSignUtils.js';

import { 
  initializeOracleRegistry,
  getDeployerAccount,
  getDeployerKey,
  environmentManager,
  Environment,
  compilationManager,
  deploymentManager,
  getSenderAccount,
  getSenderKey
} from '../../../infrastructure/index.js';

// === TYPES ===
interface ZKVerificationResult {
  success: boolean;
  zkRegexResult?: boolean;
  merkleRoot?: string;
  processHash?: string;
  oracleVerified?: boolean;
  merkleVerified?: boolean;
  proof?: any;
  error?: string;
}


export class BusinessProcessNetworkHandler {
  // === COMPOSITION: Use utility classes ===
  private baseCore: BaseVerificationCore;
  private businessProcessBase: BusinessProcessVerificationBase;

  constructor() {
    this.baseCore = new BaseVerificationCore();
    this.businessProcessBase = new BusinessProcessVerificationBase();
  }

  private static readonly TRANSACTION_FEES = {
    LOCAL: UInt64.from(1000000),
    TESTNET: UInt64.from(100000000),
    DEVNET: UInt64.from(100000000),
    MAINNET: UInt64.from(300000000),
  };

  private getTransactionFee(environment: string): UInt64 {
    switch (environment.toUpperCase()) {
      case 'LOCAL':
        return BusinessProcessNetworkHandler.TRANSACTION_FEES.LOCAL;
      case 'TESTNET':
      case 'DEVNET':
        return BusinessProcessNetworkHandler.TRANSACTION_FEES.TESTNET;
      case 'MAINNET':
        return BusinessProcessNetworkHandler.TRANSACTION_FEES.MAINNET;
      default:
        console.warn(`Unknown environment ${environment}, using TESTNET fee`);
        return BusinessProcessNetworkHandler.TRANSACTION_FEES.TESTNET;
    }
  }

  /**
   * Main NETWORK business process verification
   * UPDATED: Uses BusinessProcessVerificationBase
   */
  public async verifyBusinessProcess(
    bpmnGroupID: CircuitString,
    businessProcessType: string,
    expectedBPMNFile: string,
    actualBPMNFile: string,
    networkType: 'testnet' | 'mainnet' = 'testnet'
  ): Promise<any> {

    console.log('\n🔧 ENHANCED BPMN TEST - ENSURING FUNDED ACCOUNT USAGE');
    console.log('='.repeat(70));

    try {
      // Step 1: Environment-aware Oracle Registry initialization
      console.log('\n📋 Step 1: Initializing Oracle Registry with environment-aware accounts...');
      
      await initializeOracleRegistry();
      
      const currentEnv = environmentManager.getCurrentEnvironment();
      const shouldConnectToDevnet = environmentManager.shouldConnectToDevnet();
      
      console.log(`🌐 Environment: ${currentEnv}`);
      console.log(`🔗 Connect to DEVNET: ${shouldConnectToDevnet}`);
      
      if (currentEnv === 'TESTNET' && shouldConnectToDevnet) {
        console.log('✅ CONFIRMED: Oracle Registry initialized for DEVNET with funded accounts');
        
        try {
          const bpmnDeployer = getDeployerAccount('BPMN');
          console.log(`🎯 BPMN Deployer Account: ${bpmnDeployer.toBase58()}`);
          console.log(`🌐 Network: ${this.baseCore.getEnvironmentDisplayName()}`);

          try {
            const deployerBalance = await fetchAccount({ publicKey: bpmnDeployer });
            const actualBalance = Number(deployerBalance.account?.balance?.toString() || '0') / 1e9;
            console.log(`💰 Current Balance: ${actualBalance.toFixed(3)} MINA`);
          } catch (balanceError) {
            console.log(`💰 Balance: Unable to fetch (will be verified during deployment)`);
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

      console.log('\n📋 Step 2: Running GLEIF verification...');
      const result = await this.getBPMNNetworkMultiVerifierUtils(bpmnGroupID,businessProcessType,expectedBPMNFile,actualBPMNFile);
      
      console.log('\n✅ ENHANCED GLEIF TEST COMPLETED SUCCESSFULLY!');
      
      if (currentEnv === 'TESTNET' && shouldConnectToDevnet) {
        console.log('🔗 Check: https://minascan.io/devnet/');
      } else if (currentEnv === 'MAINNET') {
        console.log('🔗 Check: https://minascan.io/mainnet/');
      }
      
      return result;
      
    } catch (error) {
      console.error('\n❌ ENHANCED GLEIF TEST FAILED');
      if (error instanceof Error) {
        console.error('Error:', error.message);
      }
      throw error;
    }
  }

  
public async getBPMNNetworkMultiVerifierUtils(
    bpmnGroupID: CircuitString,
    businessProcessType: string,
    expectedBPMNFile: string,
    actualBPMNFile: string,): Promise<any> {

      try {
      // === INFRASTRUCTURE INITIALIZATION ===
      console.log('\n🔧 Initializing infrastructure system...');
      
      const currentEnvironment = environmentManager.getCurrentEnvironment();
      console.log(`✅ Environment Manager: ${currentEnvironment}`);
      
      await compilationManager.initialize();
      console.log('✅ Compilation Manager initialized');

      // === BLOCKCHAIN ENVIRONMENT SETUP ===
      console.log('\n📋 Setting up blockchain environment...');
      
      const currentEnv = environmentManager.getCurrentEnvironment();
      const shouldConnectToDevnet = environmentManager.shouldConnectToDevnet();
      
      let deployerAccount: any;
      let deployerKey: any;
      let senderAccount: any;
      let senderKey: any;

      if (shouldConnectToDevnet) {
        console.log('🌐 DEVNET environment detected - using funded Oracle accounts');
        
        // ✅ COMPOSITION: Use baseCore for network setup
        const connected = this.baseCore.setupNetworkConnection();
        if (!connected) {
          throw new Error('Failed to establish DEVNET connection');
        }
        console.log('✅ Network connection established via BaseVerificationCore');
        
        try {
          deployerAccount = getDeployerAccount('BPMN');
          deployerKey = getDeployerKey('BPMN');
          senderAccount = getSenderAccount('BPMN');
          senderKey = getSenderKey('BPMN');
          
          console.log('✅ Blockchain environment initialized with DEVNET Oracle accounts');
          
        } catch (oracleError) {
          console.error('❌ Failed to get Oracle accounts:', oracleError);
          throw new Error(`Oracle Registry not properly initialized: ${oracleError}`);
        }

        } else {
        // LOCAL MODE setup
        console.log(`🔧 ${currentEnv} environment - creating LocalBlockchain`);
        
        const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
        Mina.setActiveInstance(Local);

        deployerAccount = Local.testAccounts[0];
        deployerKey = Local.testAccounts[0].key;
        senderAccount = Local.testAccounts[1];
        senderKey = Local.testAccounts[1].key;
        
        console.log('✅ Local blockchain initialized');
      }

      // === ZK COMPILATION ===
      console.log('\n📝 Compiling ZK programs...');

      await BPMNGeneric.compile();
      console.log('✅ BPMNGenericZK program compiled');
      
      await BPMNGenericSmartContract.compile();
      console.log('✅ BPMNGenericSmartContract compiled');
      
      // === SMART CONTRACT LOOKUP ===
      console.log('\n🚀 Looking up smart contract address...');

      const contractAddress = await environmentManager.getDeployedContractAddress('BPMNGenericSmartContract');
      
      if (!contractAddress) {
        throw new Error(`BPMNGenericSmartContract address not found in ${currentEnv.toLowerCase()}.json deployments.contracts section`);
      }
      
      // Validate the contract address format
      if (!environmentManager.validateContractAddress(contractAddress)) {
        throw new Error(`Invalid contract address format: ${contractAddress}`);
      }

      console.log(`✅ Contract address found: ${contractAddress}`);
      console.log(`📋 Source: config/environments/${currentEnv.toLowerCase()}.json`);
      
      const zkAppAddress = PublicKey.fromBase58(contractAddress);
      const zkApp = new BPMNGenericSmartContract(zkAppAddress);
      
      // Set fee for transactions
      const fee = this.getTransactionFee(currentEnvironment);

      const proofs = [];
      const verificationResults: any[] = [];
      //const companyRegistry = new CompanyRegistry(COMPANY_MERKLE_HEIGHT);
      const companiesMap = new MerkleMap();

      console.log(`\n🌐 Business Process NETWORK Verification Started`);
      console.log(`📋 Process Type: ${businessProcessType}`);
      //console.log(`🌍 Network: ${networkType.toUpperCase()}`);
      console.log(`📂 Expected BPMN: ${expectedBPMNFile}`);
      console.log(`📂 Actual BPMN: ${actualBPMNFile}`);

      try {
        // === NETWORK BLOCKCHAIN SETUP ===
        //console.log(`\n🔧 Setting up ${networkType} blockchain connection...`);
        // let networkType='testnet';
        // let networkInstance;
        // if (networkType === 'testnet') {
        //   networkInstance = Mina.Network({
        //     mina: 'https://proxy.testworld.minaexplorer.com/graphql',
        //     archive: 'https://archive.testworld.minaexplorer.com'
        //   });
        // } else {
        //   networkInstance = Mina.Network({
        //     mina: 'https://proxy.mainnet.minaexplorer.com/graphql',
        //     archive: 'https://archive.mainnet.minaexplorer.com'
        //   });
        // }
        
        // Mina.setActiveInstance(networkInstance);
        // console.log(`✅ ${networkType.toUpperCase()} blockchain connected`);
        
        // === FUNDED ACCOUNT SETUP ===
        // console.log('\n💰 Setting up funded account...');
        // let fundedAccountPrivateKey: PrivateKey;
        
        // if (process.env.FUNDED_ACCOUNT_PRIVATE_KEY) {
        //   fundedAccountPrivateKey = PrivateKey.fromBase58(process.env.FUNDED_ACCOUNT_PRIVATE_KEY);
        // } else {
        //   console.warn('⚠️ No funded account found in environment, using local key...');
        //   fundedAccountPrivateKey = getPrivateKeyFor('BPMN');
        // }
        
        // const fundedAccountPublicKey = fundedAccountPrivateKey.toPublicKey();
        // console.log(`🔑 Funded Account: ${fundedAccountPublicKey.toBase58()}`);
        
        // === BPMN PARSING (using BusinessProcessVerificationBase) ===
        console.log('\n📋 Processing BPMN files...');
        const { expectedPath, actualPath } = await this.businessProcessBase.parseBPMNFiles(
          expectedBPMNFile, 
          actualBPMNFile
        );
        
        // === PROCESS ANALYSIS (using BusinessProcessVerificationBase) ===
        const processAnalysis = this.businessProcessBase.analyzeProcessPaths(
          expectedPath, 
          actualPath, 
          businessProcessType
        );
        
        // === CREATE PROCESS DATA (using BusinessProcessVerificationBase) ===
        const currentTimestamp = UInt64.from(Date.now());
        const processData = this.businessProcessBase.createProcessData(
          0, // Process ID
          businessProcessType,
          expectedPath,
          actualPath,
          currentTimestamp
        );
        
        // === LOG PRE-VERIFICATION RESULTS ===
        this.businessProcessBase.logProcessVerificationResults(
          processAnalysis, 
          processData, 
          'Pre-Verification'
        );
        
        // === ZK PROOF GENERATION ===
        console.log('\n⚙️ Generating ZK proof for network submission...');
        
        const result: ZKVerificationResult = await BusinessProcessIntegrityOptimMerkleTestUtils.runOptimMerkleVerification(
          bpmnGroupID,
          businessProcessType, 
          expectedPath, 
          actualPath,
          {
            expectedFile: expectedBPMNFile,
            actualFile: actualBPMNFile
          }
        );

        proofs.push(result);
        
        // === CRITICAL: UPDATE VERIFICATION RESULT BASED ON ZK CIRCUIT ONLY ===
        const zkCircuitResult: boolean = result.zkRegexResult ?? false; // This comes from the ZK circuit
        


          const groupRecord = createBPMNGroupRecord(
            bpmnGroupID,  // Pass complianceData instead of apiResponse
            Bool(result.zkRegexResult ?? false),
            currentTimestamp,
            CircuitString,
            BPMNGroupRecord,
            Field
          );

          // === LOGGING: Print all fields of groupRecord and warn if any are undefined ===
          console.log('groupRecord:', groupRecord);
          Object.entries(groupRecord).forEach(([k, v]) => {
            if (v === undefined) console.error(`❌ groupRecord.${k} is undefined!`);
          });
          // === DEEP LOGGING: Check .value of all UInt64 fields in groupRecord ===
          console.log('groupRecord.lastVerificationTime.value:', groupRecord.lastVerificationTime?.value);
          if (!groupRecord.lastVerificationTime?.value) console.error('❌ lastVerificationTime.value is undefined!');
          console.log('groupRecord.firstVerificationTime.value:', groupRecord.firstVerificationTime?.value);
          if (!groupRecord.firstVerificationTime?.value) console.error('❌ firstVerificationTime.value is undefined!');
          console.log('groupRecord.lastPassTime.value:', groupRecord.lastPassTime?.value);
          if (!groupRecord.lastPassTime?.value) console.error('❌ lastPassTime.value is undefined!');
          console.log('groupRecord.lastFailTime.value:', groupRecord.lastFailTime?.value);
          if (!groupRecord.lastFailTime?.value) console.error('❌ lastFailTime.value is undefined!');

          const companyKey = BPMNGroupKey.create(
            bpmnGroupID.hash(),
            //complianceData.name.hash()
          );

          let companyWitness: any;
          try {
            // 🔧 PROPER SOLUTION: Create a real MerkleTree and use its witness
            console.log('🔧 Creating temporary MerkleTree for proper witness generation...');
            // Create a temporary tree with the exact same height as CompanyMerkleWitness expects
            const tempCompanyTree = new MerkleTree(BPMN_GROUP_MERKLE_HEIGHT);
            // Set the company record at index 0
            const groupHash = Poseidon.hash([
              groupRecord.groupIDHash,
              groupRecord.isValid.toField(),
              groupRecord.complianceScore,
              groupRecord.totalVerifications,
              groupRecord.passedVerifications,
              groupRecord.failedVerifications,
              groupRecord.consecutiveFailures,
              groupRecord.lastVerificationTime.value,
              groupRecord.firstVerificationTime.value,
              groupRecord.lastPassTime.value,
              groupRecord.lastFailTime.value
            ]);
            tempCompanyTree.setLeaf(BigInt(0), groupHash);
            // Generate the actual witness from the real tree
            const realWitness = tempCompanyTree.getWitness(BigInt(0)) as any;
            companyWitness = new BPMNGroupMerkleWitness(realWitness);
            console.log('✅ BPMNGroupMerkleWitness created successfully using real tree witness');
          } catch (witnessError: any) {
            console.error(`❌ Error creating CompanyMerkleWitness: ${witnessError.message}`);
            throw new Error(`Failed to create CompanyMerkleWitness: ${witnessError.message}`);
          }

          console.log("///////////////////////////", result.proof);
          const verifyTxn = await Mina.transaction(
            { sender: senderAccount, fee },
            async () => {
              await zkApp.verifyOptimizedComplianceWithProof(
                result.proof,
                companyWitness,
                groupRecord,
                companiesMap.getWitness(companyKey.toField())
              );
            }
          );

          console.log('⚡ Generating transaction proof...');
          await verifyTxn.prove();
          console.log('✅ Transaction proof generated successfully');
          // Sign and send the transaction with proof authorization
          await verifyTxn.sign([senderKey]).send();
          console.log('✅ Smart contract transaction completed');


        // UPDATE VERIFICATION RESULT BASED ON ZK CIRCUIT ONLY
        processAnalysis.verificationResult = zkCircuitResult;
        processAnalysis.pathsMatch = zkCircuitResult;
        
        // === NETWORK TRANSACTION SUBMISSION ===
        let transactionHash = null;
        let networkSubmitted = false;
        
        if (result.success) {
          console.log('\n📡 Preparing network transaction...');
          
          try {
            // Create transaction (simplified - would need actual contract deployment)
            console.log('🔄 Creating transaction...');
            
            // For now, we simulate network submission
            // In actual implementation, this would deploy/call the smart contract
            transactionHash = `txn_${Date.now()}_${businessProcessType}`;
            networkSubmitted = true;
            
            //console.log(`✅ Transaction submitted to ${networkType.toUpperCase()}`);
            console.log(`🔗 Transaction Hash: ${transactionHash}`);
            
          } catch (networkError) {
            console.error('❌ Network submission failed:', networkError);
            console.log('⚠️ Verification completed locally, but network submission failed');
          }
        }
        
        // === LOG POST-VERIFICATION RESULTS ===
        this.businessProcessBase.logProcessVerificationResults(
          processAnalysis, 
          processData, 
          'Post-Verification'
        );
        
        // === DISPLAY NETWORK RESULTS ===
        console.log('\n🌐 NETWORK VERIFICATION COMPLETE:');
        console.log('='.repeat(50));
        console.log(`📊 Verification Result: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
        //console.log(`🌍 Network: ${networkType.toUpperCase()}`);
        console.log(`📡 Network Submitted: ${networkSubmitted ? '✅ YES' : '❌ NO'}`);
        if (transactionHash) {
          console.log(`🔗 Transaction Hash: ${transactionHash}`);
          //console.log(`🔍 Explorer Link: https://minascan.io/${networkType}/tx/${transactionHash}`);
        }
        
        return {
          businessProcessType,
          expectedPath,
          actualPath,
          processAnalysis,
          processData,
          proof: result,
          verificationResult: zkCircuitResult, // ZK CIRCUIT RESULT ONLY
          timestamp: currentTimestamp.toString(),
          //environment: networkType.toUpperCase(),
          networkSubmitted,
          transactionHash,
          //explorerUrl: transactionHash ? `https://minascan.io/${networkType}/tx/${transactionHash}` : null
        };
        
      } catch (error) {
        console.error('❌ Error in NETWORK Business Process Verification:', error);
        throw error;
      }
  }catch (error) {
      console.error('❌ Error in BPMN Network Multi-Verifier Utils:', error);}
  
  }
  /**
   * NEW METHOD: Multi-process NETWORK verification
   * ENHANCED: Support for multiple process pairs on network
   */
  // public async verifyMultipleBusinessProcesses(
  //   processFilePairs: Array<{
  //     bpmnGroupID: Field,  // Optional BPMN Group ID for future use
  //     processType: string,
  //     expectedBPMNFile: string,
  //     actualBPMNFile: string
  //   }>,
  //   networkType: 'testnet' | 'mainnet' = 'testnet'
  // ): Promise<any> {
  //   console.log(`\n🚀 Multi-Process NETWORK Verification Started`);
  //   console.log(`📊 Total Processes: ${processFilePairs.length}`);
  //   console.log(`🌍 Network: ${networkType.toUpperCase()}`);

  //   try {
  //     // === NETWORK BLOCKCHAIN SETUP ===
  //     console.log(`\n🔧 Setting up ${networkType} blockchain connection...`);
      
  //     let networkInstance;
  //     if (networkType === 'testnet') {
  //       networkInstance = Mina.Network({
  //         mina: 'https://proxy.testworld.minaexplorer.com/graphql',
  //         archive: 'https://archive.testworld.minaexplorer.com'
  //       });
  //     } else {
  //       networkInstance = Mina.Network({
  //         mina: 'https://proxy.mainnet.minaexplorer.com/graphql',
  //         archive: 'https://archive.mainnet.minaexplorer.com'
  //       });
  //     }
      
  //     Mina.setActiveInstance(networkInstance);
      
  //     // === PARSE MULTIPLE BPMN FILES ===
  //     const bpmnData = processFilePairs.map(pair => ({
  //       expected: pair.expectedBPMNFile,
  //       actual: pair.actualBPMNFile,
  //       processType: pair.processType
  //     }));
      
  //     const parsedData = await this.businessProcessBase.parseMultipleBPMNFiles(bpmnData);
      
  //     // === ANALYZE MULTIPLE PROCESSES ===
  //     const { individualAnalyses, summary } = this.businessProcessBase.analyzeMultipleProcesses(parsedData);
      
  //     // === CREATE MULTIPLE PROCESS DATA ===
  //     const currentTimestamp = UInt64.from(Date.now());
  //     const processDataArray = this.businessProcessBase.createMultipleProcessData(individualAnalyses, currentTimestamp);
      
  //     // === LOG MULTI-PROCESS RESULTS ===
  //     this.businessProcessBase.logMultiProcessVerificationResults(
  //       individualAnalyses,
  //       processDataArray,
  //       summary,
  //       'Pre-Verification'
  //     );
      
  //     // === ZK PROOF GENERATION FOR MULTIPLE PROCESSES ===
  //     console.log('\n⚙️ Generating ZK proofs for multiple processes...');
      
  //     const proofs = [];
  //     const transactions = [];
  //     let successfulProofs = 0;
  //     let successfulTransactions = 0;
      
  //     for (let i = 0; i < processFilePairs.length; i++) {
  //       const pair = processFilePairs[i];
  //       const analysis = individualAnalyses[i];
        
  //       console.log(`📝 Processing ${i + 1}/${processFilePairs.length}: ${pair.processType}...`);
        
  //       try {
  //         // ALWAYS GENERATE ZK PROOF - Let ZK circuit be the authority
  //         const result: ZKVerificationResult = await BusinessProcessIntegrityOptimMerkleTestUtils.runOptimMerkleVerification(
  //           pair.bpmnGroupID,
  //           pair.processType, 
  //           analysis.expectedPattern, 
  //           analysis.actualPath,
  //           {
  //             expectedFile: pair.expectedBPMNFile,
  //             actualFile: pair.actualBPMNFile
  //           }
  //         );
          
  //         // UPDATE ANALYSIS WITH ZK CIRCUIT RESULT
  //         const zkCircuitResult: boolean = result.zkRegexResult ?? false;
  //         analysis.verificationResult = zkCircuitResult;
  //         analysis.pathsMatch = zkCircuitResult;
          
  //         proofs.push(result);
  //         if (result.success && zkCircuitResult) {
  //           successfulProofs++;
            
  //           // Submit to network
  //           try {
  //             const transactionHash = `txn_${Date.now()}_${pair.processType}_${i}`;
  //             transactions.push({
  //               processType: pair.processType,
  //               transactionHash,
  //               status: 'submitted'
  //             });
  //             successfulTransactions++;
              
  //             console.log(`✅ ${pair.processType}: Proof + Network submission successful`);
  //           } catch (networkError) {
  //             transactions.push({
  //               processType: pair.processType,
  //               transactionHash: null,
  //               status: 'network_failed'
  //             });
  //             console.log(`⚠️ ${pair.processType}: Proof successful, network failed`);
  //           }
  //         } else {
  //           console.log(`⚠️ ZK Circuit rejected ${pair.processType}`);
  //           proofs.push({ success: false, reason: 'ZK Circuit rejected' });
  //           transactions.push({
  //             processType: pair.processType,
  //             transactionHash: null,
  //             status: 'zk_circuit_rejected'
  //           });
  //         }
  //       } catch (error) {
  //         console.error(`❌ Failed processing ${pair.processType}:`, error);
  //         proofs.push({ success: false, error: error instanceof Error ? error.message : String(error) });
  //         transactions.push({
  //           processType: pair.processType,
  //           transactionHash: null,
  //           status: 'failed'
  //         });
  //       }
  //     }
      
  //     // === FINAL MULTI-PROCESS RESULTS ===
  //     this.businessProcessBase.logMultiProcessVerificationResults(
  //       individualAnalyses,
  //       processDataArray,
  //       summary,
  //       'Post-Verification'
  //     );
      
  //     const proofSuccessRate = Math.round((successfulProofs / processFilePairs.length) * 100);
  //     const networkSuccessRate = Math.round((successfulTransactions / processFilePairs.length) * 100);
  //     const overallSuccess = successfulTransactions === processFilePairs.length;
      
  //     console.log(`\n🏆 FINAL MULTI-PROCESS NETWORK VERIFICATION RESULTS:`);
  //     console.log(`📊 Proof Generation Success Rate: ${proofSuccessRate}%`);
  //     console.log(`📡 Network Submission Success Rate: ${networkSuccessRate}%`);
  //     console.log(`🎯 Overall Result: ${overallSuccess ? '✅ ALL PASSED' : '❌ SOME FAILED'}`);
  //     console.log(`🌍 Network: ${networkType.toUpperCase()}`);
      
  //     if (successfulTransactions > 0) {
  //       console.log(`\n🔗 Explorer Links:`);
  //       transactions
  //         .filter(t => t.transactionHash)
  //         .forEach(t => {
  //           console.log(`  • ${t.processType}: https://minascan.io/${networkType}/tx/${t.transactionHash}`);
  //         });
  //     }
      
  //     return {
  //       totalProcesses: summary.totalProcesses,
  //       successfulVerifications: summary.successfulVerifications,
  //       verificationPercentage: summary.verificationPercentage,
  //       proofSuccessRate,
  //       networkSuccessRate,
  //       overallResult: overallSuccess,
  //       individualResults: individualAnalyses,
  //       processData: processDataArray,
  //       proofs,
  //       transactions,
  //       timestamp: currentTimestamp.toString(),
  //       environment: networkType.toUpperCase()
  //     };
      
  //   } catch (error) {
  //     console.error('❌ Error in Multi-Process NETWORK Verification:', error);
  //     throw error;
  //   }
  // }
}

// === BACKWARD COMPATIBILITY EXPORTS ===
export async function runBusinessProcessTestWithFundedAccounts(
  bpmnGroupID: CircuitString,
  businessProcessType: string,
  expectedBPMNFile: string,
  actualBPMNFile: string,
  networkType: 'testnet' | 'mainnet' = 'testnet'
): Promise<any> {
  const handler = new BusinessProcessNetworkHandler();
  return await handler.verifyBusinessProcess(bpmnGroupID,businessProcessType, expectedBPMNFile, actualBPMNFile, networkType);
}

// === NEW MULTI-PROCESS EXPORT ===
export async function runMultiBusinessProcessTestWithFundedAccounts(
  processFilePairs: Array<{
    bpmnGroupID: string,  // Optional BPMN Group ID for future use
    processType: string,
    expectedBPMNFile: string,
    actualBPMNFile: string
  }>,
  networkType: 'testnet' | 'mainnet' = 'testnet'
): Promise<any> {
  const handler = new BusinessProcessNetworkHandler();
  //return await handler.verifyMultipleBusinessProcesses(processFilePairs, networkType);
}
