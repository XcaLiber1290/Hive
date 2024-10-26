// customBackend.js
const http = require('http');

// Create a simple HTTP server for the custom backend
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello World!');
});

// Start the server on the specified port
const PORT = 4001; // Ensure this matches the customBackendPort in config.json
server.listen(PORT, () => {
    console.log(`Custom backend server running on port ${PORT}`);
});
