const db = require('../config/db');
const { uploadToDrive, deleteFromDrive } = require('../config/drive');
const ac = require('../middleware/access');

const bumdesController = {
    getIndex: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            const userDesa = ac.getDesaNama(req, 'BUMDes');
            const tab = req.query.tab || 'profil';

            let profil = null;
            let pengurusList = [];
            let unitUsahaList = [];

            if (did) {
                // Ambil profil BUMDes desa bersangkutan
                const pRes = await db.query('SELECT * FROM bumdes_profil WHERE kepenghuluan_id = $1 LIMIT 1', [did]);
                if (pRes.rows.length > 0) {
                    profil = pRes.rows[0];
                } else {
                    const kepRes = await db.query('SELECT nama FROM kepenghuluan WHERE id = $1', [did]);
                    const namaDesa = kepRes.rows.length > 0 ? kepRes.rows[0].nama : '';
                    profil = {
                        nama_bumdes: `BUMDes ${namaDesa}`,
                        no_badan_hukum: '',
                        nib: '',
                        npwp: '',
                        no_perdes_pendirian: '',
                        tgl_perdes_pendirian: null,
                        no_rekening: '',
                        nama_bank: 'Bank Riau Kepri Syariah / BRI',
                        modal_awal: 0,
                        modal_tambahan: 0,
                        file_ad_art_url: null
                    };
                }

                // DEDUP QUERY: ambil data pengurus unik desa
                const pengRes = await db.query(
                    'SELECT DISTINCT ON (id) * FROM bumdes_pengurus WHERE kepenghuluan_id = $1 ORDER BY id ASC',
                    [did]
                );
                pengurusList = pengRes.rows;

                // DEDUP QUERY: ambil data unit usaha unik desa
                const uRes = await db.query(
                    'SELECT DISTINCT ON (id) * FROM bumdes_unit_usaha WHERE kepenghuluan_id = $1 ORDER BY id DESC',
                    [did]
                );
                unitUsahaList = uRes.rows;

                // Hitung statistik ringkasan
                const totalPengurus = pengurusList.length;
                const unitAktif = unitUsahaList.filter(u => u.status === 'Aktif').length;
                const totalModal = Number(profil.modal_awal || 0) + Number(profil.modal_tambahan || 0);
                const totalPADes = unitUsahaList.reduce((acc, curr) => acc + Number(curr.kontribusi_pades || 0), 0);

                const stats = {
                    totalPengurus,
                    unitAktif,
                    totalModal,
                    totalPADes
                };

                return res.render('bumdes', {
                    title: 'BUMDes - Badan Usaha Milik Desa - SIAD 2.0',
                    isKabupatenMode: false,
                    tab: tab,
                    profil: profil,
                    pengurusList: pengurusList,
                    unitUsahaList: unitUsahaList,
                    stats: stats,
                    query: req.query
                });
            } else {
                // TAMPILAN MODE KABUPATEN (REKAPITULASI SELURUH BUMDES SE-KABUPATEN)
                const rekapSql = `
                    SELECT 
                        k.id AS kepenghuluan_id,
                        k.nama AS nama_kepenghuluan,
                        bp.id AS bumdes_id,
                        COALESCE(bp.nama_bumdes, 'BUMDes ' || k.nama) AS nama_bumdes,
                        bp.no_badan_hukum,
                        bp.nib,
                        COALESCE(bp.modal_awal, 0) + COALESCE(bp.modal_tambahan, 0) AS total_modal,
                        COUNT(DISTINCT bg.id) AS jumlah_pengurus,
                        COUNT(DISTINCT bu.id) AS jumlah_unit_usaha,
                        COUNT(DISTINCT CASE WHEN bu.status = 'Aktif' THEN bu.id END) AS unit_aktif,
                        COALESCE(SUM(DISTINCT bu.omzet_tahunan), 0) AS total_omzet,
                        COALESCE(SUM(DISTINCT bu.kontribusi_pades), 0) AS total_pades
                    FROM kepenghuluan k
                    LEFT JOIN bumdes_profil bp ON k.id = bp.kepenghuluan_id
                    LEFT JOIN bumdes_pengurus bg ON k.id = bg.kepenghuluan_id
                    LEFT JOIN bumdes_unit_usaha bu ON k.id = bu.kepenghuluan_id
                    GROUP BY k.id, k.nama, bp.id, bp.nama_bumdes, bp.no_badan_hukum, bp.nib, bp.modal_awal, bp.modal_tambahan
                    ORDER BY k.nama ASC
                `;
                const rekapRes = await db.query(rekapSql);
                const rekapBumdes = rekapRes.rows;

                const totalBumdes = rekapBumdes.length;
                const totalBerbadanHukum = rekapBumdes.filter(b => b.no_badan_hukum && b.no_badan_hukum.trim()).length;
                const totalUnitAktifKab = rekapBumdes.reduce((acc, curr) => acc + Number(curr.unit_aktif || 0), 0);
                const grandTotalPADes = rekapBumdes.reduce((acc, curr) => acc + Number(curr.total_pades || 0), 0);

                return res.render('bumdes', {
                    title: 'Rekapitulasi BUMDes Se-Kabupaten - SIAD 2.0',
                    isKabupatenMode: true,
                    rekapBumdes: rekapBumdes,
                    stats: {
                        totalPengurus: 0,
                        totalBumdes: totalBumdes,
                        totalBerbadanHukum: totalBerbadanHukum,
                        unitAktif: totalUnitAktifKab,
                        totalModal: 0,
                        totalPADes: grandTotalPADes
                    },
                    tab: 'rekap',
                    profil: null,
                    pengurusList: [],
                    unitUsahaList: [],
                    query: req.query
                });
            }
        } catch (error) {
            console.error('Error BUMDes getIndex:', error);
            res.redirect('/dashboard');
        }
    },

    postProfil: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            if (!did) return res.redirect('/bumdes?tab=profil&status=error_no_desa');

            const {
                nama_bumdes,
                no_badan_hukum,
                nib,
                npwp,
                no_perdes_pendirian,
                tgl_perdes_pendirian,
                no_rekening,
                nama_bank,
                modal_awal,
                modal_tambahan
            } = req.body;

            const userDesa = ac.getDesaNama(req, 'BUMDes');
            let fileAdArtUrl = null;

            if (req.file) {
                try {
                    const driveRes = await uploadToDrive(req.file, userDesa, 'AD-ART', 'BUMDes');
                    if (driveRes && driveRes.webViewLink) {
                        fileAdArtUrl = driveRes.webViewLink;
                    }
                } catch (e) {
                    console.warn('Gagal upload AD/ART ke Google Drive:', e.message);
                }
            }

            const check = await db.query('SELECT id, file_ad_art_url FROM bumdes_profil WHERE kepenghuluan_id = $1', [did]);
            if (check.rows.length > 0) {
                const finalUrl = fileAdArtUrl || check.rows[0].file_ad_art_url;
                await db.query(`
                    UPDATE bumdes_profil SET
                        nama_bumdes = $1,
                        no_badan_hukum = $2,
                        nib = $3,
                        npwp = $4,
                        no_perdes_pendirian = $5,
                        tgl_perdes_pendirian = $6,
                        no_rekening = $7,
                        nama_bank = $8,
                        modal_awal = $9,
                        modal_tambahan = $10,
                        file_ad_art_url = $11,
                        updated_at = NOW()
                    WHERE kepenghuluan_id = $12
                `, [
                    nama_bumdes,
                    no_badan_hukum,
                    nib,
                    npwp,
                    no_perdes_pendirian,
                    tgl_perdes_pendirian || null,
                    no_rekening,
                    nama_bank,
                    parseFloat(modal_awal) || 0,
                    parseFloat(modal_tambahan) || 0,
                    finalUrl,
                    did
                ]);
            } else {
                await db.query(`
                    INSERT INTO bumdes_profil (
                        kepenghuluan_id, nama_bumdes, no_badan_hukum, nib, npwp,
                        no_perdes_pendirian, tgl_perdes_pendirian, no_rekening, nama_bank,
                        modal_awal, modal_tambahan, file_ad_art_url, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
                `, [
                    did,
                    nama_bumdes,
                    no_badan_hukum,
                    nib,
                    npwp,
                    no_perdes_pendirian,
                    tgl_perdes_pendirian || null,
                    no_rekening,
                    nama_bank,
                    parseFloat(modal_awal) || 0,
                    parseFloat(modal_tambahan) || 0,
                    fileAdArtUrl
                ]);
            }

            res.redirect('/bumdes?tab=profil&status=profil_success');
        } catch (error) {
            console.error('Error BUMDes postProfil:', error);
            res.redirect('/bumdes?tab=profil&status=error');
        }
    },

    postPengurus: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            if (!did) return res.redirect('/bumdes?tab=pengurus&status=error_no_desa');

            const { nama, nik, no_hp, jabatan, no_sk, periode, status } = req.body;
            const userDesa = ac.getDesaNama(req, 'BUMDes');
            let fileSkUrl = null;

            if (req.file) {
                try {
                    const driveRes = await uploadToDrive(req.file, userDesa, 'SK-Pengurus', 'BUMDes');
                    if (driveRes && driveRes.webViewLink) {
                        fileSkUrl = driveRes.webViewLink;
                    }
                } catch (e) {
                    console.warn('Gagal upload SK ke Google Drive:', e.message);
                }
            }

            await db.query(`
                INSERT INTO bumdes_pengurus (
                    kepenghuluan_id, nama, nik, no_hp, jabatan, no_sk, periode, file_sk_url, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            `, [
                did,
                nama,
                nik || '',
                no_hp || '',
                jabatan,
                no_sk || '',
                periode || '',
                fileSkUrl,
                status || 'Aktif'
            ]);

            res.redirect('/bumdes?tab=pengurus&status=pengurus_success');
        } catch (error) {
            console.error('Error BUMDes postPengurus:', error);
            res.redirect('/bumdes?tab=pengurus&status=error');
        }
    },

    deletePengurus: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            const { id } = req.body;
            if (!id) return res.redirect('/bumdes?tab=pengurus');

            // 1. Bersihkan file SK di Google Drive jika ada
            try {
                const pCheck = await db.query('SELECT file_sk_url FROM bumdes_pengurus WHERE id = $1', [id]);
                if (pCheck.rows.length > 0 && pCheck.rows[0].file_sk_url) {
                    await deleteFromDrive(pCheck.rows[0].file_sk_url);
                }
            } catch (errDrive) {
                console.warn('[BUMDes:deletePengurus] Gagal hapus di Drive:', errDrive.message);
            }

            if (ac.isSuperAdmin(req)) {
                await db.query('DELETE FROM bumdes_pengurus WHERE id = $1', [id]);
            } else if (did) {
                await db.query('DELETE FROM bumdes_pengurus WHERE id = $1 AND kepenghuluan_id = $2', [id, did]);
            }
            res.redirect('/bumdes?tab=pengurus&status=pengurus_deleted');
        } catch (error) {
            console.error('Error BUMDes deletePengurus:', error);
            res.redirect('/bumdes?tab=pengurus&status=error');
        }
    },

    postUnitUsaha: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            if (!did) return res.redirect('/bumdes?tab=unit&status=error_no_desa');

            const { nama_unit, kategori, omzet_tahunan, kontribusi_pades, jumlah_pekerja, status, keterangan } = req.body;

            await db.query(`
                INSERT INTO bumdes_unit_usaha (
                    kepenghuluan_id, nama_unit, kategori, omzet_tahunan, kontribusi_pades, jumlah_pekerja, status, keterangan, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `, [
                did,
                nama_unit,
                kategori || 'Jasa',
                parseFloat(omzet_tahunan) || 0,
                parseFloat(kontribusi_pades) || 0,
                parseInt(jumlah_pekerja) || 0,
                status || 'Aktif',
                keterangan || ''
            ]);

            res.redirect('/bumdes?tab=unit&status=unit_success');
        } catch (error) {
            console.error('Error BUMDes postUnitUsaha:', error);
            res.redirect('/bumdes?tab=unit&status=error');
        }
    },

    deleteUnitUsaha: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            const { id } = req.body;
            if (!id) return res.redirect('/bumdes?tab=unit');

            if (ac.isSuperAdmin(req)) {
                await db.query('DELETE FROM bumdes_unit_usaha WHERE id = $1', [id]);
            } else if (did) {
                await db.query('DELETE FROM bumdes_unit_usaha WHERE id = $1 AND kepenghuluan_id = $2', [id, did]);
            }
            res.redirect('/bumdes?tab=unit&status=unit_deleted');
        } catch (error) {
            console.error('Error BUMDes deleteUnitUsaha:', error);
            res.redirect('/bumdes?tab=unit&status=error');
        }
    }
};

module.exports = bumdesController;
