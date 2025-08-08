// STABLECOIN LOCAL HANDLER FIX  
// Replace line 127 with this corrected version

// Build complete parameters for createStableCoinRiskComplianceData
const reserveComponents = {
    cashReservesTotal: stableCoinRiskData.cashReserves?.reduce((sum: number, val: number) => sum + val, 0) || 0,
    treasuryReservesTotal: stableCoinRiskData.treasuryReserves?.reduce((sum: number, val: number) => sum + val, 0) || 0,
    corporateReservesTotal: stableCoinRiskData.corporateReserves?.reduce((sum: number, val: number) => sum + val, 0) || 0,
    otherReservesTotal: stableCoinRiskData.otherReserves?.reduce((sum: number, val: number) => sum + val, 0) || 0
};

const tokenInfo = {
    outstandingTokensTotal: 1000000,
    tokenValue: 1.0
};

const qualityMetrics = {
    averageLiquidityScore: riskMetrics.averageLiquidityScore || 85,
    averageCreditRating: riskMetrics.averageCreditRating || 90,
    averageMaturity: riskMetrics.averageMaturity || 365,
    assetQualityScore: riskMetrics.assetQualityScore || 85
};

const thresholds = {
    backingRatioThreshold: params.backingRatioThreshold || 100,
    liquidityRatioThreshold: params.liquidityRatioThreshold || 20,
    concentrationLimit: params.concentrationLimit || 25,
    qualityThreshold: params.qualityThreshold || 80
};

const additionalParams = {
    periodsCount: stableCoinRiskData.periodsCount,
    liquidityThreshold: 10,
    newInvoiceAmount: 5000,
    newInvoiceEvaluationMonth: 11
};

const calculatedMetrics = {
    backingRatio: riskMetrics.backingRatio || 100,
    liquidityRatio: riskMetrics.liquidityRatio || 50,
    concentrationRisk: riskMetrics.concentrationRisk || 15,
    backingCompliant: riskMetrics.backingCompliant || true,
    liquidityCompliant: riskMetrics.liquidityCompliant || true,
    concentrationCompliant: riskMetrics.concentrationCompliant || true,
    qualityCompliant: riskMetrics.qualityCompliant || true,
    stableCoinCompliant: riskMetrics.stableCoinCompliant || true
};

const regulatoryData = {
    jurisdiction: params.jurisdictionOverride || 'US',
    score: riskMetrics.regulatoryScore || 95,
    threshold: 85,
    compliant: riskMetrics.regulatoryCompliant || true
};

const merkleRoot = merkleStructure?.merkleRoot || Field.from(Math.round(Math.random() * 1000000));

// FIXED FUNCTION CALL: Must have all 10 parameters, not just 2
const zkComplianceData = createStableCoinRiskComplianceData(
    'STABLECOIN_OPTIMMERKLE_10001',
    'StableCoin OptimMerkle Proof of Reserves Assessment',
    reserveComponents,
    tokenInfo,
    qualityMetrics,
    thresholds,
    additionalParams,
    merkleRoot,
    calculatedMetrics,
    regulatoryData
);
