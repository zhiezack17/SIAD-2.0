/**
 * Google Drive service — proxy via VPS.
 *
 * Prinsip: frontend TIDAK memegang kredensial Drive. Semua panggilan Drive
 * di-relay oleh VPS (yang menyimpan OAuth service account). Frontend hanya
 * memicu operasi lewat endpoint API SIAD.
 *
 * Konvensi folder:
 *   SIAD/                                (root, milik service account)
 *   └── <KODE_TENANT>-<NAMA>/            (auto-create saat onboarding)
 *       ├── Surat/
 *       │   ├── Masuk/YYYY/
 *       │   └── Keluar/YYYY/
 *       ├── SPJ/YYYY/<Bidang>/<Kegiatan>/
 *       ├── Produk-Hukum/YYYY/
 *       ├── Aset/
 *       ├── BUMDes/
 *       └── Arsip/
 */

import { api } from "./api-client";

export type DriveFolder = {
  id: string;
  name: string;
  path: string;
  webViewLink?: string;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  webContentLink?: string;
  createdAt: string;
};

export const drive = {
  /** Dipanggil sekali saat Kepenghuluan onboarding. */
  initTenantFolder: (tenantId: string) =>
    api.post<{ folder: DriveFolder }>("/drive/init-tenant", { tenantId }),

  /** List file dalam sebuah folder logis SIAD (bukan folderId Drive mentah). */
  listByContext: (context: {
    modul: "surat" | "spj" | "produk-hukum" | "aset" | "bumdes" | "arsip";
    tahun?: number;
    bidang?: string;
    kegiatan?: string;
  }) => api.get<{ files: DriveFile[] }>("/drive/list", { query: context }),

  /**
   * Upload file. FormData wajib berisi `file` (Blob) dan `context` (JSON string).
   * VPS akan membuat subfolder jika belum ada, lalu simpan.
   */
  upload: (form: FormData) => api.post<{ file: DriveFile }>("/drive/upload", form),

  /** Minta signed link sementara untuk unduh/preview. */
  getLink: (fileId: string) =>
    api.get<{ webViewLink: string; webContentLink: string }>(`/drive/link/${fileId}`),
};
