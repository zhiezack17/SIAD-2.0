const db = require('../config/db');
const { uploadToDrive, deleteFromDrive } = require('../config/drive');
const ac = require('../middleware/access');

const produkHukumController = {
    getIndex: async (req, res) => {
        try {
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req);
            let sql = 'SELECT * FROM produk_hukum WHERE 1=1'; let p = []; let idx = 1;
            if (!admin && did) { sql += ` AND kepenghuluan_id = $${idx}`; p.push(did); idx++; }
            else if (!admin && !did) { sql += ` AND kepenghuluan_id IS NULL`; }
            sql += ' ORDER BY id DESC';
            let result;
            try { result = await db.query(sql, p); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    result = await db.query('SELECT * FROM produk_hukum ORDER BY id DESC');
                } else throw e;
            }
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
            const { jenis, nomor, tahun, judul, status } = req.body;
            const userDesa = ac.getDesaNama(req, 'Desa');
            const did = ac.getDesaId(req);
            let driveUrl = '';
            if (req.file) {
                const driveData = await uploadToDrive(req.file, userDesa, 'Produk Hukum', jenis);
                if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
            }
            const res_id = await db.query('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM produk_hukum');
            const next_id = res_id.rows[0].next_id;

            // Gunakan user's desa ID jika login non-admin; NULL jika admin blm pilih
            const targetDesaId = did || null;
            let sql, p;
            try {
                sql = 'INSERT INTO produk_hukum (id, jenis, nomor, tahun, judul, tentang, status, drive_file_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
                p = [next_id, jenis, nomor, tahun, judul, '-', status, driveUrl, targetDesaId];
                await db.query(sql, p);
            } catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    await db.query(
                        'INSERT INTO produk_hukum (id, jenis, nomor, tahun, judul, tentang, status, drive_file_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                        [next_id, jenis, nomor, tahun, judul, '-', status, driveUrl]
                    );
                } else throw e;
            }
            res.redirect('/produk-hukum?status=success_add');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    },
    postEdit: async (req, res) => {
        try {
            const { id, jenis, nomor, tahun, judul, status } = req.body;
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req);
            let query = 'UPDATE produk_hukum SET jenis=$1, nomor=$2, tahun=$3, judul=$4, status=$5, tentang=$6';
            let params = [jenis, nomor, tahun, judul, status, '-'];

            if (req.file) {
                const userDesa = ac.getDesaNama(req, 'Desa');
                const driveData = await uploadToDrive(req.file, userDesa, 'Produk Hukum', jenis);
                if (driveData && driveData.webViewLink) {
                    query += ', drive_file_url=$7';
                    params.push(driveData.webViewLink);
                }
            }
            const nextParam = params.length + 1;
            if (!admin && did) {
                query += ` WHERE id=$${nextParam} AND (kepenghuluan_id=$${nextParam + 1} OR kepenghuluan_id IS NULL)`;
                params.push(id, did);
            } else {
                query += ` WHERE id=$${nextParam}`;
                params.push(id);
            }
            try { await db.query(query, params); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    const q2 = 'UPDATE produk_hukum SET jenis=$1, nomor=$2, tahun=$3, judul=$4, status=$5, tentang=$6' +
                              (params.length > 6 ? ', drive_file_url=$7' : '') + ' WHERE id=$' + (params.length > 6 ? '8' : '7');
                    await db.query(q2, params);
                } else throw e;
            }
            res.redirect('/produk-hukum?status=success_edit');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    },
    postDelete: async (req, res) => {
        try {
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req); const id = req.body.id;
            let sql, p;

            // 1. Ambil file_url sebelum dihapus dan bersihkan di Google Drive
            try {
                const phCheck = await db.query('SELECT file_url FROM produk_hukum WHERE id=$1', [id]);
                if (phCheck.rows.length > 0 && phCheck.rows[0].file_url) {
                    await deleteFromDrive(phCheck.rows[0].file_url);
                }
            } catch (errDrive) {
                console.warn('[ProdukHukum:postDelete] Gagal hapus di Drive:', errDrive.message);
            }

            if (admin || !did) {
                sql = 'DELETE FROM produk_hukum WHERE id=$1'; p = [id];
            } else {
                sql = 'DELETE FROM produk_hukum WHERE id=$1 AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)'; p = [id, did];
            }
            try { await db.query(sql, p); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    await db.query('DELETE FROM produk_hukum WHERE id=$1', [id]);
                } else throw e;
            }
            res.redirect('/produk-hukum?status=success_delete');
        } catch (error) {
            res.redirect('/produk-hukum?status=error&msg=' + encodeURIComponent(error.message));
        }
    }
};

module.exports = produkHukumController;
