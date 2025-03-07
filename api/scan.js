const client = require('./client');
const config = require('../config.json');
const logger = require('../lib/logger');
const { sleep } = require('../lib/utils');

/**
 * Perform a wallet health scan
 * @param {Object} walletData - Wallet data including address and proxy
 * @returns {Promise<Object>} Scan results
 */
async function performWalletScan(walletData) {
  try {
    const { address } = walletData;
    
    logger.info(`Starting wallet scan`, address);
    
    const data = {
      chainId: config.harpie.chainId,
      manualScan: true
    };
    
    const response = await client.post(`/api/addresses/${address}/queue-health/`, data, {}, walletData);
    
    // Enhanced response validation - more specific
    if (!response) {
      throw new Error('Empty response received');
    }
    
    // Check if the stats property exists
    if (response.stats) {
      const { percentImmune, percentVerified, activityScore } = response.stats;
      
      // Only log these if they exist and verbose logging is enabled
      if (config.general.verboseLogging) {
        logger.info(`Immune: ${percentImmune || 0}% | Verified: ${percentVerified || 0}% | Activity: ${activityScore || 0}%`, address);
      }
    }
    
    // Check for alerts
    if (response.alerts && Object.keys(response.alerts).length > 0) {
      logger.warning(`Alerts found during scan`, address);
    }
    
    logger.success(`Wallet scan completed`, address);
    return response;
  } catch (error) {
    // More detailed error handling
    if (error.response && error.response.status === 403) {
      logger.error(`Wallet scan failed: Access forbidden (403)`, walletData.address);
    } else if (error.code === 'ECONNRESET') {
      logger.error(`Wallet scan failed: Connection reset`, walletData.address);
    } else if (error.code === 'ETIMEDOUT') {
      logger.error(`Wallet scan failed: Connection timed out`, walletData.address);
    } else {
      logger.error(`Wallet scan failed: ${error.message}`, walletData.address);
    }
    throw error;
  }
}

/**
 * Get the tracking ID for a wallet
 * @param {Object} walletData - Wallet data including address and proxy
 * @returns {Promise<string>} Tracking ID
 */
async function getTrackingId(walletData) {
  try {
    const { address } = walletData;
    
    logger.info(`Getting tracking ID`, address);
    
    const data = {
      address,
      chainId: config.harpie.chainId
    };
    
    const response = await client.post('/api/hooks/get-tracking-id/', data, {}, walletData);
    
    if (!response || !response.trackingId) {
      throw new Error('Invalid tracking ID response');
    }
    
    return response.trackingId;
  } catch (error) {
    if (error.code && error.code.startsWith('ECONN')) {
      logger.error(`Failed to get tracking ID: Connection issue`, walletData.address);
    } else {
      logger.error(`Failed to get tracking ID: ${error.message}`, walletData.address);
    }
    throw error;
  }
}

/**
 * Get basic dashboard data
 * @param {Object} walletData - Wallet data including address and proxy
 * @returns {Promise<Object>} Dashboard data
 */
async function getBasicDashboard(walletData) {
  try {
    const { address } = walletData;
    
    logger.info(`Getting dashboard data`, address);
    
    const data = {
      dashboardId: address,
      chainId: config.harpie.chainId
    };
    
    const response = await client.post('/api/hooks/get-basic-dashboard/', data, {}, walletData);
    
    if (!response) {
      throw new Error('Empty response received');
    }
    
    return response;
  } catch (error) {
    if (error.code && (error.code.startsWith('ECONN') || error.code === 'ETIMEDOUT')) {
      logger.error(`Failed to get dashboard data: Network issue`, walletData.address);
    } else {
      logger.error(`Failed to get dashboard data: ${error.message}`, walletData.address);
    }
    throw error;
  }
}

/**
 * Perform a complete scan workflow for a wallet
 * @param {Object} walletData - Wallet data including address and proxy
 * @param {boolean} [forceScan=false] - Force scan even if already completed
 * @param {Object} [existingLeaderboardInfo=null] - Existing leaderboard info if already fetched
 * @returns {Promise<Object>} Scan results
 */
async function performScanWorkflow(walletData, forceScan = false, existingLeaderboardInfo = null) {
  try {
    const { address } = walletData;
    
    // Step 1: Get tracking ID (required for proper tracking)
    await getTrackingId(walletData);
    
    // Step 2: Check if we have leaderboard info or need to fetch it
    let leaderboardInfo = existingLeaderboardInfo;
    if (!leaderboardInfo) {
      leaderboardInfo = await require('./leaderboard').getLeaderboardInfo(walletData);
    }
    
    // If daily scan is already completed and we're not forcing a scan, skip the process
    if (leaderboardInfo.hasDoneDailyScan && !forceScan && !config.scan.forceRescan) {
      logger.info(`Daily scan already completed. Skipping scan.`, address);
      return { skipped: true, hasDoneDailyScan: true };
    }
    
    // Step 3: Get basic dashboard data (needed to set up the proper session)
    await getBasicDashboard(walletData);
    
    // Step 4: Perform the actual wallet scan
    let scanResult;
    try {
      scanResult = await performWalletScan(walletData);
    } catch (error) {
      logger.warning(`Scan had issues, checking if points were still awarded...`, address);
    }
    
    // Step 5: Check if points increased after scan
    await sleep(2000); // Wait for points to be credited
    const updatedLeaderboard = await require('./leaderboard').getLeaderboardInfo(walletData);
    
    const pointsIncreased = updatedLeaderboard.personalPoints > leaderboardInfo.personalPoints;
    const scanCompleted = updatedLeaderboard.hasDoneDailyScan;
    
    if (scanCompleted) {
      logger.success(`Daily scan verified as completed`, address);
      return {
        ...(scanResult || {}),
        success: true
      };
    } else if (pointsIncreased) {
      logger.success(`Points increased, scan considered successful`, address);
      return {
        ...(scanResult || {}),
        success: true
      };
    } else {
      logger.warning(`Scan completed but no points received`, address);
      return {
        ...(scanResult || {}),
        success: false
      };
    }
  } catch (error) {
    logger.error(`Scan workflow failed: ${error.message}`, walletData.address);
    throw error;
  }
}

module.exports = {
  performWalletScan,
  getTrackingId,
  getBasicDashboard,
  performScanWorkflow
};