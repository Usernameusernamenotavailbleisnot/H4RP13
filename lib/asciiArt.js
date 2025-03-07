const figlet = require('figlet');
const chalk = require('chalk');

/**
 * Generates a colorful ASCII art header for the application
 * @returns {string} The formatted ASCII art header
 */
function generateHeader() {
  try {
    // Using the ANSI Shadow font for better appearance
    const text = figlet.textSync('HARPIE BOT', {
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted',
      verticalLayout: 'default',
      width: 100,
      whitespaceBreak: false
    });

    // Create a gradient effect for the text with cyan color
    const lines = text.split('\n');
    const coloredLines = lines.map(line => {
      return chalk.cyan.bold(line);
    });
    
    // Just return the colored text without any border
    return '\n' + coloredLines.join('\n') + '\n';
  } catch (error) {
    // Fallback ASCII Art if figlet fails
    const fallbackHeader = `
    ██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗███████╗    ██████╗  ██████╗ ████████╗
    ██║  ██║██╔══██╗██╔══██╗██╔══██╗██║██╔════╝    ██╔══██╗██╔═══██╗╚══██╔══╝
    ███████║███████║██████╔╝██████╔╝██║█████╗      ██████╔╝██║   ██║   ██║   
    ██╔══██║██╔══██║██╔══██╗██╔═══╝ ██║██╔══╝      ██╔══██╗██║   ██║   ██║   
    ██║  ██║██║  ██║██║  ██║██║     ██║███████╗    ██████╔╝╚██████╔╝   ██║   
    ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝    ╚═════╝  ╚═════╝    ╚═╝   
    `;
    
    return chalk.cyan.bold(fallbackHeader);
  }
}

module.exports = {
  generateHeader
};