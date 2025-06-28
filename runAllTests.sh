# 3.5 OLD TESTS


node ./build/tests/with-sign/BusinessProcessIntegrityVerificationFileTestWithSign.js SCF ./src/data/scf/process/EXPECTED/bpmn-SCF-Example-Process-Expected.bpmn ./src/data/scf/process/ACTUAL/bpmn-SCF-Example-Execution-Actual-Accepted-1.bpmn
node ./build/tests/with-sign/BusinessProcessIntegrityVerificationFileTestWithSign.js SCF ./src/data/scf/process/EXPECTED/bpmn-SCF-Example-Process-Expected.bpmn ./src/data/scf/process/ACTUAL/bpmn-SCF-Example-Execution-Actual-Rejected-1.bpmn


node ./build/tests/with-sign/BusinessProcessIntegrityVerificationFileTestWithSign.js DVP ./src/data/DVP/process/bpmnCircuitDVP-expected.bpmn ./src/data/DVP/process/bpmnCircuitSTABLECOIN-accepted1.bpmn
node ./build/tests/with-sign/BusinessProcessIntegrityVerificationFileTestWithSign.js DVP ./src/data/DVP/process/bpmnCircuitDVP-expected.bpmn ./src/data/DVP/process/bpmnCircuitSTABLECOIN-rejected1.bpmn



node ./build/tests/with-sign/BusinessProcessIntegrityVerificationFileTestWithSign.js STABLECOIN ./src/data/STABLECOIN/process/bpmnCircuitDVP-expected.bpmn ./src/data/STABLECOIN/process/bpmnCircuitSTABLECOIN-accepted1.bpmn
node ./build/tests/with-sign/BusinessProcessIntegrityVerificationFileTestWithSign.js STABLECOIN ./src/data/STABLECOIN/process/bpmnCircuitDVP-expected.bpmn ./src/data/STABLECOIN/process/bpmnCircuitSTABLECOIN-rejected1.bpmn





node ./build/tests/with-sign/CorporateRegistrationOptimSingleCompanyVerificationTestWithSign.js "U01112TZ2022PTC039493"
node ./build/tests/with-sign/EXIMOptimSingleCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"
node ./build/tests/with-sign/GLEIFOptimSingleCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"


node ./build/tests/with-sign/CorporateRegistrationOptimMultiCompanyVerificationTestWithSign.js "U01112TZ2022PTC039493"
node ./build/tests/with-sign/EXIMOptimMultiCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"
node ./build/tests/with-sign/GLEIFOptimMultiCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"
node ./build/tests/with-sign/GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"



node ./build/tests/with-sign/ComposedRecursiveOptim3LevelVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED" "U01112TZ2022PTC039493" 


node ./build/tests/with-sign/BusinessStandardDataIntegrityVerificationTest.js ./src/data/scf/BILLOFLADING/actualBL1-VALID.json
node ./build/tests/with-sign/BusinessStandardOptimVerificationTest.js ./src/data/scf/BILLOFLADING/actualBL1-VALID.json

node ./build/tests/with-sign/BusinessStdIntegrityOptimMerkleVerificationTestWithSign.js ./src/data/scf/BILLOFLADING/BOL-VALID-1.json
node ./build/tests/with-sign/BusinessStdIntegrityOptimMerkleVerificationTestWithSign.js ./src/data/scf/BILLOFLADING/BOL-INVALID-1.json

node ./build/tests/with-sign/RiskLiquidityBasel3OptimMerkleVerificationTestWithSign.js 100 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/Basel3/CONFIG/basel3-VALID-1.json

node ./build/tests/with-sign/RiskLiquidityBasel3OptimMerkleVerificationTestWithSign.js 100 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/Basel3/CONFIG/basel3-VALID-2.json

node ./build/tests/with-sign/RiskLiquidityBasel3OptimMerkleVerificationTestWithSign.js 100 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/Basel3/CONFIG/basel3-INVALID-1.json

node ./build/tests/with-sign/RiskLiquidityBasel3OptimMerkleVerificationTestWithSign.js 100 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/Basel3/CONFIG/basel3-VALID-2.json

node ./build/tests/with-sign/RiskLiquidityAdvacnedOptimMerkleVerificationTestWithSign.js 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/Advanced/CONFIG/Advanced-VALID-1.json

node ./build/tests/with-sign/RiskLiquidityAdvancedOptimMerkleVerificationTestWithSign.js 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/Advanced/CONFIG/Advanced-INVALID-1.json

node ./build/tests/with-sign/RiskLiquidityStablecoinOptimMerkleVerificationTestWithSign.js 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/StableCoin/CONFIG/US/StableCoin-VALID-1.json ultra_strict US

node ./build/tests/with-sign/RiskLiquidityStablecoinOptimMerkleVerificationTestWithSign.js 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/StableCoin/CONFIG/US/StableCoin-INVALID-1.json ultra_strict US

node ./build/tests/with-sign/RiskLiquidityStablecoinOptimMerkleVerificationTestWithSign.js 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/StableCoin/CONFIG/EU/StableCoin-VALID-4.json ultra_strict EU

node ./build/tests/with-sign/RiskLiquidityStablecoinOptimMerkleVerificationTestWithSign.js 100 http://98.84.165.146:8083/eventsBatch src/data/RISK/StableCoin/CONFIG/EU/StableCoin-INVALID-4.json ultra_strict EU


#NEW TESTS BusinessProcesIntegrity

node ./build/tests/with-sign/BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSign.js SCF ./src/data/SCF/process/EXPECTED/SCF-Expected.bpmn ./src/data/SCF/process/ACTUAL/SCF-Accepted1.bpmn
node ./build/tests/with-sign/BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSign.js SCF ./src/data/SCF/process/EXPECTED/SCF-Expected.bpmn ./src/data/SCF/process/ACTUAL/SCF-Rejected1.bpmn

node ./build/tests/with-sign/BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSign.js DVP ./src/data/DVP/process/EXPECTED/DVP-Expected.bpmn ./src/data/DVP/process/ACTUAL/DVP-Accepted1.bpmn
node ./build/tests/with-sign/BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSign.js DVP ./src/data/DVP/process/EXPECTED/DVP-Expected.bpmn ./src/data/DVP/process/ACTUAL/DVP-Rejected1.bpmn

node ./build/tests/with-sign/BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSign.js STABLECOIN ./src/data/STABLECOIN/process/EXPECTED/STABLECOIN-Expected.bpmn ./src/data/STABLECOIN/process/ACTUAL/STABLECOIN-Accepted1.bpmn
node ./build/tests/with-sign/BusinessProcessIntegrityOptimMerkleVerificationFileTestWithSign.js STABLECOIN ./src/data/STABLECOIN/process/EXPECTED/STABLECOIN-Expected.bpmn ./src/data/STABLECOIN/process/ACTUAL/STABLECOIN-Rejected1.bpmn



