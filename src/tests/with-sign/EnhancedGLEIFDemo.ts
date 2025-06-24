import * as dotenv from 'dotenv';
dotenv.config();

import { analyzeGLEIFCompanyData } from './GLEIFUtilsDetailed.js';
import { GLEIFStructuredMerkleTree } from './GLEIFStructuredMerkleTree.js';
import { fetchGLEIFCompanyData } from './GLEIFUtils.js';

/**
 * Enhanced GLEIF analysis and optimization demo
 */
async function demonstrateEnhancedGLEIFAnalysis(companyName: string) {
  console.log('🚀 ENHANCED GLEIF ANALYSIS & ZK OPTIMIZATION DEMO');
  console.log('=' .repeat(80));
  console.log(`📋 Company: ${companyName}`);
  //console.log(`🌐 Network: ${typeOfNet}`);

  try {
    // Step 1: Complete JSON structure analysis
    console.log('\n📊 STEP 1: COMPLETE JSON STRUCTURE ANALYSIS');
    console.log('-' .repeat(50));
    await analyzeGLEIFCompanyData(companyName);

    // Step 2: Fetch data for Merkle tree construction
    console.log('\n🌳 STEP 2: STRUCTURED MERKLE TREE CONSTRUCTION');
    console.log('-' .repeat(50));
    const gleifData = await fetchGLEIFCompanyData(companyName);
    
    // Step 3: Build optimized Merkle tree using JSON structure groupings
    const structuredTree = new GLEIFStructuredMerkleTree(gleifData);
    
    // Step 4: Analyze optimization benefits
    const optimization = structuredTree.getOptimizationAnalysis();
    
    console.log('\n⚡ STEP 3: OPTIMIZATION ANALYSIS');
    console.log('-' .repeat(50));
    console.log(`📊 Optimization Results:`);
    console.log(`   Total Field Groups: ${optimization.totalGroups}`);
    console.log(`   Individual Fields: ${optimization.individualFields}`);  
    console.log(`   Bundled Groups: ${optimization.bundledFields}`);
    console.log(`   Estimated Total Fields Represented: ${optimization.estimatedFieldsInBundles}`);
    console.log('');
    console.log(`💰 Constraint Cost Analysis:`);
    console.log(`   All Fields (Naive): ${optimization.estimatedFieldsInBundles * (960 + 1046)} constraints`);
    console.log(`   Optimized (All Groups): ${optimization.constraintCostAll} constraints`);
    console.log(`   Core Compliance Only: ${optimization.constraintCostCore} constraints`);
    console.log(`   Core + Address Info: ${optimization.constraintCostWithAddress} constraints`);
    console.log('');
    console.log(`🎯 Efficiency Gain:`);
    const naiveCost = optimization.estimatedFieldsInBundles * (960 + 1046);
    const optimizedCost = optimization.constraintCostAll;
    const savings = ((naiveCost - optimizedCost) / naiveCost * 100).toFixed(1);
    console.log(`   Constraint Reduction: ${savings}% (${naiveCost - optimizedCost} constraints saved)`);

    // Step 5: Demonstrate different verification scenarios
    console.log('\n🎭 STEP 4: VERIFICATION SCENARIO DEMONSTRATIONS');
    console.log('-' .repeat(50));
    
    console.log('\n🔍 Available Field Groups:');
    const availableFields = structuredTree.getAvailableFields();
    availableFields.forEach((field, index) => {
      console.log(`   ${index + 1}. ${field}`);
    });

    console.log('\n📋 Fields by Category:');
    const categories = ['core_identity', 'address_info', 'business_metadata', 'registration_info'];
    categories.forEach(category => {
      const categoryFields = structuredTree.getFieldsByCategory(category);
      if (categoryFields.length > 0) {
        console.log(`   ${category.toUpperCase()}: ${categoryFields.join(', ')}`);
      }
    });

    // Scenario demonstrations
    console.log('\n🎯 VERIFICATION SCENARIOS:');
    
    console.log('\n   📝 Scenario 1: Basic KYC (Core Identity Only)');
    const basicKYCFields = structuredTree.getFieldsByCategory('core_identity');
    const basicKYCCost = basicKYCFields.length * (960 + 1046);
    console.log(`      Fields: ${basicKYCFields.join(', ')}`);
    console.log(`      Constraint Cost: ${basicKYCCost}`);
    console.log(`      Use Case: 90% of verifications`);

    console.log('\n   📝 Scenario 2: Enhanced KYC (Core + Address)');
    const enhancedKYCFields = [
      ...structuredTree.getFieldsByCategory('core_identity'),
      ...structuredTree.getFieldsByCategory('address_info')
    ];
    const enhancedKYCCost = enhancedKYCFields.length * (960 + 1046);
    console.log(`      Fields: ${enhancedKYCFields.join(', ')}`);
    console.log(`      Constraint Cost: ${enhancedKYCCost}`);
    console.log(`      Use Case: Enhanced due diligence`);

    console.log('\n   📝 Scenario 3: Full Compliance (All Available Data)');
    const fullComplianceFields = structuredTree.getAvailableFields();
    const fullComplianceCost = fullComplianceFields.length * (960 + 1046);
    console.log(`      Fields: ${fullComplianceFields.length} field groups`);
    console.log(`      Constraint Cost: ${fullComplianceCost}`);
    console.log(`      Use Case: Regulatory reporting`);

    // Step 6: Show sample field contents
    console.log('\n📄 STEP 5: SAMPLE FIELD CONTENTS');
    console.log('-' .repeat(50));
    
    console.log('\n🔍 Core Identity Fields:');
    const coreFields = structuredTree.getFieldsByCategory('core_identity');
    coreFields.slice(0, 3).forEach(fieldName => {
      try {
        const value = structuredTree.getFieldAsCircuitString(fieldName).toString();
        const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;
        console.log(`   ${fieldName}: "${displayValue}"`);
      } catch (error) {
        console.log(`   ${fieldName}: [Error reading field]`);
      }
    });

    console.log('\n🏠 Address Bundle Sample:');
    const addressFields = structuredTree.getFieldsByCategory('address_info');
    if (addressFields.length > 0) {
      try {
        const addressValue = structuredTree.getFieldAsCircuitString(addressFields[0]).toString();
        console.log(`   ${addressFields[0]}:`);
        const components = addressValue.split('|');
        components.slice(0, 5).forEach(component => {
          console.log(`      • ${component}`);
        });
        if (components.length > 5) {
          console.log(`      • ... and ${components.length - 5} more components`);
        }
      } catch (error) {
        console.log(`   ${addressFields[0]}: [Error reading field]`);
      }
    }

    console.log('\n✅ Enhanced GLEIF Analysis Complete!');
    console.log('\n🎯 KEY INSIGHTS:');
    console.log(`   • JSON structure groupings enable efficient ZK optimization`);
    console.log(`   • ${savings}% constraint reduction vs naive approach`);
    console.log(`   • Support for ${optimization.estimatedFieldsInBundles} total fields in ${optimization.totalGroups} optimized groups`);
    console.log(`   • Flexible verification scenarios from basic KYC to full compliance`);

  } catch (error) {
    console.error('❌ Error during enhanced analysis:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const companyName = process.argv[2];
  //const typeOfNet = process.argv[3] || 'TESTNET';

  if (!companyName) {
    console.error('❌ Please provide a company name');
    console.log('Usage: node EnhancedGLEIFDemo.js "Company Name" [TESTNET|LOCAL|PROD]');
    console.log('');
    console.log('Example: node EnhancedGLEIFDemo.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED" "TESTNET"');
    process.exit(1);
  }

  await demonstrateEnhancedGLEIFAnalysis(companyName);
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

export { demonstrateEnhancedGLEIFAnalysis };
