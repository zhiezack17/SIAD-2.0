import { createServerFn } from "@tanstack/react-start";
import { getBackendBase, parseProxyInput, parseUploadInput } from "./siad-proxy.server";

export type ProxyResponse = {
  ok: boolean;
  status: number;
  body: string;
};

export const siadProxy = createServerFn({ method: "POST" })
  .inputValidator(parseProxyInput)
  .handler(async ({ data }): Promise<ProxyResponse> => {
    const base = getBackendBase();
    const url = new URL(
      `${base}${data.path.startsWith("/") ? data.path : `/${data.path}`}`,
    );
    if (data.query) {
      for (const [key, value] of Object.entries(data.query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (data.token) headers.Authorization = `Bearer ${data.token}`;

    const body =
      data.body !== undefined && data.body !== null ? JSON.stringify(data.body) : undefined;
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(url.toString(), {
      method: data.method,
      headers,
      body,
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  });

export const uploadDokumenSiad = createServerFn({ method: "POST" })
  .inputValidator(parseUploadInput)
  .handler(async ({ data }): Promise<ProxyResponse> => {
    const base = getBackendBase();
    const url = `${base}/spj/${encodeURIComponent(data.kegiatanId)}/dokumen/${encodeURIComponent(
      data.dokumenId,
    )}/upload`;

    const buffer = Buffer.from(data.fileBase64, "base64");
    const blob = new Blob([buffer], { type: data.fileMimeType });
    const form = new FormData();
    form.append("file", blob, data.fileName);

    const headers: Record<string, string> = {};
    if (data.token) headers.Authorization = `Bearer ${data.token}`;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: form,
    });

    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  });

