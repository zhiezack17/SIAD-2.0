import { api } from "./api-client";

/** Status kegiatan dalam alur verifikasi SPJ berjenjang. */
export type SpjStatus =
  | "draft"
  | "diajukan"
  | "dicek_bendahara"
  | "diverifikasi_sekretaris"
  | "disetujui"
  | "ditolak";

/** Aksi transisi pada level kegiatan sesuai API backend. */
export type SpjTransitionAction = "ajukan" | "cek" | "verifikasi" | "setujui" | "tolak";

/** Status upload dokumen checklist. */
export type DokumenStatus = "belum" | "terunggah";

export type SpjBidang =
  | "Pemerintahan"
  | "Kesejahteraan"
  | "Pelayanan"
  | "Ketentraman"
  | "Pemberdayaan"
  | "Lainnya";

export type Kegiatan = {
  id: string;
  tenantId: string;
  kode: string;
  nama: string;
  tahun: number;
  bidang: string;
  anggaran?: number;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  keterangan?: string;
  status: SpjStatus;
  driveFolderId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** ringkasan progress: jumlah dokumen / wajib / ada. */
  progress?: { total: number; wajib: number; ada: number };
};

export type DokumenSpj = {
  id: string;
  kegiatanId: string;
  jenis: string;
  keterangan?: string;
  fileDriveId?: string;
  fileName?: string;
  fileMimeType?: string;
  fileSize?: number;
  status: DokumenStatus;
  catatanVerifikasi?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type RiwayatSpj = {
  id: string;
  dokumenId?: string;
  actorId: string;
  actorNama?: string;
  peran?: string;
  statusLama?: SpjStatus;
  statusBaru?: SpjStatus;
  action: SpjTransitionAction | string;
  catatan?: string;
  createdAt: string;
};

export type ChecklistItem = {
  id: string;
  jenisDokumen: string;
  wajib: boolean;
  urutan: number;
  ada: boolean;
  dokumenId?: string;
  catatan?: string;
};

export type CreateKegiatanInput = {
  kepenghuluanId: string;
  masterKegiatanId: string;
  namaKegiatan: string;
  kode?: string;
  tahun: number;
  anggaran?: number;
  tanggalMulai?: string;
  tanggalSelesai?: string;
  lokasi?: string;
  keterangan?: string;
};

export type UpdateKegiatanInput = Partial<CreateKegiatanInput>;

export type TransitionInput = {
  action: SpjTransitionAction;
  catatan?: string;
};

export type UploadDokumenInput = {
  kegiatanId: string;
  dokumenId: string;
  file: File;
  keterangan?: string;
};

export type ListKegiatanParams = {
  status?: SpjStatus;
  tahun?: number;
  bidang?: string;
  q?: string;
  page?: number;
  limit?: number;
};

export type MasterKegiatan = {
  id: string;
  subBidangId?: string;
  kode: string;
  nama: string;
};

/** Shape data kegiatan dari backend VPS. */
type BackendKegiatanRow = {
  id: string | number;
  kepenghuluan_id: string | number;
  master_kegiatan_id: string | number;
  tahun: string | number;
  /** Backend memakai `judul`; `nama_kegiatan` dipertahankan sebagai alias lama. */
  judul?: string;
  nama_kegiatan?: string;
  nilai_anggaran?: string | number;
  pagu_anggaran?: string | number;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  deskripsi?: string;
  keterangan?: string;
  lokasi?: string;
  status: SpjStatus;
  drive_folder_id?: string;
  created_at: string;
  updated_at: string;
  dibuat_oleh: string | number;
  kepenghuluan_nama?: string;
  kegiatan_nama?: string;
  kegiatan_kode?: string;
};

/** Shape detail kegiatan dari backend VPS (termasuk dokumen & riwayat). */
type BackendKegiatanDetail = BackendKegiatanRow & {
  dokumen: BackendDokumenRow[];
  riwayat: BackendRiwayatRow[];
};

type BackendDokumenRow = {
  id: string | number;
  kegiatan_spj_id: string | number;
  nama_dokumen: string;
  wajib: boolean;
  urutan: number;
  status: DokumenStatus;
  drive_file_id?: string;
  drive_file_url?: string;
  nama_file?: string;
  mime_type?: string;
  ukuran?: string | number;
  diunggah_oleh?: string | number;
  diunggah_pada?: string;
  created_at?: string;
  updated_at?: string;
};

type BackendRiwayatRow = {
  id: string | number;
  kegiatan_spj_id: string | number;
  aksi: string;
  oleh_pengguna_id?: string | number;
  oleh?: string | number;
  catatan?: string;
  created_at?: string;
  pada?: string;
  oleh_nama?: string;
};

function toStringId(value: string | number): string {
  return String(value);
}

function toNumber(value: string | number | undefined | null): number | undefined {
  if (value === undefined || value === null) return undefined;
  return typeof value === "string" ? Number(value.replace(/[^0-9.-]/g, "")) || 0 : value;
}

function computeProgress(checklist: ChecklistItem[]): Kegiatan["progress"] {
  return {
    total: checklist.length,
    wajib: checklist.filter((c) => c.wajib).length,
    ada: checklist.filter((c) => c.ada).length,
  };
}

function mapBackendKegiatan(row: BackendKegiatanRow, checklist?: ChecklistItem[]): Kegiatan {
  return {
    id: toStringId(row.id),
    tenantId: toStringId(row.kepenghuluan_id),
    kode: row.kegiatan_kode ?? row.kegiatan_nama ?? "",
    nama: row.judul ?? row.nama_kegiatan ?? "",
    tahun: Number(row.tahun),
    bidang: "",
    anggaran: toNumber(row.nilai_anggaran ?? row.pagu_anggaran),
    tanggalMulai: row.tanggal_mulai,
    tanggalSelesai: row.tanggal_selesai,
    keterangan: row.deskripsi ?? row.keterangan,
    status: row.status,
    driveFolderId: row.drive_folder_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: toStringId(row.dibuat_oleh),
    progress: checklist ? computeProgress(checklist) : { total: 0, wajib: 0, ada: 0 },
  };
}

function mapBackendDokumen(row: BackendDokumenRow): DokumenSpj {
  return {
    id: toStringId(row.id),
    kegiatanId: toStringId(row.kegiatan_spj_id),
    jenis: row.nama_dokumen,
    fileDriveId: row.drive_file_id,
    fileName: row.nama_file,
    fileMimeType: row.mime_type,
    fileSize: toNumber(row.ukuran),
    status: row.status,
    createdAt: row.diunggah_pada ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.diunggah_pada ?? new Date().toISOString(),
    createdBy: row.diunggah_oleh ? toStringId(row.diunggah_oleh) : undefined,
  };
}

function mapBackendChecklist(row: BackendDokumenRow): ChecklistItem {
  return {
    id: toStringId(row.id),
    jenisDokumen: row.nama_dokumen,
    wajib: row.wajib,
    urutan: row.urutan,
    ada: row.status === "terunggah",
    dokumenId: row.status === "terunggah" ? toStringId(row.id) : undefined,
  };
}

function mapBackendRiwayat(row: BackendRiwayatRow): RiwayatSpj {
  return {
    id: toStringId(row.id),
    dokumenId: toStringId(row.kegiatan_spj_id),
    actorId: toStringId(row.oleh_pengguna_id ?? row.oleh ?? ""),
    actorNama: row.oleh_nama,
    action: row.aksi,
    catatan: row.catatan,
    createdAt: row.created_at ?? row.pada ?? new Date().toISOString(),
  };
}

export const spjApi = {
  /** Daftar kegiatan SPJ. */
  listKegiatan: async (params?: ListKegiatanParams) => {
    const query: Record<string, string> = {};
    if (params?.status) query.status = params.status;
    if (params?.tahun) query.tahun = String(params.tahun);
    const rows = await api.get<BackendKegiatanRow[]>("/spj", { query });
    const items = rows.map((r) => mapBackendKegiatan(r));
    return { items, total: items.length };
  },

  /** Detail kegiatan beserta dokumen, checklist, dan riwayat. */
  getKegiatanDetail: async (id: string) => {
    const data = await api.get<BackendKegiatanDetail>(`/spj/${id}`);
    const dokumen = data.dokumen.map(mapBackendDokumen);
    const checklist = data.dokumen.map(mapBackendChecklist);
    const riwayat = data.riwayat.map(mapBackendRiwayat);
    const kegiatan = mapBackendKegiatan(data, checklist);
    return { kegiatan, dokumen, checklist, riwayat };
  },

  /** Buat kegiatan baru. */
  createKegiatan: async (input: CreateKegiatanInput) => {
    const body = {
      kepenghuluan_id: input.kepenghuluanId,
      kepenghuluanId: input.kepenghuluanId,
      master_kegiatan_id: input.masterKegiatanId,
      judul: input.namaKegiatan,
      nama_kegiatan: input.namaKegiatan,
      deskripsi: input.keterangan,
      keterangan: input.keterangan,
      nilai_anggaran: input.anggaran,
      pagu_anggaran: input.anggaran,
      tahun: input.tahun,
      tanggal_mulai: input.tanggalMulai,
      tanggal_selesai: input.tanggalSelesai,
      lokasi: input.lokasi,
    };
    const created = await api.post<BackendKegiatanRow>("/spj", body);
    const kegiatan = mapBackendKegiatan(created);
    return { kegiatan };
  },

  /** Perbarui kegiatan. */
  updateKegiatan: async (id: string, input: UpdateKegiatanInput) => {
    const body = {
      kepenghuluan_id: input.kepenghuluanId,
      kepenghuluanId: input.kepenghuluanId,
      master_kegiatan_id: input.masterKegiatanId,
      judul: input.namaKegiatan,
      nama_kegiatan: input.namaKegiatan,
      deskripsi: input.keterangan,
      keterangan: input.keterangan,
      nilai_anggaran: input.anggaran,
      pagu_anggaran: input.anggaran,
      tahun: input.tahun,
    };
    const updated = await api.put<BackendKegiatanRow>(`/spj/${id}`, body);
    return { kegiatan: mapBackendKegiatan(updated) };
  },


  /** Hapus kegiatan. */
  deleteKegiatan: async (id: string) => {
    await api.delete(`/spj/${id}`);
    return { success: true };
  },

  /** Upload file ke slot dokumen checklist. */
  uploadDokumen: async (input: UploadDokumenInput) => {
    const form = new FormData();
    form.append("file", input.file);
    const dok = await api.post<BackendDokumenRow>(
      `/spj/${input.kegiatanId}/dokumen/${input.dokumenId}/upload`,
      form,
    );
    return { dokumen: mapBackendDokumen(dok) };
  },


  /** Transisi status kegiatan. */
  transitionKegiatan: async (kegiatanId: string, input: TransitionInput) => {
    const updated = await api.post<BackendKegiatanRow>(`/spj/${kegiatanId}/transisi`, {
      aksi: input.action,
      catatan: input.catatan,
    });
    return { kegiatan: mapBackendKegiatan(updated) };
  },

  /** Daftar master kegiatan untuk picker. */
  listMasterKegiatan: async (q?: string) => {
    const query: Record<string, string> = {};
    if (q) query.q = q;
    const rows = await api.get<{ id: string | number; sub_bidang_id?: string | number; kode: string; nama: string }[]>(
      "/master/kegiatan",
      { query },
    );
    return rows.map((r) => ({
      id: toStringId(r.id),
      subBidangId: r.sub_bidang_id ? toStringId(r.sub_bidang_id) : undefined,
      kode: r.kode,
      nama: r.nama,
    })) as MasterKegiatan[];
  },
};

/** Label status untuk tampilan. */
export function statusLabel(status: SpjStatus): string {
  const map: Record<SpjStatus, string> = {
    draft: "Draft",
    diajukan: "Diajukan",
    dicek_bendahara: "Dicek Bendahara",
    diverifikasi_sekretaris: "Diverifikasi Sekretaris",
    disetujui: "Disetujui Penghulu",
    ditolak: "Ditolak",
  };
  return map[status] ?? status;
}

/** Warna badge status. */
export function statusVariant(status: SpjStatus): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "disetujui":
      return "default";
    case "diverifikasi_sekretaris":
    case "dicek_bendahara":
    case "diajukan":
      return "secondary";
    case "ditolak":
      return "destructive";
    default:
      return "outline";
  }
}

/** Label aksi transisi. */
export function actionLabel(action: SpjTransitionAction): string {
  const map: Record<SpjTransitionAction, string> = {
    ajukan: "Ajukan ke Bendahara",
    cek: "Cek & Teruskan ke Sekretaris",
    verifikasi: "Verifikasi & Teruskan ke Penghulu",
    setujui: "Setujui SPJ",
    tolak: "Tolak / Kembalikan",
  };
  return map[action] ?? action;
}

/** Label status dokumen checklist. */
export function dokumenStatusLabel(status: DokumenStatus): string {
  return status === "terunggah" ? "Terunggah" : "Belum ada";
}

/** Warna badge status dokumen. */
export function dokumenStatusVariant(status: DokumenStatus): "default" | "outline" {
  return status === "terunggah" ? "default" : "outline";
}

/** Mock data untuk preview frontend sebelum VPS siap. */
export const mockKegiatan: Kegiatan[] = [
  {
    id: "keg-001",
    tenantId: "ten-001",
    kode: "KEG-2025-001",
    nama: "Pembangunan Drainase RT. 01",
    tahun: 2025,
    bidang: "Pelayanan",
    anggaran: 125000000,
    tanggalMulai: "2025-01-15",
    tanggalSelesai: "2025-03-30",
    keterangan: "Drainase utama RT. 01 menuju sungai desa.",
    status: "diverifikasi_sekretaris",
    createdAt: "2025-01-10T08:00:00Z",
    updatedAt: "2025-02-20T14:30:00Z",
    createdBy: "usr-001",
    progress: { total: 6, wajib: 5, ada: 4 },
  },
  {
    id: "keg-002",
    tenantId: "ten-001",
    kode: "KEG-2025-002",
    nama: "Pelatihan UMKM Kepenghuluan",
    tahun: 2025,
    bidang: "Pemberdayaan",
    anggaran: 45000000,
    tanggalMulai: "2025-02-01",
    tanggalSelesai: "2025-02-28",
    status: "dicek_bendahara",
    createdAt: "2025-01-25T09:00:00Z",
    updatedAt: "2025-02-05T11:00:00Z",
    createdBy: "usr-002",
    progress: { total: 5, wajib: 4, ada: 3 },
  },
  {
    id: "keg-003",
    tenantId: "ten-001",
    kode: "KEG-2025-003",
    nama: "Pengadaan Alat Tulis Kantor",
    tahun: 2025,
    bidang: "Pemerintahan",
    anggaran: 8000000,
    status: "draft",
    createdAt: "2025-02-10T07:30:00Z",
    updatedAt: "2025-02-10T07:30:00Z",
    createdBy: "usr-003",
    progress: { total: 4, wajib: 4, ada: 1 },
  },
];

export const mockDokumen: DokumenSpj[] = [
  {
    id: "doc-001",
    kegiatanId: "keg-001",
    jenis: "Surat Perintah",
    fileName: "SP_Drainase_RT01.pdf",
    fileMimeType: "application/pdf",
    fileSize: 1024 * 250,
    status: "terunggah",
    createdAt: "2025-01-12T08:00:00Z",
    updatedAt: "2025-01-20T10:00:00Z",
    createdBy: "usr-001",
  },
  {
    id: "doc-002",
    kegiatanId: "keg-001",
    jenis: "Kwitansi",
    fileName: "KW_Drainase_001.pdf",
    fileMimeType: "application/pdf",
    fileSize: 1024 * 120,
    status: "terunggah",
    createdAt: "2025-02-05T09:00:00Z",
    updatedAt: "2025-02-20T14:30:00Z",
    createdBy: "usr-001",
  },
  {
    id: "doc-003",
    kegiatanId: "keg-001",
    jenis: "Daftar Hadir",
    keterangan: "Belum diunggah",
    status: "belum",
    createdAt: "2025-02-10T07:30:00Z",
    updatedAt: "2025-02-10T07:30:00Z",
    createdBy: "usr-001",
  },
];

export const mockChecklist: ChecklistItem[] = [
  { id: "chk-1", jenisDokumen: "Surat Perintah", wajib: true, urutan: 1, ada: true, dokumenId: "doc-001" },
  { id: "chk-2", jenisDokumen: "Kwitansi", wajib: true, urutan: 2, ada: true, dokumenId: "doc-002" },
  { id: "chk-3", jenisDokumen: "Nota/Invoice", wajib: true, urutan: 3, ada: false },
  { id: "chk-4", jenisDokumen: "Daftar Hadir", wajib: true, urutan: 4, ada: false },
  { id: "chk-5", jenisDokumen: "Berita Acara", wajib: false, urutan: 5, ada: false },
  { id: "chk-6", jenisDokumen: "Laporan Kegiatan", wajib: true, urutan: 6, ada: false },
];

export const mockHistory: RiwayatSpj[] = [
  {
    id: "hist-1",
    dokumenId: "doc-002",
    actorId: "usr-001",
    actorNama: "Ahmad Kaur",
    peran: "kaur",
    statusLama: "draft",
    statusBaru: "dicek_bendahara",
    action: "ajukan",
    catatan: "Mohon dicek nominal kwitansi.",
    createdAt: "2025-02-05T09:00:00Z",
  },
  {
    id: "hist-2",
    dokumenId: "doc-002",
    actorId: "usr-004",
    actorNama: "Siti Bendahara",
    peran: "bendahara",
    statusLama: "dicek_bendahara",
    statusBaru: "diverifikasi_sekretaris",
    action: "cek",
    catatan: "Nominal sesuai RKD.",
    createdAt: "2025-02-10T11:00:00Z",
  },
  {
    id: "hist-3",
    dokumenId: "doc-002",
    actorId: "usr-005",
    actorNama: "Budi Sekretaris",
    peran: "sekretaris",
    statusLama: "diverifikasi_sekretaris",
    statusBaru: "diverifikasi_sekretaris",
    action: "verifikasi",
    catatan: "Lengkap administrasi, silakan ke Penghulu.",
    createdAt: "2025-02-20T14:30:00Z",
  },
];
