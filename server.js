const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'portfolio_super_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Setup Multer for Image Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'images'))
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)) // Append extension
    }
});
const upload = multer({ storage: storage });

// Initialize Database
const dbPath = path.join(__dirname, 'portfolio.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("Error opening database", err.message);
    else {
        console.log("Connected to SQLite database.");
        
        // Create Admin table
        db.run(`CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )`, (err) => {
            if (!err) {
                // Insert default admin if not exists
                db.get(`SELECT * FROM admin WHERE username = ?`, ['admin'], (err, row) => {
                    if (!row) {
                        const hash = bcrypt.hashSync('admin123', 10);
                        db.run(`INSERT INTO admin (username, password) VALUES (?, ?)`, ['admin', hash]);
                        console.log("Default admin created: admin / admin123");
                    }
                });
            }
        });

        // Create Projects table
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title_en TEXT,
            title_ar TEXT,
            category_en TEXT,
            category_ar TEXT,
            desc_en TEXT,
            desc_ar TEXT,
            tools TEXT,
            image TEXT
        )`);
        
        // Create Settings table for text
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value_en TEXT,
            value_ar TEXT
        )`);
    }
});

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.adminId) {
        return next();
    }
    res.status(401).json({ error: "Unauthorized" });
};

// --- API ROUTES ---

// 1. Auth Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM admin WHERE username = ?`, [username], (err, admin) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!admin) return res.status(400).json({ error: "Invalid username or password" });

        const match = bcrypt.compareSync(password, admin.password);
        if (match) {
            req.session.adminId = admin.id;
            res.json({ success: true, message: "Logged in successfully" });
        } else {
            res.status(400).json({ error: "Invalid username or password" });
        }
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.adminId) res.json({ authenticated: true });
    else res.json({ authenticated: false });
});

// 2. Project Routes
app.get('/api/projects', (req, res) => {
    db.all(`SELECT * FROM projects`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/projects', isAuthenticated, upload.single('image'), (req, res) => {
    const { title_en, title_ar, category_en, category_ar, desc_en, desc_ar, tools } = req.body;
    const image = req.file ? 'images/' + req.file.filename : '';
    
    db.run(`INSERT INTO projects (title_en, title_ar, category_en, category_ar, desc_en, desc_ar, tools, image) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
        [title_en, title_ar, category_en, category_ar, desc_en, desc_ar, tools, image], 
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/projects/:id', isAuthenticated, upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title_en, title_ar, category_en, category_ar, desc_en, desc_ar, tools } = req.body;
    
    if (req.file) {
        const image = 'images/' + req.file.filename;
        db.run(`UPDATE projects SET title_en=?, title_ar=?, category_en=?, category_ar=?, desc_en=?, desc_ar=?, tools=?, image=? WHERE id=?`,
            [title_en, title_ar, category_en, category_ar, desc_en, desc_ar, tools, image, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    } else {
        db.run(`UPDATE projects SET title_en=?, title_ar=?, category_en=?, category_ar=?, desc_en=?, desc_ar=?, tools=? WHERE id=?`,
            [title_en, title_ar, category_en, category_ar, desc_en, desc_ar, tools, id],
            (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    }
});

app.delete('/api/projects/:id', isAuthenticated, (req, res) => {
    db.run(`DELETE FROM projects WHERE id=?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// Serve frontend static files
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
