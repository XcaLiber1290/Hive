// hive.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hiveDB = require('./hiveDB');
const configPath = path.join(__dirname, 'config.json');

// Initialize or load configuration
function loadOrCreateConfig() {
    let config;
    if (!fs.existsSync(configPath)) {
        config = generateDefaultConfig();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } else {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.masterApiKey) {
            config.masterApiKey = generateRandomKey();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        }
    }
    return config;
}

// Generate a random API key for Master API Key
function generateRandomKey() {
    return crypto.randomBytes(16).toString('hex');
}

// Default configuration generator
function generateDefaultConfig() {
    return {
        masterApiKey: generateRandomKey(),
        serverPort: 3000,
        enableCustomBackend: true,
        customBackendPort: 3000, // Custom backend server port
        customBackendFile: "customBackend.js"
    };
}

const config = loadOrCreateConfig();

// Serve static files from Webroots folder
function serveStaticFile(req, res) {
    const filePath = path.join(__dirname, 'Webroots', req.url);
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File Not Found');
        } else {
            res.writeHead(200);
            res.end(content);
        }
    });
}

const server = http.createServer(async (req, res) => {
    const [_, route, dbName, operation] = req.url.split('/');
    let body = '';

    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
        const data = body ? JSON.parse(body) : null;

        // Route static files
        if (req.method === 'GET' && req.url.startsWith('/Webroots')) {
            return serveStaticFile(req, res);
        }

        // Example: route to handle database operations
        if (dbName && operation && ['POST', 'GET', 'PUT', 'DELETE'].includes(operation.toUpperCase())) {
            if (operation.toUpperCase() === 'POST' && req.url.endsWith('/CREATE')) {
                // Check for Master API key
                const masterApiKey = req.headers['x-master-api-key'];
                if (!masterApiKey || masterApiKey !== config.masterApiKey) {
                    res.writeHead(403); // Forbidden
                    return res.end(JSON.stringify({ error: 'Invalid Master API Key' }));
                }
            }

            try {
                const result = await hiveDB.performOperation(dbName, operation.toUpperCase(), data);
                res.writeHead(200);
                return res.end(JSON.stringify({ success: true, result }));
            } catch (error) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: 'Operation failed' }));
            }
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Invalid route' }));
    });
});

server.listen(config.serverPort, () => {
    console.log(`Hive framework running on port ${config.serverPort}`);
});
