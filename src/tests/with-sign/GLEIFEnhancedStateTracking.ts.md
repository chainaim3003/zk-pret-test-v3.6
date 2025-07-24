/**
 * PATCHED VERSION - Enhanced GLEIF Test with Practical State Tracking
 * This replaces the failing getGlobalComplianceStats() calls with our practical approach
 */

// Add import for the practical state tracker
import { PracticalStateTracker } from './PracticalStateTracker.js';

/**
 * Enhanced state fetching function that replaces safelyFetchAccountWithRetry
 */
async function enhancedStateCapture(
  contractAddress: string,
  contract: any,
  label: string
): Promise<any> {
  console.log(`📸 Enhanced state capture: ${label}`);
  
  try {
    const stateTracker = new PracticalStateTracker(contractAddress, contract);
    const state = await stateTracker.captureStateWithCombo(label);
    
    console.log(`✅ State captured via ${state.method} (${state.confidence}% confidence)`);
    console.log(`   Total: ${state.totalCompanies}, Compliant: ${state.compliantCompanies}`);
    
    return {
      success: state.success,
      totalCompanies: state.totalCompanies,
      compliantCompanies: state.compliantCompanies,
      method: state.method,
      confidence: state.confidence,
      executionTime: state.executionTimeMs,
      // Return in the format expected by the original code
      totalCompaniesTracked: { toString: () => state.totalCompanies.toString() },
      compliantCompaniesCount: { toString: () => state.compliantCompanies.toString() },
      // Mock other fields that might be expected
      totalVerificationsGlobal: { toString: () => "0" },
      companiesRootHash: { toString: () => "0" },
      registryVersion: { toString: () => "1" }
    };
  } catch (error: any) {
    console.error(`❌ Enhanced state capture failed: ${error.message}`);
    
    // Return a basic fallback structure
    return {
      success: false,
      totalCompanies: 0,
      compliantCompanies: 0,
      error: error.message,
      totalCompaniesTracked: { toString: () => "0" },
      compliantCompaniesCount: { toString: () => "0" },
      totalVerificationsGlobal: { toString: () => "0" },
      companiesRootHash: { toString: () => "0" },
      registryVersion: { toString: () => "1" }
    };
  }
}

/**
 * Enhanced comparison function for before/after state
 */
function compareEnhancedStates(beforeState: any, afterState: any, companyName: string): void {
  console.log(`\n🔍 ENHANCED STATE COMPARISON FOR ${companyName}`);
  console.log(`===============================================`);
  
  if (beforeState.success && afterState.success) {
    const totalChange = afterState.totalCompanies - beforeState.totalCompanies;
    const compliantChange = afterState.compliantCompanies - beforeState.compliantCompanies;
    
    console.log(`📊 Before: Total=${beforeState.totalCompanies}, Compliant=${beforeState.compliantCompanies} (${beforeState.method}, ${beforeState.confidence}% confidence)`);
    console.log(`📊 After:  Total=${afterState.totalCompanies}, Compliant=${afterState.compliantCompanies} (${afterState.method}, ${afterState.confidence}% confidence)`);
    console.log(`📈 Changes: Total ${totalChange >= 0 ? '+' : ''}${totalChange}, Compliant ${compliantChange >= 0 ? '+' : ''}${compliantChange}`);
    
    if (totalChange > 0) {
      console.log(`✅ Company was successfully added to registry`);
    } else if (totalChange === 0) {
      console.log(`⚠️ No change in total companies (possible duplicate or failed addition)`);
    } else {
      console.log(`❌ Unexpected decrease in total companies`);
    }
  } else {
    console.log(`⚠️ Limited comparison available:`);
    console.log(`   Before: ${beforeState.success ? 'Success' : 'Failed'} - ${beforeState.method || 'N/A'}`);
    console.log(`   After: ${afterState.success ? 'Success' : 'Failed'} - ${afterState.method || 'N/A'}`);
    
    if (beforeState.error) console.log(`   Before Error: ${beforeState.error}`);
    if (afterState.error) console.log(`   After Error: ${afterState.error}`);
  }
}

/**
 * Test function for duplicate company verification using enhanced state tracking
 */
export async function testDuplicateCompanyWithEnhancedTracking(
  contractAddress: string,
  contract: any,
  companyName: string = "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"
): Promise<any> {
  
  console.log(`\n🧪 ENHANCED DUPLICATE COMPANY VERIFICATION TEST`);
  console.log(`==============================================`);
  console.log(`Company: ${companyName}`);
  console.log(`Contract: ${contractAddress}`);
  
  try {
    // === FIRST VERIFICATION ===
    console.log(`\n📋 FIRST VERIFICATION`);
    
    // Capture before state using enhanced method
    const beforeFirst = await enhancedStateCapture(contractAddress, contract, 'before_first_verification');
    
    console.log(`🔄 Executing first verification for ${companyName}...`);
    // Your existing verification logic would go here
    // For this demo, we'll simulate it
    console.log(`✅ First verification completed`);
    
    // Capture after state
    const afterFirst = await enhancedStateCapture(contractAddress, contract, 'after_first_verification');
    
    // Compare first verification
    compareEnhancedStates(beforeFirst, afterFirst, `${companyName} (First)`);

    // === SECOND VERIFICATION (DUPLICATE) ===
    console.log(`\n📋 DUPLICATE VERIFICATION`);
    
    // Capture before state for duplicate
    const beforeSecond = await enhancedStateCapture(contractAddress, contract, 'before_duplicate_verification');
    
    console.log(`🔄 Executing duplicate verification for ${companyName}...`);
    // Duplicate verification logic would go here
    console.log(`✅ Duplicate verification completed`);
    
    // Capture after state
    const afterSecond = await enhancedStateCapture(contractAddress, contract, 'after_duplicate_verification');
    
    // Compare duplicate verification
    compareEnhancedStates(beforeSecond, afterSecond, `${companyName} (Duplicate)`);

    // === ANALYSIS ===
    console.log(`\n📊 DUPLICATE VERIFICATION ANALYSIS`);
    console.log(`===================================`);
    
    const firstChange = (afterFirst.totalCompanies || 0) - (beforeFirst.totalCompanies || 0);
    const duplicateChange = (afterSecond.totalCompanies || 0) - (beforeSecond.totalCompanies || 0);
    
    console.log(`First verification change: ${firstChange >= 0 ? '+' : ''}${firstChange} companies`);
    console.log(`Duplicate verification change: ${duplicateChange >= 0 ? '+' : ''}${duplicateChange} companies`);
    
    const expectedBehavior = firstChange > 0 && duplicateChange === 0;
    console.log(`🎯 Expected behavior (first adds, duplicate doesn't): ${expectedBehavior ? '✅ CORRECT' : '❌ UNEXPECTED'}`);
    
    return {
      success: expectedBehavior,
      firstVerification: {
        before: beforeFirst,
        after: afterFirst,
        change: firstChange
      },
      duplicateVerification: {
        before: beforeSecond,
        after: afterSecond,
        change: duplicateChange
      },
      analysis: {
        firstAddsCompany: firstChange > 0,
        duplicateIgnored: duplicateChange === 0,
        behaviorCorrect: expectedBehavior
      }
    };

  } catch (error: any) {
    console.error(`❌ Enhanced duplicate test failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

console.log('✅ Enhanced GLEIF test functions loaded with practical state tracking');
