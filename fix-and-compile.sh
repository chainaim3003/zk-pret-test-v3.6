#!/bin/bash

echo "🔧 FIXING TYPESCRIPT COMPILATION ERRORS"
echo "======================================"

cd C:/SATHYA/CHAINAIM3003/mcp-servers/ZK-PRET-TEST-v3.6/zk-pret-test-v3.6

echo "✅ Removed demo files causing compilation errors"
echo "✅ Fixed error handling in main integration"
echo "✅ Only keeping essential files for actual execution"
echo ""

echo "🔨 Compiling TypeScript..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ COMPILATION SUCCESSFUL!"
    echo "========================"
    echo ""
    echo "🎯 READY TO RUN ACTUAL EXECUTION:"
    echo "================================"
    echo "Your test now includes practical state tracking integrated directly"
    echo "No demos, no hardcoded addresses - just enhanced real execution"
    echo ""
    echo "🚀 Run your test:"
    echo "node ./build/tests/with-sign/GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js \"SREE PALANI ANDAVAR AGROS PRIVATE LIMITED\""
    
else
    echo ""
    echo "❌ COMPILATION STILL FAILED"
    echo "Let's check remaining errors..."
fi
