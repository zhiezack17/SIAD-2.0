/**
 * ====================================================================
 * GOOGLE APPS SCRIPT (GAS) - SIAD 2.0 GOOGLE DRIVE CONNECTOR (V6)
 * ====================================================================
 * Salin dan tempel kode ini ke editor Google Apps Script di:
 * https://script.google.com/
 * 
 * Fitur:
 * 1. Upload berkas otomatis ke folder terstruktur (Kepenghuluan -> Modul -> Kegiatan).
 * 2. Hapus berkas otomatis (Memindahkan ke Sampah / Trash Google Drive) saat
 *    pengguna menghapus SPJ, Bukti Pajak, Foto Dokumentasi, atau Surat di SIAD 2.0.
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
        targetFile.setTrashed(true); // Memindahkan file ke Sampah Google Drive (Aman, bisa direstore dalam 30 hari)
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
    // 2. FITUR UPLOAD BERKAS KE GOOGLE DRIVE
    // ================================================================
    if (data.file) {
      var folderRootId = '18jQB_3bSXtmno5MgD5cft2F-1vvPm3ie'; // Folder Induk SIAD 2.0
      var rootFolder;
      try {
        rootFolder = DriveApp.getFolderById(folderRootId);
      } catch (fErr) {
        rootFolder = DriveApp.getRootFolder();
      }
      
      var desaName = data.kepenghuluan || 'Umum';
      var modulName = data.modul || 'SPJ';
      var kegiatanName = data.kegiatan || 'Umum';

      // Buat struktur subfolder rapi per desa & kegiatan
      var desaFolder = getOrCreateFolder(rootFolder, desaName);
      var modulFolder = getOrCreateFolder(desaFolder, modulName);
      var targetFolder = modulFolder;
      if (kegiatanName && kegiatanName !== 'Umum') {
        targetFolder = getOrCreateFolder(modulFolder, kegiatanName);
      }

      // Decode base64 dan simpan file
      var decodedBytes = Utilities.base64Decode(data.file);
      var blob = Utilities.newBlob(decodedBytes, data.mimeType || 'application/octet-stream', data.fileName || 'dokumen');
      var newFile = targetFolder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return responseJson({
        status: 'success',
        id: newFile.getId(),
        name: newFile.getName(),
        url: newFile.getUrl()
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

