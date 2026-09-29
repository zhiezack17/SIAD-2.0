const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./config/db'); // Load DB Pool
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Reverse Proxy Configuration (Nginx / Cloudflare)
app.set('trust proxy', 1);

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Middleware
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: function (res, filePath) {
    if (/\\.css$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
    } else if (/\\.js$/i.test(filePath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
    } else if (/\\.png$/i.test(filePath) || /\\.jpg$/i.test(filePath) || /\\.ico$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
  etag: false,
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Middleware
app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'siad2026_super_secret_rohil_v2_kl7tbdath5r',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        sameSite: 'lax',
        maxAge: (Number(process.env.SESSION_MAX_AGE_DAYS) || 30) * 24 * 60 * 60 * 1000 
    }
}));

const ac = require('./middleware/access');

// Make user & active tenant available in all templates
app.use(async (req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.userRole = ac.getUserRole(req);
    res.locals.activeDesaId = req.session.active_kepenghuluan_id || (req.session.user ? req.session.user.kepenghuluan_id : null);
    
    // Khusus Super Admin / Auditor: sediakan daftar desa untuk switcher
    if (req.session && req.session.user && ac.isAdmin(req)) {
        try {
            res.locals.kepList = await ac.listKepForSelect(req);
        } catch (e) {
            res.locals.kepList = [];
        }
    } else {
        res.locals.kepList = [];
    }
    next();
});

// Routes
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);


// 404 Handler
app.use((req, res) => {
    res.status(404).render('404', { title: 'Halaman Tidak Ditemukan' });
});

app.listen(PORT, () => {
    console.log(`🚀 SIAD 2.0 Server running on http://localhost:${PORT}`);
});
