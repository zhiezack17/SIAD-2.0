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

// Trust Proxy for HTTPS behind Nginx reverse proxy
app.set('trust proxy', 1);

// Validate Session Secret in Production
const isProd = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
if (isProd && !sessionSecret) {
    console.error('❌ FATAL SECURITY ERROR: Environment variable SESSION_SECRET wajib disetel di mode production!');
    process.exit(1);
}

// Session Middleware
app.use(session({
    store: new pgSession({
        pool: db.pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    }),
    secret: sessionSecret || 'siad2026_dev_fallback_secret_must_set_env',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        httpOnly: true,
        secure: isProd || process.env.COOKIE_SECURE === 'true',
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

// Global 500 Error Handler to prevent blank white screens
app.use((err, req, res, next) => {
    console.error('❌ Unhandled Server Error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).render('500', { 
        title: 'Terjadi Kendala Sistem - SIAD 2.0',
        error: process.env.NODE_ENV === 'production' 
            ? 'Sistem mendeteksi kendala sementara saat memuat data. Silakan muat ulang halaman atau kembali ke Dashboard.' 
            : err.message
    }, (renderErr, html) => {
        if (renderErr) {
            return res.status(500).send(`
                <div style="font-family:sans-serif;padding:40px;max-width:600px;margin:50px auto;border:1px solid #fecaca;background:#fff5f5;border-radius:12px;text-align:center;">
                    <h2 style="color:#dc2626;margin-bottom:10px;">💥 Terjadi Kendala Sistem (500)</h2>
                    <p style="color:#475569;font-size:14px;line-height:1.6;">Sistem mendeteksi kendala saat memproses halaman ini. Data Anda tetap aman.</p>
                    <a href="/dashboard" style="display:inline-block;margin-top:15px;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Kembali ke Dashboard</a>
                </div>
            `);
        }
        res.send(html);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 SIAD 2.0 Server running on http://localhost:${PORT}`);
});
