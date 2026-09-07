const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Payload size limit ko 100MB badhaya taaki mobile images se disconnect na ho
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const DB_FILE = path.join(__dirname, 'database.json');

function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } 
        catch (e) { return { records: {}, lastToken: 100 }; }
    }
    return { records: {}, lastToken: 100 };
}

function saveDatabase(db) {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); } 
    catch (e) { console.error("Database save error:", e); }
}

// Purane system jaisa exact timestamp naming format (e.g. 1787081431187-891082927.jpeg)
function saveBase64ToFile(base64Data, defaultExt = 'jpeg') {
    if (!base64Data || typeof base64Data !== 'string') return null;

    try {
        let ext = defaultExt;
        const match = base64Data.match(/^data:image\/(\w+);base64,/);
        if (match) {
            ext = match[1] === 'jpeg' ? 'jpeg' : match[1];
        }

        const pureBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(pureBase64, 'base64');

        // Filename generator matching your existing uploads folder format
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const filePath = path.join(UPLOAD_DIR, fileName);

        fs.writeFileSync(filePath, buffer);
        return `/uploads/${fileName}`;
    } catch (err) {
        console.error("File save error:", err);
        return null;
    }
}

let db = loadDatabase();

io.on('connection', (socket) => {
    console.log('🟢 Client Connected:', socket.id);
    socket.emit('load-initial-data', db.records);

    socket.on('send-document', (data) => {
        try {
            db.lastToken += 1;
            const token = db.lastToken;

            // Base64 images ko physical files banakar public/uploads mein save karein
            const frontPath = saveBase64ToFile(data.frontImage, 'jpeg');
            const backPath = saveBase64ToFile(data.backImage, 'jpeg');
            const sigPath = saveBase64ToFile(data.signatureData, 'png');

            const record = {
                token: token,
                guestName: data.guestName || 'Guest',
                mobile: data.mobile || '',
                roomNo: data.roomNo || '',
                docType: data.docType || 'ID Card',
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

            console.log(`✅ Token #${token} saved successfully in public/uploads/`);
        } catch (error) {
            console.error("❌ Send Document Error:", error);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Client Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
