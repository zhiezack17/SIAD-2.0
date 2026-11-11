/**
 * ====================================================================
 * GOOGLE APPS SCRIPT (GAS) - SIAD 2.0 GOOGLE DRIVE CONNECTOR (V7)
 * ====================================================================
 * Salin dan tempel kode ini ke editor Google Apps Script di:
 * https://script.google.com/
 * 
 * Fitur & Struktur Hierarki Otomatis:
 * SIAD 2.0
 *   └── [Nama Kepenghuluan] (misal: Bantaian Baru)
 *       └── SPJ [Tahun] (misal: SPJ 2025 / SPJ 2023)
 *           └── [Bidang APBDes] (misal: Bidang 3 - Pembinaan Kemasyarakatan)
 *               └── [Sub Bidang / Kegiatan] (misal: Insentif Guru Tahfiz)
 *                   ├── Dokumen SPJ (Kwitansi, SPP, BKU, Berkas PDF)
 *                   ├── Dokumentasi SPJ (Foto 0%, 50%, 100%)
 *                   └── Pajak SPJ (Bukti SSP Setoran Pajak)
 * ====================================================================
 */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ status: 'error', message: 'Tidak ada data postData yang diterima.' });
    }

    var data = JSON.parse(e.postData.contents);

    // ================================================================
    // 1. FITUR HAPUS / PINDAHKAN KE TONG SAMPAH (TRASH)
    // ================================================================
    if (data.action === 'delete' || data.action === 'trash') {
      var fileId = data.fileId;
      if (!fileId) {
        return responseJson({ status: 'error', message: 'Parameter fileId wajib disertakan.' });
      }

      try {
        var targetFile = DriveApp.getFileById(fileId);
        targetFile.setTrashed(true); // Memindahkan file ke Sampah Google Drive
        return responseJson({ 
          status: 'success', 
          message: 'Berkas berhasil dipindahkan ke Sampah Google Drive', 
          fileId: fileId 
        });
      } catch (errTrash) {
        return responseJson({ 
          status: 'error', 
          message: 'Gagal memindahkan file ke sampah: ' + errTrash.message,
          fileId: fileId 
        });
      }
    }

    // ================================================================
    // 2. FITUR UPLOAD BERKAS KE GOOGLE DRIVE DENGAN SUBFOLDER HIERARKI RAPI
    // ================================================================
    if (data.file) {
      var folderRootId = '18jQB_3bSXtmno5MgD5c4t2F-1vvPm3ie'; // Folder Induk SIAD 2.0
      var rootFolder;
      try {
        rootFolder = DriveApp.getFolderById(folderRootId);
      } catch (fErr) {
        rootFolder = DriveApp.getRootFolder();
      }
      
      var desaName = data.kepenghuluan || 'Umum';
      var tahun = data.tahun ? ('SPJ ' + data.tahun) : 'SPJ 2025';
      
      // Normalisasi nama bidang agar tidak ada karakter terlarang di nama folder
      var bidang = data.bidang || 'Bidang 1 - Penyelenggaraan Pemerintahan Desa';
      bidang = String(bidang).replace(/[:]/g, ' -').trim();

      // Normalisasi sub-bidang / nama kegiatan
      var subBidang = data.sub_bidang || data.kegiatan || 'Kegiatan Umum';
      subBidang = String(subBidang).replace(/[\/\\:*?"<>|]/g, '-').trim();
      if (subBidang.length > 80) subBidang = subBidang.substring(0, 80);

      // Kategori dokumen: Dokumen SPJ, Dokumentasi SPJ, Pajak SPJ, Surat Masuk, dll.
      var kategori = data.kategori || data.modul || 'Dokumen SPJ';

      // ==============================================================
      // MEMBUAT STRUKTUR FOLDER SESUAI KEINGINAN:
      // Kepenghuluan -> SPJ [Tahun] -> Bidang -> Sub Bidang / Kegiatan -> Kategori
      // ==============================================================
      var desaFolder = getOrCreateFolder(rootFolder, desaName);
      var tahunFolder = getOrCreateFolder(desaFolder, tahun);
      var bidangFolder = getOrCreateFolder(tahunFolder, bidang);
      var subBidangFolder = getOrCreateFolder(bidangFolder, subBidang);
      var targetFolder = getOrCreateFolder(subBidangFolder, kategori);

      // Decode base64 dan simpan file
      var decodedBytes = Utilities.base64Decode(data.file);
      var blob = Utilities.newBlob(decodedBytes, data.mimeType || 'application/octet-stream', data.fileName || 'dokumen');
      var newFile = targetFolder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return responseJson({
        status: 'success',
        id: newFile.getId(),
        name: newFile.getName(),
        url: newFile.getUrl(),
        folderPath: desaName + ' / ' + tahun + ' / ' + bidang + ' / ' + subBidang + ' / ' + kategori
      });
    }

    return responseJson({ status: 'error', message: 'Aksi tidak dikenali atau isi file kosong.' });

  } catch (error) {
    return responseJson({ status: 'error', message: 'Terjadi kesalahan sistem GAS: ' + error.message });
  }
}

function getOrCreateFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parentFolder.createFolder(folderName);
  }
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
