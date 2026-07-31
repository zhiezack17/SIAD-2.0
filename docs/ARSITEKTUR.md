# SIAD 2.0 — Catatan Arsitektur (Living Document)

> Status: **Draft**. Tidak mengikat sebelum War Room mengesahkan Decision Gate M-01–M-10 (lihat Paket Peninjauan Arsitektur #01 v0.2).

## 1. Keputusan yang Sudah Disepakati (antara Zhie ↔ Lovable)

| # | Keputusan | Ringkasan |
|---|-----------|-----------|
| A-01 | **Model tenancy** | Multi-tenant. Satu instans SIAD melayani banyak Kepenghuluan. Isolasi data lewat `tenant_id` (Kepenghuluan) + RLS/policy di layer aplikasi. |
| A-02 | **Database** | **PostgreSQL di VPS milik user** (bukan Lovable Cloud). Frontend memanggil VPS melalui REST/JSON API. Skema DB lama (SIAD 1.0) dipertahankan sebagai baseline; migrasi bertahap. |
| A-03 | **Penyimpanan file** | **Google Drive terpusat**. Satu akun service/admin memiliki root folder `SIAD/`. Saat Kepenghuluan pertama kali onboarding, sistem auto-create subfolder `SIAD/<Kode-Kepenghuluan>-<Nama>/`. Setiap penginputan Surat/SPJ/Produk Hukum/Aset/BUMDes membuat subfolder tematik di dalamnya. |
| A-04 | **Ruang lingkup modul (fase 1)** | Surat Masuk/Keluar, SPJ Kegiatan, Produk Hukum, Aset, BUMDes, Arsip umum, Manajemen Perangkat, Pengaturan. Auditor eksternal → fase 2. |
| A-05 | **Alur verifikasi SPJ** | Bertingkat: **Kaur/Kasi (upload) → Bendahara (cek keuangan) → Sekretaris (verifikasi administratif) → Penghulu (persetujuan akhir)**. Setiap tahap wajib timestamp + PIC + catatan. |
| A-06 | **Peran auditor internal** | Zhie sebagai super-admin platform, akses read-only lintas Kepenghuluan untuk keperluan pemeriksaan. |

## 2. Isu Terbuka (menunggu War Room / diskusi lanjutan)

- **M-01..M-10** dari Paket Peninjauan #01 v0.2 (definisi Workspace, granularitas, jenis Workspace, dsb.) — belum efektif.
- Struktur folder Drive final (naming convention, retensi, versi).
- Skema autentikasi (session cookie vs JWT bearer) — sementara: **JWT dari VPS**.
- Integrasi dengan skema SIAD 1.0: apakah *breaking change* atau *additive*.
- Kebijakan retensi & Soft Delete (istilah resmi: Nonaktifkan/Pindah ke Sampah).

## 3. Arsitektur Runtime (target)

```text
┌──────────────────────┐        ┌───────────────────────┐
│  Frontend (Lovable)  │  REST  │  API Layer di VPS     │
│  TanStack Start SSR  │◄──────►│  (Node/PHP/apapun)    │
│  Cloudflare Workers  │  JSON  │  + PostgreSQL         │
└──────────┬───────────┘        └───────────┬───────────┘
           │                                │
           │  Google Drive REST v3          │
           └────────────────┬───────────────┘
                            ▼
                   ┌─────────────────┐
                   │  Google Drive   │
                   │  SIAD/<tenant>/ │
                   └─────────────────┘
```

- **Frontend**: TanStack Start di Cloudflare Workers (managed Lovable).
- **API Layer**: Aplikasi di VPS user, terminasi HTTPS, CORS diizinkan untuk domain SIAD.
- **Drive**: OAuth service account (satu identitas), scope `drive.file` + `drive`. Token disimpan di VPS, tidak di frontend.

## 4. Kontrak API Awal (draft, akan dikembangkan)

Base URL: `VITE_SIAD_API_BASE_URL` (contoh `https://api.siad.example.id/v1`).

Header wajib:
- `Authorization: Bearer <jwt>` (kecuali `/auth/login`)
- `X-Tenant-Id: <kode-kepenghuluan>` (dipilih user setelah login)

Endpoint kerangka:
- `POST /auth/login` → `{ token, user, tenants[] }`
- `GET  /auth/me`
- `GET  /tenants` (untuk super-admin/auditor)
- `GET  /surat?jenis=masuk|keluar`
- `POST /surat`
- `GET  /spj`
- `POST /spj` (upload metadata; file dikirim ke Drive dulu, id disimpan)
- `GET  /produk-hukum`, `GET /aset`, `GET /bumdes`, `GET /arsip`
- `POST /drive/init-tenant` (buat root folder tenant di Drive, dijalankan sekali saat onboarding)

## 5. Konvensi Frontend

- Semua panggilan HTTP lewat `src/lib/api-client.ts` — jangan `fetch()` langsung dari komponen.
- Data fetching pakai TanStack Query (sudah tersedia via `queryClient`).
- Route dibagi per modul di bawah `src/routes/`.
- Layout aplikasi (sidebar + topbar) di `src/routes/_app.tsx` (pathless layout).

## 6. Referensi Dokumen

- `SRS_SIAD_v2.0_Blueprint_v0.1.docx` — baseline resmi.
- `Paket_Peninjauan_Arsitektur_01_SIAD_2.0_v0.2_Draft_War_Room.docx` — pending decisions.
- Model SIAD 2.0 (Workspace Engine) — mockup UX.
