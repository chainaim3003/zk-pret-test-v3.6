:: Build script to test TypeScript compilation
@echo off
cd /d "C:\SATHYA\CHAINAIM3003\mcp-servers\36clone2\zk-pret-test-v3.6"

echo Building TypeScript...
npm run build

if %errorlevel% equ 0 (
    echo ✅ Build successful!
) else (
    echo ❌ Build failed with exit code %errorlevel%
)

pause
