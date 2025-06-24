/**
 * ====================================================================
 * Risk Liquidity Basel3 OptimMerkle Utilities - FIXED
 * ====================================================================
 * CRITICAL FIX: Merkle leaf hash calculations to match ZK program expectations
 * ====================================================================
 */

import { Field, CircuitString, Poseidon, MerkleTree } from 'o1js';
import { 
    callACTUSAPI, 
    loadContractPortfolio, 
    getBasel3ContractPortfolio,
    ACTUSOptimMerkleAPIResponse,
    ACTUSContract 
} from './ACTUSOptimMerkleAPI.js';
import { 
    callACTUSAPIWithPostProcessing,
    printCoreACTUSResponse 
} from './ACTUSDataProcessor.js';
import {
    processBasel3ThroughGenericFramework
} from './Basel3Implementation.js';
import { buildMerkleTreeZK, hashDataZK, MerkleWitness8 } from './CoreZKUtilities.js';
import { calculatePercentageZK, calculateWeightedSumZK } from './ComplianceZKUtilities.js';

// =================================== Basel3 Risk Data Structures ===================================

export interface RiskLiquidityBasel3OptimMerkleData {
    // Scenario identifiers
    companyID: string;
    companyName: string;
    mcaID: string;
    businessPANID: string;
    
    // Basic cash flow data
    riskEvaluated: number;
    cashInflow: number[];
    cashOutflow: number[];
    periodsCount: number;
    
    // Basel3 LCR components
    hqlaLevel1: number[];        // Level 1 HQLA (government bonds, central bank reserves)
    hqlaLevel2A: number[];       // Level 2A HQLA (government/PSE bonds, corporate bonds)
    hqlaLevel2B: number[];       // Level 2B HQLA (lower-rated corporate bonds, equities)
    netCashOutflows: number[];   // Stressed net cash outflows
    
    // Basel3 NSFR components
    availableStableFunding: number[];  // ASF weighted funding sources
    requiredStableFunding: number[];   // RSF weighted funding requirements
    
    // Basel3 parameters
    lcrThreshold: number;        // LCR minimum threshold (usually 100%)
    nsfrThreshold: number;       // NSFR minimum threshold (usually 100%)
    
    // Additional Basel3 metrics
    liquidityThreshold: number;  // General liquidity threshold
    newInvoiceAmount: number;
    newInvoiceEvaluationMonth: number;
    
    // API response metadata
    metadata: {
        timeHorizon: string;
        currency: string;
        processingDate: string;
    };
}

export interface RiskLiquidityBasel3OptimMerkleProcessedData {
    complianceData: RiskLiquidityBasel3OptimMerkleData;
    merkleTree: MerkleTree;
    merkleRoot: Field;
    witnesses: {
        companyInfo: MerkleWitness8;
        cashFlows: MerkleWitness8;
        hqlaComponents: MerkleWitness8;
        nsfrComponents: MerkleWitness8;
        thresholds: MerkleWitness8;
    };
}

// =================================== Data Processing Functions ===================================

/**
 * Fetch and process ACTUS data for Basel3 Risk scenario
 */
export async function fetchRiskLiquidityBasel3OptimMerkleData(
    actusUrl: string,
    contractPortfolio?: string | ACTUSContract[]
): Promise<ACTUSOptimMerkleAPIResponse & { rawResponseData?: any }> {
    try {
        console.log('🏦 Loading Basel3-specific contract portfolio...');
        const contracts = Array.isArray(contractPortfolio) ? contractPortfolio : getBasel3ContractPortfolio();
        
        console.log('🚀 Calling ACTUS API with post-processing for Basel3...');
        
        // ✅ CRITICAL FIX: Capture raw response data before post-processing
        const axios = await import('axios');
        
        // Clean contracts (remove non-ACTUS fields)
        const cleanedContracts = contracts.map(contract => {
            const { hqlaCategory, reserveType, liquidityScore, ...cleanContract } = contract;
            return cleanContract;
        });
        
        const requestData = {
            contracts: cleanedContracts,
            riskFactors: []
        };
        
        console.log(`📡 Calling ACTUS API directly to preserve raw response...`);
        const rawResponse = await axios.default.post(actusUrl, requestData);
        const rawResponseData = rawResponse.data;
        
        console.log(`📋 Raw response received: ${Array.isArray(rawResponseData) ? rawResponseData.length : 'not array'} items`);
        
        // Use standard post-processing to get the formatted structure
        const actusResponse = await callACTUSAPIWithPostProcessing(actusUrl, contracts);
        
        console.log(`✅ Basel3 ACTUS data fetched and processed: ${actusResponse.periodsCount} periods`);
        
        // Attach raw response data for generic framework processing
        return {
            ...actusResponse,
            rawResponseData: rawResponseData  // ✅ Preserve original events data
        };
        
    } catch (error) {
        console.error('Error fetching Basel3 ACTUS data:', error);
        throw new Error(`Basel3 data fetch failed: ${error}`);
    }
}

/**
 * Process ACTUS response with Basel3-specific categorization
 * Uses the enhanced generic framework for event-based HQLA classification
 */
export async function processBasel3RiskData(
    actusResponse: ACTUSOptimMerkleAPIResponse,
    lcrThreshold: number,
    nsfrThreshold: number = 100,
    liquidityThreshold: number = 10,
    newInvoiceAmount: number = 5000,
    newInvoiceEvaluationMonth: number = 11
): Promise<RiskLiquidityBasel3OptimMerkleData> {
    
    console.log('🏦 Processing Basel3 data with enhanced generic framework...');
    
    try {
        // Try to use the enhanced generic framework for event-based processing
        console.log('🔍 ACTUS Response Structure:');
        console.log(`   - Has contractDetails: ${actusResponse.contractDetails ? 'YES' : 'NO'}`);
        console.log(`   - ContractDetails length: ${actusResponse.contractDetails?.length || 0}`);
        console.log(`   - Raw ACTUS Response keys: ${Object.keys(actusResponse)}`);
        
        // ✅ CRITICAL FIX: Pass actual ACTUS response data as rawEvents instead of contract definitions
        // The rawEvents parameter should contain the actual API response with contract events
        const rawEventsData = (actusResponse as any).rawResponseData || [];
        
        console.log(`   - Raw events data length: ${rawEventsData.length}`);
        if (rawEventsData.length > 0) {
            console.log(`   - Sample raw data: ${JSON.stringify(rawEventsData[0], null, 2)}`);
        }
        
        const enhancedResults = await processBasel3ThroughGenericFramework(
            actusResponse.inflow,
            actusResponse.outflow,
            actusResponse.periodsCount,
            rawEventsData,  // ✅ FIX: Use actual ACTUS response data with events
            actusResponse.contractDetails,
            {
                liquidityThreshold_LCR: lcrThreshold,
                liquidityThreshold: liquidityThreshold,
                newInvoiceAmount: newInvoiceAmount,
                newInvoiceEvaluationMonth: newInvoiceEvaluationMonth
            }
        );
        
        console.log('✅ Enhanced framework processing successful - using event-based HQLA classification');
        
        // Extract HQLA data from generic framework results
        const hqlaData = extractHQLAFromGenericResults(enhancedResults);
        
        return {
            // Scenario identifiers
            companyID: 'BASEL3_ENHANCED_10001',
            companyName: 'Basel3 Enhanced Generic Framework Assessment',
            mcaID: 'BASEL3_MCA_201',
            businessPANID: 'BASEL3_PAN_1001',
            
            // Basic cash flow data
            riskEvaluated: 1,
            cashInflow: actusResponse.inflow.map((period: number[]) => period.reduce((sum: number, value: number) => sum + value, 0)),
            cashOutflow: actusResponse.outflow.map((period: number[]) => period.reduce((sum: number, value: number) => sum + value, 0)),
            periodsCount: actusResponse.periodsCount,
            
            // Basel3 LCR components (from enhanced framework)
            hqlaLevel1: hqlaData.level1,
            hqlaLevel2A: hqlaData.level2A,
            hqlaLevel2B: hqlaData.level2B,
            netCashOutflows: hqlaData.netCashOutflows,
            
            // Basel3 NSFR components (calculated)
            availableStableFunding: hqlaData.asf,
            requiredStableFunding: hqlaData.rsf,
            
            // Basel3 thresholds
            lcrThreshold: Math.round(lcrThreshold),
            nsfrThreshold: Math.round(nsfrThreshold),
            
            // Additional parameters
            liquidityThreshold: Math.round(liquidityThreshold),
            newInvoiceAmount,
            newInvoiceEvaluationMonth,
            
            // Metadata
            metadata: actusResponse.metadata
        };
        
    } catch (error) {
        console.warn('⚠️ Enhanced framework processing failed, falling back to legacy processing:', error);
        return processBasel3RiskDataLegacy(actusResponse, lcrThreshold, nsfrThreshold, liquidityThreshold, newInvoiceAmount, newInvoiceEvaluationMonth);
    }
}

/**
 * Extract HQLA data from generic framework results
 */
function extractHQLAFromGenericResults(enhancedResults: any): {
    level1: number[];
    level2A: number[];
    level2B: number[];
    netCashOutflows: number[];
    asf: number[];
    rsf: number[];
} {
    const periodsCount = enhancedResults.classification.periodsCount;
    const classifiedData = enhancedResults.classification.classifiedData;
    
    const level1 = new Array(periodsCount).fill(0);
    const level2A = new Array(periodsCount).fill(0);
    const level2B = new Array(periodsCount).fill(0);
    const netCashOutflows = new Array(periodsCount).fill(0);
    const asf = new Array(periodsCount).fill(0);
    const rsf = new Array(periodsCount).fill(0);
    
    // Extract HQLA values from classified data
    for (let period = 0; period < periodsCount; period++) {
        const monthData = classifiedData[period];
        if (monthData) {
            level1[period] = monthData.L1 || 0;
            level2A[period] = monthData.L2A || 0;
            level2B[period] = monthData.L2B || 0;
            netCashOutflows[period] = monthData.NonHQLA || 0;
            
            // Calculate NSFR components (simplified)
            const totalHQLA = level1[period] + level2A[period] + level2B[period];
            asf[period] = totalHQLA * 0.7; // 70% average ASF factor
            rsf[period] = netCashOutflows[period] * 0.6; // 60% average RSF factor
        }
    }
    
    return { level1, level2A, level2B, netCashOutflows, asf, rsf };
}

/**
 * Legacy Basel3 processing (fallback)
 */
function processBasel3RiskDataLegacy(
    actusResponse: ACTUSOptimMerkleAPIResponse,
    lcrThreshold: number,
    nsfrThreshold: number = 100,
    liquidityThreshold: number = 10,
    newInvoiceAmount: number = 5000,
    newInvoiceEvaluationMonth: number = 11
): RiskLiquidityBasel3OptimMerkleData {
    
    // Aggregate basic cash flows
    const aggregatedInflows = actusResponse.inflow.map((period: number[]) =>
    period.reduce((sum: number, value: number) => sum + value, 0)
    );
    
    const aggregatedOutflows = actusResponse.outflow.map((period: number[]) =>
    period.reduce((sum: number, value: number) => sum + value, 0)
    );
    
    // Categorize assets into HQLA buckets based on contract details
    const hqlaCategories = categorizeContractsForHQLA(actusResponse.contractDetails, actusResponse.inflow);
    
    // Calculate NSFR components
    const nsfrComponents = calculateNSFRComponents(actusResponse.contractDetails, aggregatedInflows, aggregatedOutflows);
    
    return {
        // Scenario identifiers
        companyID: 'BASEL3_RISK_10001',
        companyName: 'Basel3 LCR/NSFR Risk Assessment',
        mcaID: 'BASEL3_MCA_201',
        businessPANID: 'BASEL3_PAN_1001',
        
        // Basic cash flow data
        riskEvaluated: 1,
        cashInflow: aggregatedInflows,
        cashOutflow: aggregatedOutflows,
        periodsCount: actusResponse.periodsCount,
        
        // Basel3 LCR components
        hqlaLevel1: hqlaCategories.level1,
        hqlaLevel2A: hqlaCategories.level2A,
        hqlaLevel2B: hqlaCategories.level2B,
        netCashOutflows: calculateStressedOutflows(aggregatedOutflows),
        
        // Basel3 NSFR components
        availableStableFunding: nsfrComponents.asf,
        requiredStableFunding: nsfrComponents.rsf,
        
        // Basel3 thresholds
        lcrThreshold: Math.round(lcrThreshold),
        nsfrThreshold: Math.round(nsfrThreshold),
        
        // Additional parameters
        liquidityThreshold: Math.round(liquidityThreshold),
        newInvoiceAmount,
        newInvoiceEvaluationMonth,
        
        // Metadata
        metadata: actusResponse.metadata
    };
}

/**
 * Categorize contracts into HQLA buckets for LCR calculation
 */
function categorizeContractsForHQLA(
    contractDetails: any[],
    inflowData: number[][]
): {
    level1: number[];
    level2A: number[];
    level2B: number[];
} {
    const periodsCount = inflowData.length;
    
    // Initialize HQLA arrays
    const level1 = new Array(periodsCount).fill(0);
    const level2A = new Array(periodsCount).fill(0);
    const level2B = new Array(periodsCount).fill(0);
    
    // If contract details specify HQLA category, use it
    contractDetails.forEach((contract, contractIndex) => {
        const hqlaCategory = contract.hqlaCategory || 'NonHQLA';
        
        for (let period = 0; period < periodsCount; period++) {
            const periodInflow = inflowData[period][contractIndex] || 0;
            
            switch (hqlaCategory) {
                case 'L1':
                    level1[period] += periodInflow;
                    break;
                case 'L2A':
                    level2A[period] += periodInflow;
                    break;
                case 'L2B':
                    level2B[period] += periodInflow;
                    break;
                default:
                    // Non-HQLA assets don't count toward LCR buffer
                    break;
            }
        }
    });
    
    // If no explicit categorization, use contract type heuristics
    if (level1.every(val => val === 0) && level2A.every(val => val === 0)) {
        for (let period = 0; period < periodsCount; period++) {
            const totalInflow = inflowData[period].reduce((sum, val) => sum + val, 0);
            
            // Heuristic distribution (in practice, this would be based on actual asset analysis)
            level1[period] = totalInflow * 0.4;  // 40% Level 1 (government bonds, cash)
            level2A[period] = totalInflow * 0.35; // 35% Level 2A (high-grade corporate bonds)
            level2B[period] = totalInflow * 0.15; // 15% Level 2B (lower-grade assets)
            // 10% Non-HQLA (not counted)
        }
    }
    
    return { level1, level2A, level2B };
}

/**
 * Calculate NSFR Available Stable Funding and Required Stable Funding
 */
function calculateNSFRComponents(
    contractDetails: any[],
    inflows: number[],
    outflows: number[]
): {
    asf: number[];
    rsf: number[];
} {
    const periodsCount = inflows.length;
    
    // NSFR factors (simplified - real implementation would be more granular)
    const ASF_FACTORS = {
        tier1Capital: 1.0,      // 100% ASF
        retailDeposits: 0.95,   // 95% ASF for stable retail deposits
        wholesaleDeposits: 0.5, // 50% ASF for wholesale deposits
        securedFunding: 0.0     // 0% ASF for very short-term secured funding
    };
    
    const RSF_FACTORS = {
        cash: 0.0,              // 0% RSF for cash
        hqlaL1: 0.05,          // 5% RSF for Level 1 HQLA
        hqlaL2A: 0.15,         // 15% RSF for Level 2A HQLA
        hqlaL2B: 0.25,         // 25% RSF for Level 2B HQLA
        corporateLoans: 0.85,   // 85% RSF for corporate loans
        retailLoans: 0.65      // 65% RSF for retail loans
    };
    
    const asf = new Array(periodsCount).fill(0);
    const rsf = new Array(periodsCount).fill(0);
    
    for (let period = 0; period < periodsCount; period++) {
        // Calculate ASF (funding sources)
        const totalInflow = inflows[period];
        asf[period] = totalInflow * 0.7; // Simplified: 70% average ASF factor
        
        // Calculate RSF (funding requirements)
        const totalOutflow = outflows[period];
        rsf[period] = totalOutflow * 0.6; // Simplified: 60% average RSF factor
    }
    
    return { asf, rsf };
}

/**
 * Apply stress factors to outflows for LCR calculation
 */
function calculateStressedOutflows(baseOutflows: number[]): number[] {
    // Basel3 stress factors
    const STRESS_FACTORS = {
        retailDeposits: 0.03,   // 3% runoff for stable retail deposits
        wholesaleDeposits: 0.25, // 25% runoff for wholesale deposits
        securedFunding: 1.0,    // 100% runoff for maturing secured funding
        derivatives: 1.0        // 100% for derivative collateral calls
    };
    
    return baseOutflows.map(outflow => {
        // Apply average stress factor of 15% (simplified)
        return outflow * 1.15;
    });
}

/**
 * ✅ CRITICAL FIX: Build Merkle tree structure for Basel3 data
 * Updated to match exactly what the ZK program expects
 */
export function buildBasel3RiskMerkleStructure(
    complianceData: RiskLiquidityBasel3OptimMerkleData
): RiskLiquidityBasel3OptimMerkleProcessedData {
    
    // ✅ CRITICAL FIX: Calculate totals that match ZK program expectations
    const hqlaLevel1Total = complianceData.hqlaLevel1.reduce((sum, val) => sum + val, 0);
    const hqlaLevel2ATotal = complianceData.hqlaLevel2A.reduce((sum, val) => sum + val, 0);
    const hqlaLevel2BTotal = complianceData.hqlaLevel2B.reduce((sum, val) => sum + val, 0);
    const netCashOutflowsTotal = complianceData.netCashOutflows.reduce((sum, val) => sum + val, 0);
    const availableStableFundingTotal = complianceData.availableStableFunding.reduce((sum, val) => sum + val, 0);
    const requiredStableFundingTotal = complianceData.requiredStableFunding.reduce((sum, val) => sum + val, 0);
    
    console.log('🔧 Merkle Structure Debug:');
    console.log(`   Company ID: ${complianceData.companyID}`);
    console.log(`   HQLA L1 Total: ${hqlaLevel1Total}`);
    console.log(`   HQLA L2A Total: ${hqlaLevel2ATotal}`);
    console.log(`   HQLA L2B Total: ${hqlaLevel2BTotal}`);
    console.log(`   Net Cash Outflows Total: ${netCashOutflowsTotal}`);
    console.log(`   ASF Total: ${availableStableFundingTotal}`);
    console.log(`   RSF Total: ${requiredStableFundingTotal}`);
    console.log(`   LCR Threshold: ${complianceData.lcrThreshold}`);
    console.log(`   NSFR Threshold: ${complianceData.nsfrThreshold}`);
    
    // ✅ CRITICAL FIX: Prepare data for Merkle tree to match ZK program expectations
    const merkleLeaves: Field[] = [
        // 0. Company information hash - matches: companyInfoHash = complianceData.scenarioID.hash()
        CircuitString.fromString(complianceData.companyID).hash(),
        
        // 1. Cash flows hash - matches: cashFlowsHash = Field.from([hqlaLevel1Total, hqlaLevel2ATotal].reduce(...))
        Field.from(hqlaLevel1Total + hqlaLevel2ATotal),
        
        // 2. HQLA components hash - matches: hqlaHash = Field.from([hqlaLevel1Total, hqlaLevel2ATotal, hqlaLevel2BTotal, netCashOutflowsTotal].reduce(...))
        Field.from(hqlaLevel1Total + hqlaLevel2ATotal + hqlaLevel2BTotal + netCashOutflowsTotal),
        
        // 3. NSFR components hash - matches: nsfrHash = Field.from([availableStableFundingTotal, requiredStableFundingTotal].reduce(...))
        Field.from(availableStableFundingTotal + requiredStableFundingTotal),
        
        // 4. Thresholds hash - matches: thresholdsHash = Field.from([lcrThreshold, nsfrThreshold].reduce(...))
        Field.from(complianceData.lcrThreshold + complianceData.nsfrThreshold)
    ];
    
    console.log('🔧 Merkle Leaves Debug:');
    merkleLeaves.forEach((leaf, index) => {
        console.log(`   Leaf ${index}: ${leaf.toString()}`);
    });
    
    // Build Merkle tree
    const merkleTree = buildMerkleTreeZK(merkleLeaves);
    const merkleRoot = merkleTree.getRoot();
    
    console.log(`🔐 Calculated Merkle Root: ${merkleRoot.toString()}`);
    
    // Generate witnesses
    const witnesses = {
        companyInfo: new MerkleWitness8(merkleTree.getWitness(0n)),
        cashFlows: new MerkleWitness8(merkleTree.getWitness(1n)),
        hqlaComponents: new MerkleWitness8(merkleTree.getWitness(2n)),
        nsfrComponents: new MerkleWitness8(merkleTree.getWitness(3n)),
        thresholds: new MerkleWitness8(merkleTree.getWitness(4n))
    };
    
    // ✅ CRITICAL FIX: Verify witnesses against expected leaf values
    console.log('🔧 Verifying witness calculations:');
    try {
        const companyInfoCalculated = witnesses.companyInfo.calculateRoot(merkleLeaves[0]);
        console.log(`   Company Info Root: ${companyInfoCalculated.toString()}`);
        
        const cashFlowsCalculated = witnesses.cashFlows.calculateRoot(merkleLeaves[1]);
        console.log(`   Cash Flows Root: ${cashFlowsCalculated.toString()}`);
        
        const hqlaCalculated = witnesses.hqlaComponents.calculateRoot(merkleLeaves[2]);
        console.log(`   HQLA Root: ${hqlaCalculated.toString()}`);
        
        const nsfrCalculated = witnesses.nsfrComponents.calculateRoot(merkleLeaves[3]);
        console.log(`   NSFR Root: ${nsfrCalculated.toString()}`);
        
        const thresholdsCalculated = witnesses.thresholds.calculateRoot(merkleLeaves[4]);
        console.log(`   Thresholds Root: ${thresholdsCalculated.toString()}`);
        
        // Verify they all match the main root
        const allMatch = [companyInfoCalculated, cashFlowsCalculated, hqlaCalculated, nsfrCalculated, thresholdsCalculated]
            .every(calculatedRoot => calculatedRoot.toString() === merkleRoot.toString());
        
        console.log(`   All witnesses match root: ${allMatch}`);
        
    } catch (error) {
        console.error('⚠️ Witness verification failed:', error);
    }
    
    return {
        complianceData,
        merkleTree,
        merkleRoot,
        witnesses
    };
}

/**
 * Calculate Basel3 compliance metrics
 */
export function calculateBasel3RiskMetrics(
    complianceData: RiskLiquidityBasel3OptimMerkleData
): {
    lcrRatios: number[];
    nsfrRatios: number[];
    averageLCR: number;
    averageNSFR: number;
    worstCaseLCR: number;
    worstCaseNSFR: number;
    lcrCompliant: boolean;
    nsfrCompliant: boolean;
    overallCompliant: boolean;
} {
    const { hqlaLevel1, hqlaLevel2A, hqlaLevel2B, netCashOutflows, availableStableFunding, requiredStableFunding, lcrThreshold, nsfrThreshold } = complianceData;
    
    // Handle case where there are no periods (0 periods)
    if (complianceData.periodsCount === 0) {
        // Return default values for empty data
        return {
            lcrRatios: [],
            nsfrRatios: [],
            averageLCR: 100, // Default to 100% when no data
            averageNSFR: 100, // Default to 100% when no data
            worstCaseLCR: 100, // Default to 100% when no data
            worstCaseNSFR: 100, // Default to 100% when no data
            lcrCompliant: true, // Default to compliant when no data to check
            nsfrCompliant: true, // Default to compliant when no data to check
            overallCompliant: true // Default to compliant when no data to check
        };
    }
    
    // Calculate LCR for each period
    const lcrRatios: number[] = [];
    for (let period = 0; period < complianceData.periodsCount; period++) {
        // Calculate HQLA with haircuts: Level1 (100%) + Level2A (85%) + Level2B (75%)
        const adjustedHQLA = hqlaLevel1[period] + (hqlaLevel2A[period] * 0.85) + (hqlaLevel2B[period] * 0.75);
        
        // LCR = HQLA / Net Cash Outflows
        const lcr = netCashOutflows[period] > 0 ? (adjustedHQLA / netCashOutflows[period]) * 100 : 100;
        lcrRatios.push(lcr);
    }
    
    // Calculate NSFR for each period
    const nsfrRatios: number[] = [];
    for (let period = 0; period < complianceData.periodsCount; period++) {
        // NSFR = Available Stable Funding / Required Stable Funding
        const nsfr = requiredStableFunding[period] > 0 ? (availableStableFunding[period] / requiredStableFunding[period]) * 100 : 100;
        nsfrRatios.push(nsfr);
    }
    
    // Calculate summary metrics (safe against empty arrays)
    const averageLCR = lcrRatios.length > 0 ? lcrRatios.reduce((sum, ratio) => sum + ratio, 0) / lcrRatios.length : 100;
    const averageNSFR = nsfrRatios.length > 0 ? nsfrRatios.reduce((sum, ratio) => sum + ratio, 0) / nsfrRatios.length : 100;
    const worstCaseLCR = lcrRatios.length > 0 ? Math.min(...lcrRatios) : 100;
    const worstCaseNSFR = nsfrRatios.length > 0 ? Math.min(...nsfrRatios) : 100;
    
    // Check compliance
    const lcrCompliant = lcrRatios.every(ratio => ratio >= lcrThreshold);
    const nsfrCompliant = nsfrRatios.every(ratio => ratio >= nsfrThreshold);
    const overallCompliant = lcrCompliant && nsfrCompliant;
    
    return {
        lcrRatios,
        nsfrRatios,
        averageLCR,
        averageNSFR,
        worstCaseLCR,
        worstCaseNSFR,
        lcrCompliant,
        nsfrCompliant,
        overallCompliant
    };
}

/**
 * Validate Basel3 risk data integrity
 */
export function validateBasel3RiskData(complianceData: RiskLiquidityBasel3OptimMerkleData): boolean {
    // Check required fields
    if (!complianceData.companyID || complianceData.companyID.length === 0) {
        throw new Error('Company ID is required for Basel3 scenario');
    }
    
    // Check array lengths consistency
    const expectedLength = complianceData.periodsCount;
    const arrays = [
        complianceData.cashInflow,
        complianceData.cashOutflow,
        complianceData.hqlaLevel1,
        complianceData.hqlaLevel2A,
        complianceData.hqlaLevel2B,
        complianceData.netCashOutflows,
        complianceData.availableStableFunding,
        complianceData.requiredStableFunding
    ];
    
    arrays.forEach((array, index) => {
        if (array.length !== expectedLength) {
            throw new Error(`Array ${index} length (${array.length}) does not match periods count (${expectedLength})`);
        }
    });
    
    // Check thresholds
    if (complianceData.lcrThreshold <= 0 || complianceData.nsfrThreshold <= 0) {
        throw new Error('LCR and NSFR thresholds must be positive');
    }
    
    return true;
}

/**
 * Generate Basel3 compliance summary report
 */
export function generateBasel3RiskSummary(
    complianceData: RiskLiquidityBasel3OptimMerkleData,
    riskMetrics: ReturnType<typeof calculateBasel3RiskMetrics>
): string {
    return `
=== Basel3 LCR/NSFR Risk Assessment Summary ===
Company: ${complianceData.companyName} (${complianceData.companyID})
Assessment Period: ${complianceData.periodsCount} periods (${complianceData.metadata.timeHorizon})
Currency: ${complianceData.metadata.currency}

Basel3 Parameters:
- LCR Threshold: ${complianceData.lcrThreshold}%
- NSFR Threshold: ${complianceData.nsfrThreshold}%

LCR Metrics:
- Average LCR: ${riskMetrics.averageLCR.toFixed(2)}%
- Worst Case LCR: ${riskMetrics.worstCaseLCR.toFixed(2)}%
- LCR Compliance: ${riskMetrics.lcrCompliant ? 'PASSED' : 'FAILED'}

NSFR Metrics:
- Average NSFR: ${riskMetrics.averageNSFR.toFixed(2)}%
- Worst Case NSFR: ${riskMetrics.worstCaseNSFR.toFixed(2)}%
- NSFR Compliance: ${riskMetrics.nsfrCompliant ? 'PASSED' : 'FAILED'}

Overall Basel3 Compliance: ${riskMetrics.overallCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
Generated: ${complianceData.metadata.processingDate}
`;
}
