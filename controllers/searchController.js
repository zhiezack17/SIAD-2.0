const db = require('../config/db');
const ac = require('../middleware/access');

const searchController = {
    getPencarianGlobal: async (req, res) => {
        try {
            const rawQuery = (req.query.q || req.query.keyword || '').trim();
            const admin = ac.isAdmin(req);
            const did = ac.getDesaId(req);
            const isKaurUmumUser = ac.isKaurUmum ? ac.isKaurUmum(req) : false;

            if (!rawQuery) {
                return res.render('pencarian_global', {
                    title: 'Pencarian Global - SIAD 2.0',
                    query: '',
                    totalCount: 0,
                    results: {
                        suratMasuk: [],
                        suratKeluar: [],
                        spj: [],
                        produkHukum: [],
                        aset: [],
                        bumdes: []
                    }
                });
            }

            const searchParam = `%${rawQuery}%`;

            // 1. Cari Surat Masuk
            let suratMasuk = [];
            try {
                let sql = `
                    SELECT sm.id, sm.nomor_surat, sm.tanggal_surat, sm.pengirim, sm.perihal, sm.file_url,
                           k.nama AS nama_desa
                    FROM surat_masuk sm
                    LEFT JOIN kepenghuluan k ON sm.kepenghuluan_id = k.id
                    WHERE (sm.nomor_surat ILIKE $1 OR sm.pengirim ILIKE $1 OR sm.perihal ILIKE $1)
                `;
                let p = [searchParam];
                if (did) {
                    sql += ` AND (sm.kepenghuluan_id = $2 OR sm.kepenghuluan_id IS NULL)`;
                    p.push(did);
                } else if (!admin && !did) {
                    sql += ` AND sm.kepenghuluan_id IS NULL`;
                }
                sql += ` ORDER BY sm.id DESC LIMIT 15`;
                const r = await db.query(sql, p);
                suratMasuk = r.rows;
            } catch (e) {
                console.error('[SEARCH:surat_masuk]', e.message);
            }

            // 2. Cari Surat Keluar
            let suratKeluar = [];
            try {
                let sql = `
                    SELECT sk.id, sk.nomor_surat, sk.tanggal_surat, sk.tujuan, sk.perihal, sk.file_url,
                           k.nama AS nama_desa
                    FROM surat_keluar sk
                    LEFT JOIN kepenghuluan k ON sk.kepenghuluan_id = k.id
                    WHERE (sk.nomor_surat ILIKE $1 OR sk.tujuan ILIKE $1 OR sk.perihal ILIKE $1)
                `;
                let p = [searchParam];
                if (did) {
                    sql += ` AND (sk.kepenghuluan_id = $2 OR sk.kepenghuluan_id IS NULL)`;
                    p.push(did);
                } else if (!admin && !did) {
                    sql += ` AND sk.kepenghuluan_id IS NULL`;
                }
                sql += ` ORDER BY sk.id DESC LIMIT 15`;
                const r = await db.query(sql, p);
                suratKeluar = r.rows;
            } catch (e) {
                console.error('[SEARCH:surat_keluar]', e.message);
            }

            let spj = [];
            let produkHukum = [];
            let aset = [];
            let bumdes = [];

            // Jika BUKAN Kaur Umum, cari di modul SPJ, Produk Hukum, Aset, dan BUMDes
            if (!isKaurUmumUser) {
                // 3. Cari Kegiatan SPJ
                try {
                    let sql = `
                        SELECT spj.id, spj.nama_kegiatan, spj.bidang, spj.kegiatan, spj.tahun, spj.anggaran, spj.status_verifikasi,
                               k.nama AS nama_desa
                        FROM spj_kegiatan spj
                        LEFT JOIN kepenghuluan k ON spj.kepenghuluan_id = k.id
                        WHERE (spj.nama_kegiatan ILIKE $1 OR COALESCE(spj.bidang, '') ILIKE $1 OR COALESCE(spj.kegiatan, '') ILIKE $1)
                    `;
                    let p = [searchParam];
                    if (did) {
                        sql += ` AND (spj.kepenghuluan_id = $2 OR spj.kepenghuluan_id IS NULL)`;
                        p.push(did);
                    } else if (!admin && !did) {
                        sql += ` AND spj.kepenghuluan_id IS NULL`;
                    }
                    sql += ` ORDER BY spj.id DESC LIMIT 15`;
                    const r = await db.query(sql, p);
                    spj = r.rows;
                } catch (e) {
                    console.error('[SEARCH:spj_kegiatan]', e.message);
                }

                // 4. Cari Produk Hukum
                try {
                    let sql = `
                        SELECT ph.id, ph.jenis, ph.nomor, ph.tahun, ph.judul, ph.status, ph.drive_file_url,
                               k.nama AS nama_desa
                        FROM produk_hukum ph
                        LEFT JOIN kepenghuluan k ON ph.kepenghuluan_id = k.id
                        WHERE (ph.judul ILIKE $1 OR ph.nomor ILIKE $1 OR ph.jenis ILIKE $1)
                    `;
                    let p = [searchParam];
                    if (did) {
                        sql += ` AND (ph.kepenghuluan_id = $2 OR ph.kepenghuluan_id IS NULL)`;
                        p.push(did);
                    } else if (!admin && !did) {
                        sql += ` AND ph.kepenghuluan_id IS NULL`;
                    }
                    sql += ` ORDER BY ph.id DESC LIMIT 15`;
                    const r = await db.query(sql, p);
                    produkHukum = r.rows;
                } catch (e) {
                    console.error('[SEARCH:produk_hukum]', e.message);
                }

                // 5. Cari Aset Desa
                try {
                    let sql = `
                        SELECT a.id, a.kode, a.nama, a.merk, a.tipe, a.kondisi, a.tahun_perolehan, a.lokasi, a.keterangan,
                               k.nama AS nama_desa
                        FROM aset a
                        LEFT JOIN kepenghuluan k ON a.kepenghuluan_id = k.id
                        WHERE (a.nama ILIKE $1 OR a.kode ILIKE $1 OR COALESCE(a.keterangan, '') ILIKE $1 OR COALESCE(a.lokasi, '') ILIKE $1)
                    `;
                    let p = [searchParam];
                    if (did) {
                        sql += ` AND (a.kepenghuluan_id = $2 OR a.kepenghuluan_id IS NULL)`;
                        p.push(did);
                    } else if (!admin && !did) {
                        sql += ` AND a.kepenghuluan_id IS NULL`;
                    }
                    sql += ` ORDER BY a.id DESC LIMIT 15`;
                    const r = await db.query(sql, p);
                    aset = r.rows;
                } catch (e) {
                    console.error('[SEARCH:aset]', e.message);
                }

                // 6. Cari BUMDes (Unit Usaha & Pengurus)
                try {
                    let sql = `
                        SELECT u.id, u.nama_unit, u.kategori, u.deskripsi, u.penanggung_jawab,
                               k.nama AS nama_desa
                        FROM bumdes_unit_usaha u
                        LEFT JOIN kepenghuluan k ON u.kepenghuluan_id = k.id
                        WHERE (u.nama_unit ILIKE $1 OR COALESCE(u.deskripsi, '') ILIKE $1 OR COALESCE(u.kategori, '') ILIKE $1)
                    `;
                    let p = [searchParam];
                    if (did) {
                        sql += ` AND (u.kepenghuluan_id = $2 OR u.kepenghuluan_id IS NULL)`;
                        p.push(did);
                    } else if (!admin && !did) {
                        sql += ` AND u.kepenghuluan_id IS NULL`;
                    }
                    sql += ` ORDER BY u.id DESC LIMIT 15`;
                    const r = await db.query(sql, p);
                    bumdes = r.rows;
                } catch (e) {
                    // Tabel mungkin bernama lain atau opsional
                }
            }

            const totalCount = suratMasuk.length + suratKeluar.length + spj.length + produkHukum.length + aset.length + bumdes.length;

            res.render('pencarian_global', {
                title: `Hasil Pencarian "${rawQuery}" - SIAD 2.0`,
                query: rawQuery,
                totalCount,
                results: {
                    suratMasuk,
                    suratKeluar,
                    spj,
                    produkHukum,
                    aset,
                    bumdes
                }
            });

        } catch (error) {
            console.error('[SEARCH:getPencarianGlobal]', error);
            res.render('pencarian_global', {
                title: 'Pencarian Global - SIAD 2.0',
                query: req.query.q || '',
                totalCount: 0,
                results: {
                    suratMasuk: [],
                    suratKeluar: [],
                    spj: [],
                    produkHukum: [],
                    aset: [],
                    bumdes: []
                },
                error: error.message
            });
        }
    }
};

module.exports = searchController;
