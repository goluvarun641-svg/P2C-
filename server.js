const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // 100MB File Support
});

app.use(express.static(path.join(__dirname, 'public')));

// Persistent State across Laptop Refreshes
let activeDocuments = {};
let tokenCounter = 101;

io.on('connection', (socket) => {
    // Send all existing records on reconnect/refresh
    socket.emit('load-initial-data', activeDocuments);

    socket.on('send-document', (data) => {
        const token = tokenCounter++;
        const record = { ...data, token: token, createdAt: new Date().toISOString() };
        activeDocuments[token] = record;
        io.emit('receive-document', record);
    });

    socket.on('verify-token-send', (data) => {
        if (activeDocuments[data.token]) {
            activeDocuments[data.token].isVerified = true;
            activeDocuments[data.token].verifiedTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        }
        io.emit('document-verified-reply', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
