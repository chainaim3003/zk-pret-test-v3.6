import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Signature,
  Bool,
  UInt64,
  Permissions,
  PublicKey,
  Poseidon,
} from 'o1js';
import { 
  GLEIFEnhancedComplianceData,
  GLEIFEnhancedZKProgram,
  GLEIFEnhancedProof
} from '../../zk-programs/with-sign/GLEIFEnhancedZKProgramWithSign.js';
import { getPublicKeyFor } from '../../core/OracleRegistry.js';

/**
 * Enhanced Smart Contract that supports BOTH:
 * 1. Direct parameter verification (existing functionality)
 * 2. ZK proof verification (new off-chain capability)
 */
export class GLEIFEnhancedVerifierWithZKProofSmartContract extends SmartContract {
  // Existing state variables (preserves compatibility)
  @state(Bool) isGLEIFCompliant = State<Bool>();
  @state(Field) complianceScore = State<Field>();
  @state(Field) riskLevel = State<Field>();
  @state(UInt64) lastVerificationTimestamp = State<UInt64>();
  @state(Field) totalVerifications = State<Field>();
  
  // New state variables for ZK proof tracking
  @state(Field) totalZKProofVerifications = State<Field>();
  @state(Bool) lastVerificationWasZKProof = State<Bool>();
  @state(Field) zkProofVerificationHash = State<Field>();

  init() {
    super.init();
    // Initialize existing state (preserves compatibility)
    this.isGLEIFCompliant.set(Bool(false));
    this.complianceScore.set(Field(0));
    this.riskLevel.set(Field(5));
    this.lastVerificationTimestamp.set(UInt64.from(0));
    this.totalVerifications.set(Field(0));
    
    // Initialize new ZK proof state
    this.totalZKProofVerifications.set(Field(0));
    this.lastVerificationWasZKProof.set(Bool(false));
    this.zkProofVerificationHash.set(Field(0));
    
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  // EXISTING METHOD - Direct parameter verification (preserves all existing functionality)
  @method async verifyGLEIFComplianceWithParams(
    complianceData: GLEIFEnhancedComplianceData,
    oracleSignature: Signature
  ) {
    // Verify oracle signature (existing logic)
    const dataHash = Poseidon.hash(GLEIFEnhancedComplianceData.toFields(complianceData));
    const registryPublicKey = getPublicKeyFor('GLEIF');
    
    const isValidSignature = oracleSignature.verify(registryPublicKey, [dataHash]);
    isValidSignature.assertTrue();

    // Verify business rules using efficient operations (existing logic)
    const isCompliant = complianceData.isCompliant();

    // Update contract state (existing logic)
    this.isGLEIFCompliant.set(isCompliant);
    this.complianceScore.set(complianceData.complianceScore);
    this.riskLevel.set(complianceData.riskLevel);
    this.lastVerificationTimestamp.set(complianceData.lastVerificationTimestamp);
    this.lastVerificationWasZKProof.set(Bool(false)); // Mark as direct verification

    // Increment verification count (existing logic)
    const currentCount = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentCount.add(Field(1)));
  }

  // NEW METHOD - ZK proof verification (adds new capability without breaking existing)
  @method async verifyGLEIFComplianceWithZKProof(
    proof: GLEIFEnhancedProof
  ) {
    // Verify the ZK proof
    proof.verify();

    // Extract verified data from the proof's public output
    const publicOutput = proof.publicOutput;
    
    // Update contract state with ZK-verified results
    this.isGLEIFCompliant.set(publicOutput.isCompliant);
    this.complianceScore.set(publicOutput.complianceScore);
    this.riskLevel.set(publicOutput.riskLevel);
    this.lastVerificationTimestamp.set(UInt64.from(Date.now()));
    this.lastVerificationWasZKProof.set(Bool(true)); // Mark as ZK proof verification

    // Create a hash of the proof for tracking
    const proofHash = Poseidon.hash([
      publicOutput.name.hash(),
      publicOutput.id.hash(),
      publicOutput.complianceScore,
      publicOutput.riskLevel
    ]);
    this.zkProofVerificationHash.set(proofHash);

    // Increment both total and ZK proof verification counts
    const currentCount = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentCount.add(Field(1)));
    
    const currentZKCount = this.totalZKProofVerifications.getAndRequireEquals();
    this.totalZKProofVerifications.set(currentZKCount.add(Field(1)));
  }

  // NEW METHOD - Batch verification combining both approaches
  @method async verifyBatchGLEIFCompliance(
    // Direct verification data
    complianceData: GLEIFEnhancedComplianceData,
    oracleSignature: Signature,
    // ZK proof data
    zkProof: GLEIFEnhancedProof
  ) {
    // Verify both the direct parameters AND the ZK proof
    
    // 1. Direct verification
    const dataHash = Poseidon.hash(GLEIFEnhancedComplianceData.toFields(complianceData));
    const registryPublicKey = getPublicKeyFor('GLEIF');
    const isValidSignature = oracleSignature.verify(registryPublicKey, [dataHash]);
    isValidSignature.assertTrue();
    
    // 2. ZK proof verification
    zkProof.verify();
    
    // 3. Cross-validate that both methods agree
    const directCompliant = complianceData.isCompliant();
    const zkCompliant = zkProof.publicOutput.isCompliant;
    const methodsAgree = directCompliant.equals(zkCompliant);
    methodsAgree.assertTrue();
    
    // 4. Update state with the agreed-upon results
    this.isGLEIFCompliant.set(directCompliant);
    this.complianceScore.set(complianceData.complianceScore);
    this.riskLevel.set(complianceData.riskLevel);
    this.lastVerificationTimestamp.set(UInt64.from(Date.now()));
    this.lastVerificationWasZKProof.set(Bool(true)); // Mark as enhanced verification
    
    // 5. Update all counters
    const currentCount = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentCount.add(Field(1)));
    
    const currentZKCount = this.totalZKProofVerifications.getAndRequireEquals();
    this.totalZKProofVerifications.set(currentZKCount.add(Field(1)));
  }

  // ENHANCED METHOD - Get comprehensive contract statistics (NOT a @method)
  getEnhancedContractStats(): {
    isGLEIFCompliant: Bool;
    complianceScore: Field;
    riskLevel: Field;
    lastVerificationTimestamp: UInt64;
    totalVerifications: Field;
    totalZKProofVerifications: Field;
    lastVerificationWasZKProof: Bool;
    zkProofVerificationHash: Field;
  } {
    return {
      isGLEIFCompliant: this.isGLEIFCompliant.getAndRequireEquals(),
      complianceScore: this.complianceScore.getAndRequireEquals(),
      riskLevel: this.riskLevel.getAndRequireEquals(),
      lastVerificationTimestamp: this.lastVerificationTimestamp.getAndRequireEquals(),
      totalVerifications: this.totalVerifications.getAndRequireEquals(),
      totalZKProofVerifications: this.totalZKProofVerifications.getAndRequireEquals(),
      lastVerificationWasZKProof: this.lastVerificationWasZKProof.getAndRequireEquals(),
      zkProofVerificationHash: this.zkProofVerificationHash.getAndRequireEquals(),
    };
  }

  // PRESERVED METHOD - Original contract stats for backward compatibility
  getContractStats() {
    return {
      isGLEIFCompliant: this.isGLEIFCompliant.getAndRequireEquals(),
      riskMitigationBase: Field(0), // Keeping for compatibility
      totalVerifications: this.totalVerifications.getAndRequireEquals(),
    };
  }

  // NEW METHOD - Verify compliance history consistency
  @method async verifyComplianceHistory(
    previousProofHash: Field,
    currentProof: GLEIFEnhancedProof
  ) {
    // Verify the new proof
    currentProof.verify();
    
    // Verify it builds on the previous verification
    const storedHash = this.zkProofVerificationHash.getAndRequireEquals();
    storedHash.assertEquals(previousProofHash);
    
    // Update with new verification
    const newProofHash = Poseidon.hash([
      currentProof.publicOutput.name.hash(),
      currentProof.publicOutput.id.hash(),
      currentProof.publicOutput.complianceScore,
      currentProof.publicOutput.riskLevel
    ]);
    
    this.zkProofVerificationHash.set(newProofHash);
    this.isGLEIFCompliant.set(currentProof.publicOutput.isCompliant);
    this.lastVerificationTimestamp.set(UInt64.from(Date.now()));
    
    const currentCount = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentCount.add(Field(1)));
  }
}