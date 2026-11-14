const db = require('../config/db');
const ac = require('../middleware/access');

exports.getPortal = async (req, res) => {
    try {
        const user = req.session && req.session.user ? req.session.user : null;
        const did = ac.getDesaId(req);
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;

        // Ambil data kepenghuluan aktif
        let kepInfo = {
            id: did || 1,
            nama: 'Bantaian Baru',
            kecamatan: 'Batu Hampar',
            kabupaten: 'Rokan Hilir',
            provinsi: 'Riau'
        };

        if (did) {
            try {
                const kepRes = await db.query('SELECT * FROM kepenghuluan WHERE id = $1 LIMIT 1', [did]);
                if (kepRes.rows.length > 0) {
                    kepInfo = {
                        id: kepRes.rows[0].id,
                        nama: kepRes.rows[0].nama || 'Bantaian Baru',
                        kecamatan: kepRes.rows[0].kecamatan || 'Batu Hampar',
                        kabupaten: 'Rokan Hilir',
                        provinsi: 'Riau'
                    };
                }
            } catch (e) {
                console.error('[PORTAL:kepInfo]', e.message);
            }
        }

        // Ambil daftar seluruh kepenghuluan untuk selector (jika superadmin atau tamu ingin pilih desa)
        let kepList = [];
        try {
            const klRes = await db.query('SELECT id, nama, kecamatan FROM kepenghuluan ORDER BY nama ASC');
            kepList = klRes.rows;
        } catch (e) {
            kepList = [{ id: 1, nama: 'Bantaian Baru', kecamatan: 'Batu Hampar' }];
        }

        // Ambil Quick Statistics ringkas per-desa
        let stats = {
            totalSurat: 0,
            spjSelesai: 0,
            tamuHariIni: 0,
            pbbSetorBulanIni: 0,
            bansosKpm: 0
        };

        let filterDesa = '';
        let paramsDesa = [];
        if (!isSuper && did) {
            filterDesa = 'WHERE kepenghuluan_id = $1';
            paramsDesa = [did];
        }

        try {
            // Tamu hari ini
            const tamuQ = did 
                ? 'SELECT COUNT(*) FROM buku_tamu WHERE tanggal_kunjungan = CURRENT_DATE AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)'
                : 'SELECT COUNT(*) FROM buku_tamu WHERE tanggal_kunjungan = CURRENT_DATE';
            const tamuRes = await db.query(tamuQ, did ? [did] : []);
            stats.tamuHariIni = Number(tamuRes.rows[0]?.count) || 0;
        } catch (e) { /* noop */ }

        try {
            // Surat
            const smQ = did 
                ? 'SELECT COUNT(*) FROM surat_masuk WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)'
                : 'SELECT COUNT(*) FROM surat_masuk';
            const skQ = did 
                ? 'SELECT COUNT(*) FROM surat_keluar WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)'
                : 'SELECT COUNT(*) FROM surat_keluar';
            const smRes = await db.query(smQ, did ? [did] : []);
            const skRes = await db.query(skQ, did ? [did] : []);
            stats.totalSurat = (Number(smRes.rows[0]?.count) || 0) + (Number(skRes.rows[0]?.count) || 0);
        } catch (e) { /* noop */ }

        try {
            // SPJ Selesai
            const spjQ = did 
                ? `SELECT COUNT(*) FROM spj_kegiatan WHERE tahap_verifikasi = 'SELESAI_FINAL' AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)`
                : `SELECT COUNT(*) FROM spj_kegiatan WHERE tahap_verifikasi = 'SELESAI_FINAL'`;
            const spjRes = await db.query(spjQ, did ? [did] : []);
            stats.spjSelesai = Number(spjRes.rows[0]?.count) || 0;
        } catch (e) { /* noop */ }

        res.render('portal', {
            title: `Portal Terpadu Kepenghuluan ${kepInfo.nama} - SIAD 2.0`,
            layout: false,
            user: user,
            kepInfo: kepInfo,
            kepList: kepList,
            stats: stats
        });
    } catch (err) {
        console.error('Portal Error:', err);
        res.status(500).send('Terjadi kesalahan memuat portal SIAD 2.0: ' + err.message);
    }
};
