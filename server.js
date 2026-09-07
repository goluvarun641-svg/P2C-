const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Socket.io config with 100MB buffer limit to prevent disconnects
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Uploads directory ensure karein
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Permanent JSON Database File Path
const DB_FILE = path.join(__dirname, 'database.json');

function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try { 
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(raw); 
        } catch (e) { 
            console.error("DB Load Error:", e);
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

// Base64 ko physical file banakar public/uploads/ mein save karne ka helper
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
    
    // Server reboot/shutdown ke baad bhi purana data send karega
    socket.emit('load-initial-data', db.records);

    socket.on('send-document', (data) => {
        try {
            db.lastToken += 1;
            const token = db.lastToken;

            // Save images to public/uploads folder
            const frontPath = saveBase64ToFile(data.frontImage, 'jpeg');
            const backPath = saveBase64ToFile(data.backImage, 'jpeg');
            const sigPath = saveBase64ToFile(data.signatureData, 'png');

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-IN');
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

            const record = {
                token: token,
                guestName: data.guestName || 'Guest',
                mobile: data.mobile || '',
                roomNo: data.roomNo || '',
                docType: data.docType || 'ID Card',
                frontImage: frontPath,
                backImage: backPath,
                signatureData: sigPath,
                date: dateStr,
                time: timeStr,
                createdAt: now.toISOString(),
                isVerified: true
            };

            db.records[token] = record;
            saveDatabase(db); // Save to hard drive

            io.emit('receive-document', record);
            socket.emit('document-verified-reply', record);

            console.log(`✅ Token #${token} saved permanent in DB and uploads folder.`);
        } catch (error) {
            console.error("❌ Send Document Error:", error);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Client Disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Hotel Desk Vault Server running on http://localhost:${PORT}`));
