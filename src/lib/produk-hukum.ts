import { api } from "./api-client";

/** Jenis produk hukum kepenghuluan. */
export type JenisProdukHukum =
  | "peraturan_kepenghuluan"
  | "peraturan_bersama_penghulu"
  | "peraturan_penghulu"
  | "keputusan_penghulu"
  | "instruksi_penghulu";

export type StatusProdukHukum =
  | "draft"
  | "ditetapkan"
  | "diundangkan"
  | "dicabut";

export type ProdukHukum = {
  id: string;
  tenantId: string;
  jenis: JenisProdukHukum;
  nomor: string;
  tahun: number;
  judul: string;
  tentang: string;
  tanggalDitetapkan?: string;
  tanggalDiundangkan?: string;
  ditetapkanOleh?: string;
  jabatan?: string;
  status: StatusProdukHukum;
  referensi?: string[];
  driveFileId?: string;
  driveFileUrl?: string;
  fileName?: string;
  createdAt: string;
  updatedAt: string;
};

export type ListProdukHukumParams = {
  q?: string;
  jenis?: JenisProdukHukum;
  tahun?: number;
  status?: StatusProdukHukum;
};

export type CreateProdukHukumInput = {
  kepenghuluanId?: string;
  jenis: JenisProdukHukum;
  nomor: string;
  tahun: number;
  judul: string;
  tentang: string;
  tanggalDitetapkan?: string;
  tanggalDiundangkan?: string;
  ditetapkanOleh?: string;
  jabatan?: string;
};

// -------- helpers --------

export function jenisLabel(j: JenisProdukHukum): string {
  const map: Record<JenisProdukHukum, string> = {
    peraturan_kepenghuluan: "Peraturan Kepenghuluan",
    peraturan_bersama_penghulu: "Peraturan Bersama Penghulu",
    peraturan_penghulu: "Peraturan Penghulu",
    keputusan_penghulu: "Keputusan Penghulu",
    instruksi_penghulu: "Instruksi Penghulu",
  };
  return map[j] ?? j;
}

export function jenisShort(j: JenisProdukHukum): string {
  const map: Record<JenisProdukHukum, string> = {
    peraturan_kepenghuluan: "PERKEP",
    peraturan_bersama_penghulu: "PB",
    peraturan_penghulu: "PERPHL",
    keputusan_penghulu: "SK",
    instruksi_penghulu: "INS",
  };
  return map[j] ?? j;
}

export function statusLabel(s: StatusProdukHukum): string {
  const map: Record<StatusProdukHukum, string> = {
    draft: "Draft",
    ditetapkan: "Ditetapkan",
    diundangkan: "Diundangkan",
    dicabut: "Dicabut",
  };
  return map[s] ?? s;
}

export function statusVariant(
  s: StatusProdukHukum,
): "default" | "secondary" | "outline" | "destructive" {
  switch (s) {
    case "diundangkan":
      return "default";
    case "ditetapkan":
      return "secondary";
    case "dicabut":
      return "destructive";
    default:
      return "outline";
  }
}

export const JENIS_OPTIONS: { value: JenisProdukHukum; label: string }[] = [
  { value: "peraturan_kepenghuluan", label: "Peraturan Kepenghuluan" },
  { value: "peraturan_bersama_penghulu", label: "Peraturan Bersama Penghulu" },
  { value: "peraturan_penghulu", label: "Peraturan Penghulu" },
  { value: "keputusan_penghulu", label: "Keputusan Penghulu" },
  { value: "instruksi_penghulu", label: "Instruksi Penghulu" },
];

// -------- mock data --------

let mockCounter = 10;

export const mockProdukHukum: ProdukHukum[] = [
  {
    id: "ph-001",
    tenantId: "ten-001",
    jenis: "peraturan_kepenghuluan",
    nomor: "01",
    tahun: 2026,
    judul: "Peraturan Kepenghuluan Nomor 01 Tahun 2026",
    tentang: "Anggaran Pendapatan dan Belanja Kepenghuluan Tahun 2026",
    tanggalDitetapkan: "2026-01-15",
    tanggalDiundangkan: "2026-01-20",
    ditetapkanOleh: "Datuk Penghulu",
    jabatan: "Penghulu",
    status: "diundangkan",
    fileName: "PERKEP_01_2026_APBDes.pdf",
    createdAt: "2026-01-15T09:00:00Z",
    updatedAt: "2026-01-20T10:00:00Z",
  },
  {
    id: "ph-002",
    tenantId: "ten-001",
    jenis: "keputusan_penghulu",
    nomor: "05",
    tahun: 2026,
    judul: "Keputusan Penghulu Nomor 05 Tahun 2026",
    tentang: "Pembentukan Tim Pelaksana Kegiatan Pembangunan Drainase",
    tanggalDitetapkan: "2026-01-22",
    ditetapkanOleh: "Datuk Penghulu",
    jabatan: "Penghulu",
    status: "ditetapkan",
    createdAt: "2026-01-22T08:00:00Z",
    updatedAt: "2026-01-22T08:00:00Z",
  },
  {
    id: "ph-003",
    tenantId: "ten-001",
    jenis: "peraturan_penghulu",
    nomor: "02",
    tahun: 2026,
    judul: "Peraturan Penghulu Nomor 02 Tahun 2026",
    tentang: "Pedoman Pelaksanaan Kegiatan Bidang Pembangunan",
    tanggalDitetapkan: "2026-02-01",
    tanggalDiundangkan: "2026-02-05",
    ditetapkanOleh: "Datuk Penghulu",
    jabatan: "Penghulu",
    status: "diundangkan",
    createdAt: "2026-02-01T09:00:00Z",
    updatedAt: "2026-02-05T10:00:00Z",
  },
  {
    id: "ph-004",
    tenantId: "ten-001",
    jenis: "instruksi_penghulu",
    nomor: "01",
    tahun: 2026,
    judul: "Instruksi Penghulu Nomor 01 Tahun 2026",
    tentang: "Percepatan Pelaporan SPJ Triwulan I",
    tanggalDitetapkan: "2026-03-01",
    ditetapkanOleh: "Datuk Penghulu",
    jabatan: "Penghulu",
    status: "ditetapkan",
    createdAt: "2026-03-01T09:00:00Z",
    updatedAt: "2026-03-01T09:00:00Z",
  },
];

let useMock = true; // sementara true — backend belum ada endpoint /produk-hukum

export function setProdukHukumMockMode(enabled: boolean) {
  useMock = enabled;
}

export function isProdukHukumMockMode(): boolean {
  return useMock;
}

// -------- API --------

export const produkHukumApi = {
  list: async (
    params?: ListProdukHukumParams,
  ): Promise<{ items: ProdukHukum[]; total: number }> => {
    if (useMock) {
      let items = [...mockProdukHukum];
      if (params?.q) {
        const q = params.q.toLowerCase();
        items = items.filter(
          (i) =>
            i.judul.toLowerCase().includes(q) ||
            i.tentang.toLowerCase().includes(q) ||
            i.nomor.toLowerCase().includes(q),
        );
      }
      if (params?.jenis) items = items.filter((i) => i.jenis === params.jenis);
      if (params?.tahun) items = items.filter((i) => i.tahun === params.tahun);
      if (params?.status) items = items.filter((i) => i.status === params.status);
      return { items, total: items.length };
    }
    return api.get<{ items: ProdukHukum[]; total: number }>("/produk-hukum", {
      query: params as Record<string, string>,
    });
  },

  get: async (id: string): Promise<ProdukHukum> => {
    if (useMock) {
      const found = mockProdukHukum.find((p) => p.id === id);
      if (!found) throw new Error("Produk hukum tidak ditemukan");
      return found;
    }
    return api.get<ProdukHukum>(`/produk-hukum/${id}`);
  },

  create: async (input: CreateProdukHukumInput): Promise<ProdukHukum> => {
    if (useMock) {
      const now = new Date().toISOString();
      const created: ProdukHukum = {
        id: `ph-${++mockCounter}`,
        tenantId: "ten-001",
        jenis: input.jenis,
        nomor: input.nomor,
        tahun: input.tahun,
        judul: input.judul,
        tentang: input.tentang,
        tanggalDitetapkan: input.tanggalDitetapkan,
        tanggalDiundangkan: input.tanggalDiundangkan,
        ditetapkanOleh: input.ditetapkanOleh,
        jabatan: input.jabatan,
        status: input.tanggalDiundangkan
          ? "diundangkan"
          : input.tanggalDitetapkan
          ? "ditetapkan"
          : "draft",
        createdAt: now,
        updatedAt: now,
      };
      mockProdukHukum.unshift(created);
      return created;
    }
    return api.post<ProdukHukum>("/produk-hukum", input);
  },

  updateStatus: async (
    id: string,
    status: StatusProdukHukum,
  ): Promise<ProdukHukum> => {
    if (useMock) {
      const found = mockProdukHukum.find((p) => p.id === id);
      if (!found) throw new Error("Produk hukum tidak ditemukan");
      found.status = status;
      if (status === "ditetapkan" && !found.tanggalDitetapkan) {
        found.tanggalDitetapkan = new Date().toISOString().slice(0, 10);
      }
      if (status === "diundangkan" && !found.tanggalDiundangkan) {
        found.tanggalDiundangkan = new Date().toISOString().slice(0, 10);
      }
      found.updatedAt = new Date().toISOString();
      return found;
    }
    return api.post<ProdukHukum>(`/produk-hukum/${id}/status`, { status });
  },

  remove: async (id: string): Promise<{ success: boolean }> => {
    if (useMock) {
      const idx = mockProdukHukum.findIndex((p) => p.id === id);
      if (idx >= 0) mockProdukHukum.splice(idx, 1);
      return { success: true };
    }
    return api.delete<{ success: boolean }>(`/produk-hukum/${id}`);
  },
};
