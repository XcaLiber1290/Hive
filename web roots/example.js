const http = require('http');

// Function to get the database content from Hive Server
function fetchDatabaseContent(dbName, callback) {
    const options = {
        hostname: 'localhost',  // Assuming Hive server is running on localhost
        port: 8080,  // Port of your Hive server
        path: `/db/${dbName}`,  // API endpoint to fetch db content
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            if (res.statusCode === 200) {
                callback(null, JSON.parse(data));  // Return the response as JSON
            } else {
                callback(new Error('Failed to fetch database content'));
            }
        });
    });

    req.on('error', (err) => {
        callback(err);
    });

    req.end();
}

// Fetch and display content from test1.js
fetchDatabaseContent('test1', (err, content) => {
    if (err) {
        console.error('Error fetching database content:', err.message);
    } else {
        console.log('Database content:', content);
    }
});
