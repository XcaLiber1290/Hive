const fs = require('fs');
const path = require('path');

// Load or create the master key
function loadOrCreateMasterKey(keysFile, logFunction) {
    try {
        if (fs.existsSync(keysFile)) {
            const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'));
            return keys.masterKey;
        } else {
            // Generate a new master key if the file doesn't exist
            const masterKey = generateMasterKey();
            fs.writeFileSync(keysFile, JSON.stringify({ masterKey }), 'utf8');
            logFunction('Master key created and saved.');
            return masterKey;
        }
    } catch (error) {
        logFunction('Error loading or creating master key: ' + error.message);
        throw error;
    }
}

// Generate a random master key
function generateMasterKey() {
    return 'master-key-' + Math.random().toString(36).substring(2, 15);
}

// Rotate the master key (this would overwrite the old one)
function rotateMasterKey(keysFile, logFunction) {
    try {
        const newMasterKey = generateMasterKey();
        const keys = { masterKey: newMasterKey };
        fs.writeFileSync(keysFile, JSON.stringify(keys), 'utf8');
        logFunction('Master key rotated.');
        return newMasterKey;
    } catch (error) {
        logFunction('Error rotating master key: ' + error.message);
        throw error;
    }
}

// Create a new database and return its API key
function createDatabase(dbName, logFunction) {
    const dbFilePath = path.join(__dirname, 'db', dbName + '.json');
    if (fs.existsSync(dbFilePath)) {
        throw new Error('Database already exists.');
    }
    const apiKey = generateMasterKey(); // Generate a unique API key for the database
    fs.writeFileSync(dbFilePath, JSON.stringify({ apiKey, data: [] }), 'utf8');
    logFunction(`Database ${dbName} created with API key ${apiKey}.`);
    return apiKey;
}

// List all databases and their API keys
function listAllDatabases(metadataFolder, logFunction) {
    const databases = fs.readdirSync(metadataFolder);
    const dbs = databases.map(file => {
        if (file.endsWith('.json')) {
            const dbName = file.replace('.json', '');
            const db = JSON.parse(fs.readFileSync(path.join(metadataFolder, file), 'utf8'));
            return { dbName, apiKey: db.apiKey };
        }
        return null;
    }).filter(db => db !== null);
    logFunction('Listing all databases:', dbs);
    return dbs;
}

module.exports = {
    loadOrCreateMasterKey,
    rotateMasterKey,
    createDatabase,
    listAllDatabases
};
