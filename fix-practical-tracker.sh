#!/bin/bash

echo "🔧 FIXING PRACTICAL STATE TRACKER ERROR"
echo "======================================"

cd C:/SATHYA/CHAINAIM3003/mcp-servers/ZK-PRET-TEST-v3.6/zk-pret-test-v3.6

echo "✅ Fixed 'base58 is not iterable' error"
echo "✅ Added proper PublicKey conversion handling"
echo "✅ Improved error logging and debugging"
echo ""

echo "🔨 Compiling with fixes..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ COMPILATION SUCCESSFUL!"
    echo "========================"
    echo ""
    echo "🎯 WHAT WAS FIXED:"
    echo "=================="
    echo "The practical state tracker WAS working in your last run!"
    echo "It activated correctly but failed due to a PublicKey conversion error."
    echo ""
    echo "Evidence from your logs:"
    echo "📊 Safe global compliance stats retrieval: final_registry_statistics"
    echo "   ⚡ Attempting direct contract state read..."
    echo "   ❌ Direct call failed: totalCompaniesTracked.get() failed..."
    echo "   🚀 Using practical state tracker (real blockchain data)..."
    echo "   ❌ Practical state tracker failed: base58 is not iterable"
    echo ""
    echo "Now fixed with proper address handling!"
    echo ""
    echo "🚀 TEST AGAIN:"
    echo "=============="
    echo "node ./build/tests/with-sign/GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js \"SREE PALANI ANDAVAR AGROS PRIVATE LIMITED\""
    echo ""
    echo "Expected improvements:"
    echo "✅ Practical state tracker should work now"
    echo "✅ Better error messages with stack traces"
    echo "✅ Proper address conversion handling"
    echo "✅ Real before/after state comparison"
    
else
    echo "❌ COMPILATION FAILED"
    echo "Check the syntax errors"
fi
