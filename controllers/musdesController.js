const db = require('../config/db');
const ac = require('../middleware/access');
const { recordAudit } = require('../services/auditLog');
const { uploadToDrive, deleteFromDrive } = require('../config/drive');

const musdesController = {
    // 1. Tampilkan Halaman Utama Musyawarah Desa
    getIndex: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;

            const tahun = req.query.tahun || new Date().getFullYear();
            const jenis = req.query.jenis || 'Semua';
            const status = req.query.status || 'Semua';
            const search = req.query.search || '';

            let sql = `
                SELECT m.*, k.nama AS nama_kepenghuluan, kec.nama AS nama_kecamatan
                FROM musdes m
                LEFT JOIN kepenghuluan k ON m.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                WHERE EXTRACT(YEAR FROM m.tanggal) = $1
            `;
            let params = [tahun];
            let paramIdx = 2;

            if (!isSuper && did) {
                sql += ` AND (m.kepenghuluan_id = $${paramIdx} OR m.kepenghuluan_id IS NULL)`;
                params.push(did);
                paramIdx++;
            }

            if (jenis !== 'Semua') {
                sql += ` AND m.jenis_musdes = $${paramIdx}`;
                params.push(jenis);
                paramIdx++;
            }

            if (status !== 'Semua') {
                sql += ` AND m.status_keputusan = $${paramIdx}`;
                params.push(status);
                paramIdx++;
            }

            if (search) {
                sql += ` AND (m.judul_musdes ILIKE $${paramIdx} OR m.lokasi ILIKE $${paramIdx} OR m.pimpinan_sidang ILIKE $${paramIdx})`;
                params.push(`%${search}%`);
                paramIdx++;
            }

            sql += ' ORDER BY m.tanggal DESC, m.id DESC';

            const result = await db.query(sql, params);
            const musdesList = result.rows;

            // Statistik Ringkas
            const stats = {
                total: musdesList.length,
                disepakati: musdesList.filter(m => m.status_keputusan === 'Disepakati').length,
                catatan: musdesList.filter(m => m.status_keputusan === 'Disepakati dengan Catatan').length,
                ditunda: musdesList.filter(m => m.status_keputusan === 'Ditunda').length
            };

            res.render('musdes', {
                title: 'Modul Musyawarah Desa (Musdes) - SIAD 2.0',
                musdesList,
                stats,
                tahun,
                jenis,
                status,
                search,
                statusMsg: req.query.msg || null,
                statusType: req.query.status_type || 'success'
            });
        } catch (error) {
            console.error('[MUSDES:getIndex]', error);
            res.status(500).render('error', { message: 'Gagal memuat modul musyawarah desa: ' + error.message });
        }
    },

    // 2. Tambah Data Musyawarah Baru
    postTambah: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            const {
                judul_musdes,
                jenis_musdes,
                tanggal,
                waktu,
                lokasi,
                pimpinan_sidang,
                notulis,
                jumlah_peserta,
                status_keputusan,
                ringkasan_hasil
            } = req.body;

            let file_berita_acara = null;
            let file_notulensi = null;
            let file_daftar_hadir = null;

            if (req.files) {
                if (req.files.file_berita_acara && req.files.file_berita_acara[0]) {
                    const f = req.files.file_berita_acara[0];
                    const driveRes = await uploadToDrive(f.buffer, f.originalname, f.mimetype, 'Musdes/BeritaAcara');
                    file_berita_acara = driveRes ? (driveRes.webContentLink || driveRes.webViewLink || driveRes.id) : null;
                }
                if (req.files.file_notulensi && req.files.file_notulensi[0]) {
                    const f = req.files.file_notulensi[0];
                    const driveRes = await uploadToDrive(f.buffer, f.originalname, f.mimetype, 'Musdes/Notulensi');
                    file_notulensi = driveRes ? (driveRes.webContentLink || driveRes.webViewLink || driveRes.id) : null;
                }
                if (req.files.file_daftar_hadir && req.files.file_daftar_hadir[0]) {
                    const f = req.files.file_daftar_hadir[0];
                    const driveRes = await uploadToDrive(f.buffer, f.originalname, f.mimetype, 'Musdes/DaftarHadir');
                    file_daftar_hadir = driveRes ? (driveRes.webContentLink || driveRes.webViewLink || driveRes.id) : null;
                }
            }

            const insertSql = `
                INSERT INTO musdes (
                    kepenghuluan_id, judul_musdes, jenis_musdes, tanggal, waktu,
                    lokasi, pimpinan_sidang, notulis, jumlah_peserta, status_keputusan,
                    ringkasan_hasil, file_berita_acara, file_notulensi, file_daftar_hadir,
                    created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING id
            `;
            const params = [
                did || 1,
                judul_musdes,
                jenis_musdes || 'Musdes RKP',
                tanggal || new Date(),
                waktu || '09:00 WIB s/d Selesai',
                lokasi || 'Aula Kantor Kepenghuluan',
                pimpinan_sidang || 'Ketua BPKep',
                notulis || 'Sekretaris Desa',
                parseInt(jumlah_peserta) || 0,
                status_keputusan || 'Disepakati',
                ringkasan_hasil || '',
                file_berita_acara,
                file_notulensi,
                file_daftar_hadir,
                req.session && req.session.user ? req.session.user.id : null
            ];

            const result = await db.query(insertSql, params);
            const newId = result.rows[0].id;

            await recordAudit({
                req,
                aksi: 'TAMBAH_MUSDES',
                modul: 'MUSDES',
                deskripsi: `Mencatat agenda musdes: ${judul_musdes} (ID: ${newId})`,
                data_id: newId
            });

            res.redirect('/musdes?msg=' + encodeURIComponent('Agenda Musyawarah Desa berhasil disimpan.') + '&status_type=success');
        } catch (error) {
            console.error('[MUSDES:postTambah]', error);
            res.redirect('/musdes?msg=' + encodeURIComponent('Gagal menyimpan musdes: ' + error.message) + '&status_type=danger');
        }
    },

    // 3. Hapus Data Musyawarah
    postHapus: async (req, res) => {
        try {
            const id = req.params.id;
            const did = ac.getDesaId(req);
            const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;

            let checkSql = 'SELECT * FROM musdes WHERE id = $1';
            let checkParams = [id];
            if (!isSuper && did) {
                checkSql += ' AND (kepenghuluan_id = $2 OR kepenghuluan_id IS NULL)';
                checkParams.push(did);
            }

            const check = await db.query(checkSql, checkParams);
            if (check.rows.length === 0) {
                return res.redirect('/musdes?msg=' + encodeURIComponent('Data tidak ditemukan atau Anda tidak memiliki akses.') + '&status_type=warning');
            }

            const m = check.rows[0];

            // Bersihkan file Google Drive jika ada
            if (m.file_berita_acara) await deleteFromDrive(m.file_berita_acara).catch(() => {});
            if (m.file_notulensi) await deleteFromDrive(m.file_notulensi).catch(() => {});
            if (m.file_daftar_hadir) await deleteFromDrive(m.file_daftar_hadir).catch(() => {});

            await db.query('DELETE FROM musdes WHERE id = $1', [id]);

            await recordAudit({
                req,
                aksi: 'HAPUS_MUSDES',
                modul: 'MUSDES',
                deskripsi: `Menghapus arsip musdes: ${m.judul_musdes} (ID: ${id})`,
                data_id: id
            });

            res.redirect('/musdes?msg=' + encodeURIComponent('Data Musyawarah Desa berhasil dihapus.') + '&status_type=success');
        } catch (error) {
            console.error('[MUSDES:postHapus]', error);
            res.redirect('/musdes?msg=' + encodeURIComponent('Gagal menghapus musdes: ' + error.message) + '&status_type=danger');
        }
    },

    // 4. Cetak Berita Acara Musyawarah Resmi
    getCetakBeritaAcara: async (req, res) => {
        try {
            const id = req.params.id;
            const did = ac.getDesaId(req);
            const isSuper = ac.isSuperAdmin ? ac.isSuperAdmin(req) : false;

            let sql = `
                SELECT m.*, k.nama AS nama_kepenghuluan, kec.nama AS nama_kecamatan,
                       pd.nama_kepala_desa AS prof_kades, pd.alamat AS prof_alamat
                FROM musdes m
                LEFT JOIN kepenghuluan k ON m.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                WHERE m.id = $1
            `;
            let params = [id];
            if (!isSuper && did) {
                sql += ' AND (m.kepenghuluan_id = $2 OR m.kepenghuluan_id IS NULL)';
                params.push(did);
            }

            const result = await db.query(sql, params);
            if (result.rows.length === 0) {
                return res.status(404).send('Data musyawarah tidak ditemukan.');
            }

            const musdes = result.rows[0];

            res.render('musdes_berita_acara_cetak', {
                title: `Berita Acara - ${musdes.judul_musdes}`,
                musdes,
                layout: false
            });
        } catch (error) {
            console.error('[MUSDES:getCetakBeritaAcara]', error);
            res.status(500).send('Gagal membuat dokumen cetak: ' + error.message);
        }
    }
};

module.exports = musdesController;
