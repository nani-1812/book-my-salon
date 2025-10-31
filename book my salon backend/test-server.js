const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Root works!');
});

app.get('/api/test', (req, res) => {
    res.send('API test works!');
});

app.listen(3001, () => {
    console.log('Test server on port 3001');
});