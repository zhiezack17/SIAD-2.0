const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function initSchema() {
    try {
        await pool.query(`
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS kepenghuluan_id INTEGER;
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS tahap_verifikasi VARCHAR(50) DEFAULT 'DRAFT';
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS catatan_revisi TEXT;
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS verifikasi_bendahara_oleh VARCHAR(100);
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS verifikasi_bendahara_at TIMESTAMP;
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS verifikasi_sekdes_oleh VARCHAR(100);
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS verifikasi_sekdes_at TIMESTAMP;
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS persetujuan_penghulu_oleh VARCHAR(100);
            ALTER TABLE spj_kegiatan ADD COLUMN IF NOT EXISTS persetujuan_penghulu_at TIMESTAMP;
            
            ALTER TABLE spj_dokumen ADD COLUMN IF NOT EXISTS kepenghuluan_id INTEGER;
            ALTER TABLE spj_pajak ADD COLUMN IF NOT EXISTS kepenghuluan_id INTEGER;

            ALTER TABLE workspace ADD COLUMN IF NOT EXISTS tahun_anggaran INTEGER;
            ALTER TABLE workspace ADD COLUMN IF NOT EXISTS sumber_dana VARCHAR(100);
            ALTER TABLE workspace ADD COLUMN IF NOT EXISTS template_proyek VARCHAR(100);

            ALTER TABLE surat_masuk ADD COLUMN IF NOT EXISTS tanggal_terima DATE;
            ALTER TABLE produk_hukum ADD COLUMN IF NOT EXISTS tanggal_ditetapkan DATE;
            ALTER TABLE aset ADD COLUMN IF NOT EXISTS penanggung_jawab VARCHAR(150);

            -- Tabel Buku Tamu (Resepsionis Digital)
            CREATE TABLE IF NOT EXISTS buku_tamu (
                id SERIAL PRIMARY KEY,
                kepenghuluan_id INTEGER,
                nama_tamu VARCHAR(150) NOT NULL,
                instansi_asal VARCHAR(150),
                kategori_tamu VARCHAR(50) DEFAULT 'WARGA',
                no_hp VARCHAR(50),
                pejabat_dituju VARCHAR(100),
                keperluan TEXT NOT NULL,
                jumlah_orang INTEGER DEFAULT 1,
                tanda_tangan TEXT,
                foto_tamu TEXT,
                status VARCHAR(30) DEFAULT 'MENUNGGU',
                catatan_petugas TEXT,
                tanggal_kunjungan DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_buku_tamu_kep ON buku_tamu(kepenghuluan_id);
            CREATE INDEX IF NOT EXISTS idx_buku_tamu_tgl ON buku_tamu(tanggal_kunjungan);

            -- Tabel Perpajakan PBB-P2 (Kolektor & Setoran Pajak Dusun)
            CREATE TABLE IF NOT EXISTS pbb_setoran (
                id SERIAL PRIMARY KEY,
                kepenghuluan_id INTEGER,
                tahun_pajak INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
                nama_wajib_pajak VARCHAR(150),
                nop VARCHAR(50),
                dusun VARCHAR(100),
                rt_rw VARCHAR(50),
                jumlah_pbb NUMERIC(15,2) DEFAULT 0,
                status_bayar VARCHAR(30) DEFAULT 'LUNAS',
                nama_kolektor VARCHAR(100),
                tanggal_bayar DATE DEFAULT CURRENT_DATE,
                nomor_tanda_terima VARCHAR(100),
                catatan TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_pbb_kep ON pbb_setoran(kepenghuluan_id);
            CREATE INDEX IF NOT EXISTS idx_pbb_tahun ON pbb_setoran(tahun_pajak);

            -- Tabel Bantuan Sosial (Bansos / BLT Dana Desa)
            CREATE TABLE IF NOT EXISTS bansos_penerima (
                id SERIAL PRIMARY KEY,
                kepenghuluan_id INTEGER,
                tahun_anggaran INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
                nama_kpm VARCHAR(150) NOT NULL,
                nik VARCHAR(30) NOT NULL,
                no_kk VARCHAR(30),
                dusun VARCHAR(100),
                rt_rw VARCHAR(50),
                jenis_bantuan VARCHAR(50) DEFAULT 'BLT_DANA_DESA',
                nominal_bantuan NUMERIC(15,2) DEFAULT 300000,
                periode_tahap VARCHAR(50) DEFAULT 'TAHAP_1',
                status_penyaluran VARCHAR(30) DEFAULT 'TERDAFTAR',
                tanggal_salur DATE,
                keterangan TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_bansos_kep ON bansos_penerima(kepenghuluan_id);
            CREATE INDEX IF NOT EXISTS idx_bansos_nik ON bansos_penerima(nik);
        `);
        console.log('✅ Skema verifikasi bertingkat SPJ berhasil disinkronkan.');
    } catch (e) {
        console.warn('ℹ️ Inisialisasi skema SPJ opsional:', e.message);
    }
}

pool.on('connect', () => {
    console.log('✅ Berhasil terhubung ke database PostgreSQL');
});

pool.on('error', (err) => {
    console.error('❌ Terjadi kesalahan pada database PostgreSQL:', err.message);
});

// Jalankan inisialisasi kolom skema
initSchema();

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
