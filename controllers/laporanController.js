const db = require('../config/db');
const ac = require('../middleware/access');

const laporanController = {
    getIndex: async (req, res) => {
        try {
            const search = req.query.search || '';
            const jenis = req.query.jenis || '';
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req);

            let query = 'SELECT * FROM laporan_desa WHERE 1=1';
            let params = [];
            let paramIndex = 1;

            if (search) {
                query += ' AND (nama_laporan ILIKE $' + paramIndex + ' OR keterangan ILIKE $' + paramIndex + ')';
                params.push('%' + search + '%');
                paramIndex++;
            }
            if (jenis) {
                query += ' AND jenis_laporan = $' + paramIndex;
                params.push(jenis);
                paramIndex++;
            }
            if (!admin && did) {
                try {
                    query += ' AND kepenghuluan_id = $' + paramIndex;
                    params.push(did);
                    paramIndex++;
                } catch (e) { /* ignore */ }
            } else if (!admin && !did) {
                query += ' AND kepenghuluan_id IS NULL';
            }
            query += ' ORDER BY created_at DESC LIMIT 100';

            let result;
            try { result = await db.query(query, params); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    let q = 'SELECT * FROM laporan_desa WHERE 1=1'; let p = []; let i = 1;
                    if (search) { q += ` AND (nama_laporan ILIKE $${i} OR keterangan ILIKE $${i})`; p.push('%'+search+'%'); i++; }
                    if (jenis) { q += ` AND jenis_laporan = $${i}`; p.push(jenis); i++; }
                    q += ' ORDER BY created_at DESC LIMIT 100';
                    result = await db.query(q, p);
                } else throw e;
            }
            res.render('laporan', { title: 'Brankas Laporan - SIAD 2.0', laporanList: result.rows });
        } catch (error) {
            console.error('Error Laporan:', error);
            res.redirect('/dashboard');
        }
    },

    postUpload: async (req, res) => {
        const file = req.file;
        if (!file) return res.redirect('/laporan?status=error&msg=File tidak terdeteksi');
        try {
            const { uploadToDrive } = require('../config/drive');
            const { nama_laporan, jenis_laporan, keterangan } = req.body;
            const userDesa = ac.getDesaNama(req, 'Air Hitam');
            const did = ac.getDesaId(req);
            const driveData = await uploadToDrive(file, userDesa, 'Laporan Desa', jenis_laporan);

            if (did) {
                try {
                    await db.query(
                        'INSERT INTO laporan_desa (nama_laporan, jenis_laporan, keterangan, drive_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5)',
                        [nama_laporan, jenis_laporan, keterangan, driveData.webViewLink, did]
                    );
                } catch (e) {
                    if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                        await db.query(
                            'INSERT INTO laporan_desa (nama_laporan, jenis_laporan, keterangan, drive_url) VALUES ($1, $2, $3, $4)',
                            [nama_laporan, jenis_laporan, keterangan, driveData.webViewLink]
                        );
                    } else throw e;
                }
            } else {
                await db.query(
                    'INSERT INTO laporan_desa (nama_laporan, jenis_laporan, keterangan, drive_url) VALUES ($1, $2, $3, $4)',
                    [nama_laporan, jenis_laporan, keterangan, driveData.webViewLink]
                );
            }
            res.redirect('/laporan');
        } catch (error) {
            console.error('Error Upload Laporan:', error);
            res.status(500).send('Terjadi kesalahan saat mengunggah laporan: ' + error.message);
        }
    }
};

module.exports = laporanController;
