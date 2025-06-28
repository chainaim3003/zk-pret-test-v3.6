/**
 * Simple GLEIF Test Script (No Experimental Flags)
 * Based on the pattern used by Risk tests that work without experimental flags
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getGLEIFOptimVerificationWithSignUtils } from './GLEIFOptimVerificationTestWithSignUtils.js';

async function main() {
    const companyName = process.argv[2];
    
    if (!companyName) {
        console.error('❌ Error: Company name is required');
        console.log('📖 Usage: node GLEIFSimpleTest.js "COMPANY NAME"');
        console.log('📝 Example: node GLEIFSimpleTest.js "APPLE INC"');
        process.exit(1);
    }
    
    console.log('🏢 Company Name:', companyName);
    console.log('🔧 Testing without experimental flags...');
    
    try {
        const proof = await getGLEIFOptimVerificationWithSignUtils(companyName);
        console.log('\n🎯 Proof generated successfully!');
        console.log('📄 Proof verification completed');
        console.log('\n✅ GLEIF test completed without experimental flags!');
    } catch (error) {
        console.error('💥 Error:', error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
});
