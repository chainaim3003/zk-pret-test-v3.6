/**
 * Generate valid private keys for LOCAL development
 * Safe to use since LOCAL is only in-memory simulation
 */

import { PrivateKey } from 'o1js';

// Generate 10 valid private keys for LOCAL test accounts
const localKeys = [];

for (let i = 0; i < 10; i++) {
  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();
  
  localKeys.push({
    index: i,
    privateKey: privateKey.toBase58(),
    publicKey: publicKey.toBase58()
  });
}

console.log('Generated LOCAL development keys:');
console.log(JSON.stringify(localKeys, null, 2));

// Generate specific oracle configurations
const oracles = {
  GLEIF: {
    deployer: localKeys[0],
    sender: localKeys[1]
  },
  MCA: {
    deployer: localKeys[2], 
    sender: localKeys[3]
  },
  EXIM: {
    deployer: localKeys[4],
    sender: localKeys[5] 
  },
  BPMN: {
    deployer: localKeys[6],
    sender: localKeys[7]
  },
  RISK: {
    deployer: localKeys[8],
    sender: localKeys[9]
  }
};

console.log('\nOracle configuration for local.json:');
console.log(JSON.stringify(oracles, null, 2));
