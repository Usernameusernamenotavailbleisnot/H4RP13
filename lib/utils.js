const config = require('../config.json');
const logger = require('./logger');

/**
 * Sleeps for the specified number of milliseconds
 * @param {number} ms - Number of milliseconds to sleep
 * @returns {Promise<void>} A promise that resolves after the specified time
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get a random delay within a range
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {number} Random delay duration in milliseconds
 */
const getRandomDelay = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

/**
 * Execute a function with retry logic
 * @param {Function} fn - The function to execute
 * @param {number} [maxRetries=5] - Maximum number of retry attempts
 * @param {number} [delayMs=5000] - Delay between retries in milliseconds
 * @param {string} [address=null] - Wallet address for logging
 * @returns {Promise<any>} The result from the function
 */
const withRetry = async (fn, maxRetries = config.general.maxRetries, delayMs = config.general.retryDelay, address = null) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we've hit the maximum number of retries
      if (attempt > maxRetries) {
        throw error;
      }
      
      // Special handling for network errors (likely proxy-related)
      if (error.code === 'ECONNRESET') {
        logger.warning(`Attempt ${attempt}/${maxRetries + 1} failed: Connection reset. Retrying in ${delayMs/1000}s...`, address);
      } else if (error.code === 'ECONNREFUSED') {
        logger.warning(`Attempt ${attempt}/${maxRetries + 1} failed: Connection refused. Retrying in ${delayMs/1000}s...`, address);
      } else if (error.code === 'ETIMEDOUT') {
        logger.warning(`Attempt ${attempt}/${maxRetries + 1} failed: Connection timeout. Retrying in ${delayMs/1000}s...`, address);
      } else if (error.response && error.response.status === 429) {
        logger.warning(`Attempt ${attempt}/${maxRetries + 1} failed: Rate limited (429). Retrying in ${delayMs/1000}s...`, address);
        // Use longer delay for rate limits
        await sleep(delayMs * 2);
        continue;
      } else {
        // Simplify the error message - avoid showing API endpoints
        const errorMessage = error.message.includes('http') 
          ? 'Request failed' 
          : error.message;
        
        logger.warning(`Attempt ${attempt}/${maxRetries + 1} failed: ${errorMessage}. Retrying in ${delayMs/1000}s...`, address);
      }
      
      // Adaptive delay - increase delay slightly with each retry
      const currentDelay = delayMs + (attempt * 500); 
      await sleep(currentDelay);
    }
  }
  
  // This shouldn't be reached due to the throw in the loop, but just in case
  throw lastError;
};

/**
 * Format a large number with commas as thousands separators
 * @param {number} num - The number to format
 * @returns {string} The formatted number
 */
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/**
 * Check if a value is a valid number
 * @param {any} value - The value to check
 * @returns {boolean} True if it's a valid number
 */
const isValidNumber = (value) => {
  if (typeof value === 'number' && !isNaN(value)) {
    return true;
  }
  
  if (typeof value === 'string') {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }
  
  return false;
};

/**
 * Sanitize a string to remove sensitive or unwanted information
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized string
 */
const sanitize = (str) => {
  if (!str) return '';
  
  // Remove URLs, API endpoints
  const sanitized = str
    .replace(/https?:\/\/[^\s]+/g, '[URL]')
    .replace(/\/api\/[^\s]+/g, '[API]');
    
  return sanitized;
};

module.exports = {
  sleep,
  getRandomDelay,
  withRetry,
  formatNumber,
  isValidNumber,
  sanitize
};