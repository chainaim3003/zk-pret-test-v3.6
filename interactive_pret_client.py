#!/usr/bin/env python3
"""
Interactive PRET MCP Client - Test Multiple Companies
Allows testing multiple company names one at a time with menu-driven interface
"""

import asyncio
import subprocess
import json
import time
import sys
import os
from typing import Dict, Any, Optional, List

class InteractivePRETMCPClient:
    """Interactive PRET MCP client for testing multiple companies"""
    
    def __init__(self):
        self.process = None
        self.request_id = 1
        self.server_command = "node"
        self.server_args = [
            os.path.join(os.path.dirname(__file__), "build", "pretmcpserver", "index.js")
        ]
        self.is_connected = False

    async def start_server(self):
        """Start the PRET MCP server process"""
        if self.is_connected:
            print("✅ Server already connected")
            return
            
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
            self.is_connected = True
            
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
                    if message and not message.startswith("[UTIL-LOG]"):
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
                "clientInfo": {"name": "PRET-Interactive-Client", "version": "1.0.0"}
            }
        }
        
        self.request_id += 1
        return await self.send_request(init_request)

    async def send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Send a request to the MCP server and return the response"""
        if not self.process:
            raise Exception("MCP server not started")
        
        request_json = json.dumps(request) + '\n'
        
        # Send request
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read response with timeout
        try:
            response_line = await asyncio.wait_for(
                self.process.stdout.readline(), 
                timeout=15.0
            )
        except asyncio.TimeoutError:
            raise Exception("Response timeout")
        
        if not response_line:
            raise Exception("No response received")
        
        response_text = response_line.decode().strip()
        
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

    async def test_gleif_company(self, company_name: str) -> bool:
        """Test GLEIF data for a single company"""
        print(f"\n🔍 Testing GLEIF for: {company_name}")
        print("=" * 60)
        
        result = await self.call_tool("get-GLEIF-data", {"companyName": company_name})
        
        if result.get("success") and "data" in result:
            data = result["data"]
            
            if "content" in data and data["content"]:
                content_text = data["content"][0]["text"]
                try:
                    parsed_data = json.loads(content_text)
                    
                    if "response" in parsed_data and "data" in parsed_data["response"]:
                        response_data = parsed_data["response"]["data"]
                        if response_data:
                            company_info = response_data[0]["attributes"]
                            entity = company_info["entity"]
                            registration = company_info["registration"]
                            
                            print('✅ GLEIF Verification Successful')
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
                            return True
                
                print(f"✅ GLEIF Data Retrieved for {company_name}")
                return True
            else:
                print(f"❌ No GLEIF data found for {company_name}")
                return False
        else:
            print(f"❌ GLEIF request failed: {result.get('error', 'Unknown error')}")
            return False

    async def test_exim_company(self, company_name: str) -> bool:
        """Test EXIM data for a single company"""
        print(f"\n🔍 Testing EXIM for: {company_name}")
        print("=" * 60)
        
        result = await self.call_tool("get-EXIM-data", {"companyName": company_name})
        
        if result.get("success"):
            print("✅ EXIM Test: SUCCESS")
            if "data" in result and "content" in result["data"]:
                content = result["data"]["content"][0]["text"]
                if "Error" not in content:
                    print(f"📊 EXIM Data: {content[:200]}...")
                else:
                    print(f"⚠️  EXIM Note: {content}")
            return True
        else:
            print(f"❌ EXIM Test: FAILED - {result.get('error')}")
            return False

    async def test_corporate_registration(self, cin: str) -> bool:
        """Test Corporate Registration for a CIN"""
        print(f"\n🔍 Testing Corporate Registration for CIN: {cin}")
        print("=" * 60)
        
        result = await self.call_tool("get-CorporateRegistration-data", {"cin": cin})
        
        if result.get("success"):
            print("✅ Corporate Registration Test: SUCCESS")
            if "data" in result and "content" in result["data"]:
                content_text = result["data"]["content"][0]["text"]
                try:
                    parsed_data = json.loads(content_text)
                    if "response" in parsed_data and "data" in parsed_data["response"]:
                        company_data = parsed_data["response"]["data"]["company_master_data"]
                        print(f"🏢 Company: {company_data.get('company_name', 'N/A')}")
                        print(f"📋 Status: {company_data.get('company_status(for_efiling)', 'N/A')}")
                        print(f"💰 Paid Capital: ₹{company_data.get('paid_up_capital(rs)', 'N/A')}")
                        print(f"📅 Incorporation: {company_data.get('date_of_incorporation', 'N/A')}")
                except:
                    print(f"📊 Raw Data Retrieved: {content_text[:200]}...")
            return True
        else:
            print(f"❌ Corporate Registration Test: FAILED - {result.get('error')}")
            return False

    def cleanup(self):
        """Clean up the MCP connection"""
        if self.process:
            try:
                self.process.terminate()
                self.is_connected = False
                print("🧹 PRET MCP client cleaned up")
            except Exception as e:
                print(f"Warning: Error during cleanup: {e}")

def print_menu():
    """Print the interactive menu"""
    print("\n" + "=" * 70)
    print("🏛️  INTERACTIVE PRET COMPLIANCE TESTING MENU")
    print("=" * 70)
    print("1. 🔍 Test GLEIF for a company")
    print("2. 📊 Test EXIM for a company") 
    print("3. 🏢 Test Corporate Registration (CIN)")
    print("4. 🚀 Test all services for a company")
    print("5. 📋 Test multiple companies from list")
    print("6. 💾 Load test data from file")
    print("7. ❓ Show help")
    print("8. 🚪 Exit")
    print("=" * 70)

def get_predefined_companies():
    """Get a list of predefined companies for testing"""
    return [
        "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED",
        "Tata Consultancy Services Limited",
        "Infosys Limited", 
        "Wipro Limited",
        "Reliance Industries Limited",
        "HDFC Bank Limited",
        "ICICI Bank Limited",
        "State Bank of India"
    ]

def get_predefined_cins():
    """Get a list of predefined CINs for testing"""
    return [
        "U01112TZ2022PTC039493",  # SREE PALANI ANDAVAR
        "L72900MH1995PLC084781",  # TCS
        "L85110KA1981PLC013115",  # Infosys
        "L92111KA1945PLC020800",  # Wipro
        "L17110MH1973PLC019786"   # Reliance
    ]

async def interactive_menu():
    """Main interactive menu loop"""
    client = InteractivePRETMCPClient()
    
    try:
        print("🏛️  INTERACTIVE PRET COMPLIANCE TESTING")
        print("Initializing connection...")
        await client.start_server()
        
        while True:
            print_menu()
            choice = input("\nEnter your choice (1-8): ").strip()
            
            if choice == "1":
                company_name = input("\nEnter company name: ").strip()
                if company_name:
                    await client.test_gleif_company(company_name)
                else:
                    print("❌ Please enter a valid company name")
                    
            elif choice == "2":
                company_name = input("\nEnter company name for EXIM: ").strip()
                if company_name:
                    await client.test_exim_company(company_name)
                else:
                    print("❌ Please enter a valid company name")
                    
            elif choice == "3":
                cin = input("\nEnter CIN: ").strip()
                if cin:
                    await client.test_corporate_registration(cin)
                else:
                    print("❌ Please enter a valid CIN")
                    
            elif choice == "4":
                company_name = input("\nEnter company name for full test: ").strip()
                if company_name:
                    print(f"\n🚀 Running full compliance test for: {company_name}")
                    gleif_success = await client.test_gleif_company(company_name)
                    exim_success = await client.test_exim_company(company_name)
                    
                    # Try to extract CIN from GLEIF data for corporate test
                    print("\n📋 Full Test Summary:")
                    print(f"   GLEIF: {'✅ PASS' if gleif_success else '❌ FAIL'}")
                    print(f"   EXIM:  {'✅ PASS' if exim_success else '❌ FAIL'}")
                else:
                    print("❌ Please enter a valid company name")
                    
            elif choice == "5":
                companies = get_predefined_companies()
                print("\n📋 Predefined Companies:")
                for i, company in enumerate(companies, 1):
                    print(f"   {i}. {company}")
                
                print(f"   {len(companies) + 1}. Test all companies")
                
                selection = input(f"\nSelect company (1-{len(companies) + 1}): ").strip()
                
                try:
                    sel_num = int(selection)
                    if 1 <= sel_num <= len(companies):
                        await client.test_gleif_company(companies[sel_num - 1])
                    elif sel_num == len(companies) + 1:
                        print("\n🚀 Testing all predefined companies...")
                        for i, company in enumerate(companies, 1):
                            print(f"\n📋 Testing {i}/{len(companies)}: {company}")
                            await client.test_gleif_company(company)
                            await asyncio.sleep(1)  # Brief pause between tests
                    else:
                        print("❌ Invalid selection")
                except ValueError:
                    print("❌ Please enter a valid number")
                    
            elif choice == "6":
                filename = input("\nEnter filename (or press Enter for 'companies.txt'): ").strip()
                if not filename:
                    filename = "companies.txt"
                
                try:
                    with open(filename, 'r') as f:
                        companies = [line.strip() for line in f if line.strip()]
                    
                    print(f"\n📂 Loaded {len(companies)} companies from {filename}")
                    for i, company in enumerate(companies, 1):
                        print(f"\n📋 Testing {i}/{len(companies)}: {company}")
                        await client.test_gleif_company(company)
                        await asyncio.sleep(1)
                        
                except FileNotFoundError:
                    print(f"❌ File '{filename}' not found")
                    print("💡 Create a text file with one company name per line")
                    
            elif choice == "7":
                print_help()
                
            elif choice == "8":
                print("\n👋 Goodbye!")
                break
                
            else:
                print("❌ Invalid choice. Please select 1-8.")
                
            input("\nPress Enter to continue...")
            
    except KeyboardInterrupt:
        print("\n🛑 Operation interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        client.cleanup()

def print_help():
    """Print detailed help information"""
    print("\n" + "=" * 70)
    print("❓ HELP - How to Use the Interactive PRET Client")
    print("=" * 70)
    print("""
🔍 GLEIF Testing:
   • Tests Legal Entity Identifier verification
   • Use exact legal company names
   • Example: "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"

📊 EXIM Testing:
   • Tests Export-Import compliance data
   • May return 404 for companies without EXIM data
   • Example: Use shorter names like "palani"

🏢 Corporate Registration:
   • Tests CIN (Corporate Identification Number) verification
   • Use valid Indian CIN format
   • Example: "U01112TZ2022PTC039493"

🚀 Full Test:
   • Runs GLEIF and EXIM tests for a company
   • Comprehensive compliance verification

📋 Predefined Companies:
   • Select from pre-loaded company list
   • Option to test all companies sequentially

💾 File Loading:
   • Load companies from text file
   • One company name per line
   • Create 'companies.txt' with your test data

💡 Tips:
   • Use exact legal names for GLEIF
   • CINs must be valid Indian corporate identifiers
   • 404 errors in EXIM are normal for test data
   • Press Ctrl+C to interrupt long operations
""")

async def batch_test_mode():
    """Run batch tests from command line arguments"""
    if len(sys.argv) < 2:
        return False
        
    mode = sys.argv[1].lower()
    client = InteractivePRETMCPClient()
    
    try:
        await client.start_server()
        
        if mode == "--gleif" and len(sys.argv) > 2:
            for company in sys.argv[2:]:
                await client.test_gleif_company(company)
                
        elif mode == "--exim" and len(sys.argv) > 2:
            for company in sys.argv[2:]:
                await client.test_exim_company(company)
                
        elif mode == "--cin" and len(sys.argv) > 2:
            for cin in sys.argv[2:]:
                await client.test_corporate_registration(cin)
                
        elif mode == "--file" and len(sys.argv) > 2:
            filename = sys.argv[2]
            with open(filename, 'r') as f:
                companies = [line.strip() for line in f if line.strip()]
            for company in companies:
                await client.test_gleif_company(company)
                
        else:
            return False
            
        return True
        
    finally:
        client.cleanup()

if __name__ == "__main__":
    print("🏛️  INTERACTIVE PRET COMPLIANCE TESTING CLIENT")
    print("=" * 70)
    
    # Check for batch mode
    try:
        if asyncio.run(batch_test_mode()):
            sys.exit(0)
    except:
        pass
    
    # Run interactive mode
    print("\nUsage Examples:")
    print("  Interactive: python interactive_pret_client.py")
    print("  Batch GLEIF: python interactive_pret_client.py --gleif \"Company 1\" \"Company 2\"")
    print("  Batch File:  python interactive_pret_client.py --file companies.txt")
    print("  Batch CIN:   python interactive_pret_client.py --cin \"CIN1\" \"CIN2\"")
    print("\nStarting interactive mode...\n")
    
    try:
        asyncio.run(interactive_menu())
    except KeyboardInterrupt:
        print("\n🛑 Program interrupted")
    except Exception as e:
        print(f"\n❌ Error: {e}")
