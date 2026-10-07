const db = require('../config/db');
const ac = require('../middleware/access');

const arsipController = {
    getIndex: async (req, res) => {
        try {
            const search = req.query.search || '';
            const kategori = req.query.kategori || '';
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);

            let query = 'SELECT * FROM arsip_desa WHERE 1=1';
            let params = [];
            let paramIndex = 1;

            if (search) {
                query += ' AND (nama_arsip ILIKE $' + paramIndex + ' OR keterangan ILIKE $' + paramIndex + ')';
                params.push('%' + search + '%');
                paramIndex++;
            }
            if (kategori) {
                query += ' AND kategori = $' + paramIndex;
                params.push(kategori);
                paramIndex++;
            }
            if (!isSuper && did) {
                query += ' AND kepenghuluan_id = $' + paramIndex;
                params.push(did);
                paramIndex++;
            } else if (isSuper && did) {
                query += ' AND kepenghuluan_id = $' + paramIndex;
                params.push(did);
                paramIndex++;
            }
            query += ' ORDER BY created_at DESC LIMIT 100';

            let result;
            try { result = await db.query(query, params); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    let q = 'SELECT * FROM arsip_desa WHERE 1=1'; let p = []; let i = 1;
                    if (search) { q += ` AND (nama_arsip ILIKE $${i} OR keterangan ILIKE $${i})`; p.push('%'+search+'%'); i++; }
                    if (kategori) { q += ` AND kategori = $${i}`; p.push(kategori); i++; }
                    q += ' ORDER BY created_at DESC LIMIT 100';
                    result = await db.query(q, p);
                } else throw e;
            }
            res.render('arsip', {
                title: 'Brankas Arsip Desa - SIAD 2.0',
                arsipList: result.rows,
                search: search,
                kategori: kategori
            });
        } catch (error) {
            console.error('Error Arsip:', error);
            res.redirect('/dashboard');
        }
    },

    postUpload: async (req, res) => {
        const file = req.file;
        if (!file) return res.redirect('/arsip?status=error&msg=File tidak terdeteksi');
        try {
            const { uploadToDrive } = require('../config/drive');
            const userDesa = ac.getDesaNama(req, 'Air Hitam');
            const did = ac.getDesaId(req);
            const driveData = await uploadToDrive(file, userDesa, 'Arsip Desa', 'Arsip');

            if (did) {
                try {
                    await db.query(
                        'INSERT INTO arsip_desa (nama_arsip, kategori, keterangan, file_path, drive_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5, $6)',
                        [
                            req.body.nama_arsip || file.originalname,
                            req.body.kategori || 'Umum',
                            req.body.keterangan || '',
                            driveData.webViewLink,
                            driveData.webViewLink,
                            did
                        ]
                    );
                } catch (e) {
                    if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                        await db.query(
                            'INSERT INTO arsip_desa (nama_arsip, kategori, keterangan, file_path, drive_url) VALUES ($1, $2, $3, $4, $5)',
                            [
                                req.body.nama_arsip || file.originalname,
                                req.body.kategori || 'Umum',
                                req.body.keterangan || '',
                                driveData.webViewLink,
                                driveData.webViewLink
                            ]
                        );
                    } else throw e;
                }
            } else {
                await db.query(
                    'INSERT INTO arsip_desa (nama_arsip, kategori, keterangan, file_path, drive_url) VALUES ($1, $2, $3, $4, $5)',
                    [
                        req.body.nama_arsip || file.originalname,
                        req.body.kategori || 'Umum',
                        req.body.keterangan || '',
                        driveData.webViewLink,
                        driveData.webViewLink
                    ]
                );
            }
            res.redirect('/arsip?status=success&msg=Arsip berhasil diunggah ke Google Drive');
        } catch (error) {
            console.error('GAGAL UPLOAD ARSIP:', error);
            res.redirect('/arsip?status=error&msg=' + encodeURIComponent(error.message));
        }
    }
};

module.exports = arsipController;
