const db = require('../config/db');
const ac = require('../middleware/access');
const QRCode = require('qrcode');
const { recordAudit } = require('../services/auditLog');

const pelayananController = {
    // 1. Tampilkan daftar surat layanan warga
    getIndex: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const q = req.query.q || '';
            const filterJenis = req.query.jenis || '';

            let sql = `
                SELECT sp.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama
                FROM surat_pelayanan sp
                LEFT JOIN kepenghuluan k ON sp.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                WHERE 1=1
            `;
            let params = [];
            let idx = 1;

            if (!admin && did) {
                sql += ` AND sp.kepenghuluan_id = $${idx}`;
                params.push(did);
                idx++;
            } else if (did) {
                sql += ` AND (sp.kepenghuluan_id = $${idx} OR sp.kepenghuluan_id IS NULL)`;
                params.push(did);
                idx++;
            }

            if (filterJenis) {
                sql += ` AND sp.jenis_surat = $${idx}`;
                params.push(filterJenis);
                idx++;
            }

            if (q) {
                sql += ` AND (sp.nama_warga ILIKE $${idx} OR sp.nik ILIKE $${idx} OR sp.nomor_surat ILIKE $${idx} OR sp.keperluan ILIKE $${idx})`;
                params.push(`%${q}%`);
                idx++;
            }

            sql += ' ORDER BY sp.id DESC';
            const result = await db.query(sql, params);
            const dataSurat = result.rows;

            // Ambil profil desa untuk default form
            let profilDesa = {
                nama_desa: 'Kepenghuluan',
                nama_penghulu: 'Penghulu',
                kecamatan: 'Rokan Hilir',
                alamat: ''
            };
            if (did) {
                const profRes = await db.query(`
                    SELECT k.nama AS nama_desa, kec.nama AS kecamatan, pd.nama_kepala_desa, pd.alamat
                    FROM kepenghuluan k
                    LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                    LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                    WHERE k.id = $1 LIMIT 1
                `, [did]);
                if (profRes.rows.length > 0) {
                    const row = profRes.rows[0];
                    profilDesa.nama_desa = row.nama_desa || 'Kepenghuluan';
                    profilDesa.nama_penghulu = row.nama_kepala_desa || `Penghulu ${row.nama_desa}`;
                    profilDesa.kecamatan = row.kecamatan || 'Rokan Hilir';
                    profilDesa.alamat = row.alamat || '';
                }
            }

            // Hitung statistik ringkas
            const totalSurat = dataSurat.length;
            const currentMonth = new Date().getMonth() + 1;
            const currentYear = new Date().getFullYear();
            const suratBulanIni = dataSurat.filter(s => {
                const d = new Date(s.tanggal_surat);
                return (d.getMonth() + 1) === currentMonth && d.getFullYear() === currentYear;
            }).length;

            res.render('surat_layanan', {
                title: 'Layanan Surat Pengantar Warga - SIAD 2.0',
                data: dataSurat,
                profilDesa,
                totalSurat,
                suratBulanIni,
                filterJenis,
                searchQuery: q,
                status: req.query.status
            });

        } catch (error) {
            console.error('[PELAYANAN:getIndex error]', error);
            res.redirect('/surat?tab=masuk&error=' + encodeURIComponent('Gagal memuat layanan surat warga.'));
        }
    },

    // 2. Simpan surat pengantar baru
    postBuat: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            const {
                jenis_surat, nomor_surat, tanggal_surat, nik, nama_warga,
                tempat_lahir, tanggal_lahir, jenis_kelamin, agama, pekerjaan,
                alamat, keperluan, keterangan_tambahan, penandatangan_nama, penandatangan_jabatan
            } = req.body;

            if (!nama_warga || !nik || !jenis_surat) {
                return res.redirect('/surat/layanan?status=error_validation');
            }

            // Generate nomor surat otomatis jika tidak diisi manual
            let finalNomorSurat = (nomor_surat || '').trim();
            const tgl = tanggal_surat ? new Date(tanggal_surat) : new Date();
            const tahun = tgl.getFullYear();
            const bulanRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][tgl.getMonth()];

            if (!finalNomorSurat) {
                const countRes = await db.query(
                    'SELECT COUNT(*) as total FROM surat_pelayanan WHERE kepenghuluan_id = $1 AND EXTRACT(YEAR FROM tanggal_surat) = $2',
                    [did || 1, tahun]
                );
                const nextSeq = String(Number(countRes.rows[0].total || 0) + 1).padStart(3, '0');
                
                let kodeKlasifikasi = '470';
                if (jenis_surat === 'SKU') kodeKlasifikasi = '510';
                else if (jenis_surat === 'SKTM') kodeKlasifikasi = '460';
                else if (jenis_surat === 'SKCK') kodeKlasifikasi = '331';
                else if (jenis_surat === 'DOMISILI') kodeKlasifikasi = '470';
                else if (jenis_surat === 'KEMATIAN') kodeKlasifikasi = '472.12';
                else if (jenis_surat === 'KELAHIRAN') kodeKlasifikasi = '472.11';
                
                finalNomorSurat = `${kodeKlasifikasi}/${nextSeq}/PEM/${bulanRomawi}/${tahun}`;
            }

            // Simpan ke tabel surat_pelayanan
            const insertSql = `
                INSERT INTO surat_pelayanan (
                    kepenghuluan_id, jenis_surat, nomor_surat, tanggal_surat, nik, nama_warga,
                    tempat_lahir, tanggal_lahir, jenis_kelamin, agama, pekerjaan,
                    alamat, keperluan, keterangan_tambahan, penandatangan_nama, penandatangan_jabatan, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                RETURNING id
            `;
            const params = [
                did,
                jenis_surat,
                finalNomorSurat,
                tanggal_surat || new Date().toISOString().split('T')[0],
                nik.trim(),
                nama_warga.trim(),
                tempat_lahir || '',
                tanggal_lahir || null,
                jenis_kelamin || 'Laki-laki',
                agama || 'Islam',
                pekerjaan || 'Wiraswasta',
                alamat || '',
                keperluan || '',
                keterangan_tambahan || '',
                penandatangan_nama || 'Penghulu',
                penandatangan_jabatan || 'Penghulu',
                req.session?.userId || null
            ];

            const insertRes = await db.query(insertSql, params);
            const createdId = insertRes.rows[0].id;

            // Otomatis sinkronkan catatan ke buku agenda surat_keluar
            try {
                const perihalSurat = `Surat ${jenis_surat} an. ${nama_warga.trim()} (${keperluan || 'Keperluan Warga'})`;
                await db.query(`
                    INSERT INTO surat_keluar (nomor_surat, tanggal_surat, tujuan, perihal, kepenghuluan_id)
                    VALUES ($1, $2, $3, $4, $5)
                `, [finalNomorSurat, tanggal_surat || new Date().toISOString().split('T')[0], nama_warga.trim(), perihalSurat, did]);
            } catch (errSync) {
                console.warn('[PELAYANAN:syncSuratKeluar]', errSync.message);
            }

            // Catat ke Audit Trail
            recordAudit(req, {
                action: 'BUAT_SURAT_LAYANAN',
                entity: 'SURAT_PELAYANAN',
                recordId: createdId,
                details: `Menerbitkan Surat ${jenis_surat} No. ${finalNomorSurat} untuk warga an. ${nama_warga.trim()} (NIK: ${nik})`
            });

            res.redirect(`/surat/layanan?status=success&id=${createdId}`);

        } catch (error) {
            console.error('[PELAYANAN:postBuat error]', error);
            res.redirect('/surat/layanan?status=error');
        }
    },

    // 3. Cetak Surat Pengantar Resmi (Format A4 Portrait & QR Code Validasi)
    getCetak: async (req, res) => {
        try {
            const { id } = req.params;
            const did = ac.getDesaId(req);
            const admin = ac.isAdmin(req);

            let sql = `
                SELECT sp.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama,
                       pd.nama_kepala_desa, pd.alamat AS alamat_kantor
                FROM surat_pelayanan sp
                LEFT JOIN kepenghuluan k ON sp.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                WHERE sp.id = $1
            `;
            let params = [id];

            // Proteksi IDOR isolasi kepenghuluan
            if (!admin && did) {
                sql += ' AND (sp.kepenghuluan_id = $2 OR sp.kepenghuluan_id IS NULL)';
                params.push(did);
            }

            const result = await db.query(sql, params);
            if (result.rows.length === 0) {
                return res.status(404).send('Surat tidak ditemukan atau Anda tidak memiliki akses.');
            }

            const surat = result.rows[0];

            // Generate QR Code untuk validasi keaslian dokumen
            const validasiUrl = `https://siad-v2.com/validasi/surat/${surat.id}`;
            const qrCodeDataUrl = await QRCode.toDataURL(validasiUrl, {
                width: 130,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });

            res.render('surat_layanan_cetak', {
                title: `Cetak Surat ${surat.jenis_surat} - ${surat.nama_warga}`,
                surat,
                qrCodeDataUrl,
                validasiUrl,
                layout: false // Render mandiri tanpa layout master agar siap cetak A4
            });

        } catch (error) {
            console.error('[PELAYANAN:getCetak error]', error);
            res.status(500).send('Terjadi kendala saat merender surat resmi: ' + error.message);
        }
    },

    // 4. Hapus surat layanan warga
    postHapus: async (req, res) => {
        try {
            const { id } = req.body;
            const did = ac.getDesaId(req);
            const admin = ac.isAdmin(req);

            let sql = 'DELETE FROM surat_pelayanan WHERE id = $1';
            let params = [id];

            if (!admin && did) {
                sql += ' AND (kepenghuluan_id = $2 OR kepenghuluan_id IS NULL)';
                params.push(did);
            }

            const delRes = await db.query(sql, params);

            recordAudit(req, {
                action: 'HAPUS_SURAT_LAYANAN',
                entity: 'SURAT_PELAYANAN',
                recordId: id,
                details: `Menghapus arsip surat layanan ID: ${id}`
            });

            res.redirect('/surat/layanan?status=deleted');

        } catch (error) {
            console.error('[PELAYANAN:postHapus error]', error);
            res.redirect('/surat/layanan?status=error_delete');
        }
    },

    // 5. Halaman Publik Validasi Keaslian Surat (Scan QR Code)
    getValidasiPublik: async (req, res) => {
        try {
            const { id } = req.params;
            const sql = `
                SELECT sp.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama
                FROM surat_pelayanan sp
                LEFT JOIN kepenghuluan k ON sp.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                WHERE sp.id = $1
            `;
            const result = await db.query(sql, [id]);

            if (result.rows.length === 0) {
                return res.status(404).render('validasi_surat_publik', {
                    title: 'Verifikasi Dokumen - SIAD 2.0',
                    isValid: false,
                    surat: null,
                    layout: false
                });
            }

            res.render('validasi_surat_publik', {
                title: 'Verifikasi Dokumen Resmi - SIAD 2.0',
                isValid: true,
                surat: result.rows[0],
                layout: false
            });

        } catch (error) {
            console.error('[PELAYANAN:getValidasiPublik error]', error);
            res.status(500).send('Terjadi kendala saat memverifikasi dokumen.');
        }
    }
};

module.exports = pelayananController;
