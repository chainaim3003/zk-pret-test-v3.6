/**
 * Simple wrapper for GLEIFOptimVerificationTestWithInfrastructure.ts
 * Avoids the duplicate export issue
 */

import { getGLEIFOptimVerificationWithInfrastructure } from './GLEIFOptimVerificationTestWithInfrastructure.js';

async function main() {
  const companyName = process.argv[2];
  
  if (!companyName) {
    console.error('❌ Error: Company name is required');
    console.log('📖 Usage: node GLEIFOptimVerificationTestWithInfrastructureWrapper.js "COMPANY NAME"');
    console.log('📝 Example: node GLEIFOptimVerificationTestWithInfrastructureWrapper.js "APPLE INC"');
    process.exit(1);
  }
  
  try {
    const proof = await getGLEIFOptimVerificationWithInfrastructure(companyName);
    console.log('\n🎯 Proof generated successfully with infrastructure wrapper!');
  } catch (error) {
    console.error('💥 Error:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('💥 Fatal Error:', err);
  process.exit(1);
});
