import { Poseidon, Field } from 'o1js';

export function createBPMNGroupRecord(
  bpmnGroupID: any,
  isValid: any,
  verificationTimestamp: any,
  CircuitStringClass: any,
  BPMNGroupRecordClass: any,
  FieldClass: any,
  isFirstVerification: boolean = true
): any {
  console.log(`    🔍 createCompanyRecord: Validating input parameters...`);
  
  // Validate all input parameters
  if (!bpmnGroupID) {
    throw new Error('createCompanyRecord: complianceData is null or undefined');
  }
//   if (!complianceData.lei) {
//     throw new Error('createCompanyRecord: complianceData.lei is null or undefined');
//   }
//   if (!complianceData.name) {
//     throw new Error('createCompanyRecord: complianceData.name is null or undefined');
//   }
  if (isValid === null || isValid === undefined) {
    throw new Error('createCompanyRecord: isCompliant is null or undefined');
  }
  if (!verificationTimestamp) {
    throw new Error('createCompanyRecord: verificationTimestamp is null or undefined');
  }
  if (!CircuitStringClass) {
    throw new Error('createCompanyRecord: CircuitStringClass is null or undefined');
  }
  if (!BPMNGroupRecordClass) {
    throw new Error('createCompanyRecord: BPMNGroupRecordClass is null or undefined');
  }
  if (!FieldClass) {
    throw new Error('createCompanyRecord: FieldClass is null or undefined');
  }
  
  console.log(`    ✅ createCompanyRecord: All input parameters validated`);
  
  const currentTime = verificationTimestamp;
  
  try {
    console.log(`    🔄 createCompanyRecord: Creating hashes...`);
    
    // Create hashes with error handling
    let groupIDHash;
    
    try {
      groupIDHash = bpmnGroupID.hash();
      console.log(`      ✅ groupIDHash created: ${groupIDHash.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create GroupIDhash - ${error}`);
    }
    
    // try {
    //   legalNameHash = complianceData.name.hash();
    //   console.log(`      ✅ legalNameHash created: ${legalNameHash.toString()}`);
    // } catch (error) {
    //   throw new Error(`createCompanyRecord: Failed to create legalNameHash - ${error}`);
    // }
    
    // try {
    //   jurisdictionHash = CircuitStringClass.fromString('Global').hash();
    //   console.log(`      ✅ jurisdictionHash created: ${jurisdictionHash.toString()}`);
    // } catch (error) {
    //   throw new Error(`createCompanyRecord: Failed to create jurisdictionHash - ${error}`);
    // }
    
    console.log(`    🔄 createCompanyRecord: Creating compliance score...`);
    let complianceScore;
    try {
      complianceScore = isValid.toField().mul(100);
      console.log(`      ✅ complianceScore created: ${complianceScore.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create complianceScore - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating verification counts...`);
    let totalVerifications, passedVerifications, failedVerifications, consecutiveFailures;
    try {
      totalVerifications = FieldClass(1); // This is the first verification
      passedVerifications = isValid.toField(); // 1 if passed, 0 if failed
      failedVerifications = isValid.not().toField(); // 1 if failed, 0 if passed
      consecutiveFailures = isValid.not().toField(); // 1 if this verification failed, 0 if passed
      
      console.log(`      ✅ totalVerifications created: ${totalVerifications.toString()}`);
      console.log(`      ✅ passedVerifications created: ${passedVerifications.toString()}`);
      console.log(`      ✅ failedVerifications created: ${failedVerifications.toString()}`);
      console.log(`      ✅ consecutiveFailures created: ${consecutiveFailures.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create verification counts - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating timestamp fields...`);
    let lastPassTime, lastFailTime;
    try {
    //   // Import UInt64 from the modules that should be available
    //   const UInt64 = verificationTimestamp.constructor; // Get UInt64 constructor from the timestamp
      
    //   // Set lastPassTime to current time if compliant, 0 if not
    //   lastPassTime = isValid.toField().equals(FieldClass(1)) ? currentTime : UInt64.from(0);
    //   // Set lastFailTime to current time if not compliant, 0 if compliant 
    //   lastFailTime = isValid.toField().equals(FieldClass(0)) ? currentTime : UInt64.from(0);


        // Import UInt64 from the modules that should be available
      const UInt64 = verificationTimestamp.constructor; // Get UInt64 constructor from the timestamp
        // Set lastPassTime and lastFailTime based on isValid boolean value
        // Use the actual boolean value from isValid, not field comparison
      const isValidValue = isValid.toBoolean ? isValid.toBoolean() : isValid.value;
      lastPassTime = isValidValue ? currentTime : UInt64.from(0);
      lastFailTime = isValidValue ? UInt64.from(0) : currentTime;
            
      console.log(`      ✅ lastPassTime created: ${lastPassTime.toString()}`);
      console.log(`      ✅ lastFailTime created: ${lastFailTime.toString()}`);
    } catch (error) {
      throw new Error(`createCompanyRecord: Failed to create timestamp fields - ${error}`);
    }
    
    console.log(`    🔄 createCompanyRecord: Creating BPMNGroupRecord with all 13 fields...`);
    const record = new BPMNGroupRecordClass({
      groupIDHash: groupIDHash,
    //   legalNameHash: legalNameHash,
    //   jurisdictionHash: jurisdictionHash,
      isValid: isValid,
      complianceScore: complianceScore,
      totalVerifications: totalVerifications,
      passedVerifications: passedVerifications,         // NEW FIELD
      failedVerifications: failedVerifications,         // NEW FIELD
      consecutiveFailures: consecutiveFailures,         // NEW FIELD
      lastVerificationTime: currentTime,
      firstVerificationTime: currentTime,
      lastPassTime: lastPassTime,                       // NEW FIELD
      lastFailTime: lastFailTime                        // NEW FIELD
    });
    
    console.log(`    ✅ createCompanyRecord: BPMNGroupRecord created successfully with all 13 fields`);
    return record;
    
  } catch (error) {
    console.error(`    ❌ createCompanyRecord: Error creating company record:`, error);
    throw error;
  }
}
