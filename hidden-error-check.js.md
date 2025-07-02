/**
 * Hidden Error Detection for zkApp Deployment
 * Checks for silent failure modes that are not exposed during normal activation
 */

import { Mina, fetchAccount, PublicKey } from 'o1js';
import fs from 'fs';

const CONTRACT_ADDRESS = "B62qkr8Shc6dBEebySLahnXSyofmRyNfqVG8wdS1SsyootsY8RzNVdy";
const ENDPOINT = "https://api.minascan.io/node/devnet/v1/graphql";

async function detectHiddenErrors() {
    console.log("🔍 HIDDEN ERROR DETECTION FOR ZKAPP DEPLOYMENT");
    console.log("=" .repeat(60));
    console.log(`🎯 Contract: ${CONTRACT_ADDRESS}`);
    
    const issues = [];
    
    try {
        // 1. Check Verification Key Consistency
        console.log("\n📋 1. VERIFICATION KEY CONSISTENCY CHECK");
        console.log("-".repeat(40));
        
        // Check if testnet.json has verification key
        const testnetConfigPath = './config/environments/testnet.json';
        if (fs.existsSync(testnetConfigPath)) {
            const config = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
            const deployment = config.deployments?.contracts?.GLEIFOptimMultiCompanySmartContract;
            
            if (deployment?.verificationKey) {
                console.log("✅ Verification key found in config");
                console.log(`📏 VK length: ${deployment.verificationKey.length} characters`);
                
                // Parse and validate VK structure
                try {
                    const vkData = JSON.parse(deployment.verificationKey);
                    if (vkData.data && vkData.hash) {
                        console.log("✅ Verification key has valid structure");
                        console.log(`🔢 VK Hash: ${vkData.hash}`);
                    } else {
                        console.log("❌ Verification key missing data or hash fields");
                        issues.push("INVALID_VK_STRUCTURE");
                    }
                } catch (vkError) {
                    console.log("❌ Verification key is not valid JSON");
                    issues.push("CORRUPTED_VK");
                }
            } else {
                console.log("❌ No verification key found in deployment config");
                issues.push("MISSING_VK_IN_CONFIG");
            }
        } else {
            console.log("❌ testnet.json config file not found");
            issues.push("MISSING_CONFIG");
        }
        
        // 2. Network State vs Config Consistency
        console.log("\n📋 2. NETWORK STATE VALIDATION");
        console.log("-".repeat(40));
        
        const Network = Mina.Network(ENDPOINT);
        Mina.setActiveInstance(Network);
        
        const contractPubKey = PublicKey.fromBase58(CONTRACT_ADDRESS);
        await fetchAccount({ publicKey: contractPubKey });
        const account = Mina.getAccount(contractPubKey);
        
        if (account) {
            console.log("✅ Account exists on network");
            console.log(`💰 Balance: ${Number(account.balance.toString()) / 1e9} MINA`);
            console.log(`📊 Nonce: ${account.nonce.toString()}`);
            
            if (account.zkapp) {
                console.log("✅ Account has zkApp state");
                
                // Check if verification key is set
                if (account.zkapp.verificationKey) {
                    console.log("✅ Verification key is set on-chain");
                    
                    // Compare with local VK if available
                    if (fs.existsSync(testnetConfigPath)) {
                        const config = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
                        const localVK = config.deployments?.contracts?.GLEIFOptimMultiCompanySmartContract?.verificationKey;
                        
                        if (localVK) {
                            try {
                                const localVKData = JSON.parse(localVK);
                                const onChainVKHash = account.zkapp.verificationKey.hash.toString();
                                
                                if (localVKData.hash === onChainVKHash) {
                                    console.log("✅ Local and on-chain verification keys match");
                                } else {
                                    console.log("❌ VERIFICATION KEY MISMATCH!");
                                    console.log(`   Local VK Hash:  ${localVKData.hash}`);
                                    console.log(`   On-chain VK Hash: ${onChainVKHash}`);
                                    issues.push("VK_MISMATCH");
                                }
                            } catch (error) {
                                console.log("⚠️ Could not compare verification keys");
                                issues.push("VK_COMPARISON_FAILED");
                            }
                        }
                    }
                } else {
                    console.log("❌ No verification key set on-chain");
                    issues.push("MISSING_ONCHAIN_VK");
                }
                
                // Check permissions
                const permissions = account.zkapp.permissions;
                if (permissions) {
                    console.log("📋 zkApp Permissions:");
                    console.log(`   Edit State: ${permissions.editState}`);
                    console.log(`   Send: ${permissions.send}`);
                    console.log(`   Receive: ${permissions.receive}`);
                    
                    if (permissions.editState === 'proof') {
                        console.log("✅ Edit state requires proof (correct)");
                    } else {
                        console.log("⚠️ Edit state does not require proof");
                        issues.push("INCORRECT_PERMISSIONS");
                    }
                }
            } else {
                console.log("❌ Account exists but no zkApp state");
                issues.push("NO_ZKAPP_STATE");
            }
        } else {
            console.log("❌ Account not found on network");
            issues.push("ACCOUNT_NOT_FOUND");
        }
        
        // 3. o1js Version Compatibility Check
        console.log("\n📋 3. O1JS VERSION COMPATIBILITY");
        console.log("-".repeat(40));
        
        if (fs.existsSync('./package.json')) {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            const o1jsVersion = packageJson.dependencies?.o1js || packageJson.devDependencies?.o1js;
            
            if (o1jsVersion) {
                console.log(`📦 o1js version: ${o1jsVersion}`);
                
                // Check for known problematic version transitions
                if (o1jsVersion.includes('2.0') || o1jsVersion.includes('^2')) {
                    console.log("⚠️ Using o1js v2.0+ - circuit constraints changed");
                    console.log("💡 If deployed with v1.x, contract may be broken");
                    issues.push("POTENTIAL_V2_INCOMPATIBILITY");
                }
            } else {
                console.log("❌ o1js version not found in package.json");
                issues.push("UNKNOWN_O1JS_VERSION");
            }
        }
        
        // 4. Transaction Status Deep Dive
        console.log("\n📋 4. TRANSACTION STATUS ANALYSIS");
        console.log("-".repeat(40));
        
        if (fs.existsSync(testnetConfigPath)) {
            const config = JSON.parse(fs.readFileSync(testnetConfigPath, 'utf8'));
            const txHash = config.deployments?.contracts?.GLEIFOptimMultiCompanySmartContract?.transactionHash;
            
            if (txHash) {
                console.log(`🔍 Checking transaction: ${txHash}`);
                
                // This would require additional API calls to check transaction details
                // For now, we just verify the hash format
                if (txHash.length === 52 && txHash.startsWith('5J')) {
                    console.log("✅ Transaction hash format appears valid");
                } else {
                    console.log("⚠️ Transaction hash format seems unusual");
                    issues.push("INVALID_TX_HASH_FORMAT");
                }
            } else {
                console.log("❌ No transaction hash found in config");
                issues.push("MISSING_TX_HASH");
            }
        }
        
    } catch (error) {
        console.log(`💥 Error during detection: ${error.message}`);
        issues.push(`DETECTION_ERROR: ${error.message}`);
    }
    
    // Summary
    console.log("\n📊 HIDDEN ERROR DETECTION SUMMARY");
    console.log("=" .repeat(60));
    
    if (issues.length === 0) {
        console.log("🎉 NO HIDDEN ERRORS DETECTED!");
        console.log("✅ Your deployment appears to be correct");
        console.log("⏳ The 'not activated' status is likely just network delay");
    } else {
        console.log(`⚠️ FOUND ${issues.length} POTENTIAL ISSUE(S):`);
        issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. ${issue}`);
        });
        
        console.log("\n🔧 RECOMMENDED ACTIONS:");
        
        if (issues.includes("VK_MISMATCH")) {
            console.log("  🚨 CRITICAL: Verification key mismatch detected!");
            console.log("     → Redeploy with correct verification key");
        }
        
        if (issues.includes("POTENTIAL_V2_INCOMPATIBILITY")) {
            console.log("  ⚠️ o1js v2.0 compatibility issue possible");
            console.log("     → Check if deployment was done with same o1js version");
        }
        
        if (issues.includes("NO_ZKAPP_STATE")) {
            console.log("  🔄 Account exists but zkApp not activated");
            console.log("     → This suggests deployment transaction may have failed");
        }
        
        if (issues.includes("MISSING_ONCHAIN_VK")) {
            console.log("  🚨 CRITICAL: No verification key on-chain");
            console.log("     → Deployment did not complete properly - redeploy required");
        }
    }
    
    return issues;
}

detectHiddenErrors().catch(console.error);