const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const config = require('./config.json');
const logger = require('./lib/logger');
const { generateHeader } = require('./lib/asciiArt');
const wallet = require('./lib/wallet');
const proxy = require('./lib/proxy');
const { sleep, getRandomDelay } = require('./lib/utils');
const leaderboardApi = require('./api/leaderboard');
const scanApi = require('./api/scan');

// Display ASCII art header
console.log(generateHeader());

// Ensure required directories exist
fs.ensureDirSync(path.join(__dirname, 'logs'));

/**
 * Process a single wallet
 * @param {Object} walletData - Wallet data including address, privateKey, and proxy
 * @returns {Promise<void>}
 */
async function processWallet(walletData) {
  try {
    const { address } = walletData;
    
    logger.info(`Starting process for wallet`, address);
    
    // Step 1: Check leaderboard info and points
    const leaderboardInfo = await leaderboardApi.getLeaderboardInfo(walletData);
    
    // Step 2: Check if daily scan is needed and perform it
    if (config.scan.enabled) {
      try {
        if (leaderboardInfo.hasDoneDailyScan && !config.scan.forceRescan) {
          logger.info(`Daily scan already completed. Skipping scan.`, address);
        } else {
          // No need to check leaderboard again at this point
          const result = await scanApi.performScanWorkflow(walletData, config.scan.forceRescan, leaderboardInfo);
          
          if (result.success) {
            logger.success(`Scan completed successfully`, address);
          } else if (result.skipped) {
            logger.info(`Scan skipped (already completed)`, address);
          } else {
            logger.warning(`Scan completed but without success`, address);
          }
        }
      } catch (error) {
        // Handle scan errors - but still mark the wallet as processed
        if (error.code && error.code.startsWith('ECONN')) {
          logger.error(`Scan failed due to network/proxy issues`, address);
        } else {
          logger.error(`Scan failed: ${error.message}`, address);
        }
      }
    } else {
      logger.info(`Wallet scanning is disabled in config`, address);
    }
    
    logger.success(`Process completed for wallet`, address);
    return true;
  } catch (error) {
    logger.error(`Process failed for wallet: ${error.message}`, walletData.address);
    return false;
  }
}

/**
 * Process all wallets sequentially
 * @returns {Promise<void>}
 */
async function processAllWallets() {
  try {
    logger.info('Starting wallet processing...');
    
    // Get wallets and assign proxies
    const wallets = wallet.getWallets();
    if (wallets.length === 0) {
      logger.error('No wallets found. Please add private keys to pk.txt');
      return;
    }
    
    const walletsWithProxies = await proxy.assignProxiesToWallets(wallets);
    
    // Process each wallet sequentially
    let successCount = 0;
    for (let i = 0; i < walletsWithProxies.length; i++) {
      const walletData = walletsWithProxies[i];
      
      // Log progress
      logger.info(`Processing wallet ${i+1}/${walletsWithProxies.length}`, walletData.address);
      
      // Log proxy information if applicable (but don't show full proxy string)
      if (config.general.useProxy && walletData.proxyString) {
        if (walletData.proxyIp) {
          logger.info(`Using proxy with IP: ${walletData.proxyIp}`, walletData.address);
        } else {
          logger.info(`Using proxy (IP unknown)`, walletData.address);
        }
      } else if (config.general.useProxy) {
        logger.warning(`No proxy assigned for this wallet`, walletData.address);
      }
      
      const success = await processWallet(walletData);
      if (success) successCount++;
      
      // Add delay between wallets unless it's the last one
      if (i < walletsWithProxies.length - 1) {
        const delay = getRandomDelay(
          config.general.delayBetweenWallets * 0.8,
          config.general.delayBetweenWallets * 1.2
        );
        logger.info(`Waiting ${(delay / 1000).toFixed(1)}s before processing next wallet...`);
        await sleep(delay);
      }
    }
    
    logger.success(`All wallets processed. Success: ${successCount}/${walletsWithProxies.length}`);
    
    // Schedule next run after completion delay (25 hours = 90,000,000 ms)
    const nextRunDate = new Date(Date.now() + config.general.afterCompletionDelay);
    
    logger.info(`Next run scheduled for: ${nextRunDate.toLocaleString()}`);
  } catch (error) {
    logger.error(`Failed to process wallets: ${error.message}`);
  }
}

/**
 * The main function that starts the bot
 */
async function main() {
  try {
    logger.info('Harpie Bot starting...');
    
    // Run the bot immediately
    await processAllWallets();
    
    // Set up the cron job to run every 25 hours
    // This is a backup in case the scheduled next run fails
    cron.schedule('0 */25 * * *', async () => {
      logger.info('Cron job triggered');
      await processAllWallets();
    });
    
    // Set up a timer for the next run
    setTimeout(async () => {
      logger.info('Scheduled run triggered');
      await processAllWallets();
    }, config.general.afterCompletionDelay);
    
  } catch (error) {
    logger.error(`Main process error: ${error.message}`);
  }
}

// Start the bot
main().catch(error => {
  logger.error(`Unhandled error in main process: ${error.message}`);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Process interrupted. Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Process terminated. Shutting down...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  // Keep the process running
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  // Keep the process running
});