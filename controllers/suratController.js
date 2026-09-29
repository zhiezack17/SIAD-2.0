const db = require('../config/db');
const { uploadToDrive } = require('../config/drive');
const ac = require('../middleware/access');
const ExcelJS = require('exceljs');

const suratController = {
    getIndex: async (req, res) => {
        try {
            const tab = req.query.tab || 'masuk';
            let data = [];
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            if (tab === 'masuk') {
                let sql = `
                    SELECT sm.*, 
                           ds.id AS disposisi_id,
                           ds.dari_nama AS disposisi_dari_nama,
                           ds.dari_jabatan AS disposisi_dari_jabatan,
                           ds.ke_jabatan AS disposisi_ke_jabatan,
                           ds.ke_nama AS disposisi_ke_nama,
                           ds.instruksi AS disposisi_instruksi,
                           ds.catatan AS disposisi_catatan,
                           ds.sifat AS disposisi_sifat,
                           ds.status AS disposisi_status,
                           ds.created_at AS disposisi_tanggal
                    FROM surat_masuk sm
                    LEFT JOIN (
                        SELECT DISTINCT ON (surat_id) *
                        FROM disposisi_surat
                        ORDER BY surat_id, id DESC
                    ) ds ON sm.id = ds.surat_id
                    WHERE 1=1
                `;
                let p = []; let idx = 1;
                if (did) {
                    sql += ` AND (sm.kepenghuluan_id = $${idx} OR sm.kepenghuluan_id IS NULL)`;
                    p.push(did);
                    idx++;
                } else if (!admin && !did) {
                    sql += ` AND sm.kepenghuluan_id IS NULL`;
                }
                sql += ' ORDER BY sm.id DESC';
                const result = await db.query(sql, p);
                data = result.rows;
            } else if (tab === 'keluar') {
                let sql = 'SELECT * FROM surat_keluar WHERE 1=1';
                let p = []; let idx = 1;
                if (did) {
                    sql += ` AND (kepenghuluan_id = $${idx} OR kepenghuluan_id IS NULL)`;
                    p.push(did);
                    idx++;
                } else if (!admin && !did) {
                    sql += ` AND kepenghuluan_id IS NULL`;
                }
                sql += ' ORDER BY id DESC';
                const result = await db.query(sql, p);
                data = result.rows;
            }

            res.render('surat', { title: 'Manajemen Surat - SIAD 2.0', tab: tab, data: data });
        } catch (error) {
            res.send('<div style="padding:40px;font-family:sans-serif;"><h2>💥 Oops! Ada Error:</h2><p style="color:red;font-size:18px;">' + error.message + '</p><pre style="background:#f1f5f9;padding:15px;border-radius:8px;">' + error.stack + '</pre></div>');
        }
    },
    postSuratMasuk: async (req, res) => {
        try {
            const { nomor_surat, tanggal_surat, pengirim, perihal } = req.body;
            const userDesa = ac.getDesaNama(req, 'Desa');
            const did = ac.getDesaId(req);
            let driveUrl = '';
            if (req.file) {
                const driveData = await uploadToDrive(req.file, userDesa, 'Surat', 'Surat Masuk');
                if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
            }
            const insertSql = did
                ? 'INSERT INTO surat_masuk (nomor_surat, tanggal_surat, pengirim, perihal, file_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5, $6)'
                : 'INSERT INTO surat_masuk (nomor_surat, tanggal_surat, pengirim, perihal, file_url) VALUES ($1, $2, $3, $4, $5)';
            const params = did
                ? [nomor_surat, tanggal_surat, pengirim, perihal, driveUrl, did]
                : [nomor_surat, tanggal_surat, pengirim, perihal, driveUrl];
            await db.query(insertSql, params);
            res.redirect('/surat?tab=masuk&status=success');
        } catch (error) {
            res.send('<div style="padding:40px;font-family:sans-serif;"><h2>💥 Oops! Gagal Upload Surat Masuk:</h2><p style="color:red;">' + error.message + '</p></div>');
        }
    },
    postSuratKeluar: async (req, res) => {
        try {
            const { nomor_surat, tanggal_surat, tujuan, perihal } = req.body;
            const userDesa = ac.getDesaNama(req, 'Desa');
            const did = ac.getDesaId(req);
            let driveUrl = '';
            if (req.file) {
                const driveData = await uploadToDrive(req.file, userDesa, 'Surat', 'Surat Keluar');
                if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
            }
            const insertSql = did
                ? 'INSERT INTO surat_keluar (nomor_surat, tanggal_surat, tujuan, perihal, file_url, kepenghuluan_id) VALUES ($1, $2, $3, $4, $5, $6)'
                : 'INSERT INTO surat_keluar (nomor_surat, tanggal_surat, tujuan, perihal, file_url) VALUES ($1, $2, $3, $4, $5)';
            const params = did
                ? [nomor_surat, tanggal_surat, tujuan, perihal, driveUrl, did]
                : [nomor_surat, tanggal_surat, tujuan, perihal, driveUrl];
            try {
                await db.query(insertSql, params);
            } catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    const fallback = 'INSERT INTO surat_keluar (nomor_surat, tanggal_surat, tujuan, perihal, file_url) VALUES ($1, $2, $3, $4, $5)';
                    await db.query(fallback, [nomor_surat, tanggal_surat, tujuan, perihal, driveUrl]);
                } else throw e;
            }
            res.redirect('/surat?tab=keluar&status=success');
        } catch (error) {
            res.send('<div style="padding:40px;font-family:sans-serif;"><h2>💥 Oops! Gagal Upload Surat Keluar:</h2><p style="color:red;">' + error.message + '</p></div>');
        }
    },
    deleteSurat: async (req, res) => {
        try {
            const { id, type } = req.body;
            const admin = ac.isAdmin(req); const did = ac.getDesaId(req);
            let sql, p;
            const tbl = type === 'masuk' ? 'surat_masuk' : 'surat_keluar';
            if (admin || !did) {
                sql = `DELETE FROM ${tbl} WHERE id = $1`; p = [id];
            } else {
                sql = `DELETE FROM ${tbl} WHERE id = $1 AND (kepenghuluan_id = $2 OR kepenghuluan_id IS NULL)`; p = [id, did];
            }
            try { await db.query(sql, p); }
            catch (e) {
                if (/column "kepenghuluan_id".*does not exist/i.test(e.message)) {
                    await db.query(`DELETE FROM ${tbl} WHERE id = $1`, [id]);
                } else throw e;
            }
            res.redirect('/surat?tab=' + type);
        } catch (error) {
            res.send('<div style="padding:40px;font-family:sans-serif;"><h2>💥 Oops! Gagal Hapus:</h2><p style="color:red;">' + error.message + '</p></div>');
        }
    },
    editSurat: async (req, res) => { res.redirect('/surat'); },

    // === MODUL DISPOSISI SURAT MASUK ===
    postDisposisi: async (req, res) => {
        try {
            const { surat_id, sifat, ke_jabatan, ke_nama, instruksi, catatan } = req.body;
            const u = req.session.user || {};
            const did = ac.getDesaId(req);
            const admin = ac.isAdmin(req);

            // Ambil kepenghuluan_id dari surat_masuk yang didisposisikan
            const sCheck = await db.query('SELECT kepenghuluan_id FROM surat_masuk WHERE id = $1', [surat_id]);
            const suratDesaId = sCheck.rows[0]?.kepenghuluan_id;
            const targetDesaId = (admin && did) ? did : (suratDesaId || did || 1);

            // Cari profil desa dan penghulu resmi dari desa tersebut
            const kRes = await db.query(`
                SELECT k.nama AS kep_nama, pd.nama_kepala_desa, p.nama_lengkap AS user_penghulu
                FROM kepenghuluan k
                LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                LEFT JOIN pengguna p ON p.kepenghuluan_id = k.id AND (p.role = 'penghulu' OR p.peran = 'pimpinan')
                WHERE k.id = $1
                ORDER BY pd.id ASC
                LIMIT 1
            `, [targetDesaId]);

            const desaInfo = kRes.rows[0] || {};
            const desaNama = desaInfo.kep_nama || 'Kepenghuluan';
            const penghuluOfficial = desaInfo.nama_kepala_desa || desaInfo.user_penghulu || `Penghulu ${desaNama}`;

            let dari_user_id = u.id || null;
            let dari_nama = '';
            let dari_jabatan = '';

            const userRole = String(u.role || u.peran || '').toLowerCase();
            if (userRole.includes('sek')) {
                dari_nama = u.nama_lengkap || u.nama || 'Sekretaris Kepenghuluan';
                dari_jabatan = `Sekretaris Kepenghuluan ${desaNama}`;
            } else if (userRole === 'penghulu' || userRole === 'pimpinan') {
                dari_nama = u.nama_lengkap || penghuluOfficial;
                dari_jabatan = `Penghulu ${desaNama}`;
            } else {
                // Admin atau operator menginputkan disposisi resmi atas nama Penghulu desa terkait
                dari_nama = penghuluOfficial;
                dari_jabatan = `Penghulu ${desaNama}`;
            }

            // Jika instruksi dikirim sebagai array dari form checkbox
            const instruksiTeks = Array.isArray(instruksi) ? instruksi.join(', ') : (instruksi || '');

            // Bersihkan riwayat disposisi lama untuk surat ini agar selalu tersimpan yang terkini
            await db.query('DELETE FROM disposisi_surat WHERE surat_id = $1', [surat_id]);

            const insertSql = `
                INSERT INTO disposisi_surat (
                    surat_id, dari_user_id, dari_nama, dari_jabatan,
                    ke_jabatan, ke_nama, instruksi, catatan, sifat, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'diteruskan', NOW())
            `;
            await db.query(insertSql, [
                surat_id,
                dari_user_id,
                dari_nama,
                dari_jabatan,
                ke_jabatan || 'Sekretaris Kepenghuluan',
                ke_nama || null,
                instruksiTeks,
                catatan || null,
                sifat || 'Biasa'
            ]);

            res.redirect('/surat?tab=masuk&status=success_disposisi');
        } catch (error) {
            console.error('[surat:postDisposisi]', error);
            res.redirect('/surat?tab=masuk&status=error&msg=' + encodeURIComponent(error.message));
        }
    },

    // === CETAK LEMBAR DISPOSISI RESMI (STANDAR ROHIL) ===
    getCetakDisposisi: async (req, res) => {
        try {
            const suratId = req.params.id;
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            let sSql = `
                SELECT sm.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama,
                       ds.id AS disposisi_id,
                       ds.dari_nama AS disposisi_dari_nama,
                       ds.dari_jabatan AS disposisi_dari_jabatan,
                       ds.ke_jabatan AS disposisi_ke_jabatan,
                       ds.ke_nama AS disposisi_ke_nama,
                       ds.instruksi AS disposisi_instruksi,
                       ds.catatan AS disposisi_catatan,
                       ds.sifat AS disposisi_sifat,
                       ds.status AS disposisi_status,
                       ds.created_at AS disposisi_tanggal
                FROM surat_masuk sm
                LEFT JOIN kepenghuluan k ON sm.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                LEFT JOIN (
                    SELECT DISTINCT ON (surat_id) *
                    FROM disposisi_surat
                    ORDER BY surat_id, id DESC
                ) ds ON sm.id = ds.surat_id
                WHERE sm.id = $1
            `;
            let sP = [suratId];
            if (!admin && did) {
                sSql += ` AND (sm.kepenghuluan_id = $2 OR sm.kepenghuluan_id IS NULL)`;
                sP.push(did);
            }
            const sRes = await db.query(sSql, sP);
            if (sRes.rows.length === 0) return res.redirect('/surat?tab=masuk');

            const surat = sRes.rows[0];

            // Tentukan target desa context:
            // 1. Jika Admin sedang memilih desa tertentu di switcher (did), gunakan did tersebut.
            // 2. Jika tidak, prioritaskan kepenghuluan_id milik surat, lalu fallback ke did aktif atau 1.
            const targetDesaId = (admin && did) ? did : (surat.kepenghuluan_id || did || 1);

            // Query data resmi desa target (kepenghuluan, kecamatan, profil_desa, penghulu)
            const profRes = await db.query(`
                SELECT k.id AS kep_id, k.nama AS kep_nama, kec.nama AS kec_nama,
                       pd.nama_kepala_desa AS prof_kades, pd.alamat AS prof_alamat,
                       p.nama_lengkap AS user_penghulu
                FROM kepenghuluan k
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                LEFT JOIN pengguna p ON p.kepenghuluan_id = k.id AND (p.role = 'penghulu' OR p.peran = 'pimpinan')
                WHERE k.id = $1
                ORDER BY pd.id ASC
                LIMIT 1
            `, [targetDesaId]);

            if (profRes.rows.length > 0) {
                const pRow = profRes.rows[0];
                surat.kepenghuluan_nama = pRow.kep_nama;
                surat.kecamatan_nama = pRow.kec_nama;
                surat.alamat_desa = pRow.prof_alamat || `Kecamatan ${pRow.kec_nama}, Kabupaten Rokan Hilir`;

                const officialPenghulu = pRow.prof_kades || pRow.user_penghulu || (`Penghulu ${pRow.kep_nama}`);
                const officialJabatan = `Penghulu ${pRow.kep_nama}`;

                // Sesuaikan nama & jabatan di lembar tanda tangan disposisi:
                // - Jika disposisi belum pernah diisi
                // - Atau jika admin sedang memilih desa lain via topbar switcher (did)
                // - Atau jika kepenghuluan surat berbeda dengan konteks desa yang aktif
                // - Atau jika nama penandatangan lama mengandung 'admin' atau masih membawa nama desa Bagan Batu saat memilih desa lain
                const isFromOtherDesa = surat.kepenghuluan_id && Number(surat.kepenghuluan_id) !== Number(targetDesaId);
                const isBaganBatuMismatch = /bagan batu/i.test(String(surat.disposisi_dari_nama) + ' ' + String(surat.disposisi_dari_jabatan)) && !/bagan batu/i.test(pRow.kep_nama);
                const isAdminName = /admin/i.test(String(surat.disposisi_dari_nama));

                if (!surat.disposisi_dari_nama || (admin && did) || isFromOtherDesa || isBaganBatuMismatch || isAdminName) {
                    surat.disposisi_dari_nama = officialPenghulu;
                    surat.disposisi_dari_jabatan = officialJabatan;
                }
            } else {
                surat.kepenghuluan_nama = surat.kepenghuluan_nama || 'Bagan Batu';
                surat.kecamatan_nama = surat.kecamatan_nama || 'Bagan Sinembah';
                surat.alamat_desa = surat.alamat_desa || 'Kabupaten Rokan Hilir';
            }

            res.render('surat_disposisi_cetak', {
                layout: false,
                title: `Lembar Disposisi - ${surat.nomor_surat}`,
                surat
            });
        } catch (error) {
            console.error('[surat:getCetakDisposisi]', error);
            res.redirect('/surat?tab=masuk');
        }
    },

    // === CETAK BUKU AGENDA SURAT (MASUK / KELUAR) ===
    getCetakAgenda: async (req, res) => {
        try {
            const tab = req.query.tab === 'keluar' ? 'keluar' : 'masuk';
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const { start_date, end_date, tahun } = req.query;

            const targetDesaId = did || 1;
            const desa = await getDesaMetadata(targetDesaId);
            const data = await fetchAgendaData(tab, did, admin, start_date, end_date, tahun);

            const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const today = new Date();
            const tanggalCetak = `${today.getDate()} ${bulanIndo[today.getMonth()]} ${today.getFullYear()}`;

            let periodeTeks = 'Semua Periode';
            if (start_date && end_date) {
                periodeTeks = `Periode: ${start_date} s.d. ${end_date}`;
            } else if (tahun && tahun !== 'all') {
                periodeTeks = `Tahun Anggaran ${tahun}`;
            } else {
                periodeTeks = `Tahun Anggaran ${today.getFullYear()}`;
            }

            res.render('surat_agenda_cetak', {
                layout: false,
                title: `Buku Agenda ${tab === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'} - Kepenghuluan ${desa.nama}`,
                tab,
                desa,
                data,
                periodeTeks,
                tanggalCetak
            });
        } catch (error) {
            console.error('[surat:getCetakAgenda]', error);
            res.redirect('/surat?tab=' + (req.query.tab || 'masuk'));
        }
    },

    // === EXPORT EXCEL BUKU AGENDA SURAT ===
    getExportAgendaExcel: async (req, res) => {
        try {
            const tab = req.query.tab === 'keluar' ? 'keluar' : 'masuk';
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const { start_date, end_date, tahun } = req.query;

            const targetDesaId = did || 1;
            const desa = await getDesaMetadata(targetDesaId);
            const data = await fetchAgendaData(tab, did, admin, start_date, end_date, tahun);

            const bulanIndo = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            const today = new Date();
            const tanggalCetak = `${today.getDate()} ${bulanIndo[today.getMonth()]} ${today.getFullYear()}`;

            let periodeTeks = 'Semua Periode';
            if (start_date && end_date) {
                periodeTeks = `Periode: ${start_date} s.d. ${end_date}`;
            } else if (tahun && tahun !== 'all') {
                periodeTeks = `Tahun Anggaran ${tahun}`;
            } else {
                periodeTeks = `Tahun Anggaran ${today.getFullYear()}`;
            }

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'SIAD 2.0 - Kepenghuluan';
            workbook.lastModifiedBy = req.session.user?.nama || 'SIAD 2.0';
            workbook.created = new Date();

            const isMasuk = tab === 'masuk';
            const sheetTitle = isMasuk ? 'Agenda Surat Masuk' : 'Agenda Surat Keluar';
            const ws = workbook.addWorksheet(sheetTitle, {
                pageSetup: { orientation: 'landscape', paperSize: 9 }
            });

            // Styling constants
            const borderThin = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            const lastColLetter = isMasuk ? 'I' : 'G';

            // KOP LAPORAN
            ws.mergeCells(`A1:${lastColLetter}1`);
            ws.getCell('A1').value = 'PEMERINTAH KABUPATEN ROKAN HILIR';
            ws.getCell('A1').font = { name: 'Arial', size: 12, bold: true };
            ws.getCell('A1').alignment = { horizontal: 'center' };

            ws.mergeCells(`A2:${lastColLetter}2`);
            ws.getCell('A2').value = `KECAMATAN ${desa.kecamatan.toUpperCase()}`;
            ws.getCell('A2').font = { name: 'Arial', size: 11, bold: true };
            ws.getCell('A2').alignment = { horizontal: 'center' };

            ws.mergeCells(`A3:${lastColLetter}3`);
            ws.getCell('A3').value = `KEPENGHULUAN ${desa.nama.toUpperCase()}`;
            ws.getCell('A3').font = { name: 'Arial', size: 14, bold: true };
            ws.getCell('A3').alignment = { horizontal: 'center' };

            ws.mergeCells(`A4:${lastColLetter}4`);
            ws.getCell('A4').value = desa.alamat;
            ws.getCell('A4').font = { name: 'Arial', size: 9, italic: true };
            ws.getCell('A4').alignment = { horizontal: 'center' };

            ws.mergeCells(`A6:${lastColLetter}6`);
            ws.getCell('A6').value = `BUKU AGENDA ${isMasuk ? 'SURAT MASUK' : 'SURAT KELUAR'}`;
            ws.getCell('A6').font = { name: 'Arial', size: 13, bold: true };
            ws.getCell('A6').alignment = { horizontal: 'center' };
            ws.getCell('A6').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2E8F0' }
            };

            ws.mergeCells(`A7:${lastColLetter}7`);
            ws.getCell('A7').value = periodeTeks.toUpperCase();
            ws.getCell('A7').font = { name: 'Arial', size: 10, bold: true };
            ws.getCell('A7').alignment = { horizontal: 'center' };

            // HEADER TABEL (Row 9)
            const headerRowIdx = 9;
            const headers = isMasuk ? [
                'NO', 'TGL TERIMA', 'NOMOR SURAT', 'TGL SURAT', 'PENGIRIM / ASAL', 
                'PERIHAL / ISI RINGKAS', 'SIFAT', 'DITERUSKAN KEPADA', 'INSTRUKSI DISPOSISI'
            ] : [
                'NO', 'TGL KIRIM', 'NOMOR SURAT', 'TGL SURAT', 'TUJUAN / PENERIMA', 
                'PERIHAL / ISI RINGKAS', 'STATUS BERKAS'
            ];

            const headerRow = ws.getRow(headerRowIdx);
            headerRow.values = headers;
            headerRow.height = 28;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E3A8A' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = borderThin;
            });

            // Set column widths
            if (isMasuk) {
                ws.getColumn(1).width = 6;   // No
                ws.getColumn(2).width = 14;  // Tgl Terima
                ws.getColumn(3).width = 24;  // Nomor Surat
                ws.getColumn(4).width = 14;  // Tgl Surat
                ws.getColumn(5).width = 26;  // Pengirim
                ws.getColumn(6).width = 38;  // Perihal
                ws.getColumn(7).width = 12;  // Sifat
                ws.getColumn(8).width = 22;  // Diteruskan
                ws.getColumn(9).width = 28;  // Instruksi
            } else {
                ws.getColumn(1).width = 6;   // No
                ws.getColumn(2).width = 14;  // Tgl Kirim
                ws.getColumn(3).width = 26;  // Nomor Surat
                ws.getColumn(4).width = 14;  // Tgl Surat
                ws.getColumn(5).width = 30;  // Tujuan
                ws.getColumn(6).width = 42;  // Perihal
                ws.getColumn(7).width = 18;  // Status Berkas
            }

            // ISI DATA
            let currentRow = headerRowIdx + 1;
            function fmtD(val) {
                if (!val) return '-';
                const d = new Date(val);
                if (isNaN(d.getTime())) return String(val);
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
            }

            if (data && data.length > 0) {
                data.forEach((r, idx) => {
                    const row = ws.getRow(currentRow);
                    if (isMasuk) {
                        const penerima = r.disposisi_ke_nama ? `${r.disposisi_ke_jabatan} (${r.disposisi_ke_nama})` : (r.disposisi_ke_jabatan || '-');
                        row.values = [
                            idx + 1,
                            fmtD(r.created_at || r.tanggal_surat),
                            r.nomor_surat || '-',
                            fmtD(r.tanggal_surat),
                            r.pengirim || '-',
                            r.perihal || '-',
                            r.disposisi_sifat || 'Biasa',
                            penerima,
                            r.disposisi_instruksi || r.disposisi_catatan || '-'
                        ];
                    } else {
                        row.values = [
                            idx + 1,
                            fmtD(r.created_at || r.tanggal_surat),
                            r.nomor_surat || '-',
                            fmtD(r.tanggal_surat),
                            r.tujuan || '-',
                            r.perihal || '-',
                            r.file_url ? 'Ada Arsip Digital' : '-'
                        ];
                    }

                    row.height = 24;
                    row.eachCell((cell, colNumber) => {
                        cell.font = { name: 'Arial', size: 9.5 };
                        cell.border = borderThin;
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: (colNumber === 1 || colNumber === 2 || colNumber === 4 || colNumber === 7) ? 'center' : 'left',
                            wrapText: true
                        };
                    });
                    currentRow++;
                });
            } else {
                const emptyRow = ws.getRow(currentRow);
                ws.mergeCells(`A${currentRow}:${lastColLetter}${currentRow}`);
                emptyRow.getCell(1).value = 'Belum ada catatan surat pada periode ini.';
                emptyRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                emptyRow.getCell(1).font = { name: 'Arial', size: 10, italic: true };
                emptyRow.height = 30;
                currentRow++;
            }

            // Tanda Tangan Pengesahan (3 baris setelah tabel)
            currentRow += 2;
            const sigPenghuluCol = 2;
            const sigSekretarisCol = isMasuk ? 8 : 6;

            ws.getCell(currentRow, sigPenghuluCol).value = 'Mengetahui,';
            ws.getCell(currentRow, sigSekretarisCol).value = `${desa.nama}, ${tanggalCetak}`;

            currentRow++;
            ws.getCell(currentRow, sigPenghuluCol).value = `Penghulu ${desa.nama}`;
            ws.getCell(currentRow, sigSekretarisCol).value = 'Sekretaris Kepenghuluan';
            ws.getCell(currentRow, sigPenghuluCol).font = { bold: true };
            ws.getCell(currentRow, sigSekretarisCol).font = { bold: true };

            currentRow += 4;
            ws.getCell(currentRow, sigPenghuluCol).value = desa.penghulu;
            ws.getCell(currentRow, sigSekretarisCol).value = desa.sekretaris;
            ws.getCell(currentRow, sigPenghuluCol).font = { bold: true, underline: true };
            ws.getCell(currentRow, sigSekretarisCol).font = { bold: true, underline: true };

            const cleanDesa = desa.nama.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `Buku_Agenda_${isMasuk ? 'Surat_Masuk' : 'Surat_Keluar'}_${cleanDesa}_${tahun || today.getFullYear()}.xlsx`;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            await workbook.xlsx.write(res);
            res.end();

        } catch (error) {
            console.error('[surat:getExportAgendaExcel]', error);
            res.redirect('/surat?tab=' + (req.query.tab || 'masuk'));
        }
    }
};

// Helper ambil profil desa untuk buku agenda
async function getDesaMetadata(targetDesaId) {
    const defaultDesa = {
        id: targetDesaId || 1,
        nama: 'Bagan Batu',
        kecamatan: 'Bagan Sinembah',
        alamat: 'Jl. Jenderal Sudirman No. 1, Bagan Batu, Kec. Bagan Sinembah, Kab. Rokan Hilir',
        penghulu: 'Penghulu Bagan Batu',
        sekretaris: 'Sekretaris Kepenghuluan'
    };

    try {
        const profRes = await db.query(`
            SELECT k.id AS kep_id, k.nama AS kep_nama, kec.nama AS kec_nama,
                   pd.nama_kepala_desa AS prof_kades, pd.alamat AS prof_alamat,
                   p.nama_lengkap AS user_penghulu
            FROM kepenghuluan k
            LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
            LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
            LEFT JOIN pengguna p ON p.kepenghuluan_id = k.id AND (p.role = 'penghulu' OR p.peran = 'pimpinan')
            WHERE k.id = $1
            ORDER BY pd.id ASC
            LIMIT 1
        `, [targetDesaId || 1]);

        if (profRes.rows.length > 0) {
            const row = profRes.rows[0];
            defaultDesa.id = row.kep_id;
            defaultDesa.nama = row.kep_nama || 'Kepenghuluan';
            defaultDesa.kecamatan = row.kec_nama || 'Bagan Sinembah';
            defaultDesa.alamat = row.prof_alamat || `Kecamatan ${row.kec_nama || 'Bagan Sinembah'}, Kabupaten Rokan Hilir`;
            defaultDesa.penghulu = row.prof_kades || row.user_penghulu || `Penghulu ${row.kep_nama}`;
        }

        const sekRes = await db.query(`
            SELECT nama_lengkap, nama FROM pengguna 
            WHERE kepenghuluan_id = $1 AND (role ILIKE '%sek%' OR peran ILIKE '%sek%')
            ORDER BY id ASC LIMIT 1
        `, [targetDesaId || 1]);
        if (sekRes.rows.length > 0) {
            defaultDesa.sekretaris = sekRes.rows[0].nama_lengkap || sekRes.rows[0].nama || 'Sekretaris Kepenghuluan';
        }
    } catch (e) {
        console.error('[getDesaMetadata error]', e.message);
    }
    return defaultDesa;
}

// Helper query data agenda surat
async function fetchAgendaData(tab, did, admin, startDate, endDate, tahun) {
    let sql = '';
    let p = [];
    let idx = 1;

    if (tab === 'masuk') {
        sql = `
            SELECT sm.*, 
                   ds.id AS disposisi_id,
                   ds.dari_nama AS disposisi_dari_nama,
                   ds.dari_jabatan AS disposisi_dari_jabatan,
                   ds.ke_jabatan AS disposisi_ke_jabatan,
                   ds.ke_nama AS disposisi_ke_nama,
                   ds.instruksi AS disposisi_instruksi,
                   ds.catatan AS disposisi_catatan,
                   ds.sifat AS disposisi_sifat,
                   ds.status AS disposisi_status
            FROM surat_masuk sm
            LEFT JOIN (
                SELECT DISTINCT ON (surat_id) *
                FROM disposisi_surat
                ORDER BY surat_id, id DESC
            ) ds ON sm.id = ds.surat_id
            WHERE 1=1
        `;
        if (did) {
            sql += ` AND (sm.kepenghuluan_id = $${idx} OR sm.kepenghuluan_id IS NULL)`;
            p.push(did);
            idx++;
        } else if (!admin && !did) {
            sql += ` AND sm.kepenghuluan_id IS NULL`;
        }
        if (startDate) {
            sql += ` AND sm.tanggal_surat >= $${idx}`;
            p.push(startDate);
            idx++;
        }
        if (endDate) {
            sql += ` AND sm.tanggal_surat <= $${idx}`;
            p.push(endDate);
            idx++;
        }
        if (tahun && tahun !== 'all') {
            sql += ` AND EXTRACT(YEAR FROM sm.tanggal_surat) = $${idx}`;
            p.push(Number(tahun));
            idx++;
        }
        sql += ` ORDER BY sm.tanggal_surat ASC, sm.id ASC`;
    } else {
        sql = `SELECT * FROM surat_keluar WHERE 1=1`;
        if (did) {
            sql += ` AND (kepenghuluan_id = $${idx} OR kepenghuluan_id IS NULL)`;
            p.push(did);
            idx++;
        } else if (!admin && !did) {
            sql += ` AND kepenghuluan_id IS NULL`;
        }
        if (startDate) {
            sql += ` AND tanggal_surat >= $${idx}`;
            p.push(startDate);
            idx++;
        }
        if (endDate) {
            sql += ` AND tanggal_surat <= $${idx}`;
            p.push(endDate);
            idx++;
        }
        if (tahun && tahun !== 'all') {
            sql += ` AND EXTRACT(YEAR FROM tanggal_surat) = $${idx}`;
            p.push(Number(tahun));
            idx++;
        }
        sql += ` ORDER BY tanggal_surat ASC, id ASC`;
    }

    const res = await db.query(sql, p);
    return res.rows;
}

module.exports = suratController;
