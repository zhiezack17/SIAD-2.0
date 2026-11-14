const db = require('../config/db');
const ac = require('../middleware/access');

// 1. Dashboard Manajemen Bantuan Sosial (Bansos & BLT Dana Desa)
exports.getDashboard = async (req, res) => {
    try {
        const user = req.session && req.session.user ? req.session.user : null;
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
        let did = req.query.desa ? Number(req.query.desa) : (ac.getDesaId(req) || 67);
        const tahun = req.query.tahun ? Number(req.query.tahun) : new Date().getFullYear();
        const jenisBantuan = req.query.jenis || '';
        const tahapFilter = req.query.tahap || '';

        // Ambil info kepenghuluan
        let kepInfo = {
            id: did,
            nama: 'Bantaian Baru',
            kecamatan: 'Batu Hampar'
        };

        try {
            const kRes = await db.query(`
                SELECT k.id, k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                WHERE k.id = $1 LIMIT 1
            `, [did]);
            if (kRes.rows.length > 0) {
                kepInfo = {
                    id: kRes.rows[0].id,
                    nama: kRes.rows[0].nama,
                    kecamatan: kRes.rows[0].kecamatan || 'Batu Hampar'
                };
            }
        } catch (e) { /* fallback */ }

        // Query daftar penerima bansos
        let whereClause = 'WHERE b.tahun_anggaran = $1';
        let params = [tahun];
        let pIdx = 2;

        if (!isSuper && did) {
            whereClause += ` AND (b.kepenghuluan_id = $${pIdx} OR b.kepenghuluan_id IS NULL)`;
            params.push(did);
            pIdx++;
        } else if (isSuper && req.query.desa) {
            whereClause += ` AND b.kepenghuluan_id = $${pIdx}`;
            params.push(did);
            pIdx++;
        }

        if (jenisBantuan) {
            whereClause += ` AND b.jenis_bantuan = $${pIdx}`;
            params.push(jenisBantuan);
            pIdx++;
        }

        if (tahapFilter) {
            whereClause += ` AND b.periode_tahap = $${pIdx}`;
            params.push(tahapFilter);
            pIdx++;
        }

        const listQ = `
            SELECT b.*, k.nama as kepenghuluan_nama
            FROM bansos_penerima b
            LEFT JOIN kepenghuluan k ON b.kepenghuluan_id = k.id
            ${whereClause}
            ORDER BY b.dusun ASC, b.nama_kpm ASC
            LIMIT 400
        `;
        const rows = (await db.query(listQ, params)).rows;

        // Hitung Statistik Bansos
        let statWhere = 'WHERE tahun_anggaran = $1';
        let statParams = [tahun];
        if (!isSuper && did) {
            statWhere += ' AND (kepenghuluan_id = $2 OR kepenghuluan_id IS NULL)';
            statParams.push(did);
        } else if (isSuper && req.query.desa) {
            statWhere += ' AND kepenghuluan_id = $2';
            statParams.push(did);
        }

        const statRes = await db.query(`
            SELECT 
                COUNT(*) as total_kpm,
                COUNT(*) FILTER (WHERE jenis_bantuan = 'BLT_DANA_DESA') as total_blt_dd,
                COUNT(*) FILTER (WHERE jenis_bantuan IN ('PKH', 'BPNT')) as total_pkh_bpnt,
                COALESCE(SUM(nominal_bantuan) FILTER (WHERE status_penyaluran IN ('DISALURKAN', 'SELESAI')), 0) as dana_tersalurkan
            FROM bansos_penerima
            ${statWhere}
        `, statParams);

        const stats = statRes.rows[0] || {
            total_kpm: 0,
            total_blt_dd: 0,
            total_pkh_bpnt: 0,
            dana_tersalurkan: 0
        };

        // Ambil daftar seluruh kepenghuluan jika super admin
        let kepList = [];
        if (isSuper) {
            try {
                const kl = await db.query(`
                    SELECT k.id, k.nama, kc.nama as kecamatan 
                    FROM kepenghuluan k 
                    LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                    ORDER BY k.nama ASC
                `);
                kepList = kl.rows;
            } catch (e) { /* noop */ }
        }

        res.render('bansos', {
            title: `Bantuan Sosial & BLT-DD - Kepenghuluan ${kepInfo.nama}`,
            layout: 'layout',
            kepInfo: kepInfo,
            kepList: kepList,
            penerimaList: rows,
            stats: stats,
            selectedTahun: tahun,
            selectedJenis: jenisBantuan,
            selectedTahap: tahapFilter,
            activeDesaId: did
        });
    } catch (err) {
        console.error('Bansos getDashboard error:', err);
        res.status(500).send('Terjadi kesalahan memuat modul Bansos: ' + err.message);
    }
};

// 2. Tambah Data KPM Baru dengan Pengecekan Duplikasi NIK
exports.tambahKpm = async (req, res) => {
    try {
        const did = req.body.kepenghuluan_id ? Number(req.body.kepenghuluan_id) : (ac.getDesaId(req) || 67);
        const {
            nama_kpm,
            nik,
            no_kk,
            dusun,
            rt_rw,
            jenis_bantuan,
            nominal_bantuan,
            periode_tahap,
            keterangan,
            tahun_anggaran
        } = req.body;

        if (!nama_kpm || !nik) {
            return res.status(400).json({ success: false, message: 'Nama KPM dan NIK wajib diisi.' });
        }

        const cleanNik = nik.trim();
        const thn = tahun_anggaran ? parseInt(tahun_anggaran) : new Date().getFullYear();

        // 1. Cek Pencegahan Data Ganda (Duplication Check)
        const checkQ = `
            SELECT id, nama_kpm, jenis_bantuan, dusun 
            FROM bansos_penerima 
            WHERE nik = $1 AND tahun_anggaran = $2 AND kepenghuluan_id = $3
            LIMIT 1
        `;
        const checkRes = await db.query(checkQ, [cleanNik, thn, did]);
        if (checkRes.rows.length > 0) {
            const existing = checkRes.rows[0];
            return res.status(400).json({
                success: false,
                message: `PERINGATAN DUPLIKASI BANSOS: NIK ${cleanNik} atas nama "${existing.nama_kpm}" sudah terdaftar sebagai penerima bantuan "${existing.jenis_bantuan}" di ${existing.dusun}. Satu KPM/NIK tidak boleh menerima bantuan ganda!`
            });
        }

        // 2. Insert KPM Baru
        const insertQ = `
            INSERT INTO bansos_penerima (
                kepenghuluan_id, tahun_anggaran, nama_kpm, nik, no_kk,
                dusun, rt_rw, jenis_bantuan, nominal_bantuan,
                periode_tahap, status_penyaluran, keterangan
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'TERDAFTAR', $11)
            RETURNING *
        `;

        const values = [
            did,
            thn,
            nama_kpm.trim(),
            cleanNik,
            no_kk ? no_kk.trim() : '-',
            dusun ? dusun.trim() : 'Dusun 1',
            rt_rw ? rt_rw.trim() : '-',
            jenis_bantuan || 'BLT_DANA_DESA',
            nominal_bantuan ? parseFloat(nominal_bantuan) : 300000,
            periode_tahap || 'TAHAP_1',
            keterangan ? keterangan.trim() : null
        ];

        const r = await db.query(insertQ, values);
        return res.json({ success: true, message: 'KPM berhasil ditambahkan.', data: r.rows[0] });
    } catch (err) {
        console.error('tambahKpm error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Update Status Penyaluran (Terdaftar -> Disalurkan)
exports.updatePenyaluran = async (req, res) => {
    try {
        const { id } = req.params;
        const { status_penyaluran, tanggal_salur } = req.body;

        const q = `
            UPDATE bansos_penerima 
            SET status_penyaluran = $1, 
                tanggal_salur = COALESCE($2, CURRENT_DATE) 
            WHERE id = $3
        `;
        await db.query(q, [status_penyaluran || 'DISALURKAN', tanggal_salur || new Date(), id]);
        return res.json({ success: true, message: 'Status penyaluran berhasil diupdate.' });
    } catch (err) {
        console.error('updatePenyaluran error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 4. Cetak Daftar Tanda Terima Penyaluran BLT Dana Desa (Untuk Bukti Sah SPJ Siskeudes)
exports.cetakTandaTerima = async (req, res) => {
    try {
        let did = req.query.desa ? Number(req.query.desa) : (ac.getDesaId(req) || 67);
        const tahun = req.query.tahun ? Number(req.query.tahun) : new Date().getFullYear();
        const tahap = req.query.tahap || 'TAHAP_1';
        const jenis = req.query.jenis || 'BLT_DANA_DESA';

        // Ambil data kepenghuluan
        let kepInfo = {
            id: did,
            nama: 'Bantaian Baru',
            kecamatan: 'Batu Hampar'
        };

        try {
            const kRes = await db.query(`
                SELECT k.id, k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                WHERE k.id = $1 LIMIT 1
            `, [did]);
            if (kRes.rows.length > 0) {
                kepInfo = {
                    id: kRes.rows[0].id,
                    nama: kRes.rows[0].nama,
                    kecamatan: kRes.rows[0].kecamatan || 'Batu Hampar'
                };
            }
        } catch (e) { /* noop */ }

        // Query penerima
        const q = `
            SELECT * FROM bansos_penerima 
            WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)
              AND tahun_anggaran = $2
              AND jenis_bantuan = $3
              AND (periode_tahap = $4 OR $4 = 'ALL')
            ORDER BY dusun ASC, nama_kpm ASC
        `;
        const r = await db.query(q, [did, tahun, jenis, tahap]);

        // Hitung total uang
        const totalNominal = r.rows.reduce((acc, cur) => acc + Number(cur.nominal_bantuan || 0), 0);

        res.render('bansos_tanda_terima_cetak', {
            title: `Daftar Tanda Terima Penyaluran ${jenis.replace(/_/g, ' ')} TA ${tahun}`,
            layout: false,
            kepInfo: kepInfo,
            kpmList: r.rows,
            tahun: tahun,
            tahap: tahap,
            jenis: jenis,
            totalNominal: totalNominal
        });
    } catch (err) {
        console.error('cetakTandaTerima error:', err);
        res.status(500).send('Gagal mencetak daftar tanda terima bansos: ' + err.message);
    }
};

// 5. Hapus KPM
exports.hapusKpm = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM bansos_penerima WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Data KPM berhasil dihapus.' });
    } catch (err) {
        console.error('hapusKpm error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
