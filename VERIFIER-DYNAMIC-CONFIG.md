/**
 * VERIFIER FIX: Replace hardcoded contract with dynamic config loading
 * This breaks the deploy-verify VK mismatch cycle
 */

// Add these imports at the top (around line 18):
import { promises as fs } from 'fs';
import { join } from 'path';

// Replace lines 100-104 with this:
console.log('\n📋 Step 1: Loading contract from testnet.json...');

// Simple, direct config loading (avoids Environment-Aware Manager complexity)
const configPath = join('./config/environments', 'testnet.json');
console.log(`📖 Reading config from: ${configPath}`);

try {
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    const contractAddress = config.deployments?.contracts?.GLEIFOptimMultiCompanySmartContract?.address;
    
    if (!contractAddress) {
        throw new Error(`❌ No contract address found in testnet.json`);
    }
    
    console.log(`✅ Contract loaded from config: ${contractAddress}`);
    console.log(`🔄 This ensures deploy-verify cycle consistency`);
    
} catch (error) {
    console.error(`❌ Failed to load config: ${error.message}`);
    throw error;
}

// The contractAddress variable now contains the current deployed contract
