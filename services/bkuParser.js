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
        .replace(/^(?:Penarikan Dana.*?Kas di Bendahara\s*|Pengembalian Sisa Dana.*?Kas di Bendahara\s*)/i, '')
        .replace(/^Pembayaran\s+(?:Kegiatan\s+|Belanja\s+)?/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (clean.length > 0) {
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
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
    if (/posyandu|stunting|pmt|guru|masjid|gharim|tahfiz|hut ri|pelatihan|kejaksaan|polres|sosialisasi|pkk|bbgrm|turnamen/i.test(nama) || rek.startsWith('5.2.2') || rek.startsWith('5.2.3')) {
        return {
            bidang: 'Bidang 3: Pembinaan Kemasyarakatan',
            jenis_belanja: 'barang_jasa',
            jabatan: 'Kasi Pelayanan'
        };
    }
    if (rek.startsWith('6.2') || /bumdes|bumkep|ketapang|permodalan|koperasi|kopdes/i.test(nama)) {
        return {
            bidang: 'Bidang 4: Pemberdayaan Masyarakat',
            jenis_belanja: 'modal',
            jabatan: 'Pengelola BUMDes / Kaur Keuangan'
        };
    }
    if (rek.startsWith('5.4') || /blt|darurat|bencana|kebakaran|mpa/i.test(nama)) {
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

function tentukanSubBidang(kodeRekening, namaKegiatan, bidang) {
    const rek = String(kodeRekening || '');
    const nama = String(namaKegiatan || '').toLowerCase();

    if (bidang.includes('Bidang 1') || rek.startsWith('5.1')) {
        if (rek.startsWith('5.1.1') || /siltap|penghulu|kades|tunjangan kades/i.test(nama)) {
            return 'Penghasilan Tetap dan Tunjangan Kepala Desa';
        }
        if (rek.startsWith('5.1.2') || /perangkat desa|siltap perangkat|tunjangan perangkat/i.test(nama)) {
            return 'Penghasilan Tetap dan Tunjangan Perangkat Desa';
        }
        if (rek.startsWith('5.1.4') || /bpkep|bpd|tunjangan bpd/i.test(nama)) {
            return 'Jaminan Sosial & Tunjangan BPKep / BPD';
        }
        if (/op bpkep|operasional bpkep/i.test(nama)) {
            return 'Operasional BPKep / BPD';
        }
        if (/op kantor|operasional kantor|atk|listrik|cetak|rehab kantor|sarana prasarana/i.test(nama) || rek.startsWith('5.2.1')) {
            return 'Operasional Pemerintah Desa & Sarana Prasarana';
        }
        if (/musrenbang|rkp|lpj|idm|epdeskel|prodeskel|siskeudes|perencanaan/i.test(nama)) {
            return 'Tata Praja Pemerintahan, Perencanaan dan Keuangan';
        }
        return 'Penyelenggaraan Belanja Penghasilan Tetap & Operasional';
    }

    if (bidang.includes('Bidang 2') || rek.startsWith('5.3')) {
        if (/box culvert|gorong|drainase|parit/i.test(nama)) {
            return 'Pembangunan dan Pemeliharaan Drainase / Saluran Air';
        }
        if (/semenisasi|jalan|jembatan/i.test(nama)) {
            return 'Pembangunan dan Pemeliharaan Jalan / Jembatan Desa';
        }
        if (/rehab|gedung|kantor/i.test(nama)) {
            return 'Pembangunan / Pemeliharaan Gedung dan Fasilitas Umum';
        }
        if (/sarana|prasarana|aset/i.test(nama)) {
            return 'Pengadaan Sarana dan Prasarana Fisik Desa';
        }
        return 'Pelaksanaan Pembangunan dan Penataan Ruang Desa';
    }

    if (bidang.includes('Bidang 3')) {
        if (/posyandu|stunting|pmt|ibu hamil|lansia/i.test(nama)) {
            return 'Penyelenggaraan Posyandu, Kesehatan dan Penanganan Stunting';
        }
        if (/guru|ngaji|tahfiz|masjid|imam|gharim/i.test(nama)) {
            return 'Pembinaan Keagamaan, Rumah Ibadah dan Pendidikan Non Formal';
        }
        if (/perpustakaan/i.test(nama)) {
            return 'Pengelolaan Perpustakaan dan Literasi Desa';
        }
        if (/rt\/rw|insentif rt|pbb|sopir|mobil siaga/i.test(nama)) {
            return 'Pembinaan Lembaga Kemasyarakatan Desa (RT/RW & Layanan Siaga)';
        }
        if (/pkk|bbgrm|hut ri|lpm|kepemudaan|olahraga|turnamen/i.test(nama)) {
            return 'Pembinaan Kesenian, Olahraga dan Kelembagaan Masyarakat';
        }
        if (/hukum|polres|kejaksaan|asistensi/i.test(nama)) {
            return 'Ketenteraman, Ketertiban Umum dan Perlindungan Masyarakat';
        }
        return 'Pembinaan Kemasyarakatan dan Layanan Sosial Desa';
    }

    if (bidang.includes('Bidang 4') || rek.startsWith('6.2')) {
        if (/bumdes|bumkep|penyertaan modal/i.test(nama)) {
            return 'Penyertaan Modal dan Penguatan BUMDes / BUMKep';
        }
        if (/ketapang|ketahanan pangan|pertanian|perikanan/i.test(nama)) {
            return 'Pengembangan Ketahanan Pangan Desa';
        }
        if (/kopdes|koperasi/i.test(nama)) {
            return 'Pemberdayaan Koperasi dan Ekonomi Produktif Desa';
        }
        return 'Pemberdayaan Masyarakat dan Ekonomi Desa';
    }

    if (bidang.includes('Bidang 5') || rek.startsWith('5.4')) {
        if (/blt/i.test(nama)) {
            return 'Keadaan Mendesak (Bantuan Langsung Tunai / BLT Dana Desa)';
        }
        if (/bencana|mpa|api|kebakaran/i.test(nama)) {
            return 'Penanggulangan Bencana dan Keadaan Darurat';
        }
        return 'Penanggulangan Bencana, Keadaan Darurat dan Mendesak Desa';
    }

    return 'Kegiatan Reguler / Umum';
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
    const rawLines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let desa = '';
    let kecamatan = '';
    let tahun = new Date().getFullYear();
    let periode = '';

    for (let i = 0; i < Math.min(rawLines.length, 60); i++) {
        if (/PEMERINTAH DESA/i.test(rawLines[i])) {
            desa = rawLines[i].replace(/PEMERINTAH DESA/i, '').trim();
        }
        if (/TAHUN ANGGARAN/i.test(rawLines[i])) {
            const m = rawLines[i].match(/\d{4}/);
            if (m) tahun = parseInt(m[0]);
        }
        if (/KECAMATAN\s+([A-Z\s]+)/i.test(rawLines[i])) {
            kecamatan = rawLines[i].replace(/KECAMATAN/i, '').replace(/[:]/g, '').trim();
        }
        if (/Periode/i.test(rawLines[i])) {
            periode = rawLines[i].replace(/Periode/i, '').trim();
        }
    }

    // Bersihkan seluruh baris header berulang, nomor kolom, dan footer Siskeudes
    const headerFooterRegex = /^(?:Printed by Siskeudes|\d{1,2}\/\d{1,2}\/\d{4} \d{1,2}:\d{2}:\d{2} (?:AM|PM)|Halaman \d+|BUKU KAS UMUM|KABUPATEN ROKAN HILIR|KECAMATAN.*|DESA.*|PEMERINTAH DESA.*|Tahun Anggaran \d{4}|Periode \d{2}\/\d{2}\/\d{4}.*|1 234|56|7|89|1 2 3 4 5 6 7 8 9|No\.|Tanggal|Rekening|Uraian|Penerimaan|Pengeluaran|Nomor Bukti|Netto|Transaksi \(Rp\)|Saldo|\( Rp \)|Kode|Total Halaman Ini.*|Total s\.d\. Halaman Lalu.*|Total Kumulatif.*)$/i;
    const lines = rawLines.filter(l => !headerFooterRegex.test(l));

    const sppMap = new Map();
    const kwtMap = new Map();
    const sspMap = new Map();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

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

            // Cari tanggal transaksi mundur hingga 6 baris sebelumnya
            let dateLineIdx = -1;
            for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
                if (/^\d{2}\/\d{2}\/\d{4}\d*/.test(lines[j])) {
                    dateLineIdx = j;
                    break;
                }
            }
            const currentDate = dateLineIdx >= 0 ? lines[dateLineIdx].substring(0, 10) : '';

            // Kumpulkan baris uraian transaksi tepat sebelum baris tanggal
            let uraianParts = [];
            if (dateLineIdx > 0) {
                for (let j = dateLineIdx - 1; j >= Math.max(0, dateLineIdx - 4); j--) {
                    const prev = lines[j];
                    if (/^\d\.\d\.\d\.\d{2}\./.test(prev)) break;
                    if (/SPP|KWT|SSP|TBP|STS/.test(prev)) break;
                    if (/\d+,\d{2}/.test(prev) && prev.length > 15) break;
                    uraianParts.unshift(prev);
                }
            }

            let uraianText = uraianParts.join(' ').trim();
            if (!uraianText) uraianText = prevNamaRek || 'Belanja Kegiatan';

            if (noBukti.includes('/SPP/')) {
                const cleanNama = cleanNamaKegiatan(uraianText, prevNamaRek);
                const { bidang, jenis_belanja, jabatan } = tentukanBidang(prevRekening, cleanNama);
                const subBidang = tentukanSubBidang(prevRekening, cleanNama, bidang);
                const sumberDana = tentukanSumberDana(cleanNama, prevRekening);

                if (!sppMap.has(noBukti)) {
                    sppMap.set(noBukti, {
                        no_bukti: noBukti,
                        nama_kegiatan: cleanNama,
                        uraian_lengkap: uraianText,
                        tanggal: currentDate,
                        bidang,
                        sub_bidang: subBidang,
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
    }

    return buildSummaryResponse({ desa, tahun, kecamatan, periode }, Array.from(sppMap.values()), Array.from(kwtMap.values()), Array.from(sspMap.values()));
}

/**
 * PARSER BUFFER EXCEL SISKEUDES (.XLSX / .XLS)
 */
async function parseBkuExcel(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];

    let desa = '';
    let kecamatan = '';
    let tahun = new Date().getFullYear();
    let periode = '';

    for (let i = 1; i <= Math.min(worksheet.rowCount, 15); i++) {
        const rowText = worksheet.getRow(i).values.filter(Boolean).join(' ');
        if (/DESA|KEPENGHULUAN/i.test(rowText)) {
            const m = rowText.match(/(?:DESA|KEPENGHULUAN)\s+([A-Z\s]+)/i);
            if (m) desa = m[1].trim();
        }
        if (/TAHUN ANGGARAN/i.test(rowText)) {
            const m = rowText.match(/\d{4}/);
            if (m) tahun = parseInt(m[0]);
        }
        if (/KECAMATAN/i.test(rowText)) {
            const m = rowText.match(/KECAMATAN\s+([A-Z\s]+)/i);
            if (m) kecamatan = m[1].trim();
        }
        if (/Periode/i.test(rowText)) {
            periode = rowText;
        }
    }

    const sppMap = new Map();
    const kwtMap = new Map();
    const sspMap = new Map();

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < 6) return;

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
            const subBidang = tentukanSubBidang(rek, cleanNama, bidang);
            const sumberDana = tentukanSumberDana(cleanNama, rek);
            const nominal = pengeluaran || penerimaan;

            if (!sppMap.has(noBukti)) {
                sppMap.set(noBukti, {
                    no_bukti: noBukti,
                    nama_kegiatan: cleanNama,
                    uraian_lengkap: uraian,
                    tanggal: tgl,
                    bidang,
                    sub_bidang: subBidang,
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
    cleanNamaKegiatan,
    tentukanBidang,
    tentukanSubBidang,
    tentukanSumberDana
};
