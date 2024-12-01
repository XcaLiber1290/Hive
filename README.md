# Hive 🐝 - Distributed Database Management System

## Overview

Hive is a robust, lightweight distributed database management system designed for flexible and secure data storage, retrieval, and routing. Built with Node.js, Hive offers sophisticated features for database creation, proxy routing, and advanced key management.

## 🌟 Features

### Secure Database Management
- Dynamic database creation
- Master key and API key generation
- Cryptographically secure key rotation
- Isolated database storage

### Advanced Proxy System
- Load balancing across multiple servers
- Automatic server connection and failover
- Configurable routing
- Proxy authentication mechanism

### Comprehensive Logging
- Detailed server event logging
- Action tracking
- Separate logs for different event types

### Flexible Configuration
- Easy-to-modify JSON configuration
- Custom backend support
- Proxy server toggleability

## 🛠 Prerequisites

- Node.js (v14.0.0 or higher)
- npm (Node Package Manager)

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/YourUsername/Hive.git
cd Hive
```

2. Install dependencies:
```bash
npm install
```

## 🚀 Quick Start

### Starting the Server
```bash
node index.js
```

### Master Key Console
Type `AKF` in the console after server startup to access advanced management features:

1. Rotate Master Key
2. View Current Master Key
3. List All Databases
4. Toggle Proxy Server
5. Exit Console

## 📝 Configuration

### `config.json`
```json
{
    "port": 8080,
    "customBackend": "example.js",
    "backendEnabled": true,
    "proxy": {
        "enabled": false,
        "port": 8081
    }
}
```

### `proxy_config.js`
```javascript
module.exports = {
    port: 8080,
    routes: [
        {
            path: '/api',
            servers: [
                {
                    url: 'http://server1.example.com',
                    key: 'server1-connection-key'
                }
            ]
        }
    ]
};
```

## 🔐 Security Features

- Cryptographically secure random key generation
- Master key rotation
- Proxy connection authentication
- Isolated database file storage
- Connection key management

## 💾 Database Creation

Send a POST request to `/create/{database_name}` with the master key to create a new database.

### Example Database Creation
```javascript
fetch('/create/myDatabase', {
    method: 'POST',
    headers: {
        'X-API-Key': 'master-key-here'
    }
})
```

## 🌐 Proxy System

### Key Components
- `proxy.js`: Handles server routing and load balancing
- `targetAuth.js`: Manages proxy authentication
- `proxy_config.js`: Defines routing configuration

### proxy_connection
```javascript
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');

class TargetAuth {
    constructor(port = 8081) {
        this.port = port;
        this.connectionKey = this.generateKey();
        this.connectedProxies = new Set();
    }

    generateKey() {
        return crypto.randomBytes(32).toString('hex');
    }

    start() {
        const server = http.createServer((req, res) => {
            if (req.url === '/connect' && req.method === 'POST') {
                let data = '';
                req.on('data', chunk => data += chunk);
                req.on('end', () => {
                    try {
                        const { proxyId } = JSON.parse(data);
                        if (req.headers['x-connection-key'] === this.connectionKey) {
                            this.connectedProxies.add(proxyId);
                            res.writeHead(200);
                            res.end(JSON.stringify({ status: 'connected' }));
                        } else {
                            res.writeHead(401);
                            res.end(JSON.stringify({ error: 'Invalid connection key' }));
                        }
                    } catch (error) {
                        res.writeHead(400);
                        res.end(JSON.stringify({ error: 'Invalid request' }));
                    }
                });
            } else {
                // Verify proxy for regular requests
                const proxyId = req.headers['x-proxy-id'];
                if (this.connectedProxies.has(proxyId)) {
                    res.writeHead(200);
                    res.end('Request processed');
                } else {
                    res.writeHead(403);
                    res.end('Unauthorized proxy');
                }
            }
        });

        server.listen(this.port, () => {
            console.log(Target auth server running on port ${this.port});
            console.log(Connection key: ${this.connectionKey});
        });
    }
}

new TargetAuth().start();
```
#### Provide the key in the proxy_config.js in the main proxy server.

### Proxy Connection Flow
1. Proxy attempts to connect to target servers
2. Authentication via unique connection key
3. Tracking of connected proxies
4. Request routing and failover

## 📊 Logging

Logs are stored in the `logs/` directory:
- `server.log`: General server events
- `server_actions.log`: Database and key management actions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## 🐛 Troubleshooting

- Ensure all configuration files are correctly formatted
- Check that Node.js and npm are updated
- Verify file permissions for logs and database directories

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Contact

Project Link: [https://github.com/XcaLiber1290/Hive](https://github.com/XcaLiber1290/Hive)

## 🙌 Acknowledgements

- Node.js
- HTTP/HTTPS Modules

---

**Happy Coding!** 🚀🐝