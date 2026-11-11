const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyO2T5KDAijIJHwkFNoO2-C7gD-_S94AkLIHsS5t3J1b6IatjBNeCqdzHobS24y08TVkw/exec';
const TRASH_FOLDER_ID = '1Ca69EF_LI9wUiLU_qY4RkJ4KNHc6TKrH'; // Folder 📁 Sampah SIAD (Trash) di Google Drive

// Direktori root penyimpanan lokal server
const UPLOADS_ROOT = path.join(__dirname, '../public/uploads');

// SEC-01: Inisialisasi Service Account sebagai fallback proteksi hapus/pindah sampah
let saDrive = null;
try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive']
        });
        saDrive = google.drive({ version: 'v3', auth });
    } else {
        const credPath = path.join(__dirname, '../credentials.json');
        if (fs.existsSync(credPath)) {
            const auth = new google.auth.GoogleAuth({
                keyFile: credPath,
                scopes: ['https://www.googleapis.com/auth/drive']
            });
            saDrive = google.drive({ version: 'v3', auth });
        }
    }
} catch (e) {
    console.warn('[Drive Config] Service Account Drive init optional:', e.message);
}

/**
 * Menyimpan file secara instan ke server lokal (Fail-safe Fallback)
 * Mengembalikan objek standar { id, name, url, webViewLink, isLocal: true }
 */
const saveFileLocal = (fileObj, subfolder = 'spj') => {
    try {
        if (!fileObj) return null;

        // Normalisasi nama subfolder: spj, foto, pajak, surat, produk_hukum, dsb.
        const safeSub = String(subfolder).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const targetDir = path.join(UPLOADS_ROOT, safeSub);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const originalName = fileObj.originalname || (typeof fileObj === 'string' ? fileObj : 'file.dat');
        const ext = path.extname(originalName) || '.dat';
        const cleanBase = path.basename(originalName, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 45);
        const fileName = `${Date.now()}_${cleanBase}${ext}`;
        const filePath = path.join(targetDir, fileName);

        if (fileObj.buffer) {
            fs.writeFileSync(filePath, fileObj.buffer);
        } else if (fileObj.path && fs.existsSync(fileObj.path)) {
            fs.copyFileSync(fileObj.path, filePath);
        } else if (Buffer.isBuffer(fileObj)) {
            fs.writeFileSync(filePath, fileObj);
        } else {
            console.warn('[saveFileLocal] Tidak ada data buffer/path yang valid');
            return null;
        }

        const webUrl = `/uploads/${safeSub}/${fileName}`;
        console.log(`[saveFileLocal] ✅ Berkas lokal berhasil disimpan: ${webUrl}`);

        return {
            id: `local_${Date.now()}`,
            name: originalName,
            url: webUrl,
            webViewLink: webUrl,
            webContentLink: webUrl,
            isLocal: true,
            filePath
        };
    } catch (err) {
        console.error('[saveFileLocal] ❌ Gagal menyimpan file lokal:', err.message);
        return null;
    }
};

/**
 * Upload ke Google Drive dengan jaminan Anti-Gagal (Local Server Fallback)
 * 1. Simpan instan ke server lokal sebagai jaminan kecepatan & keandalan
 * 2. Coba sinkronisasi ke Google Apps Script (timeout 5 detik)
 * 3. Jika Google Drive sukses -> kembalikan link Drive
 * 4. Jika Google Drive gagal/timeout/404 -> kembalikan link lokal tanpa error
 */
const uploadToDrive = async (fileObj, kepenghuluan = 'Air Hitam', kegiatan = 'Umum', modul = 'SPJ') => {
    // Normalisasi argumen jika dipanggil dengan format (buffer, originalname, mimetype, subfolder)
    let buffer = null;
    let fileName = 'file.dat';
    let mimeType = 'application/octet-stream';
    let normalizedFile = fileObj;

    if (Buffer.isBuffer(fileObj)) {
        buffer = fileObj;
        fileName = String(kepenghuluan || 'file.dat');
        mimeType = String(kegiatan || 'application/octet-stream');
        normalizedFile = { buffer, originalname: fileName, mimetype: mimeType };
    } else if (fileObj && fileObj.buffer) {
        buffer = fileObj.buffer;
        fileName = String(fileObj.originalname || 'file.dat');
        mimeType = String(fileObj.mimetype || 'application/octet-stream');
    }

    // 1. Simpan salinan lokal terlebih dahulu (Instan & Pasti Sukses)
    const localResult = saveFileLocal(normalizedFile, modul || 'spj');

    // 2. Coba upload ke Google Drive via GAS dengan timeout aman (5000ms)
    try {
        if (!buffer && normalizedFile && normalizedFile.path && fs.existsSync(normalizedFile.path)) {
            buffer = fs.readFileSync(normalizedFile.path);
        }

        if (!buffer) {
            if (localResult) return localResult;
            throw new Error('Tidak ada buffer file yang tersedia untuk diunggah.');
        }

        const payload = {
            file: buffer.toString('base64'),
            fileName: String(fileName),
            mimeType: String(mimeType),
            kepenghuluan: String(kepenghuluan),
            modul: String(modul),
            kegiatan: String(kegiatan).split('/').join('-')
        };

        const response = await axios.post(GAS_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000, // Timeout 5 detik agar user tidak menunggu lama jika GAS offline
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        if (response.data && response.data.url) {
            console.log(`[uploadToDrive] ✅ Sinkronisasi Google Drive berhasil: ${response.data.url}`);
            return {
                id: response.data.id,
                name: response.data.name,
                url: response.data.url,
                webViewLink: response.data.url,
                webContentLink: response.data.url
            };
        } else {
            console.warn('[uploadToDrive] ⚠️ Google Drive response tidak valid, menggunakan fallback lokal.');
            if (localResult) return localResult;
            throw new Error('GAS Error: Respons tidak memiliki URL valid');
        }
    } catch (gasError) {
        const status = gasError.response ? gasError.response.status : gasError.message;
        console.warn(`[uploadToDrive] ⚠️ Google Drive sync offline/error (${status}). Beralih ke penyimpanan lokal.`);
        
        // JIKA GOOGLE DRIVE ERROR / 404 / TIMEOUT, KEMBALIKAN BERKAS LOKAL TANPA MELEMPAR EXCEPTION
        if (localResult) {
            return localResult;
        }

        throw new Error(`Upload gagal: ${gasError.message}`);
    }
};

const extractFileId = (fileUrlOrId) => {
    if (!fileUrlOrId || typeof fileUrlOrId !== 'string') return null;
    const match = fileUrlOrId.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                  fileUrlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                  fileUrlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return match[1];
    const cleaned = fileUrlOrId.trim();
    if (/^[a-zA-Z0-9_-]{20,}$/.test(cleaned)) return cleaned;
    return null;
};

const deleteFromDrive = async (fileUrlOrId) => {
    try {
        if (!fileUrlOrId || typeof fileUrlOrId !== 'string') return false;

        // 1. Jika berkas lokal (/uploads/...), hapus dari filesystem server
        if (fileUrlOrId.startsWith('/uploads/')) {
            const localPath = path.join(__dirname, '../public', fileUrlOrId);
            if (fs.existsSync(localPath)) {
                try {
                    fs.unlinkSync(localPath);
                    console.log(`[Drive:deleteFromDrive] ✅ Berkas lokal ${fileUrlOrId} berhasil dihapus.`);
                    return true;
                } catch (e) {
                    console.warn('[Drive:deleteFromDrive] Gagal menghapus berkas lokal:', e.message);
                }
            }
            return true;
        }

        const fileId = extractFileId(fileUrlOrId);
        if (!fileId) return false;

        console.log(`[Drive:deleteFromDrive] Memproses penghapusan berkas ID: ${fileId}...`);

        // 2. Coba pindahkan ke Sampah via Google Apps Script (Pemilik Asli)
        try {
            const response = await axios.post(GAS_URL, {
                action: 'delete',
                fileId: fileId
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });

            if (response.data && (response.data.status === 'success' || response.data.success)) {
                console.log(`[Drive:deleteFromDrive] ✅ Berkas ${fileId} berhasil dipindahkan ke Sampah Google Drive via GAS.`);
                return true;
            }
        } catch (gasErr) {
            // Lanjut ke fallback Service Account jika GAS offline
        }

        // 3. Fallback: Pindahkan berkas ke folder "📁 Sampah SIAD (Trash)" via Service Account
        if (saDrive) {
            try {
                const fileInfo = await saDrive.files.get({
                    fileId: fileId,
                    fields: 'parents',
                    supportsAllDrives: true
                });
                const prevParents = fileInfo.data.parents ? fileInfo.data.parents.join(',') : '';

                await saDrive.files.update({
                    fileId: fileId,
                    addParents: TRASH_FOLDER_ID,
                    removeParents: prevParents,
                    supportsAllDrives: true
                });

                console.log(`[Drive:deleteFromDrive] ✅ Berkas ${fileId} berhasil dipindahkan ke folder "📁 Sampah SIAD (Trash)".`);
                return true;
            } catch (saErr) {
                console.warn(`[Drive:deleteFromDrive] ⚠️ Fallback SA error:`, saErr.message);
            }
        }

        return false;
    } catch (error) {
        console.error('[Drive:deleteFromDrive] ❌ Gagal menghapus file dari Drive:', error.message);
        return false;
    }
};

module.exports = { 
    uploadToDrive, 
    deleteFromDrive, 
    extractFileId, 
    saveFileLocal,
    TRASH_FOLDER_ID 
};
