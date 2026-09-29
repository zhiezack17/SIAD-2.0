const db = require('../config/db');
const { uploadToDrive } = require('../config/drive');
const ac = require('../middleware/access');
const fs = require('fs');
const path = require('path');

const masterController = {
    getIndex: async (req, res) => {
        try {
            const tab = req.query.tab || 'rekening';
            let data = [];
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req);

            if (tab === 'rekening') {
                const result = await db.query('SELECT * FROM master_kode_rekening ORDER BY kode ASC');
                data = result.rows;
            } else if (tab === 'klasifikasi') {
                const result = await db.query('SELECT * FROM master_klasifikasi_surat ORDER BY kode ASC');
                data = result.rows;
            } else if (tab === 'perangkat') {
                let sql = 'SELECT * FROM master_perangkat_desa WHERE 1=1';
                let p = []; let i = 1;
                const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
                if (!isSuper && did) { sql += ` AND kepenghuluan_id = $${i}`; p.push(did); i++; }
                else if (!isSuper && !did) { sql += ` AND kepenghuluan_id IS NULL`; }
                sql += ' ORDER BY id ASC';
                try {
                    const result = await db.query(sql, p); data = result.rows;
                } catch (e) {
                    if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                        data = (await db.query('SELECT * FROM master_perangkat_desa ORDER BY id ASC')).rows;
                    } else throw e;
                }
            }

            res.render('master', { title: 'Master Data - SIAD 2.0', tab: tab, data: data });
        } catch (error) {
            console.error('Error Master Data:', error);
            res.redirect('/dashboard');
        }
    },
    postRekening: async (req, res) => {
        await db.query('INSERT INTO master_kode_rekening (kode, uraian) VALUES ($1, $2)', [req.body.kode, req.body.uraian]);
        res.redirect('/master_data?tab=rekening');
    },
    postKlasifikasi: async (req, res) => {
        await db.query('INSERT INTO master_klasifikasi_surat (kode, keterangan) VALUES ($1, $2)', [req.body.kode, req.body.keterangan]);
        res.redirect('/master_data?tab=klasifikasi');
    },
    postPerangkat: async (req, res) => {
        const userDesa = ac.getDesaNama(req, 'Air Hitam');
        const did = ac.getDesaId(req);
        let driveUrl = '';
        if (req.file) {
            const driveData = await uploadToDrive(req.file, userDesa, 'Master Data', 'SK Perangkat');
            if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
        }
        if (did) {
            try {
                await db.query(
                    'INSERT INTO master_perangkat_desa (nama, jabatan, nip, file_sk_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5)',
                    [req.body.nama, req.body.jabatan, req.body.nip, driveUrl, did]
                );
            } catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    await db.query(
                        'INSERT INTO master_perangkat_desa (nama, jabatan, nip, file_sk_url) VALUES ($1, $2, $3, $4)',
                        [req.body.nama, req.body.jabatan, req.body.nip, driveUrl]
                    );
                } else throw e;
            }
        } else {
            await db.query(
                'INSERT INTO master_perangkat_desa (nama, jabatan, nip, file_sk_url) VALUES ($1, $2, $3, $4)',
                [req.body.nama, req.body.jabatan, req.body.nip, driveUrl]
            );
        }
        res.redirect('/master_data?tab=perangkat');
    },
    deleteData: async (req, res) => {
        const { id, type } = req.body;
        const admin = ac.isAdmin(req); const did = ac.getDesaId(req);
        let sql, p;
        if (type === 'rekening') { await db.query('DELETE FROM master_kode_rekening WHERE id = $1', [id]); }
        else if (type === 'klasifikasi') { await db.query('DELETE FROM master_klasifikasi_surat WHERE id = $1', [id]); }
        else if (type === 'perangkat') {
            const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
            if (isSuper) { sql = 'DELETE FROM master_perangkat_desa WHERE id = $1'; p = [id]; }
            else if (did) { sql = 'DELETE FROM master_perangkat_desa WHERE id = $1 AND kepenghuluan_id = $2'; p = [id, did]; }
            else { sql = 'DELETE FROM master_perangkat_desa WHERE id = $1 AND kepenghuluan_id IS NULL'; p = [id]; }
            try { await db.query(sql, p); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    await db.query('DELETE FROM master_perangkat_desa WHERE id = $1', [id]);
                } else throw e;
            }
        }
        res.redirect('/master_data?tab=' + type);
    }
};
module.exports = masterController;
