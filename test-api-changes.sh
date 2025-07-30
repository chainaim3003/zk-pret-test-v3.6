#!/bin/bash

echo "🔧 Testing 36clone2 Build After API Changes"
echo "=========================================="

cd "C:/SATHYA/CHAINAIM3003/mcp-servers/36clone2/zk-pret-test-v3.6"

echo "📦 Running TypeScript compilation..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ BUILD SUCCESSFUL!"
    echo "🎉 API changes applied successfully!"
    echo ""
    echo "📊 CHANGES MADE:"
    echo "  ✅ LOCAL environment now uses sandbox API"
    echo "  ✅ Authentication now included for LOCAL"
    echo "  ✅ API endpoint: https://api.sandbox.co.in/mca/company/master-data/search"
    echo "  ✅ Enhanced authentication logging"
    echo "  ✅ Bearer token formatting added"
    echo ""
    echo "🚀 Ready to test with:"
    echo "  npm run test:local-complete-CorpReg \"U01112TZ2022PTC039493\""
else
    echo ""
    echo "❌ BUILD FAILED"
    echo "There are TypeScript errors that need to be fixed."
fi

echo "=========================================="
echo "Build test completed."
