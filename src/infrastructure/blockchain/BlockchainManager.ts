/**
 * BlockchainManager - Single Authority for LocalBlockchain Management
 * 
 * Following o1js best practices:
 * - Single LocalBlockchain instance per environment
 * - Proper lifecycle management
 * - Clean separation from Oracle account management
 */

import { Mina } from 'o1js';

export class BlockchainManager {
  private static localInstance: any = null;
  private static isInitialized = false;
  
  /**
   * Ensures LocalBlockchain exists and is set as active instance
   * Following o1js pattern: expensive operations in beforeAll() equivalent
   * Default to proofsEnabled: false for fast development testing
   */
  static async ensureLocalBlockchain(proofsEnabled: boolean = false): Promise<any> {
    if (!this.localInstance) {
      console.log('🔧 BlockchainManager: Creating shared LocalBlockchain instance...');
      this.localInstance = await Mina.LocalBlockchain({ proofsEnabled });
      Mina.setActiveInstance(this.localInstance);
      this.isInitialized = true;
      console.log(`✅ BlockchainManager: LocalBlockchain initialized (proofs: ${proofsEnabled})`);
    }
    return this.localInstance;
  }
  
  /**
   * Gets test accounts from the shared LocalBlockchain
   * Throws if blockchain not initialized (fail-fast principle)
   */
  static getLocalTestAccounts(): any[] {
    if (!this.localInstance) {
      throw new Error('LocalBlockchain not initialized. Call ensureLocalBlockchain() first.');
    }
    return this.localInstance.testAccounts;
  }
  
  /**
   * Gets a specific test account by index
   */
  static getTestAccount(index: number): any {
    const accounts = this.getLocalTestAccounts();
    if (index >= accounts.length) {
      throw new Error(`Test account index ${index} out of range. Available: 0-${accounts.length - 1}`);
    }
    return accounts[index];
  }
  
  /**
   * Checks if LocalBlockchain is initialized
   */
  static isLocalBlockchainReady(): boolean {
    return this.isInitialized && this.localInstance !== null;
  }
  
  /**
   * Gets the current LocalBlockchain instance (if any)
   */
  static getCurrentLocalBlockchain(): any | null {
    return this.localInstance;
  }
  
  /**
   * Resets the LocalBlockchain instance (for testing/cleanup)
   * Use with caution - primarily for test isolation
   */
  static reset(): void {
    this.localInstance = null;
    this.isInitialized = false;
    console.log('🔄 BlockchainManager: LocalBlockchain instance reset');
  }
  
  /**
   * Gets blockchain instance with lazy initialization
   * Useful for components that need blockchain access
   * Default to proofsEnabled: false for fast development testing
   */
  static async getOrCreateLocalBlockchain(proofsEnabled: boolean = false): Promise<any> {
    await this.ensureLocalBlockchain(proofsEnabled);
    return this.localInstance;
  }
}