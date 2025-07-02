/**
 * Network Connection and Transaction Submission Diagnostic
 * Diagnoses why transactions aren't reaching DEVNET
 */

import { Mina, PrivateKey, PublicKey, UInt64, AccountUpdate } from 'o1js';

async function diagnoseNetworkConnection() {
  console.log('🔍 NETWORK CONNECTION DIAGNOSTIC');
  console.log('================================');
  
  try {
    // Test 1: Check if we can connect to DEVNET
    console.log('\n📡 Step 1: Testing DEVNET Connection...');
    
    const devnetEndpoint = 'https://api.minascan.io/node/devnet/v1/graphql';
    console.log(`   Endpoint: ${devnetEndpoint}`);
    
    // Set network
    const Network = Mina.Network(devnetEndpoint);
    Mina.setActiveInstance(Network);
    console.log('   ✅ Network instance created');
    
    // Test 2: Try to fetch a known account
    console.log('\n👤 Step 2: Testing Account Access...');
    const testAccount = PublicKey.fromBase58('B62qo3JqEQno6Z234yV42Sdqy2qfwjVtLFUpdn21kBKmUMRAGrKeEJ9');
    
    try {
      const accountInfo = await Mina.getAccount(testAccount);
      console.log(`   ✅ Account accessible`);
      console.log(`   💰 Balance: ${accountInfo.balance.toString()} nanomina`);
      console.log(`   🔢 Nonce: ${accountInfo.nonce.toString()}`);
    } catch (error) {
      console.log(`   ❌ Cannot access account: ${error}`);
      console.log(`   🔍 This suggests network connectivity issues`);
    }
    
    // Test 3: Try a simple transaction creation (without sending)
    console.log('\n🔄 Step 3: Testing Transaction Creation...');
    try {
      const senderKey = PrivateKey.random();
      const sender = senderKey.toPublicKey();
      
      const txn = await Mina.transaction(
        { sender, fee: UInt64.from(100000000) },
        async () => {
          // Simple account update
          const accountUpdate = AccountUpdate.createSigned(sender);
          accountUpdate.send({ to: sender, amount: UInt64.from(0) });
        }
      );
      
      console.log('   ✅ Transaction creation successful');
      console.log(`   📋 Transaction structure: ${txn ? 'Valid' : 'Invalid'}`);
      
    } catch (error) {
      console.log(`   ❌ Transaction creation failed: ${error}`);
    }
    
    // Test 4: Check network status
    console.log('\n🌐 Step 4: Network Status Check...');
    try {
      const network = Mina.activeInstance;
      console.log(`   Network type: ${network.constructor.name}`);
      console.log(`   ✅ Active network instance exists`);
    } catch (error) {
      console.log(`   ❌ Network instance error: ${error}`);
    }
    
  } catch (error) {
    console.error('\n❌ NETWORK DIAGNOSTIC FAILED:', error);
  }
}

async function testTransactionSubmission() {
  console.log('\n🚀 TRANSACTION SUBMISSION TEST');
  console.log('==============================');
  
  try {
    // Use the actual GLEIF account for testing
    const gleifAccountB58 = 'B62qo3JqEQno6Z234yV42Sdqy2qfwjVtLFUpdn21kBKmUMRAGrKeEJ9';
    const gleifAccount = PublicKey.fromBase58(gleifAccountB58);
    
    console.log(`   Testing with GLEIF account: ${gleifAccountB58}`);
    
    // Try to get account info first
    try {
      const accountInfo = await Mina.getAccount(gleifAccount);
      console.log(`   ✅ Account balance: ${Number(accountInfo.balance.toString()) / 1e9} MINA`);
      console.log(`   📈 Current nonce: ${accountInfo.nonce.toString()}`);
      
      if (Number(accountInfo.balance.toString()) < 1200000000) { // Less than 1.2 MINA
        console.log(`   ⚠️ WARNING: Insufficient balance for deployment`);
        console.log(`   💡 Need at least 1.2 MINA (1 MINA account creation + 0.2 MINA fee)`);
      }
      
    } catch (error) {
      console.log(`   ❌ Cannot access GLEIF account: ${error}`);
      return;
    }
    
  } catch (error) {
    console.error('❌ TRANSACTION SUBMISSION TEST FAILED:', error);
  }
}

// Run diagnostics
async function runFullDiagnostic() {
  console.log('🔧 COMPREHENSIVE NETWORK & TRANSACTION DIAGNOSTIC');
  console.log('='.repeat(60));
  
  await diagnoseNetworkConnection();
  await testTransactionSubmission();
  
  console.log('\n📋 DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));
  console.log('🎯 Next steps based on results:');
  console.log('   • If network connection fails: Check internet/firewall');
  console.log('   • If account access fails: Check DEVNET status');  
  console.log('   • If balance insufficient: Need more funding');
  console.log('   • If transaction creation fails: Check o1js version');
}

runFullDiagnostic().catch(console.error);
