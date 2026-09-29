const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const suratController = require('../controllers/suratController');
const db = require('../config/db');
const spjController = require('../controllers/spjController');
const produkHukumController = require('../controllers/produkHukumController');
const workspaceController = require('../controllers/workspaceController');
const arsipController = require('../controllers/arsipController');
const laporanController = require('../controllers/laporanController');
const masterController = require('../controllers/masterController');
const pengaturanController = require('../controllers/pengaturanController');
const bumdesController = require('../controllers/bumdesController');
const searchController = require('../controllers/searchController');
const ac = require('../middleware/access');

const requireAuth = authController.requireAuth;

// Helper count filter per table + desa
const countFiltered = async (tbl, req) => {
    const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
    const did = ac.getDesaId(req);
    let sql = `SELECT COUNT(*) FROM ${tbl} WHERE 1=1`; 
    let p = [];
    if (!isSuper && did) {
        try {
            const testCol = await db.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='kepenghuluan_id' LIMIT 1`,
                [tbl]
            );
            if (testCol.rows.length > 0) { 
                sql += ` AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)`; 
                p.push(did); 
            }
        } catch (e) { /* noop */ }
    } else if (isSuper && did) {
        try {
            const testCol = await db.query(
                `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='kepenghuluan_id' LIMIT 1`,
                [tbl]
            );
            if (testCol.rows.length > 0) { 
                sql += ` AND kepenghuluan_id = $1`; 
                p.push(did); 
            }
        } catch (e) { /* noop */ }
    }
    try { return Number((await db.query(sql, p)).rows[0].count) || 0; } catch (e) { return 0; }
};

const { loginRateLimiter } = require('../middleware/rateLimiter');

// --- Rute Autentikasi ---
router.get('/login', authController.getLogin);
router.post('/login', loginRateLimiter, authController.postLogin);
router.get('/logout', authController.logout);
router.all('/switch-desa', requireAuth, authController.switchDesa);
router.post('/ganti-password', requireAuth, authController.postGantiPassword);

// --- Rute Utama ---
router.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
    }
    res.render('landing', { title: 'SIAD 2.0 - Portal Kepenghuluan', layout: false });
});

// --- Rute Dashboard (100% Real-Time & Dinamis per Desa) ---
router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
        const did = ac.getDesaId(req);
        const isKaurUmumUser = ac.isKaurUmum ? ac.isKaurUmum(req) : false;

        // 1. Dokumen Terarsip per modul (disaring strictly per-desa)
        const suratMasuk = await countFiltered('surat_masuk', req);
        const suratKeluar = await countFiltered('surat_keluar', req);
        const totalSurat = Number(suratMasuk) + Number(suratKeluar);

        let arsipDesa = 0;
        let spjDocCount = 0;
        let produkCount = 0;
        let asetCount = 0;
        let totalDokumen = totalSurat;

        // Jika BUKAN Kaur Umum, hitung modul keuangan, aset, produk hukum, dll
        if (!isKaurUmumUser) {
            arsipDesa = await countFiltered('arsip_desa', req);
            spjDocCount = await countFiltered('spj_dokumen', req);
            produkCount = await countFiltered('produk_hukum', req);
            asetCount = await countFiltered('aset', req);
            totalDokumen += Number(arsipDesa) + Number(spjDocCount) + Number(produkCount) + Number(asetCount);
        }

        // 2. Status SPJ (Belum Lengkap / Menunggu Verifikasi vs Sudah Selesai/Sah) - HANYA jika bukan Kaur Umum
        let belumLengkap = 0;
        let sudahVerifikasi = 0;
        if (!isKaurUmumUser) {
            let spjWhere = 'WHERE 1=1';
            let spjParams = [];
            if (!isSuper && did) {
                spjWhere += ' AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)';
                spjParams.push(did);
            } else if (isSuper && did) {
                spjWhere += ' AND kepenghuluan_id = $1';
                spjParams.push(did);
            }

            try {
                const spjBelum = await db.query(`SELECT COUNT(*) FROM spj_kegiatan ${spjWhere} AND tahap_verifikasi != 'SELESAI_FINAL'`, spjParams);
                const spjSudah = await db.query(`SELECT COUNT(*) FROM spj_kegiatan ${spjWhere} AND tahap_verifikasi = 'SELESAI_FINAL'`, spjParams);
                belumLengkap = Number(spjBelum.rows[0].count) || 0;
                sudahVerifikasi = Number(spjSudah.rows[0].count) || 0;
            } catch(e) {
                console.error('[DASHBOARD:spjStatus]', e.message);
            }
        }

        // 3. Workspace Terkait - HANYA jika bukan Kaur Umum
        let totalWorkspace = 0;
        let workspaces = [];
        if (!isKaurUmumUser) {
            try {
                let baseWs = `
                    SELECT w.*, wt.nama as type_nama, wt.warna as type_warna, wt.icon as type_icon, mk.nama as kepenghuluan_nama
                    FROM workspace w
                    LEFT JOIN workspace_type wt ON w.workspace_type_id = wt.id
                    LEFT JOIN kepenghuluan mk ON w.kepenghuluan_id = mk.id
                    WHERE 1=1`;
                let pWs = [];
                if (!isSuper && did) {
                    baseWs += ` AND (w.kepenghuluan_id = $1)`;
                    pWs.push(did);
                } else if (isSuper && did) {
                    baseWs += ` AND (w.kepenghuluan_id = $1)`;
                    pWs.push(did);
                }
                baseWs += ` ORDER BY w.created_at DESC LIMIT 5`;
                const wsRes = await db.query(baseWs, pWs);
                workspaces = wsRes.rows;

                const wsCountRes = await db.query(`SELECT COUNT(*) FROM workspace ${(!isSuper && did) ? 'WHERE kepenghuluan_id = $1' : (isSuper && did ? 'WHERE kepenghuluan_id = $1' : '')}`, pWs);
                totalWorkspace = Number(wsCountRes.rows[0].count) || 0;
            } catch(e) {
                console.error('[DASHBOARD:workspace]', e.message);
            }
        }

        // 4. Riil Hitung Dokumen per Tahun (2023, 2024, 2025, 2026) dari database
        const tahunList = [2023, 2024, 2025, 2026];
        const chartData = {};
        for (const thn of tahunList) {
            let pThn = [thn];
            let extraFilter = '';
            if (did) {
                pThn.push(did);
                extraFilter = 'AND (kepenghuluan_id = $2 OR kepenghuluan_id IS NULL)';
            }
            try {
                let q = '';
                if (isKaurUmumUser) {
                    q = `
                        SELECT (
                            (SELECT COUNT(*) FROM surat_masuk WHERE EXTRACT(YEAR FROM tanggal_surat) = $1 ${extraFilter}) +
                            (SELECT COUNT(*) FROM surat_keluar WHERE EXTRACT(YEAR FROM tanggal_surat) = $1 ${extraFilter})
                        ) as total
                    `;
                } else {
                    q = `
                        SELECT (
                            (SELECT COUNT(*) FROM spj_kegiatan WHERE tahun = $1 ${extraFilter}) +
                            (SELECT COUNT(*) FROM surat_masuk WHERE EXTRACT(YEAR FROM tanggal_surat) = $1 ${extraFilter}) +
                            (SELECT COUNT(*) FROM surat_keluar WHERE EXTRACT(YEAR FROM tanggal_surat) = $1 ${extraFilter}) +
                            (SELECT COUNT(*) FROM aset WHERE tahun_perolehan = $1 ${extraFilter})
                        ) as total
                    `;
                }
                const r = await db.query(q, pThn);
                chartData[thn] = Number(r.rows[0].total) || 0;
            } catch(e) {
                chartData[thn] = 0;
            }
        }

        const stats = {
            total_workspace: totalWorkspace,
            total_dokumen: totalDokumen,
            surat_masuk: Number(suratMasuk),
            surat_keluar: Number(suratKeluar),
            total_surat: totalSurat,
            belum_lengkap: belumLengkap,
            sudah_verifikasi: sudahVerifikasi,
            chartData: chartData,
            is_kaur_umum: isKaurUmumUser
        };

        res.render('dashboard', { 
            title: 'Dashboard - SIAD 2.0', 
            stats: stats, 
            workspaces: workspaces, 
            chartData: chartData,
            recentActivities: [], 
            kegiatan: [], 
            dokumen: [], 
            arsip: [] 
        });
    } catch(e) {
        console.error('Dashboard error:', e);
        res.render('dashboard', { title: 'Dashboard - SIAD 2.0', stats: null, workspaces: [], chartData: { 2023: 0, 2024: 0, 2025: 0, 2026: 0 }, recentActivities: [], kegiatan: [], dokumen: [], arsip: [] });
    }
});

// === ALAT BANTU UPLOAD & FILE SYSTEM ===
const multer = require('multer');
const path = require('path');
const fs_module = require('fs');

if (!fs_module.existsSync('./public/uploads/spj')) fs_module.mkdirSync('./public/uploads/spj', { recursive: true });
const spjStorage = multer.memoryStorage();
const upload = multer({ storage: spjStorage });


// --- Rute Pencarian Global Lintas Modul ---
router.get('/cari', requireAuth, searchController.getPencarianGlobal);

// --- Rute Modul Surat ---
router.get('/surat', requireAuth, suratController.getIndex);
router.post('/surat/masuk', requireAuth, upload.single('file_surat'), suratController.postSuratMasuk);
router.post('/surat/keluar', requireAuth, upload.single('file_surat'), suratController.postSuratKeluar);
router.post('/surat/delete', requireAuth, suratController.deleteSurat);
router.post('/surat/edit', requireAuth, suratController.editSurat);
router.post('/surat/disposisi', requireAuth, suratController.postDisposisi);
router.get('/surat/disposisi/cetak/:id', requireAuth, suratController.getCetakDisposisi);
router.get('/surat/agenda/cetak', requireAuth, suratController.getCetakAgenda);
router.get('/surat/agenda/excel', requireAuth, suratController.getExportAgendaExcel);

// --- Rute SPJ (GET) ---
router.get('/spj', requireAuth, ac.blockKaurUmum, spjController.getIndex);
router.post('/spj/tambah', requireAuth, ac.blockKaurUmum, spjController.postTambah);
router.post('/spj/edit', requireAuth, ac.blockKaurUmum, spjController.postEdit);
router.post('/spj/delete', requireAuth, ac.blockKaurUmum, spjController.postDelete);
router.post('/spj/verifikasi', requireAuth, ac.blockKaurUmum, spjController.postVerifikasi);
router.get('/spj/cetak-rekap', requireAuth, ac.blockKaurUmum, spjController.getCetakRekapitulasi);
router.get('/spj/cetak/:id', requireAuth, ac.blockKaurUmum, spjController.getCetakVerifikasi);
router.get('/validasi/spj/:id', spjController.getValidasiPublik);

// --- Rute Arsip (GET) ---
router.get('/arsip', requireAuth, ac.blockKaurUmum, arsipController.getIndex);

router.get('/spj/dokumen/:id', requireAuth, ac.blockKaurUmum, spjController.getDokumen);
router.post('/spj/dokumen/upload', requireAuth, ac.blockKaurUmum, upload.single('file_dokumen'), spjController.postUploadDokumen);
router.post('/spj/dokumen/hapus', requireAuth, ac.blockKaurUmum, spjController.postDeleteDokumen);

// --- Rute Foto Dokumentasi Kegiatan SPJ (Multi-Upload) ---
router.post('/spj/foto/upload', requireAuth, ac.blockKaurUmum, upload.array('foto_kegiatan', 10), spjController.postUploadFoto);
router.post('/spj/foto/hapus', requireAuth, ac.blockKaurUmum, spjController.postDeleteFoto);

router.get('/spj/pajak/cetak-buku', requireAuth, ac.blockKaurUmum, spjController.getCetakBukuPajak);
router.get('/spj/pajak/:id', requireAuth, ac.blockKaurUmum, spjController.getPajak);
router.post('/spj/pajak/tambah', requireAuth, ac.blockKaurUmum, upload.single('file_bukti'), spjController.postTambahPajak);
router.post('/spj/pajak/hapus', requireAuth, ac.blockKaurUmum, spjController.postDeletePajak);

if (!fs_module.existsSync('./public/uploads/produk_hukum')) fs_module.mkdirSync('./public/uploads/produk_hukum', { recursive: true });
const phStorage = multer.memoryStorage();
const uploadPH = multer({ storage: phStorage });

router.get('/produk-hukum', requireAuth, ac.blockKaurUmum, produkHukumController.getIndex);
router.post('/produk-hukum/tambah', requireAuth, ac.blockKaurUmum, uploadPH.single('file_pdf'), produkHukumController.postTambah);
router.post('/produk-hukum/edit', requireAuth, ac.blockKaurUmum, uploadPH.single('file_pdf'), produkHukumController.postEdit);
router.post('/produk-hukum/hapus', requireAuth, ac.blockKaurUmum, produkHukumController.postDelete);

// === ARSIP UPLOAD ROUTE ===
router.post('/arsip/upload', requireAuth, ac.blockKaurUmum, upload.single('file'), arsipController.postUpload);

// === WORKSPACE ROUTES ===
router.get('/workspace', requireAuth, ac.blockKaurUmum, workspaceController.getIndex);
router.post('/workspace/tambah', requireAuth, ac.blockKaurUmum, workspaceController.postTambah);
router.post('/workspace/delete', requireAuth, ac.blockKaurUmum, workspaceController.postDelete);
router.get('/workspace/:id', requireAuth, ac.blockKaurUmum, workspaceController.getDetail);
router.post('/workspace/:id/upload', requireAuth, ac.blockKaurUmum, upload.single('file'), workspaceController.postDocument);

// === LAPORAN ROUTES ===
router.get('/laporan', requireAuth, ac.blockKaurUmum, laporanController.getIndex);
router.post('/laporan/upload', requireAuth, ac.blockKaurUmum, upload.single('file_laporan'), laporanController.postUpload);

// === MASTER DATA ROUTES ===
router.get('/master_data', requireAuth, ac.blockKaurUmum, masterController.getIndex);
router.post('/master_data/rekening', requireAuth, ac.blockKaurUmum, masterController.postRekening);
router.post('/master_data/klasifikasi', requireAuth, ac.blockKaurUmum, masterController.postKlasifikasi);
router.post('/master_data/perangkat', requireAuth, ac.blockKaurUmum, upload.single('file_sk'), masterController.postPerangkat);
router.post('/master_data/delete', requireAuth, ac.blockKaurUmum, masterController.deleteData);

// === PENGATURAN ROUTES ===
router.get('/pengaturan', requireAuth, ac.blockKaurUmum, pengaturanController.getIndex);
router.post('/pengaturan/update', requireAuth, ac.blockKaurUmum, pengaturanController.postUpdate);
router.post('/pengaturan/inisialisasi-desa', requireAuth, ac.blockKaurUmum, pengaturanController.postInisialisasiDesa);

// === ASET ROUTES (Modul Aset Desa) ===
router.get('/aset', requireAuth, ac.blockKaurUmum, async (req, res) => {
    try {
        const did = ac.getDesaId(req);
        let sql = `SELECT * FROM aset WHERE 1=1`;
        let p = [];
        if (did) {
            sql += ` AND kepenghuluan_id = $1`;
            p.push(did);
        }
        sql += ` ORDER BY id DESC LIMIT 200`;
        let rows = [];
        try { rows = (await db.query(sql, p)).rows; } catch (e) { rows = []; }
        res.render('aset', { 
            title: 'Inventaris Aset Desa - SIAD 2.0', 
            data: rows,
            status: req.query.status || null,
            error: req.query.error || null
        });
    } catch (e) {
        res.render('aset', { title: 'Inventaris Aset Desa - SIAD 2.0', data: [], status: null, error: e.message });
    }
});

router.post('/aset', requireAuth, ac.blockKaurUmum, async (req, res) => {
    try {
        const did = ac.getDesaId(req);
        const userId = req.session.userId;
        const { nama, merk, tipe, jenis, kondisi, tahun_perolehan, jumlah, satuan, nilai_perolehan, sumber_dana, lokasi, keterangan } = req.body;

        if (!nama || !nama.trim()) {
            return res.redirect('/aset?error=' + encodeURIComponent('Nama aset wajib diisi!'));
        }

        const countRes = await db.query('SELECT COUNT(*) FROM aset WHERE kepenghuluan_id = $1', [did || 1]);
        const seq = (Number(countRes.rows[0].count) || 0) + 1;
        const kodeAset = (req.body.kode && req.body.kode.trim()) ? req.body.kode.trim() : `AST/${did || 'ROHIL'}/${new Date().getFullYear()}/${String(seq).padStart(3, '0')}`;

        let normKondisi = 'baik';
        if (kondisi) {
            const k = String(kondisi).toLowerCase().trim().replace(/[\s-]+/g, '_');
            if (['baik', 'rusak_ringan', 'rusak_berat', 'tidak_dapat_digunakan'].includes(k)) {
                normKondisi = k;
            }
        }

        const jml = Number(jumlah) || 1;
        const nilai = Number(nilai_perolehan) || 0;
        const hargaSatuan = jml > 0 ? Math.round(nilai / jml) : nilai;

        await db.query(`
            INSERT INTO aset (
                kepenghuluan_id, kode, nama, merk, tipe, tahun_perolehan, kondisi,
                jumlah, satuan, harga_satuan, nilai_perolehan, sumber_dana, lokasi, keterangan,
                status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'aktif', $15)
        `, [
            did || 1, kodeAset, nama.trim(), merk || '', tipe || jenis || '',
            Number(tahun_perolehan) || new Date().getFullYear(),
            normKondisi, jml, satuan || 'unit', hargaSatuan, nilai,
            sumber_dana || 'Dana Desa (DDS)', lokasi || 'Kantor Desa',
            keterangan || '', userId
        ]);

        res.redirect('/aset?status=success');
    } catch (e) {
        console.error('[ASET:post]', e);
        res.redirect('/aset?error=' + encodeURIComponent(e.message));
    }
});

router.post('/aset/hapus/:id', requireAuth, ac.blockKaurUmum, async (req, res) => {
    try {
        const id = req.params.id;
        const did = ac.getDesaId(req);
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;

        if (isSuper) {
            await db.query('DELETE FROM aset WHERE id = $1', [id]);
        } else if (did) {
            await db.query('DELETE FROM aset WHERE id = $1 AND kepenghuluan_id = $2', [id, did]);
        }
        res.redirect('/aset?status=deleted');
    } catch (e) {
        console.error('[ASET:hapus]', e);
        res.redirect('/aset?error=' + encodeURIComponent(e.message));
    }
});

// === BUMDes ROUTES (Modul BUMDes Sesuai PP 11/2021) ===
router.get('/bumdes', requireAuth, ac.blockKaurUmum, bumdesController.getIndex);
router.post('/bumdes/profil', requireAuth, ac.blockKaurUmum, upload.single('file_ad_art'), bumdesController.postProfil);
router.post('/bumdes/pengurus', requireAuth, ac.blockKaurUmum, upload.single('file_sk'), bumdesController.postPengurus);
router.post('/bumdes/pengurus/delete', requireAuth, ac.blockKaurUmum, bumdesController.deletePengurus);
router.post('/bumdes/unit-usaha', requireAuth, ac.blockKaurUmum, bumdesController.postUnitUsaha);
router.post('/bumdes/unit-usaha/delete', requireAuth, ac.blockKaurUmum, bumdesController.deleteUnitUsaha);

module.exports = router;

