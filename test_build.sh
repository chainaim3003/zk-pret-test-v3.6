#!/bin/bash
cd /c/SATHYA/CHAINAIM3003/mcp-servers/36clone2/zk-pret-test-v3.6
echo "🔨 Building project..."
npm run build > build_output.txt 2>&1
echo "Build exit code: $?"
echo "=== Build Output ==="
cat build_output.txt
