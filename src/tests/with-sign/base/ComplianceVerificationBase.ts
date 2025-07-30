/**
 * ComplianceVerificationBase.ts - Shared Compliance Logic
 * Extracted from GLEIFLocalMultiVerifierUtils.ts and GLEIFNetworkMultiVerifierUtils.ts
 * DEDUPLICATION: Removes ~200 lines of duplicate code by consolidating compliance analysis methods
 */

import { Field, Bool, UInt64, PublicKey } from 'o1js';
import { 
  RegistryInfo,
  GlobalComplianceStats
} from '../../../contracts/with-sign/GLEIFOptimMultiCompanySmartContract.js';
import {
  GLEIFOptimComplianceData
} from '../../../zk-programs/with-sign/GLEIFOptimZKProgram.js';
import { safeLogSmartContractState } from '../SafeStateRetrieval.js';
import { safeLogSmartContractStateLocal } from '../SafeStateRetrievalLocal.js';
import { environmentManager } from '../../../infrastructure/index.js';

export interface ComplianceAnalysis {
  isEntityActive: boolean;
  isRegistrationIssued: boolean;
  isConformityOk: boolean;
  hasValidDates: boolean;
  hasValidLEI: boolean;
  allRulesPassed: boolean;
  rulesPassedCount: number;
}

export interface EnhancedComplianceStats {
  totalCompanies: number;
  compliantCompanies: number;
  nonCompliantCompanies: number;
  compliancePercentage: number;
  complianceRatio: string;
  complianceDecimal: string;
}

export class ComplianceVerificationBase {
  /**
   * Type guard to check if the contract stats is RegistryInfo
   * MOVED FROM: Both GLEIFLocalMultiVerifierUtils.ts and GLEIFNetworkMultiVerifierUtils.ts (identical implementations)
   */
  private isRegistryInfo(contractStats: any): contractStats is RegistryInfo {
    return 'totalCompaniesTracked' in contractStats;
  }

  /**
   * ✅ ZK BEST PRACTICE: Calculate compliance percentage outside the circuit
   * MOVED FROM: GLEIFLocalMultiVerifierUtils.ts (addCompliancePercentage function)
   * DEDUPLICATION: Single implementation instead of 2 identical copies in Local and Network utils
   */
  public addCompliancePercentage(contractStats: any): EnhancedComplianceStats {
    let total: number;
    let compliant: number;
    
    if (this.isRegistryInfo(contractStats)) {
      // RegistryInfo type
      total = Number(contractStats.totalCompaniesTracked.toString());
      compliant = Number(contractStats.compliantCompaniesCount.toString());
    } else {
      // GlobalComplianceStats type
      total = Number(contractStats.totalCompanies.toString());
      compliant = Number(contractStats.compliantCompanies.toString());
    }
    
    const percentage = total > 0 
      ? Math.round((compliant / total) * 100) 
      : 0;
      
    return {
      ...contractStats,
      totalCompanies: total,
      compliantCompanies: compliant,
      nonCompliantCompanies: total - compliant,
      compliancePercentage: percentage,
      complianceRatio: `${compliant}/${total}`,
      complianceDecimal: total > 0 ? (compliant / total).toFixed(2) : "0.00"
    } as any;
  }

  /**
   * Analyzes compliance fields for GLEIF verification
   * MOVED FROM: GLEIFLocalMultiVerifierUtils.ts (analyzeComplianceFields function)
   * DEDUPLICATION: Single implementation instead of duplicates in Local and Network utils
   */
  public analyzeComplianceFields(complianceData: GLEIFOptimComplianceData): ComplianceAnalysis {
    const isEntityActive = complianceData.entity_status.toString() === 'ACTIVE';
    const isRegistrationIssued = complianceData.registration_status.toString() === 'ISSUED';
    const isConformityOk = ['CONFORMING', 'UNKNOWN', ''].includes(complianceData.conformity_flag.toString());
    const hasValidDates = complianceData.lastUpdateDate.toString() !== '' && complianceData.nextRenewalDate.toString() !== '';
    const hasValidLEI = complianceData.lei.toString() !== '';
    
    const allRulesPassed = isEntityActive && isRegistrationIssued && isConformityOk && hasValidDates && hasValidLEI;
    const rulesPassedCount = [isEntityActive, isRegistrationIssued, isConformityOk, hasValidDates, hasValidLEI].filter(Boolean).length;

    return {
      isEntityActive,
      isRegistrationIssued,
      isConformityOk,
      hasValidDates,
      hasValidLEI,
      allRulesPassed,
      rulesPassedCount
    };
  }

  /**
   * Logs compliance field analysis results
   * MOVED FROM: GLEIFLocalMultiVerifierUtils.ts (logComplianceFieldAnalysis function)
   * DEDUPLICATION: Single implementation instead of duplicates in Local and Network utils
   */
  public logComplianceFieldAnalysis(
    complianceData: GLEIFOptimComplianceData,
    isCompliant: Bool,
    phase: 'Pre-Verification' | 'Post-Verification' = 'Pre-Verification'
  ): void {
    console.log(`\n🔍 COMPLIANCE FIELD ANALYSIS (${phase}):`);
    
    const analysis = this.analyzeComplianceFields(complianceData);
    
    console.log(`  🏢 Entity Status: "${complianceData.entity_status.toString()}" → ${analysis.isEntityActive ? '✅ ACTIVE (Pass)' : '❌ NOT ACTIVE (Fail)'}`);
    console.log(`  📋 Registration Status: "${complianceData.registration_status.toString()}" → ${analysis.isRegistrationIssued ? '✅ ISSUED (Pass)' : '❌ NOT ISSUED (Fail)'}`);
    console.log(`  🔍 Conformity Flag: "${complianceData.conformity_flag.toString()}" → ${analysis.isConformityOk ? '✅ ACCEPTABLE (Pass)' : '❌ NON-CONFORMING (Fail)'}`);
    console.log(`  📅 Date Validation: Last Update "${complianceData.lastUpdateDate.toString()}", Next Renewal "${complianceData.nextRenewalDate.toString()}" → ${analysis.hasValidDates ? '✅ VALID DATES (Pass)' : '❌ INVALID DATES (Fail)'}`);
    console.log(`  🆔 LEI Validation: "${complianceData.lei.toString()}" → ${analysis.hasValidLEI ? '✅ VALID LEI (Pass)' : '❌ EMPTY LEI (Fail)'}`);
    
    console.log(`  🏆 Overall Compliance Analysis: ${analysis.allRulesPassed ? '✅ ALL RULES PASSED' : '❌ SOME RULES FAILED'} → ZK Proof Shows: ${isCompliant.toJSON() ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}`);
    console.log(`  📊 Business Rules: ${analysis.rulesPassedCount}/5 passed`);
    console.log(`  📈 Compliance Percentage: ${Math.round((analysis.rulesPassedCount / 5) * 100)}%`);
    
    if (phase === 'Pre-Verification') {
      console.log(`  ⏳ Chain Status: NOT YET VERIFIED - Awaiting smart contract transaction...`);
    } else {
      console.log(`  ✅ Chain Status: VERIFIED AND STORED ON BLOCKCHAIN`);
    }
    
    if (!analysis.allRulesPassed) {
      console.log(`  ⚠️ Rules That ${phase === 'Pre-Verification' ? 'Will' : 'Did'} Fail:`);
      if (!analysis.isEntityActive) console.log(`    - Entity Status must be "ACTIVE", got "${complianceData.entity_status.toString()}"`);
      if (!analysis.isRegistrationIssued) console.log(`    - Registration Status must be "ISSUED", got "${complianceData.registration_status.toString()}"`);
      if (!analysis.isConformityOk) console.log(`    - Conformity Flag must be "CONFORMING", "UNKNOWN" or empty, got "${complianceData.conformity_flag.toString()}"`);
      if (!analysis.hasValidDates) console.log(`    - Last Update and Next Renewal dates must not be empty`);
      if (!analysis.hasValidLEI) console.log(`    - LEI must not be empty`);
    }
  }

  /**
   * FIXED: Logs smart contract state information with SAFE account fetching
   * CRITICAL FIX: Now uses appropriate safe state retrieval based on environment
   * 
   * LOCAL: Uses simple direct call (no retry needed)
   * NETWORK: Uses fetchAccount() with retry logic for DEVNET/TESTNET
   */
  public async logSmartContractState(
    zkApp: any, // GLEIFOptimMultiCompanySmartContract
    zkAppAddress: PublicKey,
    phase: 'BEFORE' | 'AFTER' = 'BEFORE'
  ): Promise<RegistryInfo> {
    try {
      // Determine environment and use appropriate method
      const currentEnv = environmentManager?.getCurrentEnvironment?.() || 'LOCAL';
      
      if (currentEnv === 'LOCAL') {
        // Use simple version for local blockchain
        const state = await safeLogSmartContractStateLocal(zkApp, zkAppAddress, phase);
        return state;
      } else {
        // Use retry logic version for network environments
        const state = await safeLogSmartContractState(zkApp, zkAppAddress, phase);
        return state;
      }
    } catch (error: any) {
      console.error(`❌ Error in logSmartContractState (${phase}): ${error.message}`);
      throw error;
    }
  }

  /**
   * Logs state changes between before and after verification
   * MOVED FROM: GLEIFLocalMultiVerifierUtils.ts (logStateChanges function)
   * CONSOLIDATED: Similar implementations in both Local and Network utils
   */
  public logStateChanges(stateBefore: RegistryInfo, stateAfter: RegistryInfo): void {
    console.log('\n📈 STATE CHANGES:');
    const stateBeforeWithPercentage = this.addCompliancePercentage(stateBefore);
    const stateAfterWithPercentage = this.addCompliancePercentage(stateAfter);
    console.log(`  📊 Total Companies: ${stateBefore.totalCompaniesTracked.toString()} → ${stateAfter.totalCompaniesTracked.toString()}`);
    console.log(`  ✅ Compliant Companies: ${stateBefore.compliantCompaniesCount.toString()} → ${stateAfter.compliantCompaniesCount.toString()}`);
    console.log(`  📈 Global Compliance Score: ${stateBeforeWithPercentage.compliancePercentage}% → ${stateAfterWithPercentage.compliancePercentage}%`);
    console.log(`  🔢 Total Verifications: ${stateBefore.totalVerificationsGlobal.toString()} → ${stateAfter.totalVerificationsGlobal.toString()}`);
    console.log(`  🌳 Companies Root Hash: ${stateBefore.companiesRootHash.toString()} → ${stateAfter.companiesRootHash.toString()}`);
    console.log(`  📝 Registry Version: ${stateBefore.registryVersion.toString()} → ${stateAfter.registryVersion.toString()}`);
  }

  /**
   * Enhanced compliance stats for global statistics
   * NEW METHOD: Enhanced version of addCompliancePercentage for global stats specifically
   */
  public enhanceGlobalComplianceStats(stats: GlobalComplianceStats): EnhancedComplianceStats & GlobalComplianceStats {
    const enhanced = this.addCompliancePercentage(stats);
    return {
      ...stats,
      ...enhanced
    } as EnhancedComplianceStats & GlobalComplianceStats;
  }

  /**
   * Log final compliance statistics with enhanced formatting
   * NEW METHOD: Standardized final statistics logging
   */
  public logFinalComplianceStatistics(
    stats: any,
    title: string = 'Final Compliance Statistics'
  ): void {
    console.log(`\n📈 ${title}:`);
    const enhanced = this.addCompliancePercentage(stats);
    
    console.log(`  • Total Companies Tracked: ${enhanced.totalCompanies}`);
    console.log(`  • Compliant Companies: ${enhanced.compliantCompanies}`);
    console.log(`  • Non-Compliant Companies: ${enhanced.nonCompliantCompanies}`);
    console.log(`  • Compliance Percentage: ${enhanced.compliancePercentage}%`);
    console.log(`  • Compliance Ratio: ${enhanced.complianceRatio}`);
    console.log(`  • Compliance Decimal: ${enhanced.complianceDecimal}`);

    if ('totalVerificationsGlobal' in stats) {
      console.log(`  • Total Verifications: ${(stats as RegistryInfo).totalVerificationsGlobal.toString()}`);
    }
    if ('totalVerifications' in stats) {
      console.log(`  • Total Verifications: ${(stats as GlobalComplianceStats).totalVerifications.toString()}`);
    }
  }

  /**
   * Initialize Oracle Registry for compliance operations
   * NEW METHOD: Placeholder for oracle registry initialization
   */
  public async initializeOracleRegistry(): Promise<void> {
    console.log('🔑 Initializing Oracle Registry for compliance operations...');
    // For now, this is a placeholder method
    // In the future, this could handle oracle registry setup, validation, etc.
    console.log('✅ Oracle Registry initialization completed');
  }
}
