/**
 * DEBUG: Business Standard Integrity Test - Step by Step
 * This script will help identify exactly where the hanging occurs
 */

import { Field, Mina, PrivateKey, AccountUpdate } from 'o1js';
import { BlockchainManager } from './infrastructure/blockchain/BlockchainManager.js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

async function debugStepByStep() {
    console.log('\n🔍 DEBUG: Business Standard Integrity - Step by Step Analysis');
    console.log('='.repeat(70));
    
    try {
        // Step 1: Test basic imports
        console.log('📦 Step 1: Testing basic imports...');
        console.log('✅ o1js imported successfully');
        console.log('✅ BlockchainManager imported successfully');
        
        // Step 2: Test file loading
        console.log('\n📂 Step 2: Testing file loading...');
        const documentFile = './src/data/scf/BILLOFLADING/BOL-VALID-1.json';
        
        if (!fs.existsSync(documentFile)) {
            throw new Error(`File not found: ${documentFile}`);
        }
        
        const documentDataRaw = fs.readFileSync(documentFile, 'utf8');
        const documentData = JSON.parse(documentDataRaw);
        console.log('✅ Document loaded and parsed successfully');
        console.log(`📄 Document type: ${documentData.transportDocumentTypeCode}`);
        console.log(`📋 Transport reference: ${documentData.transportDocumentReference}`);
        
        // Step 3: Test BlockchainManager initialization
        console.log('\n🔧 Step 3: Testing LocalBlockchain initialization...');
        console.log('⏳ This should be quick (under 30 seconds)...');
        
        const startTime = Date.now();
        const Local = await BlockchainManager.ensureLocalBlockchain(true);
        const initTime = Math.round((Date.now() - startTime) / 1000);
        
        Mina.setActiveInstance(Local);
        console.log(`✅ LocalBlockchain initialized in ${initTime} seconds`);
        console.log(`📊 Test accounts available: ${Local.testAccounts.length}`);
        
        // Step 4: Test basic Field operations
        console.log('\n🔢 Step 4: Testing basic Field operations...');
        const testField = Field.from(12345);
        const testField2 = Field.from('hello');
        console.log(`✅ Field creation works: ${testField.toString()}`);
        console.log(`✅ Field from string works: ${testField2.toString()}`);
        
        // Step 5: Test MerkleUtils import (this might be where it hangs)
        console.log('\n🌳 Step 5: Testing MerkleUtils import...');
        try {
            const { BusinessStdMerkleUtils } = await import('./tests/with-sign/BusinessStdIntegrityOptimMerkleUtils.js');
            console.log('✅ BusinessStdMerkleUtils imported successfully');
            
            // Step 6: Test basic merkle tree creation
            console.log('\n🌳 Step 6: Testing basic merkle tree creation...');
            const tree = BusinessStdMerkleUtils.createBusinessStdMerkleTree(documentData);
            console.log(`✅ Merkle tree created with ${tree.values.length} fields`);
            console.log(`🔗 Root hash: ${tree.root.toString().substring(0, 50)}...`);
            
        } catch (merkleError) {
            console.error('❌ MerkleUtils import/usage failed:', merkleError);
            throw merkleError;
        }
        
        // Step 7: Test ZK Program import (this is likely where it hangs)
        console.log('\n🔐 Step 7: Testing ZK Program import...');
        console.log('⚠️  WARNING: This step might hang during import/compilation');
        
        try {
            const { BusinessStdIntegrityOptimMerkleVerifier } = await import('./zk-programs/with-sign/BusinessStdIntegrityOptimMerkleZKProgramWithSign.js');
            console.log('✅ ZK Program imported successfully');
            
            // Step 8: Test ZK Program compilation
            console.log('\n⚡ Step 8: Testing ZK Program compilation...');
            console.log('⏳ This WILL take 5-15 minutes - please be patient...');
            console.log('🔄 Compilation progress indicators:');
            
            const compilationStart = Date.now();
            
            // Add progress indicator
            const progressInterval = setInterval(() => {
                const elapsed = Math.round((Date.now() - compilationStart) / 1000);
                console.log(`   ⏱️  Compiling... ${elapsed}s elapsed`);
            }, 30000); // Log every 30 seconds
            
            const compilationResult = await BusinessStdIntegrityOptimMerkleVerifier.compile();
            clearInterval(progressInterval);
            
            const compilationTime = Math.round((Date.now() - compilationStart) / 1000);
            console.log(`✅ ZK Program compiled successfully in ${compilationTime} seconds`);
            
        } catch (zkError) {
            console.error('❌ ZK Program import/compilation failed:', zkError);
            throw zkError;
        }
        
        console.log('\n🎉 SUCCESS: All debug steps completed successfully!');
        console.log('💡 The hanging issue was likely during ZK program compilation');
        console.log('📝 Next steps: Run the full test with patience for compilation time');
        
    } catch (error) {
        console.error('\n❌ DEBUG FAILED at step:', error);
        console.error('💡 This helps identify exactly where the hanging occurs');
        
        if (error instanceof Error) {
            console.error('Error details:', error.message);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
        
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);

async function main() {
    if (args.length > 0 && args[0] === 'debug') {
        await debugStepByStep();
    } else {
        console.log('Usage: node DebugBusinessStdTest.js debug');
        console.log('This will run step-by-step debugging to identify hanging issues');
    }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}