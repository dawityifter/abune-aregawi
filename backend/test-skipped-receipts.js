const http = require('http');

console.log('Testing skipped receipts endpoint...');

http.get('http://localhost:5001/api/transactions/skipped-receipts', {
    headers: { 'Authorization': 'Bearer mock-token' }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', data);
    });
}).on('error', err => {
    console.error('Error:', err.message);
});
