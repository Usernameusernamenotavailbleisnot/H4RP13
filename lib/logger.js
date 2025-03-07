const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config.json');

// Ensure logs directory exists
const logDir = path.join(__dirname, '../logs');
fs.ensureDirSync(logDir);

// Log file path with date in the filename
const getLogFilePath = () => {
  const date = moment().format('YYYY-MM-DD');
  return path.join(logDir, `harpie-bot-${date}.log`);
};

/**
 * Format a wallet address to show only the first 4 and last 4 characters
 * @param {string} address - The wallet address to format
 * @returns {string} - The formatted address
 */
const formatAddress = (address) => {
  if (!address || address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

/**
 * Get a formatted timestamp for logging
 * @returns {string} - The formatted timestamp
 */
const getTimestamp = () => {
  return moment().format('DD/MM/YYYY - HH:mm:ss');
};

// Keep track of last log messages to avoid duplicates
let lastLogMessages = [];
const MAX_REMEMBERED_LOGS = 5;

/**
 * Check if a message is a duplicate of a recently logged message
 * @param {string} message - The message to check
 * @param {string} address - The wallet address
 * @returns {boolean} - True if duplicate, false otherwise
 */
const isDuplicateLog = (message, address) => {
  const key = `${address || ''}:${message}`;
  const isDuplicate = lastLogMessages.includes(key);
  
  if (!isDuplicate) {
    lastLogMessages.push(key);
    if (lastLogMessages.length > MAX_REMEMBERED_LOGS) {
      lastLogMessages.shift();
    }
  }
  
  return isDuplicate;
};

/**
 * Log a message with appropriate formatting and color
 * @param {string} message - The message to log
 * @param {string} type - The type of log (info, success, warning, error)
 * @param {string} [address=null] - The wallet address associated with this log
 */
const log = (message, type = 'info', address = null) => {
  // Skip duplicate consecutive logs for the same address - prevents spam
  if (isDuplicateLog(message, address) && type !== 'error') {
    return;
  }
  
  const timestamp = getTimestamp();
  const addressStr = address ? ` - ${formatAddress(address)}` : '';
  const logPrefix = `[${timestamp}${addressStr}]`;
  
  let coloredPrefix;
  let coloredMessage;
  
  switch (type) {
    case 'success':
      coloredPrefix = chalk.green(logPrefix);
      coloredMessage = chalk.green(message);
      break;
    case 'warning':
      coloredPrefix = chalk.yellow(logPrefix);
      coloredMessage = chalk.yellow(message);
      break;
    case 'error':
      coloredPrefix = chalk.red(logPrefix);
      coloredMessage = chalk.red(message);
      break;
    case 'points':
      coloredPrefix = chalk.magenta(logPrefix);
      coloredMessage = chalk.magenta(message);
      break;
    default:
      coloredPrefix = chalk.blue(logPrefix);
      coloredMessage = chalk.white(message);
  }
  
  const consoleOutput = `${coloredPrefix} ${coloredMessage}`;
  const fileOutput = `${logPrefix} ${message}`;
  
  // Log to console if enabled
  if (config.general.logToConsole) {
    console.log(consoleOutput);
  }
  
  // Log to file if enabled
  if (config.general.logToFile) {
    try {
      fs.appendFileSync(getLogFilePath(), fileOutput + '\n');
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }
};

module.exports = {
  info: (message, address) => log(message, 'info', address),
  success: (message, address) => log(message, 'success', address),
  warning: (message, address) => log(message, 'warning', address),
  error: (message, address) => log(message, 'error', address),
  points: (message, address) => log(message, 'points', address),
  formatAddress
};