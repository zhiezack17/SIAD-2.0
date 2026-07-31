import { api } from "./api-client";

/** Kondisi fisik barang/aset. */
export type KondisiAset =
  | "baik"
  | "rusak_ringan"
  | "rusak_berat"
  | "tidak_dapat_digunakan";

/** Status kepemilikan/pemanfaatan aset. */
export type StatusAset =
  | "aktif"
  | "dipinjam"
  | "maintenance"
  | "dihibahkan"
  | "dihapuskan";

export type Aset = {
  id: string;
  tenantId: string;
  kepenghuluanNama?: string;
  kode: string;
  nama: string;
  merk?: string;
  tipe?: string;
  ukuran?: string;
  bahan?: string;
  tahunPerolehan?: number;
  kondisi: KondisiAset;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
  nilaiPerolehan: number;
  sumberDana?: string;
  asalUsul?: string;
  lokasi?: string;
  keterangan?: string;
  status: StatusAset;
  driveFileId?: string;
  driveFileUrl?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
};

export type RiwayatAset = {
  id: string;
  asetId: string;
  aksi: string;
  statusLama?: StatusAset;
  statusBaru?: StatusAset;
  kondisiLama?: KondisiAset;
  kondisiBaru?: KondisiAset;
  lokasiLama?: string;
  lokasiBaru?: string;
  pj?: string;
  catatan?: string;
  olehPengguna?: number;
  createdAt: string;
};

export type ListAsetParams = {
  q?: string;
  kondisi?: KondisiAset;
  status?: StatusAset;
  tahun?: number;
};

export type CreateAsetInput = {
  kepenghuluanId?: string;
  kode: string;
  nama: string;
  merk?: string;
  tipe?: string;
  ukuran?: string;
  bahan?: string;
  tahunPerolehan?: number;
  kondisi: KondisiAset;
  jumlah?: number;
  satuan?: string;
  hargaSatuan?: number;
  nilaiPerolehan?: number;
  sumberDana?: string;
  asalUsul?: string;
  lokasi?: string;
  keterangan?: string;
  status?: StatusAset;
  fileBase64?: string;
  fileName?: string;
};

export type UpdateAsetInput = CreateAsetInput;

export type MutasiAsetInput = {
  status?: StatusAset;
  kondisi?: KondisiAset;
  lokasi?: string;
  pj?: string;
  catatan?: string;
};

// -------- helpers --------

export function kondisiLabel(k: KondisiAset): string {
  const map: Record<KondisiAset, string> = {
    baik: "Baik",
    rusak_ringan: "Rusak Ringan",
    rusak_berat: "Rusak Berat",
    tidak_dapat_digunakan: "Tidak Dapat Digunakan",
  };
  return map[k] ?? k;
}

export function statusLabel(s: StatusAset): string {
  const map: Record<StatusAset, string> = {
    aktif: "Aktif",
    dipinjam: "Dipinjam",
    maintenance: "Maintenance",
    dihibahkan: "Dihibahkan",
    dihapuskan: "Dihapuskan",
  };
  return map[s] ?? s;
}

export function kondisiVariant(
  k: KondisiAset,
): "default" | "secondary" | "outline" | "destructive" {
  switch (k) {
    case "baik":
      return "default";
    case "rusak_ringan":
      return "secondary";
    case "rusak_berat":
      return "outline";
    case "tidak_dapat_digunakan":
      return "destructive";
    default:
      return "outline";
  }
}

export function statusVariant(
  s: StatusAset,
): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "aktif":
      return "default";
    case "dipinjam":
      return "secondary";
    case "maintenance":
      return "outline";
    case "dihibahkan":
      return "outline";
    case "dihapuskan":
      return "destructive";
    default:
      return "outline";
  }
}

export const KONDISI_OPTIONS: { value: KondisiAset; label: string }[] = [
  { value: "baik", label: "Baik" },
  { value: "rusak_ringan", label: "Rusak Ringan" },
  { value: "rusak_berat", label: "Rusak Berat" },
  { value: "tidak_dapat_digunakan", label: "Tidak Dapat Digunakan" },
];

export const STATUS_OPTIONS: { value: StatusAset; label: string }[] = [
  { value: "aktif", label: "Aktif" },
  { value: "dipinjam", label: "Dipinjam" },
  { value: "maintenance", label: "Maintenance" },
  { value: "dihibahkan", label: "Dihibahkan" },
  { value: "dihapuskan", label: "Dihapuskan" },
];

export const SUMBER_DANA_OPTIONS = [
  "APBDes",
  "Bantuan Pemerintah",
  "Bantuan Provinsi",
  "Bantuan Kabupaten",
  "Sumbangan",
  "Swadaya Masyarakat",
  "Lainnya",
];

export const ASAL_USUL_OPTIONS = [
  "Pembelian",
  "Hibah",
  "Produksi Sendiri",
  "Bantuan",
  "Pengalihan",
  "Lainnya",
];

// -------- mock data --------

let mockCounter = 10;

export const mockAset: Aset[] = [
  {
    id: "ast-001",
    tenantId: "ten-001",
    kepenghuluanNama: "Air Hitam",
    kode: "KUR-001",
    nama: "Kursi Kayu Kantor",
    merk: "IKEA",
    tipe: "Kursi",
    ukuran: "Standard",
    bahan: "Kayu Jati",
    tahunPerolehan: 2024,
    kondisi: "baik",
    jumlah: 10,
    satuan: "unit",
    hargaSatuan: 450000,
    nilaiPerolehan: 4500000,
    sumberDana: "APBDes",
    asalUsul: "Pembelian",
    lokasi: "Ruang Kantor Penghulu",
    keterangan: "Digunakan untuk rapat",
    status: "aktif",
    createdAt: "2024-03-15T09:00:00Z",
    updatedAt: "2024-03-15T09:00:00Z",
  },
  {
    id: "ast-002",
    tenantId: "ten-001",
    kepenghuluanNama: "Air Hitam",
    kode: "MTR-001",
    nama: "Motor Dinas",
    merk: "Honda",
    tipe: "Supra X",
    tahunPerolehan: 2022,
    kondisi: "rusak_ringan",
    jumlah: 1,
    satuan: "unit",
    hargaSatuan: 18500000,
    nilaiPerolehan: 18500000,
    sumberDana: "Bantuan Kabupaten",
    asalUsul: "Bantuan",
    lokasi: "Garasi Kantor",
    status: "aktif",
    createdAt: "2022-07-20T08:00:00Z",
    updatedAt: "2023-11-10T10:00:00Z",
  },
];

let useMock = false;

export function setAsetMockMode(enabled: boolean) {
  useMock = enabled;
}

export function isAsetMockMode(): boolean {
  return useMock;
}

// -------- API --------

export const asetApi = {
  list: async (
    params?: ListAsetParams,
  ): Promise<{ items: Aset[]; total: number }> => {
    if (useMock) {
      let items = [...mockAset];
      if (params?.q) {
        const q = params.q.toLowerCase();
        items = items.filter(
          (i) =>
            i.nama.toLowerCase().includes(q) ||
            i.kode.toLowerCase().includes(q) ||
            (i.lokasi && i.lokasi.toLowerCase().includes(q)),
        );
      }
      if (params?.kondisi) items = items.filter((i) => i.kondisi === params.kondisi);
      if (params?.status) items = items.filter((i) => i.status === params.status);
      if (params?.tahun) items = items.filter((i) => i.tahunPerolehan === params.tahun);
      return { items, total: items.length };
    }
    return api.get<{ items: Aset[]; total: number }>("/aset", {
      query: params as Record<string, string>,
    });
  },

  get: async (id: string): Promise<Aset & { riwayat: RiwayatAset[] }> => {
    if (useMock) {
      const found = mockAset.find((a) => a.id === id);
      if (!found) throw new Error("Aset tidak ditemukan");
      return { ...found, riwayat: [] };
    }
    return api.get<Aset & { riwayat: RiwayatAset[] }>(`/aset/${id}`);
  },

  create: async (input: CreateAsetInput): Promise<Aset> => {
    if (useMock) {
      const now = new Date().toISOString();
      const jumlah = input.jumlah ?? 1;
      const harga = input.hargaSatuan ?? 0;
      const created: Aset = {
        id: `ast-${++mockCounter}`,
        tenantId: "ten-001",
        kepenghuluanNama: "Air Hitam",
        kode: input.kode,
        nama: input.nama,
        merk: input.merk,
        tipe: input.tipe,
        ukuran: input.ukuran,
        bahan: input.bahan,
        tahunPerolehan: input.tahunPerolehan,
        kondisi: input.kondisi,
        jumlah,
        satuan: input.satuan ?? "unit",
        hargaSatuan: harga,
        nilaiPerolehan: input.nilaiPerolehan ?? jumlah * harga,
        sumberDana: input.sumberDana,
        asalUsul: input.asalUsul,
        lokasi: input.lokasi,
        keterangan: input.keterangan,
        status: input.status ?? "aktif",
        fileName: input.fileName,
        createdAt: now,
        updatedAt: now,
      };
      mockAset.unshift(created);
      return created;
    }
    return api.post<Aset>("/aset", input);
  },

  update: async (id: string, input: UpdateAsetInput): Promise<Aset> => {
    if (useMock) {
      const idx = mockAset.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Aset tidak ditemukan");
      const jumlah = input.jumlah ?? mockAset[idx].jumlah;
      const harga = input.hargaSatuan ?? mockAset[idx].hargaSatuan;
      mockAset[idx] = {
        ...mockAset[idx],
        kode: input.kode,
        nama: input.nama,
        merk: input.merk ?? mockAset[idx].merk,
        tipe: input.tipe ?? mockAset[idx].tipe,
        ukuran: input.ukuran ?? mockAset[idx].ukuran,
        bahan: input.bahan ?? mockAset[idx].bahan,
        tahunPerolehan: input.tahunPerolehan ?? mockAset[idx].tahunPerolehan,
        kondisi: input.kondisi ?? mockAset[idx].kondisi,
        jumlah,
        satuan: input.satuan ?? mockAset[idx].satuan,
        hargaSatuan: harga,
        nilaiPerolehan: input.nilaiPerolehan ?? jumlah * harga,
        sumberDana: input.sumberDana ?? mockAset[idx].sumberDana,
        asalUsul: input.asalUsul ?? mockAset[idx].asalUsul,
        lokasi: input.lokasi ?? mockAset[idx].lokasi,
        keterangan: input.keterangan ?? mockAset[idx].keterangan,
        status: input.status ?? mockAset[idx].status,
        fileName: input.fileName ?? mockAset[idx].fileName,
        updatedAt: new Date().toISOString(),
      };
      return mockAset[idx];
    }
    return api.patch<Aset>(`/aset/${id}`, input);
  },

  mutate: async (id: string, input: MutasiAsetInput): Promise<Aset> => {
    if (useMock) {
      const idx = mockAset.findIndex((a) => a.id === id);
      if (idx === -1) throw new Error("Aset tidak ditemukan");
      mockAset[idx] = {
        ...mockAset[idx],
        status: input.status ?? mockAset[idx].status,
        kondisi: input.kondisi ?? mockAset[idx].kondisi,
        lokasi: input.lokasi ?? mockAset[idx].lokasi,
        updatedAt: new Date().toISOString(),
      };
      return mockAset[idx];
    }
    return api.post<Aset>(`/aset/${id}/status`, input);
  },

  remove: async (id: string): Promise<{ success: boolean }> => {
    if (useMock) {
      const idx = mockAset.findIndex((a) => a.id === id);
      if (idx >= 0) mockAset.splice(idx, 1);
      return { success: true };
    }
    return api.delete<{ success: boolean }>(`/aset/${id}`);
  },
};

// Utility untuk membaca file sebagai base64
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
