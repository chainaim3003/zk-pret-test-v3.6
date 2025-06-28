/**
 * GLEIF Infrastructure Test - Properly Using Refactored Infrastructure
 * This version actually uses the refactored infrastructure system while avoiding experimental modules
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getGLEIFOptimRefactoredInfrastructureVerificationWithSignUtils } from './GLEIFOptimRefactoredInfrastructureTestWithSignUtils.js';

async function main() {
    const companyName = process.argv[2];
    
    if (!companyName) {
        console.error('❌ Error: Company name is required');
        console.log('📖 Usage: node GLEIFOptimRefactoredInfrastructureTestWithSign.js "COMPANY NAME"');
        console.log('📝 Example: node GLEIFOptimRefactoredInfrastructureTestWithSign.js "APPLE INC"');
        process.exit(1);
    }
    
    console.log('🏢 Company Name:', companyName);
    console.log('🔧 Using REFACTORED Infrastructure System (No Experimental Flags)');
    
    try {
        const proof = await getGLEIFOptimRefactoredInfrastructureVerificationWithSignUtils(companyName);
        console.log('\n🎯 Refactored infrastructure-based proof generated successfully!');
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
