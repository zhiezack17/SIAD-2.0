/**
 * SIAD 2.0 — konfigurasi runtime frontend.
 *
 * Nilai diambil dari env Vite (VITE_*). Untuk dev, buat file `.env.local` di root.
 * Contoh:
 *   VITE_SIAD_API_BASE_URL=https://api.siad.example.id/v1
 *   VITE_SIAD_APP_NAME=SIAD 2.0
 */

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env ?? {};

export const config = {
  apiBaseUrl: env.VITE_SIAD_API_BASE_URL ?? "https://api.siad-v2.com/api",
  appName: env.VITE_SIAD_APP_NAME ?? "SIAD 2.0",
  appTagline: "Arsip Aman, Pemerintahan Tenang",
  // Google Drive: hanya id root folder yang publik; token & secret ada di VPS.
  driveRootFolderName: env.VITE_SIAD_DRIVE_ROOT ?? "SIAD",
} as const;

export type AppConfig = typeof config;
