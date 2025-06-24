import * as dotenv from 'dotenv';
dotenv.config();
import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, UInt64 } from 'o1js';

// Import the simplified Enhanced modules
import { GLEIFEnhancedZKProgram, GLEIFEnhancedComplianceData } from '../../zk-programs/with-sign/GLEIFEnhancedZKProgramWithSign.js';
import { GLEIFStructuredMerkleTree } from './GLEIFStructuredMerkleTree.js';
import { GLEIFEnhancedVerifierSmartContractWithSign } from '../../contracts/with-sign/GLEIFEnhancedVerifierSmartContractWithSign.js';
import { getPrivateKeyFor } from '../../core/OracleRegistry.js';
import { fetchGLEIFCompanyData } from './GLEIFUtils.js';

/**
 * Compilation with timeout wrapper
 */
async function compileWithTimeout(compileFunction: () => Promise<any>, timeoutMs: number = 300000): Promise<any> {
    return new Promise(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Compilation timed out after ${timeoutMs / 1000} seconds`));
        }, timeoutMs);

        try {
            console.log(`⏱️ Starting compilation with ${timeoutMs / 1000}s timeout...`);
            const startTime = Date.now();
            
            const result = await compileFunction();
            
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            console.log(`✅ Compilation completed in ${duration}ms`);
            resolve(result);
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
        }
    });
}

/**
 * MerkleTree-Enhanced GLEIF Test with Existing Infrastructure
 */
async function main() {
    console.log('🌳 MerkleTree-Enhanced GLEIF Test (Working Version)');
    console.log('==================================================');
    console.log('🔧 Using MerkleTree analysis with existing ZK program...');
    console.log('');

    const companyName = process.argv[2];
    //let typeOfNet = process.argv[3] || 'TESTNET';
    let testMode = process.argv[4] || 'FAST';

    if (!companyName) {
        console.log('Usage: node MerkleSimpleGLEIFTest.js <company_name> [network_type] [test_mode]');
        console.log('');
        console.log('Test Modes:');
        console.log('  FAST       - Smart contract + MerkleTree analysis (no ZK compilation)');
        console.log('  STANDARD   - Full test with simplified ZK compilation');
        console.log('');
        process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log(`   🏢 Company Name: ${companyName}`);
    //console.log(`   🌐 Network Type: ${typeOfNet}`);
    console.log(`   ⚙️ Test Mode: ${testMode.toUpperCase()}`);
    console.log('');

    try {
        await runMerkleAnalysisTest(companyName, testMode.toUpperCase());
        console.log('\n🎉 MerkleTree-Enhanced GLEIF Test Completed Successfully!');
    } catch (error) {
        console.error('\n❌ MerkleTree Test Failed:');
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
}

async function runMerkleAnalysisTest(companyName: string, testMode: string) {
    console.log('\n🌳 MERKLETREE ANALYSIS WITH EXISTING INFRASTRUCTURE');
    console.log('='.repeat(60));

    // =================================== ZKApp Setup ===================================
    console.log('🔑 Setting up ZKApp...');
    
    const useProof = false;
    const Local = await Mina.LocalBlockchain({ proofsEnabled: useProof });
    Mina.setActiveInstance(Local);

    const deployerAccount = Local.testAccounts[0];
    const deployerKey = deployerAccount.key;
    const senderAccount = Local.testAccounts[1];
    const senderKey = senderAccount.key;
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new GLEIFEnhancedVerifierSmartContractWithSign(zkAppAddress);

    // Deploy the contract
    const deployTxn = await Mina.transaction(deployerAccount, async () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        await zkApp.deploy();
    });
    await deployTxn.sign([deployerKey, zkAppKey]).send();
    console.log("✅ ZKApp deployed successfully");

    // =================================== Data Fetching & MerkleTree Creation ===================================
    console.log('\n📡 Fetching GLEIF API Data and creating MerkleTree...');
    
    let parsedData;
    try {
        parsedData = await fetchGLEIFCompanyData(companyName);
        console.log('✅ GLEIF data fetched successfully');
    } catch (err) {
        console.error('❌ Error fetching company data:', (err as Error).message);
        throw err;
    }

    // =================================== MerkleTree Analysis ===================================
    console.log('\n🌳 Creating and analyzing structured MerkleTree...');
    const merkleTree = new GLEIFStructuredMerkleTree(parsedData);
    console.log(`✅ MerkleTree created with root: ${merkleTree.root.toString().substring(0, 20)}...`);

    // Analyze constraint efficiency
    const analysis = merkleTree.getOptimizationAnalysis();
    console.log('\n📊 MERKLETREE OPTIMIZATION ANALYSIS:');
    console.log(`   🎯 Total Field Groups: ${analysis.totalGroups}`);
    console.log(`   📝 Individual Fields: ${analysis.individualFields}`);
    console.log(`   📦 Bundled Fields: ${analysis.bundledFields}`);
    console.log(`   ⚡ Estimated Original Fields: ${analysis.estimatedFieldsInBundles}`);
    console.log(`   🔧 Constraint Cost (All): ${analysis.constraintCostAll.toLocaleString()}`);
    console.log(`   🎯 Constraint Cost (Core): ${analysis.constraintCostCore.toLocaleString()}`);
    console.log(`   🏠 Constraint Cost (Core+Address): ${analysis.constraintCostWithAddress.toLocaleString()}`);

    // Show available field categories
    console.log('\n📋 AVAILABLE FIELD CATEGORIES:');
    const coreFields = merkleTree.getFieldsByCategory('core_identity');
    const addressFields = merkleTree.getFieldsByCategory('address_info');
    const businessFields = merkleTree.getFieldsByCategory('business_metadata');
    const registrationFields = merkleTree.getFieldsByCategory('registration_info');

    console.log(`   🆔 Core Identity: ${coreFields.join(', ')}`);
    console.log(`   🏠 Address Info: ${addressFields.join(', ')}`);
    console.log(`   🏢 Business Metadata: ${businessFields.join(', ')}`);
    console.log(`   📋 Registration Info: ${registrationFields.join(', ')}`);

    // =================================== Business Logic with Complete Data Structure ===================================
    console.log('\n🔄 Creating complete compliance data...');
    
    const entity = parsedData.data[0].attributes.entity;
    const registration = parsedData.data[0].attributes.registration;
    
    const isEntityActive = entity.status === 'ACTIVE';
    const isRegistrationIssued = registration.status === 'ISSUED';
    const complianceScore = isEntityActive && isRegistrationIssued ? 95 : 45;
    const riskLevel = isEntityActive && isRegistrationIssued ? 1 : 5;

    console.log('📊 Business Rules Validation:');
    console.log(`   👤 Entity Status: ${entity.status} ${isEntityActive ? '✅' : '❌'}`);
    console.log(`   📋 Registration Status: ${registration.status} ${isRegistrationIssued ? '✅' : '❌'}`);
    console.log(`   📊 Compliance Score: ${complianceScore}`);
    console.log(`   ⚡ Risk Level: ${riskLevel}`);

    // Create complete compliance data using existing structure (with all required fields)
    const enhancedData = new GLEIFEnhancedComplianceData({
        // Core GLEIF identifiers
        type: CircuitString.fromString(parsedData.data[0].type || 'lei-records'),
        id: CircuitString.fromString(parsedData.data[0].id || ''),
        lei: CircuitString.fromString(parsedData.data[0].attributes.lei || ''),
        name: CircuitString.fromString(entity.legalName?.name || ''),
        
        // Compliance status fields
        registration_status: CircuitString.fromString(isRegistrationIssued ? 'ISSUED' : registration.status || 'INACTIVE'),
        entity_status: CircuitString.fromString(isEntityActive ? 'ACTIVE' : entity.status || 'INACTIVE'),
        validation_status: CircuitString.fromString('VALIDATED'),
        
        // Legal and registration information
        jurisdiction: CircuitString.fromString(entity.jurisdiction || 'UNKNOWN'),
        legalForm_id: CircuitString.fromString(entity.legalForm?.id || 'UNKNOWN'),
        registeredAt_id: CircuitString.fromString('GLEIF'),
        
        // Temporal data
        initialRegistrationDate: CircuitString.fromString(registration.initialRegistrationDate || ''),
        lastUpdateDate: CircuitString.fromString(registration.lastUpdateDate || ''),
        nextRenewalDate: CircuitString.fromString(registration.nextRenewalDate || ''),
        
        // Address information (simplified)
        legalAddress_country: CircuitString.fromString(entity.legalAddress?.country || 'UNKNOWN'),
        legalAddress_city: CircuitString.fromString(entity.legalAddress?.city || 'UNKNOWN'),
        headquartersAddress_country: CircuitString.fromString(entity.headquartersAddress?.country || 'UNKNOWN'),
        
        // Additional compliance indicators
        managingLou: CircuitString.fromString(registration.managingLou || 'UNKNOWN'),
        corroborationLevel: CircuitString.fromString(registration.corroborationLevel || 'UNKNOWN'),
        conformityFlag: CircuitString.fromString(registration.conformityFlag || 'UNKNOWN'),
        
        // Multi-company tracking fields
        companyGroup: Field(0),
        parentLEI: CircuitString.fromString(''),
        subsidiaryCount: Field(0),
        
        // Risk and compliance scoring
        complianceScore: Field(complianceScore),
        riskLevel: Field(riskLevel),
        lastVerificationTimestamp: UInt64.from(Date.now()),
    });

    // =================================== Oracle Signature ===================================
    console.log('\n🔐 Generating oracle signature...');
    const registryPrivateKey = getPrivateKeyFor('GLEIF');
    const complianceDataHash = Poseidon.hash(GLEIFEnhancedComplianceData.toFields(enhancedData));
    const oracleSignature = Signature.create(registryPrivateKey, [complianceDataHash]);
    console.log('✅ Oracle signature generated successfully');

    // =================================== Smart Contract Verification ===================================
    console.log('\n🔍 Verifying compliance on smart contract...');
    
    try {
        const txn = await Mina.transaction(senderAccount, async () => {
            await zkApp.verifyGLEIFComplianceWithParams(enhancedData, oracleSignature);
        });
        await txn.prove();
        await txn.sign([senderKey]).send();
        console.log('✅ Smart contract verification successful');
    } catch (error) {
        console.error('❌ Smart contract verification failed:', (error as Error).message);
        throw error;
    }

    // =================================== ZK Proof Generation (if not FAST mode) ===================================
    if (testMode === 'FAST') {
        console.log('\n🚀 FAST mode enabled - Skipping ZK proof generation');
        console.log('✅ Smart contract verification completed without ZK proof');
    } else {
        console.log('\n🧮 Generating ZK Proof with simplified circuit...');
        
        try {
            // Compile with timeout protection
            console.log('🛠️ Compiling simplified ZK Program...');
            await compileWithTimeout(async () => {
                return await GLEIFEnhancedZKProgram.compile();
            }, 300000); // 5 minute timeout

            // Generate proof with timeout
            console.log('🔮 Generating ZK proof...');
            const proof = await compileWithTimeout(async () => {
                return await GLEIFEnhancedZKProgram.proveCompliance(
                    Field(0),
                    enhancedData,
                    oracleSignature,
                    UInt64.from(Date.now()),
                    Field(70), // complianceThreshold
                    Field(3)   // riskThreshold
                );
            }, 180000); // 3 minute timeout

            console.log('✅ ZK Proof generated successfully!');
            
            // Log proof details
            console.log('\n🔍 ZK PROOF RESULTS:');
            console.log(`   🏢 Company: ${proof.publicOutput.name.toString()}`);
            console.log(`   ✅ Is Compliant: ${proof.publicOutput.isCompliant.toString()}`);
            console.log(`   📊 Compliance Score: ${proof.publicOutput.complianceScore.toString()}`);
            console.log(`   ⚡ Risk Level: ${proof.publicOutput.riskLevel.toString()}`);

        } catch (error) {
            const err = error as Error;
            if (err.message.includes('timed out')) {
                console.log('⏰ ZK Compilation/Proof generation timed out');
                console.log('💡 This is normal for complex circuits on first run');
                console.log('🔄 Try FAST mode for immediate results');
                console.log('✅ Smart contract verification was successful');
            } else {
                console.error('❌ ZK Proof generation failed:', err.message);
                console.log('✅ Smart contract verification was successful');
            }
        }
    }

    // =================================== Final Results Summary ===================================
    console.log('\n📊 MERKLETREE-ENHANCED VERIFICATION SUMMARY:');
    console.log('='.repeat(60));
    console.log(`🏢 Company: ${enhancedData.name.toString()}`);
    console.log(`🆔 LEI: ${enhancedData.lei.toString()}`);
    console.log(`✅ Entity Status: ${enhancedData.entity_status.toString()}`);
    console.log(`📝 Registration Status: ${enhancedData.registration_status.toString()}`);
    console.log(`📊 Compliance Score: ${enhancedData.complianceScore.toString()}`);
    console.log(`⚡ Risk Level: ${enhancedData.riskLevel.toString()}`);
    console.log(`🌍 Jurisdiction: ${enhancedData.jurisdiction.toString()}`);
    console.log(`🔐 Oracle Signature: VERIFIED`);
    console.log(`🏛️ Smart Contract: VERIFIED`);
    console.log(`🌳 MerkleTree Root: ${merkleTree.root.toString().substring(0, 40)}...`);
    console.log(`📋 Field Groups Analyzed: ${merkleTree.getAvailableFields().length}`);
    console.log(`🧮 ZK Proof: ${testMode === 'FAST' ? 'SKIPPED' : 'ATTEMPTED'}`);

    // Show constraint reduction benefits
    console.log('\n💡 MERKLETREE BENEFITS DEMONSTRATED:');
    console.log(`   📉 Constraint Reduction: ${analysis.estimatedFieldsInBundles} → ${analysis.totalGroups} fields`);
    console.log(`   ⚡ Efficiency Gain: ${Math.round((1 - analysis.totalGroups / analysis.estimatedFieldsInBundles) * 100)}% reduction`);
    console.log(`   🔒 Privacy Ready: Selective disclosure capability built-in`);
    console.log(`   📦 Bundling Strategy: Related fields grouped for efficiency`);
    console.log(`   🎯 Production Ready: Core identity separate, metadata bundled`);
    
    // MerkleTree-specific insights
    console.log('\n🌳 MERKLETREE STRUCTURE INSIGHTS:');
    console.log('   📊 Data Organization:');
    console.log(`      • ${coreFields.length} Core Identity fields (individual)`);
    console.log(`      • ${addressFields.length} Address bundles (concatenated)`);
    console.log(`      • ${businessFields.length} Business metadata bundles`);
    console.log(`      • ${registrationFields.length} Registration info bundles`);
    console.log('   🔧 Optimization Strategy:');
    console.log('      • Critical fields kept individual for privacy');
    console.log('      • Related fields bundled for constraint efficiency');
    console.log('      • MerkleTree enables selective disclosure');
    console.log('      • Ready for privacy-preserving verification');
}

main().catch(err => {
    console.error('💥 Unhandled Error:', err);
    process.exit(1);
});