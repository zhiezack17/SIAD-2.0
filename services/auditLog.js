const db = require('../config/db');

// Inisialisasi tabel audit_logs otomatis jika belum ada
let tableInitialized = false;
async function initAuditTable() {
    if (tableInitialized) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                user_id INT,
                username VARCHAR(100),
                kepenghuluan_id INT,
                action VARCHAR(100),
                entity VARCHAR(100),
                record_id VARCHAR(100),
                details TEXT,
                ip_address VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_kepenghuluan ON audit_logs(kepenghuluan_id);
        `);
        tableInitialized = true;
    } catch (err) {
        console.warn('[AUDIT_INIT_WARN]', err.message);
    }
}

// Jalankan inisialisasi tabel saat pertama kali modul di-load
initAuditTable();

/**
 * Catat aktivitas pengguna ke database (Audit Trail - SEC-11)
 * @param {Object} req - Express request object
 * @param {Object} data - { action, entity, recordId, details }
 */
async function recordAudit(req, { action, entity, recordId, details }) {
    try {
        await initAuditTable();
        const u = (req && req.session && req.session.user) ? req.session.user : {};
        const userId = (req && req.session && req.session.userId) ? req.session.userId : (u.id || null);
        const username = u.username || 'System/Guest';
        const kepId = u.kepenghuluan_id || (req && req.session && req.session.active_kepenghuluan_id) || null;
        
        let ip = '-';
        if (req) {
            ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '-';
            if (typeof ip === 'string' && ip.includes(',')) {
                ip = ip.split(',')[0].trim();
            }
        }

        await db.query(`
            INSERT INTO audit_logs (user_id, username, kepenghuluan_id, action, entity, record_id, details, ip_address)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            userId, 
            username, 
            kepId, 
            action ? action.toUpperCase() : 'UNKNOWN', 
            entity || '-', 
            recordId ? String(recordId) : '-', 
            details ? String(details) : '', 
            ip
        ]);
    } catch (err) {
        console.warn('[AUDIT_RECORD_WARN]', err.message);
    }
}

module.exports = {
    recordAudit,
    initAuditTable
};
