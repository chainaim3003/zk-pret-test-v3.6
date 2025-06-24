import {
  Bool,
  Field,
  SmartContract,
  state,
  State,
  method,
  CircuitString,
  Struct,
  Signature,
  Poseidon,
  UInt64,
  UInt32,
  PublicKey,
  Provable,
  MerkleMap,
  MerkleMapWitness,
  Reducer,
} from 'o1js';

import {
  GLEIFEnhancedProof,
  GLEIFEnhancedZKProgram,
  GLEIFEnhancedComplianceData,
  GLEIFEnhancedPublicOutput,
} from '../../zk-programs/with-sign/GLEIFEnhancedZKProgramWithSign.js';

import { getPublicKeyFor } from '../../core/OracleRegistry.js';

// =================================== Simplified Compliance Action Structure ===================================
export class GLEIFSimplifiedComplianceAction extends Struct({
  actionType: Field,                     // Action type (VERIFY, UPDATE, etc.)
  leiHash: Field,                        // Hash of LEI string (1 field instead of 20+)
  companyNameHash: Field,                // Hash of company name (1 field instead of 50+)
  complianceScore: Field,                // Compliance score achieved
  riskLevel: Field,                      // Risk assessment level
  timestamp: UInt64,                     // Action timestamp
  verifier: PublicKey,                   // Who performed the action
  proofHash: Field,                      // Hash of verification proof
  // Total: 8 fields - well within 100 field limit
}) {
  // Action type constants
  static VERIFY = Field(0);
  static UPDATE = Field(1);
  static REVOKE = Field(2);
  static GROUP_VERIFY = Field(3);
  static HISTORICAL_VERIFY = Field(4);

  // Create verification action with hashed data
  static createVerifyAction(
    leiString: CircuitString,
    companyNameString: CircuitString,
    complianceScore: Field,
    riskLevel: Field,
    timestamp: UInt64,
    verifier: PublicKey,
    proofHash: Field
  ): GLEIFSimplifiedComplianceAction {
    return new GLEIFSimplifiedComplianceAction({
      actionType: GLEIFSimplifiedComplianceAction.VERIFY,
      leiHash: leiString.hash(),              // Hash instead of full string
      companyNameHash: companyNameString.hash(), // Hash instead of full string
      complianceScore,
      riskLevel,
      timestamp,
      verifier,
      proofHash,
    });
  }

  // Hash function for the action
  hash(): Field {
    return Poseidon.hash([
      this.actionType,
      this.leiHash,
      this.complianceScore,
      this.timestamp.value,
      this.proofHash,
    ]);
  }
}

// =================================== Enhanced GLEIF Smart Contract ===================================
export class GLEIFEnhancedVerifierSmartContractWithSign extends SmartContract {
  // Core state variables - SIMPLIFIED
  @state(Bool) isGLEIFCompliant = State<Bool>();          // Simple boolean for GLEIF compliance
  @state(Field) riskMitigationBase = State<Field>();      // Risk mitigation base indicator
  @state(Bool) smartContractActive = State<Bool>();       // Smart contract operational state
  @state(PublicKey) admin = State<PublicKey>();           // Contract administrator
  @state(Field) complianceMapRoot = State<Field>();       // Merkle map root for compliance data
  @state(Field) complianceActionState = State<Field>();   // Reducer state for compliance actions
  @state(UInt64) totalVerifications = State<UInt64>();    // Total number of verifications performed
  // REMOVED: lastUpdateTimestamp to stay within 8-field limit

  // Reducer for compliance actions (maintains history)
  reducer = Reducer({ actionType: GLEIFSimplifiedComplianceAction });

  // Simplified events for external monitoring
  events = {
    'compliance-verified': Field,              // Just emit compliance hash
    'smart-contract-disabled': PublicKey,
    'smart-contract-enabled': PublicKey,
  };

  // Initialize the contract state with explicit defaults
  init() {
    super.init();
    this.isGLEIFCompliant.set(Bool(false));                // Default: NOT GLEIF compliant until proven
    this.riskMitigationBase.set(Field(0));                 // Default: No risk mitigation
    this.smartContractActive.set(Bool(true));              // Default: Smart contract is operational
    this.admin.set(this.sender.getAndRequireSignature());
    this.complianceMapRoot.set(new MerkleMap().getRoot());
    this.complianceActionState.set(Reducer.initialActionState);
    this.totalVerifications.set(UInt64.from(0));
  }

  // =================================== PARAMS-BASED VERIFICATION METHODS ===================================

  /**
   * Verify GLEIF compliance with parameters (basic GLEIF checks only)
   */
  @method async verifyGLEIFComplianceWithParams(
    input: GLEIFEnhancedComplianceData,
    oracleSignature: Signature
  ) {
    // Ensure smart contract is active
    this.smartContractActive.getAndRequireEquals().assertTrue();
    this.isGLEIFCompliant.requireEquals(this.isGLEIFCompliant.get());
    
    // =================================== Oracle Signature Verification ===================================
    const complianceDataHash = Poseidon.hash(GLEIFEnhancedComplianceData.toFields(input));
    const registryPublicKey = getPublicKeyFor('GLEIF');
    const isValidSignature = oracleSignature.verify(
      registryPublicKey,
      [complianceDataHash]
    );
    isValidSignature.assertTrue();

    // =================================== Basic GLEIF Compliance Verification ===================================
    // Only basic GLEIF compliance checks - no complex risk/scoring logic
    const currentTimestamp = this.network.timestamp.getAndRequireEquals();
    const isBasicGLEIFCompliant = input.isBasicGLEIFCompliant(currentTimestamp);
    
    // Simple assertion - either compliant or not
    isBasicGLEIFCompliant.assertTrue();

    // Update simple boolean state
    this.isGLEIFCompliant.set(Bool(true));

    // Update counters
    const currentVerifications = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentVerifications.add(1));
    
    // Create and dispatch simplified compliance action
    const action = GLEIFSimplifiedComplianceAction.createVerifyAction(
      input.lei,
      input.name,
      input.complianceScore,
      input.riskLevel,
      currentTimestamp,
      this.sender.getAndRequireSignature(),
      complianceDataHash
    );
    
    this.reducer.dispatch(action);
    
    // Emit minimal verification event  
    this.emitEvent('compliance-verified', complianceDataHash);
  }

  /**
   * Verify GLEIF compliance using ZK Program proof (simple state update)
   * All complex business logic is handled in the ZK program off-chain
   */
  @method async verifyGLEIFComplianceWithZKProof(
    proof: GLEIFEnhancedProof
  ) {
    // Ensure smart contract is active
    this.smartContractActive.getAndRequireEquals().assertTrue();
    this.isGLEIFCompliant.requireEquals(this.isGLEIFCompliant.get());

    // Verify the ZK proof (all business logic was done off-chain)
    proof.verify();

    // Extract public outputs from the proof
    const publicOutput = proof.publicOutput;
    
    // Simple assertion based on ZK program result
    publicOutput.isCompliant.assertTrue('ZK program determined entity is not compliant');

    // Update simple boolean state based on proof
    this.isGLEIFCompliant.set(Bool(true));

    // Update verification counter
    const currentVerifications = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentVerifications.add(1));

    // Create simplified compliance action for history
    const action = GLEIFSimplifiedComplianceAction.createVerifyAction(
      publicOutput.id, // LEI from proof
      publicOutput.name, // Company name from proof
      publicOutput.complianceScore,
      publicOutput.riskLevel,
      this.network.timestamp.getAndRequireEquals(),
      this.sender.getAndRequireSignature(),
      publicOutput.verificationTimestamp.value
    );
    
    this.reducer.dispatch(action);
    
    // Emit minimal verification event
    this.emitEvent('compliance-verified', publicOutput.verificationTimestamp.value);
  }

  // =================================== ADMINISTRATIVE METHODS ===================================

  /**
   * Get contract statistics
   * (NOT a @method - this is a query function)
   */
  getContractStats(): {
    smartContractActive: Bool;
    isGLEIFCompliant: Bool;
    riskMitigationBase: Field;
    totalVerifications: UInt64;
  } {
    return {
      smartContractActive: this.smartContractActive.getAndRequireEquals(),
      isGLEIFCompliant: this.isGLEIFCompliant.getAndRequireEquals(),
      riskMitigationBase: this.riskMitigationBase.getAndRequireEquals(),
      totalVerifications: this.totalVerifications.getAndRequireEquals(),
    };
  }

  /**
   * Emergency disable smart contract (admin only)
   */
  @method async emergencyDisableSmartContract() {
    const admin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(admin);
    
    this.smartContractActive.set(Bool(false));
    // Note: lastUpdateTimestamp removed to fit o1js limit
    
    this.emitEvent('smart-contract-disabled', admin);
  }

  /**
   * Re-enable smart contract (admin only)
   */
  @method async enableSmartContract() {
    const admin = this.admin.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(admin);
    
    this.smartContractActive.set(Bool(true));
    // Note: lastUpdateTimestamp removed to fit o1js limit
    
    this.emitEvent('smart-contract-enabled', admin);
  }
}