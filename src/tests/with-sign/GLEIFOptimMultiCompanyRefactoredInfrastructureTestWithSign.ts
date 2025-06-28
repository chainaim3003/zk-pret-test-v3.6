/**
 * GLEIF Multi-Company Refactored Infrastructure Test
 * Combines multi-company functionality with the refactored infrastructure system
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getGLEIFOptimMultiCompanyRefactoredInfrastructureVerificationWithSignUtils } from './GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSignUtils.js';

async function main() {
    // Get company names and network type from command line arguments
    const companyNamesArg = process.argv[2];
    
    if (!companyNamesArg) {
        console.error('❌ Error: Company names are required');
        console.log('📖 Usage: node GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js "COMPANY1,COMPANY2" [TESTNET|MAINNET]');
        console.log('📝 Example: node GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js "Apple Inc.,Microsoft Corporation"');
        console.log('📝 Example: node GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js "DEUTSCHE BANK AKTIENGESELLSCHAFT,JPMorgan Chase & Co."');
        console.log('📝 Single Company: node GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"');
        process.exit(1);
    }
    
    // Parse company names from comma-separated string
    const companyNames = companyNamesArg.split(',').map(name => name.trim()).filter(name => name.length > 0);
    
    if (companyNames.length === 0) {
        console.error('❌ Error: At least one company name is required');
        process.exit(1);
    }
    
    if (companyNames.length > 10) {
        console.error('❌ Error: Maximum 10 companies supported in this demo');
        process.exit(1);
    }
    
    console.log('🏢 Company Names:', companyNames);
    console.log('📊 Total Companies to Process:', companyNames.length);
    console.log('🔧 Using REFACTORED Infrastructure System (No Experimental Flags)');
    
    try {
        const result = await getGLEIFOptimMultiCompanyRefactoredInfrastructureVerificationWithSignUtils(companyNames);
        
        console.log('\n🎯 Multi-Company Refactored Infrastructure Verification completed successfully!');
        console.log('\n📊 Final Summary:');
        console.log(`✅ Total Companies Processed: ${result.verificationResults.length}`);
        console.log(`✅ Successful Verifications: ${result.verificationResults.filter(r => !r.error).length}`);
        console.log(`❌ Failed Verifications: ${result.verificationResults.filter(r => r.error).length}`);
        console.log(`🏆 Compliant Companies: ${result.verificationResults.filter(r => r.isCompliant).length}`);
        console.log(`⚠️ Non-Compliant Companies: ${result.verificationResults.filter(r => !r.isCompliant && !r.error).length}`);
        
        console.log('\n🏢 Company Status Details:');
        result.verificationResults.forEach((company, index) => {
            const status = company.error ? '❌ ERROR' : (company.isCompliant ? '✅ COMPLIANT' : '⚠️ NON-COMPLIANT');
            console.log(`  ${index + 1}. ${company.companyName}: ${status}`);
            if (!company.error) {
                console.log(`     📄 LEI: ${company.lei}`);
                console.log(`     📊 Score: ${company.complianceScore}%`);
                console.log(`     🕒 Verified: ${new Date(Number(company.verificationTime)).toISOString()}`);
            } else {
                console.log(`     ❌ Error: ${company.error}`);
            }
        });
        
        console.log('\n🎉 Multi-Company GLEIF Refactored Infrastructure Verification Demo Completed Successfully!');
        console.log('📋 Features Demonstrated:');
        console.log('  ✅ Multiple company verification in single contract');
        console.log('  ✅ Refactored infrastructure system integration');
        console.log('  ✅ Environment management and configuration');
        console.log('  ✅ Compilation caching and optimization');
        console.log('  ✅ Deployment persistence and tracking');
        console.log('  ✅ Global compliance statistics tracking');
        console.log('  ✅ Individual company state management');
        console.log('  ✅ Merkle tree-based company registry');
        console.log('  ✅ Aggregate compliance scoring');
        console.log('  ✅ Real-time GLEIF API integration');
        console.log('  ✅ Zero-knowledge proof generation and verification');
        console.log('  ✅ Smart contract state updates');
        console.log('  ✅ No experimental flags required');
        
        // Uncomment the line below if you want to see the full proof JSONs
        // console.log('📄 Generated Proofs:', result.proofs.map(p => p.toJSON()));
        
    } catch (error) {
        console.error('💥 Error:', error);
        console.error('💥 Error Stack:', (error as Error).stack || 'No stack trace available');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('💥 Fatal Error:', err);
    console.error('💥 Fatal Error Stack:', err.stack);
    process.exit(1);
});
