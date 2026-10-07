const db = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { recordFailedLogin, recordSuccessfulLogin } = require('../middleware/rateLimiter');

const isAdmin = (user) => {
    if (!user) return false;
    const roleOrPeran = String((user.peran || user.role || '')).toLowerCase();
    return roleOrPeran.includes('admin') || roleOrPeran.includes('super') || roleOrPeran.includes('auditor');
};

const authController = {
    getLogin: (req, res) => {
        if (req.session && req.session.userId) {
            return res.redirect('/dashboard');
        }
        res.render('login', { title: 'Masuk Sistem - SIAD 2.0', error: false, layout: false });
    },

    postLogin: async (req, res) => {
        const { username, password } = req.body;
        try {
            if (!username || !password) {
                return res.render('login', { title: 'Masuk Sistem - SIAD 2.0', error: 'Username dan password wajib diisi.', layout: false });
            }

            const result = await db.query(
                `SELECT p.*, k.nama AS kepenghuluan_nama, k.id AS _kep_id_check
                 FROM pengguna p 
                 LEFT JOIN kepenghuluan k ON p.kepenghuluan_id = k.id 
                 WHERE LOWER(p.username) = LOWER($1) OR LOWER(p.email) = LOWER($1)
                 LIMIT 1`,
                [username.trim()]
            );

            if (result.rows.length > 0) {
                const user = result.rows[0];

                // Cek status aktif akun
                if (user.aktif === false || (user.status && String(user.status).toUpperCase() === 'NONAKTIF')) {
                    recordFailedLogin(req);
                    return res.render('login', { 
                        title: 'Masuk Sistem - SIAD 2.0', 
                        error: 'Akun Anda sedang dinonaktifkan. Silakan hubungi Administrator.', 
                        layout: false 
                    });
                }

                const dbPassword = user.password_hash || user.password || '';
                let isValid = false;

                // 1. Coba verifikasi dengan bcrypt
                if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
                    try {
                        isValid = await bcrypt.compare(password, dbPassword);
                    } catch (e) {
                        isValid = false;
                    }
                }

                // 2. Fallback transisi: MD5 atau Plain-Text (otomatis upgrade ke bcrypt)
                if (!isValid) {
                    const md5Password = crypto.createHash('md5').update(password).digest('hex');
                    if (dbPassword === password || dbPassword === md5Password) {
                        isValid = true;
                        // Upgrade otomatis ke bcrypt di database
                        try {
                            const newHash = await bcrypt.hash(password, 10);
                            const pwdCol = user.password_hash !== undefined ? 'password_hash' : 'password';
                            await db.query(`UPDATE pengguna SET ${pwdCol} = $1 WHERE id = $2`, [newHash, user.id]);
                            console.log(`[AUTH] Password untuk user ${user.username} berhasil di-upgrade ke bcrypt.`);
                        } catch (upgradeErr) {
                            console.error('[AUTH] Gagal meng-upgrade hash password:', upgradeErr.message);
                        }
                    }
                }

                if (isValid) {
                    recordSuccessfulLogin(req);

                    const rolePeran = user.role || user.peran || 'operator';
                    const isUserAdmin = isAdmin({ peran: rolePeran, role: rolePeran });
                    const isSuperAdmin = isUserAdmin && (user.kepenghuluan_id === null || user.kepenghuluan_id === undefined);
                    const isAdminDesa = isUserAdmin && (user.kepenghuluan_id !== null && user.kepenghuluan_id !== undefined);

                    const sessionUserData = {
                        id: user.id,
                        nama: user.nama_lengkap || user.nama || user.username || 'Staf',
                        username: user.username,
                        peran: String(rolePeran).toUpperCase(),
                        role: String(rolePeran).toLowerCase(),
                        email: user.email || '',
                        kepenghuluan_id: user.kepenghuluan_id ? Number(user.kepenghuluan_id) : null,
                        kepenghuluan: user.kepenghuluan_nama || null,
                        desa: user.kepenghuluan_nama || null,
                        is_admin: isUserAdmin,
                        is_super_admin: isSuperAdmin,
                        is_admin_desa: isAdminDesa,
                        wajib_ganti_password: user.wajib_ganti_password === true
                    };

                    // Regenerate session ID untuk mencegah serangan session fixation
                    return req.session.regenerate((err) => {
                        if (err) {
                            console.error('[AUTH:regenerate]', err);
                        }
                        req.session.userId = user.id;
                        req.session.user = sessionUserData;
                        req.session.save(() => {
                            return res.redirect('/dashboard');
                        });
                    });
                }
            }

            recordFailedLogin(req);
            return res.render('login', { title: 'Masuk Sistem - SIAD 2.0', error: 'Username atau password salah!', layout: false });

        } catch (error) {
            console.error('Error saat verifikasi Login:', error);
            return res.render('login', { title: 'Masuk Sistem - SIAD 2.0', error: 'Terjadi gangguan koneksi ke database: ' + (error.message || ''), layout: false });
        }
    },

    logout: (req, res) => {
        req.session.destroy((err) => {
            if (err) console.error('Error saat logout:', err);
            res.redirect('/login');
        });
    },

    postGantiPassword: async (req, res) => {
        try {
            if (!req.session || !req.session.user || !req.session.userId) {
                return res.status(401).json({ success: false, message: 'Sesi Anda telah berakhir, silakan login kembali.' });
            }

            const { password_lama, password_baru, konfirmasi_password } = req.body;
            const userId = req.session.userId;

            if (!password_lama || !password_baru || !konfirmasi_password) {
                return res.status(400).json({ success: false, message: 'Semua kolom kata sandi wajib diisi!' });
            }

            if (password_baru.length < 6) {
                return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 6 karakter!' });
            }

            if (password_baru !== konfirmasi_password) {
                return res.status(400).json({ success: false, message: 'Konfirmasi kata sandi baru tidak cocok!' });
            }

            const userRes = await db.query('SELECT id, username, password FROM pengguna WHERE id = $1 LIMIT 1', [userId]);
            if (userRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
            }

            const dbPassword = userRes.rows[0].password || '';
            let isOldValid = false;

            if (dbPassword.startsWith('$2a$') || dbPassword.startsWith('$2b$')) {
                isOldValid = await bcrypt.compare(password_lama, dbPassword);
            } else {
                const md5Password = crypto.createHash('md5').update(password_lama).digest('hex');
                isOldValid = (dbPassword === password_lama || dbPassword === md5Password);
            }

            if (!isOldValid) {
                return res.status(400).json({ success: false, message: 'Kata sandi saat ini (lama) tidak sesuai!' });
            }

            const newHash = await bcrypt.hash(password_baru, 10);
            await db.query('UPDATE pengguna SET password = $1, wajib_ganti_password = false WHERE id = $2', [newHash, userId]);

            if (req.session.user) {
                req.session.user.wajib_ganti_password = false;
            }

            return res.json({ 
                success: true, 
                message: 'Kata sandi berhasil diperbarui! Silakan gunakan kata sandi baru Anda untuk akses berikutnya.' 
            });
        } catch (error) {
            console.error('[AUTH:gantiPassword]', error);
            return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat memperbarui kata sandi: ' + error.message });
        }
    },

    requireAuth: async (req, res, next) => {
        if (req.session && req.session.userId && req.session.user) {
            try {
                const userCheck = await db.query(
                    'SELECT id, aktif, status, kepenghuluan_id, role, peran FROM pengguna WHERE id = $1 LIMIT 1',
                    [req.session.userId]
                );
                if (userCheck.rows.length === 0 || userCheck.rows[0].aktif === false || (userCheck.rows[0].status && String(userCheck.rows[0].status).toUpperCase() === 'NONAKTIF')) {
                    req.session.destroy(() => {});
                    return res.redirect('/login?error=' + encodeURIComponent('Sesi berakhir: Akun Anda sedang dinonaktifkan atau telah dihapus.'));
                }
                const liveUser = userCheck.rows[0];
                req.session.user.kepenghuluan_id = liveUser.kepenghuluan_id;
                req.session.user.role = liveUser.role;
                req.session.user.peran = liveUser.peran;
            } catch (errDb) {
                console.warn('[AUTH:requireAuth DB check warning]', errDb.message);
            }

            const u = req.session.user;
            u.is_admin = isAdmin(u); 
            u.is_super_admin = u.is_admin && (u.kepenghuluan_id === null || u.kepenghuluan_id === undefined);
            u.is_admin_desa = u.is_admin && (u.kepenghuluan_id !== null && u.kepenghuluan_id !== undefined);

            res.locals.user = req.session.user;
            res.locals.activeDesaId = req.session.active_kepenghuluan_id || u.kepenghuluan_id;
            return next();
        }
        res.redirect('/login');
    },

    // Endpoint untuk ganti desa aktif khusus Super Admin / Auditor
    switchDesa: (req, res) => {
        if (!req.session || !req.session.user || !req.session.user.is_admin) {
            return res.status(403).json({ error: 'Akses ditolak' });
        }
        const kepId = req.body?.kepenghuluan_id || req.body?.did || req.query?.kepenghuluan_id || req.query?.did;
        if (!kepId || kepId === 'all') {
            req.session.active_kepenghuluan_id = null;
        } else {
            req.session.active_kepenghuluan_id = Number(kepId);
        }
        res.redirect(req.get('Referrer') || '/dashboard');
    },

    _isAdmin: isAdmin
};
module.exports = authController;