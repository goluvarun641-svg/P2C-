const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// maxHttpBufferSize 100MB set kiya hai taaki HD Photos/PDFs drop na hon
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
    });

    socket.on('send-document', (data) => {
        io.to(data.roomId).emit('receive-document', data);
    });

    socket.on('verify-token-send', (data) => {
        io.to(data.roomId).emit('document-verified-reply', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 P2P Server live on port ${PORT}`));
