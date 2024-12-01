module.exports = {
    port: 8080,
    routes: [
        {
            path: '/api',
            servers: [
                {
                    url: 'http://server1.example.com',
                    key: 'server1-connection-key' // Must match target server's generated key
                }
            ]
        }
    ]
};