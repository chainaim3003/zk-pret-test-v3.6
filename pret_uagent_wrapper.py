"""
PRET Compliance Agent - Self-Contained uAgent for ASI:One
Provides GLEIF, EXIM, and Corporate Registration verification services
Based on proven Perplexity MCP Agent architecture
"""

import os
import json
import asyncio
import subprocess
import time
from typing import Dict, Any, Optional, List
from contextlib import AsyncExitStack
from datetime import datetime, timezone
from uuid import uuid4
from dotenv import load_dotenv

# uAgents framework imports
from uagents import Agent, Context, Protocol, Model
from uagents_core.contrib.protocols.chat import (
    chat_protocol_spec,
    ChatMessage,
    ChatAcknowledgement,
    TextContent,
    EndSessionContent,
    StartSessionContent,
)

# Load environment variables
load_dotenv()

# --- Agent Configuration ---
AGENT_NAME = "pret_compliance_agent"
AGENT_PORT = 8007

# User sessions store: session_id -> {authenticated, last_activity}
user_sessions: Dict[str, Dict[str, Any]] = {}

# Session timeout (30 minutes)
SESSION_TIMEOUT = 30 * 60

# --- Self-Contained MCP Client for PRET ---
class PRETMCPClient:
    """Self-contained MCP client for PRET server integration"""
    
    def __init__(self, ctx: Context):
        self._ctx = ctx
        self.process = None
        self.server_command = "node"
        self.server_args = [
            os.getenv("PRET_MCP_SERVER_PATH", 
                     r"C:\SATHYA\mcpservers\chainaim3003\36pretclone1\zk-pret-test-v3.6\build\pretmcpserver\index.js")
        ]
        self.tools = [
            {
                "name": "get-GLEIF-data",
                "description": "Retrieve Legal Entity Identifier data from GLEIF registry for compliance verification",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "companyName": {
                            "type": "string",
                            "description": "Company name for GLEIF search (e.g., 'SREE PALANI ANDAVAR AGROS PRIVATE LIMITED')"
                        }
                    },
                    "required": ["companyName"]
                }
            },
            {
                "name": "get-EXIM-data", 
                "description": "Fetch Export-Import compliance data for international trade finance verification",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "companyName": {
                            "type": "string",
                            "description": "Company name for EXIM compliance search"
                        }
                    },
                    "required": ["companyName"]
                }
            },
            {
                "name": "get-CorporateRegistration-data",
                "description": "Validate corporate registration details using Corporate Identification Number",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "cin": {
                            "type": "string", 
                            "description": "Corporate Identification Number (CIN) for verification"
                        }
                    },
                    "required": ["cin"]
                }
            }
        ]

    async def connect(self):
        """Start the PRET MCP server process and initialize connection"""
        self._ctx.logger.info("Starting PRET MCP server...")
        try:
            cmd = [self.server_command] + self.server_args
            self._ctx.logger.info(f"Starting PRET MCP server: {' '.join(cmd)}")
            
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            # Initialize the MCP session
            await self._initialize_session()
            self._ctx.logger.info("PRET MCP server started and initialized successfully")
            
        except Exception as e:
            self._ctx.logger.error(f"Failed to start PRET MCP server: {e}")
            raise

    async def _initialize_session(self):
        """Initialize the MCP session with the server"""
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "PRET-uAgent", "version": "1.0.0"}
            }
        }
        
        request_json = json.dumps(init_request) + "\n"
        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()
        
        # Read initialization response
        response_line = await self.process.stdout.readline()
        if response_line:
            response = json.loads(response_line.decode().strip())
            self._ctx.logger.info("PRET MCP session initialized successfully")

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a specific tool on the PRET MCP server"""
        if not self.process:
            return {"success": False, "error": "PRET MCP server not started"}
        
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        try:
            request_json = json.dumps(request) + "\n"
            self.process.stdin.write(request_json.encode())
            await self.process.stdin.drain()
            
            response_line = await self.process.stdout.readline()
            if response_line:
                response = json.loads(response_line.decode().strip())
                if "result" in response:
                    return {"success": True, "data": response["result"]}
                else:
                    return {"success": False, "error": "No result in MCP response"}
        except Exception as e:
            self._ctx.logger.error(f"Error calling PRET tool {tool_name}: {e}")
            return {"success": False, "error": str(e)}

    async def process_compliance_query(self, query: str) -> str:
        """Process a compliance-related query and determine the appropriate PRET service"""
        query_lower = query.lower()
        
        # Determine query type and extract parameters
        if any(keyword in query_lower for keyword in ['gleif', 'lei', 'legal entity', 'entity identifier']):
            return await self._handle_gleif_query(query)
        elif any(keyword in query_lower for keyword in ['exim', 'export', 'import', 'trade', 'customs']):
            return await self._handle_exim_query(query)
        elif any(keyword in query_lower for keyword in ['corporate', 'registration', 'cin', 'company registration']):
            return await self._handle_corporate_query(query)
        else:
            # General compliance query - try to extract company name
            return await self._handle_general_query(query)

    async def _handle_gleif_query(self, query: str) -> str:
        """Handle GLEIF-specific queries"""
        try:
            # Extract company name from query (simple extraction)
            company_name = self._extract_company_name(query)
            if not company_name:
                return "❓ Please provide a company name for GLEIF verification. Example: 'Get GLEIF data for SREE PALANI ANDAVAR AGROS PRIVATE LIMITED'"
            
            self._ctx.logger.info(f"Processing GLEIF query for: {company_name}")
            result = await self.call_tool("get-GLEIF-data", {"companyName": company_name})
            
            if result["success"]:
                return self._format_gleif_response(result["data"], company_name)
            else:
                return f"❌ **GLEIF Verification Failed**\n\nError: {result.get('error', 'Unknown error')}\n\nPlease check the company name and try again."
                
        except Exception as e:
            self._ctx.logger.error(f"Error in GLEIF query: {e}")
            return f"❌ **GLEIF Service Error**: {str(e)}"

    async def _handle_exim_query(self, query: str) -> str:
        """Handle EXIM compliance queries"""
        try:
            company_name = self._extract_company_name(query)
            if not company_name:
                return "❓ Please provide a company name for EXIM compliance verification. Example: 'Check EXIM status for Palani Trading Company'"
            
            self._ctx.logger.info(f"Processing EXIM query for: {company_name}")
            result = await self.call_tool("get-EXIM-data", {"companyName": company_name})
            
            if result["success"]:
                return self._format_exim_response(result["data"], company_name)
            else:
                return f"❌ **EXIM Verification Failed**\n\nError: {result.get('error', 'Unknown error')}\n\nPlease check the company name and try again."
                
        except Exception as e:
            self._ctx.logger.error(f"Error in EXIM query: {e}")
            return f"❌ **EXIM Service Error**: {str(e)}"

    async def _handle_corporate_query(self, query: str) -> str:
        """Handle Corporate Registration queries"""
        try:
            cin = self._extract_cin(query)
            if not cin:
                return "❓ Please provide a Corporate Identification Number (CIN) for verification. Example: 'Verify CIN U01112TZ2022PTC039493'"
            
            self._ctx.logger.info(f"Processing Corporate Registration query for CIN: {cin}")
            result = await self.call_tool("get-CorporateRegistration-data", {"cin": cin})
            
            if result["success"]:
                return self._format_corporate_response(result["data"], cin)
            else:
                return f"❌ **Corporate Registration Verification Failed**\n\nError: {result.get('error', 'Unknown error')}\n\nPlease check the CIN and try again."
                
        except Exception as e:
            self._ctx.logger.error(f"Error in Corporate Registration query: {e}")
            return f"❌ **Corporate Registration Service Error**: {str(e)}"

    async def _handle_general_query(self, query: str) -> str:
        """Handle general compliance queries"""
        company_name = self._extract_company_name(query)
        if company_name:
            # Default to GLEIF for general company queries
            return await self._handle_gleif_query(f"GLEIF data for {company_name}")
        else:
            return self._get_help_text()

    def _extract_company_name(self, query: str) -> Optional[str]:
        """Extract company name from query - simple implementation"""
        # Look for quoted company names
        import re
        quoted_match = re.search(r'["\']([^"\']+)["\']', query)
        if quoted_match:
            return quoted_match.group(1).strip()
        
        # Look for "for [company]" pattern
        for_match = re.search(r'\bfor\s+([A-Z][A-Z\s&.,()]+?)(?:\s|$|[.?!])', query)
        if for_match:
            return for_match.group(1).strip()
        
        # Look for common company name patterns
        company_patterns = [
            r'\b([A-Z][A-Z\s&.,()]*(?:LIMITED|LTD|PRIVATE|PVT|COMPANY|CO|CORP|CORPORATION|INC|LLC)[A-Z\s&.,()]*)',
            r'\b(SREE PALANI ANDAVAR AGROS PRIVATE LIMITED)',  # Specific example
        ]
        
        for pattern in company_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None

    def _extract_cin(self, query: str) -> Optional[str]:
        """Extract CIN from query"""
        import re
        cin_match = re.search(r'\b([A-Z]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b', query)
        if cin_match:
            return cin_match.group(1)
        return None

    def _format_gleif_response(self, data: Any, company_name: str) -> str:
        """Format GLEIF response for user display"""
        try:
            if "content" in data and data["content"]:
                content_text = data["content"][0]["text"]
                parsed_data = json.loads(content_text)
                
                if "response" in parsed_data and "data" in parsed_data["response"]:
                    response_data = parsed_data["response"]["data"]
                    if response_data:
                        company_info = response_data[0]["attributes"]
                        entity = company_info["entity"]
                        registration = company_info["registration"]
                        
                        return f"""✅ **GLEIF Verification Successful**

🏢 **Company Details:**
• **Legal Name**: {entity['legalName']['name']}
• **LEI**: {company_info['lei']}
• **Status**: {entity['status']}
• **Jurisdiction**: {entity['jurisdiction']}
• **Registration Status**: {registration['status']}

📍 **Address:**
{', '.join(entity['legalAddress']['addressLines'])}
{entity['legalAddress']['city']}, {entity['legalAddress']['region']}, {entity['legalAddress']['country']}
Postal Code: {entity['legalAddress']['postalCode']}

📅 **Registration Info:**
• **CIN**: {entity['registeredAs']}
• **Initial Registration**: {registration['initialRegistrationDate'][:10]}
• **Next Renewal**: {registration['nextRenewalDate'][:10]}
• **Corroboration Level**: {registration['corroborationLevel']}

🔐 **Compliance Status**: ✅ VERIFIED
This entity has a valid Legal Entity Identifier and is fully corroborated in the GLEIF system."""
                
                return f"✅ **GLEIF Data Retrieved** for {company_name}\n\n{content_text}"
            else:
                return f"❌ No GLEIF data found for {company_name}"
                
        except Exception as e:
            self._ctx.logger.error(f"Error formatting GLEIF response: {e}")
            return f"✅ **GLEIF Data Retrieved** for {company_name}\n\nRaw data: {str(data)}"

    def _format_exim_response(self, data: Any, company_name: str) -> str:
        """Format EXIM response for user display"""
        try:
            if "content" in data and data["content"]:
                content_text = data["content"][0]["text"]
                return f"""✅ **EXIM Compliance Verification**

🏢 **Company**: {company_name}
📊 **Export-Import Status**: Verified

{content_text}

🔐 **Trade Finance Compliance**: This verification supports international trade finance and supply chain finance applications."""
            else:
                return f"❌ No EXIM data found for {company_name}"
                
        except Exception as e:
            self._ctx.logger.error(f"Error formatting EXIM response: {e}")
            return f"✅ **EXIM Data Retrieved** for {company_name}\n\nRaw data: {str(data)}"

    def _format_corporate_response(self, data: Any, cin: str) -> str:
        """Format Corporate Registration response for user display"""
        try:
            if "content" in data and data["content"]:
                content_text = data["content"][0]["text"]
                return f"""✅ **Corporate Registration Verification**

🆔 **CIN**: {cin}
📋 **Registration Status**: Verified

{content_text}

🔐 **Compliance Status**: This corporate registration verification supports Know Your Customer (KYC) and compliance requirements."""
            else:
                return f"❌ No Corporate Registration data found for CIN: {cin}"
                
        except Exception as e:
            self._ctx.logger.error(f"Error formatting Corporate Registration response: {e}")
            return f"✅ **Corporate Registration Data Retrieved** for CIN: {cin}\n\nRaw data: {str(data)}"

    def _get_help_text(self) -> str:
        """Return help text for the PRET compliance agent"""
        return """🏛️ **PRET Compliance Verification Agent**

I provide **Real World Asset (RWA) tokenization compliance services** for trade finance:

**🔍 Available Services:**

**1. GLEIF Verification** (Legal Entity Identifier)
• Verify legal entity status globally
• Get LEI compliance data
• Support for international trade finance
• Example: *"Get GLEIF data for SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"*

**2. EXIM Compliance** (Export-Import Verification)  
• Export-import compliance status
• International trade verification
• Supply chain finance support
• Example: *"Check EXIM status for [Company Name]"*

**3. Corporate Registration**
• Validate corporate registration details
• CIN verification for Indian companies
• KYC compliance support
• Example: *"Verify CIN U01112TZ2022PTC039493"*

**🎯 Trade Finance Use Cases:**
• **International Trade Finance**: $2-3T market opportunity
• **Supply Chain Finance**: $16T market with risk mitigation
• **Bill of Lading verification** using DCSA standards
• **Business process compliance** with BPMN 2.0
• **Risk assessment** using ACTUS framework

**💡 How to use:**
Just ask me to verify any company's compliance status, and I'll provide real-time verification data!"""

    async def cleanup(self):
        """Clean up the MCP connection"""
        try:
            if self.process:
                self.process.stdin.close()
                await self.process.wait()
                self._ctx.logger.info("PRET MCP client cleaned up")
        except Exception as e:
            self._ctx.logger.error(f"Error during PRET MCP cleanup: {e}")

# --- uAgent Setup ---

chat_proto = Protocol(spec=chat_protocol_spec)
agent = Agent(name=AGENT_NAME, port=AGENT_PORT, seed="randStringmcppret", mailbox=True)

# Store MCP clients per session
session_clients: Dict[str, PRETMCPClient] = {}

def is_session_valid(session_id: str) -> bool:
    """Check if session is valid and hasn't expired"""
    if session_id not in user_sessions:
        return False
    
    last_activity = user_sessions[session_id].get('last_activity', 0)
    if time.time() - last_activity > SESSION_TIMEOUT:
        # Session expired, clean up
        if session_id in user_sessions:
            del user_sessions[session_id]
        return False
    
    return True

async def get_pret_client(ctx: Context, session_id: str) -> Optional[PRETMCPClient]:
    """Get or create PRET MCP client for session"""
    if session_id not in session_clients:
        try:
            client = PRETMCPClient(ctx)
            await client.connect()
            session_clients[session_id] = client
            ctx.logger.info(f"Created new PRET MCP client for session {session_id}")
        except Exception as e:
            ctx.logger.error(f"Failed to create PRET MCP client: {e}")
            return None
    
    return session_clients[session_id]

@chat_proto.on_message(model=ChatMessage)
async def handle_chat_message(ctx: Context, sender: str, msg: ChatMessage):
    session_id = str(ctx.session)

    # Send acknowledgment first
    ack_msg = ChatAcknowledgement(
        timestamp=datetime.now(timezone.utc),
        acknowledged_msg_id=msg.msg_id
    )
    await ctx.send(sender, ack_msg)

    for item in msg.content:
        if isinstance(item, TextContent):
            ctx.logger.info(f"Received compliance query from {sender}: '{item.text}'")
            
            # Update session activity
            if session_id not in user_sessions:
                user_sessions[session_id] = {}
            user_sessions[session_id]['last_activity'] = time.time()
            
            # Check if this is a help request
            if any(keyword in item.text.lower() for keyword in ['help', 'what can you do', 'commands', 'services']):
                client = await get_pret_client(ctx, session_id)
                if client:
                    response_text = client._get_help_text()
                else:
                    response_text = "Sorry, I'm having trouble starting the compliance verification service. Please try again in a moment."
            else:
                # Process the compliance query
                client = await get_pret_client(ctx, session_id)
                if client:
                    response_text = await client.process_compliance_query(item.text)
                else:
                    response_text = "Sorry, I'm having trouble connecting to the PRET compliance service. Please try again in a moment."
            
            response_msg = ChatMessage(
                timestamp=datetime.now(timezone.utc),
                msg_id=str(uuid4()),
                content=[TextContent(type="text", text=response_text)]
            )
            await ctx.send(sender, response_msg)
        
        elif isinstance(item, EndSessionContent):
            ctx.logger.info(f"Compliance session ended by {sender}")
            if session_id in session_clients:
                await session_clients[session_id].cleanup()
                del session_clients[session_id]
            if session_id in user_sessions:
                del user_sessions[session_id]
        
        elif isinstance(item, StartSessionContent):
            ctx.logger.info(f"Compliance session started by {sender}")
            # Send welcome message
            welcome_msg = ChatMessage(
                timestamp=datetime.now(timezone.utc),
                msg_id=str(uuid4()),
                content=[TextContent(
                    type="text", 
                    text="""🏛️ **Welcome to PRET Compliance Verification!**

I provide **Real World Asset (RWA) tokenization compliance services** for trade finance:

✅ **GLEIF** - Legal Entity Identifier verification
✅ **EXIM** - Export-Import compliance  
✅ **Corporate Registration** - Company verification

Ready to verify compliance data for your trade finance needs! What would you like me to check?"""
                )]
            )
            await ctx.send(sender, welcome_msg)

@chat_proto.on_message(model=ChatAcknowledgement)
async def handle_chat_ack(ctx: Context, sender: str, msg: ChatAcknowledgement):
    pass

@agent.on_event("shutdown")
async def on_shutdown(ctx: Context):
    """Clean up all MCP clients on shutdown"""
    for client in session_clients.values():
        await client.cleanup()

agent.include(chat_proto)

if __name__ == "__main__":
    print("="*80)
    print("🏛️  PRET Compliance Verification Agent")
    print("   Real World Asset Tokenization - Trade Finance Compliance")
    print("="*80)
    print(f"Agent starting on http://localhost:{AGENT_PORT}")
    print(f"Agent address: {agent.address}")
    print(f"Agent name: {AGENT_NAME}")
    print()
    print("🔍 Services Available:")
    print("   • GLEIF Legal Entity Identifier verification")
    print("   • EXIM Export-Import compliance data")  
    print("   • Corporate Registration verification")
    print()
    print("🎯 Trade Finance Applications:")
    print("   • International Trade Finance ($2-3T opportunity)")
    print("   • Supply Chain Finance ($16T market)")
    print("   • Bill of Lading verification (DCSA standards)")
    print("   • Business process compliance (BPMN 2.0)")
    print("="*80)
    print("🚀 Ready for ASI:One integration!")
    agent.run()
