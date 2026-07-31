import { api } from "./api-client";

/** Jenis surat dalam modul arsip. */
export type JenisSurat = "masuk" | "keluar";

/** Sifat/tingkat kerahasiaan surat. */
export type SifatSurat = "biasa" | "penting" | "rahasia" | "sangat_rahasia";

export type StatusSuratMasuk = "diterima" | "didisposisi" | "diproses" | "selesai" | "ditolak";
export type StatusSuratKeluar = "draft" | "menunggu_ttd" | "ditandatangani" | "dikirim" | "selesai";

export type Disposisi = {
  id: string;
  suratId: string;
  dariUserId: string;
  dariNama?: string;
  dariJabatan?: string;
  keUserId?: string;
  keNama?: string;
  keJabatan?: string;
  instruksi: string;
  catatan?: string;
  status: "terbuka" | "diteruskan" | "diselesaikan";
  dibacaAt?: string;
  createdAt: string;
};

export type SuratMasuk = {
  id: string;
  tenantId: string;
  jenis: "masuk";
  nomorAgenda: string;
  tahun: number;
  tanggalMasuk: string;
  nomorSurat: string;
  tanggalSurat: string;
  pengirim: string;
  perihal: string;
  sifat: SifatSurat;
  lampiran?: string;
  penerimaId?: string;
  penerimaNama?: string;
  status: StatusSuratMasuk;
  driveFileId?: string;
  driveFileUrl?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
  disposisi: Disposisi[];
};

export type SuratKeluar = {
  id: string;
  tenantId: string;
  jenis: "keluar";
  nomorAgenda: string;
  tahun: number;
  tanggalKeluar: string;
  nomorSurat: string;
  tujuan: string;
  perihal: string;
  sifat: SifatSurat;
  penandatanganId?: string;
  penandatanganNama?: string;
  jabatanPenandatangan?: string;
  status: StatusSuratKeluar;
  driveFileId?: string;
  driveFileUrl?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
};

export type SuratItem = SuratMasuk | SuratKeluar;

export type CreateSuratMasukInput = {
  kepenghuluanId?: string;
  nomorAgenda?: string;
  tahun?: number;
  tanggalMasuk: string;
  nomorSurat: string;
  tanggalSurat: string;
  pengirim: string;
  perihal: string;
  sifat: SifatSurat;
  lampiran?: string;
  penerimaId?: string;
  fileName?: string;
};

export type CreateSuratKeluarInput = {
  kepenghuluanId?: string;
  nomorAgenda?: string;
  tahun?: number;
  tanggalKeluar: string;
  nomorSurat: string;
  tujuan: string;
  perihal: string;
  sifat: SifatSurat;
  penandatanganId?: string;
  fileName?: string;
};

export type CreateDisposisiInput = {
  keUserId?: string;
  keNama?: string;
  keJabatan?: string;
  instruksi: string;
  catatan?: string;
};

export type ListSuratParams = {
  jenis?: JenisSurat;
  q?: string;
  tahun?: number;
  status?: string;
  sifat?: SifatSurat;
  page?: number;
  limit?: number;
};

export type TransisiSuratInput = {
  status: string;
  catatan?: string;
};

// --- helpers ---

export function sifatLabel(sifat: SifatSurat): string {
  const map: Record<SifatSurat, string> = {
    biasa: "Biasa",
    penting: "Penting",
    rahasia: "Rahasia",
    sangat_rahasia: "Sangat Rahasia",
  };
  return map[sifat] ?? sifat;
}

export function sifatVariant(sifat: SifatSurat): "default" | "secondary" | "destructive" | "outline" {
  switch (sifat) {
    case "sangat_rahasia":
      return "destructive";
    case "rahasia":
      return "secondary";
    case "penting":
      return "default";
    default:
      return "outline";
  }
}

export function statusMasukLabel(status: StatusSuratMasuk): string {
  const map: Record<StatusSuratMasuk, string> = {
    diterima: "Diterima",
    didisposisi: "Didisposisi",
    diproses: "Diproses",
    selesai: "Selesai",
    ditolak: "Ditolak",
  };
  return map[status] ?? status;
}

export function statusMasukVariant(status: StatusSuratMasuk): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "selesai":
      return "default";
    case "diproses":
    case "didisposisi":
      return "secondary";
    case "ditolak":
      return "destructive";
    default:
      return "outline";
  }
}

export function statusKeluarLabel(status: StatusSuratKeluar): string {
  const map: Record<StatusSuratKeluar, string> = {
    draft: "Draft",
    menunggu_ttd: "Menunggu TTD",
    ditandatangani: "Ditandatangani",
    dikirim: "Dikirim",
    selesai: "Selesai",
  };
  return map[status] ?? status;
}

export function statusKeluarVariant(status: StatusSuratKeluar): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "selesai":
      return "default";
    case "ditandatangani":
    case "dikirim":
      return "secondary";
    default:
      return "outline";
  }
}

export function jenisLabel(jenis: JenisSurat): string {
  return jenis === "masuk" ? "Surat Masuk" : "Surat Keluar";
}

let mockIdCounter = 10;

function newMockId(): string {
  return `srt-${++mockIdCounter}`;
}

// --- mock data ---

export const mockSuratMasuk: SuratMasuk[] = [
  {
    id: "srt-001",
    tenantId: "ten-001",
    jenis: "masuk",
    nomorAgenda: "001/SM/2026",
    tahun: 2026,
    tanggalMasuk: "2026-01-05",
    nomorSurat: "420/2026/Bappeda",
    tanggalSurat: "2026-01-03",
    pengirim: "Bappeda Kabupaten",
    perihal: "Undangan rapat koordinasi penyusunan RKPD 2026",
    sifat: "penting",
    lampiran: "1 (satu) berkas",
    penerimaNama: "Sekretaris",
    status: "didisposisi",
    fileName: "Undangan_RKPD_2026.pdf",
    createdAt: "2026-01-05T08:00:00Z",
    updatedAt: "2026-01-05T10:00:00Z",
    disposisi: [
      {
        id: "dsp-001",
        suratId: "srt-001",
        dariUserId: "usr-001",
        dariNama: "Datuk Penghulu",
        dariJabatan: "Penghulu",
        keNama: "Sekretaris",
        keJabatan: "Sekretaris Kepenghuluan",
        instruksi: "Hadiri dan laporkan hasilnya",
        catatan: "Bawa data usulan kegiatan 2026",
        status: "terbuka",
        createdAt: "2026-01-05T10:00:00Z",
      },
    ],
  },
  {
    id: "srt-002",
    tenantId: "ten-001",
    jenis: "masuk",
    nomorAgenda: "002/SM/2026",
    tahun: 2026,
    tanggalMasuk: "2026-01-07",
    nomorSurat: "45/2026/Diskominfo",
    tanggalSurat: "2026-01-06",
    pengirim: "Dinas Komunikasi dan Informatika",
    perihal: "Permintaan data kepenghuluan untuk e-government",
    sifat: "biasa",
    penerimaNama: "Operator",
    status: "diproses",
    createdAt: "2026-01-07T09:00:00Z",
    updatedAt: "2026-01-07T09:00:00Z",
    disposisi: [],
  },
  {
    id: "srt-003",
    tenantId: "ten-001",
    jenis: "masuk",
    nomorAgenda: "003/SM/2026",
    tahun: 2026,
    tanggalMasuk: "2026-01-10",
    nomorSurat: "100/2026/Inspektorat",
    tanggalSurat: "2026-01-08",
    pengirim: "Inspektorat Kabupaten",
    perihal: "Jadwal pemeriksaan administrasi kepenghuluan",
    sifat: "rahasia",
    status: "diterima",
    createdAt: "2026-01-10T07:30:00Z",
    updatedAt: "2026-01-10T07:30:00Z",
    disposisi: [],
  },
];

export const mockSuratKeluar: SuratKeluar[] = [
  {
    id: "srt-101",
    tenantId: "ten-001",
    jenis: "keluar",
    nomorAgenda: "001/SK/2026",
    tahun: 2026,
    tanggalKeluar: "2026-01-06",
    nomorSurat: "005/2026/Kepenghuluan",
    tujuan: "Bappeda Kabupaten",
    perihal: "Pengajuan usulan kegiatan RKPD 2026",
    sifat: "penting",
    penandatanganNama: "Datuk Penghulu",
    jabatanPenandatangan: "Penghulu",
    status: "dikirim",
    fileName: "Usulan_RKPD_2026.pdf",
    createdAt: "2026-01-06T08:00:00Z",
    updatedAt: "2026-01-06T14:00:00Z",
  },
  {
    id: "srt-102",
    tenantId: "ten-001",
    jenis: "keluar",
    nomorAgenda: "002/SK/2026",
    tahun: 2026,
    tanggalKeluar: "2026-01-08",
    nomorSurat: "006/2026/Kepenghuluan",
    tujuan: "Camat Kecamatan",
    perihal: "Laporan penyelenggaraan kegiatan gotong royong",
    sifat: "biasa",
    status: "menunggu_ttd",
    createdAt: "2026-01-08T09:00:00Z",
    updatedAt: "2026-01-08T09:00:00Z",
  },
];

let useMock = false;

export function setSuratMockMode(enabled: boolean) {
  useMock = enabled;
}

export function isSuratMockMode(): boolean {
  return useMock;
}

// --- API ---

export const suratApi = {
  listSurat: async (params?: ListSuratParams): Promise<{ items: SuratItem[]; total: number }> => {
    if (useMock) {
      let items: SuratItem[] = [];
      if (params?.jenis === "masuk") items = mockSuratMasuk;
      else if (params?.jenis === "keluar") items = mockSuratKeluar;
      else items = [...mockSuratMasuk, ...mockSuratKeluar];
      if (params?.q) {
        const q = params.q.toLowerCase();
        items = items.filter(
          (i) =>
            i.perihal.toLowerCase().includes(q) ||
            i.nomorSurat.toLowerCase().includes(q) ||
            ("pengirim" in i && i.pengirim.toLowerCase().includes(q)) ||
            ("tujuan" in i && i.tujuan.toLowerCase().includes(q)),
        );
      }
      if (params?.tahun) items = items.filter((i) => i.tahun === params.tahun);
      if (params?.sifat) items = items.filter((i) => i.sifat === params.sifat);
      if (params?.status) items = items.filter((i) => i.status === params.status);
      return { items, total: items.length };
    }
    const res = await api.get<{ items: SuratItem[]; total: number } | SuratItem[]>("/surat", {
      query: params as Record<string, string>,
    });
    if (Array.isArray(res)) return { items: res, total: res.length };
    return res;
  },

  getSurat: async (id: string): Promise<SuratItem> => {
    if (useMock) {
      const all = [...mockSuratMasuk, ...mockSuratKeluar];
      const found = all.find((s) => s.id === id);
      if (!found) throw new Error("Surat tidak ditemukan");
      return found;
    }
    return api.get<SuratItem>(`/surat/${id}`);
  },

  createSuratMasuk: async (input: CreateSuratMasukInput): Promise<SuratMasuk> => {
    if (useMock) {
      const tahun = input.tahun ?? new Date().getFullYear();
      const nomorAgenda = input.nomorAgenda ?? `${String(mockSuratMasuk.length + 1).padStart(3, "0")}/SM/${tahun}`;
      const created: SuratMasuk = {
        id: newMockId(),
        tenantId: "ten-001",
        jenis: "masuk",
        nomorAgenda,
        tahun,
        tanggalMasuk: input.tanggalMasuk,
        nomorSurat: input.nomorSurat,
        tanggalSurat: input.tanggalSurat,
        pengirim: input.pengirim,
        perihal: input.perihal,
        sifat: input.sifat,
        lampiran: input.lampiran,
        penerimaId: input.penerimaId,
        status: "diterima",
        fileName: input.fileName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        disposisi: [],
      };
      mockSuratMasuk.unshift(created);
      return created;
    }
    return api.post<SuratMasuk>("/surat/masuk", {
      kepenghuluan_id: input.kepenghuluanId,
      kepenghuluanId: input.kepenghuluanId,
      nomor_agenda: input.nomorAgenda,
      tahun: input.tahun,
      tanggal_masuk: input.tanggalMasuk,
      nomor_surat: input.nomorSurat,
      tanggal_surat: input.tanggalSurat,
      pengirim: input.pengirim,
      perihal: input.perihal,
      sifat: input.sifat,
      lampiran: input.lampiran,
      penerima_id: input.penerimaId,
      file_name: input.fileName,
    });
  },

  createSuratKeluar: async (input: CreateSuratKeluarInput): Promise<SuratKeluar> => {
    if (useMock) {
      const tahun = input.tahun ?? new Date().getFullYear();
      const nomorAgenda = input.nomorAgenda ?? `${String(mockSuratKeluar.length + 1).padStart(3, "0")}/SK/${tahun}`;
      const created: SuratKeluar = {
        id: newMockId(),
        tenantId: "ten-001",
        jenis: "keluar",
        nomorAgenda,
        tahun,
        tanggalKeluar: input.tanggalKeluar,
        nomorSurat: input.nomorSurat,
        tujuan: input.tujuan,
        perihal: input.perihal,
        sifat: input.sifat,
        status: "draft",
        fileName: input.fileName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockSuratKeluar.unshift(created);
      return created;
    }
    return api.post<SuratKeluar>("/surat/keluar", {
      kepenghuluan_id: input.kepenghuluanId,
      kepenghuluanId: input.kepenghuluanId,
      nomor_agenda: input.nomorAgenda,
      tahun: input.tahun,
      tanggal_keluar: input.tanggalKeluar,
      nomor_surat: input.nomorSurat,
      tujuan: input.tujuan,
      perihal: input.perihal,
      sifat: input.sifat,
      penandatangan_id: input.penandatanganId,
      file_name: input.fileName,
    });
  },

  transisiSurat: async (id: string, input: TransisiSuratInput): Promise<SuratItem> => {
    if (useMock) {
      const all = [...mockSuratMasuk, ...mockSuratKeluar] as SuratItem[];
      const found = all.find((s) => s.id === id);
      if (!found) throw new Error("Surat tidak ditemukan");
      (found as { status: string; updatedAt: string }).status = input.status;
      found.updatedAt = new Date().toISOString();
      return found;
    }
    return api.post<SuratItem>(`/surat/${id}/transisi`, input);
  },

  createDisposisi: async (suratId: string, input: CreateDisposisiInput): Promise<Disposisi> => {
    if (useMock) {
      const found = mockSuratMasuk.find((s) => s.id === suratId);
      if (!found) throw new Error("Surat masuk tidak ditemukan");
      const dsp: Disposisi = {
        id: `dsp-${++mockIdCounter}`,
        suratId,
        dariUserId: "usr-001",
        dariNama: "Datuk Penghulu",
        dariJabatan: "Penghulu",
        keNama: input.keNama,
        keJabatan: input.keJabatan,
        instruksi: input.instruksi,
        catatan: input.catatan,
        status: "terbuka",
        createdAt: new Date().toISOString(),
      };
      found.disposisi.push(dsp);
      found.status = "didisposisi";
      found.updatedAt = new Date().toISOString();
      return dsp;
    }
    return api.post<Disposisi>(`/surat/${suratId}/disposisi`, input);
  },
};
