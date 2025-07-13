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

// ✅ TypeScript: Enhanced two-stage lookup implementation
export async function fetchGLEIFDataWithFullLogging(companyName: string): Promise<GLEIFAPIResponse> {
  console.log(`🔍 STAGE 1: Two-Stage Lookup - Resolving company name to LEI`);
  console.log(`📋 Company Name: "${companyName}"`);
  
  try {
    const apiResponse = await fetchGLEIFCompanyDataWithFullDetails(companyName);
    
    // ✅ Enhanced LEI extraction and validation
    const lei = extractLEIFromGLEIFResponse(apiResponse);
    const legalName = apiResponse.data[0].attributes?.entity?.legalName?.name;
    
    console.log(`✅ STAGE 1 SUCCESS: Name resolved to LEI`);
    console.log(`   LEI: ${lei}`);
    console.log(`   Legal Name: ${legalName}`);
    console.log(`   Status: ${apiResponse.data[0].attributes?.entity?.status}`);
    
    return apiResponse;
    
  } catch (error) {
    console.error(`❌ STAGE 1 FAILED: Could not resolve "${companyName}" to LEI`);
    // FIXED: Properly handle unknown error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Company name resolution failed: ${errorMessage}`);
  }
}

// ✅ TypeScript: LEI extraction utility
export function extractLEIFromGLEIFResponse(apiResponse: GLEIFAPIResponse): string {
  if (!apiResponse.data || apiResponse.data.length === 0) {
    throw new Error('No GLEIF data available for LEI extraction');
  }
  
  const lei = apiResponse.data[0].attributes?.lei;
  if (!lei) {
    throw new Error('LEI not found in GLEIF response');
  }
  
  // ✅ LEI format validation
  if (!validateLEI(lei)) {
    throw new Error(`Invalid LEI format: ${lei}`);
  }
  
  return lei;
}

// ✅ TypeScript: Enhanced company name normalization
export function normalizeCompanyName(companyName: string): string {
  return companyName
    .trim()
    .toUpperCase()
    .replace(/\b(INC|CORP|LTD|LIMITED|PRIVATE|PVT|LLC|CORPORATION)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ✅ TypeScript: LEI validation (ISO 17442 standard)
export function validateLEI(lei: string): boolean {
  // LEI format: 20 alphanumeric characters
  const leiRegex = /^[A-Z0-9]{20}$/;
  return leiRegex.test(lei);
}

// ✅ TypeScript: Check if two company names might refer to same entity
export function compareCompanyNames(name1: string, name2: string): number {
  const normalized1 = normalizeCompanyName(name1);
  const normalized2 = normalizeCompanyName(name2);
  
  if (normalized1 === normalized2) return 100; // Exact match
  
  // Simple similarity scoring
  const words1 = normalized1.split(' ').filter(w => w.length > 2);
  const words2 = normalized2.split(' ').filter(w => w.length > 2);
  
  const commonWords = words1.filter(word => words2.includes(word));
  const similarity = (commonWords.length * 2) / (words1.length + words2.length) * 100;
  
  return Math.round(similarity);
}

// ✅ TypeScript: Enhanced type definitions for two-stage lookup
export interface CompanyResolutionResult {
  originalName: string;
  normalizedName: string;
  lei: string;
  legalName: string;
  confidence: number;
  status: string;
  resolutionSource: 'EXACT_MATCH' | 'NORMALIZED_MATCH';
}

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

// ✅ TypeScript: Additional utility functions for two-stage lookup
export function getCompanyNameVariations(legalName: string): string[] {
  const variations = [];
  
  // Add common variations
  variations.push(legalName);
  variations.push(legalName.replace(/\bPRIVATE LIMITED\b/g, 'PVT LTD'));
  variations.push(legalName.replace(/\bLIMITED\b/g, 'LTD'));
  variations.push(legalName.replace(/\bCORPORATION\b/g, 'CORP'));
  variations.push(legalName.replace(/\bINCORPORATED\b/g, 'INC'));
  
  // Remove duplicates
  return [...new Set(variations)];
}

export async function resolveCompanyNameToLEI(companyName: string): Promise<CompanyResolutionResult> {
  try {
    const apiResponse = await fetchGLEIFDataWithFullLogging(companyName);
    const lei = extractLEIFromGLEIFResponse(apiResponse);
    const legalName = apiResponse.data[0].attributes?.entity?.legalName?.name;
    
    return {
      originalName: companyName,
      normalizedName: normalizeCompanyName(companyName),
      lei: lei,
      legalName: legalName,
      confidence: 100, // Exact match from GLEIF
      status: apiResponse.data[0].attributes?.entity?.status,
      resolutionSource: 'EXACT_MATCH'
    };
  } catch (error) {
    // FIXED: Properly handle unknown error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve company name "${companyName}" to LEI: ${errorMessage}`);
  }
}
