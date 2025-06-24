import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Example usage of GLEIF Multi-Company Verification System
 * This script demonstrates how to use both single and multi-company contracts
 */

import { getGLEIFOptimSingleCompanyVerificationWithSignUtils } from './GLEIFOptimSingleCompanyVerificationTestWithSignUtils.js';
import { getGLEIFOptimMultiCompanyVerificationWithSignUtils } from './GLEIFOptimMultiCompanyVerificationTestWithSignUtils.js';

async function runExamples() {
    console.log('🌟 GLEIF Verification System Examples');
    console.log('=====================================\n');

    //const typeOfNet = 'TESTNET';

    try {
        // Example 1: Single Company Verification
        console.log('📝 Example 1: Single Company Verification');
        console.log('-'.repeat(50));
        console.log('Testing with Apple Inc...\n');
        
        const singleResult = await getGLEIFOptimSingleCompanyVerificationWithSignUtils('Apple Inc.');
        console.log('✅ Single company verification completed successfully!\n');

        // Example 2: Multi-Company Verification
        console.log('📝 Example 2: Multi-Company Verification');
        console.log('-'.repeat(50));
        console.log('Testing with Apple Inc. and Microsoft Corporation...\n');
        
        const companies = ['Apple Inc.', 'Microsoft Corporation'];
        const multiResult = await getGLEIFOptimMultiCompanyVerificationWithSignUtils(companies);
        
        console.log('✅ Multi-company verification completed successfully!\n');

        // Example 3: Compare Results
        console.log('📝 Example 3: Results Comparison');
        console.log('-'.repeat(50));
        
        console.log('🏢 Single Company Contract Results:');
        console.log('   • Contract tracks one specific company');
        console.log('   • Focused on individual company compliance history');
        console.log('   • Optimized for repeated verifications of same entity');
        console.log('   • LEI identity is locked after first verification\n');
        
        console.log('🏢 Multi-Company Contract Results:');
        console.log(`   • Total companies processed: ${multiResult.verificationResults.length}`);
        console.log(`   • Successful verifications: ${multiResult.verificationResults.filter(r => !r.error).length}`);
        console.log(`   • Compliant companies: ${multiResult.verificationResults.filter(r => r.isCompliant).length}`);
        console.log(`   • Companies tracked in registry: ${multiResult.totalCompanies}`);
        console.log(`   • Global compliance calculated: Yes`);
        console.log(`   • Merkle tree storage: Enabled\n`);

        // Example 4: Use Case Scenarios
        console.log('📝 Example 4: Use Case Scenarios');
        console.log('-'.repeat(50));
        
        console.log('🎯 Single Company Contract - Best for:');
        console.log('   • KYC verification of a specific business partner');
        console.log('   • Continuous monitoring of one entity\'s compliance');
        console.log('   • Dedicated compliance tracking per relationship');
        console.log('   • Identity verification with history preservation\n');
        
        console.log('🎯 Multi-Company Contract - Best for:');
        console.log('   • Portfolio compliance monitoring');
        console.log('   • Bulk verification of multiple entities');
        console.log('   • Regulatory reporting across entity groups');
        console.log('   • Global compliance score calculations');
        console.log('   • Supply chain verification');
        console.log('   • Investment fund compliance tracking\n');

        // Example 5: Smart Contract State Analysis
        console.log('📝 Example 5: Smart Contract State Analysis');
        console.log('-'.repeat(50));
        
        const contractState = multiResult.contractState;
        const globalStats = multiResult.globalStats;
        
        console.log('📊 Multi-Company Contract State:');
        console.log(`   • Companies Root Hash: ${contractState.companiesRootHash.toString()}`);
        console.log(`   • Total Companies Tracked: ${contractState.totalCompaniesTracked.toString()}`);
        console.log(`   • Compliant Companies Count: ${contractState.compliantCompaniesCount.toString()}`);
        console.log(`   • Global Compliance Score: ${contractState.globalComplianceScore.toString()}`);
        console.log(`   • Total Verifications: ${contractState.totalVerificationsGlobal.toString()}`);
        console.log(`   • Registry Version: ${contractState.registryVersion.toString()}\n`);
        
        console.log('📈 Global Compliance Statistics:');
        console.log(`   • Total Companies: ${globalStats.totalCompanies.toString()}`);
        console.log(`   • Compliant Companies: ${globalStats.compliantCompanies.toString()}`);
        console.log(`   • Compliance Percentage: ${globalStats.compliancePercentage.toString()}%`);
        console.log(`   • Total Verifications: ${globalStats.totalVerifications.toString()}`);
        
        if (globalStats.lastVerificationTime.toString() !== '0') {
            const lastVerification = new Date(Number(globalStats.lastVerificationTime.toString()));
            console.log(`   • Last Verification: ${lastVerification.toISOString()}`);
        }

        console.log('\n🎉 All examples completed successfully!');
        console.log('\n💡 Next Steps:');
        console.log('   • Test with more companies using comma-separated names');
        console.log('   • Experiment with different network types (TESTNET/MAINNET)');
        console.log('   • Integrate into your existing compliance workflows');
        console.log('   • Build custom dashboards using the contract state data');

    } catch (error) {
        console.error('❌ Error running examples:', error);
        console.error('Stack trace:', (error as Error).stack);
        throw error;
    }
}

// Main execution
async function main() {
    console.log('🚀 Starting GLEIF Verification Examples...\n');
    
    try {
        await runExamples();
    } catch (error) {
        console.error('💥 Fatal error in examples:', error);
        process.exit(1);
    }
}

// Only run if this file is executed directly (CommonJS style for compatibility)
if (require.main === module) {
    main().catch(err => {
        console.error('💥 Unhandled error:', err);
        process.exit(1);
    });
}

export { runExamples };
