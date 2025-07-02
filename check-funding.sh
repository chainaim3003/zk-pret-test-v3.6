#!/bin/bash

# Check Devnet Account Funding Script
# Checks if accounts in JSON files are funded on Mina Devnet
# Uses direct GraphQL queries for reliable results

echo "🔍 Checking Devnet Account Funding..."
echo "====================================="

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🚀 Checking account funding..."
    
    # Check if a specific file was provided
    if [ -n "$1" ]; then
        node ./build/check-funding.js "$1"
    else
        node ./build/check-funding.js
    fi
else
    echo "❌ Build failed!"
    exit 1
fi
