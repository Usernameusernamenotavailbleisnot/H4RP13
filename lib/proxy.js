const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const logger = require('./logger');
const config = require('../config.json');

/**
 * Read proxies from the proxy.txt file
 * @returns {Array<string>} Array of proxies
 */
function readProxies() {
  try {
    const proxyPath = path.join(__dirname, '../proxy.txt');
    
    // Check if proxy.txt exists
    if (!fs.existsSync(proxyPath)) {
      logger.warning('proxy.txt file not found. Running without proxies.');
      return [];
    }
    
    const content = fs.readFileSync(proxyPath, 'utf8');
    const lines = content.split('\n').map(line => line.trim());
    
    // Filter out empty lines and comments
    const proxies = lines.filter(line => 
      line && !line.startsWith('#') && !line.startsWith('//'));
    
    if (proxies.length === 0) {
      logger.warning('No proxies found in proxy.txt. Running without proxies.');
    } else {
      logger.info(`Loaded ${proxies.length} proxies`);
    }
    
    return proxies;
  } catch (error) {
    logger.error(`Error reading proxies: ${error.message}`);
    return [];
  }
}

/**
 * Parse a proxy string into its components
 * @param {string} proxyString - The proxy string (e.g., "http://user:pass@host:port")
 * @returns {Object|null} - The parsed proxy or null if invalid
 */
function parseProxy(proxyString) {
  try {
    // Handle different proxy formats
    let protocol, auth, host, port;
    
    // Check if it's a SOCKS proxy
    if (proxyString.startsWith('socks://') || proxyString.startsWith('socks4://') || proxyString.startsWith('socks5://')) {
      const url = new URL(proxyString);
      protocol = url.protocol.replace(':', '');
      host = url.hostname;
      port = url.port;
      
      if (url.username && url.password) {
        auth = {
          username: url.username,
          password: url.password
        };
      }
    } 
    // HTTP/HTTPS proxy
    else {
      // Determine protocol - default to http if not specified
      if (proxyString.startsWith('http://') || proxyString.startsWith('https://')) {
        const url = new URL(proxyString);
        protocol = url.protocol.replace(':', '');
        host = url.hostname;
        port = url.port;
        
        if (url.username && url.password) {
          auth = {
            username: url.username,
            password: url.password
          };
        }
      } 
      // Handle format like "user:pass@host:port"
      else {
        protocol = 'http';
        
        // Check if auth info is provided
        if (proxyString.includes('@')) {
          const [authPart, hostPart] = proxyString.split('@');
          const [username, password] = authPart.split(':');
          const [proxyHost, proxyPort] = hostPart.split(':');
          
          auth = { username, password };
          host = proxyHost;
          port = proxyPort;
        } 
        // No auth, just host:port
        else if (proxyString.includes(':')) {
          const [proxyHost, proxyPort] = proxyString.split(':');
          host = proxyHost;
          port = proxyPort;
        }
      }
    }
    
    // Validate the parsed data
    if (!host || !port) {
      throw new Error('Invalid proxy format');
    }
    
    return { protocol, auth, host, port };
  } catch (error) {
    logger.error(`Error parsing proxy: ${error.message}`);
    return null;
  }
}

/**
 * Create a proxy agent from a proxy string
 * @param {string} proxyString - The proxy string
 * @returns {Object|null} - The proxy agent or null if invalid
 */
function createProxyAgent(proxyString) {
  try {
    const parsed = parseProxy(proxyString);
    if (!parsed) return null;
    
    const { protocol, auth, host, port } = parsed;
    
    // Format the proxy URL
    let proxyUrl;
    if (auth) {
      proxyUrl = `${protocol}://${auth.username}:${auth.password}@${host}:${port}`;
    } else {
      proxyUrl = `${protocol}://${host}:${port}`;
    }
    
    // Create the appropriate agent with specific timeout settings
    const agentOptions = {
      timeout: 15000, // 15 seconds timeout for proxy connection
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 5,
      maxFreeSockets: 5,
      scheduling: 'lifo'
    };
    
    // Create the appropriate agent
    if (protocol.startsWith('socks')) {
      return new SocksProxyAgent(proxyUrl, agentOptions);
    } else {
      return new HttpsProxyAgent(proxyUrl, agentOptions);
    }
  } catch (error) {
    logger.error(`Error creating proxy agent: ${error.message}`);
    return null;
  }
}

/**
 * Check IP address using the proxy
 * @param {Object} proxyAgent - The proxy agent
 * @returns {Promise<string|null>} - The IP address or null if failed
 */
async function checkIpWithProxy(proxyAgent) {
  try {
    const response = await axios.get('https://api.ipify.org/?format=json', {
      httpAgent: proxyAgent,
      httpsAgent: proxyAgent,
      timeout: 10000 // 10 seconds timeout
    });
    
    if (response.status === 200 && response.data && response.data.ip) {
      return response.data.ip;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Assign proxies to wallets (1:1 mapping)
 * @param {Array<Object>} wallets - Array of wallet objects
 * @returns {Promise<Array<Object>>} - Array of wallets with assigned proxies
 */
async function assignProxiesToWallets(wallets) {
  // If proxies are disabled in config, return wallets without proxies
  if (!config.general.useProxy) {
    logger.info("Proxy usage is disabled in config. Running without proxies.");
    return wallets.map(wallet => ({ ...wallet, proxy: null }));
  }
  
  const proxies = readProxies();
  
  // If no proxies are found, return wallets without proxies
  if (proxies.length === 0) {
    return wallets.map(wallet => ({ ...wallet, proxy: null }));
  }
  
  const walletsWithProxies = [];
  
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    // Cycle through proxies if there are fewer proxies than wallets
    const proxyString = proxies[i % proxies.length];
    const proxyAgent = createProxyAgent(proxyString);
    
    let proxyIp = null;
    
    // Check IP if proxy is set up correctly
    if (proxyAgent) {
      try {
        proxyIp = await checkIpWithProxy(proxyAgent);
      } catch (error) {
        // Silently fail, IP check is just informational
      }
    }
    
    walletsWithProxies.push({
      ...wallet,
      proxy: proxyAgent,
      proxyString: proxyString,
      proxyIp: proxyIp
    });
  }
  
  return walletsWithProxies;
}

module.exports = {
  readProxies,
  parseProxy,
  createProxyAgent,
  checkIpWithProxy,
  assignProxiesToWallets
};