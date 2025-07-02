import { Mina, PrivateKey, PublicKey, Field, Poseidon } from 'o1js';
import { OracleContexts, OracleRole } from '../config/oracle-types.js';
import { ConfigurableOracleManager } from '../config/oracle-manager.js';
import { environmentManager } from '../infrastructure/environment/manager.js';
import * as fs from 'fs';
import * as path from 'path';

// ===== LEGACY BLOCKCHAIN SETUP FOR BACKWARD COMPATIBILITY =====
// ✅ MINA o1js BEST PRACTICE: Single Local blockchain instance
// Only ONE Local blockchain should be created per application to avoid conflicts
const useProof = false;
export const Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
Mina.setActiveInstance(Local);

// Initialize the new Oracle Manager with environment detection
let isOracleManagerInitialized = false;
let initializationError: Error | null = null;

// Detect environment from process.env or default to LOCAL
const detectedEnvironment = process.env.BUILD_ENV || process.env.NODE_ENV || 'LOCAL';
console.log(`🌍 Detected environment: ${detectedEnvironment}`);

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

// ===== LEGACY ACCOUNT EXPORTS (100% BACKWARD COMPATIBLE) =====
// These exports remain exactly the same to ensure existing imports work
export const MCAdeployerAccount = Local.testAccounts[0];
export const MCAdeployerKey = MCAdeployerAccount.key;
export const MCAsenderAccount = Local.testAccounts[1];
export const MCAsenderKey = MCAsenderAccount.key;

export const GLEIFdeployerAccount = Local.testAccounts[2];
export const GLEIFdeployerKey = GLEIFdeployerAccount.key;
export const GLEIFsenderAccount = Local.testAccounts[3];
export const GLEIFsenderKey = GLEIFsenderAccount.key;

export const EXIMdeployerAccount = Local.testAccounts[4];
export const EXIMdeployerKey = EXIMdeployerAccount.key;
export const EXIMsenderAccount = Local.testAccounts[5];
export const EXIMsenderKey = EXIMsenderAccount.key;

export const BusinessProverdeployerAccount = Local.testAccounts[6];
export const BusinessProverdeployerKey = BusinessProverdeployerAccount.key;
export const BusinessProversenderAccount = Local.testAccounts[7];
export const BusinessProversenderKey = BusinessProversenderAccount.key;

export const RiskProverdeployerAccount = Local.testAccounts[8];
export const RiskProverdeployerKey = RiskProverdeployerAccount.key;
export const RiskProversenderAccount = Local.testAccounts[9];
export const RiskProversenderKey = RiskProversenderAccount.key;

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
