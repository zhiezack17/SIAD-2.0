import { z } from "zod";

const proxyInput = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  query: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]))
    .optional(),
  body: z.any().optional(),
  token: z.string().optional(),
});

const uploadInput = z.object({
  kegiatanId: z.string(),
  dokumenId: z.string(),
  fileBase64: z.string(),
  fileName: z.string(),
  fileMimeType: z.string(),
  token: z.string().optional(),
});

export type ProxyInput = z.infer<typeof proxyInput>;
export type UploadInput = z.infer<typeof uploadInput>;

export function parseProxyInput(data: unknown): ProxyInput {
  return proxyInput.parse(data);
}

export function parseUploadInput(data: unknown): UploadInput {
  return uploadInput.parse(data);
}

export function getBackendBase(): string {
  return (
    process.env.SIAD_API_BASE_URL ??
    ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SIAD_API_BASE_URL) ??
    "https://api.siad-v2.com/api"
  ).replace(/\/$/, "");
}