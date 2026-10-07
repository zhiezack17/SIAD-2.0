const db = require('../config/db');

const isAdmin = (req) => {
    if (!req || !req.session || !req.session.user) return false;
    const u = req.session.user;
    if (u.is_admin === true) return true;
    if (u.is_admin === false) return false;
    const roleOrPeran = String((u.peran || u.role || '')).toLowerCase();
    return roleOrPeran.includes('admin') || roleOrPeran.includes('super') || roleOrPeran.includes('auditor');
};

const isSuperAdmin = (req) => {
    if (!isAdmin(req)) return false;
    const u = req.session.user;
    const id = u.kepenghuluan_id;
    return id === undefined || id === null;
};

const isAdminDesa = (req) => {
    if (!isAdmin(req)) return false;
    const u = req.session.user;
    const id = u.kepenghuluan_id;
    return id !== undefined && id !== null;
};

const getDesaId = (req) => {
    if (!req || !req.session || !req.session.user) return null;
    const u = req.session.user;
    // Jika Super Admin Kabupaten sedang menginspeksi desa tertentu melalui dropdown switcher
    if (isSuperAdmin(req)) {
        return req.session.active_kepenghuluan_id ? Number(req.session.active_kepenghuluan_id) : null;
    }
    // Jika Admin Desa atau Perangkat Desa, selalu kembalikan kepenghuluan_id mereka
    const id = u.kepenghuluan_id;
    return (id === undefined || id === null) ? null : Number(id);
};

const getUserRole = (req) => {
    if (!req || !req.session || !req.session.user) return 'guest';
    const u = req.session.user;
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
    // Non-superadmin (Admin Desa & Perangkat) SELALU dikunci ke desa miliknya
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

const isKaurUmum = (req) => {
    const r = getUserRole(req);
    return r === 'kaur_umum' || r === 'kaur umum';
};

const blockKaurUmum = (req, res, next) => {
    if (isKaurUmum(req)) {
        if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
            return res.status(403).json({ 
                error: 'Akses Ditolak: Akun Kaur Umum hanya berwenang mengelola Modul Persuratan.' 
            });
        }
        return res.redirect('/surat?tab=masuk&error=' + encodeURIComponent('Akses Ditolak: Akun Kaur Umum hanya berwenang mengelola Modul Persuratan demi menjaga kerahasiaan data keuangan & aset kepenghuluan.'));
    }
    next();
};

module.exports = {
    isAdmin,
    isSuperAdmin,
    isAdminDesa,
    getDesaId,
    getUserRole,
    isKaurUmum,
    blockKaurUmum,
    hasRole,
    getDesaNama,
    appendFilter,
    appendWhereOrAnd,
    forceDesaIdInsert,
    canAccessDesa,
    buildTenantFilter,
    listKepForSelect
};
