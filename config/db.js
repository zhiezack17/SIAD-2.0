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
