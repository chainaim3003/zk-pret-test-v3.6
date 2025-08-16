import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {fetchGLEIFCompanyDataWithFullDetails} from "../tests/with-sign/GLEIFBasicUtils.js";
import { fetchEXIMCompanyData } from "../tests/with-sign/EXIMBasicUtils.js";
import {fetchCorporateRegistrationData} from "../tests/with-sign/CorporateRegistrationBasicUtils.js";


export function registerPRETTools(server: McpServer) {  
//server tool gleif api call
  server.tool(
    "get-GLEIF-data",
    "get GLEIF data for a company name and depending on the environment it will call different apis example TESTNET vs MAINNET vs LOCAL",
    {
      companyName: z.string().describe("Company name for GLEIF search (e.g., 'SREE PALANI ANDAVAR AGROS PRIVATE LIMITED')"),
      //typeOfNet: z.string().optional().describe("Network name (e.g., 'LOCAL OR TESTNET OR MAINNET')")
    },
    async ({ companyName }: { companyName: string }) => {
      try {
        //console.log(`Resolving GLEIF data for company: ${companyName} on network: ${typeOfNet ?? 'TESTNET'}`);
        const response = await fetchGLEIFCompanyDataWithFullDetails(companyName);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              companyName: companyName,
              response: response,
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error resolving company name: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );


  //server tool EXIM api call 
  server.tool(
    "get-EXIM-data",
    "get EXIM data takes company name and type of net TESTNET,MAINNET,etc and get EXIM compliance data for different regions",
    {
      companyName: z.string().describe("Company name for EXIM search (e.g., 'zenova_dgft')"),
      //typeOfNet: z.string().optional().describe("Network name (e.g., 'LOCAL OR TESTNET OR MAINNET')")
    },
    async ({ companyName }: { companyName: string }) => {
      try {
        //console.log(`Resolving GLEIF data for company: ${companyName} on network: ${typeOfNet ?? 'TESTNET'}`);
        const response = await fetchEXIMCompanyData(companyName);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              companyName: companyName,
              response: response,
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error resolving company name: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );
  server.tool(
    "get-CorporateRegistration-data",
    "get GLEIF data for a company name and depending on the environment it will call different apis example TESTNET vs MAINNET vs LOCAL",
    {
      cin: z.string().describe("CIN for MCA search (e.g., 'U01112TZ2022PTC039493')"),
      //typeOfNet: z.string().optional().describe("Network name (e.g., 'LOCAL OR TESTNET OR MAINNET')")
    },
    async ({ cin }: { cin: string }) => {
      try {
        //console.log(`Resolving GLEIF data for company: ${cin} on network: ${typeOfNet ?? 'TESTNET'}`);
        const response = await fetchCorporateRegistrationData(cin);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              cin: cin,
              response: response,
            }, null, 2)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error resolving CIN: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true
        };
      }
    }
  );


}
