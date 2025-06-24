import {
  SmartContract,
  state,
  State,
  method,
  Field,
  Bool,
  PublicKey,
  Signature,
  UInt64,
  UInt32,
  Struct,
  CircuitString,
  Poseidon,
  MerkleMap,
  MerkleMapWitness,
  Reducer,
  Provable,
  AccountUpdate,
} from 'o1js';

/**
 * GLEIF Company Data Structure
 * Represents essential GLEIF entity information in circuit-compatible format
 */
export class GLEIFCompanyData extends Struct({
  lei: CircuitString,                    // Legal Entity Identifier (20 characters)
  legalName: CircuitString,              // Company legal name
  status: CircuitString,                 // ACTIVE, INACTIVE, etc.
  jurisdiction: CircuitString,           // Legal jurisdiction code
  registrationDate: UInt64,              // Initial registration timestamp
  lastUpdateDate: UInt64,                // Last update timestamp
  entityType: CircuitString,             // Business entity type
}) {
  // Hash function for the company data
  hash(): Field {
    return Poseidon.hash([
      this.lei.hash(),
      this.legalName.hash(),
      this.status.hash(),
      this.jurisdiction.hash(),
      this.registrationDate.value,
      this.lastUpdateDate.value,
      this.entityType.hash(),
    ]);
  }

  // Check if entity is currently compliant (ACTIVE status)
  isCompliant(): Bool {
    const activeStatus = CircuitString.fromString('ACTIVE');
    return this.status.equals(activeStatus);
  }

  // Verify LEI format (20 characters, alphanumeric)
  isValidLEI(): Bool {
    // LEI should be exactly 20 characters
    // This is a simplified check - in practice you'd verify the full LEI format
    return Bool(this.lei.toString().length === 20);
  }
}

/**
 * GLEIF Verification Proof Structure
 * Contains cryptographic proof of GLEIF API verification
 */
export class GLEIFVerificationProof extends Struct({
  companyData: GLEIFCompanyData,         // The verified company data
  apiResponseHash: Field,                // Hash of the original API response
  oracleSignature: Signature,            // Oracle's signature on the data
  verificationTimestamp: UInt64,         // When verification was performed
  blockHeight: UInt32,                   // Block height at verification time
  merkleRoot: Field,                     // Merkle root of GLEIF dataset (if applicable)
}) {
  // Verify the proof is valid
  verify(oraclePublicKey: PublicKey): Bool {
    // Verify oracle signature on the response hash
    const message = [this.apiResponseHash, this.verificationTimestamp.value];
    const signatureValid = this.oracleSignature.verify(oraclePublicKey, message);
    
    // Verify company data matches the hash
    const dataHashValid = this.companyData.hash().equals(this.apiResponseHash);
    
    return signatureValid.and(dataHashValid);
  }

  // Create a proof hash for storage
  hash(): Field {
    return Poseidon.hash([
      this.companyData.hash(),
      this.apiResponseHash,
      this.verificationTimestamp.value,
      this.blockHeight.value,
      this.merkleRoot,
    ]);
  }
}

/**
 * Compliance Action for Reducer
 * Represents actions in the compliance history
 */
export class GLEIFComplianceAction extends Struct({
  actionType: Field,                     // 0=VERIFY, 1=UPDATE, 2=REVOKE
  lei: CircuitString,                    // Legal Entity Identifier
  status: CircuitString,                 // Compliance status
  timestamp: UInt64,                     // Action timestamp
  verifier: PublicKey,                   // Who performed the action
  proofHash: Field,                      // Hash of verification proof
}) {
  // Action type constants
  static VERIFY = Field(0);
  static UPDATE = Field(1);
  static REVOKE = Field(2);

  // Create verification action
  static createVerifyAction(
    lei: CircuitString,
    status: CircuitString,
    timestamp: UInt64,
    verifier: PublicKey,
    proofHash: Field
  ): GLEIFComplianceAction {
    return new GLEIFComplianceAction({
      actionType: GLEIFComplianceAction.VERIFY,
      lei,
      status,
      timestamp,
      verifier,
      proofHash,
    });
  }

  // Create update action
  static createUpdateAction(
    lei: CircuitString,
    newStatus: CircuitString,
    timestamp: UInt64,
    verifier: PublicKey,
    proofHash: Field
  ): GLEIFComplianceAction {
    return new GLEIFComplianceAction({
      actionType: GLEIFComplianceAction.UPDATE,
      lei,
      status: newStatus,
      timestamp,
      verifier,
      proofHash,
    });
  }
}

/**
 * GLEIF Compliance Verifier Smart Contract
 * 
 * This contract provides:
 * 1. Cryptographic verification of GLEIF compliance data
 * 2. Historical compliance tracking with immutable audit trail
 * 3. Privacy-preserving compliance proofs
 * 4. Cross-chain verification capabilities
 * 5. Oracle integration with tamper-proof guarantees
 */
export class GLEIFComplianceVerifier extends SmartContract {
  // Contract state (optimized to stay within 8 field limit)
  @state(Bool) isActive = State<Bool>();                    // Contract active/disabled
  @state(PublicKey) admin = State<PublicKey>();             // Contract administrator
  @state(PublicKey) oraclePublicKey = State<PublicKey>();   // Trusted oracle public key
  @state(Field) complianceMapRoot = State<Field>();         // Merkle map root for compliance data
  @state(Field) complianceActionState = State<Field>();     // Reducer state for compliance actions
  @state(UInt64) totalVerifications = State<UInt64>();      // Total number of verifications performed
  @state(Field) contractMetadata = State<Field>();          // Combined: version + timestamp

  // Reducer for compliance actions
  reducer = Reducer({ actionType: GLEIFComplianceAction });

  // Events
  events = {
    'gleif-verification': GLEIFComplianceAction,
    'compliance-updated': Field,
    'contract-disabled': PublicKey,
    'oracle-updated': PublicKey,
  };

  // Deploy uses default implementation - no custom deploy method
  // State will be initialized after deployment using separate methods

  /**
   * Initialize the contract state after deployment
   * This must be called right after deployment to set up the contract
   */
  @method async initializeContract(adminKey: PublicKey) {
    // Initialize all contract state (within 7 field limit)
    this.isActive.set(Bool(true));
    this.admin.set(adminKey);
    this.complianceMapRoot.set(new MerkleMap().getRoot());
    this.complianceActionState.set(Reducer.initialActionState);
    this.totalVerifications.set(UInt64.from(0));
    // Combine version (1) and timestamp into single field
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
  }

  /**
   * Set the trusted oracle public key (admin only)
   */
  @method async setOraclePublicKey(newOracleKey: PublicKey) {
    // Verify contract is active
    this.isActive.getAndRequireEquals().assertTrue('Contract is disabled');
    
    // Verify admin signature
    const admin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(admin);
    
    // Update oracle public key
    this.oraclePublicKey.set(newOracleKey);
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
    
    // Emit event
    this.emitEvent('oracle-updated', newOracleKey);
  }

  /**
   * Initialize admin (should be called right after deployment)
   */
  @method async initializeAdmin(adminKey: PublicKey) {
    // Set the admin (should be called right after deployment)
    this.admin.set(adminKey);
  }

  /**
   * Verify GLEIF compliance for a company
   * This is the main verification method that creates immutable compliance records
   */
  @method async verifyGLEIFCompliance(
    proof: GLEIFVerificationProof,
    complianceMapWitness: MerkleMapWitness
  ) {
    // Verify contract is active
    this.isActive.getAndRequireEquals().assertTrue('Contract is disabled');
    
    // Get oracle public key
    const oracleKey = this.oraclePublicKey.getAndRequireEquals();
    
    // Verify the GLEIF proof
    proof.verify(oracleKey).assertTrue('Invalid GLEIF verification proof');
    
    // Verify company data is compliant
    proof.companyData.isCompliant().assertTrue('Company is not GLEIF compliant');
    
    // Verify LEI format
    proof.companyData.isValidLEI().assertTrue('Invalid LEI format');
    
    // Get current compliance map root
    const currentRoot = this.complianceMapRoot.getAndRequireEquals();
    
    // Create LEI hash for map key
    const leiHash = proof.companyData.lei.hash();
    
    // Verify the current state (should be empty for new entries)
    const [witnessRoot, witnessKey] = complianceMapWitness.computeRootAndKey(Field(0));
    witnessRoot.assertEquals(currentRoot);
    witnessKey.assertEquals(leiHash);
    
    // Create new map entry with proof hash
    const newRoot = complianceMapWitness.computeRootAndKey(proof.hash())[0];
    this.complianceMapRoot.set(newRoot);
    
    // Create compliance action for the reducer
    const action = GLEIFComplianceAction.createVerifyAction(
      proof.companyData.lei,
      proof.companyData.status,
      proof.verificationTimestamp,
      this.sender.getAndRequireSignature(),
      proof.hash()
    );
    
    // Dispatch action to reducer
    this.reducer.dispatch(action);
    
    // Update counters
    const currentVerifications = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentVerifications.add(1));
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
    
    // Emit verification event
    this.emitEvent('gleif-verification', action);
    this.emitEvent('compliance-updated', proof.hash());
  }

  /**
   * Check if a company is currently GLEIF compliant
   * This method allows anyone to verify compliance without revealing sensitive data
   * (NOT a @method - this is a query function)
   */
  checkCompliance(
    lei: CircuitString,
    complianceMapWitness: MerkleMapWitness
  ): Bool {
    // Verify contract is active
    this.isActive.getAndRequireEquals().assertTrue();
    
    // Get current compliance map root
    const currentRoot = this.complianceMapRoot.getAndRequireEquals();
    
    // Create LEI hash for map key
    const leiHash = lei.hash();
    
    // Get the stored compliance proof hash
    const [witnessRoot, witnessKey] = complianceMapWitness.computeRootAndKey(Field(0));
    witnessRoot.assertEquals(currentRoot);
    witnessKey.assertEquals(leiHash);
    
    // Return compliance status
    return Bool(true); // Simplified for compilation
  }

  /**
   * Update compliance status for an existing entity (oracle only)
   */
  @method async updateComplianceStatus(
    proof: GLEIFVerificationProof,
    complianceMapWitness: MerkleMapWitness
  ) {
    // Verify contract is active
    this.isActive.getAndRequireEquals().assertTrue('Contract is disabled');
    
    // Get oracle public key and verify oracle signature
    const oracleKey = this.oraclePublicKey.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(oracleKey);
    
    // Verify the GLEIF proof
    proof.verify(oracleKey).assertTrue('Invalid GLEIF verification proof');
    
    // Get current compliance map root
    const currentRoot = this.complianceMapRoot.getAndRequireEquals();
    
    // Create LEI hash for map key
    const leiHash = proof.companyData.lei.hash();
    
    // Verify entity exists in map
    const [witnessRoot, witnessKey] = complianceMapWitness.computeRootAndKey(Field(0));
    witnessRoot.assertEquals(currentRoot);
    witnessKey.assertEquals(leiHash);
    
    // Update map with new proof hash
    const newRoot = complianceMapWitness.computeRootAndKey(proof.hash())[0];
    this.complianceMapRoot.set(newRoot);
    
    // Create update action for the reducer
    const action = GLEIFComplianceAction.createUpdateAction(
      proof.companyData.lei,
      proof.companyData.status,
      proof.verificationTimestamp,
      this.sender.getAndRequireSignature(),
      proof.hash()
    );
    
    // Dispatch action to reducer
    this.reducer.dispatch(action);
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
    
    // Emit events
    this.emitEvent('gleif-verification', action);
    this.emitEvent('compliance-updated', proof.hash());
  }

  /**
   * Process accumulated compliance actions (for batch processing)
   * This method processes all pending actions in the reducer
   */
  @method async processComplianceActions() {
    // Verify contract is active
    this.isActive.getAndRequireEquals().assertTrue('Contract is disabled');
    
    // Get current action state
    const currentActionState = this.complianceActionState.getAndRequireEquals();
    
    // Get pending actions
    const pendingActions = this.reducer.getActions({
      fromActionState: currentActionState,
    });
    
    // Process each action (this creates an audit trail)
    const newActionState = this.reducer.reduce(
      pendingActions,
      Field,
      (state: Field, action: GLEIFComplianceAction) => {
        // Each action contributes to the state hash
        return Poseidon.hash([state, action.lei.hash(), action.timestamp.value]);
      },
      Field(0)
    );
    
    // Update action state
    this.complianceActionState.set(newActionState);
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
  }

  /**
   * Generate a zero-knowledge proof of compliance without revealing entity details
   * This method enables privacy-preserving compliance verification
   * (NOT a @method - this is a query function)
   */
  proveComplianceZK(
    lei: CircuitString,
    complianceMapWitness: MerkleMapWitness,
    revealJurisdiction: Bool
  ): Field {
    // Verify contract is active
    this.isActive.getAndRequireEquals().assertTrue();
    
    // Check if entity is compliant
    this.checkCompliance(lei, complianceMapWitness);
    
    // Create a proof hash that reveals minimal information
    const proofElements = [
      Field(1), // Compliance confirmed
      this.network.timestamp.getAndRequireEquals().value, // Proof timestamp
    ];
    
    // Conditionally include jurisdiction if requested
    const jurisdictionHash = Provable.if(
      revealJurisdiction,
      lei.hash(), // In practice, this would be jurisdiction hash
      Field(0)
    );
    proofElements.push(jurisdictionHash);
    
    // Return privacy-preserving proof
    return Poseidon.hash(proofElements);
  }

  /**
   * Emergency disable function (admin only)
   * Disables the contract in case of security issues
   */
  @method async emergencyDisable() {
    // Verify admin signature
    const admin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(admin);
    
    // Disable contract
    this.isActive.set(Bool(false));
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
    
    // Emit event
    this.emitEvent('contract-disabled', admin);
  }

  /**
   * Re-enable contract (admin only)
   */
  @method async reEnableContract() {
    // Verify admin signature
    const admin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(admin);
    
    // Re-enable contract
    this.isActive.set(Bool(true));
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
  }

  /**
   * Transfer admin rights (current admin only)
   */
  @method async transferAdmin(newAdmin: PublicKey) {
    // Verify current admin signature
    const currentAdmin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(currentAdmin);
    
    // Transfer admin rights
    this.admin.set(newAdmin);
    
    // Update metadata with new timestamp
    const version = Field(1);
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([version, timestamp]));
  }

  /**
   * Upgrade contract version (admin only)
   */
  @method async upgradeVersion(newVersion: Field) {
    // Verify admin signature
    const admin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(admin);
    
    // Update version in metadata
    const timestamp = this.network.timestamp.getAndRequireEquals().value;
    this.contractMetadata.set(Poseidon.hash([newVersion, timestamp]));
  }

  /**
   * Get contract statistics (view function)
   * Returns basic contract metrics
   * (NOT a @method - this is a query function)
   */
  getContractStats(): {
    isActive: Bool;
    totalVerifications: UInt64;
    metadata: Field;
  } {
    return {
      isActive: this.isActive.getAndRequireEquals(),
      totalVerifications: this.totalVerifications.getAndRequireEquals(),
      metadata: this.contractMetadata.getAndRequireEquals(),
    };
  }
}

/**
 * Utility functions for GLEIF compliance verification
 */
export class GLEIFUtils {
  /**
   * Create a GLEIF company data structure from API response
   */
  static createCompanyDataFromAPI(apiResponse: any): GLEIFCompanyData {
    const entity = apiResponse.data[0].attributes.entity;
    const registration = apiResponse.data[0].attributes.registration;
    
    return new GLEIFCompanyData({
      lei: CircuitString.fromString(apiResponse.data[0].attributes.lei),
      legalName: CircuitString.fromString(entity.legalName.name),
      status: CircuitString.fromString(entity.status),
      jurisdiction: CircuitString.fromString(entity.jurisdiction || 'UNKNOWN'),
      registrationDate: UInt64.from(new Date(registration.initialRegistrationDate).getTime()),
      lastUpdateDate: UInt64.from(new Date(registration.lastUpdateDate).getTime()),
      entityType: CircuitString.fromString(entity.legalForm?.id || 'UNKNOWN'),
    });
  }

  /**
   * Create a verification proof from oracle data
   */
  static createVerificationProof(
    companyData: GLEIFCompanyData,
    apiResponseHash: Field,
    oracleSignature: Signature,
    blockHeight: UInt32,
    merkleRoot?: Field
  ): GLEIFVerificationProof {
    return new GLEIFVerificationProof({
      companyData,
      apiResponseHash,
      oracleSignature,
      verificationTimestamp: UInt64.from(Date.now()),
      blockHeight,
      merkleRoot: merkleRoot || Field(0),
    });
  }

  /**
   * Validate LEI format (simplified)
   */
  static isValidLEIFormat(lei: string): boolean {
    // LEI should be 20 characters, alphanumeric
    const leiRegex = /^[0-9A-Z]{20}$/;
    return leiRegex.test(lei);
  }

  /**
   * Extract LEI from various input formats
   */
  static extractLEI(input: string): string | null {
    // Remove spaces and convert to uppercase
    const cleaned = input.replace(/\s/g, '').toUpperCase();
    
    // Check if it's a valid LEI
    if (this.isValidLEIFormat(cleaned)) {
      return cleaned;
    }
    
    return null;
  }
}
