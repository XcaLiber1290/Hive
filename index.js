const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

// Create db folder if it doesn't exist
const dbFolder = path.join(__dirname, 'db');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder);
    console.log('Database folder created.');
}

// Create metadata folder for storing DB-key mappings
const metadataFolder = path.join(__dirname, 'metadata');
if (!fs.existsSync(metadataFolder)) {
    fs.mkdirSync(metadataFolder);
    console.log('Metadata folder created.');
}

// Load or initialize master key
const keysFile = path.join(metadataFolder, 'master.json');
let masterKey = '';
if (fs.existsSync(keysFile)) {
    masterKey = JSON.parse(fs.readFileSync(keysFile, 'utf8')).masterKey;
    console.log('Master key loaded');
} else {
    masterKey = generateKey(true);
    fs.writeFileSync(keysFile, JSON.stringify({ masterKey }, null, 2));
    console.log('Master key generated.');
}

const logsFolder = path.join(__dirname, 'logs');
if (!fs.existsSync(logsFolder)) {
    fs.mkdirSync(logsFolder);
    console.log('Logs folder created.');
}
function logMessage(message) {
    const logFile = path.join(logsFolder, 'server.log');
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - ${message}\n`;

    fs.appendFileSync(logFile, logLine);
}

// Function to log database-related actions
function logActionMessage(message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    const actionLogFile = path.join(__dirname, 'logs', 'server_actions.log');
    
    // Ensure action_logs folder exists
    if (!fs.existsSync(path.dirname(actionLogFile))) {
        fs.mkdirSync(path.dirname(actionLogFile));
    }

    // Append log message to action log file
    fs.appendFileSync(actionLogFile, logMessage);
}


// Helper function to generate API keys
function generateKey(isMaster = false) {
    return isMaster
        ? crypto.randomBytes(32).toString('hex')
        : crypto.randomBytes(16).toString('hex');
}

// Function to get DB metadata
function getDbMetadata(dbName) {
    const metadataFile = path.join(metadataFolder, `${dbName}.json`);
    if (fs.existsSync(metadataFile)) {
        return JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    }
    return null;
}

// Function to save DB metadata
function saveDbMetadata(dbName, metadata) {
    const metadataFile = path.join(metadataFolder, `${dbName}.json`);
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
}

// Function to create new DB with its own API key
function createDatabase(dbName) {
    const apiKey = generateKey();
    const metadata = {
        apiKey,
        created: new Date().toISOString(),
        additionalKeys: [] // For future additional API keys
    };
    saveDbMetadata(dbName, metadata);
    fs.writeFileSync(path.join(dbFolder, `${dbName}.json`), '{}');
    console.log(`Database '${dbName}' created with API key: ${apiKey}`);
    return apiKey;
}

// Function to add additional API key to a database
function addApiKeyToDb(dbName) {
    const metadata = getDbMetadata(dbName);
    if (metadata) {
        const newKey = generateKey();
        metadata.additionalKeys.push(newKey);
        saveDbMetadata(dbName, metadata);
        console.log(`New API key added to database '${dbName}': ${newKey}`);
        return newKey;
    }
    console.log(`Database '${dbName}' not found.`);
    return null;
}

// HTTP server functionality
const server = http.createServer((req, res) => {
    const urlParts = req.url.split('/');
    const method = req.method;
    const apiKey = req.headers['x-api-key'];
    const dbName = urlParts[2];

    // Function to check if API key has access to database
    const hasDbAccess = (dbName, apiKey) => {
        // Log the start of the access check
        logMessage(`Checking access for DB: ${dbName} with API key: ${apiKey}`);
        
        // If the master key is being used, grant access
        if (apiKey === masterKey) {
            logMessage(`Master key used for DB: ${dbName}`);
            return true;
        }
    
        // Retrieve the metadata for the given database
        const metadata = getDbMetadata(dbName);
    
        // If no metadata is found, log and deny access
        if (!metadata) {
            logMessage(`No metadata found for DB: ${dbName}`);
            return false;
        }
    
        logMessage(`Database API Key: ${metadata.apiKey}, Additional Keys: ${metadata.additionalKeys.join(', ')}`);
        const accessGranted = metadata.apiKey === apiKey || metadata.additionalKeys.includes(apiKey);
        if (accessGranted) {
            logMessage(`Access granted for DB: ${dbName} with API key: ${apiKey}`);
        } else {
            logMessage(`Access denied for DB: ${dbName} with API key: ${apiKey}`);
        }
    
        return accessGranted;
    };
    
    

    // Handle database creation (master key only)
    if (method === 'POST' && urlParts[1] === 'create') {
        if (apiKey !== masterKey) {
            res.writeHead(403);
            res.end('Forbidden: Master key required for database creation');
            return;
        }
    
        const newApiKey = createDatabase(dbName);
        logActionMessage(`Received POST request for creating database '${dbName}' with API Key: ${apiKey}`);
        logActionMessage(`Database '${dbName}' created with API key: ${newApiKey}`);
        res.writeHead(201);
        res.end(JSON.stringify({ 
            message: 'Database created successfully',
            apiKey: newApiKey
        }));
        return;
    }
    
    // Handle adding new API key to database
    if (method === 'POST' && urlParts[1] === 'addkey') {
        if (apiKey !== masterKey) {
            res.writeHead(403);
            res.end('Forbidden: Master key required for adding API keys');
            return;
        }
    
        const newKey = addApiKeyToDb(dbName);
        if (newKey) {
            logActionMessage(`Received POST request for adding key to database '${dbName}' with API Key: ${apiKey}`);
            logActionMessage(`New API key added to database '${dbName}': ${newKey}`);
            res.writeHead(201);
            res.end(JSON.stringify({ 
                message: 'New API key added to database',
                apiKey: newKey
            }));
        } else {
            res.writeHead(404);
            res.end('Database not found');
        }
        return;
    }
    
    // Handle GET request for database
    if (method === 'GET' && urlParts[1] === 'get') {
        logActionMessage(`Received GET request for database '${dbName}'`);
        try {
            const data = fs.readFileSync(path.join(dbFolder, `${dbName}.json`), 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (error) {
            res.writeHead(404);
            res.end('Database not found');
        }
    }
    
    // Handle PUT request for updating database
    if (method === 'PUT' && urlParts[1] === 'update') {
        logActionMessage(`Received PUT request for updating database '${dbName}'`);
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            fs.writeFileSync(path.join(dbFolder, `${dbName}.json`), body);
            logActionMessage(`Database '${dbName}' updated`);
            res.writeHead(200);
            res.end('Database updated');
        });
    }
    
    // Handle DELETE request for database
    if (method === 'DELETE' && urlParts[1] === 'delete') {
        logActionMessage(`Received DELETE request for database '${dbName}'`);
        try {
            // Delete both database and metadata
            fs.unlinkSync(path.join(dbFolder, `${dbName}.json`));
            fs.unlinkSync(path.join(metadataFolder, `${dbName}.json`));
            logActionMessage(`Database '${dbName}' and metadata deleted`);
            res.writeHead(200);
            res.end('Database and associated metadata deleted');
        } catch (error) {
            res.writeHead(404);
            res.end('Database not found');
        }
    }
});

// Console interface setup
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Main console function
function showAllKeyFunctions() {
    console.log('\n=== SimpleDB Master Key Console ===');
    console.log('1. Rotate Master Key');
    console.log('2. View Current Master Key');
    console.log('3. List All Databases and Their API Keys');
    console.log('4. Exit');
    
    rl.question('Choose an option: ', (answer) => {
        switch (answer.trim()) {
            case '1':
                masterKey = generateKey(true);
                fs.writeFileSync(keysFile, JSON.stringify({ masterKey }, null, 2));
                console.log('Master key rotated successfully. New Master Key:', masterKey);
                break;
            case '2':
                console.log('Current Master Key:', masterKey);
                break;
            case '3':
                // List all databases and their API keys
                fs.readdir(metadataFolder, (err, files) => {
                    if (err) {
                        console.log('Error reading databases:', err);
                    } else {
                        files.forEach(file => {
                            if (file !== 'master.json') {
                                const dbName = file.replace('.json', '');
                                const metadata = getDbMetadata(dbName);
                                console.log(`\nDatabase: ${dbName}`);
                                console.log(`Primary API Key: ${metadata.apiKey}`);
                                console.log(`Additional Keys: ${metadata.additionalKeys.join(', ') || 'None'}`);
                            }
                        });
                    }
                });
                break;
            case '4':
                console.log('Exiting menu...');
                return;
            default:
                console.log('Invalid option. Please try again.');
                showAllKeyFunctions();
        }
    });
}

// Start the server
server.listen(8080, () => {
    console.log('Server is ONLINE');
});

// Set up command listener
rl.on('line', (input) => {
    if (input.trim() === 'AKF') {
        showAllKeyFunctions();
    }
});
