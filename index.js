const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Load or create configuration file
const configFilePath = path.join(__dirname, 'config.json');
let config = {
    port: 8080,
    customBackend: 'example.js',
    backendEnabled: true,
    proxy: {
        enabled: false,
        port: 8081
    }
};

if (fs.existsSync(configFilePath)) {
    config = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
} else {
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
    console.log('Configuration file created with default values.');
}

// URLs for dbUtils and logger with error handling and retries
const dbUtilsURL = 'https://raw.githubusercontent.com/XcaLiber1290/Hive/main/system/dbUtils.js';
const loggerURL = 'https://raw.githubusercontent.com/XcaLiber1290/Hive/main/system/logger.js';

const systemFolder = path.join(__dirname, 'system');

if (!fs.existsSync(systemFolder)) {
    fs.mkdirSync(systemFolder);
}

async function downloadFileWithRetry(url, dest, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(dest);
                https.get(url, (response) => {
                    if (response.statusCode !== 200) {
                        file.close();
                        fs.unlinkSync(dest);
                        return reject(new Error(`Failed to fetch ${url}, status code: ${response.statusCode}`));
                    }

                    let data = '';
                    response.on('data', chunk => data += chunk);

                    response.on('end', () => {
                        if (!data.trim()) {
                            file.close();
                            fs.unlinkSync(dest);
                            reject(new Error('Received empty file'));
                            return;
                        }

                        fs.writeFileSync(dest, data);
                        resolve();
                    });
                }).on('error', (err) => {
                    file.close();
                    fs.unlinkSync(dest);
                    reject(err);
                });
            });
            console.log(`Successfully downloaded ${path.basename(dest)} on attempt ${attempt}`);
            return;
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);
            if (attempt === maxRetries) {
                throw new Error(`Failed to download ${url} after ${maxRetries} attempts`);
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

async function setupSystemFiles() {
    const dbUtilsPath = path.join(systemFolder, 'dbUtils.js');
    const loggerPath = path.join(systemFolder, 'logger.js');

    try {
        await downloadFileWithRetry(dbUtilsURL, dbUtilsPath);
        await downloadFileWithRetry(loggerURL, loggerPath);
    } catch (error) {
        console.error('Fatal error setting up system files:', error.message);
        process.exit(1);
    }
}

// Ensure required folders exist
const ensureFolderExists = (folderPath, description) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
        console.log(`${description} folder created.`);
    }
};

ensureFolderExists(path.join(__dirname, 'web_roots'), 'Web roots');
ensureFolderExists(path.join(__dirname, 'db'), 'Database');
ensureFolderExists(path.join(__dirname, 'metadata'), 'Metadata');
ensureFolderExists(path.join(__dirname, 'logs'), 'Logs');

// Load the modules dynamically and start the server
async function initialize() {
    await setupSystemFiles();

    const dbUtils = require('./system/dbUtils');
    const logger = require('./system/logger');
    let proxy;

    if (config.proxy && config.proxy.enabled) {
        try {
            const Proxy = require('./system/proxy');
            const pconfig = require('./system/proxy_config');
            proxy = new Proxy(pconfig);
            proxy.start().catch(err => {
                logger.logMessage(`Proxy startup error: ${err.message}`);
                console.error('Failed to start proxy server:', err);
            });
        } catch (error) {
            logger.logMessage(`Failed to initialize proxy: ${error.message}`);
            console.error('Failed to initialize proxy:', error);
        }
    }

    const keysFile = path.join(__dirname, 'metadata', 'master.json');
    let masterKey = dbUtils.loadOrCreateMasterKey(keysFile, logger.logMessage);

    const server = http.createServer((req, res) => {
        const urlParts = req.url.split('/');
        const method = req.method;
        const apiKey = req.headers['x-api-key'];
        const dbName = urlParts[2];

        // Handle the request to get data from a specific db (e.g., test1.js)
        if (method === 'GET' && urlParts[1] === 'db') {
            const dbFile = path.join(__dirname, 'db', `${dbName}.json`);
            if (fs.existsSync(dbFile)) {
                const dbContent = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(dbContent));
            } else {
                res.writeHead(404);
                res.end('Database not found');
            }
        }

        // Default response from Hive layer
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
        } else {
            logger.logMessage('Responding with Hive layer default response');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hive layer response');
        }
    });

    server.listen(config.port, () => {
        console.log(`Server is ONLINE on port ${config.port}`);
        if (config.proxy && config.proxy.enabled) {
            console.log('Proxy server is enabled');
        }
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (input) => {
        if (input.trim() === 'AKF') {
            console.log('\n=== Hive Console ===');
            console.log('1. Rotate Master Key');
            console.log('2. View Current Master Key');
            console.log('3. List All Databases and Their API Keys');
            console.log('4. Toggle Proxy Server');
            console.log('5. Exit Console');

            rl.question('Choose an option: ', async (answer) => {
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
                        config.proxy.enabled = !config.proxy.enabled;
                        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
                        if (config.proxy.enabled && !proxy) {
                            try {
                                const Proxy = require('./system/proxy');
                                const pconfig = require('./system/proxy_config');
                                proxy = new Proxy(pconfig);
                                await proxy.start();
                                console.log('Proxy server enabled and started');
                            } catch (error) {
                                console.error('Failed to start proxy:', error);
                                config.proxy.enabled = false;
                                fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
                            }
                        } else if (!config.proxy.enabled && proxy) {
                            console.log('Proxy server disabled. Will take effect after restart.');
                        }
                        break;
                    case '5':
                        console.log('Exiting console...');
                        break;
                    default:
                        console.log('Invalid option. Please try again.');
                }
            });
        }
    });
}

initialize();
