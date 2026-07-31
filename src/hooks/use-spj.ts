import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  spjApi,
  mockKegiatan,
  mockDokumen,
  mockChecklist,
  mockHistory,
  type Kegiatan,
  type DokumenSpj,
  type ChecklistItem,
  type RiwayatSpj,
  type SpjStatus,
  type ListKegiatanParams,
  type CreateKegiatanInput,
  type UpdateKegiatanInput,
  type TransitionInput,
  type UploadDokumenInput,
} from "@/lib/spj";

const USE_MOCK = false;

const keys = {
  all: ["spj"] as const,
  list: (params?: ListKegiatanParams) => [...keys.all, "list", params] as const,
  detail: (id: string) => [...keys.all, "kegiatan", id] as const,
  dokumen: (kegiatanId: string) => [...keys.all, "dokumen", kegiatanId] as const,
  checklist: (kegiatanId: string) => [...keys.all, "checklist", kegiatanId] as const,
  history: (kegiatanId: string) => [...keys.all, "history", kegiatanId] as const,
  masterKegiatan: (q?: string) => [...keys.all, "master-kegiatan", q] as const,
};

export function useKegiatanList(params?: ListKegiatanParams) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: async () => {
      if (USE_MOCK) {
        let items = [...mockKegiatan];
        if (params?.tahun) items = items.filter((k) => k.tahun === params.tahun);
        if (params?.bidang) items = items.filter((k) => k.bidang === params.bidang);
        if (params?.status) items = items.filter((k) => k.status === params.status);
        if (params?.q) {
          const q = params.q.toLowerCase();
          items = items.filter((k) => k.nama.toLowerCase().includes(q) || k.kode.toLowerCase().includes(q));
        }
        return { items, total: items.length };
      }
      return spjApi.listKegiatan(params);
    },
  });
}

export function useKegiatanDetail(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: async () => {
      if (USE_MOCK) {
        const kegiatan = mockKegiatan.find((k) => k.id === id);
        if (!kegiatan) throw new Error("Kegiatan tidak ditemukan");
        return { kegiatan };
      }
      const { kegiatan } = await spjApi.getKegiatanDetail(id);
      return { kegiatan };
    },
  });
}

export function useDokumenList(kegiatanId: string) {
  return useQuery({
    queryKey: keys.dokumen(kegiatanId),
    queryFn: async () => {
      if (USE_MOCK) {
        const items = mockDokumen.filter((d) => d.kegiatanId === kegiatanId);
        return { items };
      }
      const { dokumen } = await spjApi.getKegiatanDetail(kegiatanId);
      return { items: dokumen };
    },
  });
}

export function useChecklist(kegiatanId: string) {
  return useQuery({
    queryKey: keys.checklist(kegiatanId),
    queryFn: async () => {
      if (USE_MOCK) return { items: mockChecklist };
      const { checklist } = await spjApi.getKegiatanDetail(kegiatanId);
      return { items: checklist };
    },
  });
}

export function useKegiatanHistory(kegiatanId: string) {
  return useQuery({
    queryKey: keys.history(kegiatanId),
    queryFn: async () => {
      if (USE_MOCK) return { items: mockHistory };
      const { riwayat } = await spjApi.getKegiatanDetail(kegiatanId);
      return { items: riwayat };
    },
  });
}

export function useMasterKegiatan(q?: string) {
  return useQuery({
    queryKey: keys.masterKegiatan(q),
    queryFn: async () => {
      if (USE_MOCK) return [];
      return spjApi.listMasterKegiatan(q);
    },
    enabled: !USE_MOCK,
  });
}

export function useCreateKegiatan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKegiatanInput) => {
      if (USE_MOCK) {
        const kegiatan: Kegiatan = {
          id: `keg-${Date.now()}`,
          tenantId: "ten-001",
          kode: input.kode ?? "",
          nama: input.namaKegiatan,
          tahun: input.tahun,
          bidang: "",
          anggaran: input.anggaran,
          tanggalMulai: input.tanggalMulai,
          tanggalSelesai: input.tanggalSelesai,
          keterangan: input.keterangan,
          status: "draft",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "usr-mock",
          progress: { total: 6, wajib: 5, ada: 0 },
        };
        mockKegiatan.unshift(kegiatan);
        return Promise.resolve({ kegiatan });
      }
      return spjApi.createKegiatan(input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateKegiatan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateKegiatanInput) => {
      if (USE_MOCK) {
        const idx = mockKegiatan.findIndex((k) => k.id === id);
        if (idx === -1) throw new Error("Kegiatan tidak ditemukan");
        mockKegiatan[idx] = {
          ...mockKegiatan[idx],
          kode: input.kode ?? mockKegiatan[idx].kode,
          nama: input.namaKegiatan ?? mockKegiatan[idx].nama,
          anggaran: input.anggaran ?? mockKegiatan[idx].anggaran,
          tanggalMulai: input.tanggalMulai ?? mockKegiatan[idx].tanggalMulai,
          tanggalSelesai: input.tanggalSelesai ?? mockKegiatan[idx].tanggalSelesai,
          keterangan: input.keterangan ?? mockKegiatan[idx].keterangan,
          updatedAt: new Date().toISOString(),
        };
        return Promise.resolve({ kegiatan: mockKegiatan[idx] });
      }
      return spjApi.updateKegiatan(id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(id) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useDeleteKegiatan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      if (USE_MOCK) {
        const idx = mockKegiatan.findIndex((k) => k.id === id);
        if (idx === -1) throw new Error("Kegiatan tidak ditemukan");
        mockKegiatan.splice(idx, 1);
        return Promise.resolve({ success: true });
      }
      return spjApi.deleteKegiatan(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUploadDokumen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UploadDokumenInput) => {
      if (USE_MOCK) {
        const dokumen: DokumenSpj = {
          id: `doc-${Date.now()}`,
          kegiatanId: input.kegiatanId,
          jenis: input.keterangan ?? "Dokumen",
          fileName: input.file.name,
          fileMimeType: input.file.type,
          fileSize: input.file.size,
          status: "terunggah",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "usr-mock",
        };
        mockDokumen.push(dokumen);
        return Promise.resolve({ dokumen });
      }
      return spjApi.uploadDokumen(input);
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: keys.dokumen(input.kegiatanId) });
      qc.invalidateQueries({ queryKey: keys.checklist(input.kegiatanId) });
      qc.invalidateQueries({ queryKey: keys.detail(input.kegiatanId) });
    },
  });
}

export function useTransitionKegiatan(kegiatanId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionInput) => {
      if (USE_MOCK) {
        const idx = mockKegiatan.findIndex((k) => k.id === kegiatanId);
        if (idx === -1) throw new Error("Kegiatan tidak ditemukan");
        const statusMap: Record<string, SpjStatus> = {
          ajukan: "diajukan",
          cek: "dicek_bendahara",
          verifikasi: "diverifikasi_sekretaris",
          setujui: "disetujui",
          tolak: "ditolak",
        };
        const statusBaru = statusMap[input.action] ?? mockKegiatan[idx].status;
        const entry: RiwayatSpj = {
          id: `hist-${Date.now()}`,
          dokumenId: kegiatanId,
          actorId: "usr-mock",
          actorNama: "Pengguna Mock",
          peran: "penghulu",
          statusLama: mockKegiatan[idx].status,
          statusBaru,
          action: input.action,
          catatan: input.catatan,
          createdAt: new Date().toISOString(),
        };
        mockKegiatan[idx].status = statusBaru;
        mockKegiatan[idx].updatedAt = new Date().toISOString();
        mockHistory.push(entry);
        return Promise.resolve({ kegiatan: mockKegiatan[idx], riwayat: entry });
      }
      return spjApi.transitionKegiatan(kegiatanId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.detail(kegiatanId) });
      qc.invalidateQueries({ queryKey: keys.history(kegiatanId) });
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

/** @deprecated Riwayat sudah digabung di level kegiatan; gunakan useKegiatanHistory. */
export function useDokumenHistory(_dokumenId: string) {
  return useQuery({
    queryKey: ["spj", "deprecated-history", _dokumenId],
    queryFn: async () => ({ items: [] as RiwayatSpj[] }),
  });
}

/** @deprecated Penghapusan dokumen belum didukung backend. */
export function useDeleteDokumen(_kegiatanId: string) {
  return useMutation({
    mutationFn: async (_id: string) => ({ success: true }),
  });
}

/** @deprecated Transisi sudah dipindahkan ke level kegiatan; gunakan useTransitionKegiatan. */
export function useTransitionDokumen(_dokumenId: string, kegiatanId: string) {
  return useTransitionKegiatan(kegiatanId);
}
