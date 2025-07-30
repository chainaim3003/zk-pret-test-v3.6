#!/bin/bash

echo "🔧 Running TypeScript build check..."
echo "======================================"

cd "C:/SATHYA/CHAINAIM3003/mcp-servers/36clone2/zk-pret-test-v3.6"

# Run TypeScript compiler
echo "📦 Running npm run build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🎉 All TypeScript errors have been resolved!"
else
    echo "❌ Build failed. There are still TypeScript errors."
    echo "📝 Please check the error output above."
fi

echo "======================================"
echo "Build check completed."
