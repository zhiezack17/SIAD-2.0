import { config } from "./config";
import { siadProxy, uploadDokumenSiad } from "./siad-proxy.functions";

/**
 * Klien HTTP terpusat untuk memanggil API SIAD di VPS.
 * Semua modul WAJIB pakai ini — jangan panggil fetch() langsung dari komponen.
 *
 * Permintaan ke VPS tidak langsung dari browser (terhindar dari masalah mixed-content
 * dan CORS), melainkan melalui server function `siadProxy` yang berjalan di server
 * Lovable dan meneruskan request ke backend VPS.
 */

export type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const TOKEN_KEY = "siad.token";
const TENANT_KEY = "siad.tenant";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getStoredToken(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (!isBrowser()) return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getStoredTenant(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(TENANT_KEY);
}

export function setStoredTenant(tenantId: string | null): void {
  if (!isBrowser()) return;
  if (tenantId) window.localStorage.setItem(TENANT_KEY, tenantId);
  else window.localStorage.removeItem(TENANT_KEY);
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = config.apiBaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`, "http://placeholder");
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  // Return absolute if apiBaseUrl was absolute; otherwise relative.
  if (config.apiBaseUrl.startsWith("http")) return url.toString();
  return `${url.pathname}${url.search}`;
}

function parseProxyBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    if ("message" in payload) return String((payload as { message: unknown }).message);
    if ("error" in payload) return String((payload as { error: unknown }).error);
  }
  if (typeof payload === "string" && payload.trim()) return payload;
  return fallback;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const token = getStoredToken();

  // Upload file: kirim via server function khusus agar file bisa diteruskan ke VPS.
  if (options.body instanceof FormData) {
    const kegiatanId = options.body.get("kegiatanId") as string | null;
    const dokumenId = options.body.get("dokumenId") as string | null;
    const file = options.body.get("file") as File | null;
    if (!kegiatanId || !dokumenId || !file) {
      throw new Error("Upload memerlukan kegiatanId, dokumenId, dan file");
    }
    const dataUrl = await readFileAsDataURL(file);
    const base64 = dataUrl.split(",")[1] ?? "";
    const res = await uploadDokumenSiad({
      data: {
        kegiatanId,
        dokumenId,
        fileBase64: base64,
        fileName: file.name,
        fileMimeType: file.type,
        token: token ?? undefined,
      },
    });
    const payload = parseProxyBody(res.body);
    if (!res.ok) {
      const err: ApiError = {
        status: res.status,
        message: getApiErrorMessage(payload, `Upload gagal (HTTP ${res.status})`),
        details: payload,
      };
      throw err;
    }
    return payload as T;
  }

  const res = await siadProxy({
    data: {
      method: options.method ?? "GET",
      path,
      query: options.query,
      body: options.body,
      token: token ?? undefined,
    },
  });
  const payload = parseProxyBody(res.body);

  if (!res.ok) {
    const err: ApiError = {
      status: res.status,
      message: getApiErrorMessage(payload, `Permintaan gagal (HTTP ${res.status})`),
      code:
        payload && typeof payload === "object" && "code" in payload
          ? String((payload as { code: unknown }).code)
          : undefined,
      details: payload,
    };
    throw err;
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method">) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
};
