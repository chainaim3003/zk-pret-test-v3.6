import {
   Field,
   Signature,
   Struct,
   ZkProgram,
   CircuitString,
   Poseidon,
   Provable,
} from 'o1js';
import { getPublicKeyFor } from '../../core/OracleRegistry.js';
import { MerkleWitness9 } from '../../tests/with-sign/GLEIFMerkleUtils.js';

// Public output structure for Merkle-based verification
export class GLEIFMerklePublicOutput extends Struct({
   name: CircuitString,
   registration_status: CircuitString,
   lei: CircuitString,
   datasetRoot: Field,        // Proves integrity of complete dataset
   companyVerified: Field,    // 1 if compliant, 0 if not
   fieldsRevealed: Field,     // Number of fields disclosed
}) { }

// Extended public output for comprehensive verification
export class GLEIFExtendedPublicOutput extends Struct({
   name: CircuitString,
   registration_status: CircuitString,
   lei: CircuitString,
   legalAddress_country: CircuitString,
   legalAddress_city: CircuitString,
   jurisdiction: CircuitString,
   datasetRoot: Field,
   companyVerified: Field,
   fieldsRevealed: Field,
}) { }



// Comprehensive business logic output (matching GLEIFOptimVerificationTestWithSign)
export class GLEIFComprehensivePublicOutput extends Struct({
   lei: CircuitString,
   name: CircuitString,
   entity_status: CircuitString,
   registration_status: CircuitString,
   conformity_flag: CircuitString,
   isGLEIFCompliant: Field,    // 1 if compliant with all business rules, 0 if not
   datasetRoot: Field,         // Merkle root of complete dataset
   fieldsRevealed: Field,      // Number of fields disclosed
   businessRulesPassed: Field, // Number of business rules that passed
}) { }

export const GLEIFMerkleVerifier = ZkProgram({
   name: 'GLEIFMerkleVerifier',
   publicInput: Field,
   publicOutput: GLEIFMerklePublicOutput,

   methods: {
      // Core selective compliance proof (4 fields: name, entity_status, registration_status, lei)
      proveSelectiveCompliance: {
         privateInputs: [
            Field,              // Dataset root (signed by oracle)
            MerkleWitness9,     // Witness for name field
            MerkleWitness9,     // Witness for entity_status field
            MerkleWitness9,     // Witness for registration_status field
            MerkleWitness9,     // Witness for LEI field
            CircuitString,      // Actual name value
            CircuitString,      // Actual entity_status value
            CircuitString,      // Actual registration_status value  
            CircuitString,      // Actual LEI value
            Signature           // Oracle signature on root
         ],
         
         async method(
            GLEIFToProve: Field,
            datasetRoot: Field,
            nameWitness: MerkleWitness9,
            entityStatusWitness: MerkleWitness9,
            registrationStatusWitness: MerkleWitness9,
            leiWitness: MerkleWitness9,
            name: CircuitString,
            entityStatus: CircuitString,
            registrationStatus: CircuitString,
            lei: CircuitString,
            oracleSignature: Signature
         ): Promise<GLEIFMerklePublicOutput> {

            // 1. Verify oracle signature on the complete dataset root
            const registryPublicKey = getPublicKeyFor('GLEIF');
            const isValidSignature = oracleSignature.verify(registryPublicKey, [datasetRoot]);
            isValidSignature.assertTrue();

            // 2. Prove each field belongs to the signed dataset
            const nameHash = Poseidon.hash(name.values.map(c => c.toField()));
            const nameRoot = nameWitness.calculateRoot(nameHash);
            nameRoot.assertEquals(datasetRoot);

            const entityStatusHash = Poseidon.hash(entityStatus.values.map(c => c.toField()));
            const entityStatusRoot = entityStatusWitness.calculateRoot(entityStatusHash);
            entityStatusRoot.assertEquals(datasetRoot);

            const registrationStatusHash = Poseidon.hash(registrationStatus.values.map(c => c.toField()));
            const registrationStatusRoot = registrationStatusWitness.calculateRoot(registrationStatusHash);
            registrationStatusRoot.assertEquals(datasetRoot);

            const leiHash = Poseidon.hash(lei.values.map(c => c.toField()));
            const leiRoot = leiWitness.calculateRoot(leiHash);
            leiRoot.assertEquals(datasetRoot);

            // 3. Verify compliance status (both entity_status and registration_status)
            const activeStatus = CircuitString.fromString("ACTIVE");
            const issuedStatus = CircuitString.fromString("ISSUED");
            
            // Check entity_status = "ACTIVE"
            const isEntityActive = entityStatus.equals(activeStatus);
            
            // Check registration_status = "ISSUED"  
            const isRegistrationIssued = registrationStatus.equals(issuedStatus);
            
            // Basic compliance requires BOTH conditions
            const complianceFlag = isEntityActive.and(isRegistrationIssued);
            const complianceValue = Provable.if(complianceFlag, Field(1), Field(0));

            // 4. Return selective disclosure with proof of integrity
            return new GLEIFMerklePublicOutput({
               name: name,
               registration_status: registrationStatus,
               lei: lei,
               datasetRoot: datasetRoot,
               companyVerified: complianceValue,
               fieldsRevealed: Field(4)
            });
         }
      },

      // Extended compliance proof (7 fields including address info and both status fields)
      proveExtendedCompliance: {
         privateInputs: [
            Field,              // Dataset root
            MerkleWitness9,     // name witness
            MerkleWitness9,     // entity_status witness
            MerkleWitness9,     // registration_status witness  
            MerkleWitness9,     // lei witness
            MerkleWitness9,     // country witness
            MerkleWitness9,     // city witness
            MerkleWitness9,     // jurisdiction witness
            CircuitString,      // name value
            CircuitString,      // entity_status value
            CircuitString,      // registration_status value
            CircuitString,      // lei value
            CircuitString,      // country value
            CircuitString,      // city value
            CircuitString,      // jurisdiction value
            Signature           // oracle signature
         ],
         
         async method(
            GLEIFToProve: Field,
            datasetRoot: Field,
            nameWitness: MerkleWitness9,
            entityStatusWitness: MerkleWitness9,
            registrationStatusWitness: MerkleWitness9,
            leiWitness: MerkleWitness9,
            countryWitness: MerkleWitness9,
            cityWitness: MerkleWitness9,
            jurisdictionWitness: MerkleWitness9,
            name: CircuitString,
            entityStatus: CircuitString,
            registrationStatus: CircuitString,
            lei: CircuitString,
            country: CircuitString,
            city: CircuitString,
            jurisdiction: CircuitString,
            oracleSignature: Signature
         ): Promise<GLEIFExtendedPublicOutput> {

            // Verify oracle signature
            const registryPublicKey = getPublicKeyFor('GLEIF');
            oracleSignature.verify(registryPublicKey, [datasetRoot]).assertTrue();

            // Verify all fields belong to signed dataset
            const fields = [
               { witness: nameWitness, value: name },
               { witness: entityStatusWitness, value: entityStatus },
               { witness: registrationStatusWitness, value: registrationStatus },
               { witness: leiWitness, value: lei },
               { witness: countryWitness, value: country },
               { witness: cityWitness, value: city },
               { witness: jurisdictionWitness, value: jurisdiction }
            ];

            fields.forEach(field => {
               const fieldHash = Poseidon.hash(field.value.values.map(c => c.toField()));
               field.witness.calculateRoot(fieldHash).assertEquals(datasetRoot);
            });

            // Verify compliance (both entity_status and registration_status)
            const activeStatus = CircuitString.fromString("ACTIVE");
            const issuedStatus = CircuitString.fromString("ISSUED");
            
            const isEntityActive = entityStatus.equals(activeStatus);
            const isRegistrationIssued = registrationStatus.equals(issuedStatus);
            const complianceFlag = isEntityActive.and(isRegistrationIssued);
            const complianceValue = Provable.if(complianceFlag, Field(1), Field(0));

            return new GLEIFExtendedPublicOutput({
               name,
               registration_status: registrationStatus,
               lei,
               legalAddress_country: country,
               legalAddress_city: city,
               jurisdiction,
               datasetRoot,
               companyVerified: complianceValue,
               fieldsRevealed: Field(7)
            });
         }
      }
   }
});

// Comprehensive verifier with full business logic (matching GLEIFOptimVerificationTestWithSign)
export const GLEIFComprehensiveVerifier = ZkProgram({
   name: 'GLEIFComprehensiveVerifier',
   publicInput: Field,
   publicOutput: GLEIFComprehensivePublicOutput,

   methods: {
      // Comprehensive business logic verification (matching GLEIFOptimVerificationTestWithSign)
      proveComprehensiveCompliance: {
         privateInputs: [
            Field,              // Dataset root (signed by oracle)
            MerkleWitness9,     // lei witness
            MerkleWitness9,     // name witness
            MerkleWitness9,     // entity_status witness
            MerkleWitness9,     // registration_status witness
            MerkleWitness9,     // conformity_flag witness
            MerkleWitness9,     // lastUpdateDate witness
            MerkleWitness9,     // nextRenewalDate witness
            MerkleWitness9,     // bic_codes witness
            MerkleWitness9,     // mic_codes witness
            MerkleWitness9,     // managingLou witness
            CircuitString,      // lei value
            CircuitString,      // name value
            CircuitString,      // entity_status value
            CircuitString,      // registration_status value
            CircuitString,      // conformity_flag value
            CircuitString,      // lastUpdateDate value
            CircuitString,      // nextRenewalDate value
            CircuitString,      // bic_codes value
            CircuitString,      // mic_codes value
            CircuitString,      // managingLou value
            Signature           // Oracle signature on root
         ],
         
         async method(
            GLEIFToProve: Field,
            datasetRoot: Field,
            leiWitness: MerkleWitness9,
            nameWitness: MerkleWitness9,
            entityStatusWitness: MerkleWitness9,
            registrationStatusWitness: MerkleWitness9,
            conformityFlagWitness: MerkleWitness9,
            lastUpdateWitness: MerkleWitness9,
            nextRenewalWitness: MerkleWitness9,
            bicWitness: MerkleWitness9,
            micWitness: MerkleWitness9,
            managingLouWitness: MerkleWitness9,
            lei: CircuitString,
            name: CircuitString,
            entityStatus: CircuitString,
            registrationStatus: CircuitString,
            conformityFlag: CircuitString,
            lastUpdate: CircuitString,
            nextRenewal: CircuitString,
            bicCodes: CircuitString,
            micCodes: CircuitString,
            managingLou: CircuitString,
            oracleSignature: Signature
         ): Promise<GLEIFComprehensivePublicOutput> {

            // 1. Verify oracle signature on the complete dataset root
            const registryPublicKey = getPublicKeyFor('GLEIF');
            const isValidSignature = oracleSignature.verify(registryPublicKey, [datasetRoot]);
            isValidSignature.assertTrue();

            // 2. Verify all fields belong to the signed dataset (Merkle inclusion proofs)
            const fields = [
               { witness: leiWitness, value: lei },
               { witness: nameWitness, value: name },
               { witness: entityStatusWitness, value: entityStatus },
               { witness: registrationStatusWitness, value: registrationStatus },
               { witness: conformityFlagWitness, value: conformityFlag },
               { witness: lastUpdateWitness, value: lastUpdate },
               { witness: nextRenewalWitness, value: nextRenewal },
               { witness: bicWitness, value: bicCodes },
               { witness: micWitness, value: micCodes },
               { witness: managingLouWitness, value: managingLou }
            ];

            fields.forEach(field => {
               const fieldHash = Poseidon.hash(field.value.values.map(c => c.toField()));
               field.witness.calculateRoot(fieldHash).assertEquals(datasetRoot);
            });

            // 3. Business Logic Compliance Checks (matching GLEIFOptim)
            // Entity status must be ACTIVE
            const activeStatus = CircuitString.fromString("ACTIVE");
            const isEntityActive = entityStatus.equals(activeStatus);
            
            // Registration status must be ISSUED
            const issuedStatus = CircuitString.fromString("ISSUED");
            const isRegistrationIssued = registrationStatus.equals(issuedStatus);
            
            // Conformity flag must be compliant (CONFORMING, UNKNOWN, or empty)
            const conformingFlag = CircuitString.fromString("CONFORMING");
            const unknownFlag = CircuitString.fromString("UNKNOWN");
            const emptyFlag = CircuitString.fromString("");
            const isConformityOk = conformingFlag.equals(conformityFlag)
               .or(unknownFlag.equals(conformityFlag))
               .or(emptyFlag.equals(conformityFlag));
            
            // Temporal validation - dates should be valid (non-empty)
            const emptyDate = CircuitString.fromString("");
            const isLastUpdateValid = lastUpdate.equals(emptyDate).not();
            const isNextRenewalValid = nextRenewal.equals(emptyDate).not();
            const isTemporalValid = isLastUpdateValid.and(isNextRenewalValid);
            
            // LEI should exist (non-empty)
            const emptyLEI = CircuitString.fromString("");
            const hasValidLEI = lei.equals(emptyLEI).not();

            // 4. Calculate business rules passed
            const entityStatusPassed = Provable.if(isEntityActive, Field(1), Field(0));
            const registrationStatusPassed = Provable.if(isRegistrationIssued, Field(1), Field(0));
            const conformityFlagPassed = Provable.if(isConformityOk, Field(1), Field(0));
            const temporalValidPassed = Provable.if(isTemporalValid, Field(1), Field(0));
            const leiValidPassed = Provable.if(hasValidLEI, Field(1), Field(0));
            
            const businessRulesPassed = entityStatusPassed
               .add(registrationStatusPassed)
               .add(conformityFlagPassed)
               .add(temporalValidPassed)
               .add(leiValidPassed);

            // 5. Overall compliance (all rules must pass)
            const isGLEIFCompliant = isEntityActive
               .and(isRegistrationIssued)
               .and(isConformityOk)
               .and(isTemporalValid)
               .and(hasValidLEI);

            const complianceFlag = Provable.if(isGLEIFCompliant, Field(1), Field(0));

            // 6. Return comprehensive verification result
            return new GLEIFComprehensivePublicOutput({
               lei: lei,
               name: name,
               entity_status: entityStatus,
               registration_status: registrationStatus,
               conformity_flag: conformityFlag,
               isGLEIFCompliant: complianceFlag,
               datasetRoot: datasetRoot,
               fieldsRevealed: Field(10), // 10 fields revealed in comprehensive verification
               businessRulesPassed: businessRulesPassed
            });
         }
      }
   }
});



export class GLEIFMerkleProof extends ZkProgram.Proof(GLEIFMerkleVerifier) { }
export class GLEIFComprehensiveProof extends ZkProgram.Proof(GLEIFComprehensiveVerifier) { }
