const pdf = require('pdf-parse');
const ExcelJS = require('exceljs');

function cleanNumber(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/\./g, '').replace(/,/g, '.').replace(/[()]/g, '').trim();
    return parseFloat(str) || 0;
}

function cleanUraian(rawUraian) {
    if (!rawUraian) return '';
    return rawUraian
        .replace(/\b(?:1\s*2\s*3\s*4|5\s*6|7\s*8\s*9|1\s*2\s*3\s*4\s*5\s*6\s*7\s*8\s*9|Transaksi\s*\(Rp\))\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanNamaKegiatan(rawUraian, fallbackRek) {
    if (!rawUraian) return fallbackRek || 'Kegiatan Belanja';
    let clean = cleanUraian(rawUraian)
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

function tentukanJenisPajak(kodeRekening, uraian) {
    const rek = String(kodeRekening || '');
    if (rek.startsWith('7.1.1.01')) return 'PPN';
    if (rek.startsWith('7.1.1.02')) return 'PPh 21';
    if (rek.startsWith('7.1.1.03')) return 'PPh 22';
    if (rek.startsWith('7.1.1.04')) return 'PPh 23';
    if (rek.startsWith('7.1.2')) return 'Pajak Daerah / Restoran';

    const str = `${rek} ${uraian || ''}`.toLowerCase();
    if (/restoran|rumah makan|daerah|galian/i.test(str)) return 'Pajak Daerah / Restoran';
    if (/ppn/i.test(str)) return 'PPN';
    if (/pph\s*21|pasal\s*21/i.test(str)) return 'PPh 21';
    if (/pph\s*22|pasal\s*22/i.test(str)) return 'PPh 22';
    if (/pph\s*23|pasal\s*23/i.test(str)) return 'PPh 23';
    return 'Pajak Daerah / Restoran';
}

/**
 * PARSER UTAMA DARI BUFFER PDF SISKEUDES
 */
async function parseBkuPdf(buffer, preParsedData = null) {
    const data = preParsedData || (await pdf(buffer));
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

            let uraianText = cleanUraian(uraianParts.join(' '));
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
                const jenisPajak = tentukanJenisPajak(prevRekening, uraianText);
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
                const jenisPajak = tentukanJenisPajak(prevRekening, uraianText);
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

        // 2. Deteksi Baris Penyetoran Pajak Rekening 7.1. TANPA Nomor Bukti eksplisit pada printout Siskeudes
        // Format di Siskeudes BKU: "0,00 300.000,00 (300.000,00) 166.308.052,00"
        if (/^0,00\d+(?:\.\d{3})*,\d{2}\(\d+(?:\.\d{3})*,\d{2}\)/.test(line)) {
            let prevRekening = '';
            let prevNamaRek = '';
            if (i > 0) {
                const rekMatch = lines[i - 1].match(/^(7\.\d\.\d\.\d{2}\.)(.*)$/);
                if (rekMatch) {
                    prevRekening = rekMatch[1];
                    prevNamaRek = rekMatch[2].trim();
                }
            }

            if (prevRekening.startsWith('7.1.')) {
                const amounts = line.match(/\d+(?:\.\d{3})*,\d{2}/g);
                const nominal = amounts && amounts.length >= 2 ? cleanNumber(amounts[1]) : 0;

                let dateLineIdx = -1;
                for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
                    if (/^\d{2}\/\d{2}\/\d{4}\d*/.test(lines[j])) {
                        dateLineIdx = j;
                        break;
                    }
                }
                const currentDate = dateLineIdx >= 0 ? lines[dateLineIdx].substring(0, 10) : '';

                let uraianParts = [];
                if (dateLineIdx > 0) {
                    for (let j = dateLineIdx - 1; j >= Math.max(0, dateLineIdx - 4); j--) {
                        const prev = lines[j];
                        if (/^\d\.\d\.\d\.\d{2}\./.test(prev)) break;
                        if (/SPP|KWT|SSP|TBP|STS/.test(prev)) break;
                        if (/\d+,\d{2}/.test(prev) && prev.length > 15) break;
                        if (/1\s*2\s*3\s*4|5\s*6|7\s*8\s*9|Transaksi\s*\(Rp\)/i.test(prev)) continue;
                        uraianParts.unshift(prev);
                    }
                }
                let uraianText = cleanUraian(uraianParts.join(' '));
                if (!uraianText) uraianText = prevNamaRek || 'Penyetoran Pajak BKU';

                const jenisPajak = tentukanJenisPajak(prevRekening, uraianText);
                const virtualBukti = `SSP-BKU-${sspMap.size + 1}/${prevRekening}/${tahun}`;

                sspMap.set(virtualBukti, {
                    no_bukti: virtualBukti,
                    tanggal: currentDate,
                    uraian: uraianText,
                    jenis_pajak: jenisPajak,
                    kode_rekening: prevRekening,
                    nama_rekening: prevNamaRek,
                    nominal
                });
                continue;
            }
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
 * PARSER KHUSUS BUKU KAS PEMBANTU PAJAK PER JENIS PAJAK (SISKEUDES PDF)
 */
async function parseBukuPajakPdf(buffer, rawText = null) {
    const text = rawText || (await pdf(buffer)).text;
    const rawLines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let desa = '';
    let tahun = new Date().getFullYear();
    let periode = '';

    for (let i = 0; i < Math.min(rawLines.length, 30); i++) {
        const l = rawLines[i];
        if (/PEMERINTAH DESA/i.test(l)) {
            desa = l.replace(/PEMERINTAH DESA/i, '').trim();
        }
        if (/TAHUN ANGGARAN/i.test(l)) {
            const m = l.match(/\d{4}/);
            if (m) tahun = parseInt(m[0]);
        }
        if (/Periode/i.test(l)) {
            periode = l.replace(/Periode/i, '').trim();
        }
    }

    const kwtMap = new Map();
    const sspMap = new Map();
    let currentKodeRek = '';
    let currentNamaRek = '';

    for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];

        const rekMatch = line.match(/(.*)(7\.\d\.\d\.\d{2}\.)/);
        if (rekMatch) {
            currentNamaRek = rekMatch[1].trim();
            currentKodeRek = rekMatch[2].trim();
            continue;
        }

        const buktiMatch = line.match(/(\d{4,5}\/(?:KWT|SSP)\/[0-9.]+\/\d{4})/);
        if (buktiMatch) {
            const noBukti = buktiMatch[1];
            const isKwt = noBukti.includes('/KWT/');
            const isSsp = noBukti.includes('/SSP/');

            let tanggal = '';
            let dateIdx = -1;
            for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
                const dm = rawLines[j].match(/^(\d{2}\/\d{2}\/\d{4})/);
                if (dm) {
                    tanggal = dm[1];
                    dateIdx = j;
                    break;
                }
            }

            let uraianParts = [];
            if (dateIdx >= 0) {
                for (let j = dateIdx + 1; j < i; j++) {
                    const txt = rawLines[j];
                    if (!/^\d+$/.test(txt) && !txt.includes('7.1.')) {
                        uraianParts.push(txt);
                    }
                }
            }
            let uraian = cleanUraian(uraianParts.join(' '));

            let numbersLine = '';
            for (let j = i + 1; j <= Math.min(rawLines.length - 1, i + 3); j++) {
                if (/\d+,\d{2}/.test(rawLines[j])) {
                    numbersLine = rawLines[j];
                    break;
                }
            }

            let nominal = 0;
            const moneyMatches = numbersLine.match(/\d+(?:\.\d{3})*,\d{2}/g);
            if (moneyMatches && moneyMatches.length >= 2) {
                if (isKwt) {
                    nominal = cleanNumber(moneyMatches[0]);
                } else if (isSsp) {
                    if (moneyMatches.length >= 3) {
                        nominal = cleanNumber(moneyMatches[1]);
                    } else {
                        nominal = cleanNumber(moneyMatches[0]);
                    }
                }
            }

            const jenisPajak = tentukanJenisPajak(currentKodeRek, uraian);

            const record = {
                no_bukti: noBukti,
                tanggal,
                uraian: uraian || currentNamaRek || 'Transaksi Pajak',
                jenis_pajak: jenisPajak,
                kode_rekening: currentKodeRek,
                nama_rekening: currentNamaRek,
                nominal
            };

            if (isKwt) {
                kwtMap.set(noBukti, record);
            } else if (isSsp) {
                sspMap.set(noBukti, record);
            }
        }
    }

    const sspList = Array.from(sspMap.values());
    const kwtList = Array.from(kwtMap.values());
    let totalSetoran = 0;
    sspList.forEach(s => totalSetoran += s.nominal);
    let totalPotongan = 0;
    kwtList.forEach(k => totalPotongan += k.nominal);

    return {
        is_buku_pajak: true,
        meta: { desa, tahun, periode },
        kegiatan: [],
        pajak_potongan: kwtList,
        pajak_setoran: sspList,
        summary: {
            total_kegiatan: 0,
            total_realisasi: 0,
            total_potongan_pajak: totalSetoran > 0 ? totalSetoran : totalPotongan,
            count_potongan_pajak: kwtList.length,
            total_setoran_pajak: totalSetoran,
            count_setoran_pajak: sspList.length,
            sisa_hutang_pajak: 0
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
    const data = await pdf(buffer);
    if (/BUKU (?:KAS )?PEMBANTU PAJAK/i.test(data.text)) {
        return parseBukuPajakPdf(buffer, data.text);
    }
    return parseBkuPdf(buffer, data);
}

module.exports = {
    parseBku,
    parseBkuPdf,
    parseBukuPajakPdf,
    parseBkuExcel,
    cleanNumber,
    cleanNamaKegiatan,
    cleanUraian,
    tentukanBidang,
    tentukanSubBidang,
    tentukanSumberDana,
    tentukanJenisPajak
};
