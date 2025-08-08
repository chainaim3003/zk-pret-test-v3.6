#!/bin/bash
cd "C:/SATHYA/CHAINAIM3003/mcp-servers/36clone4/zk-pret-test-v3.6"
echo "Building TypeScript project..."
npx tsc
echo "Build completed."
echo ""
echo "Checking for TypeScript errors:"
if [ $? -eq 0 ]; then
    echo "✅ Build successful - no TypeScript errors!"
else
    echo "❌ Build failed - TypeScript errors found"
fi
