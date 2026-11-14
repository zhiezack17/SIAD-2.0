const db = require('../config/db');
const ac = require('../middleware/access');

exports.getPortal = async (req, res) => {
    try {
        const user = req.session && req.session.user ? req.session.user : null;
        const did = req.query.desa ? Number(req.query.desa) : (ac.getDesaId(req) || 67);
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;

        // Ambil data kepenghuluan aktif beserta nama kecamatannya melalui JOIN
        let kepInfo = {
            id: did,
            nama: 'Bantaian Baru',
            kecamatan: 'Batu Hampar',
            kabupaten: 'Rokan Hilir',
            provinsi: 'Riau'
        };

        try {
            const kepRes = await db.query(`
                SELECT k.id, k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                WHERE k.id = $1 LIMIT 1
            `, [did]);
            if (kepRes.rows.length > 0) {
                kepInfo = {
                    id: kepRes.rows[0].id,
                    nama: kepRes.rows[0].nama,
                    kecamatan: kepRes.rows[0].kecamatan || 'Batu Hampar',
                    kabupaten: 'Rokan Hilir',
                    provinsi: 'Riau'
                };
            }
        } catch (e) {
            console.error('[PORTAL:kepInfo]', e.message);
        }

        // Ambil daftar seluruh kepenghuluan untuk selector (jika superadmin atau tamu ingin pilih desa)
        let kepList = [];
        try {
            const klRes = await db.query(`
                SELECT k.id, k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                ORDER BY k.nama ASC
            `);
            kepList = klRes.rows;
        } catch (e) {
            kepList = [kepInfo];
        }

        // Ambil Quick Statistics ringkas per-desa
        let stats = {
            totalSurat: 0,
            spjSelesai: 0,
            tamuHariIni: 0,
            pbbSetorBulanIni: 0,
            bansosKpm: 0
        };

        try {
            // Tamu hari ini
            const tamuRes = await db.query(
                'SELECT COUNT(*) FROM buku_tamu WHERE tanggal_kunjungan = CURRENT_DATE AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)',
                [did]
            );
            stats.tamuHariIni = Number(tamuRes.rows[0]?.count) || 0;
        } catch (e) { /* noop */ }

        try {
            // Surat
            const smRes = await db.query(
                'SELECT COUNT(*) FROM surat_masuk WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)',
                [did]
            );
            const skRes = await db.query(
                'SELECT COUNT(*) FROM surat_keluar WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)',
                [did]
            );
            stats.totalSurat = (Number(smRes.rows[0]?.count) || 0) + (Number(skRes.rows[0]?.count) || 0);
        } catch (e) { /* noop */ }

        try {
            // SPJ Selesai
            const spjRes = await db.query(
                `SELECT COUNT(*) FROM spj_kegiatan WHERE tahap_verifikasi = 'SELESAI_FINAL' AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)`,
                [did]
            );
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
