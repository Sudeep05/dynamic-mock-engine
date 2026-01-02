const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const fileUpload = require('express-fileupload');
const { parse } = require('csv-parse/sync');

const app = express();
const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_FILE = path.join(__dirname, 'mocks.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json());
app.use(express.static('public'));
app.use(fileUpload());

let mockRegistry = new Map();

// --- PERSISTENCE: Save/Load ---
const saveToDisk = () => {
    const data = JSON.stringify(Array.from(mockRegistry.values()), null, 2);
    fs.writeFileSync(BACKUP_FILE, data);
};

const loadFromDisk = () => {
    if (fs.existsSync(BACKUP_FILE)) {
        const data = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        data.forEach(m => {
            let csvData = null;
            if (m.csvFile && fs.existsSync(path.join(__dirname, m.csvFile))) {
                const content = fs.readFileSync(path.join(__dirname, m.csvFile));
                csvData = parse(content, { columns: true, skip_empty_lines: true });
            }
            mockRegistry.set(`${m.method.toUpperCase()}:${m.path}`, { ...m, csvData, currentIndex: 0, hits: 0, lastHit: null });
        });
        console.log(`[Backup] Restored ${mockRegistry.size} mocks.`);
    }
};
loadFromDisk();

// --- ADMIN & HEALTH API ---
// NEW: Built-in Health Check
app.get('/_admin/health', (req, res) => {
    res.json({ status: "OK", message: "Mock Controller is running", timestamp: new Date().toISOString() });
});

app.post('/_admin/upload-csv', (req, res) => {
    if (!req.files || !req.files.csvFile) return res.status(400).json({ error: "No file" });
    const file = req.files.csvFile;
    const uploadPath = path.join(DATA_DIR, file.name);
    file.mv(uploadPath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ path: `data/${file.name}` });
    });
});

app.post('/_admin/add', (req, res) => {
    try {
        const config = req.body;
        const key = `${config.method.toUpperCase()}:${config.path}`;
        let csvData = null;
        if (config.csvFile) {
            const fullPath = path.join(__dirname, config.csvFile);
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath);
                csvData = parse(content, { columns: true, skip_empty_lines: true });
            }
        }
        mockRegistry.set(key, { ...config, csvData, currentIndex: 0, hits: 0, lastHit: null });
        saveToDisk();
        res.status(201).json({ message: "Success" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/_admin/list', (req, res) => res.json(Array.from(mockRegistry.values())));
app.delete('/_admin/remove', (req, res) => {
    mockRegistry.delete(req.body.key);
    saveToDisk();
    res.json({ message: "Deleted" });
});

// --- MOCK ENGINE ---
app.use((req, res, next) => {
    if (req.path === '/' || req.path.startsWith('/_admin')) return next();
    const key = `${req.method}:${req.path}`;
    const mock = mockRegistry.get(key);

    if (!mock) return res.status(404).json({ error: "Not Found" });

    if (['POST', 'PUT'].includes(req.method)) {
        console.log(`[Payload] Incoming to ${req.path}:`, JSON.stringify(req.body, null, 2));
    }

    mock.hits++;
    mock.lastHit = new Date().toLocaleTimeString();

    let responseBody = { ...mock.responseBody };
    if (mock.csvData && mock.csvData.length > 0) {
        const row = mock.csvData[mock.currentIndex];
        responseBody = { ...responseBody, ...row };
        mock.currentIndex = (mock.currentIndex + 1) % mock.csvData.length;
    }

    const delay = (mock.avgDelay || 0) + (Math.random() * 2 - 1) * (mock.deviation || 0);
    setTimeout(() => res.status(mock.statusCode || 200).json(responseBody), Math.max(0, delay));
});

// --- START SERVERS ---
app.listen(HTTP_PORT, () => console.log(`[HTTP] Dashboard: http://localhost:${HTTP_PORT}`));

try {
    const options = {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
    };
    https.createServer(options, app).listen(HTTPS_PORT, () => {
        console.log(`[HTTPS] Mocks Active: https://localhost:${HTTPS_PORT}`);
    });
} catch (e) {
    console.error(`[Error] HTTPS failed: ${e.message}`);
}