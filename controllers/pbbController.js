const db = require('../config/db');
const ac = require('../middleware/access');
const QRCode = require('qrcode');

// 1. Dashboard & Rekapitulasi Perpajakan PBB-P2
exports.getDashboard = async (req, res) => {
    try {
        const user = req.session && req.session.user ? req.session.user : null;
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
        let did = req.query.desa ? Number(req.query.desa) : (ac.getDesaId(req) || 67);
        const tahun = req.query.tahun ? Number(req.query.tahun) : new Date().getFullYear();
        const dusunFilter = req.query.dusun || '';

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
        } catch (e) { /* fallback default */ }

        // Query daftar setoran PBB
        let whereClause = 'WHERE p.tahun_pajak = $1';
        let params = [tahun];
        let pIdx = 2;

        if (!isSuper && did) {
            whereClause += ` AND (p.kepenghuluan_id = $${pIdx} OR p.kepenghuluan_id IS NULL)`;
            params.push(did);
            pIdx++;
        } else if (isSuper && req.query.desa) {
            whereClause += ` AND p.kepenghuluan_id = $${pIdx}`;
            params.push(did);
            pIdx++;
        }

        if (dusunFilter) {
            whereClause += ` AND p.dusun = $${pIdx}`;
            params.push(dusunFilter);
            pIdx++;
        }

        const listQ = `
            SELECT p.*, k.nama as kepenghuluan_nama
            FROM pbb_setoran p
            LEFT JOIN kepenghuluan k ON p.kepenghuluan_id = k.id
            ${whereClause}
            ORDER BY p.tanggal_bayar DESC, p.id DESC
            LIMIT 300
        `;
        const rows = (await db.query(listQ, params)).rows;

        // Hitung Statistik PBB
        let statWhere = 'WHERE tahun_pajak = $1';
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
                COUNT(*) as total_transaksi,
                COALESCE(SUM(jumlah_pbb), 0) as total_terkumpul,
                COUNT(DISTINCT dusun) as total_dusun,
                COUNT(DISTINCT nama_kolektor) as total_kolektor
            FROM pbb_setoran
            ${statWhere}
        `, statParams);

        const stats = statRes.rows[0] || {
            total_transaksi: 0,
            total_terkumpul: 0,
            total_dusun: 0,
            total_kolektor: 0
        };

        // Rekapitulasi per Dusun
        const dusunRes = await db.query(`
            SELECT 
                COALESCE(dusun, 'Dusun Lainnya') as dusun,
                COUNT(*) as jumlah_wp,
                COALESCE(SUM(jumlah_pbb), 0) as subtotal
            FROM pbb_setoran
            ${statWhere}
            GROUP BY dusun
            ORDER BY subtotal DESC
        `, statParams);

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

        res.render('pbb', {
            title: `Perpajakan PBB-P2 - Kepenghuluan ${kepInfo.nama}`,
            layout: 'layout',
            kepInfo: kepInfo,
            kepList: kepList,
            setoranList: rows,
            stats: stats,
            rekapDusun: dusunRes.rows,
            selectedTahun: tahun,
            selectedDusun: dusunFilter,
            activeDesaId: did
        });
    } catch (err) {
        console.error('PBB getDashboard error:', err);
        res.status(500).send('Terjadi kesalahan memuat modul PBB-P2: ' + err.message);
    }
};

// 2. Tambah Catatan Setoran PBB Baru
exports.tambahSetoran = async (req, res) => {
    try {
        const did = req.body.kepenghuluan_id ? Number(req.body.kepenghuluan_id) : (ac.getDesaId(req) || 67);
        const {
            nama_wajib_pajak,
            nop,
            dusun,
            rt_rw,
            jumlah_pbb,
            status_bayar,
            nama_kolektor,
            tanggal_bayar,
            catatan,
            tahun_pajak
        } = req.body;

        if (!nama_wajib_pajak || !jumlah_pbb) {
            return res.status(400).json({ success: false, message: 'Nama Wajib Pajak dan Jumlah PBB wajib diisi.' });
        }

        // Generate nomor tanda terima otomatis: PBB-[ID_DESA]-[TAHUN]-[TIMESTAMP]
        const thn = tahun_pajak ? parseInt(tahun_pajak) : new Date().getFullYear();
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const noKuitansi = `PBB-ROHIL/${thn}/${randNum}`;

        const q = `
            INSERT INTO pbb_setoran (
                kepenghuluan_id, tahun_pajak, nama_wajib_pajak, nop,
                dusun, rt_rw, jumlah_pbb, status_bayar,
                nama_kolektor, tanggal_bayar, nomor_tanda_terima, catatan
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `;

        const values = [
            did,
            thn,
            nama_wajib_pajak.trim(),
            nop ? nop.trim() : '-',
            dusun ? dusun.trim() : 'Dusun 1',
            rt_rw ? rt_rw.trim() : '-',
            parseFloat(jumlah_pbb),
            status_bayar || 'LUNAS',
            nama_kolektor ? nama_kolektor.trim() : 'Petugas PBB',
            tanggal_bayar || new Date(),
            noKuitansi,
            catatan ? catatan.trim() : null
        ];

        const r = await db.query(q, values);
        return res.json({ success: true, message: 'Setoran PBB berhasil disimpan.', data: r.rows[0] });
    } catch (err) {
        console.error('tambahSetoran error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 3. Cetak Kuitansi / Bukti Tanda Terima Setor PBB
exports.cetakKuitansi = async (req, res) => {
    try {
        const { id } = req.params;
        const q = `
            SELECT p.*, k.nama as kepenghuluan_nama, kc.nama as kecamatan_nama
            FROM pbb_setoran p
            LEFT JOIN kepenghuluan k ON p.kepenghuluan_id = k.id
            LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id
            WHERE p.id = $1 LIMIT 1
        `;
        const r = await db.query(q, [id]);
        if (r.rows.length === 0) return res.status(404).send('Data setoran PBB tidak ditemukan.');

        const item = r.rows[0];

        // Buat QR Code verifikasi tanda terima
        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const verifyUrl = `${protocol}://${host}/pajak-pbb/cetak/${item.id}`;

        const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 140
        });

        res.render('pbb_kuitansi_cetak', {
            title: `Bukti Setor PBB - ${item.nomor_tanda_terima}`,
            layout: false,
            pbb: item,
            qrDataUrl: qrDataUrl
        });
    } catch (err) {
        console.error('cetakKuitansi error:', err);
        res.status(500).send('Gagal mencetak bukti setor: ' + err.message);
    }
};

// 4. Hapus Setoran PBB
exports.hapusSetoran = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM pbb_setoran WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Data setoran PBB berhasil dihapus.' });
    } catch (err) {
        console.error('hapusSetoran error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
