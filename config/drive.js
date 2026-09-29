const axios = require('axios');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyO2T5KDAijIJHwkFNoO2-C7gD-_S94AkLIHsS5t3J1b6IatjBNeCqdzHobS24y08TVkw/exec';

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

const deleteFromDrive = async (fileId) => { return true; }
module.exports = { uploadToDrive, deleteFromDrive };
