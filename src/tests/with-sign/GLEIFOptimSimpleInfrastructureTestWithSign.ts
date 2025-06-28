/**
 * GLEIF Simple Infrastructure Test - Following Risk Test Pattern
 * Uses the exact same pattern as RiskLiquidityAdvancedOptimMerkleVerificationTestWithSign.ts
 * No experimental flags required
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getGLEIFOptimSimpleInfrastructureVerificationWithSignUtils } from './GLEIFOptimSimpleInfrastructureTestWithSignUtils.js';

async function main() {
    const companyName = process.argv[2];
    
    if (!companyName) {
        console.error('❌ Error: Company name is required');
        console.log('📖 Usage: node GLEIFOptimSimpleInfrastructureTestWithSign.js "COMPANY NAME"');
        console.log('📝 Example: node GLEIFOptimSimpleInfrastructureTestWithSign.js "APPLE INC"');
        process.exit(1);
    }
    
    console.log('🏢 Company Name:', companyName);
    console.log('🔧 Using Simple Infrastructure Pattern (No Experimental Flags)');
    
    try {
        const proof = await getGLEIFOptimSimpleInfrastructureVerificationWithSignUtils(companyName);
        console.log('\n🎯 Simple infrastructure-based proof generated successfully!');
        console.log('📄 Proof:', proof.toJSON());
    } catch (error) {
        console.error('💥 Error:', error);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
});
