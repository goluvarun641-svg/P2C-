const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });

// Uploads directory ensure karein
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));

const DB_FILE = path.join(__dirname, 'database.json');

function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } 
        catch (e) { return { records: {}, lastToken: 100 }; }
    }
    return { records: {}, lastToken: 100 };
}

function saveDatabase(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

// Base64 ko image file mein convert karne ka helper function
function saveBase64Image(base64Data, filename) {
    if (!base64Data) return null;
    const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) return null;
    
    const buffer = Buffer.from(matches[2], 'base64');
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
}

let db = loadDatabase();

io.on('connection', (socket) => {
    socket.emit('load-initial-data', db.records);

    socket.on('send-document', (data) => {
        db.lastToken += 1;
        const token = db.lastToken;

        // Base64 images ko physical files mein save karein
        const frontPath = saveBase64Image(data.frontImage, `token_${token}_front.jpg`);
        const backPath = saveBase64Image(data.backImage, `token_${token}_back.jpg`);
        const sigPath = saveBase64Image(data.signatureData, `token_${token}_sig.png`);

        const record = { 
            token: token,
            guestName: data.guestName,
            mobile: data.mobile,
            roomNo: data.roomNo,
            docType: data.docType,
            frontImage: frontPath,
            backImage: backPath,
            signatureData: sigPath,
            createdAt: new Date().toISOString(),
            isVerified: true
        };

        db.records[token] = record;
        saveDatabase(db);

        io.emit('receive-document', record);
        socket.emit('document-verified-reply', record);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
