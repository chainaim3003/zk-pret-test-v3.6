@echo off
echo Building and testing with TESTNET environment...
cd /d "C:\SATHYA\CHAINAIM3003\mcp-servers\36clone2\zk-pret-test-v3.6"
echo.
echo Building...
npm run build
if %ERRORLEVEL% neq 0 (
    echo Build failed!
    exit /b 1
)
echo.
echo Testing with TESTNET environment...
npm run test:local-complete-CorpReg "U01112TZ2022PTC039493"
