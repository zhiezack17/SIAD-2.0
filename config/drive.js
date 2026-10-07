const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyO2T5KDAijIJHwkFNoO2-C7gD-_S94AkLIHsS5t3J1b6IatjBNeCqdzHobS24y08TVkw/exec';
const TRASH_FOLDER_ID = '1Ca69EF_LI9wUiLU_qY4RkJ4KNHc6TKrH'; // Folder 📁 Sampah SIAD (Trash) di Google Drive

// Inisialisasi Service Account sebagai fallback proteksi hapus/pindah sampah
let saDrive = null;
try {
    const credPath = path.join(__dirname, '../credentials.json');
    if (fs.existsSync(credPath)) {
        const auth = new google.auth.GoogleAuth({
            keyFile: credPath,
            scopes: ['https://www.googleapis.com/auth/drive']
        });
        saDrive = google.drive({ version: 'v3', auth });
    }
} catch (e) {
    console.warn('[Drive Config] Service Account Drive init optional:', e.message);
}

const uploadToDrive = async (fileObj, kepenghuluan = 'Air Hitam', kegiatan = 'Umum', modul = 'SPJ') => {
    try {
        const payload = {
            file: fileObj.buffer.toString('base64'),
            fileName: String(fileObj.originalname),
            mimeType: String(fileObj.mimetype),
            kepenghuluan: String(kepenghuluan),
            modul: String(modul),
            kegiatan: String(kegiatan).split('/').join('-')
        };
        
        const response = await axios.post(GAS_URL, payload, {
            headers: { 'Content-Type': 'application/json' },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        
        if (response.data && response.data.url) {
            return {
                id: response.data.id,
                name: response.data.name,
                url: response.data.url,
                webViewLink: response.data.url 
            };
        } else {
            const errDetail = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data).substring(0, 200);
            throw new Error('GAS Error: ' + errDetail);
        }
    } catch (error) {
        throw new Error(error.message);
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
        const fileId = extractFileId(fileUrlOrId);
        if (!fileId) {
            return false;
        }

        console.log(`[Drive:deleteFromDrive] Memproses penghapusan berkas ID: ${fileId}...`);

        // 1. Coba pindahkan ke Sampah via Google Apps Script (Pemilik Asli)
        try {
            const response = await axios.post(GAS_URL, {
                action: 'delete',
                fileId: fileId
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 8000
            });

            if (response.data && (response.data.status === 'success' || response.data.success)) {
                console.log(`[Drive:deleteFromDrive] ✅ Berkas ${fileId} berhasil dipindahkan ke Sampah Google Drive via GAS.`);
                return true;
            }
        } catch (gasErr) {
            // Lanjut ke fallback Service Account jika GAS belum diset action delete
        }

        // 2. Fallback: Pindahkan berkas ke folder "📁 Sampah SIAD (Trash)" via Service Account
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
    TRASH_FOLDER_ID 
};

