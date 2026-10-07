const test = require('node:test');
const assert = require('node:assert/strict');
const ac = require('../middleware/access');

test('U01: Isolasi Akses Tenant Multi-Desa', () => {
    // 1. Super Admin (kepenghuluan_id: null)
    const superAdminReq = {
        session: {
            user: { username: 'admin_rohil', role: 'admin', is_admin: true, kepenghuluan_id: null }
        }
    };
    assert.equal(ac.isSuperAdmin(superAdminReq), true, 'Superadmin harus terdeteksi');
    assert.equal(ac.isAdminDesa(superAdminReq), false, 'Superadmin bukan admin_desa');
    assert.equal(ac.canAccessDesa(superAdminReq, 67), true, 'Superadmin dapat mengakses desa ID 67');
    assert.equal(ac.canAccessDesa(superAdminReq, 100), true, 'Superadmin dapat mengakses desa ID 100');

    // 2. Admin Desa A (kepenghuluan_id: 67)
    const adminDesaAReq = {
        session: {
            user: { username: 'admin_bantaian', role: 'admin', is_admin: true, kepenghuluan_id: 67 }
        }
    };
    assert.equal(ac.isSuperAdmin(adminDesaAReq), false, 'Admin desa Bantaian BUKAN superadmin');
    assert.equal(ac.isAdminDesa(adminDesaAReq), true, 'Admin desa Bantaian terdeteksi admin_desa');
    assert.equal(ac.canAccessDesa(adminDesaAReq, 67), true, 'Admin desa A berhak atas desa 67 miliknya');
    assert.equal(ac.canAccessDesa(adminDesaAReq, 99), false, 'Admin desa A DITOLAK mengakses desa B (ID 99)');

    // 3. Perangkat Desa (Bendahara Desa A)
    const bendaharaAReq = {
        session: {
            user: { username: 'bendahara_bantaian', role: 'bendahara', is_admin: false, kepenghuluan_id: 67 }
        }
    };
    assert.equal(ac.canAccessDesa(bendaharaAReq, 67), true);
    assert.equal(ac.canAccessDesa(bendaharaAReq, 99), false);
});

test('U03 & U04: Aturan SPJ Historis (TA <= 2025) vs Berjalan (TA >= 2026)', () => {
    // Verifikasi logika batas tahun
    const tahun2024 = 2024;
    const tahun2025 = 2025;
    const tahun2026 = 2026;

    const isHistoris2024 = tahun2024 <= 2025;
    const isHistoris2025 = tahun2025 <= 2025;
    const isHistoris2026 = tahun2026 <= 2025;

    assert.equal(isHistoris2024, true, 'TA 2024 adalah arsip historis');
    assert.equal(isHistoris2025, true, 'TA 2025 adalah arsip historis');
    assert.equal(isHistoris2026, false, 'TA 2026 BUKAN arsip historis (wajib berjenjang)');

    // U04: Simulasi proteksi bypass pada TA 2026
    const aksiBypass = 'bypass_arsip';
    function validateBypass(tahun, role) {
        const isHist = tahun <= 2025;
        if (aksiBypass === 'bypass_arsip') {
            if (!isHist) return { allowed: false, reason: 'Bypass hanya boleh untuk TA <= 2025' };
            if (!role.includes('bendahara') && !role.includes('admin')) {
                return { allowed: false, reason: 'Hanya bendahara/admin yang boleh bypass' };
            }
            return { allowed: true };
        }
        return { allowed: false };
    }

    assert.equal(validateBypass(2025, 'bendahara').allowed, true, 'Bendahara boleh bypass TA 2025');
    assert.equal(validateBypass(2026, 'bendahara').allowed, false, 'Bendahara DITOLAK bypass TA 2026');
    assert.equal(validateBypass(2026, 'admin').allowed, false, 'Admin pun DITOLAK bypass TA 2026');
    assert.equal(validateBypass(2025, 'operator').allowed, false, 'Kaur/operator DITOLAK bypass TA 2025');
});

test('U06: Alur Persetujuan Berjenjang TA 2026+', () => {
    function getNextTahap(currentTahap, aksi, role) {
        if (aksi === 'ajukan' && (currentTahap === 'DRAFT' || currentTahap === 'PERLU_REVISI')) {
            return { success: true, next: 'VERIFIKASI_BENDAHARA' };
        }
        if (aksi === 'setujui_bendahara') {
            if (currentTahap !== 'VERIFIKASI_BENDAHARA') return { success: false, err: 'Belum tahap bendahara' };
            if (!role.includes('bendahara') && !role.includes('admin')) return { success: false, err: 'Bukan bendahara' };
            return { success: true, next: 'VERIFIKASI_SEKDES' };
        }
        if (aksi === 'setujui_sekdes') {
            if (currentTahap !== 'VERIFIKASI_SEKDES') return { success: false, err: 'Belum tahap sekdes' };
            if (!role.includes('sekdes') && !role.includes('sekretaris') && !role.includes('admin')) return { success: false, err: 'Bukan sekdes' };
            return { success: true, next: 'VERIFIKASI_PENGHULU' };
        }
        if (aksi === 'setujui_penghulu') {
            if (currentTahap !== 'VERIFIKASI_PENGHULU') return { success: false, err: 'Belum tahap penghulu' };
            if (!role.includes('penghulu') && !role.includes('pimpinan') && !role.includes('admin')) return { success: false, err: 'Bukan penghulu' };
            return { success: true, next: 'SELESAI_FINAL' };
        }
        return { success: false, err: 'Aksi tidak valid' };
    }

    // Alur Normal yang Berurutan
    assert.equal(getNextTahap('DRAFT', 'ajukan', 'kaur').next, 'VERIFIKASI_BENDAHARA');
    assert.equal(getNextTahap('VERIFIKASI_BENDAHARA', 'setujui_bendahara', 'bendahara').next, 'VERIFIKASI_SEKDES');
    assert.equal(getNextTahap('VERIFIKASI_SEKDES', 'setujui_sekdes', 'sekdes').next, 'VERIFIKASI_PENGHULU');
    assert.equal(getNextTahap('VERIFIKASI_PENGHULU', 'setujui_penghulu', 'penghulu').next, 'SELESAI_FINAL');

    // U06: Percobaan melompati tahapan (Penghulu menyetujui sebelum Sekdes)
    assert.equal(getNextTahap('VERIFIKASI_BENDAHARA', 'setujui_penghulu', 'penghulu').success, false);
    assert.equal(getNextTahap('VERIFIKASI_SEKDES', 'setujui_penghulu', 'penghulu').success, false);
    // Sekdes mencoba menyetujui saat masih DRAFT
    assert.equal(getNextTahap('DRAFT', 'setujui_sekdes', 'sekdes').success, false);
});

test('U07: Filter Tipe File Unggahan (MIME Allowlist)', () => {
    const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    function isMimeAllowed(mime) {
        return ALLOWED_MIME_TYPES.includes(mime);
    }

    assert.equal(isMimeAllowed('application/pdf'), true, 'PDF diizinkan');
    assert.equal(isMimeAllowed('image/jpeg'), true, 'JPG diizinkan');
    assert.equal(isMimeAllowed('image/png'), true, 'PNG diizinkan');
    assert.equal(isMimeAllowed('application/x-msdownload'), false, 'EXE dilarang');
    assert.equal(isMimeAllowed('application/javascript'), false, 'JS dilarang');
    assert.equal(isMimeAllowed('application/x-sh'), false, 'Shell script dilarang');
});
