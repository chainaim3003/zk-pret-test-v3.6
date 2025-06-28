/**
 * GLEIF Infrastructure Test - No Experimental Flags Required
 * Follows the exact same pattern as the original working GLEIF tests
 * but uses the infrastructure system for initialization
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getGLEIFOptimInfrastructureVerificationWithSignUtils } from './GLEIFOptimInfrastructureTestWithSignUtils.js';

async function main() {
    const companyName = process.argv[2];
    
    if (!companyName) {
        console.error('❌ Error: Company name is required');
        console.log('📖 Usage: node GLEIFOptimInfrastructureTestWithSign.js "COMPANY NAME"');
        console.log('📝 Example: node GLEIFOptimInfrastructureTestWithSign.js "APPLE INC"');
        process.exit(1);
    }
    
    console.log('🏢 Company Name:', companyName);
    console.log('🔧 Using Infrastructure System (No Experimental Flags)');
    
    try {
        const proof = await getGLEIFOptimInfrastructureVerificationWithSignUtils(companyName);
        console.log('\n🎯 Infrastructure-based proof generated successfully!');
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
