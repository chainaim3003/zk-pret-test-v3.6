@echo off
echo Testing build...
cd /d "C:\SATHYA\CHAINAIM3003\mcp-servers\36clone2\zk-pret-test-v3.6"
npm run build
if %ERRORLEVEL% equ 0 (
    echo Build successful!
) else (
    echo Build failed!
    exit /b 1
)
