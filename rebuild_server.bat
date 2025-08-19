@echo off
echo 🔨 Building PRET MCP Server with console.log fix...

cd /d "C:\SATHYA\mcpservers\chainaim3003\36pretclone1\zk-pret-test-v3.6"

echo 📦 Running TypeScript compilation...
npx tsc

if %errorlevel% equ 0 (
    echo ✅ Build completed successfully!
    echo 🧪 Ready to test the fixed server
) else (
    echo ❌ Build failed!
    exit /b 1
)

pause
