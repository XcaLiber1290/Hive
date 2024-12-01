const http = require('http');
const https = require('https');
const crypto = require('crypto');

class Proxy {
    constructor(config) {
        this.config = config;
        this.proxyId = crypto.randomBytes(16).toString('hex');
        this.connectedServers = new Map();
        this.currentServerIndex = 0;
    }

    async connectToTargets() {
        for (const route of this.config.routes) {
            for (const server of route.servers) {
                try {
                    const connected = await this.establishConnection(server);
                    if (connected) {
                        this.connectedServers.set(server.url, true);
                        console.log(`Connected to target server: ${server.url}`);
                    }
                } catch (error) {
                    console.log(`Cannot find server ${server.url}, ignoring it`);
                    // Don't add to connectedServers, effectively ignoring this server
                }
            }
        }
        
        // Check if we have any connected servers
        const totalServers = this.config.routes.reduce((sum, route) => sum + route.servers.length, 0);
        const connectedCount = this.connectedServers.size;
        console.log(`Successfully connected to ${connectedCount} out of ${totalServers} servers`);
    }

    establishConnection(server) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                proxyId: this.proxyId
            });

            const req = http.request({
                hostname: new URL(server.url).hostname,
                port: 8081,
                path: '/connect',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length,
                    'X-Connection-Key': server.key
                },
                timeout: 5000 // 5 second timeout
            }, (res) => {
                let responseData = '';
                res.on('data', chunk => responseData += chunk);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(true);
                    } else {
                        reject(new Error(`Connection failed: ${responseData}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Connection timeout'));
            });

            req.write(data);
            req.end();
        });
    }

    getNextServer(servers) {
        const availableServers = servers.filter(server => this.connectedServers.has(server.url));
        if (availableServers.length === 0) return null;
        
        this.currentServerIndex = (this.currentServerIndex + 1) % availableServers.length;
        return availableServers[this.currentServerIndex];
    }

    async start() {
        await this.connectToTargets();

        // Don't start if no servers are available at all
        if (this.connectedServers.size === 0) {
            console.error('No servers available to connect to. Exiting...');
            process.exit(1);
        }

        const server = http.createServer((clientReq, clientRes) => {
            const route = this.config.routes.find(r => clientReq.url.startsWith(r.path));
            
            if (!route) {
                clientRes.writeHead(404);
                clientRes.end('Not Found');
                return;
            }

            const targetServer = this.getNextServer(route.servers);
            if (!targetServer) {
                clientRes.writeHead(503);
                clientRes.end('No available servers for this route');
                return;
            }

            const targetUrl = new URL(clientReq.url, targetServer.url);
            const proxyReq = http.request({
                hostname: targetUrl.hostname,
                port: targetUrl.port || 80,
                path: targetUrl.pathname + targetUrl.search,
                method: clientReq.method,
                headers: {
                    ...clientReq.headers,
                    host: targetUrl.host,
                    'X-Proxy-Id': this.proxyId
                }
            }, (proxyRes) => {
                clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(clientRes);
            });

            clientReq.pipe(proxyReq);

            proxyReq.on('error', (err) => {
                console.error(`Error connecting to ${targetServer.url}:`, err.message);
                // Remove failed server from connected servers
                this.connectedServers.delete(targetServer.url);
                clientRes.writeHead(502);
                clientRes.end('Bad Gateway');
                
                // Try to reconnect to the failed server
                this.establishConnection(targetServer)
                    .then(() => {
                        console.log(`Reconnected to ${targetServer.url}`);
                        this.connectedServers.set(targetServer.url, true);
                    })
                    .catch(() => {
                        console.log(`Cannot reconnect to ${targetServer.url}, ignoring it`);
                    });
            });
        });

        server.listen(this.config.port, () => {
            console.log(`Proxy server running on port ${this.config.port}`);
        });
    }
}

module.exports = Proxy;