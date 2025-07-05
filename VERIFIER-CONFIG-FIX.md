// Add this to the verifier at line 22 (uncomment and modify):
import { environmentManager } from '../../infrastructure/index.js';

// Replace lines 100-104 with this proper config loading:
console.log('\n📋 Step 1: Loading contract from environment configuration...');

// Load contract address from testnet.json through environment manager
const currentEnv = environmentManager.getCurrentEnvironment();
console.log(`🌍 Environment: ${currentEnv}`);

// Get the environment configuration
const envConfig = await environmentManager.getCurrentConfig();
const contractAddress = envConfig?.deployments?.contracts?.GLEIFOptimMultiCompanySmartContract?.address;

if (!contractAddress) {
    throw new Error(`❌ No contract address found in ${currentEnv} environment configuration`);
}

console.log(`📍 Contract address from config: ${contractAddress}`);
console.log(`✅ Using contract from testnet.json: ${contractAddress}`);
