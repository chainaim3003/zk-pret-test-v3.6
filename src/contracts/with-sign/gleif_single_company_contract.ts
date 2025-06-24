import { Field, SmartContract, state, State, method, Bool, CircuitString, UInt64 } from 'o1js';
import { GLEIFOptimProof } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';

// =================================== Enhanced GLEIF Single Company Smart Contract ===================================
export class GLEIFOptimSingleCompanySmartContract extends SmartContract {
   // =================================== Company Identity (Enhanced) ===================================
   @state(CircuitString) companyLEI = State<CircuitString>();        // Legal Entity Identifier
   @state(CircuitString) companyName = State<CircuitString>();       // Company legal name
   @state(CircuitString) jurisdiction = State<CircuitString>();      // Legal jurisdiction
   @state(CircuitString) entityStatus = State<CircuitString>();      // ACTIVE/INACTIVE
   
   // =================================== Current Compliance Status ===================================
   @state(Bool) GLEIFCompliant = State<Bool>();                      // Current compliance status
   @state(Field) currentComplianceScore = State<Field>();            // Current compliance score (0-100)
   @state(UInt64) lastVerificationTime = State<UInt64>();           // Most recent verification time
   @state(UInt64) lastGLEIFUpdate = State<UInt64>();               // Last GLEIF data update
   
   // =================================== Verification History Tracking ===================================
   @state(Field) totalVerifications = State<Field>();               // Total number of verifications
   @state(Field) verificationsMapRoot = State<Field>();            // Merkle root of all verification records
   @state(UInt64) firstVerificationTime = State<UInt64>();         // When first verified
   @state(UInt64) contractCreationTime = State<UInt64>();          // When contract was deployed

   // =================================== Initialize Contract ===================================
   init() {
      super.init();
      
      // Company identity (empty initially)
      this.companyLEI.set(CircuitString.fromString(''));
      this.companyName.set(CircuitString.fromString(''));
      this.jurisdiction.set(CircuitString.fromString(''));
      this.entityStatus.set(CircuitString.fromString(''));
      
      // Compliance status
      this.GLEIFCompliant.set(Bool(false));
      this.currentComplianceScore.set(Field(0));
      this.lastVerificationTime.set(UInt64.from(0));
      this.lastGLEIFUpdate.set(UInt64.from(0));
      
      // Verification history
      this.totalVerifications.set(Field(0));
      this.verificationsMapRoot.set(Field(0)); // Empty merkle tree root
      this.firstVerificationTime.set(UInt64.from(0));
      this.contractCreationTime.set(UInt64.from(Date.now()));
   }

   // =================================== Enhanced Verification Method ===================================
   @method async verifyOptimizedComplianceWithProof(
      proof: GLEIFOptimProof,
      isFirstVerification: Bool
   ) {
      // Get current state values
      const currentCompliantStatus = this.GLEIFCompliant.get();
      const currentVerificationCount = this.totalVerifications.get();
      const currentLEI = this.companyLEI.get();
      const currentFirstVerificationTime = this.firstVerificationTime.get();

      // =================================== Verify ZK Proof ===================================
      proof.verify();

      // =================================== Extract Proof Data ===================================
      const publicOutput = proof.publicOutput;
      const proofLEI = publicOutput.lei;
      const proofName = publicOutput.name;
      const isCompliant = publicOutput.isGLEIFCompliant;
      const verificationTimestamp = publicOutput.verification_timestamp;

      // =================================== Company Identity Validation ===================================
      const emptyLEI = CircuitString.fromString('');
      const isContractEmpty = currentLEI.equals(emptyLEI);
      
      // If first verification, set company identity
      // If not first verification, ensure it's the same company
      const isValidCompany = isContractEmpty.and(isFirstVerification).or(
         currentLEI.equals(proofLEI)
      );
      isValidCompany.assertTrue();

      // =================================== Update Company Identity (First Time Only) ===================================
      this.companyLEI.set(proofLEI);
      this.companyName.set(proofName);
      // Extract additional fields from proof if available
      // this.jurisdiction.set(publicOutput.jurisdiction || CircuitString.fromString(''));
      // this.entityStatus.set(publicOutput.entityStatus || CircuitString.fromString(''));

      // =================================== Update Current Compliance State ===================================
      this.GLEIFCompliant.set(isCompliant);
      this.currentComplianceScore.set(isCompliant.toField().mul(100)); // Simplified scoring
      this.lastVerificationTime.set(verificationTimestamp);
      this.lastGLEIFUpdate.set(verificationTimestamp); // Assume verification includes fresh GLEIF data

      // =================================== Update Verification History ===================================
      const newVerificationCount = currentVerificationCount.add(1);
      this.totalVerifications.set(newVerificationCount);
      
      // Set first verification time if this is the first verification
      const shouldUseNewTime = isFirstVerification;
      const updatedFirstTime = shouldUseNewTime.toField().equals(Field(1))
        ? verificationTimestamp
        : currentFirstVerificationTime;
      this.firstVerificationTime.set(updatedFirstTime);

      // TODO: Update verificationsMapRoot with new verification record
   }

   // =================================== Company Information Queries ===================================
   
   /**
    * Get complete company GLEIF information and current status
    */
   getCompanyGLEIFInfo(): {
      companyLEI: CircuitString;
      companyName: CircuitString;
      jurisdiction: CircuitString;
      entityStatus: CircuitString;
      isCompliant: Bool;
      complianceScore: Field;
      lastGLEIFUpdate: UInt64;
   } {
      return {
         companyLEI: this.companyLEI.get(),
         companyName: this.companyName.get(),
         jurisdiction: this.jurisdiction.get(),
         entityStatus: this.entityStatus.get(),
         isCompliant: this.GLEIFCompliant.get(),
         complianceScore: this.currentComplianceScore.get(),
         lastGLEIFUpdate: this.lastGLEIFUpdate.get()
      };
   }

   /**
    * Get current GLEIF compliance status (most recent verification)
    */
   getCurrentGLEIFCompliance(): {
      isCompliant: Bool;
      lastVerificationTime: UInt64;
      complianceScore: Field;
      lei: CircuitString;
   } {
      return {
         isCompliant: this.GLEIFCompliant.get(),
         lastVerificationTime: this.lastVerificationTime.get(),
         complianceScore: this.currentComplianceScore.get(),
         lei: this.companyLEI.get()
      };
   }

   /**
    * Get GLEIF verification statistics
    */
   getGLEIFVerificationStats(): {
      totalVerifications: Field;
      firstVerificationTime: UInt64;
      lastVerificationTime: UInt64;
      contractAge: UInt64;
      hasBeenVerified: Bool;
      daysSinceLastUpdate: Field;
   } {
      const currentTime = UInt64.from(Date.now());
      const creationTime = this.contractCreationTime.get();
      const contractAge = currentTime.sub(creationTime);
      const hasBeenVerified = this.totalVerifications.get().greaterThan(Field(0));
      
      // Calculate days since last GLEIF update
      const lastUpdate = this.lastGLEIFUpdate.get();
      const daysSinceUpdate = currentTime.sub(lastUpdate).div(UInt64.from(86400000)); // ms to days
      
      return {
         totalVerifications: this.totalVerifications.get(),
         firstVerificationTime: this.firstVerificationTime.get(),
         lastVerificationTime: this.lastVerificationTime.get(),
         contractAge: contractAge,
         hasBeenVerified: hasBeenVerified,
         daysSinceLastUpdate: daysSinceUpdate.value
      };
   }

   /**
    * Check if a specific company is tracked by this contract
    */
   isTrackingGLEIFCompany(expectedLEI: CircuitString): Bool {
      const currentLEI = this.companyLEI.get();
      const emptyLEI = CircuitString.fromString('');
      const hasCompany = currentLEI.equals(emptyLEI).not();
      return hasCompany.and(currentLEI.equals(expectedLEI));
   }

   /**
    * Check if GLEIF data is stale (over 1 year old)
    */
   isGLEIFDataStale(): Bool {
      const currentTime = UInt64.from(Date.now());
      const lastUpdate = this.lastGLEIFUpdate.get();
      const oneYear = UInt64.from(365 * 24 * 60 * 60 * 1000); // One year in milliseconds
      
      return currentTime.sub(lastUpdate).greaterThan(oneYear);
   }

   // =================================== Administrative Methods ===================================
   
   /**
    * Reset GLEIF compliance status (admin function)
    */
   @method async resetGLEIFCompliance() {
      this.GLEIFCompliant.set(Bool(false));
      this.currentComplianceScore.set(Field(0));
   }

   /**
    * Update GLEIF data timestamp (admin function)
    */
   @method async updateGLEIFDataTimestamp(newUpdateTime: UInt64) {
      this.lastGLEIFUpdate.set(newUpdateTime);
   }

   /**
    * Reset entire contract for new company (admin function)
    * WARNING: This erases all history
    */
   @method async resetForNewGLEIFCompany() {
      // Reset company identity
      this.companyLEI.set(CircuitString.fromString(''));
      this.companyName.set(CircuitString.fromString(''));
      this.jurisdiction.set(CircuitString.fromString(''));
      this.entityStatus.set(CircuitString.fromString(''));
      
      // Reset compliance
      this.GLEIFCompliant.set(Bool(false));
      this.currentComplianceScore.set(Field(0));
      this.lastVerificationTime.set(UInt64.from(0));
      this.lastGLEIFUpdate.set(UInt64.from(0));
      
      // Reset history
      this.totalVerifications.set(Field(0));
      this.verificationsMapRoot.set(Field(0));
      this.firstVerificationTime.set(UInt64.from(0));
   }
}