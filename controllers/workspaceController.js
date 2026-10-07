const db = require('../config/db');
const ac = require('../middleware/access');

const workspaceController = {
    getIndex: async (req, res) => {
        try {
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req);
            let baseSql = `
                SELECT w.*, wt.nama as type_nama, wt.type_icon, wt.type_warna, mk.nama as kepenghuluan_nama,
                       (SELECT COUNT(*) FROM workspace_document wd WHERE wd.workspace_id = w.id) as doc_count
                FROM workspace w
                LEFT JOIN workspace_type wt ON w.workspace_type_id = wt.id
                LEFT JOIN kepenghuluan mk ON w.kepenghuluan_id = mk.id
                WHERE 1=1`;
            let p = []; let idx = 1;
            if (!admin && did) { baseSql += ` AND w.kepenghuluan_id = $${idx}`; p.push(did); idx++; }
            else if (!admin && !did) { baseSql += ` AND w.kepenghuluan_id IS NULL`; }
            baseSql += ` ORDER BY w.created_at DESC`;
            let wsResult;
            try { wsResult = await db.query(baseSql, p); }
            catch (e) {
                const fallback = `
                    SELECT w.*, wt.nama as type_nama, wt.type_icon, wt.type_warna, mk.nama as kepenghuluan_nama,
                           (SELECT COUNT(*) FROM workspace_document wd WHERE wd.workspace_id = w.id) as doc_count
                    FROM workspace w
                    LEFT JOIN workspace_type wt ON w.workspace_type_id = wt.id
                    LEFT JOIN kepenghuluan mk ON w.kepenghuluan_id = mk.id
                    ORDER BY w.created_at DESC`;
                wsResult = await db.query(fallback);
            }

            let types = [];
            try {
                const typesRes = await db.query('SELECT * FROM workspace_type ORDER BY id ASC');
                types = typesRes.rows;
            } catch (err) {
                types = [];
            }

            res.render('workspace', { 
                title: 'Workspace - SIAD 2.0', 
                workspaces: wsResult.rows,
                types: types
            });
        } catch (error) {
            console.error('Error fetching workspaces:', error);
            res.redirect('/dashboard');
        }
    },
    postTambah: async (req, res) => {
        try {
            const { nama, workspace_type_id, deskripsi, kepenghuluan_id } = req.body;
            if (!nama || !nama.trim()) {
                return res.redirect('/workspace?status=error&msg=' + encodeURIComponent('Nama workspace wajib diisi'));
            }

            let did = ac.getDesaId(req);
            if (ac.isAdmin(req) && kepenghuluan_id && kepenghuluan_id !== 'all') {
                did = Number(kepenghuluan_id);
            }

            const insertSql = `
                INSERT INTO workspace (nama, workspace_type_id, deskripsi, kepenghuluan_id, status, created_at)
                VALUES ($1, $2, $3, $4, 'Aktif', NOW())
                RETURNING id
            `;
            await db.query(insertSql, [
                nama.trim(),
                workspace_type_id ? Number(workspace_type_id) : 1,
                deskripsi ? deskripsi.trim() : null,
                did || null
            ]);

            res.redirect('/workspace?status=success&msg=' + encodeURIComponent('Workspace baru berhasil dibuat!'));
        } catch (error) {
            console.error('Error creating workspace:', error);
            res.redirect('/workspace?status=error&msg=' + encodeURIComponent('Gagal membuat workspace: ' + error.message));
        }
    },
    postDelete: async (req, res) => {
        try {
            const { id } = req.body;
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);

            let checkSql = 'SELECT * FROM workspace WHERE id = $1';
            let checkParams = [id];
            if (!isSuper && did) {
                checkSql += ' AND kepenghuluan_id = $2';
                checkParams.push(did);
            }
            const check = await db.query(checkSql, checkParams);
            if (check.rows.length === 0) {
                return res.redirect('/workspace?status=error&msg=' + encodeURIComponent('Workspace tidak ditemukan atau hak akses ditolak'));
            }

            // Hapus dokumen terkait dahulu
            await db.query('DELETE FROM workspace_document WHERE workspace_id = $1', [id]);
            // Hapus workspace
            await db.query('DELETE FROM workspace WHERE id = $1', [id]);

            res.redirect('/workspace?status=success&msg=' + encodeURIComponent('Workspace berhasil dihapus'));
        } catch (error) {
            console.error('Error deleting workspace:', error);
            res.redirect('/workspace?status=error&msg=' + encodeURIComponent('Gagal menghapus: ' + error.message));
        }
    },
    getDetail: async (req, res) => {
        const workspaceId = req.params.id;
        try {
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);
            let wsSql = `
                SELECT w.*, wt.nama as type_nama, mk.nama as kepenghuluan_nama
                FROM workspace w
                LEFT JOIN workspace_type wt ON w.workspace_type_id = wt.id
                LEFT JOIN kepenghuluan mk ON w.kepenghuluan_id = mk.id
                WHERE w.id = $1`;
            let wsP = [workspaceId];
            if (!isSuper && did) {
                wsSql += ` AND w.kepenghuluan_id = $2`;
                wsP.push(did);
            }
            const wsResult = await db.query(wsSql, wsP);
            const workspace = wsResult.rows[0];
            if (!workspace) return res.status(404).render('404', { title: 'Workspace Tidak Ditemukan' });
            const docResult = await db.query(`SELECT wd.* FROM workspace_document wd WHERE wd.workspace_id = $1 ORDER BY wd.created_at DESC`, [workspaceId]);
            res.render('workspace_detail', { title: workspace.nama + ' - SIAD 2.0', workspace: workspace, documents: docResult.rows });
        } catch (error) { res.redirect('/workspace'); }
    },
    postDocument: async (req, res) => {
        const workspaceId = req.params.id;
        const file = req.file;
        if (!file) return res.redirect('/workspace/' + workspaceId + '?status=error&msg=File tidak terdeteksi');
        try {
            const { uploadToDrive } = require('../config/drive');
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);

            // 1. Verifikasi kepemilikan workspace SEBELUM upload ke Google Drive
            let checkWsSql = 'SELECT nama, kepenghuluan_id FROM workspace WHERE id = $1';
            let checkWsParams = [workspaceId];
            if (!isSuper && did) {
                checkWsSql += ' AND kepenghuluan_id = $2';
                checkWsParams.push(did);
            }
            const wsResult = await db.query(checkWsSql, checkWsParams);
            if (wsResult.rows.length === 0) {
                return res.redirect('/workspace?status=error&msg=' + encodeURIComponent('Akses Ditolak: Anda tidak berhak mengunggah ke workspace kepenghuluan lain.'));
            }

            const wsName = wsResult.rows[0].nama || 'Workspace';
            const userDesa = ac.getDesaNama(req, 'Desa');
            const driveData = await uploadToDrive(file, userDesa, wsName, 'Workspace');

            await db.query(
                'INSERT INTO workspace_document (workspace_id, jenis_dokumen, nama_file_asli, drive_url, path_lokal, versi, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5, 1, $6)',
                [workspaceId, req.body.jenis_dokumen || 'Dokumen', file.originalname, driveData.webViewLink, driveData.webViewLink, did || null]
            );

            res.redirect('/workspace/' + workspaceId + '?status=success&msg=File berhasil diunggah');
        } catch (error) {
            console.error('❌ GAGAL UPLOAD DRIVE/DB:', error);
            res.redirect('/workspace/' + workspaceId + '?status=error&msg=' + encodeURIComponent(error.message));
        }
    }
};
module.exports = workspaceController;
