const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config.json');
const logger = require('../lib/logger');
const { withRetry } = require('../lib/utils');

/**
 * Create a configured Axios instance with common settings
 * @param {Object} [options={}] - Additional Axios options
 * @param {Object} [walletData=null] - Wallet data including proxy
 * @returns {Object} Configured Axios instance
 */
function createApiClient(options = {}, walletData = null) {
  const baseURL = config.harpie.baseUrl;
  const timeout = config.harpie.requestTimeout;
  
  // Default headers
  const headers = {
    ...config.harpie.headers,
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  
  // Generate a unique request ID for tracing
  const requestId = uuidv4();
  
  const axiosConfig = {
    baseURL,
    timeout,
    headers,
    ...options
  };
  
  // Add proxy if available and enabled
  if (config.general.useProxy && walletData?.proxy) {
    axiosConfig.httpAgent = walletData.proxy;
    axiosConfig.httpsAgent = walletData.proxy;
  }
  
  const client = axios.create(axiosConfig);
  
  // Add request interceptor for logging
  client.interceptors.request.use(
    (config) => {
      config.metadata = { startTime: new Date() };
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  
  // Add response interceptor for logging
  client.interceptors.response.use(
    (response) => {
      const duration = new Date() - response.config.metadata.startTime;
      
      // We're removing the URL logging as requested
      if (duration > 3000) { // Only log very slow requests (over 3 seconds)
        logger.info(`Request took ${duration}ms`, walletData?.address);
      }
      return response;
    },
    (error) => {
      // Log error details without revealing API endpoints
      if (error.response) {
        // The request was made and the server responded with a non-2xx status
        const status = error.response.status;
        
        if (status === 429) {
          logger.warning(`Rate limited (429)`, walletData?.address);
        } else if (status >= 500) {
          logger.error(`Server error (${status})`, walletData?.address);
        } else {
          logger.error(`Request failed (${status})`, walletData?.address);
        }
      } else if (error.request) {
        // The request was made but no response was received
        if (error.code === 'ECONNABORTED') {
          logger.error(`Request timeout`, walletData?.address);
        } else if (error.code === 'ECONNREFUSED') {
          logger.error(`Connection refused`, walletData?.address);
        } else if (error.code === 'ECONNRESET') {
          logger.error(`Connection reset - possible proxy issue`, walletData?.address);
        } else {
          logger.error(`Network error: ${error.message}`, walletData?.address);
        }
      } else {
        // Something happened in setting up the request
        logger.error(`Request setup error: ${error.message}`, walletData?.address);
      }
      
      return Promise.reject(error);
    }
  );
  
  return client;
}

/**
 * Make a GET request with retry logic
 * @param {string} url - The URL to request
 * @param {Object} [options={}] - Axios request options
 * @param {Object} [walletData=null] - Wallet data including proxy
 * @returns {Promise<Object>} The response data
 */
async function get(url, options = {}, walletData = null) {
  const client = createApiClient(options, walletData);
  
  return withRetry(
    async () => {
      const response = await client.get(url);
      return response.data;
    },
    config.general.maxRetries,
    config.general.retryDelay,
    walletData?.address
  );
}

/**
 * Make a POST request with retry logic
 * @param {string} url - The URL to request
 * @param {Object} data - The data to send
 * @param {Object} [options={}] - Axios request options
 * @param {Object} [walletData=null] - Wallet data including proxy
 * @returns {Promise<Object>} The response data
 */
async function post(url, data, options = {}, walletData = null) {
  const client = createApiClient(options, walletData);
  
  return withRetry(
    async () => {
      const response = await client.post(url, data);
      return response.data;
    },
    config.general.maxRetries,
    config.general.retryDelay,
    walletData?.address
  );
}

module.exports = {
  get,
  post
};