const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8,
    pingTimeout: 60000,
    pingInterval: 25000
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Uploads Folder Path
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Database File Path (Laptop Hard Drive par permanent save)
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
        console.log("💾 Database successfully saved to Hard Disk!");
    } catch (e) { 
        console.error("❌ Database save error:", e); 
    }
}

// Global DB Object Load
let db = loadDatabase();

// Base64 to File convertor
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

io.on('connection', (socket) => {
    console.log('🟢 Client Connected:', socket.id);
    
    // Laptop reboot ke baad bhi purana saara data dashboard ko bhejta hai
    socket.emit('load-initial-data', db.records);

    socket.on('send-document', (data) => {
        try {
            db.lastToken += 1;
            const token = db.lastToken;

            // Save images to public/uploads
            const frontPath = saveBase64ToFile(data.frontImage, 'jpeg');
            const backPath = saveBase64ToFile(data.backImage, 'jpeg');
            const sigPath = saveBase64ToFile(data.signatureData, 'png');

            const now = new Date();
            const dateStr = now.toLocaleDateString('en-IN'); // e.g. "07/09/2026"
            const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

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
                createdAt: now.toISOString()
            };

            db.records[token] = record;
            saveDatabase(db); // Instantly write to hard drive

            io.emit('receive-document', record);
            socket.emit('document-verified-reply', record);

            console.log(`✅ Token #${token} saved permanent!`);
        } catch (error) {
            console.error("❌ Send Document Error:", error);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server active on http://localhost:${PORT}`));
