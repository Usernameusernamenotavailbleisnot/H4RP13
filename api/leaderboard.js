const client = require('./client');
const config = require('../config.json');
const logger = require('../lib/logger');
const { formatNumber } = require('../lib/utils');

/**
 * Fetch leaderboard information for a wallet
 * @param {Object} walletData - Wallet data including address and proxy
 * @returns {Promise<Object>} Leaderboard data
 */
async function getLeaderboardInfo(walletData) {
  try {
    const { address } = walletData;
    
    logger.info(`Checking points and scan status`, address);
    
    const data = {
      address,
      chainId: config.harpie.chainId,
      includeLeaderboard: false,
      skipCache: true
    };
    
    const response = await client.post('/api/hooks/get-leaderboard-info/', data, {}, walletData);
    
    if (!response) {
      throw new Error('Empty response received');
    }
    
    const { personalPoints, hasDoneDailyScan, walletScanStreak } = response;
    
    // Log points information - more concise
    if (personalPoints !== undefined) {
      logger.points(`Points: ${formatNumber(personalPoints)} | Daily scan: ${hasDoneDailyScan ? 'Completed' : 'Not completed'}`, address);
    }
    
    if (walletScanStreak > 0) {
      logger.info(`Current streak: ${walletScanStreak} day(s)`, address);
    }
    
    // Only log point events if verbose mode is enabled in config
    if (config.general.verboseLogging && response.personalPointEvents && response.personalPointEvents.length > 0) {
      // Simplify point events to a single line
      const events = response.personalPointEvents.map(e => e.trim()).join(' | ');
      logger.points(`Recent events: ${events}`, address);
    }
    
    return response;
  } catch (error) {
    // Enhanced error handling for proxy issues
    if (error.code && error.code.startsWith('ECONN')) {
      logger.error(`Failed to fetch points: Network or proxy issue (${error.code})`, walletData.address);
    } else {
      logger.error(`Failed to fetch points: ${error.message}`, walletData.address);
    }
    throw error;
  }
}

/**
 * Check if a wallet has completed its daily scan
 * @param {Object} walletData - Wallet data including address and proxy
 * @returns {Promise<boolean>} True if daily scan is completed, false otherwise
 */
async function checkDailyScanStatus(walletData) {
  try {
    const leaderboardInfo = await getLeaderboardInfo(walletData);
    return leaderboardInfo.hasDoneDailyScan || false;
  } catch (error) {
    logger.error(`Failed to check daily scan status: ${error.message}`, walletData.address);
    return false;
  }
}

module.exports = {
  getLeaderboardInfo,
  checkDailyScanStatus
};