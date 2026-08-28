const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('send-document', (data) => {
        // Document direct laptop ko stream/pipe ho jayega (Zero Cloud Storage)
        socket.to(data.roomId).emit('receive-document', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 P2P Server live on port ${PORT}`));