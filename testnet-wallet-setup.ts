/**
 * Testnet Wallet Setup Script for Mina Protocol
 * Generates funded testnet accounts and creates testnet.json configuration
 */

import { PrivateKey, PublicKey, Mina } from 'o1js';
import * as fs from 'fs';
import * as path from 'path';

// Interface definitions
interface AccountPair {
    privateKey: string;
    publicKey: string;
    index: number;
}

interface OracleAccount {
    role: string;
    deployer: AccountPair;
    sender: AccountPair;
}

interface TestnetConfig {
    network: {
        environment: string;
        proofsEnabled: boolean;
        minaEndpoint: string;
        archiveEndpoint: string;
    };
    oracles: {
        registry: { [key: string]: any };
    };
    deployments: {
        contracts: { [key: string]: any };
    };
    gleifApiConfig: { [key: string]: any };
}

interface FaucetResponse {
    success?: boolean;
    txHash?: string;
    message?: string;
    error?: string;
}

/**
 * Generate testnet accounts for all oracle roles
 */
async function setupTestnetWallets(): Promise<OracleAccount[]> {
    console.log('🔑 Generating testnet wallet accounts...');
    
    const accounts: OracleAccount[] = [];
    const roles = ['MCA', 'GLEIF', 'EXIM', 'BPMN', 'RISK', 'BL_REGISTRY'];
    
    for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        
        // Generate deployer account
        const deployerPrivateKey = PrivateKey.random();
        const deployerPublicKey = deployerPrivateKey.toPublicKey();
        
        // Generate sender account  
        const senderPrivateKey = PrivateKey.random();
        const senderPublicKey = senderPrivateKey.toPublicKey();
        
        accounts.push({
            role: role,
            deployer: {
                privateKey: deployerPrivateKey.toBase58(),
                publicKey: deployerPublicKey.toBase58(),
                index: i * 2
            },
            sender: {
                privateKey: senderPrivateKey.toBase58(), 
                publicKey: senderPublicKey.toBase58(),
                index: i * 2 + 1
            }
        });
        
        console.log(`✅ Generated ${role} accounts:`);
        console.log(`   Deployer: ${deployerPublicKey.toBase58()}`);
        console.log(`   Sender: ${senderPublicKey.toBase58()}`);
    }
    
    return accounts;
}

/**
 * Fund a testnet account using the faucet
 */
async function fundTestnetAccount(publicKey: string, email: string = 'test@example.com'): Promise<boolean> {
    try {
        console.log(`💰 Funding account: ${publicKey}...`);
        
        // Method 1: Try official Mina faucet API
        try {
            const faucetUrl = 'https://faucet.minaprotocol.com/api/v1/faucet';
            
            const response = await fetch(faucetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: publicKey,
                    email: email
                })
            });
            
            if (response.ok) {
                const result: FaucetResponse = await response.json();
                console.log(`✅ Funded ${publicKey}: ${result.txHash || 'Success'}`);
                return true;
            } else {
                console.warn(`⚠️ Official faucet failed: ${response.statusText}`);
            }
        } catch (apiError) {
            console.warn(`⚠️ Official faucet API error:`, (apiError as Error).message);
        }
        
        // Method 2: Try alternative faucet endpoint
        try {
            const altFaucetUrl = 'https://proxy.berkeley.minaexplorer.com/faucet';
            
            const response = await fetch(altFaucetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    address: publicKey
                })
            });
            
            if (response.ok) {
                console.log(`✅ Funded ${publicKey} via alternative faucet`);
                return true;
            }
        } catch (altError) {
            console.warn(`⚠️ Alternative faucet failed:`, (altError as Error).message);
        }
        
        // If both methods fail, provide manual instructions
        console.log(`❌ Automatic funding failed for ${publicKey}`);
        console.log(`📋 Please fund manually:`);
        console.log(`   1. Go to: https://faucet.minaprotocol.com/`);
        console.log(`   2. Enter address: ${publicKey}`);
        console.log(`   3. Provide email and submit`);
        console.log(`   OR use Discord: #testnet-faucet channel with: $request ${publicKey}`);
        
        return false;
        
    } catch (error) {
        console.error(`❌ Error funding ${publicKey}:`, (error as Error).message);
        return false;
    }
}

/**
 * Check account balance on testnet
 */
async function checkAccountBalance(publicKey: string): Promise<string> {
    try {
        // Connect to testnet
        const Testnet = Mina.Network('https://proxy.berkeley.minaexplorer.com/graphql');
        Mina.setActiveInstance(Testnet);
        
        const account = await Mina.getAccount(PublicKey.fromBase58(publicKey));
        const balance = account.balance.toString();
        console.log(`💰 Balance for ${publicKey}: ${balance} MINA`);
        return balance;
    } catch (error) {
        console.log(`⏳ Account ${publicKey} not yet funded or still pending`);
        return '0';
    }
}

/**
 * Wait for user confirmation before proceeding
 */
async function waitForUserConfirmation(message: string): Promise<void> {
    return new Promise((resolve) => {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question(`${message} (Press Enter to continue)`, () => {
            rl.close();
            resolve();
        });
    });
}

/**
 * Save testnet configuration to file
 */
async function saveTestnetConfig(config: TestnetConfig, outputPath?: string): Promise<string> {
    const configPath = outputPath || path.join(process.cwd(), 'config', 'environments', 'testnet.json');
    
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
    }
    
    // Write config file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`📄 Saved testnet configuration to: ${configPath}`);
    
    return configPath;
}

/**
 * Generate complete testnet configuration
 */
async function generateTestnetConfig(): Promise<TestnetConfig> {
    console.log('🚀 Setting up complete testnet configuration...\n');
    
    // Step 1: Generate accounts
    const accounts = await setupTestnetWallets();
    
    // Step 2: Display funding instructions
    console.log('\n💰 Account funding required...');
    console.log('📋 You can fund accounts using:');
    console.log('   1. Web Faucet: https://faucet.minaprotocol.com/');
    console.log('   2. Discord: #testnet-faucet channel with: $request <address>');
    console.log('   3. CLI: mina account request-funding <address> --network testnet');
    
    // Step 3: Attempt automatic funding
    console.log('\n🤖 Attempting automatic funding...');
    const userEmail = process.env.MINA_FAUCET_EMAIL || 'test@chainaim.com';
    
    let fundingAttempts = 0;
    for (const account of accounts) {
        const deployerFunded = await fundTestnetAccount(account.deployer.publicKey, userEmail);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        
        const senderFunded = await fundTestnetAccount(account.sender.publicKey, userEmail);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
        
        if (deployerFunded || senderFunded) {
            fundingAttempts++;
        }
    }
    
    if (fundingAttempts === 0) {
        console.log('\n⚠️ Automatic funding failed for all accounts.');
        console.log('📋 Please fund accounts manually using the methods shown above.');
        
        await waitForUserConfirmation('\n✋ Please fund the accounts manually and then');
    }
    
    // Step 4: Wait for funding to complete
    console.log('\n⏳ Waiting 30 seconds for funding to complete...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Step 5: Check balances
    console.log('\n💰 Checking account balances...');
    for (const account of accounts) {
        await checkAccountBalance(account.deployer.publicKey);
        await checkAccountBalance(account.sender.publicKey);
    }
    
    // Step 6: Generate testnet.json config
    const testnetConfig: TestnetConfig = {
        network: {
            environment: "TESTNET",
            proofsEnabled: true,
            minaEndpoint: "https://proxy.berkeley.minaexplorer.com/graphql",
            archiveEndpoint: "https://archive.berkeley.minaexplorer.com"
        },
        oracles: {
            registry: {}
        },
        deployments: {
            contracts: {}
        },
        gleifApiConfig: {}
    };
    
    // Step 7: Add oracle accounts to config
    accounts.forEach(account => {
        testnetConfig.oracles.registry[account.role] = {
            publicKey: account.deployer.publicKey,
            privateKey: account.deployer.privateKey,
            role: `${account.role}_ORACLE`,
            deployerAccountIndex: account.deployer.index,
            senderAccountIndex: account.sender.index
        };
    });
    
    return testnetConfig;
}

/**
 * Display summary information
 */
function displaySummary(config: TestnetConfig, configPath: string): void {
    console.log('\n' + '='.repeat(80));
    console.log('🎉 TESTNET SETUP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    
    console.log(`\n📄 Configuration saved to: ${configPath}`);
    console.log(`🌐 Network: ${config.network.environment}`);
    console.log(`🔐 Proofs enabled: ${config.network.proofsEnabled}`);
    console.log(`📡 Endpoint: ${config.network.minaEndpoint}`);
    
    console.log('\n🏦 Oracle Accounts Created:');
    Object.keys(config.oracles.registry).forEach((role, index) => {
        const oracle = config.oracles.registry[role];
        console.log(`  ${index + 1}. ${role}:`);
        console.log(`     Public Key: ${oracle.publicKey}`);
        console.log(`     Role: ${oracle.role}`);
    });
    
    console.log('\n📋 Next Steps:');
    console.log('  1. ✅ Set BUILD_ENV=TESTNET in your .env file');
    console.log('  2. ✅ testnet.json configuration created');
    console.log('  3. 💰 Verify all accounts are funded (check balances above)');
    console.log('  4. 🚀 Run your testnet execution:');
    console.log('     node ./build/tests/with-sign/GLEIFOptimMultiCompanyRefactoredInfrastructureTestWithSign.js "SREE PALANI ANDAVAR AGROS PRIVATE LIMITED"');
    
    console.log('\n⚠️ Important Notes:');
    console.log('  • Keep private keys secure (even for testnet)');
    console.log('  • Testnet funds have no real value');
    console.log('  • Each account needs at least 1 MINA for deployments');
    console.log('  • Wait 5-10 minutes after funding before using accounts');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
    try {
        console.log('🔧 Mina Protocol Testnet Wallet Setup');
        console.log('=====================================\n');
        
        // Generate configuration
        const config = await generateTestnetConfig();
        
        // Save configuration
        const configPath = await saveTestnetConfig(config);
        
        // Display summary
        displaySummary(config, configPath);
        
    } catch (error) {
        console.error('❌ Setup failed:', (error as Error).message);
        console.error('Stack trace:', (error as Error).stack);
        process.exit(1);
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    console.log('\n👋 Setup interrupted by user');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run the setup if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

export {
    setupTestnetWallets,
    fundTestnetAccount,
    checkAccountBalance,
    generateTestnetConfig,
    saveTestnetConfig
};
