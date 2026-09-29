const db = require('../config/db');
module.exports = {
    getIndex: async (req, res) => {
        try {
            const data = (await db.query('SELECT * FROM produk_hukum ORDER BY id DESC')).rows;
            res.render('hukum', { title: 'Produk Hukum', data });
        } catch(e) { res.render('hukum', { title: 'Produk Hukum', data: [] }); }
    },
    postTambah: async (req, res) => {
        try {
            const { jenis, nomor, tahun, judul, tgl, status, tentang } = req.body;
            await db.query(
                'INSERT INTO produk_hukum (jenis, nomor, tahun, judul, tanggal_ditetapkan, status, tentang, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
                [jenis, nomor, tahun||new Date().getFullYear(), judul, tgl||null, status, tentang]
            );
            res.redirect('/hukum?status=success');
        } catch(e) { res.redirect('/hukum?status=error'); }
    },
    postEdit: async (req, res) => {
        try {
            const { id, jenis, nomor, tahun, judul, tgl, status, tentang } = req.body;
            await db.query(
                'UPDATE produk_hukum SET jenis=$1, nomor=$2, tahun=$3, judul=$4, tanggal_ditetapkan=$5, status=$6, tentang=$7, updated_at=NOW() WHERE id=$8',
                [jenis, nomor, tahun||new Date().getFullYear(), judul, tgl||null, status, tentang, id]
            );
            res.redirect('/hukum?status=success_edit');
        } catch(e) { res.redirect('/hukum?status=error'); }
    },
    postDelete: async (req, res) => {
        try {
            await db.query('DELETE FROM produk_hukum WHERE id=$1', [req.body.id]);
            res.redirect('/hukum?status=success_delete');
        } catch(e) { res.redirect('/hukum?status=error'); }
    }
};