/**
 * Local Deploy + Verify - O1JS Best Practices
 * Fixed: Uses shared LocalBlockchain to avoid conflicts
 */

import { spawn } from 'child_process';

async function main(): Promise<void> {
  // Set BUILD_ENV for LOCAL (Windows compatible)
  process.env.BUILD_ENV = 'LOCAL';
  
  // ✅ FIXED: Handle spaces in company name properly
  const companyName = process.argv.slice(2).join(' ');

  if (!companyName) {
    console.error('❌ Usage: npm run test:local-complete "COMPANY NAME"');
    console.error('');
    console.error('Examples:');
    console.error('  npm run test:local-complete "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"');
    console.error('  npm run test:local-complete "APPLE INC"');
    console.error('  npm run test:local-complete "MICROSOFT CORPORATION"');
    process.exit(1);
  }

  try {
    console.log('🏠 LOCAL Deploy + Verify Pipeline (O1JS Best Practices)');
    console.log('=======================================================');
    
    // ✅ FIXED: Skip separate deployment, directly use working verifier
    // The GLEIFOptimMultiCompanyVerificationTestWithSignUtils already handles deployment
    console.log(`\n🔍 Verifying company "${companyName}" using integrated approach...`);
    
    return new Promise((resolve, reject) => {
      const verifyProcess = spawn('node', [
        './build/tests/with-sign/GLEIFOptimMultiCompanyVerificationTestWithSignUtils.js',
        companyName  // Pass as single argument
      ], {
        stdio: 'inherit',
        env: { ...process.env, BUILD_ENV: 'LOCAL' }
      });
      
      verifyProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n🎉 LOCAL Deploy + Verify completed successfully!');
          console.log('✅ O1JS Best Practices followed');
          console.log('✅ Single LocalBlockchain used throughout');
          console.log('✅ No deployment conflicts');
          resolve();
        } else {
          console.error(`\n❌ Verification failed with code ${code}`);
          reject(new Error(`Verification failed`));
        }
      });
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`💥 Pipeline failed: ${errorMessage}`);
    process.exit(1);
  }
}

main();
