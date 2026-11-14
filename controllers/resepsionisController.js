const db = require('../config/db');
const ac = require('../middleware/access');
const QRCode = require('qrcode');

// 1. Tampilan Publik: Form Pengisian Buku Tamu (Scan QR dari HP Tamu)
exports.getPublicForm = async (req, res) => {
    try {
        let desaId = req.query.desa || req.params.desaId || null;
        let did = desaId ? Number(desaId) : 67; // Default: Bantaian Baru (id: 67)

        let kepInfo = {
            id: 67,
            nama: 'Bantaian Baru',
            kecamatan: 'Batu Hampar',
            kabupaten: 'Rokan Hilir'
        };

        try {
            const r = await db.query(`
                SELECT k.id, k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                WHERE k.id = $1 LIMIT 1
            `, [did]);
            if (r.rows.length > 0) {
                kepInfo = {
                    id: r.rows[0].id,
                    nama: r.rows[0].nama,
                    kecamatan: r.rows[0].kecamatan || 'Batu Hampar',
                    kabupaten: 'Rokan Hilir'
                };
            }
        } catch (e) { /* fallback default */ }

        // Ambil daftar seluruh kepenghuluan jika tamu ingin ganti desa
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

        res.render('buku_tamu_form', {
            title: `Buku Tamu Digital - Kepenghuluan ${kepInfo.nama}`,
            layout: false,
            kepInfo: kepInfo,
            kepList: kepList
        });
    } catch (err) {
        console.error('getPublicForm error:', err);
        res.status(500).send('Terjadi kesalahan memuat form buku tamu: ' + err.message);
    }
};

// 2. Submit Data Buku Tamu dari Form Tamu Online
exports.submitPublicForm = async (req, res) => {
    try {
        const {
            kepenghuluan_id,
            nama_tamu,
            instansi_asal,
            kategori_tamu,
            no_hp,
            pejabat_dituju,
            keperluan,
            jumlah_orang,
            tanda_tangan
        } = req.body;

        if (!nama_tamu || !keperluan) {
            return res.status(400).json({ success: false, message: 'Nama Tamu dan Keperluan wajib diisi.' });
        }

        const q = `
            INSERT INTO buku_tamu (
                kepenghuluan_id, nama_tamu, instansi_asal, kategori_tamu,
                no_hp, pejabat_dituju, keperluan, jumlah_orang, tanda_tangan,
                status, tanggal_kunjungan
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'MENUNGGU', CURRENT_DATE)
            RETURNING *
        `;

        const values = [
            kepenghuluan_id ? Number(kepenghuluan_id) : 67,
            nama_tamu.trim(),
            instansi_asal ? instansi_asal.trim() : 'Warga Pribadi',
            kategori_tamu || 'WARGA',
            no_hp ? no_hp.trim() : '-',
            pejabat_dituju || 'Datuk Penghulu',
            keperluan.trim(),
            jumlah_orang ? parseInt(jumlah_orang) : 1,
            tanda_tangan || null
        ];

        const result = await db.query(q, values);

        return res.json({
            success: true,
            message: 'Terima kasih, kunjungan Anda telah berhasil dicatat di Buku Tamu Digital.',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('submitPublicForm error:', err);
        return res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem: ' + err.message });
    }
};

// 3. Dashboard Resepsionis Internal (Kaur Umum & Petugas Piket)
exports.getDashboard = async (req, res) => {
    try {
        let did = req.query.desa ? Number(req.query.desa) : (ac.getDesaId(req) || 67);
        const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;
        const selectedTanggal = req.query.tanggal || ''; // format YYYY-MM-DD atau kosong = semua

        let whereClause = 'WHERE 1=1';
        let params = [];
        let pIdx = 1;

        if (!isSuper && did) {
            whereClause += ` AND (b.kepenghuluan_id = $${pIdx} OR b.kepenghuluan_id IS NULL)`;
            params.push(did);
            pIdx++;
        } else if (isSuper && req.query.desa) {
            whereClause += ` AND b.kepenghuluan_id = $${pIdx}`;
            params.push(did);
            pIdx++;
        }

        if (selectedTanggal) {
            whereClause += ` AND b.tanggal_kunjungan = $${pIdx}`;
            params.push(selectedTanggal);
            pIdx++;
        }

        const queryStr = `
            SELECT b.*, k.nama as kepenghuluan_nama, kc.nama as kecamatan_nama
            FROM buku_tamu b
            LEFT JOIN kepenghuluan k ON b.kepenghuluan_id = k.id
            LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id
            ${whereClause}
            ORDER BY b.created_at DESC
            LIMIT 200
        `;

        const rows = (await db.query(queryStr, params)).rows;

        // Hitung statistik hari ini
        let countParams = [];
        let countWhere = 'WHERE tanggal_kunjungan = CURRENT_DATE';
        if (!isSuper && did) {
            countWhere += ' AND (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)';
            countParams.push(did);
        } else if (isSuper && req.query.desa) {
            countWhere += ' AND kepenghuluan_id = $1';
            countParams.push(did);
        }

        const statRes = await db.query(`
            SELECT 
                COUNT(*) as total_hari_ini,
                COUNT(*) FILTER (WHERE status = 'MENUNGGU') as menunggu,
                COUNT(*) FILTER (WHERE status = 'SEDANG_DILAYANI') as dilayani,
                COUNT(*) FILTER (WHERE status = 'SELESAI') as selesai
            FROM buku_tamu
            ${countWhere}
        `, countParams);

        const stats = statRes.rows[0] || { total_hari_ini: 0, menunggu: 0, dilayani: 0, selesai: 0 };

        // Ambil data kepenghuluan aktif
        let activeDesaNama = 'Bantaian Baru';
        let activeKecNama = 'Batu Hampar';
        if (did) {
            const kRes = await db.query(`
                SELECT k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                WHERE k.id = $1 LIMIT 1
            `, [did]);
            if (kRes.rows.length > 0) {
                activeDesaNama = kRes.rows[0].nama;
                activeKecNama = kRes.rows[0].kecamatan || 'Batu Hampar';
            }
        }

        // Ambil seluruh daftar kepenghuluan untuk filter super admin
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

        res.render('resepsionis', {
            title: 'Resepsionis & Buku Tamu Digital - SIAD 2.0',
            layout: 'layout',
            tamuList: rows,
            stats: stats,
            selectedTanggal: selectedTanggal,
            activeDesaId: did,
            activeDesaNama: activeDesaNama,
            activeKecNama: activeKecNama,
            kepList: kepList
        });
    } catch (err) {
        console.error('getDashboard error:', err);
        res.status(500).send('Terjadi kesalahan memuat resepsionis: ' + err.message);
    }
};

// 4. Update Status Tamu (Menunggu -> Sedang Dilayani -> Selesai)
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, catatan_petugas } = req.body;

        const allowed = ['MENUNGGU', 'SEDANG_DILAYANI', 'SELESAI', 'BATAL'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status tidak valid.' });
        }

        let q = 'UPDATE buku_tamu SET status = $1, updated_at = CURRENT_TIMESTAMP';
        let params = [status];
        if (catatan_petugas !== undefined) {
            q += ', catatan_petugas = $2 WHERE id = $3';
            params.push(catatan_petugas, id);
        } else {
            q += ' WHERE id = $2';
            params.push(id);
        }

        await db.query(q, params);
        return res.json({ success: true, message: `Status tamu berhasil diperbarui ke: ${status}` });
    } catch (err) {
        console.error('updateStatus error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 5. Cetak Standing Akrilik QR Code Meja Resepsionis
exports.getStandingQR = async (req, res) => {
    try {
        // Ambil desa: prioritas dari query ?desa=..., lalu sesi aktif, lalu kepenghuluan user, default 67 (Bantaian Baru)
        let did = req.query.desa ? Number(req.query.desa) : (ac.getDesaId(req) || 67);

        let kepInfo = {
            id: did,
            nama: 'Bantaian Baru',
            kecamatan: 'Batu Hampar',
            kabupaten: 'Rokan Hilir'
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
                    kecamatan: kRes.rows[0].kecamatan || 'Batu Hampar',
                    kabupaten: 'Rokan Hilir'
                };
            }
        } catch (e) { /* fallback default */ }

        // Ambil daftar seluruh kepenghuluan se-Rohil untuk selector di atas lembar cetak
        let kepList = [];
        try {
            const kl = await db.query(`
                SELECT k.id, k.nama, kc.nama as kecamatan 
                FROM kepenghuluan k 
                LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id 
                ORDER BY k.nama ASC
            `);
            kepList = kl.rows;
        } catch (e) {
            kepList = [kepInfo];
        }

        // Host domain dinamis
        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const targetUrl = `${protocol}://${host}/buku-tamu?desa=${kepInfo.id}`;

        // Generate QR code base64 PNG resolusi tinggi
        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 480,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        });

        res.render('buku_tamu_qr_cetak', {
            title: `Standing QR Buku Tamu - Kepenghuluan ${kepInfo.nama}`,
            layout: false,
            kepInfo: kepInfo,
            kepList: kepList,
            targetUrl: targetUrl,
            qrDataUrl: qrDataUrl
        });
    } catch (err) {
        console.error('getStandingQR error:', err);
        res.status(500).send('Gagal menghasilkan QR Standing: ' + err.message);
    }
};

// 6. Input Tamu Manual oleh Petugas Resepsionis / Kaur Umum
exports.postTamuManual = async (req, res) => {
    try {
        const did = req.body.kepenghuluan_id ? Number(req.body.kepenghuluan_id) : (ac.getDesaId(req) || 67);
        const {
            nama_tamu,
            instansi_asal,
            kategori_tamu,
            no_hp,
            pejabat_dituju,
            keperluan,
            jumlah_orang,
            catatan_petugas
        } = req.body;

        if (!nama_tamu || !keperluan) {
            return res.status(400).json({ success: false, message: 'Nama dan keperluan wajib diisi.' });
        }

        await db.query(`
            INSERT INTO buku_tamu (
                kepenghuluan_id, nama_tamu, instansi_asal, kategori_tamu,
                no_hp, pejabat_dituju, keperluan, jumlah_orang,
                status, catatan_petugas, tanggal_kunjungan
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SELESAI', $9, CURRENT_DATE)
        `, [
            did,
            nama_tamu.trim(),
            instansi_asal ? instansi_asal.trim() : 'Warga Pribadi',
            kategori_tamu || 'WARGA',
            no_hp ? no_hp.trim() : '-',
            pejabat_dituju || 'Datuk Penghulu',
            keperluan.trim(),
            jumlah_orang ? parseInt(jumlah_orang) : 1,
            catatan_petugas ? catatan_petugas.trim() : 'Dicatat langsung oleh Resepsionis'
        ]);

        return res.json({ success: true, message: 'Data tamu berhasil ditambahkan manual.' });
    } catch (err) {
        console.error('postTamuManual error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

// 7. Hapus Catatan Tamu
exports.hapusTamu = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM buku_tamu WHERE id = $1', [id]);
        return res.json({ success: true, message: 'Data tamu berhasil dihapus.' });
    } catch (err) {
        console.error('hapusTamu error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
};
