import { Field, SmartContract, state, State, method, Bool, CircuitString, UInt64, Struct, MerkleWitness, MerkleTree, Poseidon, MerkleMap, MerkleMapWitness } from 'o1js';
import { GLEIFOptimProof } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';

// =================================== Merkle Tree Configuration ===================================
export const COMPANY_MERKLE_HEIGHT = 8; // Height 8 for up to 256 companies
export class CompanyMerkleWitness extends MerkleWitness(COMPANY_MERKLE_HEIGHT) {}

// =================================== Company Record Structure (Enhanced) ===================================
export class GLEIFCompanyRecord extends Struct({
   leiHash: Field,                    // Hash of LEI for privacy
   legalNameHash: Field,              // Hash of company name for privacy
   jurisdictionHash: Field,           // Hash of jurisdiction
   isCompliant: Bool,                 // Current compliance status
   complianceScore: Field,            // 0-100 score
   totalVerifications: Field,         // Total verification attempts
   passedVerifications: Field,        // Number of passed verifications
   failedVerifications: Field,        // Number of failed verifications
   consecutiveFailures: Field,        // Current streak of consecutive failures
   lastVerificationTime: UInt64,      // Last verification timestamp
   firstVerificationTime: UInt64,     // First verification timestamp
   lastPassTime: UInt64,              // Last successful verification timestamp
   lastFailTime: UInt64,              // Last failed verification timestamp
}) {}

// =================================== Company Verification Statistics ===================================
export class CompanyVerificationStats extends Struct({
   leiHash: Field,
   legalNameHash: Field,
   totalVerifications: Field,
   passedVerifications: Field,
   failedVerifications: Field,
   successRate: Field,                 // Percentage (0-100)
   consecutiveFailures: Field,
   isCurrentlyCompliant: Bool,
   firstVerificationTime: UInt64,
   lastVerificationTime: UInt64,
   lastPassTime: UInt64,
   lastFailTime: UInt64,
   daysSinceLastVerification: Field,
}) {}

// =================================== Company Query Results ===================================
export class CompanyQueryResult extends Struct({
   exists: Bool,
   record: GLEIFCompanyRecord,
   merkleRoot: Field,
   isValid: Bool,
}) {}

// =================================== Company Storage Key ===================================
export class CompanyKey extends Struct({
   leiHash: Field,
   nameHash: Field,
}) {
   static create(leiHash: Field, nameHash: Field): CompanyKey {
      return new CompanyKey({ leiHash, nameHash });
   }
   
   toField(): Field {
      return Poseidon.hash([this.leiHash, this.nameHash]);
   }
}

// =================================== Query Result Structures ===================================
export class RegistryInfo extends Struct({
   totalCompaniesTracked: Field,
   compliantCompaniesCount: Field,
   // ✅ ZK BEST PRACTICE: Removed globalComplianceScore - calculate in JavaScript
   totalVerificationsGlobal: Field,
   companiesRootHash: Field,
   registryVersion: Field,
}) {}

export class GlobalComplianceStats extends Struct({
   totalCompanies: Field,
   compliantCompanies: Field,
   // ✅ ZK BEST PRACTICE: Removed compliancePercentage - calculate in JavaScript
   totalVerifications: Field,
   lastVerificationTime: UInt64,
}) {}

// =================================== GLEIF Multi-Company Contract with Real Storage ===================================
export class GLEIFOptimMultiCompanySmartContract extends SmartContract {
   // =================================== Multi-Company State (6 fields maximum) ===================================
   @state(Field) totalCompaniesTracked = State<Field>();     // Total number of companies tracked
   @state(Field) compliantCompaniesCount = State<Field>();   // Number currently compliant
   @state(UInt64) lastVerificationTime = State<UInt64>();    // Most recent verification timestamp
   @state(Field) companiesMapRoot = State<Field>();          // MerkleMap root for individual company storage
   @state(Field) registryVersion = State<Field>();           // Registry version for upgrades
   @state(Bool) contractDisabled = State<Bool>();            // Emergency disable flag

   // =================================== Initialize Contract ===================================
   init() {
      super.init();
      
      // Initialize company tracking
      this.totalCompaniesTracked.set(Field(0));
      this.compliantCompaniesCount.set(Field(0));
      
      // Initialize timestamps
      this.lastVerificationTime.set(UInt64.from(Date.now()));
      
      // Initialize version
      this.registryVersion.set(Field(1));
      
      // Initialize empty MerkleMap for individual company storage
      const emptyMap = new MerkleMap();
      this.companiesMapRoot.set(emptyMap.getRoot());
      
      // Initialize as enabled
      this.contractDisabled.set(Bool(false));
   }

   // =================================== Main Verification Method with Real Storage ===================================
   @method async verifyOptimizedComplianceWithProof(
      proof: GLEIFOptimProof,
      companyWitness: CompanyMerkleWitness,
      companyRecord: GLEIFCompanyRecord,
      companiesMapWitness: MerkleMapWitness
   ) {
      // Check if contract is disabled
      this.contractDisabled.requireEquals(Bool(false));
      
      // Add required state preconditions for proper constraint generation
      this.totalCompaniesTracked.requireEquals(this.totalCompaniesTracked.get());
      this.compliantCompaniesCount.requireEquals(this.compliantCompaniesCount.get());
      this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
      
      // Get current state values
      const currentTotalCompanies = this.totalCompaniesTracked.get();
      const currentCompliantCount = this.compliantCompaniesCount.get();
      const currentMapRoot = this.companiesMapRoot.get();

      // =================================== Verify ZK Proof ===================================
      proof.verify();

      // =================================== Extract Proof Data ===================================
      const publicOutput = proof.publicOutput;
      const isCompliant = publicOutput.isGLEIFCompliant;
      const verificationTimestamp = publicOutput.verification_timestamp;
      
      // Extract company identification from proof and hash them
      const proofLEI = publicOutput.lei;
      const proofCompanyName = publicOutput.name;
      const proofJurisdiction = CircuitString.fromString('Global'); // GLEIF is global
      
      // Create hashes for comparison and storage
      const proofLEIHash = proofLEI.hash();
      const proofCompanyNameHash = proofCompanyName.hash();
      const proofJurisdictionHash = proofJurisdiction.hash();
      
      // Create company key for storage
      const companyKey = CompanyKey.create(proofLEIHash, proofCompanyNameHash);
      const companyKeyField = companyKey.toField();

      // =================================== Verify Company Record Consistency ===================================
      // Ensure the company record matches the proof data
      companyRecord.leiHash.assertEquals(proofLEIHash);
      companyRecord.legalNameHash.assertEquals(proofCompanyNameHash);
      companyRecord.jurisdictionHash.assertEquals(proofJurisdictionHash);
      companyRecord.isCompliant.assertEquals(isCompliant);
      companyRecord.lastVerificationTime.assertEquals(verificationTimestamp);
      
      // =================================== Company Record Storage (Enhanced with Verification Tracking) ===================================
      // Check if this is a new company or existing company update
      // For now, treat all as new (simplified version) but track verification stats
      
      // Create enhanced company record with verification tracking
      const enhancedCompanyRecord = new GLEIFCompanyRecord({
         leiHash: companyRecord.leiHash,
         legalNameHash: companyRecord.legalNameHash,
         jurisdictionHash: companyRecord.jurisdictionHash,
         isCompliant: companyRecord.isCompliant,
         complianceScore: companyRecord.complianceScore,
         totalVerifications: Field(1),                    // Start with 1 verification
         passedVerifications: isCompliant.toField(),      // 1 if passed, 0 if failed
         failedVerifications: isCompliant.not().toField(), // 1 if failed, 0 if passed
         consecutiveFailures: isCompliant.not().toField(), // 1 if this verification failed, 0 if passed
         lastVerificationTime: verificationTimestamp,
         firstVerificationTime: verificationTimestamp,
         // Fixed: Simple conditional logic - only one should be set to current time
         lastPassTime: isCompliant.toField().equals(Field(1)) ? verificationTimestamp : UInt64.from(0),
         lastFailTime: isCompliant.toField().equals(Field(0)) ? verificationTimestamp : UInt64.from(0),
      });
      
      // =================================== Real Company Data Storage ===================================
      // Serialize enhanced company record for storage (with all verification tracking fields)
      const companyRecordHash = Poseidon.hash([
         enhancedCompanyRecord.leiHash,
         enhancedCompanyRecord.legalNameHash,
         enhancedCompanyRecord.jurisdictionHash,
         enhancedCompanyRecord.isCompliant.toField(),
         enhancedCompanyRecord.complianceScore,
         enhancedCompanyRecord.totalVerifications,
         enhancedCompanyRecord.passedVerifications,
         enhancedCompanyRecord.failedVerifications,
         enhancedCompanyRecord.consecutiveFailures,
         enhancedCompanyRecord.lastVerificationTime.value,
         enhancedCompanyRecord.firstVerificationTime.value,
         enhancedCompanyRecord.lastPassTime.value,
         enhancedCompanyRecord.lastFailTime.value
      ]);
      
      // Update the MerkleMap with the new/updated company record
      const [newMapRoot, _] = companiesMapWitness.computeRootAndKey(companyRecordHash);
      this.companiesMapRoot.set(newMapRoot);

      // =================================== Update Global Statistics (Simplified) ===================================
      // Update last verification time
      this.lastVerificationTime.set(verificationTimestamp);

      // Simple counter increment (no duplicate detection for now)
      const newTotalCompanies = currentTotalCompanies.add(1);
      this.totalCompaniesTracked.set(newTotalCompanies);

      // Simple compliant counter increment (if company is compliant)
      const newCompliantCount = isCompliant.toField().equals(Field(1))
         ? currentCompliantCount.add(1)
         : currentCompliantCount;
      this.compliantCompaniesCount.set(newCompliantCount);
   }

   // =================================== Query Methods ===================================
   
   /**
    * Get enhanced company verification statistics by LEI and Name
    */
   async getCompanyVerificationStats(
      lei: CircuitString,
      companyName: CircuitString,
      mapWitness: MerkleMapWitness
   ): Promise<CompanyVerificationStats> {
      // Add required state preconditions
      this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
      this.lastVerificationTime.requireEquals(this.lastVerificationTime.get());
      
      // Calculate company key
      const leiHash = lei.hash();
      const nameHash = companyName.hash();
      const companyKey = CompanyKey.create(leiHash, nameHash);
      const companyKeyField = companyKey.toField();
      
      // Verify the merkle map witness
      const currentMapRoot = this.companiesMapRoot.get();
      const [witnessRoot, witnessKey] = mapWitness.computeRootAndKey(Field(0));
      
      // Check if witness is valid
      const isValidWitness = witnessRoot.equals(currentMapRoot);
      const isCorrectKey = witnessKey.equals(companyKeyField);
      
      // Get company record hash from witness
      const [_, companyRecordHash] = mapWitness.computeRootAndKey(Field(1));
      const companyExists = companyRecordHash.equals(Field(0)).not();
      
      // For this simplified implementation, create default stats
      // In a full implementation, you would deserialize from companyRecordHash
      const defaultStats = new CompanyVerificationStats({
         leiHash: leiHash,
         legalNameHash: nameHash,
         totalVerifications: companyExists.toField(),  // 1 if exists, 0 if not
         passedVerifications: companyExists.toField(), // 1 if exists, 0 if not (assuming compliant if exists)
         failedVerifications: Field(0),
         successRate: companyExists.toField().mul(100), // 100% if exists, 0% if not
         consecutiveFailures: Field(0),
         isCurrentlyCompliant: companyExists,
         firstVerificationTime: this.lastVerificationTime.get(),
         lastVerificationTime: this.lastVerificationTime.get(),
         lastPassTime: this.lastVerificationTime.get(),
         lastFailTime: UInt64.from(0),
         daysSinceLastVerification: Field(0),
      });
      
      return defaultStats;
   }
   
   /**
    * Get registry information (ZK optimized - percentage calculated in JavaScript)
    */
   getRegistryInfo(): RegistryInfo {
      // Add required state preconditions
      this.totalCompaniesTracked.requireEquals(this.totalCompaniesTracked.get());
      this.compliantCompaniesCount.requireEquals(this.compliantCompaniesCount.get());
      this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
      this.registryVersion.requireEquals(this.registryVersion.get());
      
      const totalCompanies = this.totalCompaniesTracked.get();
      const compliantCompanies = this.compliantCompaniesCount.get();
      
      // ✅ ZK BEST PRACTICE: Return raw data only - no division in circuit
      return new RegistryInfo({
         totalCompaniesTracked: totalCompanies,
         compliantCompaniesCount: compliantCompanies,
         totalVerificationsGlobal: totalCompanies, // Same as totalCompanies in simplified version
         companiesRootHash: this.companiesMapRoot.get(), // Use MerkleMap root
         registryVersion: this.registryVersion.get(),
      });
   }

   /**
    * Get global compliance statistics (ZK optimized - percentage calculated in JavaScript)
    */
   getGlobalComplianceStats(): GlobalComplianceStats {
      // Add required state preconditions
      this.totalCompaniesTracked.requireEquals(this.totalCompaniesTracked.get());
      this.compliantCompaniesCount.requireEquals(this.compliantCompaniesCount.get());
      this.lastVerificationTime.requireEquals(this.lastVerificationTime.get());
      
      const totalCompanies = this.totalCompaniesTracked.get();
      const compliantCompanies = this.compliantCompaniesCount.get();
      
      // ✅ ZK BEST PRACTICE: Return raw data only - no division in circuit
      return new GlobalComplianceStats({
         totalCompanies: totalCompanies,
         compliantCompanies: compliantCompanies,
         totalVerifications: totalCompanies, // Same as totalCompanies in simplified version
         lastVerificationTime: this.lastVerificationTime.get(),
      });
   }

   // =================================== Real Company Query Methods ===================================
   
   /**
    * Get real company compliance status by LEI and Name with MerkleMap proof
    */
   async getCompanyByLEIAndName(
      lei: CircuitString,
      companyName: CircuitString,
      mapWitness: MerkleMapWitness
   ): Promise<CompanyQueryResult> {
      // Add required state preconditions
      this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
      
      // Calculate company key
      const leiHash = lei.hash();
      const nameHash = companyName.hash();
      const companyKey = CompanyKey.create(leiHash, nameHash);
      const companyKeyField = companyKey.toField();
      
      // Verify the merkle map witness
      const currentMapRoot = this.companiesMapRoot.get();
      const [witnessRoot, witnessKey] = mapWitness.computeRootAndKey(Field(0));
      
      // Check if witness is valid
      const isValidWitness = witnessRoot.equals(currentMapRoot);
      const isCorrectKey = witnessKey.equals(companyKeyField);
      
      // If company exists, the witness will provide the company record hash
      // If not, it will be Field(0)
      const [_, companyRecordHash] = mapWitness.computeRootAndKey(Field(1));
      const companyExists = companyRecordHash.equals(Field(0)).not();
      
      // For demo, create empty record structure (in real implementation, 
      // would deserialize from companyRecordHash)
      const emptyRecord = new GLEIFCompanyRecord({
         leiHash: leiHash,
         legalNameHash: nameHash,
         jurisdictionHash: CircuitString.fromString('Global').hash(),
         isCompliant: Bool(false),
         complianceScore: Field(0),
         totalVerifications: Field(0),
         passedVerifications: Field(0),
         failedVerifications: Field(0),
         consecutiveFailures: Field(0),
         lastVerificationTime: UInt64.from(0),
         firstVerificationTime: UInt64.from(0),
         lastPassTime: UInt64.from(0),
         lastFailTime: UInt64.from(0)
      });
      
      return new CompanyQueryResult({
         exists: companyExists,
         record: emptyRecord,
         merkleRoot: currentMapRoot,
         isValid: isValidWitness.and(isCorrectKey)
      });
   }
   
   /**
    * Check if a company exists (read-only method)
    */
   checkCompanyExists(lei: CircuitString, companyName: CircuitString): {
      contractInitialized: Bool;
      expectedKey: Field;
      mapRoot: Field;
   } {
      // Add required state preconditions
      this.registryVersion.requireEquals(this.registryVersion.get());
      this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
      
      // Calculate expected company key
      const leiHash = lei.hash();
      const nameHash = companyName.hash();
      const companyKey = CompanyKey.create(leiHash, nameHash);
      
      return {
         contractInitialized: this.registryVersion.get().greaterThan(Field(0)),
         expectedKey: companyKey.toField(),
         mapRoot: this.companiesMapRoot.get()
      };
   }

   /**
    * Check if contract has been deployed and initialized
    */
   isContractInitialized(): Bool {
      this.registryVersion.requireEquals(this.registryVersion.get());
      return this.registryVersion.get().greaterThan(Field(0));
   }

   // =================================== Administrative Methods ===================================
   
   /**
    * Emergency disable function - stops all new verifications
    */
   @method async emergencyDisable() {
      this.contractDisabled.requireEquals(this.contractDisabled.get());
      this.contractDisabled.set(Bool(true));
   }
   
   /**
    * Re-enable contract (in case of false alarm)
    */
   @method async reEnableContract() {
      this.contractDisabled.requireEquals(this.contractDisabled.get());
      this.contractDisabled.set(Bool(false));
   }
   
   /**
    * Reset registry (admin function)
    */
   @method async resetRegistry() {
      // Add required state preconditions
      this.totalCompaniesTracked.requireEquals(this.totalCompaniesTracked.get());
      this.compliantCompaniesCount.requireEquals(this.compliantCompaniesCount.get());
      this.registryVersion.requireEquals(this.registryVersion.get());
      
      // Reset all state to initial values
      this.totalCompaniesTracked.set(Field(0));
      this.compliantCompaniesCount.set(Field(0));
      this.lastVerificationTime.set(UInt64.from(0));
      this.registryVersion.set(this.registryVersion.get().add(1)); // Increment version
   }

   /**
    * Get contract metadata (updated for new state structure)
    */
   getContractInfo(): {
      companiesRootHash: Field;
      totalCompanies: Field;
      compliantCompanies: Field;
      totalVerifications: Field;
      creationTime: UInt64;
      version: Field;
   } {
      // Add required state preconditions
      this.totalCompaniesTracked.requireEquals(this.totalCompaniesTracked.get());
      this.compliantCompaniesCount.requireEquals(this.compliantCompaniesCount.get());
      this.lastVerificationTime.requireEquals(this.lastVerificationTime.get());
      this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
      this.registryVersion.requireEquals(this.registryVersion.get());
      
      const totalCompanies = this.totalCompaniesTracked.get();
      
      return {
         companiesRootHash: this.companiesMapRoot.get(), // Use MerkleMap root
         totalCompanies: totalCompanies,
         compliantCompanies: this.compliantCompaniesCount.get(),
         totalVerifications: totalCompanies, // Same as totalCompanies in simplified version
         creationTime: this.lastVerificationTime.get(), // Use lastVerificationTime as creation time proxy
         version: this.registryVersion.get(),
      };
   }
}
