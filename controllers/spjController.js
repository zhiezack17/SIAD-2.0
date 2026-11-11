const db = require('../config/db');
const { uploadToDrive, deleteFromDrive } = require('../config/drive');
const ac = require('../middleware/access');
const QRCode = require('qrcode');
const bkuParser = require('../services/bkuParser');
const { recordAudit } = require('../services/auditLog');

const spjController = {
    // === INDUK KEGIATAN SPJ ===
    getIndex: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const tab = req.query.tab || 'kegiatan';
            const filterTahun = req.query.tahun || '';

            // 1. Query Kegiatan SPJ
            let sql = `
                SELECT sk.*, k.nama AS kepenghuluan_nama 
                FROM spj_kegiatan sk
                LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                WHERE 1=1
            `;
            let p = [];
            let idx = 1;

            if (!admin && did) {
                sql += ` AND sk.kepenghuluan_id = $${idx}`;
                p.push(did);
                idx++;
            } else if (admin && did) {
                sql += ` AND sk.kepenghuluan_id = $${idx}`;
                p.push(did);
                idx++;
            }

            if (filterTahun) {
                sql += ` AND sk.tahun = $${idx}`;
                p.push(filterTahun);
                idx++;
            }

            sql += ' ORDER BY sk.id DESC';
            const result = await db.query(sql, p);

            // 2. Tahun List untuk Filter
            const thnRes = await db.query('SELECT DISTINCT tahun FROM spj_kegiatan WHERE tahun IS NOT NULL ORDER BY tahun DESC');
            let tahunList = thnRes.rows.map(r => r.tahun);
            const curYear = new Date().getFullYear();
            if (!tahunList.includes(curYear)) tahunList.unshift(curYear);

            // 3. Query Data Pajak untuk Tab Rekapitulasi Pajak
            let pSql = `
                SELECT sp.*, sk.nama_kegiatan, sk.tahun AS kegiatan_tahun
                FROM spj_pajak sp
                LEFT JOIN spj_kegiatan sk ON sp.kegiatan_id = sk.id
                WHERE 1=1
            `;
            let pP = [];
            let pIdx = 1;

            if (!admin && did) {
                pSql += ` AND (sp.kepenghuluan_id = $${pIdx} OR sp.kepenghuluan_id IS NULL)`;
                pP.push(did);
                pIdx++;
            } else if (admin && did) {
                pSql += ` AND (sp.kepenghuluan_id = $${pIdx} OR sp.kepenghuluan_id IS NULL)`;
                pP.push(did);
                pIdx++;
            }

            if (filterTahun) {
                pSql += ` AND (sk.tahun = $${pIdx} OR EXTRACT(YEAR FROM sp.tanggal_setor) = $${pIdx} OR (sp.tanggal_setor IS NULL AND EXTRACT(YEAR FROM sp.created_at) = $${pIdx}))`;
                pP.push(filterTahun);
                pIdx++;
            }

            pSql += ' ORDER BY sp.id DESC';
            const pajakRes = await db.query(pSql, pP);
            const dataPajak = pajakRes.rows;

            const summary = {
                totalPPN: 0,
                totalPPh21: 0,
                totalPPh22: 0,
                totalPPh23: 0,
                totalPajakDaerah: 0,
                totalSemua: 0,
                totalPotongan: 0,
                totalDisetor: 0,
                sisaHutangPajak: 0
            };

            dataPajak.forEach(item => {
                const nom = Number(item.nominal) || 0;
                const j = (item.jenis_pajak || '').toUpperCase();
                summary.totalSemua += nom;
                summary.totalPotongan += nom;
                const isDisetor = Boolean((item.ntpn && item.ntpn.trim()) || (item.file_url && item.file_url.trim()));
                if (isDisetor) {
                    summary.totalDisetor += nom;
                }
                if (j.includes('PPN')) summary.totalPPN += nom;
                else if (j.includes('21')) summary.totalPPh21 += nom;
                else if (j.includes('22')) summary.totalPPh22 += nom;
                else if (j.includes('23')) summary.totalPPh23 += nom;
                else summary.totalPajakDaerah += nom;
            });
            summary.sisaHutangPajak = Math.max(0, summary.totalPotongan - summary.totalDisetor);

            res.render('spj', { 
                title: 'Kegiatan SPJ & Rekapitulasi - SIAD 2.0', 
                data: result.rows, 
                kegiatanList: result.rows,
                dataPajak,
                summary,
                tab,
                filterTahun,
                tahunList,
                user: req.session.user,
                userRole: ac.getUserRole(req)
            });
        } catch (error) {
            console.error('[SPJ:getIndex]', error);
            res.render('spj', { 
                title: 'Kegiatan SPJ & Rekapitulasi - SIAD 2.0', 
                data: [], 
                kegiatanList: [],
                dataPajak: [],
                summary: { totalSemua: 0, totalPPN: 0, totalPPh21: 0, totalPPh22: 0, totalPPh23: 0, totalPajakDaerah: 0 },
                tab: 'kegiatan',
                filterTahun: '',
                tahunList: [new Date().getFullYear()],
                user: req.session.user,
                userRole: ac.getUserRole(req),
                error: error.message
            });
        }
    },

    postTambah: async (req, res) => {
        try {
            const { 
                nama, tahun, pagu, lokasi, tgl_mulai, tgl_selesai, ket,
                bidang, sub_bidang, kode_rekening, tahap,
                sumber_dana, jenis_belanja, prioritas_permendes, realisasi_anggaran,
                nama_pelaksana, jabatan_pelaksana
            } = req.body;
            const did = ac.getDesaId(req);
            const userNama = req.session && req.session.user ? (req.session.user.nama || req.session.user.username) : 'Bendahara/Admin';
            const tahunNum = tahun ? Number(tahun) : new Date().getFullYear();
            const isHistoris = tahunNum <= 2025;
            const paguVal = pagu ? Number(pagu) : 0;
            const realisasiVal = realisasi_anggaran ? Number(realisasi_anggaran) : paguVal;

            const userRole = ac.getUserRole(req);
            const admin = ac.isAdmin(req);
            const canFastTrackArchive = isHistoris && (userRole.includes('bendahara') || admin);

            let sql = '';
            let p = [];

            if (canFastTrackArchive) {
                // === ALUR CEPAT ARSIP HISTORIS (TAHUN <= 2025) ===
                // Khusus Bendahara Desa / Admin: Langsung disahkan sebagai arsip digital historis
                sql = `
                    INSERT INTO spj_kegiatan 
                    (nama_kegiatan, tahun, pagu_anggaran, lokasi, tanggal_mulai, tanggal_selesai, status, keterangan, kepenghuluan_id, tahap_verifikasi,
                     bidang, sub_bidang, kode_rekening, tahap, sumber_dana, jenis_belanja, prioritas_permendes, realisasi_anggaran,
                     nama_pelaksana, jabatan_pelaksana,
                     verifikasi_bendahara_oleh, verifikasi_bendahara_at,
                     verifikasi_sekdes_oleh, verifikasi_sekdes_at,
                     persetujuan_penghulu_oleh, persetujuan_penghulu_at,
                     catatan_revisi)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14, $15, $16, $17, $18,
                            $19, $20,
                            $21, NOW(), 'Tidak Diperlukan (Arsip Historis)', NOW(), 'Tidak Diperlukan (Arsip Historis)', NOW(), $22)
                    RETURNING id
                `;
                p = [
                    nama,
                    tahunNum,
                    paguVal,
                    lokasi || '',
                    tgl_mulai || null,
                    tgl_selesai || null,
                    'SELESAI',
                    ket || '',
                    did || null,
                    'SELESAI_FINAL',
                    bidang || 'Bidang 1: Penyelenggaraan Pemerintahan Desa',
                    sub_bidang || '',
                    kode_rekening || '',
                    tahap || 'Tahap 1',
                    sumber_dana || 'DDS (Dana Desa)',
                    jenis_belanja || 'barang_jasa',
                    prioritas_permendes || 'non_prioritas',
                    realisasiVal,
                    nama_pelaksana || '',
                    jabatan_pelaksana || 'Kaur / Kasi Pelaksana Kegiatan',
                    userNama,
                    `[ARSIP HISTORIS TA ${tahunNum}] Dicatat & diarsipkan langsung oleh Bendahara Desa.`
                ];
            } else {
                // === ALUR BERJENJANG STANDAR (TAHUN >= 2026 atau DRAFT) ===
                sql = `
                    INSERT INTO spj_kegiatan 
                    (nama_kegiatan, tahun, pagu_anggaran, lokasi, tanggal_mulai, tanggal_selesai, status, keterangan, kepenghuluan_id, tahap_verifikasi,
                     bidang, sub_bidang, kode_rekening, tahap, sumber_dana, jenis_belanja, prioritas_permendes, realisasi_anggaran,
                     nama_pelaksana, jabatan_pelaksana)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14, $15, $16, $17, $18,
                            $19, $20)
                    RETURNING id
                `;
                p = [
                    nama, 
                    tahunNum, 
                    paguVal, 
                    lokasi || '', 
                    tgl_mulai || null, 
                    tgl_selesai || null, 
                    'DRAFT', 
                    ket || '', 
                    did || null,
                    'DRAFT',
                    bidang || 'Bidang 1: Penyelenggaraan Pemerintahan Desa',
                    sub_bidang || '',
                    kode_rekening || '',
                    tahap || 'Tahap 1',
                    sumber_dana || 'DDS (Dana Desa)',
                    jenis_belanja || 'barang_jasa',
                    prioritas_permendes || 'non_prioritas',
                    realisasiVal,
                    nama_pelaksana || '',
                    jabatan_pelaksana || 'Kaur / Kasi Pelaksana Kegiatan'
                ];
            }

            await db.query(sql, p);
            res.redirect('/spj');
        } catch (error) {
            console.error('[SPJ:postTambah]', error);
            res.redirect('/spj');
        }
    },

    postEdit: async (req, res) => {
        try {
            const { 
                id, nama, tahun, pagu, lokasi, tgl_mulai, tgl_selesai, ket,
                bidang, sub_bidang, kode_rekening, tahap,
                sumber_dana, jenis_belanja, prioritas_permendes, realisasi_anggaran,
                nama_pelaksana, jabatan_pelaksana
            } = req.body;
            const isSuper = ac.isSuperAdmin(req);
            const did = ac.getDesaId(req);
            const tahunNum = tahun ? Number(tahun) : null;
            const paguVal = pagu ? Number(pagu) : 0;
            const realisasiVal = realisasi_anggaran ? Number(realisasi_anggaran) : paguVal;

            let sql = `
                UPDATE spj_kegiatan 
                SET nama_kegiatan=$1, tahun=$2, pagu_anggaran=$3, lokasi=$4, tanggal_mulai=$5, tanggal_selesai=$6, keterangan=$7,
                    bidang=$8, sub_bidang=$9, kode_rekening=$10, tahap=$11, sumber_dana=$12, jenis_belanja=$13, prioritas_permendes=$14, realisasi_anggaran=$15,
                    nama_pelaksana=$16, jabatan_pelaksana=$17
                WHERE id=$18
            `;
            let p = [
                nama, tahunNum, paguVal, lokasi, tgl_mulai || null, tgl_selesai || null, ket,
                bidang, sub_bidang || '', kode_rekening || '', tahap || 'Tahap 1',
                sumber_dana || 'DDS (Dana Desa)', jenis_belanja || 'barang_jasa',
                prioritas_permendes || 'non_prioritas', realisasiVal,
                nama_pelaksana || '', jabatan_pelaksana || 'Kaur / Kasi Pelaksana Kegiatan',
                id
            ];

            // Proteksi IDOR isolasi desa
            if (!isSuper && did) {
                sql += ` AND kepenghuluan_id=$${p.length + 1}`;
                p.push(did);
            }

            await db.query(sql, p);
            res.redirect('/spj');
        } catch (error) {
            console.error('[SPJ:postEdit]', error);
            res.redirect('/spj');
        }
    },

    postDelete: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const id = req.body.id;

            // 1. Bersihkan semua file Google Drive yang terafiliasi dengan kegiatan ini
            try {
                const dokRes = await db.query('SELECT file_url FROM spj_dokumen WHERE kegiatan_id=$1', [id]);
                for (const r of dokRes.rows) {
                    if (r.file_url) await deleteFromDrive(r.file_url);
                }
                const fotoRes = await db.query('SELECT file_url FROM spj_foto WHERE kegiatan_id=$1', [id]);
                for (const r of fotoRes.rows) {
                    if (r.file_url) await deleteFromDrive(r.file_url);
                }
                const pajakRes = await db.query('SELECT file_url FROM spj_pajak WHERE kegiatan_id=$1', [id]);
                for (const r of pajakRes.rows) {
                    if (r.file_url) await deleteFromDrive(r.file_url);
                }
            } catch (errDrive) {
                console.warn('[SPJ:postDelete] Gagal bersihkan file di Drive:', errDrive.message);
            }

            let sql = 'DELETE FROM spj_kegiatan WHERE id=$1';
            let p = [id];

            // Proteksi IDOR
            if (!admin && did) {
                sql += ' AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)';
                p.push(did);
            }

            await db.query(sql, p);
            res.redirect('/spj');
        } catch (error) {
            console.error('[SPJ:postDelete]', error);
            res.redirect('/spj');
        }
    },

    // === ALUR VERIFIKASI BERTINGKAT SPJ ===
    postVerifikasi: async (req, res) => {
        try {
            const { kegiatan_id, aksi, catatan } = req.body;
            const isSuper = ac.isSuperAdmin(req);
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const userRole = ac.getUserRole(req);
            const userNama = req.session.user.nama || req.session.user.username;

            // 1. Ambil kegiatan saat ini dengan proteksi IDOR ketat
            let checkSql = 'SELECT * FROM spj_kegiatan WHERE id=$1';
            let checkParams = [kegiatan_id];
            if (!isSuper && did) {
                checkSql += ' AND kepenghuluan_id=$2';
                checkParams.push(did);
            }

            const check = await db.query(checkSql, checkParams);
            if (check.rows.length === 0) {
                return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Kegiatan tidak ditemukan atau hak akses ditolak.'));
            }

            const k = check.rows[0];
            const currentTahap = k.tahap_verifikasi || 'DRAFT';
            const tahunNum = Number(k.tahun);
            const isHistoris = tahunNum <= 2025;

            let nextTahap = currentTahap;
            let newStatus = k.status || 'DRAFT';
            let updateFields = [];
            let updateParams = [kegiatan_id];

            if (aksi === 'revisi') {
                // Verifikator berhak mengembalikan dengan catatan revisi
                nextTahap = 'PERLU_REVISI';
                newStatus = 'REVISI';
                const prefixRole = userRole.toUpperCase();
                const catatanFull = `[${prefixRole} - ${userNama}]: ${catatan || 'Mohon lengkapi berkas.'}`;
                
                updateParams.push(nextTahap);
                updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                
                updateParams.push(newStatus);
                updateFields.push(`status = $${updateParams.length}`);

                updateParams.push(catatanFull);
                updateFields.push(`catatan_revisi = $${updateParams.length}`);

            } else if (aksi === 'bypass_arsip') {
                // P0-03 & U04: STRICT CHECK: Ditolak keras jika tahun >= 2026!
                if (!isHistoris) {
                    return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Fitur bypass arsip hanya diizinkan untuk Tahun Anggaran 2025 ke bawah! Dokumen TA 2026+ wajib mengikuti verifikasi berjenjang.'));
                }
                if (!userRole.includes('bendahara') && !admin) {
                    return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Hanya Bendahara Desa atau Administrator yang dapat memfinalkan arsip historis.'));
                }

                nextTahap = 'SELESAI_FINAL';
                newStatus = 'SELESAI';
                
                updateParams.push(nextTahap);
                updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                
                updateParams.push(newStatus);
                updateFields.push(`status = $${updateParams.length}`);

                updateParams.push(userNama);
                updateFields.push(`verifikasi_bendahara_oleh = $${updateParams.length}`);
                updateFields.push(`verifikasi_bendahara_at = NOW()`);

                updateFields.push(`verifikasi_sekdes_oleh = 'Tidak Diperlukan (Arsip Historis)'`);
                updateFields.push(`verifikasi_sekdes_at = NOW()`);

                updateFields.push(`persetujuan_penghulu_oleh = 'Tidak Diperlukan (Arsip Historis)'`);
                updateFields.push(`persetujuan_penghulu_at = NOW()`);

                updateParams.push(`[ARSIP HISTORIS TA ${tahunNum}] Disahkan langsung oleh Bendahara Desa.`);
                updateFields.push(`catatan_revisi = $${updateParams.length}`);

            } else if (aksi === 'ajukan') {
                if (isHistoris && (userRole.includes('bendahara') || admin)) {
                    // Bendahara langsung mengarsipkan dokumen historis
                    nextTahap = 'SELESAI_FINAL';
                    newStatus = 'SELESAI';
                    updateParams.push(nextTahap);
                    updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                    updateParams.push(newStatus);
                    updateFields.push(`status = $${updateParams.length}`);

                    updateParams.push(userNama);
                    updateFields.push(`verifikasi_bendahara_oleh = $${updateParams.length}`);
                    updateFields.push(`verifikasi_bendahara_at = NOW()`);

                    updateFields.push(`verifikasi_sekdes_oleh = 'Tidak Diperlukan (Arsip Historis)'`);
                    updateFields.push(`verifikasi_sekdes_at = NOW()`);

                    updateFields.push(`persetujuan_penghulu_oleh = 'Tidak Diperlukan (Arsip Historis)'`);
                    updateFields.push(`persetujuan_penghulu_at = NOW()`);

                    updateParams.push(`[ARSIP HISTORIS TA ${tahunNum}] Disahkan langsung oleh Bendahara Desa.`);
                    updateFields.push(`catatan_revisi = $${updateParams.length}`);
                } else {
                    // Alur standar 2026+: Kaur / Pelaksana mengajukan ke Bendahara
                    nextTahap = 'VERIFIKASI_BENDAHARA';
                    newStatus = 'DIAJUKAN';
                    updateParams.push(nextTahap);
                    updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                    updateParams.push(newStatus);
                    updateFields.push(`status = $${updateParams.length}`);
                    updateFields.push(`catatan_revisi = NULL`);
                }

            } else if (aksi === 'setujui_bendahara') {
                if (isHistoris && (userRole.includes('bendahara') || admin)) {
                    // Jika TA <= 2025, Bendahara langsung sahkan final
                    nextTahap = 'SELESAI_FINAL';
                    newStatus = 'SELESAI';
                    updateParams.push(nextTahap);
                    updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                    updateParams.push(newStatus);
                    updateFields.push(`status = $${updateParams.length}`);

                    updateParams.push(userNama);
                    updateFields.push(`verifikasi_bendahara_oleh = $${updateParams.length}`);
                    updateFields.push(`verifikasi_bendahara_at = NOW()`);

                    updateFields.push(`verifikasi_sekdes_oleh = 'Tidak Diperlukan (Arsip Historis)'`);
                    updateFields.push(`verifikasi_sekdes_at = NOW()`);

                    updateFields.push(`persetujuan_penghulu_oleh = 'Tidak Diperlukan (Arsip Historis)'`);
                    updateFields.push(`persetujuan_penghulu_at = NOW()`);

                    updateParams.push(`[ARSIP HISTORIS TA ${tahunNum}] Disahkan langsung oleh Bendahara Desa.`);
                    updateFields.push(`catatan_revisi = $${updateParams.length}`);
                } else {
                    // P0-03 & U06: Tahap 2026+ Verifikasi Bendahara
                    if (currentTahap !== 'VERIFIKASI_BENDAHARA') {
                        return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Dokumen belum diajukan untuk verifikasi bendahara.'));
                    }
                    if (!userRole.includes('bendahara') && !admin) {
                        return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Hanya Bendahara yang dapat memverifikasi tahap ini.'));
                    }

                    nextTahap = 'VERIFIKASI_SEKDES';
                    newStatus = 'DIVERIFIKASI_BENDAHARA';
                    updateParams.push(nextTahap);
                    updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                    updateParams.push(newStatus);
                    updateFields.push(`status = $${updateParams.length}`);
                    
                    updateParams.push(userNama);
                    updateFields.push(`verifikasi_bendahara_oleh = $${updateParams.length}`);
                    updateFields.push(`verifikasi_bendahara_at = NOW()`);
                    updateFields.push(`catatan_revisi = NULL`);
                }

            } else if (aksi === 'setujui_sekdes') {
                // P0-03 & U06: Hanya boleh jika tahap saat ini adalah VERIFIKASI_SEKDES
                if (currentTahap !== 'VERIFIKASI_SEKDES') {
                    return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Dokumen belum diverifikasi oleh Bendahara Desa.'));
                }
                if (!userRole.includes('sekdes') && !userRole.includes('sekretaris') && !admin) {
                    return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Hanya Sekretaris Desa yang dapat memverifikasi tahap ini.'));
                }

                nextTahap = 'VERIFIKASI_PENGHULU';
                newStatus = 'DIVERIFIKASI_SEKDES';
                updateParams.push(nextTahap);
                updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                updateParams.push(newStatus);
                updateFields.push(`status = $${updateParams.length}`);
                
                updateParams.push(userNama);
                updateFields.push(`verifikasi_sekdes_oleh = $${updateParams.length}`);
                updateFields.push(`verifikasi_sekdes_at = NOW()`);
                updateFields.push(`catatan_revisi = NULL`);

            } else if (aksi === 'setujui_penghulu') {
                // P0-03 & U06: Hanya boleh jika tahap saat ini adalah VERIFIKASI_PENGHULU
                if (currentTahap !== 'VERIFIKASI_PENGHULU') {
                    return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Dokumen belum diverifikasi oleh Sekretaris Desa. Penghulu tidak dapat menyetujui sebelum tahap Sekdes selesai.'));
                }
                if (!userRole.includes('penghulu') && !userRole.includes('pimpinan') && !admin) {
                    return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Akses Ditolak: Hanya Penghulu yang dapat memberikan pengesahan akhir.'));
                }

                nextTahap = 'SELESAI_FINAL';
                newStatus = 'SELESAI';
                updateParams.push(nextTahap);
                updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                updateParams.push(newStatus);
                updateFields.push(`status = $${updateParams.length}`);
                
                updateParams.push(userNama);
                updateFields.push(`persetujuan_penghulu_oleh = $${updateParams.length}`);
                updateFields.push(`persetujuan_penghulu_at = NOW()`);
                updateFields.push(`catatan_revisi = NULL`);

            } else {
                return res.redirect('/spj?status=error&msg=' + encodeURIComponent('Aksi verifikasi tidak valid.'));
            }

            if (updateFields.length > 0) {
                const updateSql = `UPDATE spj_kegiatan SET ${updateFields.join(', ')} WHERE id=$1`;
                await db.query(updateSql, updateParams);
            recordAudit(req, {
                action: aksi === 'revisi' ? 'REVISI_SPJ' : (nextTahap === 'SELESAI_FINAL' ? 'PENGESAHAN_SPJ' : 'VERIFIKASI_SPJ'),
                entity: 'SPJ_KEGIATAN',
                recordId: kegiatan_id,
                details: userRole.toUpperCase() + ' (' + userNama + ') memproses SPJ: ' + (k.nama_kegiatan || '') + ' -> Status: ' + nextTahap
            });
            }

            res.redirect('/spj/dokumen/' + kegiatan_id);
        } catch (error) {
            console.error('[SPJ:postVerifikasi]', error);
            res.redirect('/spj');
        }
    },

    // === DOKUMEN SPJ ===
    getDokumen: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            let kSql = `
                SELECT sk.*, k.nama AS kepenghuluan_nama 
                FROM spj_kegiatan sk
                LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                WHERE sk.id=$1
            `;
            let kP = [req.params.id];

            if (!admin && did) {
                kSql += ' AND (sk.kepenghuluan_id=$2 OR sk.kepenghuluan_id IS NULL)';
                kP.push(did);
            }

            const kegiatan = await db.query(kSql, kP);
            if (kegiatan.rows.length === 0) return res.redirect('/spj');

            const dokumen = await db.query(
                'SELECT * FROM spj_dokumen WHERE kegiatan_id=$1 ORDER BY id DESC', 
                [req.params.id]
            );

            const pajak = await db.query(
                'SELECT * FROM spj_pajak WHERE kegiatan_id=$1 ORDER BY id DESC', 
                [req.params.id]
            );

            const foto = await db.query(
                'SELECT * FROM spj_foto WHERE kegiatan_id=$1 ORDER BY id DESC', 
                [req.params.id]
            );

            res.render('spj_dokumen', { 
                title: `Dokumen SPJ - ${kegiatan.rows[0].nama_kegiatan}`, 
                kegiatan: kegiatan.rows[0], 
                dokumen: dokumen.rows, 
                pajak: pajak.rows,
                foto: foto.rows,
                user: req.session.user,
                userRole: ac.getUserRole(req),
                isAdmin: admin
            });
        } catch (error) {
            console.error('[SPJ:getDokumen]', error);
            res.redirect('/spj');
        }
    },

    postUploadDokumen: async (req, res) => {
        try {
            const { kegiatan_id, nama_dokumen } = req.body;
            const userDesa = ac.getDesaNama(req, 'Desa');
            const did = ac.getDesaId(req);
            let driveUrl = '';

            if (req.file) {
                try {
                    const driveData = await uploadToDrive(req.file, userDesa, 'SPJ', 'Dokumen SPJ');
                    if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
                } catch (errDrive) {
                    console.error('[SPJ:postUploadDokumen:uploadToDrive]', errDrive.message);
                }
            }

            await db.query(
                'INSERT INTO spj_dokumen (kegiatan_id, nama_dokumen, file_url, kepenghuluan_id) VALUES ($1, $2, $3, $4)',
                [kegiatan_id, nama_dokumen, driveUrl, did || null]
            );

            res.redirect('/spj/dokumen/' + kegiatan_id);
        } catch (error) {
            console.error('[SPJ:postUploadDokumen]', error);
            res.redirect('/spj/dokumen/' + req.body.kegiatan_id);
        }
    },

    postDeleteDokumen: async (req, res) => {
        try {
            const { id, kegiatan_id } = req.body;
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            // 1. Ambil file_url sebelum dihapus dari DB dan bersihkan di Google Drive
            try {
                const check = await db.query('SELECT file_url FROM spj_dokumen WHERE id=$1', [id]);
                if (check.rows.length > 0 && check.rows[0].file_url) {
                    await deleteFromDrive(check.rows[0].file_url);
                }
            } catch (errDrive) {
                console.warn('[SPJ:postDeleteDokumen] Gagal hapus di Drive:', errDrive.message);
            }

            let sql = 'DELETE FROM spj_dokumen WHERE id=$1';
            let p = [id];

            // Proteksi IDOR
            if (!admin && did) {
                sql += ' AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)';
                p.push(did);
            }

            await db.query(sql, p);
            res.redirect('/spj/dokumen/' + kegiatan_id);
        } catch (error) {
            console.error('[SPJ:postDeleteDokumen]', error);
            res.redirect('/spj/dokumen/' + req.body.kegiatan_id);
        }
    },

    // === FOTO DOKUMENTASI KEGIATAN SPJ (MULTI-UPLOAD) ===
    postUploadFoto: async (req, res) => {
        try {
            const { kegiatan_id, kategori, judul_foto } = req.body;
            const did = ac.getDesaId(req);

            const kegRes = await db.query(`
                SELECT sk.nama_kegiatan, k.nama AS kepenghuluan_nama
                FROM spj_kegiatan sk
                LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                WHERE sk.id = $1
            `, [kegiatan_id]);

            const namaKegiatan = kegRes.rows[0]?.nama_kegiatan || 'SPJ';
            const userDesa = kegRes.rows[0]?.kepenghuluan_nama || ac.getDesaNama(req, 'Desa');

            const files = req.files || (req.file ? [req.file] : []);
            if (files.length === 0) {
                return res.redirect('/spj/dokumen/' + kegiatan_id + '?status=error&msg=' + encodeURIComponent('Tidak ada file foto yang dipilih.'));
            }

            for (const file of files) {
                let driveUrl = '';
                try {
                    const driveData = await uploadToDrive(file, userDesa, namaKegiatan, 'Dokumentasi SPJ');
                    if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
                } catch (errDrive) {
                    console.error('[SPJ:uploadToDriveFoto]', errDrive.message);
                }

                if (driveUrl) {
                    await db.query(`
                        INSERT INTO spj_foto (kegiatan_id, kepenghuluan_id, judul_foto, kategori, file_url, created_at)
                        VALUES ($1, $2, $3, $4, $5, NOW())
                    `, [
                        kegiatan_id,
                        did || null,
                        judul_foto || file.originalname,
                        kategori || 'Dokumentasi',
                        driveUrl
                    ]);
                }
            }

            res.redirect('/spj/dokumen/' + kegiatan_id + '?status=success_foto');
        } catch (error) {
            console.error('[SPJ:postUploadFoto]', error);
            res.redirect('/spj/dokumen/' + req.body.kegiatan_id + '?status=error&msg=' + encodeURIComponent(error.message));
        }
    },

    postDeleteFoto: async (req, res) => {
        try {
            const { id, kegiatan_id } = req.body;
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            // 1. Ambil file_url sebelum dihapus dari DB dan bersihkan di Google Drive
            try {
                const check = await db.query('SELECT file_url FROM spj_foto WHERE id=$1', [id]);
                if (check.rows.length > 0 && check.rows[0].file_url) {
                    await deleteFromDrive(check.rows[0].file_url);
                }
            } catch (errDrive) {
                console.warn('[SPJ:postDeleteFoto] Gagal hapus di Drive:', errDrive.message);
            }

            let sql = 'DELETE FROM spj_foto WHERE id=$1';
            let p = [id];

            // Proteksi IDOR
            if (!admin && did) {
                sql += ' AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)';
                p.push(did);
            }

            await db.query(sql, p);
            res.redirect('/spj/dokumen/' + kegiatan_id);
        } catch (error) {
            console.error('[SPJ:postDeleteFoto]', error);
            res.redirect('/spj/dokumen/' + req.body.kegiatan_id);
        }
    },

    // === PAJAK SPJ ===
    getPajak: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            let kSql = 'SELECT * FROM spj_kegiatan WHERE id=$1';
            let kP = [req.params.id];

            if (!admin && did) {
                kSql += ' AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)';
                kP.push(did);
            }

            const kegiatan = await db.query(kSql, kP);
            if (kegiatan.rows.length === 0) return res.redirect('/spj');

            const pajak = await db.query(
                'SELECT * FROM spj_pajak WHERE kegiatan_id=$1 ORDER BY id DESC', 
                [req.params.id]
            );

            res.render('spj_pajak', { 
                title: 'Pajak SPJ', 
                kegiatan: kegiatan.rows[0], 
                pajak: pajak.rows, 
                user: req.session.user 
            });
        } catch (error) {
            console.error('[SPJ:getPajak]', error);
            res.redirect('/spj');
        }
    },

    postTambahPajak: async (req, res) => {
        try {
            const { kegiatan_id, jenis_pajak, nominal, ntpn, kode_billing, tanggal_setor, uraian, nama_wp_rekanan, redirect_to } = req.body;
            const userDesa = ac.getDesaNama(req, 'Desa');
            const did = ac.getDesaId(req);
            let driveUrl = '';

            if (req.file) {
                try {
                    const driveData = await uploadToDrive(req.file, userDesa, 'SPJ', 'Pajak SPJ');
                    if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
                } catch (errDrive) {
                    console.error('[SPJ:postTambahPajak:uploadToDrive]', errDrive.message);
                }
            }

            await db.query(
                `INSERT INTO spj_pajak 
                 (kegiatan_id, jenis_pajak, nominal, file_url, kepenghuluan_id, ntpn, kode_billing, tanggal_setor, uraian, nama_wp_rekanan) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    kegiatan_id ? Number(kegiatan_id) : null,
                    jenis_pajak,
                    nominal ? Number(nominal) : 0,
                    driveUrl,
                    did || null,
                    ntpn || null,
                    kode_billing || null,
                    tanggal_setor || new Date(),
                    uraian || null,
                    nama_wp_rekanan || null
                ]
            );

            if (redirect_to === 'rekap') {
                return res.redirect('/spj?tab=pajak');
            }
            res.redirect('/spj/dokumen/' + kegiatan_id);
        } catch (error) {
            console.error('[SPJ:postTambahPajak]', error);
            if (req.body.redirect_to === 'rekap') {
                return res.redirect('/spj?tab=pajak');
            }
            res.redirect('/spj/dokumen/' + req.body.kegiatan_id);
        }
    },

    postDeletePajak: async (req, res) => {
        try {
            const { id, kegiatan_id, redirect_to } = req.body;
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            // 1. Ambil file_bukti sebelum dihapus dari DB dan bersihkan di Google Drive
            try {
                const check = await db.query('SELECT file_url FROM spj_pajak WHERE id=$1', [id]);
                if (check.rows.length > 0 && check.rows[0].file_url) {
                    await deleteFromDrive(check.rows[0].file_url);
                }
            } catch (errDrive) {
                console.warn('[SPJ:postDeletePajak] Gagal hapus di Drive:', errDrive.message);
            }

            let sql = 'DELETE FROM spj_pajak WHERE id=$1';
            let p = [id];

            // Proteksi IDOR
            if (!admin && did) {
                sql += ' AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)';
                p.push(did);
            }

            await db.query(sql, p);

            if (redirect_to === 'rekap') {
                return res.redirect('/spj?tab=pajak');
            }
            res.redirect('/spj/dokumen/' + kegiatan_id);
        } catch (error) {
            console.error('[SPJ:postDeletePajak]', error);
            if (req.body.redirect_to === 'rekap') {
                return res.redirect('/spj?tab=pajak');
            }
            res.redirect('/spj/dokumen/' + req.body.kegiatan_id);
        }
    },

    // === CETAK LEMBAR PENGESAHAN SPJ RESMI (PRINT-READY) ===
    getCetakVerifikasi: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            let kSql = `
                SELECT sk.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama
                FROM spj_kegiatan sk
                LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                WHERE sk.id=$1
            `;
            let kP = [req.params.id];

            if (!admin && did) {
                kSql += ' AND (sk.kepenghuluan_id=$2 OR sk.kepenghuluan_id IS NULL)';
                kP.push(did);
            }

            const kegiatanResult = await db.query(kSql, kP);
            if (kegiatanResult.rows.length === 0) return res.redirect('/spj');

            const kegiatan = kegiatanResult.rows[0];

            const dokumenResult = await db.query(
                'SELECT * FROM spj_dokumen WHERE kegiatan_id=$1 ORDER BY id ASC', 
                [req.params.id]
            );

            const pajakResult = await db.query(
                'SELECT * FROM spj_pajak WHERE kegiatan_id=$1 ORDER BY id ASC', 
                [req.params.id]
            );

            const fotoResult = await db.query(
                'SELECT * FROM spj_foto WHERE kegiatan_id=$1 ORDER BY id ASC',
                [req.params.id]
            );

            let totalPajak = 0;
            pajakResult.rows.forEach(p => {
                totalPajak += Number(p.nominal) || 0;
            });

            // Buat QR Code validasi resmi yang mengarah ke endpoint publik
            const host = req.get('host') || '38.103.170.19';
            const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
            const verifyUrl = `${protocol}://${host}/validasi/spj/${req.params.id}`;
            let qrDataUri = null;
            try {
                qrDataUri = await QRCode.toDataURL(verifyUrl, {
                    width: 160,
                    margin: 1,
                    color: {
                        dark: '#0f172a',
                        light: '#ffffff'
                    }
                });
            } catch (qrErr) {
                console.error('[SPJ:QRCode]', qrErr);
            }

            res.render('spj_cetak', {
                layout: false,
                title: `Lembar Pengesahan SPJ - ${kegiatan.nama_kegiatan}`,
                kegiatan,
                dokumen: dokumenResult.rows,
                pajak: pajakResult.rows,
                foto: fotoResult.rows,
                totalPajak,
                qrDataUri,
                verifyUrl
            });
        } catch (error) {
            console.error('[SPJ:getCetakVerifikasi]', error);
            res.redirect('/spj');
        }
    },

    // === CETAK SPTJB (SURAT PERNYATAAN TANGGUNG JAWAB BELANJA - PERMENDAGRI 20/2018) ===
    getCetakSptjb: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const id = req.params.id;

            let kSql = `
                SELECT sk.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama
                FROM spj_kegiatan sk
                LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                WHERE sk.id=$1
            `;
            let kP = [id];
            if (!admin && did) {
                kSql += ' AND (sk.kepenghuluan_id=$2 OR sk.kepenghuluan_id IS NULL)';
                kP.push(did);
            }

            const kRes = await db.query(kSql, kP);
            if (kRes.rows.length === 0) return res.redirect('/spj');
            const kegiatan = kRes.rows[0];
            const targetDesaId = kegiatan.kepenghuluan_id || did || 1;

            // Fetch profil desa & pejabat
            const profRes = await db.query(`
                SELECT pd.nama_desa, pd.nama_kepala_desa, pd.alamat,
                       p_penghulu.nama_lengkap AS user_penghulu,
                       p_bendahara.nama_lengkap AS user_bendahara
                FROM profil_desa pd
                LEFT JOIN pengguna p_penghulu ON p_penghulu.kepenghuluan_id = pd.kepenghuluan_id AND (p_penghulu.role::text IN ('penghulu', 'admin') OR p_penghulu.peran ILIKE '%pimpinan%')
                LEFT JOIN pengguna p_bendahara ON p_bendahara.kepenghuluan_id = pd.kepenghuluan_id AND (p_bendahara.role::text IN ('bendahara', 'kaur') OR p_bendahara.peran ILIKE '%keuangan%')
                WHERE pd.kepenghuluan_id = $1
                LIMIT 1
            `, [targetDesaId]);

            const pRow = profRes.rows[0] || {};
            const desa = {
                nama: kegiatan.kepenghuluan_nama || pRow.nama_desa || 'Kepenghuluan',
                kecamatan_nama: kegiatan.kecamatan_nama || 'Kecamatan',
                nama_kepala_desa: pRow.nama_kepala_desa || pRow.user_penghulu || `Penghulu ${kegiatan.kepenghuluan_nama || ''}`,
                alamat: pRow.alamat || `Kecamatan ${kegiatan.kecamatan_nama || ''}, Kabupaten Rokan Hilir`
            };

            // Terbilang Rupiah
            function terbilang(n) {
                const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
                n = Math.floor(Number(n) || 0);
                if (n < 12) return bilangan[n];
                if (n < 20) return terbilang(n - 10) + ' Belas';
                if (n < 100) return terbilang(Math.floor(n / 10)) + ' Puluh ' + terbilang(n % 10);
                if (n < 200) return 'Seratus ' + terbilang(n - 100);
                if (n < 1000) return terbilang(Math.floor(n / 100)) + ' Ratus ' + terbilang(n % 100);
                if (n < 2000) return 'Seribu ' + terbilang(n - 1000);
                if (n < 1000000) return terbilang(Math.floor(n / 1000)) + ' Ribu ' + terbilang(n % 1000);
                if (n < 1000000000) return terbilang(Math.floor(n / 1000000)) + ' Juta ' + terbilang(n % 1000000);
                if (n < 1000000000000) return terbilang(Math.floor(n / 1000000000)) + ' Miliar ' + terbilang(n % 1000000000);
                return terbilang(Math.floor(n / 1000000000000)) + ' Triliun ' + terbilang(n % 1000000000000);
            }

            const paguNum = Number(kegiatan.pagu_anggaran) || 0;
            const paguTerbilang = (terbilang(paguNum).trim() + ' Rupiah').replace(/\s+/g, ' ');

            // Generate QR Code keabsahan
            const verifyUrl = `https://siad-v2.com/validasi/spj/${kegiatan.id}`;
            let qrDataUri = '';
            try {
                qrDataUri = await QRCode.toDataURL(verifyUrl, { width: 110, margin: 1 });
            } catch (qe) {
                console.error('[SPJ:QRCode]', qe);
            }

            res.render('spj_sptjb_cetak', {
                layout: false,
                title: `SPTJB - ${kegiatan.nama_kegiatan} - SIAD 2.0`,
                kegiatan,
                desa,
                paguTerbilang,
                qrDataUri,
                verifyUrl,
                tanggalCetak: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
            });
        } catch (error) {
            console.error('[SPJ:getCetakSptjb]', error);
            res.redirect('/spj');
        }
    },

    // === VALIDASI PUBLIK DOKUMEN SPJ (HASIL SCAN QR CODE) ===
    getValidasiPublik: async (req, res) => {
        try {
            const kSql = `
                SELECT sk.*, k.nama AS kepenghuluan_nama, kec.nama AS kecamatan_nama
                FROM spj_kegiatan sk
                LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                WHERE sk.id=$1
            `;
            const kegiatanResult = await db.query(kSql, [req.params.id]);
            if (kegiatanResult.rows.length === 0) {
                return res.status(404).render('spj_validasi', {
                    layout: false,
                    found: false,
                    title: 'Verifikasi Dokumen Tidak Ditemukan - SIAD 2.0 Kab. Rokan Hilir'
                });
            }

            const kegiatan = kegiatanResult.rows[0];

            const dokumenResult = await db.query(
                'SELECT id, nama_dokumen, created_at FROM spj_dokumen WHERE kegiatan_id=$1 ORDER BY id ASC', 
                [req.params.id]
            );

            const pajakResult = await db.query(
                'SELECT id, jenis_pajak, nominal FROM spj_pajak WHERE kegiatan_id=$1 ORDER BY id ASC', 
                [req.params.id]
            );

            let totalPajak = 0;
            pajakResult.rows.forEach(p => {
                totalPajak += Number(p.nominal) || 0;
            });

            // Status Keabsahan Resmi
            const isSah = kegiatan.tahap_verifikasi === 'SELESAI_FINAL';

            res.render('spj_validasi', {
                layout: false,
                found: true,
                title: `Verifikasi Resmi Dokumen SPJ - ${kegiatan.nama_kegiatan}`,
                kegiatan,
                dokumen: dokumenResult.rows,
                pajak: pajakResult.rows,
                totalPajak,
                isSah
            });
        } catch (error) {
            console.error('[SPJ:getValidasiPublik]', error);
            res.status(500).send('Terjadi kesalahan saat memverifikasi dokumen.');
        }
    },

    // === CETAK REKAPITULASI REALISASI SPJ (SISKEUDES COMPLIANT) ===
    getCetakRekapitulasi: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const tahun = req.query.tahun || new Date().getFullYear();
            const tahap = req.query.tahap || 'Semua';

            const targetDesaId = (admin && did) ? did : (did || 1);

            // Fetch desa info
            const profRes = await db.query(`
                SELECT k.id AS kep_id, k.nama AS kep_nama, kec.nama AS kec_nama,
                       pd.nama_kepala_desa AS prof_kades, pd.alamat AS prof_alamat,
                       p_penghulu.nama_lengkap AS user_penghulu,
                       p_sekdes.nama_lengkap AS user_sekdes,
                       p_bendahara.nama_lengkap AS user_bendahara
                FROM kepenghuluan k
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                LEFT JOIN pengguna p_penghulu ON p_penghulu.kepenghuluan_id = k.id AND (p_penghulu.role::text IN ('penghulu', 'admin') OR p_penghulu.peran ILIKE '%pimpinan%' OR p_penghulu.jabatan ILIKE '%penghulu%')
                LEFT JOIN pengguna p_sekdes ON p_sekdes.kepenghuluan_id = k.id AND (p_sekdes.role::text IN ('sekretaris', 'sekdes') OR p_sekdes.peran ILIKE '%verifikator%' OR p_sekdes.jabatan ILIKE '%sekdes%' OR p_sekdes.jabatan ILIKE '%sekretaris%')
                LEFT JOIN pengguna p_bendahara ON p_bendahara.kepenghuluan_id = k.id AND (p_bendahara.role::text IN ('bendahara', 'kaur') OR p_bendahara.peran ILIKE '%keuangan%' OR p_bendahara.jabatan ILIKE '%bendahara%')
                WHERE k.id = $1
                LIMIT 1
            `, [targetDesaId]);

            const pRow = profRes.rows[0] || {};
            const desa = {
                nama: pRow.kep_nama || 'Bagan Batu Barat',
                kecamatan_nama: pRow.kec_nama || 'Bagan Sinembah',
                alamat: pRow.prof_alamat || `Kecamatan ${pRow.kec_nama || 'Bagan Sinembah'}, Kabupaten Rokan Hilir`
            };

            const namaPenghulu = pRow.prof_kades || pRow.user_penghulu || `Penghulu ${desa.nama}`;
            const namaSekdes = pRow.user_sekdes || 'Sekretaris Desa';
            const namaBendahara = pRow.user_bendahara || 'Kaur Keuangan / Bendahara';

            let kSql = 'SELECT * FROM spj_kegiatan WHERE tahun = $1';
            let kP = [tahun];
            let idx = 2;

            if (!admin && did) {
                kSql += ` AND (kepenghuluan_id = $${idx} OR kepenghuluan_id IS NULL)`;
                kP.push(did);
                idx++;
            } else if (admin && did) {
                kSql += ` AND (kepenghuluan_id = $${idx} OR kepenghuluan_id IS NULL)`;
                kP.push(did);
                idx++;
            }

            if (tahap && tahap !== 'Semua') {
                kSql += ` AND tahap = $${idx}`;
                kP.push(tahap);
                idx++;
            }

            kSql += ' ORDER BY kode_rekening ASC, id ASC';
            const kRes = await db.query(kSql, kP);
            const allKegiatan = kRes.rows;

            const BIDANG_STANDARD = [
                { kode: '01', nama: 'Bidang Penyelenggaraan Pemerintahan Desa' },
                { kode: '02', nama: 'Bidang Pelaksanaan Pembangunan Desa' },
                { kode: '03', nama: 'Bidang Pembinaan Kemasyarakatan Desa' },
                { kode: '04', nama: 'Bidang Pemberdayaan Masyarakat Desa' },
                { kode: '05', nama: 'Bidang Penanggulangan Bencana, Keadaan Darurat & Mendesak' }
            ];

            const bidangGroups = BIDANG_STANDARD.map(b => {
                const bNum = parseInt(b.kode, 10);
                const list = allKegiatan.filter(k => {
                    const bStr = (k.bidang || '').toLowerCase();
                    const kodeRek = (k.kode_rekening || '').trim();
                    return bStr.includes('bidang ' + bNum) || bStr.includes(b.kode) || kodeRek.startsWith('5.' + bNum) || (bNum === 4 && kodeRek.startsWith('6.')) || bStr.includes(b.nama.toLowerCase().split(' ')[1]);
                });

                let subtotalPagu = 0;
                let subtotalRealisasi = 0;
                list.forEach(item => {
                    const p = Number(item.pagu_anggaran) || 0;
                    subtotalPagu += p;
                    const isFinal = item.tahap_verifikasi === 'SELESAI_FINAL' || (item.status && item.status.toUpperCase() === 'SELESAI');
                    const realisasi = isFinal ? p : (item.tahap_verifikasi === 'VERIFIKASI_PENGHULU' || item.tahap_verifikasi === 'VERIFIKASI_SEKDES' ? p : 0);
                    subtotalRealisasi += realisasi;
                });

                return {
                    kodeBidang: b.kode,
                    namaBidang: b.nama,
                    subtotalPagu,
                    subtotalRealisasi,
                    kegiatan: list
                };
            });

            // Fallback: items that didn't match any standard bidang code
            const matchedIds = new Set(bidangGroups.flatMap(bg => bg.kegiatan.map(k => k.id)));
            const unmatched = allKegiatan.filter(k => !matchedIds.has(k.id));
            if (unmatched.length > 0) {
                unmatched.forEach(u => {
                    bidangGroups[1].kegiatan.push(u);
                    const p = Number(u.pagu_anggaran) || 0;
                    bidangGroups[1].subtotalPagu += p;
                    const isFinal = u.tahap_verifikasi === 'SELESAI_FINAL' || (u.status && u.status.toUpperCase() === 'SELESAI');
                    bidangGroups[1].subtotalRealisasi += isFinal ? p : 0;
                });
            }

            // Kelompokkan kegiatan di dalam bidang berdasarkan Sub Bidang (Siskeudes Compliant)
            bidangGroups.forEach(bg => {
                const subMap = {};
                bg.kegiatan.forEach(k => {
                    const sb = (k.sub_bidang && k.sub_bidang.trim()) ? k.sub_bidang.trim() : 'Kegiatan Reguler / Umum';
                    if (!subMap[sb]) {
                        subMap[sb] = {
                            namaSubBidang: sb,
                            subtotalPagu: 0,
                            subtotalRealisasi: 0,
                            kegiatan: []
                        };
                    }
                    const pagu = Number(k.pagu_anggaran) || 0;
                    const isFinal = k.tahap_verifikasi === 'SELESAI_FINAL' || (k.status && k.status.toUpperCase() === 'SELESAI');
                    const realisasi = isFinal ? (Number(k.realisasi_anggaran) || pagu) : (k.tahap_verifikasi === 'VERIFIKASI_PENGHULU' || k.tahap_verifikasi === 'VERIFIKASI_SEKDES' ? pagu : 0);
                    subMap[sb].subtotalPagu += pagu;
                    subMap[sb].subtotalRealisasi += realisasi;
                    subMap[sb].kegiatan.push(k);
                });
                bg.subBidangGroups = Object.values(subMap);
            });

            const tanggalCetak = new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            res.render('spj_rekap_cetak', {
                layout: false,
                title: `Rekapitulasi Realisasi SPJ TA ${tahun} - Kepenghuluan ${desa.nama}`,
                desa,
                tahun,
                tahap,
                bidangGroups,
                namaPenghulu,
                nipPenghulu: '-',
                namaSekdes,
                nipSekdes: '-',
                namaBendahara,
                nipBendahara: '-',
                tanggalCetak
            });
        } catch (error) {
            console.error('[SPJ:getCetakRekapitulasi]', error);
            res.redirect('/spj?status=error&msg=' + encodeURIComponent(error.message));
        }
    },

    // === CETAK BUKU PEMBANTU PAJAK (SISKEUDES COMPLIANT) ===
    getCetakBukuPajak: async (req, res) => {
        try {
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const tahun = req.query.tahun || new Date().getFullYear();

            const targetDesaId = (admin && did) ? did : (did || 1);

            const profRes = await db.query(`
                SELECT k.id AS kep_id, k.nama AS kep_nama, kec.nama AS kec_nama,
                       pd.nama_kepala_desa AS prof_kades, pd.alamat AS prof_alamat,
                       p_penghulu.nama_lengkap AS user_penghulu,
                       p_bendahara.nama_lengkap AS user_bendahara
                FROM kepenghuluan k
                LEFT JOIN kecamatan kec ON k.kecamatan_id = kec.id
                LEFT JOIN profil_desa pd ON pd.kepenghuluan_id = k.id
                LEFT JOIN pengguna p_penghulu ON p_penghulu.kepenghuluan_id = k.id AND (p_penghulu.role::text IN ('penghulu', 'admin') OR p_penghulu.peran ILIKE '%pimpinan%' OR p_penghulu.jabatan ILIKE '%penghulu%')
                LEFT JOIN pengguna p_bendahara ON p_bendahara.kepenghuluan_id = k.id AND (p_bendahara.role::text IN ('bendahara', 'kaur') OR p_bendahara.peran ILIKE '%keuangan%' OR p_bendahara.jabatan ILIKE '%bendahara%')
                WHERE k.id = $1
                LIMIT 1
            `, [targetDesaId]);

            const pRow = profRes.rows[0] || {};
            const desa = {
                nama: pRow.kep_nama || 'Bagan Batu Barat',
                kecamatan_nama: pRow.kec_nama || 'Bagan Sinembah',
                alamat: pRow.prof_alamat || `Kecamatan ${pRow.kec_nama || 'Bagan Sinembah'}, Kabupaten Rokan Hilir`
            };

            const namaPenghulu = pRow.prof_kades || pRow.user_penghulu || `Penghulu ${desa.nama}`;
            const namaBendahara = pRow.user_bendahara || 'Kaur Keuangan / Bendahara';

            let pSql = `
                SELECT sp.*, sk.nama_kegiatan, sk.tahun
                FROM spj_pajak sp
                LEFT JOIN spj_kegiatan sk ON sp.kegiatan_id = sk.id
                WHERE (sk.tahun = $1 OR EXTRACT(YEAR FROM sp.tanggal_setor) = $1 OR (sp.tanggal_setor IS NULL AND EXTRACT(YEAR FROM sp.created_at) = $1))
            `;
            let pP = [tahun];
            let idx = 2;

            if (!admin && did) {
                pSql += ` AND (sp.kepenghuluan_id = $${idx} OR sp.kepenghuluan_id IS NULL)`;
                pP.push(did);
                idx++;
            } else if (admin && did) {
                pSql += ` AND (sp.kepenghuluan_id = $${idx} OR sp.kepenghuluan_id IS NULL)`;
                pP.push(did);
                idx++;
            }

            pSql += ' ORDER BY sp.tanggal_setor ASC, sp.id ASC';
            const pajakRes = await db.query(pSql, pP);
            const pajakList = pajakRes.rows;

            const summary = {
                totalPPN: 0,
                totalPPh21: 0,
                totalPPh22: 0,
                totalPPh23: 0,
                totalDaerah: 0,
                totalSemua: 0
            };

            pajakList.forEach(p => {
                const nom = Number(p.nominal) || 0;
                const j = (p.jenis_pajak || '').toUpperCase();
                summary.totalSemua += nom;
                if (j.includes('PPN')) summary.totalPPN += nom;
                else if (j.includes('21')) summary.totalPPh21 += nom;
                else if (j.includes('22')) summary.totalPPh22 += nom;
                else if (j.includes('23')) summary.totalPPh23 += nom;
                else summary.totalDaerah += nom;
            });

            const tanggalCetak = new Date().toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            res.render('spj_pajak_buku_cetak', {
                layout: false,
                title: `Buku Pembantu Pajak TA ${tahun} - Kepenghuluan ${desa.nama}`,
                desa,
                tahun,
                pajakList,
                summary,
                namaPenghulu,
                namaBendahara,
                tanggalCetak
            });
        } catch (error) {
            console.error('[SPJ:getCetakBukuPajak]', error);
            res.redirect('/spj?status=error&msg=' + encodeURIComponent(error.message));
        }
    },

    // === IMPORT BKU SISKEUDES (PDF & EXCEL) ===
    postPreviewBku: async (req, res) => {
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ success: false, message: 'Harap pilih berkas BKU Siskeudes (format PDF atau Excel).' });
            }

            const parsed = await bkuParser.parseBku(req.file.buffer, req.file.originalname, req.file.mimetype);

            if (!parsed.kegiatan || parsed.kegiatan.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Tidak ditemukan transaksi belanja (SPP) dalam berkas BKU ini. Pastikan berkas adalah Laporan BKU Siskeudes yang valid.' 
                });
            }

            const did = ac.getDesaId(req);
            const tahun = parsed.meta.tahun || new Date().getFullYear();

            // Cek data existing di database untuk deteksi duplikasi
            const existingKegiatanMap = new Map();
            if (did) {
                try {
                    const existRes = await db.query(
                        `SELECT id, nama_kegiatan, kode_rekening, keterangan, realisasi_anggaran 
                         FROM spj_kegiatan 
                         WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL) AND tahun = $2`,
                        [did, tahun]
                    );
                    existRes.rows.forEach(row => {
                        if (row.keterangan) {
                            existingKegiatanMap.set(row.keterangan.trim().toLowerCase(), row);
                        }
                        if (row.nama_kegiatan) {
                            existingKegiatanMap.set(row.nama_kegiatan.trim().toLowerCase(), row);
                        }
                    });
                } catch (errCheck) {
                    console.warn('[postPreviewBku:checkExistingKegiatan]', errCheck.message);
                }
            }

            // Tandai kegiatan apakah baru atau duplikat
            const kegiatanEnriched = parsed.kegiatan.map((item, idx) => {
                const noBuktiKey = item.no_bukti ? item.no_bukti.toLowerCase() : '';
                const namaKey = item.nama_kegiatan ? item.nama_kegiatan.toLowerCase() : '';
                
                let isDuplicate = false;
                let existingId = null;

                for (const [key, val] of existingKegiatanMap.entries()) {
                    if (noBuktiKey && key.includes(noBuktiKey)) {
                        isDuplicate = true;
                        existingId = val.id;
                        break;
                    }
                    if (namaKey && (key.includes(namaKey) || namaKey.includes(key))) {
                        isDuplicate = true;
                        existingId = val.id;
                        break;
                    }
                }

                return {
                    id_temp: idx + 1,
                    ...item,
                    is_duplicate: isDuplicate,
                    existing_id: existingId
                };
            });

            // Cek duplikasi untuk setoran pajak
            const existingPajakSet = new Set();
            if (did) {
                try {
                    const existPajak = await db.query(
                        `SELECT kode_billing, ntpn, uraian, nominal 
                         FROM spj_pajak 
                         WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL)`,
                        [did]
                    );
                    existPajak.rows.forEach(r => {
                        if (r.kode_billing) existingPajakSet.add(r.kode_billing.trim().toLowerCase());
                        if (r.ntpn) existingPajakSet.add(r.ntpn.trim().toLowerCase());
                        if (r.uraian) existingPajakSet.add(r.uraian.trim().toLowerCase());
                    });
                } catch (errP) {
                    console.warn('[postPreviewBku:checkExistingPajak]', errP.message);
                }
            }

            const pajakEnriched = (parsed.pajak_setoran || []).map((p, idx) => {
                const noBuktiKey = p.no_bukti ? p.no_bukti.toLowerCase() : '';
                const uraianKey = p.uraian ? p.uraian.toLowerCase() : '';
                const isDup = (noBuktiKey && existingPajakSet.has(noBuktiKey)) || (uraianKey && existingPajakSet.has(uraianKey));
                return {
                    id_temp: idx + 1,
                    ...p,
                    is_duplicate: isDup
                };
            });

            return res.json({
                success: true,
                meta: parsed.meta,
                summary: parsed.summary,
                kegiatan: kegiatanEnriched,
                pajak: pajakEnriched,
                user_desa: ac.getDesaNama(req, 'Desa'),
                is_historis: Number(tahun) <= 2025,
                is_buku_pajak: Boolean(parsed.is_buku_pajak)
            });

        } catch (error) {
            console.error('[SPJ:postPreviewBku]', error);
            return res.status(500).json({ success: false, message: 'Gagal memproses berkas BKU: ' + error.message });
        }
    },

    postImportBku: async (req, res) => {
        try {
            const { kegiatan, pajak, tahun, fast_track } = req.body;
            const did = ac.getDesaId(req);
            const userNama = req.session && req.session.user ? (req.session.user.nama || req.session.user.username) : 'Bendahara Desa';
            const userRole = ac.getUserRole(req);
            const admin = ac.isAdmin(req);
            const tahunNum = tahun ? Number(tahun) : new Date().getFullYear();
            const isHistoris = tahunNum <= 2025;
            const canFastTrackArchive = isHistoris && (fast_track === true || fast_track === 'true') && (userRole.includes('bendahara') || admin);

            let insertedKegiatan = 0;
            let insertedPajak = 0;
            const kegiatanIdMap = new Map();

            // 1. Simpan atau Perbarui Kegiatan SPJ Terpilih
            if (Array.isArray(kegiatan) && kegiatan.length > 0) {
                for (const item of kegiatan) {
                    const nama = item.nama_kegiatan || 'Belanja SPJ';
                    const pagu = Number(item.pagu_anggaran) || Number(item.realisasi_anggaran) || 0;
                    const realisasi = Number(item.realisasi_anggaran) || pagu;
                    const noBukti = item.no_bukti || '';
                    const ket = `[BKU Siskeudes: ${noBukti}] ${item.uraian_rincian || ''}`.trim();
                    const bidang = item.bidang || 'Bidang 1: Penyelenggaraan Pemerintahan Desa';
                    const subBidang = item.sub_bidang || '';
                    const kodeRek = item.kode_rekening || '';
                    const sumberDana = item.sumber_dana || 'DDS (Dana Desa)';
                    const jenisBelanja = item.jenis_belanja || 'barang_jasa';
                    const pelaksana = item.jabatan_pelaksana || 'Kaur / Kasi Pelaksana Kegiatan';
                    
                    let tglMulai = null;
                    if (item.tanggal && item.tanggal.includes('/')) {
                        const parts = item.tanggal.split('/');
                        if (parts.length === 3) {
                            tglMulai = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    }

                    // Cek jika sudah pernah diimpor (Upsert untuk perbaikan otomatis data)
                    let existingKegId = null;
                    if (noBukti) {
                        try {
                            const existCheck = await db.query(
                                `SELECT id FROM spj_kegiatan 
                                 WHERE (kepenghuluan_id = $1 OR kepenghuluan_id IS NULL) 
                                   AND tahun = $2 
                                   AND keterangan ILIKE $3 
                                 LIMIT 1`,
                                [did, tahunNum, `%${noBukti}%`]
                            );
                            if (existCheck.rows.length > 0) {
                                existingKegId = existCheck.rows[0].id;
                            }
                        } catch (errExist) {
                            console.warn('[postImportBku:existCheck]', errExist.message);
                        }
                    }

                    if (existingKegId) {
                        // Perbarui data yang sudah ada dengan nama & sub-bidang bersih dari BKU
                        await db.query(
                            `UPDATE spj_kegiatan 
                             SET nama_kegiatan = $1, bidang = $2, sub_bidang = $3, kode_rekening = $4,
                                 pagu_anggaran = $5, realisasi_anggaran = $6, sumber_dana = $7, jenis_belanja = $8
                             WHERE id = $9`,
                            [nama, bidang, subBidang, kodeRek, pagu, realisasi, sumberDana, jenisBelanja, existingKegId]
                        );
                        insertedKegiatan++;
                        if (noBukti) kegiatanIdMap.set(noBukti.toLowerCase(), existingKegId);
                        if (nama) kegiatanIdMap.set(nama.toLowerCase(), existingKegId);
                        continue;
                    }

                    let insertSql = '';
                    let insertParams = [];

                    if (canFastTrackArchive) {
                        // MODE ARSIP HISTORIS (TA <= 2025): Langsung disahkan SELESAI / SELESAI_FINAL
                        insertSql = `
                            INSERT INTO spj_kegiatan 
                            (nama_kegiatan, tahun, pagu_anggaran, realisasi_anggaran, lokasi, tanggal_mulai, status, keterangan, kepenghuluan_id, tahap_verifikasi,
                             bidang, sub_bidang, kode_rekening, tahap, sumber_dana, jenis_belanja, prioritas_permendes,
                             nama_pelaksana, jabatan_pelaksana,
                             verifikasi_bendahara_oleh, verifikasi_bendahara_at,
                             verifikasi_sekdes_oleh, verifikasi_sekdes_at,
                             persetujuan_penghulu_oleh, persetujuan_penghulu_at,
                             catatan_revisi)
                            VALUES ($1, $2, $3, $4, $5, $6, 'SELESAI', $7, $8, 'SELESAI_FINAL',
                                    $9, $10, $11, 'Tahap 1', $12, $13, 'non_prioritas',
                                    $14, $15,
                                    $16, NOW(), 'Tidak Diperlukan (Arsip Historis BKU)', NOW(), 'Tidak Diperlukan (Arsip Historis BKU)', NOW(),
                                    $17)
                            RETURNING id
                        `;
                        insertParams = [
                            nama,
                            tahunNum,
                            pagu,
                            realisasi,
                            item.lokasi || 'Kepenghuluan',
                            tglMulai,
                            ket,
                            did || null,
                            bidang,
                            subBidang,
                            kodeRek,
                            sumberDana,
                            jenisBelanja,
                            userNama,
                            pelaksana,
                            userNama,
                            `[IMPORT BKU SISKEUDES TA ${tahunNum}] Diimpor otomatis ke Arsip Historis oleh ${userNama}.`
                        ];
                    } else {
                        // MODE DRAFT BERJENJANG (TA >= 2026 atau DRAFT biasa):
                        // Masuk sebagai DRAFT agar diverifikasi berjenjang 4 tahap
                        insertSql = `
                            INSERT INTO spj_kegiatan 
                            (nama_kegiatan, tahun, pagu_anggaran, realisasi_anggaran, lokasi, tanggal_mulai, status, keterangan, kepenghuluan_id, tahap_verifikasi,
                             bidang, sub_bidang, kode_rekening, tahap, sumber_dana, jenis_belanja, prioritas_permendes,
                             nama_pelaksana, jabatan_pelaksana)
                            VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', $7, $8, 'DRAFT',
                                    $9, $10, $11, 'Tahap 1', $12, $13, 'non_prioritas',
                                    $14, $15)
                            RETURNING id
                        `;
                        insertParams = [
                            nama,
                            tahunNum,
                            pagu,
                            realisasi,
                            item.lokasi || 'Kepenghuluan',
                            tglMulai,
                            ket,
                            did || null,
                            bidang,
                            subBidang,
                            kodeRek,
                            sumberDana,
                            jenisBelanja,
                            userNama,
                            pelaksana
                        ];
                    }

                    const resKeg = await db.query(insertSql, insertParams);
                    if (resKeg.rows.length > 0) {
                        insertedKegiatan++;
                        const newId = resKeg.rows[0].id;
                        if (noBukti) kegiatanIdMap.set(noBukti.toLowerCase(), newId);
                        if (nama) kegiatanIdMap.set(nama.toLowerCase(), newId);
                    }
                }
            }

            // 2. Simpan Setoran Pajak Terpilih
            if (Array.isArray(pajak) && pajak.length > 0) {
                for (const p of pajak) {
                    const nom = Number(p.nominal) || 0;
                    if (nom <= 0) continue;

                    let tglSetor = null;
                    if (p.tanggal && p.tanggal.includes('/')) {
                        const parts = p.tanggal.split('/');
                        if (parts.length === 3) {
                            tglSetor = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    } else if (p.tanggal && p.tanggal.includes('-')) {
                        tglSetor = p.tanggal;
                    }
                    if (!tglSetor && tahunNum) {
                        tglSetor = `${tahunNum}-12-31`;
                    }

                    // Kaitkan dengan kegiatan jika ada kecocokan uraian
                    let matchedKegId = null;
                    const pUraian = (p.uraian || '').toLowerCase();
                    for (const [k, kid] of kegiatanIdMap.entries()) {
                        if (k && pUraian.includes(k.substring(0, 18))) {
                            matchedKegId = kid;
                            break;
                        }
                    }

                    // Cek duplikasi agar idempotent saat sinkronisasi ulang
                    let existingPajakId = null;
                    if (p.no_bukti && did) {
                        try {
                            const checkDup = await db.query(
                                `SELECT id FROM spj_pajak WHERE kepenghuluan_id = $1 AND (ntpn = $2 OR uraian ILIKE $3) LIMIT 1`,
                                [did, p.no_bukti, `%${p.no_bukti}%`]
                            );
                            if (checkDup.rows.length > 0) {
                                existingPajakId = checkDup.rows[0].id;
                            }
                        } catch (errDup) {
                            console.warn('[postImportBku:checkDupPajak]', errDup.message);
                        }
                    }

                    if (existingPajakId) {
                        await db.query(`
                            UPDATE spj_pajak 
                            SET jenis_pajak = $1, nominal = $2, kode_billing = $3, tanggal_setor = $4, 
                                uraian = $5, kegiatan_id = COALESCE($6, kegiatan_id)
                            WHERE id = $7
                        `, [
                            p.jenis_pajak || 'Pajak Daerah / Restoran',
                            nom,
                            p.kode_rekening || null,
                            tglSetor,
                            `[SSP: ${p.no_bukti || '-'}] ${p.uraian || 'Penyetoran Pajak BKU'}`,
                            matchedKegId,
                            existingPajakId
                        ]);
                        insertedPajak++;
                    } else {
                        await db.query(`
                            INSERT INTO spj_pajak 
                            (kegiatan_id, jenis_pajak, nominal, kepenghuluan_id, ntpn, kode_billing, tanggal_setor, uraian)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        `, [
                            matchedKegId,
                            p.jenis_pajak || 'PPN',
                            nom,
                            did || null,
                            p.no_bukti || null,
                            p.kode_rekening || null,
                            tglSetor || new Date(),
                            `[SSP: ${p.no_bukti || '-'}] ${p.uraian || 'Penyetoran Pajak BKU'}`
                        ]);
                        insertedPajak++;
                    }
                }
            }

            return res.json({
                success: true,
                message: `Berhasil mengimpor ${insertedKegiatan} kegiatan SPJ dan ${insertedPajak} data setoran pajak dari BKU Siskeudes!`,
                inserted_kegiatan: insertedKegiatan,
                inserted_pajak: insertedPajak
            });

        } catch (error) {
            console.error('[SPJ:postImportBku]', error);
            return res.status(500).json({ success: false, message: 'Gagal mengimpor data BKU: ' + error.message });
        }
    }
};

module.exports = spjController;
