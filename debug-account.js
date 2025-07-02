/**
 * Quick Account Debug Script
 * Tests if the contract account exists on DEVNET with proper network connection
 */

import { Mina, fetchAccount, PublicKey } from 'o1js';

async function quickAccountCheck() {
    const contractAddress = "B62qkr8Shc6dBEebySLahnXSyofmRyNfqVG8wdS1SsyootsY8RzNVdy";
    const endpoint = "https://api.minascan.io/node/devnet/v1/graphql";
    
    console.log("🔍 QUICK ACCOUNT CHECK");
    console.log("=====================");
    console.log(`Contract: ${contractAddress}`);
    console.log(`Endpoint: ${endpoint}`);
    
    try {
        // CRITICAL: Properly set up DEVNET connection
        console.log("\n🌐 Setting up DEVNET connection...");
        const Network = Mina.Network(endpoint);
        Mina.setActiveInstance(Network);
        console.log("✅ DEVNET connection established");
        
        // Test network with known account first
        console.log("\n🧪 Testing network connectivity...");
        const gleifDeployer = "B62qo3JqEQno6Z234yV42Sdqy2qfwjVtLFUpdn21kBKmUMRAGrKeEJ9";
        const gleifDeployerPubKey = PublicKey.fromBase58(gleifDeployer);
        await fetchAccount({ publicKey: gleifDeployerPubKey });
        const deployerAccount = Mina.getAccount(gleifDeployerPubKey);
        
        if (deployerAccount) {
            console.log(`✅ Network OK - Deployer has ${Number(deployerAccount.balance.toString()) / 1e9} MINA`);
        } else {
            console.log("❌ Network connectivity issue");
            return;
        }
        
        // Now test the contract account
        console.log("\n🎯 Checking contract account...");
        const contractPubKey = PublicKey.fromBase58(contractAddress);
        await fetchAccount({ publicKey: contractPubKey });
        const contractAccount = Mina.getAccount(contractPubKey);
        
        if (contractAccount) {
            console.log("✅ CONTRACT FOUND!");
            console.log(`💰 Balance: ${Number(contractAccount.balance.toString()) / 1e9} MINA`);
            
            if (contractAccount.zkapp) {
                console.log("🎯 Status: ACTIVE zkApp");
                console.log("🎉 ACCOUNT VERIFICATION SHOULD NOW WORK!");
            } else {
                console.log("⚠️ Status: Regular account (not yet zkApp)");
                console.log("⏳ Still processing - try again in a few minutes");
            }
        } else {
            console.log("❌ Contract account not found");
            console.log("⏳ Transaction still processing on DEVNET");
            console.log("💡 This is normal - DEVNET can take 10-20 minutes");
        }
        
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
    }
}

quickAccountCheck();
