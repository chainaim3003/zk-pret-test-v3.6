import * as dotenv from 'dotenv';
dotenv.config();

import { getGLEIFOptimVerificationWithSignUtils } from './GLEIFOptimVerificationTestWithSignUtils.js';

async function main() {
    // Get company name and network type from command line arguments
    const companyName = process.argv[2];
    //const typeOfNet = process.argv[3] || 'TESTNET';
    
    if (!companyName) {
        console.error('❌ Error: Company name is required');
        console.log('📖 Usage: node GLEIFOptimVerificationTestWithSign.js "COMPANY NAME" [TESTNET|MAINNET]');
        console.log('📝 Example: node GLEIFOptimVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED" "TESTNET"');
        process.exit(1);
    }
    
    console.log('🏢 Company Name:', companyName);
    //console.log('🌐 Network Type:', typeOfNet);
    
    try {
        const proof = await getGLEIFOptimVerificationWithSignUtils(companyName);
        console.log('\n🎯 Proof generated successfully!');
        // Uncomment the line below if you want to see the full proof JSON
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
