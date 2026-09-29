const db = require('../config/db');
const { uploadToDrive } = require('../config/drive');
const ac = require('../middleware/access');
const QRCode = require('qrcode');

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
                pSql += ` AND (sk.tahun = $${pIdx} OR (sk.tahun IS NULL AND EXTRACT(YEAR FROM sp.created_at) = $${pIdx}))`;
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
                totalSemua: 0
            };

            dataPajak.forEach(item => {
                const nom = Number(item.nominal) || 0;
                const j = (item.jenis_pajak || '').toUpperCase();
                summary.totalSemua += nom;
                if (j.includes('PPN')) summary.totalPPN += nom;
                else if (j.includes('21')) summary.totalPPh21 += nom;
                else if (j.includes('22')) summary.totalPPh22 += nom;
                else if (j.includes('23')) summary.totalPPh23 += nom;
                else summary.totalPajakDaerah += nom;
            });

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
            const { nama, tahun, pagu, lokasi, tgl_mulai, tgl_selesai, ket } = req.body;
            const did = ac.getDesaId(req);

            const sql = `
                INSERT INTO spj_kegiatan 
                (nama_kegiatan, tahun, pagu_anggaran, lokasi, tanggal_mulai, tanggal_selesai, status, keterangan, kepenghuluan_id, tahap_verifikasi)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `;
            const p = [
                nama, 
                tahun ? Number(tahun) : new Date().getFullYear(), 
                pagu ? Number(pagu) : 0, 
                lokasi || '', 
                tgl_mulai || null, 
                tgl_selesai || null, 
                'DRAFT', 
                ket || '', 
                did || null,
                'DRAFT'
            ];

            await db.query(sql, p);
            res.redirect('/spj');
        } catch (error) {
            console.error('[SPJ:postTambah]', error);
            res.redirect('/spj');
        }
    },

    postEdit: async (req, res) => {
        try {
            const { id, nama, tahun, pagu, lokasi, tgl_mulai, tgl_selesai, ket } = req.body;
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);

            let sql = `
                UPDATE spj_kegiatan 
                SET nama_kegiatan=$1, tahun=$2, pagu_anggaran=$3, lokasi=$4, tanggal_mulai=$5, tanggal_selesai=$6, keterangan=$7
                WHERE id=$8
            `;
            let p = [nama, tahun || null, pagu || 0, lokasi, tgl_mulai || null, tgl_selesai || null, ket, id];

            // Proteksi IDOR
            if (!admin && did) {
                sql += ` AND (kepenghuluan_id=$9 OR kepenghuluan_id IS NULL)`;
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
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const userRole = ac.getUserRole(req);
            const userNama = req.session.user.nama || req.session.user.username;

            // 1. Ambil kegiatan saat ini dengan proteksi IDOR
            let checkSql = 'SELECT * FROM spj_kegiatan WHERE id=$1';
            let checkParams = [kegiatan_id];
            if (!admin && did) {
                checkSql += ' AND (kepenghuluan_id=$2 OR kepenghuluan_id IS NULL)';
                checkParams.push(did);
            }

            const check = await db.query(checkSql, checkParams);
            if (check.rows.length === 0) {
                return res.redirect('/spj');
            }

            const k = check.rows[0];
            const currentTahap = k.tahap_verifikasi || 'DRAFT';

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

            } else if (aksi === 'ajukan') {
                // Kaur / Operator mengajukan ke Bendahara
                nextTahap = 'VERIFIKASI_BENDAHARA';
                newStatus = 'DIAJUKAN';
                updateParams.push(nextTahap);
                updateFields.push(`tahap_verifikasi = $${updateParams.length}`);
                updateParams.push(newStatus);
                updateFields.push(`status = $${updateParams.length}`);
                updateFields.push(`catatan_revisi = NULL`);

            } else if (aksi === 'setujui_bendahara' && (userRole.includes('bendahara') || admin)) {
                // Bendahara memverifikasi keuangan & pajak
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

            } else if (aksi === 'setujui_sekdes' && (userRole.includes('sekdes') || userRole.includes('sekretaris') || admin)) {
                // Sekdes memverifikasi administrasi
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

            } else if (aksi === 'setujui_penghulu' && (userRole.includes('penghulu') || userRole.includes('pimpinan') || admin)) {
                // Penghulu memberikan persetujuan akhir
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
            }

            if (updateFields.length > 0) {
                const updateSql = `UPDATE spj_kegiatan SET ${updateFields.join(', ')} WHERE id=$1`;
                await db.query(updateSql, updateParams);
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
                const driveData = await uploadToDrive(req.file, userDesa, 'SPJ', 'Dokumen SPJ');
                if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
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
                const driveData = await uploadToDrive(req.file, userDesa, 'SPJ', 'Pajak SPJ');
                if (driveData && driveData.webViewLink) driveUrl = driveData.webViewLink;
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
                const list = allKegiatan.filter(k => {
                    const bStr = (k.bidang || '').toLowerCase();
                    const kodeRek = (k.kode_rekening || '').trim();
                    return bStr.includes(b.kode) || kodeRek.startsWith(b.kode) || bStr.includes(b.nama.toLowerCase().split(' ')[1]);
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
                WHERE (sk.tahun = $1 OR (sk.tahun IS NULL AND EXTRACT(YEAR FROM sp.created_at) = $1))
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
    }
};

module.exports = spjController;
