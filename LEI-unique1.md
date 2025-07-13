# LEI-Based Company Uniqueness Implementation Plan

## 🔍 Problem Analysis

**Current Behavior:**
- When a company is verified again, both `totalCompanies` and `totalVerifications` increase by 1
- The system treats every verification as a new company

**Required Behavior:**
- When a company (by LEI) is verified again, only `totalVerifications` should increase
- `totalCompanies` should only increase for new LEI IDs
- Companies should be identified uniquely by LEI ID, queryable by name or LEI

---

## 📁 Files Requiring Changes

### 🔧 **CRITICAL FILE 1**: `build/contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js`
**Location**: Lines 180-220 in `verifyOptimizedComplianceWithProof` method

**Current Problem Code:**
```javascript
// Simple counter increment (no duplicate detection for now)
const newTotalCompanies = currentTotalCompanies.add(1);
this.totalCompaniesTracked.set(newTotalCompanies);
```

**Required Changes:**

#### 1. **Add Company Existence Check Logic**
```javascript
// Before the current storage logic, add:

// Check if company already exists by LEI
const existingCompanyHash = companiesMapWitness.computeRootAndKeyV2(Field(0));
const companyExists = existingCompanyHash[1].equals(Field(0)).not();

// If company exists, get existing record for update
// If new company, increment total companies counter
const isNewCompany = companyExists.not();
const newTotalCompanies = isNewCompany.toField().equals(Field(1))
    ? currentTotalCompanies.add(1)
    : currentTotalCompanies;

this.totalCompaniesTracked.set(newTotalCompanies);
```

#### 2. **Modify Company Record Creation for Updates**
```javascript
// Replace the current enhancedCompanyRecord creation with:
const existingTotalVerifications = companyExists.toField().mul(/* existing count logic */);
const newTotalVerifications = existingTotalVerifications.add(Field(1));

const existingPassedVerifications = /* logic to get existing passed count */;
const newPassedVerifications = existingPassedVerifications.add(isCompliant.toField());

const existingFailedVerifications = /* logic to get existing failed count */;
const newFailedVerifications = existingFailedVerifications.add(isCompliant.not().toField());

const enhancedCompanyRecord = new GLEIFCompanyRecord({
    leiHash: companyRecord.leiHash,
    legalNameHash: companyRecord.legalNameHash,
    jurisdictionHash: companyRecord.jurisdictionHash,
    isCompliant: companyRecord.isCompliant,
    complianceScore: companyRecord.complianceScore,
    totalVerifications: newTotalVerifications,
    passedVerifications: newPassedVerifications,
    failedVerifications: newFailedVerifications,
    consecutiveFailures: isCompliant.toField().equals(Field(1)) ? Field(0) : existingConsecutiveFailures.add(Field(1)),
    lastVerificationTime: verificationTimestamp,
    firstVerificationTime: companyExists.toField().equals(Field(1)) ? existingFirstTime : verificationTimestamp,
    lastPassTime: isCompliant.toField().equals(Field(1)) ? verificationTimestamp : existingLastPassTime,
    lastFailTime: isCompliant.toField().equals(Field(0)) ? verificationTimestamp : existingLastFailTime,
});
```

#### 3. **Add Total Verification Tracking**
```javascript
// Add a new state field for total verifications across all companies
this.totalVerificationsGlobal = State(); // Add to constructor

// In the verification method, always increment total verifications
const currentTotalVerifications = this.totalVerificationsGlobal.get();
const newTotalVerifications = currentTotalVerifications.add(Field(1));
this.totalVerificationsGlobal.set(newTotalVerifications);
```

---

### 🔧 **CRITICAL FILE 2**: `build/tests/with-sign/GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSignUtils.js`
**Location**: Lines 1200-1400 in the verification transaction creation

**Required Changes:**

#### 1. **Modify LocalCompanyRegistry for LEI-based lookup**
```javascript
// In LocalCompanyRegistry class, modify addOrUpdateCompany method:

addOrUpdateCompany(lei, companyRecord) {
    let index;
    let isNewCompany = false;
    
    if (this.companyRecords.has(lei)) {
        // Update existing company - get existing record
        index = this.companyRecords.get(lei).index;
        const existingRecord = this.companyRecords.get(lei).record;
        
        // Update verification counts
        const newTotalVerifications = Number(existingRecord.totalVerifications.toString()) + 1;
        const newPassedVerifications = Number(existingRecord.passedVerifications.toString()) + 
                                     (companyRecord.isCompliant.toJSON() ? 1 : 0);
        const newFailedVerifications = Number(existingRecord.failedVerifications.toString()) + 
                                     (companyRecord.isCompliant.toJSON() ? 0 : 1);
        
        // Create updated record
        companyRecord = new GLEIFCompanyRecord({
            ...companyRecord,
            totalVerifications: Field(newTotalVerifications),
            passedVerifications: Field(newPassedVerifications),
            failedVerifications: Field(newFailedVerifications),
            firstVerificationTime: existingRecord.firstVerificationTime,
            lastPassTime: companyRecord.isCompliant.toJSON() ? companyRecord.lastVerificationTime : existingRecord.lastPassTime,
            lastFailTime: !companyRecord.isCompliant.toJSON() ? companyRecord.lastVerificationTime : existingRecord.lastFailTime,
        });
        
        console.log(`📝 Updating existing company at index ${index}: ${lei} (Verification #${newTotalVerifications})`);
    } else {
        // Add new company
        index = this.nextIndex++;
        isNewCompany = true;
        console.log(`➕ Adding new company at index ${index}: ${lei} (First verification)`);
    }
    
    // Rest of the method remains the same...
    
    return { witness: new CompanyMerkleWitness(this.companiesTree.getWitness(BigInt(index))), isNewCompany };
}
```

#### 2. **Update MerkleMapWitness Creation Logic**
```javascript
// Before creating the transaction, modify the companies map witness logic:

// Check if company exists in the map first
let companiesMapWitness;
let companyAlreadyExists = false;

// Try to get existing record by LEI
const existingCompanyData = companyRegistry.getCompanyRecord(lei);
if (existingCompanyData) {
    // Company exists - use existing map state
    companiesMapWitness = companiesMap.getWitness(companyKeyField);
    companyAlreadyExists = true;
    console.log(`🔄 Company exists - updating verification count`);
} else {
    // New company - use empty witness
    companiesMapWitness = companiesMap.getWitness(companyKeyField);
    console.log(`🆕 New company - will increment total companies`);
}
```

---

### 🔧 **FILE 3**: `build/contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js` (Constructor)
**Required Changes:**

#### Add Total Verifications State
```javascript
constructor() {
    super(...arguments);
    // =================================== Multi-Company State (7 fields maximum) ===================================
    this.totalCompaniesTracked = State(); // Total number of unique companies tracked
    this.compliantCompaniesCount = State(); // Number currently compliant
    this.totalVerificationsGlobal = State(); // NEW: Total verifications across all companies
    this.lastVerificationTime = State(); // Most recent verification timestamp
    this.companiesMapRoot = State(); // MerkleMap root for individual company storage
    this.registryVersion = State(); // Registry version for upgrades
    this.contractDisabled = State(); // Emergency disable flag
}
```

#### Update init() method
```javascript
init() {
    super.init();
    // Initialize company tracking
    this.totalCompaniesTracked.set(Field(0));
    this.compliantCompaniesCount.set(Field(0));
    this.totalVerificationsGlobal.set(Field(0)); // NEW: Initialize total verifications
    
    // Rest remains the same...
}
```

---

### 🔧 **FILE 4**: `build/contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js` (Query Methods)
**Required Changes:**

#### Update getGlobalComplianceStats method
```javascript
getGlobalComplianceStats() {
    // Add required state preconditions
    this.totalCompaniesTracked.requireEquals(this.totalCompaniesTracked.get());
    this.compliantCompaniesCount.requireEquals(this.compliantCompaniesCount.get());
    this.totalVerificationsGlobal.requireEquals(this.totalVerificationsGlobal.get()); // NEW
    this.lastVerificationTime.requireEquals(this.lastVerificationTime.get());

    const totalCompanies = this.totalCompaniesTracked.get();
    const compliantCompanies = this.compliantCompaniesCount.get();
    const totalVerifications = this.totalVerificationsGlobal.get(); // NEW

    return new GlobalComplianceStats({
        totalCompanies: totalCompanies,
        compliantCompanies: compliantCompanies,
        totalVerifications: totalVerifications, // Now returns actual total verifications
        lastVerificationTime: this.lastVerificationTime.get(),
    });
}
```

#### Add Company Query by LEI Method
```javascript
// Add new method for querying companies by LEI
async getCompanyByLEI(lei, mapWitness) {
    this.companiesMapRoot.requireEquals(this.companiesMapRoot.get());
    
    // Calculate company key using LEI only (could use dummy name hash)
    const leiHash = lei.hash();
    const dummyNameHash = CircuitString.fromString('').hash(); // Or use actual name if provided
    const companyKey = CompanyKey.create(leiHash, dummyNameHash);
    const companyKeyField = companyKey.toField();
    
    // Verify the merkle map witness
    const currentMapRoot = this.companiesMapRoot.get();
    const [witnessRoot, witnessKey] = mapWitness.computeRootAndKey(Field(0));
    
    const isValidWitness = witnessRoot.equals(currentMapRoot);
    const isCorrectKey = witnessKey.equals(companyKeyField);
    
    const [_, companyRecordHash] = mapWitness.computeRootAndKey(Field(1));
    const companyExists = companyRecordHash.equals(Field(0)).not();
    
    return new CompanyQueryResult({
        exists: companyExists,
        record: /* deserialize company record from hash */,
        merkleRoot: currentMapRoot,
        isValid: isValidWitness.and(isCorrectKey),
    });
}
```

---

### 🔧 **FILE 5**: `build/tests/with-sign/GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSignUtils.js` (Display Logic)
**Required Changes:**

#### Update State Display Logic
```javascript
// In the before/after state display sections, update to show the distinction:

console.log('\n📈 STATE CHANGES:');
console.log(`  📊 Total Companies (Unique LEIs): ${stateBefore.totalCompaniesTracked.toString()} → ${stateAfter.totalCompaniesTracked.toString()}`);
console.log(`  ✅ Compliant Companies: ${stateBefore.compliantCompaniesCount.toString()} → ${stateAfter.compliantCompaniesCount.toString()}`);
console.log(`  🔢 Total Verifications (All): ${stateBefore.totalVerificationsGlobal.toString()} → ${stateAfter.totalVerificationsGlobal.toString()}`);
console.log(`  📈 Global Compliance Score: ${stateBeforeWithPercentage.compliancePercentage}% → ${stateAfterWithPercentage.compliancePercentage}%`);

// Add logic to detect if this is a repeat verification
const leiAlreadyExists = /* check if LEI was already in registry */;
if (leiAlreadyExists) {
    console.log(`  🔄 REPEAT VERIFICATION: LEI ${complianceData.lei.toString()} was already verified`);
    console.log(`     ✅ Total Companies should remain the same: ${stateBefore.totalCompaniesTracked.toString()}`);
    console.log(`     📊 Total Verifications should increase by 1: ${Number(stateBefore.totalVerificationsGlobal.toString()) + 1}`);
} else {
    console.log(`  🆕 NEW COMPANY: LEI ${complianceData.lei.toString()} is being verified for the first time`);
    console.log(`     📈 Total Companies should increase by 1: ${Number(stateBefore.totalCompaniesTracked.toString()) + 1}`);
    console.log(`     📊 Total Verifications should increase by 1: ${Number(stateBefore.totalVerificationsGlobal.toString()) + 1}`);
}
```

---

## 🔍 Implementation Priority

### **Phase 1 - Critical Smart Contract Changes**
1. **File**: `GLEIFOptimMultiCompanySmartContract.js`
   - Add `totalVerificationsGlobal` state field
   - Implement company existence check in `verifyOptimizedComplianceWithProof`
   - Update verification counting logic
   - Modify `getGlobalComplianceStats` to return accurate counts

### **Phase 2 - Off-chain Logic Updates**  
2. **File**: `GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSignUtils.js`
   - Update `LocalCompanyRegistry.addOrUpdateCompany` method
   - Modify MerkleMapWitness creation logic
   - Update state display logic to show repeat vs new verification

### **Phase 3 - Query Enhancement**
3. **File**: `GLEIFOptimMultiCompanySmartContract.js`
   - Add `getCompanyByLEI` method for LEI-based queries
   - Implement name-based company lookup methods

---

## 🎯 Expected Behavior After Changes

### **First Verification of a Company**
- Total Companies: +1
- Total Verifications: +1  
- Company record created with verification count = 1

### **Subsequent Verifications of Same LEI**
- Total Companies: No change
- Total Verifications: +1
- Company record updated with incremented verification count

### **Query Capabilities**
- Find company by LEI ID
- Find company by name (if name stored in separate mapping)
- Show individual company verification history
- Show accurate global statistics

---

## ⚠️ Implementation Notes

1. **ZK Constraint Considerations**: The existence check logic must be efficiently implemented within ZK constraints
2. **MerkleMap State Management**: Proper witness handling for both new and existing companies
3. **Backward Compatibility**: Ensure existing deployed contracts can be updated or need redeployment
4. **Testing**: Verify behavior with both new and repeat verifications of the same LEI

This implementation will ensure that companies are uniquely identified by LEI ID and verification counts are properly maintained for both individual companies and global statistics.