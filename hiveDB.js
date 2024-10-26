// hiveDB.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('./config.json');

// Load custom backend if specified in config
let customBackend;
if (config.enableCustomBackend && config.customBackendFile) {
    try {
        customBackend = require(path.join(__dirname, config.customBackendFile));
    } catch (error) {
        console.error(`Failed to load custom backend file: ${config.customBackendFile}`, error);
    }
}

function getDBConfig(dbName) {
    const configPath = path.join(__dirname, 'db', dbName, 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config for database ${dbName} not found`);
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

function initializeDBFiles(dbName) {
    const dbPath = path.join(__dirname, 'db', dbName);
    if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
    }

    const files = {
        'data.json': '[]',
        'config.json': JSON.stringify({
            enableCustomBackend: false,
            apiKeys: []
        }, null, 2),
        'meta.json': JSON.stringify({
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, null, 2)
    };

    for (const [fileName, content] of Object.entries(files)) {
        const filePath = path.join(dbPath, fileName);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, content);
        }
    }
}

async function createDB(dbName) {
    initializeDBFiles(dbName);
}

async function performOperation(dbName, operation, data) {
    initializeDBFiles(dbName);
    const dbConfig = getDBConfig(dbName);

    // Determine if the request should go to the custom backend
    if (config.enableCustomBackend && config.useCustomBackendFor.includes(operation)) {
        return await passToCustomBackend(dbName, operation, data);
    } else {
        const dataPath = path.join(__dirname, 'db', dbName, 'data.json');
        const jsonData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

        switch (operation) {
            case 'POST':
                jsonData.push(data);
                break;
            case 'GET':
                return jsonData;
            case 'PUT':
                jsonData[data.id] = data;
                break;
            case 'DELETE':
                jsonData.splice(data.id, 1);
                break;
            default:
                throw new Error('Invalid operation');
        }

        fs.writeFileSync(dataPath, JSON.stringify(jsonData, null, 2));
        return { message: `${operation} operation completed successfully` };
    }
}

// Pass requests to the custom backend server
async function passToCustomBackend(dbName, operation, data) {
    const backendURL = `http://localhost:${config.customBackendPort}/api/${dbName}/${operation.toLowerCase()}`;
    const response = await axios({
        method: operation.toLowerCase(),
        url: backendURL,
        data: data
    });

    return response.data; // Return the response from the backend
}

module.exports = { createDB, performOperation };
