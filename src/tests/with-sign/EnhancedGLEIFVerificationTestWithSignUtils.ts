import * as dotenv from 'dotenv';
dotenv.config();

import { 
   Field, 
   Mina, 
   PrivateKey, 
   AccountUpdate, 
   CircuitString, 
   Poseidon, 
   Signature, 
   UInt64,
   Bool
} from 'o1js';

import { 
   GLEIFEnhancedZKProgram,
   GLEIFEnhancedComplianceData,
   GLEIFEnhancedUtils
} from '../../zk-programs/with-sign/GLEIFEnhancedZKProgramWithSign.js';

import { 
   GLEIFEnhancedVerifierSmartContractWithSign 
} from '../../contracts/with-sign/GLEIFEnhancedVerifierSmartContractWithSign.js';

import { 
   GLEIFdeployerAccount, 
   GLEIFsenderAccount, 
   GLEIFdeployerKey, 
   GLEIFsenderKey, 
   getPrivateKeyFor 
} from '../../core/OracleRegistry.js';

import { fetchGLEIFCompanyData, fetchGLEIFFullStructure } from './GLEIFUtils.js';

/**
 * Enhanced GLEIF Verification with comprehensive compliance checking
 * Implements your specific business rules:
 * 1. Entity Status = "ACTIVE"
 * 2. Current Date Within Valid Period (currentDate >= lastUpdateDate AND currentDate <= nextRenewalDate)
 * 3. Registration Status = "ISSUED"
 * 4. Conformity Flag ≠ "NON_CONFORMING"
 */
export async function getEnhancedGLEIFVerificationWithSignUtils(
   companyName: string,
   verificationMode: 'standard' | 'group' | 'historical' = 'standard',
   secondaryCompanyName?: string,
   historicalDays?: number
) {
   console.log('\n🌟 ENHANCED GLEIF VERIFICATION WITH BUSINESS RULES');
   console.log('='.repeat(70));
   console.log('📋 FINAL BUSINESS RULES IMPLEMENTATION:');
   console.log('1. 👤 Entity Status = "ACTIVE"');
   console.log('2. 📅 Current Date Within Valid Period');
   console.log('   (currentDate >= lastUpdateDate AND currentDate <= nextRenewalDate)');
   console.log('3. 📋 Registration Status = "ISSUED"');
   console.log('4. 🔖 Conformity Flag ≠ "NON_CONFORMING"');
   console.log('='.repeat(70));
   console.log(`📋 Primary Company: ${companyName}`);
   //console.log(`🌐 Network: ${typeOfNet}`);
   console.log(`🔍 Verification Mode: ${verificationMode}`);
   
   if (verificationMode === 'group' && secondaryCompanyName) {
      console.log(`📋 Secondary Company: ${secondaryCompanyName}`);
   }
   
   if (verificationMode === 'historical' && historicalDays) {
      console.log(`📅 Historical Period: ${historicalDays} days`);
   }

   // =================================== Compilation Phase ===================================
   console.log('\n📋 Compiling Enhanced ZK Program...');
   await GLEIFEnhancedZKProgram.compile();
   
   console.log('📋 Compiling Enhanced Smart Contract...');
   const { verificationKey } = await GLEIFEnhancedVerifierSmartContractWithSign.compile();

   // =================================== ZKApp Setup ===================================
   console.log('🔑 Setting up ZKApp...');
   const zkAppKey = PrivateKey.random();
   const zkAppAddress = zkAppKey.toPublicKey();
   const zkApp = new GLEIFEnhancedVerifierSmartContractWithSign(zkAppAddress);

   // =================================== Deployment ===================================
   console.log('🚀 Deploying Enhanced GLEIF ZKApp...');
   const deployTxn = await Mina.transaction(
      GLEIFdeployerAccount,
      async () => {
         AccountUpdate.fundNewAccount(GLEIFdeployerAccount);
         await zkApp.deploy({ verificationKey });
      }
   );
   await deployTxn.sign([GLEIFdeployerKey, zkAppKey]).send();
   console.log("✅ Enhanced GLEIF ZKApp deployed successfully");

   // =================================== Data Fetching ===================================
   console.log('\n📡 Fetching FULL GLEIF API Response...');
   
   let primaryParsedData: any;
   let secondaryParsedData: any = null;
   
   try {
      // Fetch and print FULL API response
      console.log('\n🔍 FETCHING COMPLETE GLEIF API RESPONSE:');
      console.log('='.repeat(60));
      
      primaryParsedData = await fetchGLEIFFullStructure(companyName);
      
      console.log('\n📄 FULL GLEIF API RESPONSE:');
      console.log('='.repeat(60));
      console.log(JSON.stringify(primaryParsedData, null, 2));
      console.log('='.repeat(60));
      
      if (verificationMode === 'group' && secondaryCompanyName) {
         console.log('\n🔍 FETCHING SECONDARY COMPANY DATA:');
         secondaryParsedData = await fetchGLEIFFullStructure(secondaryCompanyName);
         console.log('\n📄 SECONDARY COMPANY FULL API RESPONSE:');
         console.log('='.repeat(60));
         console.log(JSON.stringify(secondaryParsedData, null, 2));
         console.log('='.repeat(60));
      }
   } catch (err: any) {
      console.error('❌ Error fetching company data:', err.message);
      process.exit(1);
   }

   // =================================== BUSINESS RULES VALIDATION ===================================
   console.log('\n🔍 APPLYING FINAL BUSINESS RULES:');
   console.log('='.repeat(60));
   
   const businessRulesResult = validateBusinessRules(primaryParsedData);
   const isGLEIFCompliant = businessRulesResult.isCompliant;
   
   console.log('\n📊 BUSINESS RULES VALIDATION RESULTS:');
   console.log('='.repeat(60));
   businessRulesResult.details.forEach(detail => {
      console.log(detail);
   });
   console.log('='.repeat(60));
   console.log(`\n🎯 FINAL GLEIF COMPLIANCE STATUS: ${isGLEIFCompliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
   console.log('='.repeat(60));

   // =================================== Smart Contract State - BEFORE ===================================
   console.log('\n📊 SMART CONTRACT STATE - BEFORE VERIFICATION:');
   console.log('='.repeat(60));
   
   // Get initial state
   const initialStats = zkApp.getContractStats();
   console.log(`   🔒 GLEIF Compliant: ${initialStats.isGLEIFCompliant.toJSON()}`);
   console.log(`   📈 Risk Mitigation Base: ${initialStats.riskMitigationBase.toString()}`);
   console.log(`   📊 Total Verifications: ${initialStats.totalVerifications.toString()}`);
   console.log(`   ⚡ Smart Contract Active: ${initialStats.smartContractActive.toJSON()}`);
   console.log('='.repeat(60));

   // =================================== Enhanced Data Processing ===================================
   console.log('\n🔄 Processing enhanced compliance data...');
   
   // Calculate dynamic compliance scores based on business rules
   const primaryComplianceScore = isGLEIFCompliant ? 95 : 45; // High score if compliant, low if not
   const primaryRiskLevel = isGLEIFCompliant ? 1 : 5; // Low risk if compliant, high if not
   
   const primaryEnhancedData = createEnhancedComplianceDataFromBusinessRules(
      primaryParsedData, 
      primaryComplianceScore, 
      primaryRiskLevel,
      isGLEIFCompliant
   );

   let secondaryEnhancedData: GLEIFEnhancedComplianceData | null = null;
   if (verificationMode === 'group' && secondaryParsedData) {
      const secondaryBusinessRules = validateBusinessRules(secondaryParsedData);
      const secondaryCompliant = secondaryBusinessRules.isCompliant;
      const secondaryComplianceScore = secondaryCompliant ? 95 : 45;
      const secondaryRiskLevel = secondaryCompliant ? 1 : 5;
      
      secondaryEnhancedData = createEnhancedComplianceDataFromBusinessRules(
         secondaryParsedData, 
         secondaryComplianceScore, 
         secondaryRiskLevel,
         secondaryCompliant
      );
      
      // Assign same group ID for group verification
      const groupId = Field(Date.now() % 1000000);
      primaryEnhancedData.companyGroup = groupId;
      secondaryEnhancedData.companyGroup = groupId;
   }

   // Display enhanced compliance data
   displayEnhancedComplianceData(primaryEnhancedData, 'Primary');
   if (secondaryEnhancedData) {
      displayEnhancedComplianceData(secondaryEnhancedData, 'Secondary');
   }

   // =================================== Oracle Signature Generation ===================================
   console.log('\n🔐 Generating oracle signatures...');
   
   const registryPrivateKey = getPrivateKeyFor('GLEIF');
   let oracleSignature: Signature;
   
   if (verificationMode === 'group' && secondaryEnhancedData) {
      const combinedDataHash = Poseidon.hash([
         ...GLEIFEnhancedComplianceData.toFields(primaryEnhancedData),
         ...GLEIFEnhancedComplianceData.toFields(secondaryEnhancedData)
      ]);
      oracleSignature = Signature.create(registryPrivateKey, [combinedDataHash]);
   } else if (verificationMode === 'historical') {
      const historicalTimestamp = UInt64.from(Date.now() - (historicalDays || 365) * 24 * 60 * 60 * 1000);
      const complianceDataHash = Poseidon.hash([
         ...GLEIFEnhancedComplianceData.toFields(primaryEnhancedData),
         historicalTimestamp.value
      ]);
      oracleSignature = Signature.create(registryPrivateKey, [complianceDataHash]);
   } else {
      const complianceDataHash = Poseidon.hash(GLEIFEnhancedComplianceData.toFields(primaryEnhancedData));
      oracleSignature = Signature.create(registryPrivateKey, [complianceDataHash]);
   }

   console.log('✅ Oracle signature generated successfully');

   // =================================== ZK Proof Generation ===================================
   console.log('\n🧮 Generating enhanced ZK proof...');
   
   let proof;
   const currentTimestamp = UInt64.from(Date.now());
   
   try {
      if (verificationMode === 'group' && secondaryEnhancedData) {
         console.log('🏢 Generating group compliance proof...');
         proof = await GLEIFEnhancedZKProgram.proveMultiCompanyCompliance(
            Field(0),
            primaryEnhancedData,
            secondaryEnhancedData,
            oracleSignature,
            currentTimestamp,
            Field(80)
         );
      } else if (verificationMode === 'historical') {
         console.log('📅 Generating historical compliance proof...');
         const historicalTimestamp = UInt64.from(Date.now() - (historicalDays || 365) * 24 * 60 * 60 * 1000);
         proof = await GLEIFEnhancedZKProgram.proveHistoricalCompliance(
            Field(0),
            primaryEnhancedData,
            oracleSignature,
            historicalTimestamp,
            currentTimestamp,
            Field(75)
         );
      } else {
         console.log('🏛️ Generating standard compliance proof...');
         proof = await GLEIFEnhancedZKProgram.proveCompliance(
            Field(0),
            primaryEnhancedData,
            oracleSignature,
            currentTimestamp,
            Field(70),
            Field(3)
         );
      }
      console.log('✅ Enhanced ZK proof generated successfully');
   } catch (error) {
      console.error('❌ Error generating ZK proof:', error);
      throw error;
   }

   // =================================== Smart Contract Verification ===================================
   console.log('\n🔍 Verifying proof on enhanced smart contract...');
   
   let txn;
   try {
      if (verificationMode === 'group' && secondaryEnhancedData) {
         // Note: Group verification method removed - using standard verification
         console.log('🏢 Group verification not available - using standard verification...');
         txn = await Mina.transaction(
            GLEIFsenderAccount,
            async () => {
               await zkApp.verifyGLEIFComplianceWithParams(
                  primaryEnhancedData,
                  oracleSignature
               );
            }
         );
      } else if (verificationMode === 'historical') {
         // Note: Historical verification method removed - using standard verification
         console.log('📅 Historical verification not available - using standard verification...');
         txn = await Mina.transaction(
            GLEIFsenderAccount,
            async () => {
               await zkApp.verifyGLEIFComplianceWithParams(
                  primaryEnhancedData,
                  oracleSignature
               );
            }
         );
      } else {
         console.log('🏛️ Executing standard verification on smart contract...');
         txn = await Mina.transaction(
            GLEIFsenderAccount,
            async () => {
               await zkApp.verifyGLEIFComplianceWithParams(
                  primaryEnhancedData,
                  oracleSignature
               );
            }
         );
      }

      await txn.prove();
      await txn.sign([GLEIFsenderKey]).send();
      console.log('✅ Transaction executed successfully');
   } catch (error) {
      console.error('❌ Error executing transaction:', error);
      throw error;
   }

   // =================================== Smart Contract State - AFTER ===================================
   console.log('\n📊 SMART CONTRACT STATE - AFTER VERIFICATION:');
   console.log('='.repeat(60));
   
   const finalStats = zkApp.getContractStats();
   console.log(`   🔒 GLEIF Compliant: ${finalStats.isGLEIFCompliant.toJSON()}`);
   console.log(`   📈 Risk Mitigation Base: ${finalStats.riskMitigationBase.toString()}`);
   console.log(`   📊 Total Verifications: ${finalStats.totalVerifications.toString()}`);
   console.log(`   ⚡ Smart Contract Active: ${finalStats.smartContractActive.toJSON()}`);
   console.log('='.repeat(60));

   // =================================== STATE CHANGE SUMMARY ===================================
   console.log('\n🔄 MINA BLOCKCHAIN STATE CHANGES:');
   console.log('='.repeat(60));
   console.log(`   📝 GLEIF Compliance Changed: ${initialStats.isGLEIFCompliant.toJSON()} → ${finalStats.isGLEIFCompliant.toJSON()}`);
   console.log(`   📊 Risk Mitigation Increased: ${initialStats.riskMitigationBase.toString()} → ${finalStats.riskMitigationBase.toString()}`);
   console.log(`   🔢 Verifications Count: ${initialStats.totalVerifications.toString()} → ${finalStats.totalVerifications.toString()}`);
   
   const riskIncrease = Number(finalStats.riskMitigationBase.toString()) - Number(initialStats.riskMitigationBase.toString());
   console.log(`   ⬆️ Risk Mitigation Increase: +${riskIncrease}`);
   console.log('='.repeat(60));
   
   console.log('\n🎉 Enhanced GLEIF Verification Complete!');
   console.log('='.repeat(60));
   
   if (proof.publicOutput) {
      console.log('📄 Verification Results:');
      console.log(`   Company: ${proof.publicOutput.name.toString()}`);
      console.log(`   LEI: ${proof.publicOutput.id.toString()}`);
      console.log(`   Is Compliant: ${proof.publicOutput.isCompliant.toJSON()}`);
      console.log(`   Compliance Score: ${proof.publicOutput.complianceScore.toString()}`);
      console.log(`   Risk Level: ${proof.publicOutput.riskLevel.toString()}`);
      console.log(`   Jurisdiction: ${proof.publicOutput.jurisdiction.toString()}`);
      
      if (verificationMode === 'group') {
         console.log(`   Group Compliant: ${proof.publicOutput.isGroupCompliant.toJSON()}`);
         console.log(`   Company Group: ${proof.publicOutput.companyGroup.toString()}`);
      }
      
      if (verificationMode === 'historical') {
         console.log(`   Historical Compliance: ${proof.publicOutput.hasHistoricalCompliance.toJSON()}`);
         console.log(`   Compliance Streak Days: ${proof.publicOutput.complianceStreakDays.toString()}`);
      }
      
      console.log(`   Regulatory Compliance: ${proof.publicOutput.regulatoryCompliance.toJSON()}`);
      console.log(`   Verification Timestamp: ${new Date(Number(proof.publicOutput.verificationTimestamp.toString())).toISOString()}`);
   }

   console.log('\n📈 Performance Metrics:');
   console.log(`   Verification Mode: ${verificationMode.toUpperCase()}`);
   console.log(`   Companies Verified: ${verificationMode === 'group' ? '2' : '1'}`);
   console.log(`   Risk Mitigation Increase: ${Number(finalStats.riskMitigationBase.toString()) - Number(initialStats.riskMitigationBase.toString())}`);
   console.log('='.repeat(60));

   return proof;
}

/**
 * Display enhanced compliance data in a formatted manner
 */
function displayEnhancedComplianceData(data: GLEIFEnhancedComplianceData, label: string) {
   console.log(`\n📊 ${label} Enhanced Compliance Data:`);
   console.log(`   Company Name: ${data.name.toString()}`);
   console.log(`   LEI: ${data.lei.toString()}`);
   console.log(`   Registration Status: ${data.registration_status.toString()}`);
   console.log(`   Entity Status: ${data.entity_status.toString()}`);
   console.log(`   Jurisdiction: ${data.jurisdiction.toString()}`);
   console.log(`   Legal Form: ${data.legalForm_id.toString()}`);
   console.log(`   Compliance Score: ${data.complianceScore.toString()}`);
   console.log(`   Risk Level: ${data.riskLevel.toString()}`);
   console.log(`   Company Group: ${data.companyGroup.toString()}`);
   console.log(`   Legal Address Country: ${data.legalAddress_country.toString()}`);
   console.log(`   HQ Address Country: ${data.headquartersAddress_country.toString()}`);
   console.log(`   Managing LOU: ${data.managingLou.toString()}`);
   console.log(`   Last Verification: ${new Date(Number(data.lastVerificationTimestamp.toString())).toISOString()}`);
}

/**
 * Validate your specific business rules for GLEIF compliance
 */
function validateBusinessRules(parsedData: any): { isCompliant: boolean, details: string[] } {
   const details: string[] = [];
   let isCompliant = true;
   
   try {
      const record = parsedData.data[0];
      const entity = record.attributes.entity;
      const registration = record.attributes.registration;
      
      // Rule 1: 👤 Entity Status = "ACTIVE"
      const entityStatus = entity.status;
      const rule1Pass = entityStatus === 'ACTIVE';
      details.push(`1. 👤 Entity Status: "${entityStatus}" ${rule1Pass ? '✅ PASS' : '❌ FAIL (Required: ACTIVE)'}`);
      if (!rule1Pass) isCompliant = false;
      
      // Rule 2: 📅 Current Date Within Valid Period
      const currentDate = new Date();
      const lastUpdateDate = registration.lastUpdateDate ? new Date(registration.lastUpdateDate) : null;
      const nextRenewalDate = registration.nextRenewalDate ? new Date(registration.nextRenewalDate) : null;
      
      let rule2Pass = true;
      let rule2Details = '';
      
      if (lastUpdateDate && nextRenewalDate) {
         const withinPeriod = currentDate >= lastUpdateDate && currentDate <= nextRenewalDate;
         rule2Pass = withinPeriod;
         rule2Details = `Current: ${currentDate.toISOString().split('T')[0]}, Valid: ${lastUpdateDate.toISOString().split('T')[0]} to ${nextRenewalDate.toISOString().split('T')[0]}`;
      } else {
         rule2Pass = false;
         rule2Details = `Missing dates - Last Update: ${lastUpdateDate ? lastUpdateDate.toISOString().split('T')[0] : 'NULL'}, Next Renewal: ${nextRenewalDate ? nextRenewalDate.toISOString().split('T')[0] : 'NULL'}`;
      }
      
      details.push(`2. 📅 Valid Period: ${rule2Details} ${rule2Pass ? '✅ PASS' : '❌ FAIL'}`);
      if (!rule2Pass) isCompliant = false;
      
      // Rule 3: 📋 Registration Status = "ISSUED"
      const registrationStatus = registration.status;
      const rule3Pass = registrationStatus === 'ISSUED';
      details.push(`3. 📋 Registration Status: "${registrationStatus}" ${rule3Pass ? '✅ PASS' : '❌ FAIL (Required: ISSUED)'}`);
      if (!rule3Pass) isCompliant = false;
      
      // Rule 4: 🔖 Conformity Flag ≠ "NON_CONFORMING"
      const conformityFlag = registration.conformityFlag || 'UNKNOWN';
      const rule4Pass = conformityFlag !== 'NON_CONFORMING';
      details.push(`4. 🔖 Conformity Flag: "${conformityFlag}" ${rule4Pass ? '✅ PASS' : '❌ FAIL (Cannot be NON_CONFORMING)'}`);
      if (!rule4Pass) isCompliant = false;
      
   } catch (error) {
      details.push(`❌ Error validating business rules: ${error}`);
      isCompliant = false;
   }
   
   return { isCompliant, details };
}

/**
 * Create enhanced compliance data based on business rules validation
 */
function createEnhancedComplianceDataFromBusinessRules(
   apiResponse: any, 
   complianceScore: number, 
   riskLevel: number,
   isCompliant: boolean
): GLEIFEnhancedComplianceData {
   const entity = apiResponse.data[0].attributes.entity;
   const registration = apiResponse.data[0].attributes.registration;
   
   return new GLEIFEnhancedComplianceData({
      type: CircuitString.fromString(apiResponse.data[0].type || 'lei-records'),
      id: CircuitString.fromString(apiResponse.data[0].id || ''),
      lei: CircuitString.fromString(apiResponse.data[0].attributes.lei || ''),
      name: CircuitString.fromString(entity.legalName?.name || ''),
      
      // Set status based on business rules validation
      registration_status: CircuitString.fromString(isCompliant ? 'ISSUED' : registration.status || 'INACTIVE'),
      entity_status: CircuitString.fromString(isCompliant ? 'ACTIVE' : entity.status || 'INACTIVE'),
      validation_status: CircuitString.fromString('VALIDATED'),
      
      jurisdiction: CircuitString.fromString(entity.jurisdiction || 'UNKNOWN'),
      legalForm_id: CircuitString.fromString(entity.legalForm?.id || 'UNKNOWN'),
      registeredAt_id: CircuitString.fromString('GLEIF'),
      
      initialRegistrationDate: CircuitString.fromString(registration.initialRegistrationDate || ''),
      lastUpdateDate: CircuitString.fromString(registration.lastUpdateDate || ''),
      nextRenewalDate: CircuitString.fromString(registration.nextRenewalDate || ''),
      
      legalAddress_country: CircuitString.fromString(entity.legalAddress?.country || 'UNKNOWN'),
      legalAddress_city: CircuitString.fromString(entity.legalAddress?.city || 'UNKNOWN'),
      headquartersAddress_country: CircuitString.fromString(entity.headquartersAddress?.country || 'UNKNOWN'),
      
      managingLou: CircuitString.fromString(registration.managingLou || 'UNKNOWN'),
      corroborationLevel: CircuitString.fromString(registration.corroborationLevel || 'UNKNOWN'),
      conformityFlag: CircuitString.fromString(registration.conformityFlag || 'UNKNOWN'),
      
      companyGroup: Field(0), // Default to no group
      parentLEI: CircuitString.fromString(''),
      subsidiaryCount: Field(0),
      
      complianceScore: Field(complianceScore),
      riskLevel: Field(riskLevel),
      lastVerificationTimestamp: UInt64.from(Date.now()),
   });
}