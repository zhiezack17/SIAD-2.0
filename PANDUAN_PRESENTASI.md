# Hasil Penyempurnaan & Panduan Operasional SIAD 2.0

Dokumen ini merangkum seluruh pembenahan, penguatan keamanan, serta implementasi alur kerja birokrasi pada aplikasi **SIAD 2.0 (Sistem Informasi Arsip Digital)** yang telah disinkronkan dengan cadangan server aaPanel.

---

## 1. Ringkasan Perubahan yang Dikerjakan

### A. Sinkronisasi Penuh dengan Sumber aaPanel
- Seluruh 12 modul operasional yang ada di cadangan `siad-v2.com (1).tar.gz` (Surat Masuk/Keluar, SPJ, Produk Hukum, Aset, BUMDes, Arsip Desa, Master Data, Laporan, Pengaturan) telah diekstrak dan disinkronkan ke dalam workspace kerja.
- File-file sementara dan sampah backup lama telah dibersihkan.

### B. Penguatan Sistem Keamanan & Otentikasi
1. **Penghapusan Pintu Belakang (*Backdoor Removal*)**:
   - Pintu belakang `admin` / `admin123` pada [authController.js](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/controllers/authController.js) telah **dihapus total**.
   - Otentikasi kini 100% menggunakan data resmi yang terdaftar di tabel `pengguna`.
2. **Upgrade Algoritma Hashing ke Bcrypt**:
   - Sistem kini memverifikasi password menggunakan `bcrypt`.
   - **Mekanisme Transisi Otomatis**: Jika pengguna lama login menggunakan password MD5 / teks biasa, sistem akan memvalidasi lalu **secara otomatis meng-upgrade hash password pengguna tersebut menjadi `bcrypt`** di database.
3. **Pengecekan Status Akun Aktif**:
   - Pengguna dengan status `aktif = false` atau `status = 'NONAKTIF'` otomatis ditolak saat login.
4. **Penutupan Celah IDOR (Insecure Direct Object References)**:
   - Pada [spjController.js](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/controllers/spjController.js), aksi edit dan **hapus data kegiatan, dokumen, maupun pajak** kini selalu mengunci parameter `kepenghuluan_id`. Pengguna dari satu desa tidak lagi bisa menghapus atau memanipulasi berkas desa lain.
5. **Keamanan Cookie Sesi**:
   - Cookie sesi pada [server.js](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/server.js) telah dipersenjatai dengan `httpOnly: true`, `sameSite: 'lax'`, dan pembacaan `SESSION_SECRET` yang aman dari `.env`.

### C. Alur Verifikasi Bertingkat 4 Tahap SPJ (SOP Desa)
Fitur inti yang dirancang untuk meyakinkan atasan telah aktif sepenuhnya di [spjController.js](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/controllers/spjController.js) dan antarmuka [views/spj_dokumen.ejs](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/views/spj_dokumen.ejs):
1. **Tahap 1: Draft / Pengajuan (Kaur / Kasi / Operator)**:
   - Pelaksana kegiatan menginput pagu, mengunggah nota/kuitansi ke Google Drive, dan menginput pemotongan pajak.
   - Tombol: `📤 Ajukan ke Bendahara`.
2. **Tahap 2: Verifikasi Keuangan (Bendahara)**:
   - Bendahara memeriksa kuitansi dan kesesuaian potongan pajak (PPN/PPh).
   - Pilihan: `✅ Setujui Verifikasi Keuangan` atau `↩️ Minta Revisi` (disertai modal catatan koreksi).
3. **Tahap 3: Verifikasi Administratif (Sekretaris Desa)**:
   - Sekdes memverifikasi kelengkapan administrasi dan nomor rekening APBDes.
   - Pilihan: `✅ Setujui Verifikasi Administrasi` atau `↩️ Minta Revisi`.
4. **Tahap 4: Pengesahan Akhir (Penghulu / Kepala Desa)**:
   - Penghulu memberikan tanda sah akhir (*Approval Final*). Status kegiatan berubah menjadi `Disahkan (Sah)`.
5. **Rekam Jejak Audit (*Audit Trail Log*)**:
   - Mencatat otomatis nama pemeriksa dan timestamp tanggal & jam untuk setiap tahap verifikasi.

### D. Fitur Cetak Lembar Pengesahan SPJ Resmi
- Telah dibuat halaman cetak siap print di [views/spj_cetak.ejs](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/views/spj_cetak.ejs).
- Menggunakan standar format surat resmi pemerintahan (Kop Pemerintah Kabupaten Rokan Hilir + Kepenghuluan, rincian pagu, tabel daftar dokumen fisik, tabel rincian pajak, dan kotak tanda tangan 4 pejabat desa).
- Dilengkapi tombol cetak cepat dan CSS `@media print` untuk ukuran kertas A4.

### E. Switcher Desa Interaktif untuk Super Admin & Auditor
- Pada navbar/topbar [views/layout.ejs](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/views/layout.ejs):
  - Jika yang login adalah **Super Admin / Auditor**: Muncul dropdown switcher yang memungkinkan memilih desa manapun di Kabupaten Rokan Hilir untuk menginspeksi arsip desa tersebut secara langsung.
  - Jika yang login adalah **Perangkat Desa**: Muncul lencana nama desa resmi mereka, dan seluruh query otomatis terisolasi ke desa tersebut.

---

## 2. Hasil Verifikasi Sistem

| Item Uji | Metode Pengujian | Hasil |
| :--- | :--- | :--- |
| **Pemeriksaan Sintaks Node.js** | `node -c` pada server, controller, routes, middleware | ✅ Lolos tanpa error sintaks |
| **Inisialisasi Server** | Booting server via `node server.js` | ✅ Server aktif di port 3001 |
| **Penghapusan Backdoor** | Pemeriksaan kode `admin` / `admin123` | ✅ Terhapus total |
| **Validasi Skema SPJ Otomatis** | `initSchema()` di `config/db.js` | ✅ Kolom verifikasi & audit trail disinkronkan otomatis |

---

## 3. Panduan Akun Uji Coba untuk Simulasi / Presentasi ke Atasan

Berdasarkan data awal di skrip migrasi [PATCH_FULL_183_DESA.sql](file:///c:/Users/fakhr/.gemini/antigravity/scratch/SIAD-2.0/PATCH_FULL_183_DESA.sql), Anda dapat menggunakan akun-akun berikut untuk mensimulasikan alur 4 tahap di depan atasan:

> [!NOTE]
> Kata sandi bawaan untuk seluruh akun contoh di bawah ini pada database awal adalah: **`Admin_SIAD_Rohil2026!`** *(atau password akun yang sudah Anda ubah di database)*.

1. **Super Admin / Auditor (Mode Pengawas Lintas Desa)**:
   - Username: `admin_rohil` (Administrator SIAD Kabupaten)
   - Username: `auditor_rohil` (Auditor Inspektorat Rohil)
   - *Fungsi demo: Tunjukkan fitur dropdown ganti desa di topbar untuk memantau desa mana pun.*
2. **Kaur / Operator (Tahap 1: Penginput)**:
   - Username: `kaur_baganbatu`
   - *Fungsi demo: Tambah kegiatan SPJ baru, upload kuitansi, dan klik tombol "Ajukan ke Bendahara".*
3. **Bendahara Desa (Tahap 2: Verifikator Keuangan)**:
   - Username: `bendahara_baganbatu`
   - *Fungsi demo: Buka SPJ, cek pajak, klik "Setujui Verifikasi Keuangan" atau demonstrasikan penolakan dengan catatan revisi.*
4. **Sekretaris Kepenghuluan (Tahap 3: Verifikator Administrasi)**:
   - Username: `sekdes_baganbatu`
   - *Fungsi demo: Verifikasi administrasi dan teruskan ke Penghulu.*
5. **Penghulu / Kepala Desa (Tahap 4: Pengesahan Akhir)**:
   - Username: `penghulu_baganbatu`
   - *Fungsi demo: Berikan persetujuan akhir, lalu klik tombol **🖨️ Cetak Lembar Pengesahan SPJ** untuk memperlihatkan dokumen resmi siap cetak ke atasan Anda.*
