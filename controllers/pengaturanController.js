const db = require('../config/db');
const ac = require('../middleware/access');

const pengaturanController = {
    getIndex: async (req, res) => {
        try {
            const did = ac.getDesaId(req);
            let data = null;
            if (did) {
                const result = await db.query('SELECT * FROM profil_desa WHERE kepenghuluan_id = $1 LIMIT 1', [did]);
                if (result.rows.length > 0) {
                    data = result.rows[0];
                } else {
                    const kepRes = await db.query('SELECT nama FROM kepenghuluan WHERE id = $1', [did]);
                    const namaDesa = kepRes.rows.length > 0 ? kepRes.rows[0].nama : '';
                    data = { nama_desa: namaDesa, nama_kepala_desa: '', alamat: '', kepenghuluan_id: did };
                }
            } else {
                const result = await db.query('SELECT * FROM profil_desa ORDER BY id ASC LIMIT 1');
                data = result.rows[0] || { nama_desa: '', nama_kepala_desa: '', alamat: '' };
            }

            let kepenghuluanList = [];
            let generatedUsers = [];
            let generatedDesa = null;

            if (ac.isSuperAdmin(req)) {
                const listRes = await db.query(`
                    SELECT k.id, k.nama, kc.nama as kecamatan_nama,
                           (SELECT COUNT(*) FROM pengguna WHERE kepenghuluan_id = k.id) as user_count
                    FROM kepenghuluan k
                    LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id
                    ORDER BY k.nama ASC
                `);
                kepenghuluanList = listRes.rows;

                if (req.query.status === 'init_success' && req.query.desa_id) {
                    const uRes = await db.query(
                        'SELECT username, nama_lengkap, role, aktif FROM pengguna WHERE kepenghuluan_id = $1 ORDER BY id ASC',
                        [req.query.desa_id]
                    );
                    generatedUsers = uRes.rows;

                    const dRes = await db.query('SELECT nama FROM kepenghuluan WHERE id = $1', [req.query.desa_id]);
                    if (dRes.rows.length > 0) {
                        generatedDesa = dRes.rows[0].nama;
                    }
                }
            }

            res.render('pengaturan', {
                title: 'Pengaturan & Onboarding Desa - SIAD 2.0',
                data: data,
                kepenghuluanList: kepenghuluanList,
                generatedUsers: generatedUsers,
                generatedDesa: generatedDesa,
                query: req.query
            });
        } catch (error) {
            console.error('Error Pengaturan:', error);
            res.redirect('/dashboard');
        }
    },
    
    postUpdate: async (req, res) => {
        try {
            const { nama_desa, nama_kepala_desa, alamat } = req.body;
            const did = ac.getDesaId(req);

            if (did) {
                const check = await db.query('SELECT id FROM profil_desa WHERE kepenghuluan_id = $1 LIMIT 1', [did]);
                if (check.rows.length > 0) {
                    await db.query(
                        'UPDATE profil_desa SET nama_desa = $1, nama_kepala_desa = $2, alamat = $3 WHERE id = $4',
                        [nama_desa, nama_kepala_desa, alamat, check.rows[0].id]
                    );
                } else {
                    await db.query(
                        'INSERT INTO profil_desa (nama_desa, nama_kepala_desa, alamat, kepenghuluan_id) VALUES ($1, $2, $3, $4)',
                        [nama_desa, nama_kepala_desa, alamat, did]
                    );
                }
            } else {
                const check = await db.query('SELECT id FROM profil_desa ORDER BY id ASC LIMIT 1');
                if (check.rows.length > 0) {
                    await db.query(
                        'UPDATE profil_desa SET nama_desa = $1, nama_kepala_desa = $2, alamat = $3 WHERE id = $4',
                        [nama_desa, nama_kepala_desa, alamat, check.rows[0].id]
                    );
                } else {
                    await db.query(
                        'INSERT INTO profil_desa (nama_desa, nama_kepala_desa, alamat) VALUES ($1, $2, $3)',
                        [nama_desa, nama_kepala_desa, alamat]
                    );
                }
            }
            res.redirect('/pengaturan?status=success');
        } catch (error) {
            console.error('Error Update Pengaturan:', error);
            res.redirect('/pengaturan?status=error');
        }
    },

    postInisialisasiDesa: async (req, res) => {
        try {
            if (!ac.isSuperAdmin(req)) {
                return res.status(403).send('Akses Ditolak: Hanya Super Admin Rohil yang dapat menginisialisasi akun desa.');
            }

            const { kepenghuluan_id } = req.body;
            if (!kepenghuluan_id) {
                return res.redirect('/pengaturan?status=error_no_desa');
            }

            const kepRes = await db.query(
                'SELECT k.id, k.nama, kc.nama as kecamatan_nama FROM kepenghuluan k LEFT JOIN kecamatan kc ON k.kecamatan_id = kc.id WHERE k.id = $1',
                [kepenghuluan_id]
            );
            if (kepRes.rows.length === 0) {
                return res.redirect('/pengaturan?status=error_desa_not_found');
            }

            const kep = kepRes.rows[0];

            let rawName = kep.nama.toLowerCase()
                .replace(/^(kel\.|kelurahan|desa|kepenghuluan)\s+/i, '')
                .trim();
            let slug = rawName.replace(/[^a-z0-9]/g, '');
            if (!slug) {
                slug = 'desa' + kep.id;
            }

            const adminRes = await db.query("SELECT password FROM pengguna WHERE username = 'admin_rohil' LIMIT 1");
            if (adminRes.rows.length === 0) {
                return res.redirect('/pengaturan?status=error_hash');
            }
            const defaultHash = adminRes.rows[0].password;

            const accounts = [
                {
                    username: `admin_${slug}`,
                    nama_lengkap: `Admin Kepenghuluan ${kep.nama}`,
                    peran: 'admin_desa',
                    role: 'admin'
                },
                {
                    username: `penghulu_${slug}`,
                    nama_lengkap: `Penghulu ${kep.nama}`,
                    peran: 'pimpinan',
                    role: 'penghulu'
                },
                {
                    username: `sekdes_${slug}`,
                    nama_lengkap: `Sekretaris Desa ${kep.nama}`,
                    peran: 'sekdes',
                    role: 'sekretaris'
                },
                {
                    username: `bendahara_${slug}`,
                    nama_lengkap: `Bendahara ${kep.nama}`,
                    peran: 'bendahara',
                    role: 'bendahara'
                },
                {
                    username: `kaur_${slug}`,
                    nama_lengkap: `Kaur Keuangan ${kep.nama}`,
                    peran: 'operator',
                    role: 'kaur'
                },
                {
                    username: `kaur_umum_${slug}`,
                    nama_lengkap: `Kaur Tata Usaha & Umum ${kep.nama}`,
                    peran: 'kaur_umum',
                    role: 'kaur_umum'
                }
            ];

            for (const acc of accounts) {
                const existing = await db.query("SELECT id FROM pengguna WHERE username = $1", [acc.username]);
                if (existing.rows.length === 0) {
                    await db.query(
                        `INSERT INTO pengguna (username, password, nama_lengkap, peran, role, kepenghuluan_id, aktif, created_at)
                         VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
                        [acc.username, defaultHash, acc.nama_lengkap, acc.peran, acc.role, kep.id]
                    );
                } else {
                    await db.query(
                        `UPDATE pengguna SET kepenghuluan_id = $1, aktif = true, peran = $2, role = $3 WHERE id = $4`,
                        [kep.id, acc.peran, acc.role, existing.rows[0].id]
                    );
                }
            }

            const profilCheck = await db.query("SELECT id FROM profil_desa WHERE kepenghuluan_id = $1", [kep.id]);
            if (profilCheck.rows.length === 0) {
                await db.query(
                    `INSERT INTO profil_desa (nama_desa, nama_kepala_desa, alamat, kepenghuluan_id)
                     VALUES ($1, $2, $3, $4)`,
                    [kep.nama, `Penghulu ${kep.nama}`, `Kecamatan ${kep.kecamatan_nama || 'Rokan Hilir'}, Kab. Rokan Hilir`, kep.id]
                );
            }

            res.redirect(`/pengaturan?status=init_success&desa_id=${kep.id}`);
        } catch (error) {
            console.error('Error inisialisasi desa:', error);
            res.redirect('/pengaturan?status=error_init');
        }
    }
};

module.exports = pengaturanController;
