# H4RP13 Bot

H4RP13 Bot is an automation tool for performing daily scans and tracking points on the [H4RP13.io](https://H4RP13.io) platform. This bot can manage multiple wallets with proxy support and provides detailed logging capabilities.

## 🚀 Features

- ✅ **Multi-wallet support** - Manage multiple wallets with private keys
- ✅ **Proxy support** - 1 proxy per wallet with automatic rotation
- ✅ **Automatic daily scan** - Perform daily scans to earn points
- ✅ **Point tracking** - Monitor point earnings for each wallet
- ✅ **Retry mechanism** - Automatically retry on errors or connection failures
- ✅ **Error handling** - Comprehensive error handling including proxy errors
- ✅ **Scheduler** - Automatically runs every 25 hours for the next scan
- ✅ **IP checking** - Verifies and displays the proxy IP being used
- ✅ **Colored logging** - Clear log display with timestamp and wallet address formatting

## 📦 Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up configuration files (see Configuration section)
4. Run the bot:
   ```bash
   npm start
   ```

## ⚙️ Configuration

### Private Keys

Add your wallet private keys to the `pk.txt` file, one per line:

```
abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

### Proxies (Optional)

Add your proxies to the `proxy.txt` file, one per line:

```
http://username:password@host:port
socks5://username:password@host:port
host:port
```

### Config.json

Main bot configuration:

```json
{
  "general": {
    "useProxy": true,              // Enable/disable proxy usage
    "delayBetweenWallets": 30000,  // Delay between wallets in ms
    "retryDelay": 5000,            // Delay between retries in ms
    "maxRetries": 5,               // Maximum number of retries
    "delayHours": 25,              // Hours for next schedule
    "logToFile": true,             // Log to file
    "logToConsole": true,          // Log to console
    "verboseLogging": false        // Verbose logging mode
  },
  "H4RP13": {
    "baseUrl": "https://H4RP13.io",
    "chainId": 1,                  // Chain ID (1 = Ethereum)
    "requestTimeout": 30000        // Request timeout in ms
  },
  "scan": {
    "enabled": true,               // Enable/disable automatic scanning
    "forceRescan": false           // Force scan even if already scanned today
  }
}
```

## 🗂️ Project Structure

```
H4RP13-bot/
├── config.json          # Bot configuration
├── pk.txt               # Private keys
├── proxy.txt            # Proxies (optional)
├── index.js             # Main entry point
├── package.json         # Dependencies
├── logs/                # Log files
├── lib/
│   ├── logger.js        # Logging utility
│   ├── wallet.js        # Wallet management
│   ├── proxy.js         # Proxy management
│   ├── utils.js         # Common utility functions
│   └── asciiArt.js      # ASCII art header
└── api/
    ├── client.js        # API client with retry logic
    ├── auth.js          # Authentication API
    ├── leaderboard.js   # Points and leaderboard API
    └── scan.js          # Wallet scanning API
```

## ❓ Troubleshooting

### Proxy Issues

- **Connection reset**: Check if your proxy is working and valid
- **Timeout**: Proxy might be slow, consider changing proxies
- **IP Unknown**: Bot could not retrieve the IP from the proxy, but it may still work

### Scan Issues

- **Scan failure**: If a scan fails, the bot will try again on the next run
- **Points not increasing**: If points don't increase after a scan, check if the account has already performed a scan through the UI

## 📝 Important Notes

1. The bot is scheduled to run every 25 hours to maintain the daily scan streak.
2. Logs are stored in the `logs/` folder with the file naming format `H4RP13-bot-YYYY-MM-DD.log`.
3. To see more detailed information about the process, enable `verboseLogging: true` in config.json.

## 📜 License

This software is provided for educational purposes. Use at your own risk.
