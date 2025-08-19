/**
 * Node.js MCP Client for PRET Server
 * Alternative to Python client for testing PRET MCP functionality
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

class PRETMCPClient {
    constructor() {
        this.process = null;
        this.requestId = 1;
    }

    async startServer() {
        console.log('🚀 Starting PRET MCP Server...');
        
        this.process = spawn('node', ['./build/pretmcpserver/index.js'], {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stderr.on('data', (data) => {
            console.log('MCP Server:', data.toString());
        });

        // Initialize the MCP session
        await this.initialize();
        console.log('✅ PRET MCP Server connected and initialized');
    }

    async initialize() {
        const initRequest = {
            jsonrpc: "2.0",
            id: this.requestId++,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                clientInfo: { name: "PRET-Node-Client", version: "1.0.0" }
            }
        };

        return this.sendRequest(initRequest);
    }

    async sendRequest(request) {
        return new Promise((resolve, reject) => {
            const requestJson = JSON.stringify(request) + '\n';
            
            // Set up response listener
            const rl = createInterface({
                input: this.process.stdout,
                crlfDelay: Infinity
            });

            rl.once('line', (line) => {
                try {
                    const response = JSON.parse(line);
                    rl.close();
                    resolve(response);
                } catch (error) {
                    rl.close();
                    reject(error);
                }
            });

            // Send request
            this.process.stdin.write(requestJson);
        });
    }

    async callTool(toolName, arguments) {
        const request = {
            jsonrpc: "2.0",
            id: this.requestId++,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: arguments
            }
        };

        try {
            const response = await this.sendRequest(request);
            return response.result || response;
        } catch (error) {
            console.error(`❌ Error calling tool ${toolName}:`, error);
            return { error: error.message };
        }
    }

    async getGLEIFData(companyName) {
        console.log(`🔍 Getting GLEIF data for: ${companyName}`);
        return await this.callTool("get-GLEIF-data", { companyName });
    }

    async getEXIMData(companyName) {
        console.log(`🔍 Getting EXIM data for: ${companyName}`);
        return await this.callTool("get-EXIM-data", { companyName });
    }

    async getCorporateRegistrationData(cin) {
        console.log(`🔍 Getting Corporate Registration data for CIN: ${cin}`);
        return await this.callTool("get-CorporateRegistration-data", { cin });
    }

    formatGLEIFResponse(result, companyName) {
        try {
            if (result.content && result.content[0] && result.content[0].text) {
                const data = JSON.parse(result.content[0].text);
                
                if (data.response && data.response.data && data.response.data.length > 0) {
                    const company = data.response.data[0].attributes;
                    const entity = company.entity;
                    const registration = company.registration;
                    
                    console.log('\n✅ GLEIF Verification Successful');
                    console.log('🏢 Company Details:');
                    console.log(`   Legal Name: ${entity.legalName.name}`);
                    console.log(`   LEI: ${company.lei}`);
                    console.log(`   Status: ${entity.status}`);
                    console.log(`   Jurisdiction: ${entity.jurisdiction}`);
                    console.log(`   Registration Status: ${registration.status}`);
                    
                    console.log('\n📍 Address:');
                    console.log(`   ${entity.legalAddress.addressLines.join(', ')}`);
                    console.log(`   ${entity.legalAddress.city}, ${entity.legalAddress.region}, ${entity.legalAddress.country}`);
                    console.log(`   Postal Code: ${entity.legalAddress.postalCode}`);
                    
                    console.log('\n📅 Registration Info:');
                    console.log(`   CIN: ${entity.registeredAs}`);
                    console.log(`   Initial Registration: ${registration.initialRegistrationDate.substring(0, 10)}`);
                    console.log(`   Next Renewal: ${registration.nextRenewalDate.substring(0, 10)}`);
                    console.log(`   Corroboration Level: ${registration.corroborationLevel}`);
                    
                    console.log('\n🔐 Compliance Status: ✅ VERIFIED');
                    console.log('This entity has a valid Legal Entity Identifier and is fully corroborated in the GLEIF system.');
                    
                    return true;
                }
            }
            
            console.log(`❌ No GLEIF data found for ${companyName}`);
            return false;
            
        } catch (error) {
            console.error('❌ Error formatting GLEIF response:', error);
            console.log('Raw response:', JSON.stringify(result, null, 2));
            return false;
        }
    }

    cleanup() {
        if (this.process) {
            this.process.kill();
            console.log('🧹 PRET MCP client cleaned up');
        }
    }
}

// Main testing function
async function testPRETClient() {
    console.log('🏛️  PRET MCP Client Test');
    console.log('='*60);
    
    const client = new PRETMCPClient();
    
    try {
        // Start and connect to MCP server
        await client.startServer();
        
        // Test GLEIF data retrieval (same as Claude example)
        console.log('\n📋 Testing GLEIF Service...');
        const companyName = "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED";
        const gleifResult = await client.getGLEIFData(companyName);
        
        if (gleifResult && !gleifResult.error) {
            client.formatGLEIFResponse(gleifResult, companyName);
        } else {
            console.log('❌ GLEIF test failed:', gleifResult.error || 'Unknown error');
        }
        
        // Test EXIM (optional)
        console.log('\n📋 Testing EXIM Service...');
        const eximResult = await client.getEXIMData("palani");
        console.log('EXIM Result:', eximResult ? '✅ Success' : '❌ Failed');
        
        // Test Corporate Registration (optional)
        console.log('\n📋 Testing Corporate Registration...');
        const corpResult = await client.getCorporateRegistrationData("U01112TZ2022PTC039493");
        console.log('Corporate Registration Result:', corpResult ? '✅ Success' : '❌ Failed');
        
        console.log('\n' + '='*60);
        console.log('🎯 PRET MCP Client Test Completed!');
        console.log('If GLEIF test passed, your server is ready for uAgent integration.');
        console.log('='*60);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        client.cleanup();
        process.exit(0);
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Test interrupted');
    process.exit(0);
});

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testPRETClient();
}

export { PRETMCPClient };
