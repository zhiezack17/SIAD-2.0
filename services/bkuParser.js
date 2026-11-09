const pdf = require('pdf-parse');
const ExcelJS = require('exceljs');

function cleanNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/\./g, '').replace(/,/g, '.').replace(/[()]/g, '').trim();
    return parseFloat(str) || 0;
}

function cleanNamaKegiatan(rawUraian, fallbackRek) {
    if (!rawUraian) return fallbackRek || 'Kegiatan Belanja';
    let clean = rawUraian
        .replace(/^Penarikan Dana.*?Kas di Bendahara\s*/i, '')
        .replace(/^Pembayaran\s+(Kegiatan\s+|Belanja\s+)?/i, '')
        .trim();
    return clean || fallbackRek || 'Kegiatan Belanja';
}

function tentukanBidang(kodeRekening, namaKegiatan) {
    const rek = String(kodeRekening || '');
    const nama = String(namaKegiatan || '').toLowerCase();

    if (rek.startsWith('5.1')) {
        return {
            bidang: 'Bidang 1: Penyelenggaraan Pemerintahan Desa',
            jenis_belanja: 'pegawai',
            jabatan: 'Kaur Tata Usaha & Umum'
        };
    }
    if (rek.startsWith('5.3') || rek.startsWith('5.2.6') || /pembangunan|box culvert|gorong|rehab|jembatan|parit|drainase|semenisasi|jalan|gedung/i.test(nama)) {
        return {
            bidang: 'Bidang 2: Pelaksanaan Pembangunan Desa',
            jenis_belanja: 'modal',
            jabatan: 'Kaur Pembangunan / Kasi Kesejahteraan'
        };
    }
    if (/posyandu|stunting|pmt|guru|masjid|gharim|hut ri|pelatihan|kejaksaan|polres|sosialisasi|pkk|bbgrm|turnamen/i.test(nama) || rek.startsWith('5.2.2') || rek.startsWith('5.2.3')) {
        return {
            bidang: 'Bidang 3: Pembinaan Kemasyarakatan',
            jenis_belanja: 'barang_jasa',
            jabatan: 'Kasi Pelayanan'
        };
    }
    if (rek.startsWith('6.2') || /bumdes|bumkep|ketapang|permodalan/i.test(nama)) {
        return {
            bidang: 'Bidang 4: Pemberdayaan Masyarakat',
            jenis_belanja: 'modal',
            jabatan: 'Pengelola BUMDes / Kaur Keuangan'
        };
    }
    if (rek.startsWith('5.4') || /blt|darurat|bencana/i.test(nama)) {
        return {
            bidang: 'Bidang 5: Penanggulangan Bencana, Keadaan Darurat dan Mendesak Desa',
            jenis_belanja: 'tidak_terduga',
            jabatan: 'Satgas / Tim Pelaksana Kegiatan'
        };
    }
    return {
        bidang: 'Bidang 1: Penyelenggaraan Pemerintahan Desa',
        jenis_belanja: 'barang_jasa',
        jabatan: 'Kaur Tata Usaha & Umum'
    };
}

function tentukanSumberDana(namaKegiatan, kodeRekening) {
    const nama = String(namaKegiatan || '').toLowerCase();
    const rek = String(kodeRekening || '');

    if (/silpa/i.test(nama)) return 'SILPA Dana Desa';
    if (/adk|siltap|op kantor|bpkep|penghulu|rt\/rw/i.test(nama) || rek.startsWith('5.1.1') || rek.startsWith('5.1.2')) {
        return 'ADD (Alokasi Dana Desa)';
    }
    if (/bkk|provinsi/i.test(nama)) return 'BKK (Bantuan Keuangan Khusus Provinsi)';
    if (/pdrd|bagi hasil|bhpr/i.test(nama)) return 'PBH (Bagi Hasil Pajak & Retribusi)';
    if (/pad/i.test(nama)) return 'PAD (Pendapatan Asli Desa)';
    return 'DDS (Dana Desa)';
}

function tentukanJenisPajak(namaRekening, uraian) {
    const str = `${namaRekening || ''} ${uraian || ''}`.toLowerCase();
    if (str.includes('ppn')) return 'PPN';
    if (str.includes('21')) return 'PPh 21';
    if (str.includes('22')) return 'PPh 22';
    if (str.includes('23')) return 'PPh 23';
    if (str.includes('restoran') || str.includes('rumah makan') || str.includes('daerah') || str.includes('galian')) {
        return 'Pajak Daerah / Restoran';
    }
    return 'Pajak Lainnya';
}

/**
 * PARSER UTAMA DARI BUFFER PDF SISKEUDES
 */
async function parseBkuPdf(buffer) {
    const data = await pdf(buffer);
    const text = data.text;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let desa = '';
    let kecamatan = '';
    let tahun = new Date().getFullYear();
    let periode = '';

    for (let i = 0; i < Math.min(lines.length, 60); i++) {
        if (/PEMERINTAH DESA/i.test(lines[i])) {
            desa = lines[i].replace(/PEMERINTAH DESA/i, '').trim();
        }
        if (/TAHUN ANGGARAN/i.test(lines[i])) {
            const m = lines[i].match(/\d{4}/);
            if (m) tahun = parseInt(m[0]);
        }
        if (/KECAMATAN\s+([A-Z\s]+)/i.test(lines[i])) {
            kecamatan = lines[i].replace(/KECAMATAN/i, '').replace(/[:]/g, '').trim();
        }
        if (/Periode/i.test(lines[i])) {
            periode = lines[i].replace(/Periode/i, '').trim();
        }
    }

    const sppMap = new Map();
    const kwtMap = new Map();
    const sspMap = new Map();

    let currentDate = '';
    let currentUraianLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Lewati header & footer berulang Siskeudes
        if (/^(No\.|Tanggal|Rekening|Uraian|Penerimaan|Pengeluaran|Nomor Bukti|Netto|Saldo|Periode|Kode|\( Rp \)|Printed by Siskeudes|Halaman\s+\d+|\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2})/i.test(line)) {
            continue;
        }

        // Deteksi Tanggal dan Nomor Urut Transaksi
        const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4})\s*(\d+)?$/);
        if (dateMatch) {
            currentDate = dateMatch[1];
            continue;
        }

        // Deteksi Baris Bukti (SPP, KWT, SSP, TBP)
        const buktiMatch = line.match(/(\d{4,5}\/(?:SPP|KWT|SSP|TBP)\/[0-9.]+\/\d{4})/);
        if (buktiMatch) {
            const noBukti = buktiMatch[1];
            const afterBukti = line.substring(line.indexOf(noBukti) + noBukti.length);
            const nettoMatch = afterBukti.match(/^(\(?\d+(?:\.\d{3})*,\d{2}\)?)/);
            const nominal = nettoMatch ? cleanNumber(nettoMatch[1]) : 0;

            let prevRekening = '';
            let prevNamaRek = '';
            if (i > 0) {
                const rekMatch = lines[i - 1].match(/^(\d\.\d\.\d\.\d{2}\.)(.*)$/);
                if (rekMatch) {
                    prevRekening = rekMatch[1];
                    prevNamaRek = rekMatch[2].trim();
                }
            }

            let uraianText = currentUraianLines.join(' ').trim();
            if (!uraianText) uraianText = prevNamaRek || 'Belanja Kegiatan';

            if (noBukti.includes('/SPP/')) {
                const cleanNama = cleanNamaKegiatan(uraianText, prevNamaRek);
                const { bidang, jenis_belanja, jabatan } = tentukanBidang(prevRekening, cleanNama);
                const sumberDana = tentukanSumberDana(cleanNama, prevRekening);

                if (!sppMap.has(noBukti)) {
                    sppMap.set(noBukti, {
                        no_bukti: noBukti,
                        nama_kegiatan: cleanNama,
                        tanggal: currentDate,
                        bidang,
                        sumber_dana: sumberDana,
                        jenis_belanja,
                        jabatan_pelaksana: jabatan,
                        kode_rekening: prevRekening,
                        pagu_anggaran: nominal,
                        realisasi_anggaran: nominal,
                        rincian: [{ kode_rekening: prevRekening, nama_rekening: prevNamaRek, nominal }]
                    });
                } else {
                    const item = sppMap.get(noBukti);
                    item.rincian.push({ kode_rekening: prevRekening, nama_rekening: prevNamaRek, nominal });
                    item.pagu_anggaran += nominal;
                    item.realisasi_anggaran += nominal;
                }
            } else if (noBukti.includes('/KWT/')) {
                const jenisPajak = tentukanJenisPajak(prevNamaRek, uraianText);
                kwtMap.set(noBukti, {
                    no_bukti: noBukti,
                    tanggal: currentDate,
                    uraian: uraianText,
                    jenis_pajak: jenisPajak,
                    kode_rekening: prevRekening,
                    nama_rekening: prevNamaRek,
                    nominal
                });
            } else if (noBukti.includes('/SSP/')) {
                const jenisPajak = tentukanJenisPajak(prevNamaRek, uraianText);
                sspMap.set(noBukti, {
                    no_bukti: noBukti,
                    tanggal: currentDate,
                    uraian: uraianText,
                    jenis_pajak: jenisPajak,
                    kode_rekening: prevRekening,
                    nama_rekening: prevNamaRek,
                    nominal
                });
            }

            currentUraianLines = [];
            continue;
        }

        // Sub-baris rekening lanjutan pada SPP multi-line
        const subNettoMatch = line.match(/\(([\d.]+(?:,\d{2})?)\)/);
        if (subNettoMatch && !line.includes('/SPP/') && !line.includes('/SSP/')) {
            const nominal = cleanNumber(subNettoMatch[1]);
            let prevRekening = '';
            let prevNamaRek = '';
            if (i > 0) {
                const rekMatch = lines[i - 1].match(/^(\d\.\d\.\d\.\d{2}\.)(.*)$/);
                if (rekMatch) {
                    prevRekening = rekMatch[1];
                    prevNamaRek = rekMatch[2].trim();
                }
            }
            if (prevRekening.startsWith('5.') || prevRekening.startsWith('6.')) {
                const keys = Array.from(sppMap.keys());
                if (keys.length > 0) {
                    const lastSpp = sppMap.get(keys[keys.length - 1]);
                    lastSpp.rincian.push({ kode_rekening: prevRekening, nama_rekening: prevNamaRek, nominal });
                    lastSpp.pagu_anggaran += nominal;
                    lastSpp.realisasi_anggaran += nominal;
                }
            }
            continue;
        }

        // Kumpulkan teks uraian
        if (!/^\d\.\d\.\d\.\d{2}\./.test(line) && !/^\d+(?:\.\d{3})*,\d{2}/.test(line) && !line.includes('/')) {
            currentUraianLines.push(line);
            if (currentUraianLines.length > 5) currentUraianLines.shift();
        }
    }

    return buildSummaryResponse({ desa, tahun, kecamatan, periode }, Array.from(sppMap.values()), Array.from(kwtMap.values()), Array.from(sspMap.values()));
}

/**
 * PARSER UNTUK BERKAS EXCEL (.xlsx / .xls) DARI SISKEUDES
 */
async function parseBkuExcel(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    let desa = '';
    let kecamatan = '';
    let tahun = new Date().getFullYear();
    let periode = '';

    const sppMap = new Map();
    const kwtMap = new Map();
    const sspMap = new Map();

    worksheet.eachRow((row, rowNumber) => {
        const textRow = row.values ? row.values.map(v => String(v || '').trim()).join(' ') : '';
        if (/PEMERINTAH DESA/i.test(textRow)) {
            desa = textRow.replace(/.*PEMERINTAH DESA/i, '').trim();
        }
        if (/TAHUN ANGGARAN/i.test(textRow)) {
            const m = textRow.match(/\d{4}/);
            if (m) tahun = parseInt(m[0]);
        }
        if (/KECAMATAN\s+([A-Z\s]+)/i.test(textRow)) {
            kecamatan = textRow.replace(/.*KECAMATAN/i, '').replace(/[:]/g, '').trim();
        }

        // Baca kolom tipikal Siskeudes:
        // Col 2: Tanggal, Col 3: Kode Rekening, Col 4: Uraian, Col 5: Penerimaan, Col 6: Pengeluaran, Col 7: No Bukti
        const tgl = row.getCell(2).text ? String(row.getCell(2).text).trim() : '';
        const rek = row.getCell(3).text ? String(row.getCell(3).text).trim() : '';
        const uraian = row.getCell(4).text ? String(row.getCell(4).text).trim() : '';
        const penerimaan = cleanNumber(row.getCell(5).value);
        const pengeluaran = cleanNumber(row.getCell(6).value);
        const noBukti = row.getCell(7).text ? String(row.getCell(7).text).trim() : '';

        if (!noBukti) return;

        if (noBukti.includes('/SPP/')) {
            const cleanNama = cleanNamaKegiatan(uraian, rek);
            const { bidang, jenis_belanja, jabatan } = tentukanBidang(rek, cleanNama);
            const sumberDana = tentukanSumberDana(cleanNama, rek);
            const nominal = pengeluaran || penerimaan;

            if (!sppMap.has(noBukti)) {
                sppMap.set(noBukti, {
                    no_bukti: noBukti,
                    nama_kegiatan: cleanNama,
                    tanggal: tgl,
                    bidang,
                    sumber_dana: sumberDana,
                    jenis_belanja,
                    jabatan_pelaksana: jabatan,
                    kode_rekening: rek,
                    pagu_anggaran: nominal,
                    realisasi_anggaran: nominal,
                    rincian: [{ kode_rekening: rek, nama_rekening: uraian, nominal }]
                });
            } else {
                const item = sppMap.get(noBukti);
                item.rincian.push({ kode_rekening: rek, nama_rekening: uraian, nominal });
                item.pagu_anggaran += nominal;
                item.realisasi_anggaran += nominal;
            }
        } else if (noBukti.includes('/KWT/')) {
            const jenisPajak = tentukanJenisPajak(rek, uraian);
            kwtMap.set(noBukti, {
                no_bukti: noBukti,
                tanggal: tgl,
                uraian,
                jenis_pajak: jenisPajak,
                kode_rekening: rek,
                nominal: penerimaan || pengeluaran
            });
        } else if (noBukti.includes('/SSP/')) {
            const jenisPajak = tentukanJenisPajak(rek, uraian);
            sspMap.set(noBukti, {
                no_bukti: noBukti,
                tanggal: tgl,
                uraian,
                jenis_pajak: jenisPajak,
                kode_rekening: rek,
                nominal: pengeluaran || penerimaan
            });
        }
    });

    return buildSummaryResponse({ desa, tahun, kecamatan, periode }, Array.from(sppMap.values()), Array.from(kwtMap.values()), Array.from(sspMap.values()));
}

function buildSummaryResponse(meta, kegiatanList, kwtList, sspList) {
    let totalRealisasi = 0;
    const bidangSummary = {
        'Bidang 1: Penyelenggaraan Pemerintahan Desa': { count: 0, nominal: 0 },
        'Bidang 2: Pelaksanaan Pembangunan Desa': { count: 0, nominal: 0 },
        'Bidang 3: Pembinaan Kemasyarakatan': { count: 0, nominal: 0 },
        'Bidang 4: Pemberdayaan Masyarakat': { count: 0, nominal: 0 },
        'Bidang 5: Penanggulangan Bencana, Keadaan Darurat dan Mendesak Desa': { count: 0, nominal: 0 }
    };

    kegiatanList.forEach(k => {
        totalRealisasi += k.realisasi_anggaran;
        if (bidangSummary[k.bidang]) {
            bidangSummary[k.bidang].count++;
            bidangSummary[k.bidang].nominal += k.realisasi_anggaran;
        }
    });

    let totalPotonganPajak = 0;
    kwtList.forEach(p => totalPotonganPajak += p.nominal);

    let totalSetoranPajak = 0;
    sspList.forEach(p => totalSetoranPajak += p.nominal);

    return {
        meta,
        kegiatan: kegiatanList,
        pajak_potongan: kwtList,
        pajak_setoran: sspList,
        summary: {
            total_kegiatan: kegiatanList.length,
            total_realisasi: totalRealisasi,
            bidang_summary: bidangSummary,
            total_potongan_pajak: totalPotonganPajak,
            count_potongan_pajak: kwtList.length,
            total_setoran_pajak: totalSetoranPajak,
            count_setoran_pajak: sspList.length,
            sisa_hutang_pajak: Math.max(0, totalPotonganPajak - totalSetoranPajak)
        }
    };
}

/**
 * AUTO DISPATCHER SESUAI FORMAT BERKAS
 */
async function parseBku(buffer, filename = '', mimetype = '') {
    const isExcel = filename.endsWith('.xlsx') || filename.endsWith('.xls') || mimetype.includes('excel') || mimetype.includes('spreadsheet');
    if (isExcel) {
        return parseBkuExcel(buffer);
    }
    return parseBkuPdf(buffer);
}

module.exports = {
    parseBku,
    parseBkuPdf,
    parseBkuExcel,
    cleanNumber,
    tentukanBidang,
    tentukanSumberDana
};
