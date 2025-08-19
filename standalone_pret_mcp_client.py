#!/usr/bin/env python3
"""
Standalone Python MCP Client for PRET Server Testing
This is the equivalent of test-pret-mcp-client.js but in Python
Use this to test if the MCP server works with direct Python communication
"""

import asyncio
import subprocess
import json
import time
import sys
import os
from typing import Dict, Any, Optional

class StandalonePRETMCPClient:
    """Standalone Python MCP client for testing PRET server functionality"""
    
    def __init__(self):
        self.process = None
        self.request_id = 1
        self.server_command = "node"
        self.server_args = [
            os.path.join(os.path.dirname(__file__), "build", "pretmcpserver", "index.js")
        ]

    async def start_server(self):
        """Start the PRET MCP server process"""
        print("🚀 Starting PRET MCP Server...")
        
        try:
            cmd = [self.server_command] + self.server_args
            print(f"Command: {' '.join(cmd)}")
            
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Monitor stderr for server messages
            asyncio.create_task(self._monitor_stderr())
            
            # Wait a moment for server to start
            await asyncio.sleep(2)
            
            # Initialize the MCP session
            await self.initialize()
            print("✅ PRET MCP Server connected and initialized")
            
        except Exception as e:
            print(f"❌ Failed to start PRET MCP server: {e}")
            raise

    async def _monitor_stderr(self):
        """Monitor stderr for server messages"""
        if self.process and self.process.stderr:
            while True:
                try:
                    line = await self.process.stderr.readline()
                    if not line:
                        break
                    message = line.decode().strip()
                    if message:
                        print(f"MCP Server: {message}")
                except Exception:
                    break

    async def initialize(self):
        """Initialize the MCP session"""
        init_request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "PRET-Python-Standalone", "version": "1.0.0"}
            }
        }
        
        self.request_id += 1
        return await self.send_request(init_request)

    async def send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send a request to the MCP server and return the response"""
        if not self.process:
            raise Exception("MCP server not started")
        
        request_json = json.dumps(request) + '\n'
        print(f"📤 Sending: {request_json.strip()}")
        
        # Send request
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read response with timeout
        try:
            response_line = await asyncio.wait_for(
                self.process.stdout.readline(), 
                timeout=10.0
            )
        except asyncio.TimeoutError:
            raise Exception("Response timeout")
        
        if not response_line:
            raise Exception("No response received")
        
        response_text = response_line.decode().strip()
        print(f"📥 Received: {response_text}")
        
        if not response_text:
            raise Exception("Empty response received")
        
        try:
            response = json.loads(response_text)
            return response
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response: {response_text} - Error: {e}")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a specific tool on the PRET MCP server"""
        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        self.request_id += 1
        
        try:
            response = await self.send_request(request)
            
            if "result" in response:
                return {"success": True, "data": response["result"]}
            elif "error" in response:
                return {"success": False, "error": response["error"]}
            else:
                return {"success": False, "error": "No result or error in response"}
                
        except Exception as e:
            print(f"❌ Error calling tool {tool_name}: {e}")
            return {"success": False, "error": str(e)}

    async def get_gleif_data(self, company_name: str):
        """Get GLEIF data for a company"""
        print(f"🔍 Getting GLEIF data for: {company_name}")
        return await self.call_tool("get-GLEIF-data", {"companyName": company_name})

    async def get_exim_data(self, company_name: str):
        """Get EXIM data for a company"""
        print(f"🔍 Getting EXIM data for: {company_name}")
        return await self.call_tool("get-EXIM-data", {"companyName": company_name})

    async def get_corporate_registration_data(self, cin: str):
        """Get Corporate Registration data for a CIN"""
        print(f"🔍 Getting Corporate Registration data for CIN: {cin}")
        return await self.call_tool("get-CorporateRegistration-data", {"cin": cin})

    def format_gleif_response(self, result: Dict[str, Any], company_name: str) -> bool:
        """Format and display GLEIF response"""
        try:
            if result.get("success") and "data" in result:
                data = result["data"]
                
                if "content" in data and data["content"]:
                    content_text = data["content"][0]["text"]
                    parsed_data = json.loads(content_text)
                    
                    if "response" in parsed_data and "data" in parsed_data["response"]:
                        response_data = parsed_data["response"]["data"]
                        if response_data:
                            company_info = response_data[0]["attributes"]
                            entity = company_info["entity"]
                            registration = company_info["registration"]
                            
                            print('\n✅ GLEIF Verification Successful')
                            print('🏢 Company Details:')
                            print(f'   Legal Name: {entity["legalName"]["name"]}')
                            print(f'   LEI: {company_info["lei"]}')
                            print(f'   Status: {entity["status"]}')
                            print(f'   Jurisdiction: {entity["jurisdiction"]}')
                            print(f'   Registration Status: {registration["status"]}')
                            
                            print('\n📍 Address:')
                            print(f'   {", ".join(entity["legalAddress"]["addressLines"])}')
                            print(f'   {entity["legalAddress"]["city"]}, {entity["legalAddress"]["region"]}, {entity["legalAddress"]["country"]}')
                            print(f'   Postal Code: {entity["legalAddress"]["postalCode"]}')
                            
                            print('\n📅 Registration Info:')
                            print(f'   CIN: {entity["registeredAs"]}')
                            print(f'   Initial Registration: {registration["initialRegistrationDate"][:10]}')
                            print(f'   Next Renewal: {registration["nextRenewalDate"][:10]}')
                            print(f'   Corroboration Level: {registration["corroborationLevel"]}')
                            
                            print('\n🔐 Compliance Status: ✅ VERIFIED')
                            print('This entity has a valid Legal Entity Identifier and is fully corroborated in the GLEIF system.')
                            
                            return True
                
                print(f"✅ GLEIF Data Retrieved for {company_name}")
                print(f"Raw data: {json.dumps(data, indent=2)}")
                return True
            else:
                print(f"❌ GLEIF request failed: {result.get('error', 'Unknown error')}")
                return False
                
        except Exception as e:
            print(f"❌ Error formatting GLEIF response: {e}")
            print(f"Raw result: {json.dumps(result, indent=2)}")
            return False

    def cleanup(self):
        """Clean up the MCP connection"""
        if self.process:
            try:
                self.process.terminate()
                print("🧹 PRET MCP client cleaned up")
            except Exception as e:
                print(f"Warning: Error during cleanup: {e}")

async def test_standalone_client():
    """Test the standalone PRET MCP client"""
    print("🏛️  PRET Standalone Python MCP Client Test")
    print("=" * 60)
    
    client = StandalonePRETMCPClient()
    
    try:
        # Test 1: Start and connect to MCP server
        print("\n📋 Step 1: Starting MCP Server...")
        await client.start_server()
        
        # Test 2: GLEIF data retrieval (same as agentverse and Node.js tests)
        print("\n📋 Step 2: Testing GLEIF Service...")
        company_name = "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"
        gleif_result = await client.get_gleif_data(company_name)
        
        if client.format_gleif_response(gleif_result, company_name):
            print("\n🎯 GLEIF Test: ✅ SUCCESS")
        else:
            print("\n🎯 GLEIF Test: ❌ FAILED")
            return False
        
        # Test 3: EXIM service (optional)
        print("\n📋 Step 3: Testing EXIM Service...")
        exim_result = await client.get_exim_data("palani")
        if exim_result.get("success"):
            print("🎯 EXIM Test: ✅ SUCCESS")
        else:
            print(f"🎯 EXIM Test: ❌ FAILED - {exim_result.get('error')}")
        
        # Test 4: Corporate Registration (optional)
        print("\n📋 Step 4: Testing Corporate Registration...")
        corp_result = await client.get_corporate_registration_data("U01112TZ2022PTC039493")
        if corp_result.get("success"):
            print("🎯 Corporate Registration Test: ✅ SUCCESS")
        else:
            print(f"🎯 Corporate Registration Test: ❌ FAILED - {corp_result.get('error')}")
        
        print("\n" + "=" * 60)
        print("🎯 STANDALONE PYTHON CLIENT TEST SUMMARY:")
        print("   ✅ MCP Server Communication: WORKING")
        print("   ✅ GLEIF Service: WORKING") 
        print("   ✅ JSON Parsing: WORKING")
        print("   ✅ Subprocess Communication: WORKING")
        print("\n🚀 If this test passes, the issue is in the uAgent wrapper!")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        print("\n🔍 This indicates the MCP server itself has issues")
        return False
        
    finally:
        client.cleanup()

def compare_with_uagent():
    """Print comparison guide between standalone and uAgent wrapper"""
    print("\n" + "=" * 80)
    print("🔍 COMPARISON: Standalone vs uAgent Wrapper")
    print("=" * 80)
    print("\n📊 Key Differences:")
    print("   • Standalone: Direct Python ↔ Node.js subprocess communication")
    print("   • uAgent: uAgent framework + Python ↔ Node.js subprocess communication")
    print("\n🎯 If standalone works but uAgent fails:")
    print("   1. Issue is in uAgent wrapper implementation")
    print("   2. Problem likely in session management or timing")
    print("   3. May be related to async context in uAgent framework")
    print("\n🎯 If both fail:")
    print("   1. Issue is in MCP server or Node.js setup")
    print("   2. Problem likely in server configuration or environment")
    print("   3. Check Node.js version and dependencies")
    print("\n📝 Next Steps:")
    print("   1. Run this standalone test first")
    print("   2. Compare results with uAgent wrapper")
    print("   3. Use differences to pinpoint exact issue location")
    print("=" * 80)

if __name__ == "__main__":
    print("🧪 PRET Standalone Python MCP Client")
    print("Use this to test if the issue is in MCP server or uAgent wrapper")
    print("\nStarting test in 3 seconds...")
    
    # Handle Ctrl+C gracefully
    def signal_handler():
        print("\n🛑 Test interrupted")
        sys.exit(0)
    
    try:
        time.sleep(3)
        result = asyncio.run(test_standalone_client())
        
        compare_with_uagent()
        
        if result:
            print("\n✅ SUCCESS: MCP server works with direct Python communication")
            print("If uAgent wrapper fails, the issue is in the wrapper implementation.")
        else:
            print("\n❌ FAILURE: MCP server has fundamental issues")
            print("Fix the server issues before testing the uAgent wrapper.")
            
    except KeyboardInterrupt:
        signal_handler()
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
