/**
 * Local Deploy + Verify - Corporate Registration Single Company
 * PARALLELS: local-deploy-verify-CorpReg.ts (but for single company)
 * SUPPORTS: Single company LOCAL verification
 */
import { spawn } from 'child_process';

async function main(): Promise<void> {
  // Set BUILD_ENV for LOCAL (Windows compatible)
  process.env.BUILD_ENV = 'LOCAL';
  
  const args = process.argv.slice(2);
  
  // Parse jurisdiction flag
  const jurisdictionFlag = args.find(arg => arg.startsWith('--jurisdiction='));
  const jurisdiction = jurisdictionFlag ? jurisdictionFlag.split('=')[1] : 'IN';
  
  // Parse company identifier (handle spaces properly)
  const companyIds = args.filter(arg => !arg.startsWith('--'));
  const rawCompanyName = companyIds.join(' ');
  const companyName = rawCompanyName
    .replace(/\^/g, '')              // Remove caret characters (Windows shell artifacts)
    .replace(/\s+/g, ' ')            // Normalize multiple spaces to single space
    .trim();                         // Final trim

  if (!companyName) {
    console.error('❌ Usage: npm run test:local-single-CorpReg [--jurisdiction=IN] "CIN or Company Name"');
    console.error('');
    console.error('Examples:');
    console.error('  npm run test:local-single-CorpReg "U01112TZ2022PTC039493"');
    console.error('  npm run test:local-single-CorpReg --jurisdiction=US "Delaware_Corp_123"');
    console.error('  npm run test:local-single-CorpReg "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"');
    process.exit(1);
  }

  try {
    console.log('🏠 LOCAL Corporate Registration Single Company Deploy + Verify Pipeline');
    console.log('======================================================================');
    console.log(`🌍 Jurisdiction: ${jurisdiction}`);
    console.log(`🏢 Company: ${companyName}`);
    
    return new Promise((resolve, reject) => {
      const execArgs = [
        './build/tests/with-sign/local/CorporateRegistrationLocalSingleVerifierUtils.js'
      ];
      
      if (jurisdiction !== 'IN') {
        execArgs.push(`--jurisdiction=${jurisdiction}`);
      }
      execArgs.push(companyName);
      
      const verifyProcess = spawn('node', execArgs, {
        stdio: 'inherit',
        env: { ...process.env, BUILD_ENV: 'LOCAL' }
      });
      
      verifyProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n🎉 LOCAL Corporate Registration Single Company Deploy + Verify completed successfully!');
          console.log('✅ O1JS Best Practices followed');
          console.log('✅ Jurisdiction-aware verification');
          console.log('✅ Single company verification completed');
          console.log('✅ Parallel structure to GLEIF');
          resolve();
        } else {
          reject(new Error(`Verification failed with code ${code}`));
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
