/**
 * Simple fix for company name processing
 * This replaces the problematic fetchGLEIFCompanyDataWithFullDetails function
 */

import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

/**
 * FIXED: Fetch company data from GLEIF API with clean company name handling
 */
export async function fetchGLEIFCompanyDataWithFullDetails(companyName: string): Promise<any> {
  // ✅ CRITICAL FIX: Clean the company name first
  const cleanCompanyName = companyName
    .trim()
    .replace(/\^/g, '') // Remove any ^ characters
    .replace(/[^\w\s\&\.\'\-]/g, '') // Keep only safe characters
    .replace(/\s+/g, ' '); // Normalize spaces
    
  console.log('🔍 FIXED: Clean company name processing');
  console.log(`Original: "${companyName}"`);
  console.log(`Cleaned: "${cleanCompanyName}"`);

  let BASEURL;
  let url;

  let typeOfNet = process.env.BUILD_ENV;
  if (!typeOfNet) {
    typeOfNet = 'TESTNET';
  }

  console.log('Company Name:', cleanCompanyName);
  console.log('Type of Network:', typeOfNet);

  if (typeOfNet === 'TESTNET') {
    console.log('+++++++++++++++++++++++++++++++++++++++++++++++++++++in sandbox++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
    BASEURL = process.env.GLEIF_URL_SANDBOX;
    url = `${BASEURL}?filter[entity.legalName]=${encodeURIComponent(cleanCompanyName)}`;
  } 
  else if (typeOfNet === 'LOCAL') {
    console.log('------------------------------------------------using live GLEIF API--------------------------------------------------');
    BASEURL = process.env.GLEIF_URL_MOCK;
    url = `${BASEURL}/${encodeURIComponent(cleanCompanyName)}`;
  } 
  else {
    console.log('///////////////////////////////////////////////in prod//////////////////////////////////////////////');
    BASEURL = process.env.GLEIF_URL_PROD;
    url = `${BASEURL}?filter[entity.legalName]=${encodeURIComponent(cleanCompanyName)}`;
  }

  if (!BASEURL) {
    throw new Error('BASEURL is not set in the environment variables.');
  }
  if (!cleanCompanyName) {
    throw new Error('Company name is required.');
  }

  console.log(`🌐 Fetching from URL: ${url}`);

  const response = await axios.get(url);
  const parsedData = response.data;

  // Print response info
  console.log('\n✅ GLEIF API Response received');
  console.log(`📊 Data length: ${parsedData.data ? parsedData.data.length : 0}`);

  if (parsedData.data && parsedData.data.length > 0) {
    const record = parsedData.data[0];
    console.log(`🏢 Found company: ${record.attributes?.entity?.legalName?.name}`);
    console.log(`📄 LEI: ${record.attributes?.lei}`);
    console.log(`📊 Status: ${record.attributes?.entity?.status}`);
  }

  // Check for data existence
  if (!parsedData.data || (Array.isArray(parsedData.data) && parsedData.data.length === 0)) {
    throw new Error(`No company found with name: "${cleanCompanyName}"`);
  }

  return parsedData;
}

// Export as alias to match expected function name
export const fetchGLEIFDataWithFullLogging = fetchGLEIFCompanyDataWithFullDetails;

// Re-export other necessary types and functions
export interface GLEIFAPIResponse {
  data?: any;
  [key: string]: any;
}

export interface GLEIFComplianceAnalysis {
  isCompliant: boolean;
  complianceScore: number;
  issues: string[];
  summary: string;
}

export interface GLEIFDataSummary {
  legalName: string;
  lei: string;
  entityStatus: string;
  jurisdiction: string;
  legalForm: string;
  complianceScore: number;
}
