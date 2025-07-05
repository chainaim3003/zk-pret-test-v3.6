/**
 * Configuration Source Detective Test
 * This will definitively tell us if the system reads from testnet.json or somewhere else
 */

import fs from 'fs';
import path from 'path';

console.log('🕵️ CONFIGURATION SOURCE DETECTIVE TEST');
console.log('='.repeat(50));

const configPath = './config/environments/testnet.json';
const backupPath = './config/environments/testnet.json.backup';

// Check if user wants to restore
if (process.argv[2] === 'restore') {
    console.log('\n🔄 RESTORING ORIGINAL CONFIGURATION...');
    try {
        const backupConfig = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(configPath, backupConfig);
        fs.unlinkSync(backupPath);
        console.log('✅ Original testnet.json restored');
        console.log('✅ Backup file removed');
        process.exit(0);
    } catch (error) {
        console.log('❌ Error restoring:', error.message);
        process.exit(1);
    }
}

// Step 1: Backup current config
console.log('\n📋 Step 1: Backup current testnet.json');
try {
    const currentConfig = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(backupPath, currentConfig);
    console.log('✅ Backup created at testnet.json.backup');
} catch (error) {
    console.log('❌ Error creating backup:', error.message);
    process.exit(1);
}

// Step 2: Read current GLEIF account
console.log('\n🔍 Step 2: Extract current GLEIF deployer account');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const originalGLEIFAccount = config.oracles.registry.GLEIF.deployer.publicKey;
console.log('Original GLEIF Account:', originalGLEIFAccount);

// Step 3: Create FAKE account and modify config
console.log('\n🎭 Step 3: Replace with DETECTIVE TEST account');
const fakeAccount = 'B62qDETECTIVETESTACCOUNTXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// Modify the config
config.oracles.registry.GLEIF.deployer.publicKey = fakeAccount;
config.oracles.registry.GLEIF.publicKey = fakeAccount;

// Write the modified config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✅ testnet.json modified with DETECTIVE TEST account');
console.log('Fake Account:', fakeAccount);

console.log('\n🧪 Step 4: Test Instructions');
console.log('Now run your verification script and check the output:');
console.log('');
console.log('💡 ANALYSIS GUIDE:');
console.log('  🔸 If you see DETECTIVE TEST account in logs → System READS testnet.json ✅');
console.log('  🔸 If you see original account in logs → System IGNORES testnet.json ⚠️');
console.log('  🔸 If you get account not found errors → System READS testnet.json ✅');
console.log('');
console.log('Commands to test with:');
console.log('  npm run compile && node build/tests/with-sign/GLEIFMultiCompanyVerifier.js');
console.log('  # OR: node debug-account.js');
console.log('');
console.log('🔄 When done testing, restore with: node config-detective.js restore');
