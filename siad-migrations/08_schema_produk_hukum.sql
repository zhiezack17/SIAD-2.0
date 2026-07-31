-- ============================================================
-- SIAD 2.0 — Migrasi 08: Skema Produk Hukum
-- ============================================================

CREATE TYPE jenis_produk_hukum AS ENUM (
  'peraturan_kepenghuluan',
  'peraturan_bersama_penghulu',
  'peraturan_penghulu',
  'keputusan_penghulu',
  'instruksi_penghulu'
);

CREATE TYPE status_produk_hukum AS ENUM (
  'draft',
  'ditetapkan',
  'diundangkan',
  'dicabut'
);

CREATE TABLE IF NOT EXISTS produk_hukum (
  id                  SERIAL PRIMARY KEY,
  kepenghuluan_id     INTEGER NOT NULL REFERENCES kepenghuluan(id) ON DELETE CASCADE,
  jenis               jenis_produk_hukum NOT NULL,
  nomor               VARCHAR(50) NOT NULL,
  tahun               INTEGER NOT NULL,
  judul               TEXT NOT NULL,
  tentang             TEXT NOT NULL,
  tanggal_ditetapkan  DATE,
  tanggal_diundangkan DATE,
  ditetapkan_oleh     VARCHAR(150),
  jabatan             VARCHAR(100),
  status              status_produk_hukum NOT NULL DEFAULT 'draft',
  referensi           JSONB DEFAULT '[]'::jsonb,
  drive_file_id       VARCHAR(255),
  drive_file_url      TEXT,
  file_name           VARCHAR(255),
  created_by          INTEGER REFERENCES pengguna(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kepenghuluan_id, jenis, nomor, tahun)
);

CREATE INDEX IF NOT EXISTS idx_produk_hukum_kepenghuluan ON produk_hukum(kepenghuluan_id);
CREATE INDEX IF NOT EXISTS idx_produk_hukum_status        ON produk_hukum(status);
CREATE INDEX IF NOT EXISTS idx_produk_hukum_tahun         ON produk_hukum(tahun);

CREATE TABLE IF NOT EXISTS riwayat_produk_hukum (
  id              SERIAL PRIMARY KEY,
  produk_hukum_id INTEGER NOT NULL REFERENCES produk_hukum(id) ON DELETE CASCADE,
  aksi            VARCHAR(50) NOT NULL,
  status_lama     status_produk_hukum,
  status_baru     status_produk_hukum,
  catatan         TEXT,
  oleh_pengguna   INTEGER REFERENCES pengguna(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riwayat_ph_produk ON riwayat_produk_hukum(produk_hukum_id);
