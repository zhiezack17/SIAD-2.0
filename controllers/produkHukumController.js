const db = require('../config/db');
const { uploadToDrive, deleteFromDrive } = require('../config/drive');
const ac = require('../middleware/access');

const produkHukumController = {
    getIndex: async (req, res) => {
        try {
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);
            let sql = 'SELECT * FROM produk_hukum WHERE 1=1';
            let p = [];
            let idx = 1;

            if (!isSuper && did) {
                sql += ` AND kepenghuluan_id = $${idx}`;
                p.push(did);
                idx++;
            } else if (isSuper && did) {
                sql += ` AND kepenghuluan_id = $${idx}`;
                p.push(did);
                idx++;
            }

            sql += ' ORDER BY id DESC';
            const result = await db.query(sql, p);

            res.render('produk_hukum', {
                title: 'Produk Hukum - SIAD 2.0',
                data: result.rows,
                status: req.query.status,
                msg: req.query.msg,
                user: req.session.user
            });
        } catch (error) {
            res.send('<div style="padding:40px;"><h2>💥 Error Produk Hukum:</h2><p>' + error.message + '</p></div>');
        }
    },

    postTambah: async (req, res) => {
        try {
            const { jenis, nomor, tahun, judul, status, tanggal_ditetapkan } = req.body;
            const userDesa = ac.getDesaNama(req, 'Desa');
            const did = ac.getDesaId(req);
            let driveUrl = '';
            if (req.file) {
                const driveData = await uploadToDrive(req.file, userDesa, 'Produk Hukum', jenis);
                if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
            }
            const res_id = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM produk_hukum');
            const next_id = res_id.rows[0].next_id;

            const targetDesaId = did || null;
            const tglDitetapkan = tanggal_ditetapkan || null;
            const sql = 'INSERT INTO produk_hukum (id, jenis, nomor, tahun, judul, tentang, status, drive_file_url, file_url, kepenghuluan_id, tanggal_ditetapkan) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)';
            const p = [next_id, jenis, nomor, tahun, judul, '-', status, driveUrl, driveUrl, targetDesaId, tglDitetapkan];
            try {
                await db.query(sql, p);
            } catch (errCol) {
                const fallbackSql = 'INSERT INTO produk_hukum (id, jenis, nomor, tahun, judul, tentang, status, drive_file_url, file_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)';
                await db.query(fallbackSql, [next_id, jenis, nomor, tahun, judul, '-', status, driveUrl, driveUrl, targetDesaId]);
            }

            res.redirect('/produk-hukum?status=success_add');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    },

    postEdit: async (req, res) => {
        try {
            const { id, jenis, nomor, tahun, judul, status, tanggal_ditetapkan } = req.body;
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);

            // 1. Verifikasi kepemilikan data sebelum edit
            let checkSql = 'SELECT drive_file_url, file_url FROM produk_hukum WHERE id=$1';
            let checkParams = [id];
            if (!isSuper && did) {
                checkSql += ' AND kepenghuluan_id=$2';
                checkParams.push(did);
            }
            const check = await db.query(checkSql, checkParams);
            if (check.rows.length === 0) {
                return res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent('Akses ditolak atau data tidak ditemukan.'));
            }

            const tglDitetapkan = tanggal_ditetapkan || null;
            let query = 'UPDATE produk_hukum SET jenis=$1, nomor=$2, tahun=$3, judul=$4, status=$5, tentang=$6, tanggal_ditetapkan=$7';
            let params = [jenis, nomor, tahun, judul, status, '-', tglDitetapkan];

            if (req.file) {
                const userDesa = ac.getDesaNama(req, 'Desa');
                const driveData = await uploadToDrive(req.file, userDesa, 'Produk Hukum', jenis);
                if (driveData && driveData.webViewLink) {
                    query += `, drive_file_url=$${params.length + 1}, file_url=$${params.length + 1}`;
                    params.push(driveData.webViewLink);
                }
            }

            const nextParam = params.length + 1;
            if (!isSuper && did) {
                query += ` WHERE id=$${nextParam} AND kepenghuluan_id=$${nextParam + 1}`;
                params.push(id, did);
            } else {
                query += ` WHERE id=$${nextParam}`;
                params.push(id);
            }

            try {
                await db.query(query, params);
            } catch (errCol) {
                // Fallback jika kolom tanggal_ditetapkan belum sinkron
                let fbQuery = 'UPDATE produk_hukum SET jenis=$1, nomor=$2, tahun=$3, judul=$4, status=$5, tentang=$6';
                let fbParams = [jenis, nomor, tahun, judul, status, '-'];
                if (params.length > 7) {
                    fbQuery += `, drive_file_url=$7, file_url=$7 WHERE id=$8`;
                    fbParams.push(params[7], id);
                } else {
                    fbQuery += ` WHERE id=$7`;
                    fbParams.push(id);
                }
                await db.query(fbQuery, fbParams);
            }

            res.redirect('/produk-hukum?status=success_edit');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    },

            await db.query(query, params);
            res.redirect('/produk-hukum?status=success_edit');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    },

    postDelete: async (req, res) => {
        try {
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);
            const id = req.body.id;

            // 1. Verifikasi kepemilikan dan ambil link file
            let checkSql = 'SELECT drive_file_url, file_url, kepenghuluan_id FROM produk_hukum WHERE id=$1';
            let checkParams = [id];
            if (!isSuper && did) {
                checkSql += ' AND kepenghuluan_id=$2';
                checkParams.push(did);
            }
            const check = await db.query(checkSql, checkParams);
            if (check.rows.length === 0) {
                return res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent('Akses ditolak: Data tidak ditemukan pada kepenghuluan Anda.'));
            }

            const row = check.rows[0];
            const fileUrl = row.drive_file_url || row.file_url;

            // 2. Hapus dari database terlebih dahulu
            let sql = 'DELETE FROM produk_hukum WHERE id=$1';
            let p = [id];
            if (!isSuper && did) {
                sql += ' AND kepenghuluan_id=$2';
                p.push(did);
            }
            await db.query(sql, p);

            // 3. Bersihkan dari Drive setelah DB terkonfirmasi terhapus
            if (fileUrl) {
                try {
                    await deleteFromDrive(fileUrl);
                } catch (errDrive) {
                    console.warn('[ProdukHukum:postDelete] Gagal bersihkan file di Drive:', errDrive.message);
                }
            }

            res.redirect('/produk-hukum?status=success_delete');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    }
};

module.exports = produkHukumController;
