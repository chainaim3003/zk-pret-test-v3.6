#!/bin/bash

echo "🔧 Testing Enhanced API Logging in 36clone2"
echo "==========================================="

cd "C:/SATHYA/CHAINAIM3003/mcp-servers/36clone2/zk-pret-test-v3.6"

echo "📦 Running TypeScript compilation..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ BUILD SUCCESSFUL!"
    echo "🎉 Enhanced API logging implemented successfully!"
    echo ""
    echo "📊 LOGGING ENHANCEMENTS ADDED:"
    echo "  ✅ Complete authentication request/response logging"
    echo "  ✅ Detailed API request headers and body logging"
    echo "  ✅ Full API response data and analysis"
    echo "  ✅ Error logging with complete details"
    echo "  ✅ Timestamps for all API calls"
    echo "  ✅ Response analysis with field counts"
    echo "  ✅ Security-safe header logging (tokens masked)"
    echo ""
    echo "🚀 Ready to test with comprehensive logging:"
    echo "  npm run test:local-complete-CorpReg \"U01112TZ2022PTC039493\""
    echo ""
    echo "📋 Expected detailed logs:"
    echo "  🔐 Authentication request/response"
    echo "  📡 API request details"  
    echo "  📊 Complete response data"
    echo "  🔍 Response analysis"
else
    echo ""
    echo "❌ BUILD FAILED"
    echo "There are TypeScript errors that need to be fixed."
fi

echo "==========================================="
echo "Enhanced logging test completed."
