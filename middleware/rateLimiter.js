/**
 * In-memory sliding rate limiter untuk proteksi endpoint autentikasi / login
 * Mencegah serangan brute-force credential stuffing.
 */

const loginAttempts = new Map();

// Pembersihan otomatis data usang setiap 30 menit
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of loginAttempts.entries()) {
        if (now - data.lastAttempt > 30 * 60 * 1000) {
            loginAttempts.delete(ip);
        }
    }
}, 30 * 60 * 1000);

const WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_ATTEMPTS = 5; // Maksimal 5 percobaan gagal
const BLOCK_MS = 15 * 60 * 1000; // Blokir selama 15 menit jika melebihi batas

const loginRateLimiter = (req, res, next) => {
    // Ambil IP klien dengan dukungan trust proxy
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = loginAttempts.get(ip);

    if (record) {
        // Cek jika sedang dalam masa blokir
        if (record.blockedUntil && now < record.blockedUntil) {
            const sisaMenit = Math.ceil((record.blockedUntil - now) / 60000);
            return res.status(429).render('login', {
                title: 'Masuk Sistem - SIAD 2.0',
                error: `Terlalu banyak percobaan masuk yang gagal dari perangkat Anda. Silakan coba lagi setelah ${sisaMenit} menit demi keamanan akun Anda.`,
                layout: false
            });
        }

        // Reset jika window waktu telah lewat
        if (now - record.firstAttempt > WINDOW_MS) {
            loginAttempts.set(ip, { count: 0, firstAttempt: now, lastAttempt: now, blockedUntil: 0 });
        }
    }

    next();
};

// Fungsi pencatat kegagalan login
const recordFailedLogin = (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = loginAttempts.get(ip);

    if (!record || (now - record.firstAttempt > WINDOW_MS)) {
        record = { count: 1, firstAttempt: now, lastAttempt: now, blockedUntil: 0 };
    } else {
        record.count += 1;
        record.lastAttempt = now;
        if (record.count >= MAX_ATTEMPTS) {
            record.blockedUntil = now + BLOCK_MS;
            console.warn(`[RATE_LIMIT] IP ${ip} diblokir sementara karena ${record.count} kali gagal login berturut-turut.`);
        }
    }
    loginAttempts.set(ip, record);
};

// Fungsi pembersih jika berhasil login
const recordSuccessfulLogin = (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress || 'unknown';
    loginAttempts.delete(ip);
};

module.exports = {
    loginRateLimiter,
    recordFailedLogin,
    recordSuccessfulLogin
};
