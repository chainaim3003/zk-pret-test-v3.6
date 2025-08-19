#!/bin/bash

echo "🔨 Building PRET MCP Server with console.log fix..."

cd "C:\SATHYA\mcpservers\chainaim3003\36pretclone1\zk-pret-test-v3.6"

echo "📦 Running TypeScript compilation..."
npx tsc

if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "🧪 Ready to test the fixed server"
else
    echo "❌ Build failed!"
    exit 1
fi
