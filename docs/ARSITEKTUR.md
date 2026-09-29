# SIAD 2.0 — Catatan Arsitektur Sistem

Dokumentasi Arsitektur Sistem Informasi Arsip Digital (SIAD 2.0) Pemerintah Kabupaten Rokan Hilir.

## 1. Spesifikasi Teknis & Keputusan Arsitektur

| # | Aspek | Implementasi & Ringkasan |
|---|-------|--------------------------|
| A-01 | **Model Tenancy** | Multi-tenant terpusat. Satu instans SIAD 2.0 melayani 184 Kepenghuluan se-Kabupaten Rokan Hilir dengan isolasi data ketat berbasis `kepenghuluan_id`. |
| A-02 | **Database Engine** | **PostgreSQL (Port 5432)** di server VPS mandiri. Integritas data menggunakan foreign key cascade dan query terindeks. |
| A-03 | **Penyimpanan Berkas** | **Google Drive API v3 Terpusat (Service Account)**. Otomatisasi pembagian folder hirarkis per desa dan per modul (`SPJ`, `Surat`, `Produk Hukum`, `Aset`, `BUMDes`). |
| A-04 | **Ruang Lingkup Modul** | Persuratan & Disposisi Digital, Penatausahaan SPJ Kegiatan & Buku Pajak, Produk Hukum Kepenghuluan, Inventaris Aset Desa, BUMDes (PP 11/2021), Workspace Arsip, dan Onboarding Desa. |
| A-05 | **Alur Verifikasi SPJ** | Alur verifikasi bertingkat: **Kaur/Kasi (Pengajuan) → Bendahara (Verifikasi Anggaran) → Sekretaris (Verifikasi Berkas) → Penghulu (Persetujuan Akhir)**. Disertai QR Code validasi digital. |
| A-06 | **Hak Akses & Pengguna** | 7 Role aparatur desa: Admin Desa, Penghulu, Sekdes, Bendahara, Kaur Keuangan, Kaur Umum, dan Pengelola Aset, serta Super Admin Kabupaten. |

## 2. Arsitektur Runtime Produksi

```text
┌────────────────────────────────────────────────────────┐
│               Klien Peramban / Web Browser             │
│        Desktop & Mobile (Responsive Layout & EJS)      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (Port 443 / Nginx)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Reverse Proxy (Nginx / aaPanel)            │
└───────────────────────────┬────────────────────────────┘
                            │ Reverse Proxy Localhost:3001
                            ▼
┌────────────────────────────────────────────────────────┐
│         SIAD 2.0 Application Runtime (PM2)             │
│   Node.js 22 + Express 5 + Express-Session + EJS       │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
               ▼                          ▼
   ┌──────────────────────┐   ┌──────────────────────────┐
   │ PostgreSQL Database  │   │  Google Drive Cloud API  │
   │ Port 5432 (Localhost)│   │  Service Account Storage │
   └──────────────────────┘   └──────────────────────────┘
```

## 3. Direktori Utama Sistem

- `controllers/` : Pengendali logika aplikasi lintas modul (Surat, SPJ, Pajak, Aset, BUMDes, Pengaturan).
- `middleware/` : Keamanan, otentikasi sesi, pembatasan hak akses (*Role-Based Access Control*), dan rate limiting.
- `routes/` : Pemetaan rute HTTP RESTful.
- `views/` : Template antarmuka pengguna responsif (EJS).
- `config/` : Konfigurasi koneksi PostgreSQL dan autentikasi Google Drive API.
- `public/` : Aset statis peramban (CSS, JS, Favicon, logo resmi daerah).
