const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateKey(isMaster = false) {
    return isMaster
        ? crypto.randomBytes(32).toString('hex')
        : crypto.randomBytes(16).toString('hex');
}

function loadOrCreateMasterKey(filePath, logMessage) {
    if (fs.existsSync(filePath)) {
        logMessage('Master key loaded');
        return JSON.parse(fs.readFileSync(filePath, 'utf8')).masterKey;
    } else {
        const masterKey = generateKey(true);
        fs.writeFileSync(filePath, JSON.stringify({ masterKey }, null, 2));
        logMessage('Master key generated');
        return masterKey;
    }
}

function createDatabase(dbName, logActionMessage) {
    const dbFolder = path.join(__dirname, '../db');
    const metadataFolder = path.join(__dirname, '../metadata');
    const apiKey = generateKey();

    const metadata = {
        apiKey,
        created: new Date().toISOString(),
        additionalKeys: []
    };

    const dbFile = path.join(dbFolder, `${dbName}.json`);
    const metadataFile = path.join(metadataFolder, `${dbName}.json`);

    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    fs.writeFileSync(dbFile, '{}');
    logActionMessage(`Database '${dbName}' created with API key: ${apiKey}`);
    return apiKey;
}

module.exports = {
    generateKey,
    loadOrCreateMasterKey,
    createDatabase
};
