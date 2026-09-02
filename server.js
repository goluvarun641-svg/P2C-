const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.io payload limit ko 100MB par set karein
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 
});

const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
    } catch (err) {
        console.error("Database save failed:", err);
    }
}

// Safe Base64 Image Saving Helper
function saveBase64Image(base64Data, filename) {
    if (!base64Data || typeof base64Data !== 'string') return null;
    if (base64Data.startsWith('/uploads/')) return base64Data; // Already saved path

    try {
        // Strip out data URL header (e.g. data:image/png;base64,)
        const pureBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(pureBase64, 'base64');
        const filePath = path.join(UPLOAD_DIR, filename);
        
        fs.writeFileSync(filePath, buffer);
        return `/uploads/${filename}`;
    } catch (err) {
        console.error(`Error saving file ${filename}:`, err);
        return null;
    }
}

let db = loadDatabase();

io.on('connection', (socket) => {
    socket.emit('load-initial-data', db.records);

    socket.on('send-document', (data) => {
        try {
            db.lastToken += 1;
            const token = db.lastToken;

            // Generate unique filenames for images
            const frontPath = saveBase64Image(data.frontImage, `token_${token}_front.jpg`);
            const backPath = saveBase64Image(data.backImage, `token_${token}_back.jpg`);
            const sigPath = saveBase64Image(data.signatureData, `token_${token}_sig.png`);

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

            // Broadcast to Desk Console & reply to Mobile Client
            io.emit('receive-document', record);
            socket.emit('document-verified-reply', record);

            console.log(`✅ Token #${token} saved successfully in database & uploads folder.`);
        } catch (error) {
            console.error("❌ Failed to process send-document:", error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Hotel Desk Vault running on port ${PORT}`));
