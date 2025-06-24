import { execSync } from 'child_process';

function runAllTests() {
   try {
      // 1) Build the project (if needed)
      //execSync('npm run build', { stdio: 'inherit' });

      // 2) Run each of the generated JS files
      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------CorporateRegistrationOptimSingleCompanyVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/CorporateRegistrationOptimSingleCompanyVerificationTestWithSign.js "U01112TZ2022PTC039493"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------EXIMOptimSingleCompanyVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/EXIMOptimSingleCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------GLEIFOptimSingleCompanyVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/GLEIFOptimSingleCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------CorporateRegistrationOptimMultiCompanyVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/CorporateRegistrationOptimMultiCompanyVerificationTestWithSign.js "U01112TZ2022PTC039493"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------EXIMOptimMultiCompanyVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/EXIMOptimMultiCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------GLEIFOptimMultiCompanyVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/GLEIFOptimMultiCompanyVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------ComposedRecursiveOptim3LevelVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/ComposedRecursiveOptim3LevelVerificationTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED" "U01112TZ2022PTC039493"', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------BusinessStandardDataIntegrityVerificationTest.js----------------------------------------');
      execSync('node ./build/tests/with-sign/BusinessStandardDataIntegrityVerificationTest.js ./src/data/scf/BILLOFLADING/actualBL1-VALID.json', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------BusinessStandardOptimVerificationTest.js----------------------------------------');
      execSync('node ./build/tests/with-sign/BusinessStandardOptimVerificationTest.js ./src/data/scf/BILLOFLADING/actualBL1-VALID.json', { stdio: 'inherit' });

      console.log('------------------------------------------------------------------------------------------------------------------------');
      console.log('----------------------------------BusinessStdIntegrityOptimMerkleVerificationTestWithSign.js----------------------------------------');
      execSync('node ./build/tests/with-sign/BusinessStdIntegrityOptimMerkleVerificationTestWithSign.js ./src/data/scf/BILLOFLADING/actualBL1-VALID.json', { stdio: 'inherit' });




      console.log('All tests finished successfully.');
   } catch (error) {
      console.error('Error running one of the scripts:', error);
      process.exit(1);
   }
}

// Run when this file executes
runAllTests();
