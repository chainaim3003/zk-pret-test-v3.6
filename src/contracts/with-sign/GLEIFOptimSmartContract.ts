import { Field, SmartContract, state, State, method, Bool, CircuitString, UInt64 } from 'o1js';
import { GLEIFOptimProof } from '../../zk-programs/with-sign/GLEIFOptimZKProgram.js';

export class GLEIFOptimSmartContract extends SmartContract {
   // =================================== State Variables ===================================
   @state(Bool) GLEIFCompliant = State<Bool>();             // Main compliance status
   @state(Field) totalVerifications = State<Field>();       // Count of verifications performed
   @state(UInt64) lastVerificationTime = State<UInt64>();   // Timestamp of last verification

   // =================================== Initialize Contract ===================================
   init() {
      super.init();
      this.GLEIFCompliant.set(Bool(false));         // Start as non-compliant
      this.totalVerifications.set(Field(0));       // Zero verifications initially  
      this.lastVerificationTime.set(UInt64.from(0)); // No verification time
   }

   // =================================== Main Verification Method ===================================
   @method async verifyOptimizedComplianceWithProof(proof: GLEIFOptimProof) {
      // Ensure the state of GLEIFCompliant matches its current value (following the working pattern)
      this.GLEIFCompliant.requireEquals(this.GLEIFCompliant.get());
      this.totalVerifications.requireEquals(this.totalVerifications.get());
      
      // Get current state values
      const currentCompliantStatus = this.GLEIFCompliant.get();
      const currentVerificationCount = this.totalVerifications.get();

      // =================================== Verify ZK Proof ===================================
      proof.verify();

      // =================================== Extract Proof Data ===================================
      const publicOutput = proof.publicOutput;
      const isCompliant = publicOutput.isGLEIFCompliant;
      const verificationTimestamp = publicOutput.verification_timestamp;

      // =================================== Update Contract State ===================================
      // Update compliance status from proof result
      this.GLEIFCompliant.set(isCompliant);
      
      // Increment verification counter
      const newVerificationCount = currentVerificationCount.add(1);
      this.totalVerifications.set(newVerificationCount);
      
      // Update last verification timestamp
      this.lastVerificationTime.set(verificationTimestamp);
   }

   // =================================== Administrative Methods ===================================
   
   /**
    * Reset compliance status (admin function)
    */
   @method async resetCompliance() {
      this.GLEIFCompliant.requireEquals(this.GLEIFCompliant.get());
      this.GLEIFCompliant.set(Bool(false));
   }
}
