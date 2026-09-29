const { google } = require('googleapis');
const fs = require('fs');

class GoogleDriveService {
    constructor() {
        try {
            // Cek jika menggunakan OAuth2
            if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
                const oauth2Client = new google.auth.OAuth2(
                    process.env.GOOGLE_CLIENT_ID,
                    process.env.GOOGLE_CLIENT_SECRET,
                    process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground'
                );

                if (process.env.GOOGLE_REFRESH_TOKEN) {
                    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                }
                
                this.drive = google.drive({ version: 'v3', auth: oauth2Client });
            } else {
                console.warn("⚠️ Kredensial Google Drive belum lengkap di file .env");
                this.drive = null;
            }
        } catch (error) {
            console.error("Gagal menginisialisasi Google Drive API:", error);
            this.drive = null;
        }
    }

    async uploadFile(file, folderId = process.env.GOOGLE_DRIVE_FOLDER_ID) {
        if (!this.drive) {
            console.log("Mock Upload: Tidak ada kredensial, mengembalikan ID palsu.");
            return { id: 'mock-drive-id-' + Date.now(), webViewLink: '#', webContentLink: '#' };
        }

        try {
            const fileMetadata = {
                name: file.originalname,
                parents: folderId ? [folderId] : []
            };
            const media = {
                mimeType: file.mimetype,
                body: fs.createReadStream(file.path) // Ambil file dari server lokal (diupload multer)
            };
            
            const response = await this.drive.files.create({
                requestBody: fileMetadata,
                media: media,
                fields: 'id, webViewLink, webContentLink'
            });
            
            // Set agar file bisa dilihat siapa saja yang punya link (jika diinginkan)
            // await this.drive.permissions.create({ fileId: response.data.id, requestBody: { role: 'reader', type: 'anyone' } });
            
            return response.data;
        } catch (error) {
            console.error('Error saat upload ke Google Drive:', error.message);
            throw error;
        }
    }
}

module.exports = new GoogleDriveService();
