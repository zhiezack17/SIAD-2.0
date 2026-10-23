/**
 * ============================================================================
 * SIAD 2.0 - Tutorial & Panduan Interaktif Menu
 * Menggunakan Driver.js v1 untuk panduan interaktif step-by-step
 * ============================================================================
 */

(function () {
  'use strict';

  // Helper untuk mendapatkan driver instance
  function getDriverInstance(steps) {
    if (!window.driver || !window.driver.js || !window.driver.js.driver) {
      console.warn('[SIAD Tour] Driver.js belum termuat.');
      return null;
    }

    // Filter hanya step yang elemennya ada di halaman (atau langkah perkenalan global)
    var validSteps = steps.filter(function (s) {
      if (!s.element) return true;
      if (typeof s.element === 'string') {
        return document.querySelector(s.element) !== null;
      }
      return true;
    });

    if (validSteps.length === 0) {
      console.warn('[SIAD Tour] Tidak ada langkah valid untuk halaman ini.');
      return null;
    }

    return window.driver.js.driver({
      animate: true,
      allowClose: true,
      overlayOpacity: 0.65,
      overlayColor: '#0f172a',
      stagePadding: 8,
      stageRadius: 10,
      showProgress: true,
      popoverClass: 'siad-tour-popover',
      nextBtnText: 'Lanjut &rarr;',
      prevBtnText: '&larr; Kembali',
      doneBtnText: 'Selesai &#10003;',
      progressText: 'Langkah {{current}} dari {{total}}'
    });
  }

  // Deteksi Halaman Aktif Berdasarkan URL & Query Param
  function detectCurrentPage() {
    var path = window.location.pathname.toLowerCase();
    var params = new URLSearchParams(window.location.search);
    var tab = (params.get('tab') || '').toLowerCase();

    if (path.indexOf('/spj/dokumen') !== -1) return 'spj_dokumen';
    if (path.indexOf('/spj/pajak') !== -1 || (path === '/spj' && tab === 'pajak')) return 'spj_pajak';
    if (path === '/spj') return 'spj_kegiatan';

    if (path === '/surat') {
      if (tab === 'keluar') return 'surat_keluar';
      return 'surat_masuk';
    }

    if (path === '/dashboard' || path === '/') return 'dashboard';
    if (path === '/pengaturan') return 'pengaturan';
    if (path === '/aset') return 'aset';
    if (path === '/bumdes') return 'bumdes';
    if (path === '/produk-hukum') return 'produk_hukum';
    if (path === '/laporan') return 'laporan';
    if (path === '/workspace' || path.indexOf('/workspace/') !== -1) return 'workspace';

    return 'general';
  }

  // Definisi Tutorial Langkah demi Langkah per Modul
  var tourDefinitions = {
    // --------------------------------------------------------------------------
    // 1. DASHBOARD
    // --------------------------------------------------------------------------
    dashboard: [
      {
        element: '.topbar',
        popover: {
          title: '🏛️ Selamat Datang di SIAD 2.0',
          description: 'Sistem Informasi Arsip & Tata Kelola Desa Kabupaten Rokan Hilir. Halaman ini adalah beranda utama untuk memantau ringkasan kegiatan dan status administrasi kepenghuluan.'
        }
      },
      {
        element: '.sidebar-nav',
        popover: {
          title: '📁 Navigasi Modul Utama',
          description: 'Melalui bilah menu ini, Anda dapat mengakses semua modul kerja: <b>Persuratan</b>, <b>Kegiatan SPJ</b>, <b>Buku Pajak</b>, <b>Produk Hukum</b>, <b>Aset</b>, <b>BUMDes</b>, hingga <b>Laporan</b>.'
        }
      },
      {
        element: '#formSwitchDesa',
        popover: {
          title: '🌐 Pemilih Kepenghuluan (Khusus Admin)',
          description: 'Pilih nama kepenghuluan untuk memfilter data spesifik satu desa, atau pilih <i>Semua Kepenghuluan</i> untuk memantau rekap se-Kabupaten Rokan Hilir.'
        }
      },
      {
        element: '.stats-grid',
        popover: {
          title: '📊 Ringkasan Statistik Real-Time',
          description: 'Kartu indikator ini menampilkan total dokumen terarsip, berkas SPJ yang <b>Belum Lengkap</b> (memerlukan tindakan), dan berkas yang sudah <b>Terverifikasi Sah</b>.'
        }
      },
      {
        element: '.charts-row .card:first-child',
        popover: {
          title: '📈 Grafik Progres Tahunan',
          description: 'Memantau produktivitas pengarsipan dokumen per tahun anggaran (2023 s.d 2026) secara otomatis langsung dari database.'
        }
      },
      {
        element: '#btn-panduan-topbar',
        popover: {
          title: '❓ Butuh Bantuan Lagi?',
          description: 'Kapan saja Anda merasa bingung, klik tombol <b>Panduan Menu</b> ini di setiap halaman untuk mengulang petunjuk kerja interaktif.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 2. KEGIATAN SPJ (INDUK KEGIATAN)
    // --------------------------------------------------------------------------
    spj_kegiatan: [
      {
        element: '.kembali-btn-wrapper',
        popover: {
          title: '💼 Modul Kegiatan SPJ Desa',
          description: 'Modul ini mengelola data induk kegiatan APBDes, pemberkasan SPJ, verifikasi berjenjang aparatur desa, hingga cetak SPTJB resmi.'
        }
      },
      {
        element: 'a[href*="tab=pajak"]',
        popover: {
          title: '🧾 Beralih ke Buku Pembantu Pajak',
          description: 'Klik tab ini jika ingin membuka <b>Buku Pembantu Pajak</b> untuk memantau atau menginput penyetoran PPN, PPh, dan Pajak Daerah.'
        }
      },
      {
        element: 'button[onclick*="bukaModalSPJ"]',
        popover: {
          title: '➕ Tambah Kegiatan Baru',
          description: 'Klik di sini untuk mendaftarkan kegiatan APBDes baru: nama kegiatan, tahun anggaran, bidang APBDes, pagu dana, dan tahap pencairan.'
        }
      },
      {
        element: 'button[onclick*="bukaModalFilterRekap"]',
        popover: {
          title: '🖨️ Rekapitulasi Realisasi (Siskeudes)',
          description: 'Cetak laporan ringkasan realisasi kegiatan APBDes per tahap/bidang yang siap dicocokkan dengan laporan aplikasi Siskeudes.'
        }
      },
      {
        element: 'tbody tr:first-child td:nth-child(5)',
        popover: {
          title: '🚦 Status Verifikasi (2 Aturan Tahun)',
          description: 'Perhatikan badge status:<br>• <b>TA &le; 2025</b>: Menggunakan <i>Mode Arsip Cepat</i> (langsung sah oleh Bendahara).<br>• <b>TA &ge; 2026</b>: Verifikasi berjenjang 4 akun: Kaur &rarr; Bendahara &rarr; Sekdes &rarr; Penghulu.'
        }
      },
      {
        element: 'tbody tr:first-child td:nth-child(6)',
        popover: {
          title: '📲 Notifikasi WhatsApp 1-Klik',
          description: 'Kirim notifikasi otomatis ke nomor WhatsApp Sekdes, Bendahara, atau Penghulu untuk mengingatkan berkas yang sedang menunggu persetujuan.'
        }
      },
      {
        element: 'tbody tr:first-child td:nth-child(7)',
        popover: {
          title: '📂 Aksi: Berkas, Pajak & Cetak',
          description: 'Gunakan tombol aksi:<br>• <b>📂 Berkas</b>: Unggah SPP, SPTJB, kwitansi & proses pengesahan.<br>• <b>💸 Pajak</b>: Setor NTPN & bukti BPN.<br>• <b>🖨️ Cetak</b>: Cetak lembar pengesahan SPJ ber-barcode.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 3. REKAPITULASI PAJAK (BUKU PEMBANTU PAJAK)
    // --------------------------------------------------------------------------
    spj_pajak: [
      {
        element: 'div[style*="grid-template-columns: repeat(auto-fit"]',
        popover: {
          title: '💰 Ringkasan Setoran Pajak',
          description: 'Memantau akumulasi seluruh jenis pajak yang telah disetor: <b>PPN</b> (11%/12%), <b>PPh</b> (21/22/23), serta <b>Pajak Daerah / Restoran / Galian C</b>.'
        }
      },
      {
        element: 'select[onchange*="tab=pajak"]',
        popover: {
          title: '📅 Filter Tahun Anggaran Pajak',
          description: 'Saring transaksi penyetoran pajak berdasarkan tahun anggaran tertentu untuk keperluan audit BPKP atau Inspektorat daerah.'
        }
      },
      {
        element: 'button[onclick*="exportPajakToExcel"]',
        popover: {
          title: '📥 Ekspor Spreadsheet Excel',
          description: 'Unduh seluruh rincian pemotongan dan penyetoran pajak ke format file <b>Excel (.xlsx)</b> dalam satu kali klik.'
        }
      },
      {
        element: 'a[href*="cetak-buku"]',
        popover: {
          title: '🖨️ Cetak Buku Pembantu Pajak (PDF)',
          description: 'Cetak format resmi Buku Pembantu Pajak lengkap dengan kop kepenghuluan, nomor NTPN, dan kolom tanda tangan Kaur Keuangan/Bendahara.'
        }
      },
      {
        element: 'button[onclick*="modalSetorPajak"]',
        popover: {
          title: '➕ Input Bukti Setor Pajak',
          description: 'Rekam setoran pajak baru: pilih kegiatan, jenis pajak, nominal, nomor <b>NTPN</b> (16 digit), kode billing, dan lampiran struk/BPN.'
        }
      },
      {
        element: '#tabelPajak',
        popover: {
          title: '📑 Buku Transaksi Pajak Digital',
          description: 'Semua rekam jejak penyetoran pajak tersusun rapi secara kronologis, lengkap dengan validasi NTPN perbankan.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 4. SPJ DETAIL BERKAS & VERIFIKASI
    // --------------------------------------------------------------------------
    spj_dokumen: [
      {
        element: '.content-wrapper > div:nth-child(2)',
        popover: {
          title: '📄 Lembar Kerja Dokumen & Verifikasi SPJ',
          description: 'Halaman ini adalah ruang kerja pemeriksaan berkas kegiatan, kelengkapan kwitansi, bukti pajak, dan lembar verifikasi bertingkat.'
        }
      },
      {
        element: 'div[style*="Mode Arsip Historis"]',
        popover: {
          title: '⚡ Mode Arsip Historis (TA &le; 2025)',
          description: 'Khusus kegiatan tahun &le; 2025, berkas dapat langsung disahkan oleh Bendahara/Admin tanpa harus menunggu alur 4 akun aparatur.'
        }
      },
      {
        element: '#formVerifikasiBertingkat, div[style*="Alur Verifikasi Bertingkat"]',
        popover: {
          title: '🛡️ Verifikasi Bertingkat (TA &ge; 2026)',
          description: 'Untuk tahun 2026 ke atas, berkas diverifikasi secara berurutan: Kaur Keuangan &rarr; Bendahara &rarr; Sekdes &rarr; Penghulu (Persetujuan Akhir).'
        }
      },
      {
        element: 'table, .dokumen-list-area',
        popover: {
          title: '📎 Checklist Berkas Syarat SPJ',
          description: 'Unggah atau periksa dokumen prasyarat: SPP, Rincian Anggaran, Kwitansi/Nota, Bukti NTPN Pajak, dan Foto Fisik Kegiatan.'
        }
      },
      {
        element: 'a[href*="/spj/cetak/"]',
        popover: {
          title: '🖨️ Cetak Lembar Pengesahan Ber-Barcode',
          description: 'Unduh atau cetak bukti pengesahan SPJ resmi ber-QR Code untuk diarsipkan dalam binder fisik kepenghuluan.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 5. PERSURATAN (SURAT MASUK)
    // --------------------------------------------------------------------------
    surat_masuk: [
      {
        element: '.content-wrapper > div:nth-child(3)',
        popover: {
          title: '📥 Modul Surat Masuk & Disposisi',
          description: 'Mengelola pencatatan surat dinas yang diterima kantor kepenghuluan, pengarsipan file scan, dan pembuatan lembar disposisi pimpinan.'
        }
      },
      {
        element: 'a[href*="tab=keluar"]',
        popover: {
          title: '📤 Pindah ke Surat Keluar',
          description: 'Klik di sini jika ingin mencatat atau mencari arsip surat keluar resmi yang diterbitkan oleh kepenghuluan.'
        }
      },
      {
        element: 'form[action*="/surat/masuk"]',
        popover: {
          title: '📝 Form Pencatatan Surat Masuk',
          description: 'Input nomor surat, tanggal surat, asal pengirim (Dinas/Kecamatan/Warga), perihal, serta unggah file scan berkas (PDF/Gambar).'
        }
      },
      {
        element: 'button[onclick*="bukaModalAgenda"]',
        popover: {
          title: '🖨️ Buku Agenda Surat & Excel',
          description: 'Cetak Buku Agenda Surat Masuk resmi sesuai tata naskah dinas, atau unduh daftar surat ke spreadsheet Excel.'
        }
      },
      {
        element: 'tbody tr:first-child a[href*="disposisi"], tbody tr:first-child button[onclick*="disposisi"]',
        popover: {
          title: '✍️ Lembar Disposisi Penghulu / Sekdes',
          description: 'Buka lembar disposisi untuk menginput petunjuk/arahan tindak lanjut dari Penghulu kepada aparatur desa yang ditunjuk.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 6. PERSURATAN (SURAT KELUAR)
    // --------------------------------------------------------------------------
    surat_keluar: [
      {
        element: '.content-wrapper > div:nth-child(3)',
        popover: {
          title: '📤 Modul Surat Keluar Resmi',
          description: 'Mendokumentasikan seluruh surat keluar yang diterbitkan Pemerintah Kepenghuluan lengkap dengan nomor agenda resmi.'
        }
      },
      {
        element: 'form[action*="/surat/keluar"]',
        popover: {
          title: '📝 Input Surat Keluar Baru',
          description: 'Catat nomor surat keluar, tanggal surat, instansi/warga tujuan, perihal surat, dan lampirkan file salinan resmi bertanda tangan.'
        }
      },
      {
        element: 'button[onclick*="bukaModalAgenda"]',
        popover: {
          title: '🖨️ Cetak Buku Agenda Surat Keluar',
          description: 'Cetak buku agenda registrasi nomor surat keluar untuk arsip buku fisik kantor desa.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 7. PENGATURAN & MANAJEMEN AKUN
    // --------------------------------------------------------------------------
    pengaturan: [
      {
        element: '.pengaturan-header',
        popover: {
          title: '⚙️ Modul Pengaturan & Manajemen Sistem',
          description: 'Pusat kendali konfigurasi identitas kepenghuluan, logo resmi, alamat kantor, serta pengaturan akun aparatur desa.'
        }
      },
      {
        element: '#formProfilDesa, .pengaturan-card:first-of-type',
        popover: {
          title: '🏛️ Identitas & Kop Surat Kepenghuluan',
          description: 'Isi nama desa, kecamatan, kode wilayah Kemendagri, dan unggah lambang/logo desa agar kop surat dan SPTJB tercetak rapi otomatis.'
        }
      },
      {
        element: '.pengaturan-card:nth-of-type(2), #userTableBody',
        popover: {
          title: '👥 Manajemen 7 Akun Aparatur',
          description: 'SIAD 2.0 menyiapkan 7 akun sesuai tupoksi: Penghulu, Sekdes, Bendahara, Kaur Keuangan, Kaur Perencanaan, Kaur TU & Umum, dan Pengelola Aset.'
        }
      },
      {
        element: 'a[onclick*="bukaModalGantiPassword"]',
        popover: {
          title: '🔐 Keamanan Akun & Kata Sandi',
          description: 'Ganti kata sandi secara berkala untuk menjaga kerahasiaan data keuangan dan administrasi desa Anda.'
        }
      }
    ],

    // --------------------------------------------------------------------------
    // 8. UMUM / MODUL LAIN (ASET, BUMDES, LAPORAN, WORKSPACE)
    // --------------------------------------------------------------------------
    general: [
      {
        element: '.topbar',
        popover: {
          title: '🏛️ Panduan SIAD 2.0',
          description: 'Anda sedang berada di modul administrasi SIAD 2.0. Semua tombol aksi dan navigasi telah dirancang ramah pengguna.'
        }
      },
      {
        element: '.sidebar-nav',
        popover: {
          title: '📁 Menu Navigasi Modul',
          description: 'Gunakan menu di sisi kiri untuk berpindah modul kapan saja dengan aman.'
        }
      },
      {
        element: '#btn-panduan-topbar',
        popover: {
          title: '❓ Bantuan Cepat',
          description: 'Klik tombol ini di setiap halaman untuk melihat panduan interaktif modul tersebut.'
        }
      }
    ]
  };

  // Fungsi Memulai Tur Interaktif
  window.siadStartTour = function (forceRestart) {
    var pageKey = detectCurrentPage();
    var steps = tourDefinitions[pageKey] || tourDefinitions.general;

    // Filter langkah yang elemennya ada di halaman saat ini
    var validSteps = steps.filter(function (step) {
      if (!step.element) return true;
      try {
        var el = document.querySelector(step.element);
        return el !== null && el.offsetParent !== null; // Elemen terlihat
      } catch (e) {
        return false;
      }
    });

    if (validSteps.length === 0) {
      validSteps = [
        {
          element: '.topbar',
          popover: {
            title: '💡 Panduan Halaman',
            description: 'Selamat datang di modul SIAD 2.0. Gunakan menu navigasi di sisi kiri untuk mengakses data kegiatan dan administrasi desa.'
          }
        }
      ];
    }

    // Buat objek driver baru
    var driverObj = window.driver.js.driver({
      animate: true,
      allowClose: true,
      overlayOpacity: 0.65,
      overlayColor: '#0f172a',
      stagePadding: 8,
      stageRadius: 10,
      showProgress: true,
      popoverClass: 'siad-tour-popover',
      nextBtnText: 'Lanjut &rarr;',
      prevBtnText: '&larr; Kembali',
      doneBtnText: 'Selesai &#10003;',
      progressText: 'Langkah {{current}} dari {{total}}',
      steps: validSteps,
      onDestroyed: function () {
        try {
          localStorage.setItem('siad_tour_done_' + pageKey, '1');
          var dot = document.querySelector('#btn-panduan-topbar .pulse-dot');
          if (dot) dot.remove();
        } catch (e) {}
      }
    });

    driverObj.drive();
  };

  // Inisialisasi Otomatis Saat DOM Siap
  document.addEventListener('DOMContentLoaded', function () {
    // 1. Tambahkan data-siad-tooltip pada elemen penting yang belum memilikinya
    addContextualTooltips();

    // 2. Cek apakah pengguna baru pertama kali membuka modul ini
    try {
      var pageKey = detectCurrentPage();
      var hasSeenTour = localStorage.getItem('siad_tour_done_' + pageKey);

      // Jika belum pernah melihat tur di halaman ini, beri tanda titik hijau di tombol panduan
      var btnTopbar = document.getElementById('btn-panduan-topbar');
      if (btnTopbar && !hasSeenTour) {
        var dot = document.createElement('span');
        dot.className = 'pulse-dot';
        btnTopbar.prepend(dot);
      }
    } catch (e) {}
  });

  // Pasang Tooltip Kontekstual pada tombol-tombol utama aplikasi
  function addContextualTooltips() {
    var tooltipsMap = [
      { sel: '#btn-panduan-topbar', text: 'Klik untuk memulai panduan langkah demi langkah halaman ini' },
      { sel: 'a[href="/dashboard"]', text: 'Kembali ke ringkasan beranda utama' },
      { sel: 'a[href="/spj"]', text: 'Kelola data induk SPJ kegiatan & alur verifikasi APBDes' },
      { sel: 'a[href*="tab=pajak"]', text: 'Rekapitulasi pemotongan & bukti setor pajak (PPN, PPh, Daerah)' },
      { sel: 'a[href*="/surat?tab=masuk"]', text: 'Catat surat masuk, arsip file & lembar disposisi pimpinan' },
      { sel: 'a[href*="/surat?tab=keluar"]', text: 'Catat nomor & arsip salinan surat keluar resmi' },
      { sel: 'button[onclick*="exportPajakToExcel"]', text: 'Unduh seluruh data setoran pajak ke file Excel (.xlsx)' },
      { sel: 'a[href*="cetak-buku"]', text: 'Cetak Buku Pembantu Pajak format resmi Permendagri 20/2018' },
      { sel: 'button[onclick*="modalSetorPajak"]', text: 'Rekam bukti setoran pajak baru dengan nomor NTPN' },
      { sel: 'button[onclick*="bukaModalSPJ"]', text: 'Tambahkan kegiatan baru dalam APBDes' },
      { sel: 'a[href*="whatsapp.com"]', text: 'Kirim notifikasi langsung ke WhatsApp pejabat berwenang' }
    ];

    tooltipsMap.forEach(function (item) {
      try {
        var el = document.querySelector(item.sel);
        if (el && !el.getAttribute('data-siad-tooltip')) {
          el.setAttribute('data-siad-tooltip', item.text);
        }
      } catch (e) {}
    });
  }
})();

