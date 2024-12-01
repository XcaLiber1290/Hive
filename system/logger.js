const fs = require('fs');
const path = require('path');

function logMessage(message) {
    const logFile = path.join(__dirname, '../logs', 'server.log');
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - ${message}\n`;
    fs.appendFileSync(logFile, logLine);
}

function logActionMessage(message) {
    const logFile = path.join(__dirname, '../logs', 'server_actions.log');
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - ${message}\n`;
    fs.appendFileSync(logFile, logLine);
}

module.exports = {
    logMessage,
    logActionMessage
};
