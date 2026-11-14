const db = require('../config/db');

const isAdmin = (req) => {
    if (!req) return false;
    const u = (req.session && req.session.user) ? req.session.user : (req.user || req);
    if (u.is_admin === true) return true;
    if (u.is_admin === false) return false;
    const roleOrPeran = String((u.peran || u.role || '')).toLowerCase();
    return roleOrPeran.includes('admin') || roleOrPeran.includes('super') || roleOrPeran.includes('auditor');
};

const isSuperAdmin = (req) => {
    if (!isAdmin(req)) return false;
    const u = (req.session && req.session.user) ? req.session.user : (req.user || req);
    const id = u.kepenghuluan_id;
    return id === undefined || id === null;
};

const isAdminDesa = (req) => {
    if (!isAdmin(req)) return false;
    const u = (req.session && req.session.user) ? req.session.user : (req.user || req);
    const id = u.kepenghuluan_id;
    return id !== undefined && id !== null;
};

const getDesaId = (req) => {
    if (!req || !req.session || !req.session.user) return null;
    const u = req.session.user;
    if (isSuperAdmin(req)) {
        return req.session.active_kepenghuluan_id ? Number(req.session.active_kepenghuluan_id) : null;
    }
    const id = u.kepenghuluan_id;
    return (id === undefined || id === null) ? null : Number(id);
};

const getUserRole = (req) => {
    if (!req) return 'guest';
    const u = (req.session && req.session.user) ? req.session.user : (req.user || req);
    if (!u) return 'guest';
    return String(u.role || u.peran || 'operator').toLowerCase();
};

const hasRole = (req, allowedRoles = []) => {
    if (isAdmin(req)) return true;
    const userRole = getUserRole(req);
    return allowedRoles.map(r => r.toLowerCase()).includes(userRole);
};

const getDesaNama = (req, fallback = 'Umum') => {
    if (!req || !req.session || !req.session.user) return fallback;
    const u = req.session.user;
    return u.kepenghuluan || u.desa || fallback;
};

const appendFilter = (sql, params, req, column = 'kepenghuluan_id', paramStart) => {
    const did = getDesaId(req);
    if (did === null || did === undefined) return { sql, params, nextIndex: paramStart };
    const idx = paramStart;
    return {
        sql: sql + ` AND ${column} = $${idx}`,
        params: [...params, did],
        nextIndex: idx + 1
    };
};

const appendWhereOrAnd = (baseWhere, filterSql) => {
    if (!filterSql) return baseWhere;
    if (baseWhere && baseWhere.toUpperCase().includes('WHERE')) {
        return baseWhere + ' ' + filterSql;
    }
    return ' WHERE ' + filterSql.replace(/^AND\s+/i, '');
};

const forceDesaIdInsert = (req, obj = {}) => {
    if (isSuperAdmin(req)) return obj;
    const did = getDesaId(req);
    if (did !== null && did !== undefined) {
        obj.kepenghuluan_id = did;
    }
    return obj;
};

const canAccessDesa = (req, targetDesaId) => {
    if (!req || !req.session || !req.session.user) return false;
    if (isSuperAdmin(req)) return true;
    const did = req.session.user.kepenghuluan_id;
    if (!did) return false;
    if (targetDesaId === null || targetDesaId === undefined) return false;
    return Number(did) === Number(targetDesaId);
};

const buildTenantFilter = (req, columnName = 'kepenghuluan_id', paramIndex = 1) => {
    const isSuper = isSuperAdmin(req);
    const did = getDesaId(req);
    if (isSuper) {
        if (did) {
            return {
                sql: ` AND ${columnName} = $${paramIndex}`,
                params: [did],
                nextIndex: paramIndex + 1
            };
        }
        return { sql: '', params: [], nextIndex: paramIndex };
    }
    if (did) {
        return {
            sql: ` AND ${columnName} = $${paramIndex}`,
            params: [did],
            nextIndex: paramIndex + 1
        };
    }
    return {
        sql: ` AND ${columnName} IS NULL`,
        params: [],
        nextIndex: paramIndex
    };
};

const listKepForSelect = async (req) => {
    try {
        if (isSuperAdmin(req)) {
            const r = await db.query(
                `SELECT k.id, k.nama, kec.nama AS kecamatan_nama
                 FROM kepenghuluan k 
                 LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                 ORDER BY kec.nama ASC, k.nama ASC`
            );
            return r.rows;
        }
        const did = getDesaId(req);
        if (!did) return [];
        const r = await db.query(
            `SELECT k.id, k.nama, kec.nama AS kecamatan_nama
             FROM kepenghuluan k 
             LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
             WHERE k.id = $1
             LIMIT 1`,
            [did]
        );
        return r.rows;
    } catch (e) {
        console.error('listKepForSelect error:', e.message);
        return [];
    }
};

// ========================================================
// ROLE CHECKERS UNTUK APARATUR DESA
// ========================================================
const isPimpinanOrSekdes = (req) => {
    const r = getUserRole(req);
    return r.includes('penghulu') || r.includes('pimpinan') || r.includes('kades') || r.includes('sekretaris') || r.includes('sekdes');
};

const isKeuangan = (req) => {
    const r = getUserRole(req);
    return r.includes('bendahara') || r === 'kaur' || r.includes('keuangan') || r.includes('operator');
};

const isKaurUmum = (req) => {
    const r = getUserRole(req);
    return r === 'kaur_umum' || r.includes('kaur_umum') || r.includes('kaur umum') || r.includes('tata usaha');
};

const isAset = (req) => {
    const r = getUserRole(req);
    return r.includes('aset') || r.includes('pengelola_aset');
};

// Generic Role-Guard Generator
const requireRoleAccess = (allowedChecks, moduleName) => {
    return (req, res, next) => {
        // Admin Kabupaten & Admin Desa selalu punya akses bypass untuk manajemen & inspeksi
        if (isAdmin(req)) return next();

        const user = req.session && req.session.user;
        if (!user) {
            return res.redirect('/login');
        }

        // Cek apakah user memenuhi minimal salah satu syarat
        let granted = false;
        for (const check of allowedChecks) {
            if (typeof check === 'function' && check(req)) {
                granted = true;
                break;
            }
        }

        if (granted) return next();

        // Tentukan fallback URL yang paling sesuai dengan tugas user
        let targetFallback = '/dashboard';
        if (isKeuangan(req)) {
            targetFallback = '/spj';
        } else if (isKaurUmum(req)) {
            targetFallback = '/surat?tab=masuk';
        } else if (isAset(req)) {
            targetFallback = '/aset';
        } else if (isPimpinanOrSekdes(req)) {
            targetFallback = '/dashboard';
        }

        const jabatanNama = (user.peran || user.role || 'Aparatur').toUpperCase();
        const pesan = `Akses Ditolak: Akun Anda (${jabatanNama}) tidak memiliki wewenang untuk mengakses ${moduleName}. Silakan gunakan akun yang berwenang.`;

        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(403).json({ error: pesan });
        }

        const separator = targetFallback.includes('?') ? '&' : '?';
        return res.redirect(`${targetFallback}${separator}error=${encodeURIComponent(pesan)}`);
    };
};

// ========================================================
// MIDDLEWARE GUARDS PER MODUL
// ========================================================

// 1. Persuratan: Admin, Pimpinan, Sekdes, Kaur Umum
const requireSurat = requireRoleAccess([isPimpinanOrSekdes, isKaurUmum], 'Modul Persuratan (Tata Naskah Dinas)');

// 2. Resepsionis: Admin, Pimpinan, Sekdes, Kaur Umum
const requireResepsionis = requireRoleAccess([isPimpinanOrSekdes, isKaurUmum], 'Modul Resepsionis & Buku Tamu');

// 3. Keuangan & SPJ: Admin, Pimpinan, Sekdes, Bendahara, Kaur Keuangan
const requireKeuangan = requireRoleAccess([isPimpinanOrSekdes, isKeuangan], 'Modul Keuangan & SPJ');

// 4. Pajak PBB-P2: Admin, Pimpinan, Sekdes, Bendahara, Kaur Keuangan
const requirePbb = requireRoleAccess([isPimpinanOrSekdes, isKeuangan], 'Modul Perpajakan PBB-P2');

// 5. Bantuan Sosial: Admin, Pimpinan, Sekdes, Kaur Umum
const requireBansos = requireRoleAccess([isPimpinanOrSekdes, isKaurUmum], 'Modul Bantuan Sosial (Bansos & BLT-DD)');

// 6. Aset: Admin, Pimpinan, Sekdes, Pengelola Aset
const requireAset = requireRoleAccess([isPimpinanOrSekdes, isAset], 'Modul Aset Kepenghuluan');

// 7. Produk Hukum: Admin, Pimpinan, Sekdes, Kaur Umum
const requireProdukHukum = requireRoleAccess([isPimpinanOrSekdes, isKaurUmum], 'Modul Produk Hukum (Perdes & SK)');

// 8. BUMDes: Admin, Pimpinan, Sekdes
const requireBumdes = requireRoleAccess([isPimpinanOrSekdes], 'Modul Pengawasan BUMDes');

// 9. Musdes: Admin, Pimpinan, Sekdes, Kaur Umum
const requireMusdes = requireRoleAccess([isPimpinanOrSekdes, isKaurUmum], 'Modul Musyawarah Desa');

// 10. Arsip Vital: Admin, Pimpinan, Sekdes
const requireArsip = requireRoleAccess([isPimpinanOrSekdes], 'Modul Arsip Dokumen Vital');

// 11. Laporan: Admin, Pimpinan, Sekdes, Bendahara, Pengelola Aset
const requireLaporan = requireRoleAccess([isPimpinanOrSekdes, isKeuangan, isAset], 'Modul Laporan & Rekapitulasi');

// 12. Master Data & Pengaturan: Hanya Administrator (Admin Desa & Admin Kabupaten)
const requireAdmin = (req, res, next) => {
    if (isAdmin(req)) return next();
    const pesan = 'Akses Ditolak: Halaman ini hanya diperuntukkan bagi Administrator Sistem.';
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(403).json({ error: pesan });
    }
    return res.redirect('/dashboard?error=' + encodeURIComponent(pesan));
};

// Legacy compatibility
const blockKaurUmum = requireRoleAccess([isPimpinanOrSekdes, isKeuangan, isAset], 'Modul Terbatas');

module.exports = {
    isAdmin,
    isSuperAdmin,
    isAdminDesa,
    getDesaId,
    getUserRole,
    isPimpinanOrSekdes,
    isKeuangan,
    isKaurUmum,
    isAset,
    blockKaurUmum,
    requireRoleAccess,
    requireSurat,
    requireResepsionis,
    requireKeuangan,
    requirePbb,
    requireBansos,
    requireAset,
    requireProdukHukum,
    requireBumdes,
    requireMusdes,
    requireArsip,
    requireLaporan,
    requireAdmin,
    hasRole,
    getDesaNama,
    appendFilter,
    appendWhereOrAnd,
    forceDesaIdInsert,
    canAccessDesa,
    buildTenantFilter,
    listKepForSelect
};
