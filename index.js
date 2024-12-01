const http = require('http');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Import modules from the system folder
const dbUtils = require('./system/dbUtils');
const logger = require('./system/logger');

// Load or create configuration file
const configFilePath = path.join(__dirname, 'config.json');
let config = {
    port: 8080,
    customBackend: '',    // Path to custom backend file in 'web roots' folder
    backendEnabled: true  // Enables or disables the custom backend
};

if (fs.existsSync(configFilePath)) {
    config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
} else {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log('Configuration file created with default values.');
}

// Ensure required folders exist
const ensureFolderExists = (folderPath, description) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log(`${description} folder created.`);
    }
};

ensureFolderExists(path.join(__dirname, 'web roots'), 'Web roots');
ensureFolderExists(path.join(__dirname, 'db'), 'Database');
ensureFolderExists(path.join(__dirname, 'metadata'), 'Metadata');
ensureFolderExists(path.join(__dirname, 'logs'), 'Logs');

// Load or initialize master key
const keysFile = path.join(__dirname, 'metadata', 'master.json');
let masterKey = dbUtils.loadOrCreateMasterKey(keysFile, logger.logMessage);

// HTTP server functionality
const server = http.createServer((req, res) => {
    const urlParts = req.url.split('/');
    const method = req.method;
    const apiKey = req.headers['x-api-key'];
    const dbName = urlParts[2];

    if (config.backendEnabled && config.customBackend) {
        // Handle custom backend logic
    } else {
        logger.logMessage('Responding with Hive layer default response');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hive layer response');
    }

    if (method === 'POST' && urlParts[1] === 'create') {
        if (apiKey !== masterKey) {
            res.writeHead(403);
            res.end('Forbidden: Master key required for database creation');
            return;
        }

        const newApiKey = dbUtils.createDatabase(dbName, logger.logActionMessage);
        res.writeHead(201);
        res.end(JSON.stringify({ 
            message: 'Database created successfully',
            apiKey: newApiKey
        }));
    }
});

// Console interface setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function showAllKeyFunctions() {
    console.log('\n=== HiveDB Master Key Console ===');
    console.log('1. Rotate Master Key');
    console.log('2. View Current Master Key');
    console.log('3. List All Databases and Their API Keys');
    console.log('4. Exit');

    rl.question('Choose an option: ', (answer) => {
        switch (answer.trim()) {
            case '1':
                masterKey = dbUtils.rotateMasterKey(keysFile, logger.logMessage);
                console.log('Master key rotated successfully.');
                break;
            case '2':
                console.log('Current Master Key:', masterKey);
                break;
            case '3':
                dbUtils.listAllDatabases('./metadata', logger.logMessage);
                break;
            case '4':
                console.log('Exiting...');
                rl.close();
                break;
            default:
                console.log('Invalid option. Please try again.');
                showAllKeyFunctions();
        }
    });
}

// Start the server
server.listen(config.port, () => {
    console.log(`Server is ONLINE on port ${config.port}`);
});

// Set up console command listener
rl.on('line', (input) => {
    if (input.trim() === 'AKF') {
        showAllKeyFunctions();
    }
});
