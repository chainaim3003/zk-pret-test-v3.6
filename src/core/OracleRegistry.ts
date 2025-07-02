import { Mina, PrivateKey, PublicKey, Field, Poseidon } from 'o1js';
import { OracleContexts, OracleRole } from '../config/oracle-types.js';
import { ConfigurableOracleManager } from '../config/oracle-manager.js';
import { environmentManager } from '../infrastructure/environment/manager.js';
import * as fs from 'fs';
import * as path from 'path';

// ===== CONDITIONAL BLOCKCHAIN SETUP =====
// 🔧 FIX: Only create LocalBlockchain for LOCAL environment
// For TESTNET/MAINNET, let NetworkOracleRegistry handle the connection
const detectedEnvironment = process.env.BUILD_ENV || process.env.NODE_ENV || 'LOCAL';
console.log(`🌍 Detected environment: ${detectedEnvironment}`);

let Local: any;
if (detectedEnvironment === 'LOCAL') {
  // ✅ LOCAL environment: Use LocalBlockchain
  console.log('🔧 Setting up LocalBlockchain for LOCAL environment');
  const useProof = false;
  Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
  Mina.setActiveInstance(Local);
  console.log('✅ LocalBlockchain initialized for LOCAL environment');
} else {
  // ✅ TESTNET/MAINNET: Don't override - let NetworkOracleRegistry handle it
  console.log(`🌐 ${detectedEnvironment} environment detected - NetworkOracleRegistry will handle blockchain connection`);
  console.log('⚠️ Do not use Local blockchain variable for non-LOCAL environments');
  Local = null;
}

export { Local };

// Initialize the new Oracle Manager with environment detection
let isOracleManagerInitialized = false;
let initializationError: Error | null = null;

// Create Oracle Manager with detected environment
const environmentalOracleManager = new ConfigurableOracleManager(detectedEnvironment);

// For TESTNET/MAINNET environments, we need to preload the configuration synchronously
if (detectedEnvironment !== 'LOCAL') {
  // Try to load config synchronously from the JSON file
  try {
    console.log(`🔄 Loading environment config for ${detectedEnvironment}...`);
    const configPath = path.join('./config/environments', `${detectedEnvironment.toLowerCase()}.json`);
    const configData = fs.readFileSync(configPath, 'utf8');
    const envConfig = JSON.parse(configData);
    environmentalOracleManager.setEnvironmentConfig(envConfig);
    console.log(`✅ Oracle Manager: Environment config loaded for ${detectedEnvironment}`);
  } catch (error) {
    console.error(`❌ Failed to load environment config for ${detectedEnvironment}:`, error);
    initializationError = error as Error;
  }
}

// Initialization function that will be called when needed
function ensureOracleManagerInitialized(): void {
  if (!isOracleManagerInitialized) {
    // Check if there was a config loading error
    if (initializationError) {
      console.error(`❌ Oracle Manager initialization failed due to config loading error:`, initializationError);
      throw initializationError;
    }
    
    try {
      const result = environmentalOracleManager.initializeSync();
      if (result) {
        // ✅ For LOCAL environment, provide the Local blockchain instance
        if (detectedEnvironment === 'LOCAL') {
          environmentalOracleManager.setLocalBlockchain(Local);
          console.log('✅ Oracle Manager: Local blockchain instance provided for LOCAL environment');
        }
        isOracleManagerInitialized = true;
        console.log(`✅ Oracle Manager initialized for ${detectedEnvironment}`);
      }
    } catch (error) {
      console.error(`❌ Oracle Manager initialization failed for ${detectedEnvironment}:`, error);
      throw error;
    }
  }
}

// ===== CONDITIONAL LEGACY ACCOUNT EXPORTS (100% BACKWARD COMPATIBLE) =====
// These exports are conditional based on environment to prevent null access errors
let MCAdeployerAccount: any;
let MCAdeployerKey: any;
let MCAsenderAccount: any;
let MCAsenderKey: any;
let GLEIFdeployerAccount: any;
let GLEIFdeployerKey: any;
let GLEIFsenderAccount: any;
let GLEIFsenderKey: any;
let EXIMdeployerAccount: any;
let EXIMdeployerKey: any;
let EXIMsenderAccount: any;
let EXIMsenderKey: any;
let BusinessProverdeployerAccount: any;
let BusinessProverdeployerKey: any;
let BusinessProversenderAccount: any;
let BusinessProversenderKey: any;
let RiskProverdeployerAccount: any;
let RiskProverdeployerKey: any;
let RiskProversenderAccount: any;
let RiskProversenderKey: any;

if (detectedEnvironment === 'LOCAL' && Local) {
  // Only export LocalBlockchain accounts for LOCAL environment
  MCAdeployerAccount = Local.testAccounts[0];
  MCAdeployerKey = MCAdeployerAccount.key;
  MCAsenderAccount = Local.testAccounts[1];
  MCAsenderKey = MCAsenderAccount.key;

  GLEIFdeployerAccount = Local.testAccounts[2];
  GLEIFdeployerKey = GLEIFdeployerAccount.key;
  GLEIFsenderAccount = Local.testAccounts[3];
  GLEIFsenderKey = GLEIFsenderAccount.key;

  EXIMdeployerAccount = Local.testAccounts[4];
  EXIMdeployerKey = EXIMdeployerAccount.key;
  EXIMsenderAccount = Local.testAccounts[5];
  EXIMsenderKey = EXIMsenderAccount.key;

  BusinessProverdeployerAccount = Local.testAccounts[6];
  BusinessProverdeployerKey = BusinessProverdeployerAccount.key;
  BusinessProversenderAccount = Local.testAccounts[7];
  BusinessProversenderKey = BusinessProversenderAccount.key;

  RiskProverdeployerAccount = Local.testAccounts[8];
  RiskProverdeployerKey = RiskProverdeployerAccount.key;
  RiskProversenderAccount = Local.testAccounts[9];
  RiskProversenderKey = RiskProversenderAccount.key;
} else {
  // For TESTNET/MAINNET, these will be null (should use Oracle Manager instead)
  console.log('ℹ️ Legacy account exports set to null for non-LOCAL environment - use Oracle Manager instead');
  MCAdeployerAccount = null;
  MCAdeployerKey = null;
  MCAsenderAccount = null;
  MCAsenderKey = null;
  GLEIFdeployerAccount = null;
  GLEIFdeployerKey = null;
  GLEIFsenderAccount = null;
  GLEIFsenderKey = null;
  EXIMdeployerAccount = null;
  EXIMdeployerKey = null;
  EXIMsenderAccount = null;
  EXIMsenderKey = null;
  BusinessProverdeployerAccount = null;
  BusinessProverdeployerKey = null;
  BusinessProversenderAccount = null;
  BusinessProversenderKey = null;
  RiskProverdeployerAccount = null;
  RiskProverdeployerKey = null;
  RiskProversenderAccount = null;
  RiskProversenderKey = null;
}

// Export all the conditional variables
export { MCAdeployerAccount, MCAdeployerKey, MCAsenderAccount, MCAsenderKey };
export { GLEIFdeployerAccount, GLEIFdeployerKey, GLEIFsenderAccount, GLEIFsenderKey };
export { EXIMdeployerAccount, EXIMdeployerKey, EXIMsenderAccount, EXIMsenderKey };
export { BusinessProverdeployerAccount, BusinessProverdeployerKey, BusinessProversenderAccount, BusinessProversenderKey };
export { RiskProverdeployerAccount, RiskProverdeployerKey, RiskProversenderAccount, RiskProversenderKey };

// ===== LEGACY REGISTRY MAP (MAINTAINED FOR BACKWARD COMPATIBILITY) =====
export const Registry = new Map<string, {
  publicKey: PublicKey;
  privateKey: PrivateKey;
}>([
  ['MCA', {
    publicKey: MCAdeployerAccount,
    privateKey: MCAdeployerKey
  }] ,

  ['GLEIF', {
    publicKey: GLEIFdeployerAccount,
    privateKey: GLEIFdeployerKey
  }] ,

  ['EXIM', {
    publicKey: EXIMdeployerAccount,
    privateKey: EXIMdeployerKey
  }],
  
  ['BPMN', {
    publicKey: BusinessProverdeployerAccount,
    privateKey: BusinessProverdeployerKey
  }],

  ['RISK', {
    publicKey: RiskProverdeployerAccount,
    privateKey: RiskProverdeployerKey
  }],

  ['BL_REGISTRY', {
    publicKey: BusinessProverdeployerAccount,
    privateKey: BusinessProverdeployerKey
  }]
]);

// ===== LEGACY FUNCTIONS (ENHANCED WITH NEW BACKEND BUT KEPT SYNCHRONOUS) =====
// ✅ MINA o1js BEST PRACTICE: Graceful fallback mechanism for Oracle key access
// Tries new Oracle Manager first, falls back to legacy registry if needed
export function getPrivateKeyFor(key: string): PrivateKey {
  // For sync compatibility, we'll try to initialize if not already done
  if (!isOracleManagerInitialized) {
    try {
      // Try synchronous initialization first
      const result = environmentalOracleManager.initializeSync();
      if (result && detectedEnvironment === 'LOCAL') {
        environmentalOracleManager.setLocalBlockchain(Local);
        isOracleManagerInitialized = true;
      }
    } catch (error) {
      console.warn(`Oracle Manager sync init failed for '${key}', using legacy fallback:`, error);
    }
  }
  
  try {
    // Try new Oracle Manager first if initialized
    if (isOracleManagerInitialized) {
      return environmentalOracleManager.getPrivateKeyFor(key);
    }
  } catch (error) {
    console.warn(`Oracle Manager failed for '${key}', falling back to legacy registry:`, error);
  }
  
  // ✅ MINA o1js BEST PRACTICE: Reliable fallback using Local.testAccounts (only during migration)
  console.log(`🔄 Using legacy registry for '${key}' (migration fallback)`);
  const privateKey = Registry.get(key)?.privateKey;
  if (!privateKey) throw new Error(`No private key found for ${key} in either Oracle Manager or legacy registry`);
  return privateKey;
}

export function getPublicKeyFor(key: string): PublicKey {
  // For sync compatibility, we'll try to initialize if not already done
  if (!isOracleManagerInitialized) {
    try {
      // Try synchronous initialization first
      const result = environmentalOracleManager.initializeSync();
      if (result && detectedEnvironment === 'LOCAL') {
        environmentalOracleManager.setLocalBlockchain(Local);
        isOracleManagerInitialized = true;
      }
    } catch (error) {
      console.warn(`Oracle Manager sync init failed for '${key}', using legacy fallback:`, error);
    }
  }
  
  try {
    // Try new Oracle Manager first if initialized
    if (isOracleManagerInitialized) {
      return environmentalOracleManager.getPublicKeyFor(key);
    }
  } catch (error) {
    console.warn(`Oracle Manager failed for '${key}', falling back to legacy registry:`, error);
  }
  
  // ✅ MINA o1js BEST PRACTICE: Derive public key from private key (only during migration)
  console.log(`🔄 Using legacy registry for '${key}' (migration fallback)`);
  const publicKey = Registry.get(key)?.publicKey;
  if (!publicKey) throw new Error(`No public key found for ${key} in either Oracle Manager or legacy registry`);
  return publicKey;
}

// ===== NEW TYPE-SAFE API EXPORTS =====
// Export the environmental Oracle manager instance
export const oracleManager = environmentalOracleManager;
export { OracleContexts, OracleRole, OracleCategory, Jurisdiction } from '../config/oracle-types.js';

// ===== SEMANTIC ORACLE ACCESS (NEW APPROACH WITH corpRegKey NAMING) =====
export function getCorpRegSignerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.CORPREG_INDIA_MCA, OracleRole.SIGNER);
}

export function getCorpRegDeployerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.CORPREG_INDIA_MCA, OracleRole.DEPLOYER);
}

export function getCorpRegSenderKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.CORPREG_INDIA_MCA, OracleRole.SENDER);
}

export function getCorpRegDeployerAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.CORPREG_INDIA_MCA, OracleRole.DEPLOYER);
}

export function getCorpRegSenderAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.CORPREG_INDIA_MCA, OracleRole.SENDER);
}

export function getGleifSignerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.GLEIF_GLOBAL, OracleRole.SIGNER);
}

export function getGleifSignerAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.GLEIF_GLOBAL, OracleRole.SIGNER);
}

export function getGleifDeployerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.GLEIF_GLOBAL, OracleRole.DEPLOYER);
}

export function getGleifSenderKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.GLEIF_GLOBAL, OracleRole.SENDER);
}

export function getGleifDeployerAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.GLEIF_GLOBAL, OracleRole.DEPLOYER);
}

export function getGleifSenderAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.GLEIF_GLOBAL, OracleRole.SENDER);
}

export function getEximSignerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.EXIM_INDIA_DGFT, OracleRole.SIGNER);
}

export function getEximDeployerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.EXIM_INDIA_DGFT, OracleRole.DEPLOYER);
}

export function getEximSenderKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.EXIM_INDIA_DGFT, OracleRole.SENDER);
}

export function getEximDeployerAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.EXIM_INDIA_DGFT, OracleRole.DEPLOYER);
}

export function getEximSenderAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.EXIM_INDIA_DGFT, OracleRole.SENDER);
}

export function getRiskSignerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, OracleRole.SIGNER);
}

export function getRiskDeployerKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, OracleRole.DEPLOYER);
}

export function getRiskSenderKey(): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, OracleRole.SENDER);
}

export function getRiskDeployerAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, OracleRole.DEPLOYER);
}

export function getRiskSenderAccount(): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, OracleRole.SENDER);
}

// ===== GENERIC ORACLE ACCESS BY ROLE =====
export function getCorpRegKey(role: OracleRole = OracleRole.SIGNER): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.CORPREG_INDIA_MCA, role);
}

export function getCorpRegAccount(role: OracleRole = OracleRole.DEPLOYER): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.CORPREG_INDIA_MCA, role);
}

export function getGleifKey(role: OracleRole = OracleRole.SIGNER): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.GLEIF_GLOBAL, role);
}

export function getGleifAccount(role: OracleRole = OracleRole.DEPLOYER): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.GLEIF_GLOBAL, role);
}

export function getEximKey(role: OracleRole = OracleRole.SIGNER): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.EXIM_INDIA_DGFT, role);
}

export function getEximAccount(role: OracleRole = OracleRole.DEPLOYER): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.EXIM_INDIA_DGFT, role);
}

export function getRiskKey(role: OracleRole = OracleRole.SIGNER): PrivateKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleKey(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, role);
}

export function getRiskAccount(role: OracleRole = OracleRole.DEPLOYER): PublicKey {
  ensureOracleManagerInitialized();
  return environmentalOracleManager.getOracleAccount(OracleContexts.RISK_GLOBAL_ACTUS_IMPLEMENTOR_1, role);
}
