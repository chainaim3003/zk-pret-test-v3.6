#!/usr/bin/env node

/**
 * Test script for STDIO MCP Server
 * This script tests your MCP server's stdio functionality
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to your built MCP server
const serverPath = join(__dirname, 'build', 'pretmcpserver', 'index.js');

console.log('🚀 Testing PRET MCP Server in STDIO mode...');
console.log(`Server path: ${serverPath}`);

// Test messages to send to your MCP server
const testMessages = [
  // Initialize the connection
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  },
  
  // List available tools
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  },
  
  // Test GLEIF tool
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "get-GLEIF-data",
      arguments: {
        companyName: "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"
      }
    }
  }
];

function testMCPServer() {
  return new Promise((resolve, reject) => {
    console.log('\n📡 Starting MCP server process...');
    
    // Spawn the MCP server process
    const serverProcess = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let messageIndex = 0;
    let responses = [];

    // Handle server output
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📨 Server response:', output);
      
      try {
        // Try to parse JSON responses
        const lines = output.trim().split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            try {
              const response = JSON.parse(line);
              responses.push(response);
              console.log('✅ Parsed response:', JSON.stringify(response, null, 2));
            } catch (e) {
              console.log('📝 Non-JSON output:', line);
            }
          }
        });
      } catch (error) {
        console.log('📝 Raw output:', output);
      }

      // Send next message after receiving response
      setTimeout(() => {
        if (messageIndex < testMessages.length) {
          sendMessage(testMessages[messageIndex]);
          messageIndex++;
        } else {
          console.log('\n🎉 All test messages sent!');
          setTimeout(() => {
            serverProcess.kill();
            resolve(responses);
          }, 2000);
        }
      }, 1000);
    });

    // Handle server errors
    serverProcess.stderr.on('data', (data) => {
      console.log('🔍 Server stderr:', data.toString());
    });

    // Handle process exit
    serverProcess.on('close', (code) => {
      console.log(`\n🏁 Server process exited with code ${code}`);
      if (code !== 0) {
        reject(new Error(`Server ex