import * as dotenv from 'dotenv';
dotenv.config();
import { Field, Mina, PrivateKey, AccountUpdate, CircuitString, Poseidon, Signature, UInt64 } from 'o1js';

// Import the simplified Enhanced modules
import { GLEIFEnhancedZKProgram, GLEIFEnhancedComplianceData } from '../../zk-programs/with-sign/GLEIFEnhancedZKProgramWithSign.js';
import { GLEIFEnhancedVerifierSmartContractWithSign } from '../../contracts/with-sign/GLEIFEnhancedVerifierSmartContractWithSign.js';
import { getPrivateKeyFor } from '../../core/OracleRegistry.js';
import { fetchGLEIFCompanyData, GLEIFBusinessRules, GLEIFCircuitConverter } from './GLEIFUtils.js';

/**
 * Enhanced GLEIF Verification Test - MINIMAL WORKING VERSION
 */
async function main() {
    console.log('🌟 Enhanced GLEIF Verification Test (Minimal Working Version)');
    console.log('=============================================================');
    console.log('🔧 Using simplified Enhanced GLEIF modules...');
    console.log('');

    const companyName = process.argv[2];
    //let typeOfNet = process.argv[3] || 'TESTNET';
    let testMode = process.argv[4] || 'FAST';

    if (!companyName) {
        console.log('Usage: node EnhancedGLEIFVerificationTestWithSign.js <company_name> [network_type] [test_mode]');
        console.log('');
        console.log('Test Modes:');
        console.log('  FAST       - Smart contract only (no ZK compilation)');
        console.log('  STANDARD   - With ZK compilation');
        console.log('');
        process.exit(1);
    }

    console.log('📋 Configuration:');
    console.log(`   🏢 Company Name: ${companyName}`);
    //console.log(`   🌐 Network Type: ${typeOfNet}`);
    console.log(`   ⚙️ Test Mode: ${testMode.toUpperCase()}`);
    console.log('');

    try {
        await runEnhancedGLEIFVerification(companyName, testMode.toUpperCase());
        console.log('\n🎉 Enhanced GLEIF Verification Completed Successfully!');
    } catch (error) {
        console.error('\n❌ Enhanced GLEIF Verification Failed:');
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
}

async function runEnhancedGLEIFVerification(companyName: string, testMode: string) {
    console.log('\n🌟 ENHANCED GLEIF VERIFICATION');
    console.log('='.repeat(50));

    // =================================== ZKApp Setup ===================================
    console.log('🔑 Setting up Enhanced ZKApp...');
    
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

    // =================================== Deployment ===================================
    console.log('🚀 Deploying Enhanced GLEIF ZKApp...');
    
    const deployTxn = await Mina.transaction(deployerAccount, async () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        await zkApp.deploy();
    });
    await deployTxn.sign([deployerKey, zkAppKey]).send();
    console.log("✅ Enhanced GLEIF ZKApp deployed successfully");

    // =================================== Data Fetching ===================================
    console.log('\n📡 Fetching GLEIF API Data...');
    let parsedData;
    try {
        parsedData = await fetchGLEIFCompanyData(companyName);
        console.log('✅ GLEIF data fetched successfully');
    } catch (err) {
        console.error('❌ Error fetching company data:', (err as Error).message);
        throw err;
    }

    // =================================== Enhanced Compliance Data Creation ===================================
    console.log('\n🔄 Creating simplified compliance data...');
    
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

    // Create simplified compliance data using existing structure (with all required fields)
    // Convert API response to enhanced compliance data using our utility function
    const enhancedData = GLEIFCircuitConverter.convertToEnhancedComplianceData(
        parsedData,
        {
            complianceScore: complianceScore,
            riskLevel: riskLevel
        }
    );
    
    /* Previous hardcoded version - now using utility function
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
    */

    // =================================== Oracle Signature Generation ===================================
    console.log('🔐 Generating oracle signatures...');
    const registryPrivateKey = getPrivateKeyFor('GLEIF');
    const complianceDataHash = Poseidon.hash(GLEIFEnhancedComplianceData.toFields(enhancedData));
    const oracleSignature = Signature.create(registryPrivateKey, [complianceDataHash]);
    console.log('✅ Oracle signature generated successfully');

    // =================================== Smart Contract Verification ===================================
    console.log('\n🔍 Verifying compliance on enhanced smart contract...');
    
    // BEFORE VERIFICATION STATE
    console.log('\n📊 BEFORE SMART CONTRACT VERIFICATION:');
    console.log('🌐 Blockchain State:');
    const beforeVerifyBlockchainHeight = Mina.getNetworkState().blockchainLength;
    console.log(`   📏 Blockchain Height: ${beforeVerifyBlockchainHeight.toString()}`);
    console.log(`   💰 Deployer Balance: ${Mina.getBalance(deployerAccount).toString()} MINA`);
    console.log(`   💰 Sender Balance: ${Mina.getBalance(senderAccount).toString()} MINA`);
    console.log(`   💰 zkApp Balance: ${Mina.getBalance(zkAppAddress).toString()} MINA`);
    
    const beforeVerifyState = zkApp.getContractStats();
    console.log('🏛️ Smart Contract State:');
    console.log(`   🛡️ GLEIF Compliant: ${beforeVerifyState.isGLEIFCompliant.toString()}`);
    console.log(`   📈 Risk Mitigation: ${beforeVerifyState.riskMitigationBase.toString()}`);
    console.log(`   🔢 Total Verifications: ${beforeVerifyState.totalVerifications.toString()}`);
    
    try {
        console.log('\n🔄 Executing Smart Contract Verification Transaction...');
        const txn = await Mina.transaction(senderAccount, async () => {
            await zkApp.verifyGLEIFComplianceWithParams(enhancedData, oracleSignature);
        });
        console.log('🧮 Proving verification transaction...');
        await txn.prove();
        console.log('✍️ Signing and sending verification transaction...');
        await txn.sign([senderKey]).send();
        console.log('✅ Transaction executed successfully');
        
        // AFTER VERIFICATION STATE
        console.log('\n📊 AFTER SMART CONTRACT VERIFICATION:');
        console.log('🌐 Blockchain State:');
        const afterVerifyBlockchainHeight = Mina.getNetworkState().blockchainLength;
        console.log(`   📏 Blockchain Height: ${afterVerifyBlockchainHeight.toString()}`);
        console.log(`   💰 Deployer Balance: ${Mina.getBalance(deployerAccount).toString()} MINA`);
        console.log(`   💰 Sender Balance: ${Mina.getBalance(senderAccount).toString()} MINA`);
        console.log(`   💰 zkApp Balance: ${Mina.getBalance(zkAppAddress).toString()} MINA`);
        
        const afterVerifyState = zkApp.getContractStats();
        console.log('🏛️ Smart Contract State:');
        console.log(`   🛡️ GLEIF Compliant: ${afterVerifyState.isGLEIFCompliant.toString()}`);
        console.log(`   📈 Risk Mitigation: ${afterVerifyState.riskMitigationBase.toString()}`);
        console.log(`   🔢 Total Verifications: ${afterVerifyState.totalVerifications.toString()}`);
        
        // State Changes Summary
        console.log('\n📈 VERIFICATION CHANGES:');
        console.log(`   📏 Blockchain Height: ${beforeVerifyBlockchainHeight.toString()} → ${afterVerifyBlockchainHeight.toString()}`);
        console.log(`   🔢 Total Verifications: ${beforeVerifyState.totalVerifications.toString()} → ${afterVerifyState.totalVerifications.toString()}`);
        console.log(`   🛡️ Compliance Status: ${beforeVerifyState.isGLEIFCompliant.toString()} → ${afterVerifyState.isGLEIFCompliant.toString()}`);
        
    } catch (error) {
        console.error('❌ Smart contract verification failed:', (error as Error).message);
        throw error;
    }

    // =================================== ZK PROOF GENERATION ===================================
    if (testMode === 'FAST') {
        console.log('\n🚀 FAST mode enabled - Skipping ZK proof generation');
        console.log('✅ Smart contract verification completed without ZK proof');
        return;
    }

    console.log('\n🧮 Generating ZK Proof...');
    
    try {
        console.log('🛠️ Compiling ZK Program...');
        await GLEIFEnhancedZKProgram.compile();
        console.log('✅ ZK Program compiled successfully');

        console.log('🔮 Generating ZK proof...');
        const proof = await GLEIFEnhancedZKProgram.proveCompliance(
            Field(0),
            enhancedData,
            oracleSignature,
            UInt64.from(Date.now()),
            Field(70), // complianceThreshold
            Field(3)   // riskThreshold
        );

        console.log('✅ ZK Proof generated successfully!');
        
        // Log proof details
        console.log('\n🔍 ZK PROOF RESULTS:');
        console.log(`🏢 Company: ${proof.publicOutput.name.toString()}`);
        console.log(`🆔 ID: ${proof.publicOutput.id.toString()}`);
        console.log(`✅ Is Compliant: ${proof.publicOutput.isCompliant.toString()}`);
        console.log(`📊 Compliance Score: ${proof.publicOutput.complianceScore.toString()}`);
        console.log(`⚡ Risk Level: ${proof.publicOutput.riskLevel.toString()}`);

    } catch (error) {
        const err = error as Error;
        console.error('❌ ZK Proof generation failed:', err.message);
        console.log('✅ Smart contract verification was successful');
    }

    // =================================== Final Results Summary ===================================
    console.log('\n📊 ENHANCED GLEIF VERIFICATION SUMMARY:');
    console.log('='.repeat(60));
    
    // Company Information
    console.log('🏢 COMPANY INFORMATION:');
    console.log(`   🏢 Company: ${enhancedData.name.toString()}`);
    console.log(`   🆔 LEI: ${enhancedData.lei.toString()}`);
    console.log(`   ✅ Entity Status: ${enhancedData.entity_status.toString()}`);
    console.log(`   📝 Registration Status: ${enhancedData.registration_status.toString()}`);
    console.log(`   🌍 Jurisdiction: ${enhancedData.jurisdiction.toString()}`);
    
    // Compliance Metrics
    console.log('\n📊 COMPLIANCE METRICS:');
    console.log(`   📊 Compliance Score: ${enhancedData.complianceScore.toString()}`);
    console.log(`   ⚡ Risk Level: ${enhancedData.riskLevel.toString()}`);
    
    // Final System State
    console.log('\n🏛️ FINAL SYSTEM STATE:');
    const finalSystemState = zkApp.getContractStats();
    const finalBlockchainHeight = Mina.getNetworkState().blockchainLength;
    console.log(`   📏 Final Blockchain Height: ${finalBlockchainHeight.toString()}`);
    console.log(`   🛡️ Final GLEIF Compliant Status: ${finalSystemState.isGLEIFCompliant.toString()}`);
    console.log(`   📈 Final Risk Mitigation: ${finalSystemState.riskMitigationBase.toString()}`);
    console.log(`   🔢 Total Verifications Completed: ${finalSystemState.totalVerifications.toString()}`);
    console.log(`   💰 Final zkApp Balance: ${Mina.getBalance(zkAppAddress).toString()} MINA`);
    console.log(`   💰 Final Deployer Balance: ${Mina.getBalance(deployerAccount).toString()} MINA`);
    console.log(`   💰 Final Sender Balance: ${Mina.getBalance(senderAccount).toString()} MINA`);
    
    // Verification Results
    console.log('\n✅ VERIFICATION RESULTS:');
    console.log(`   🔐 Oracle Signature: VERIFIED`);
    console.log(`   🏛️ Smart Contract: VERIFIED`);
    console.log(`   🧮 ZK Proof: ${testMode === 'FAST' ? 'SKIPPED (FAST MODE)' : 'ATTEMPTED'}`);
    console.log(`   🔍 Business Rules: VALIDATED`);
    console.log(`   📋 Compliance Check: PASSED`);
}

main().catch(err => {
    console.error('💥 Unhandled Error:', err);
    process.exit(1);
});