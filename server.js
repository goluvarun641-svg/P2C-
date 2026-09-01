const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // 100MB buffer for front/back photos
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

const DB_FILE = path.join(__dirname, 'database.json');

function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        } catch (e) {
            return { records: {}, lastToken: 100 };
        }
    }
    return { records: {}, lastToken: 100 };
}

function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error("Database Save Error:", e);
    }
}

let db = loadDatabase();

io.on('connection', (socket) => {
    socket.emit('load-initial-data', db.records);

    socket.on('send-document', (data) => {
        db.lastToken += 1;
        const token = db.lastToken;

        const record = { 
            ...data, 
            token: token, 
            createdAt: new Date().toISOString(),
            isVerified: true
        };

        db.records[token] = record;
        saveDatabase(db);

        io.emit('receive-document', record);
        socket.emit('document-verified-reply', record);
    });

    socket.on('verify-token-send', (data) => {
        if (db.records[data.token]) {
            db.records[data.token].isVerified = true;
            db.records[data.token].verifiedTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            saveDatabase(db);
        }
        io.emit('document-verified-reply', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Hotel Desk Vault Server running on port ${PORT}`));
