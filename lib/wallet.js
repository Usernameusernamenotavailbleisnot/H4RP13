const fs = require('fs-extra');
const path = require('path');
const { ethers } = require('ethers');
const logger = require('./logger');

/**
 * Read private keys from the pk.txt file
 * @returns {Array<string>} Array of private keys
 */
function readPrivateKeys() {
  try {
    const pkPath = path.join(__dirname, '../pk.txt');
    
    if (!fs.existsSync(pkPath)) {
      logger.error('pk.txt file not found. Please create it and add your private keys.');
      return [];
    }
    
    const content = fs.readFileSync(pkPath, 'utf8');
    const lines = content.split('\n').map(line => line.trim());
    
    // Filter out empty lines and comments
    const privateKeys = lines.filter(line => 
      line && !line.startsWith('#') && !line.startsWith('//'));
    
    if (privateKeys.length === 0) {
      logger.warning('No private keys found in pk.txt');
    } else {
      logger.info(`Loaded ${privateKeys.length} private keys`);
    }
    
    return privateKeys;
  } catch (error) {
    logger.error(`Error reading private keys: ${error.message}`);
    return [];
  }
}

/**
 * Create wallet instances from private keys
 * @param {Array<string>} privateKeys - Array of private keys
 * @returns {Array<Object>} Array of wallet objects with address and instance
 */
function createWallets(privateKeys) {
  try {
    return privateKeys.map(pk => {
      const wallet = new ethers.Wallet(pk);
      return {
        address: wallet.address,
        privateKey: pk,
        instance: wallet
      };
    });
  } catch (error) {
    logger.error(`Error creating wallets: ${error.message}`);
    return [];
  }
}

/**
 * Get all wallet data including addresses and instances
 * @returns {Array<Object>} Array of wallet objects
 */
function getWallets() {
  const privateKeys = readPrivateKeys();
  return createWallets(privateKeys);
}

module.exports = {
  getWallets,
  readPrivateKeys
};