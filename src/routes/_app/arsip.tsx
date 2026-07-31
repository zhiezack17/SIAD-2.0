import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_app/arsip")({
  head: () => ({
    meta: [
      { title: "Arsip — SIAD 2.0" },
      { name: "description", content: "Pusat pencarian arsip lintas modul." },
      { property: "og:title", content: "Arsip — SIAD 2.0" },
      { property: "og:description", content: "Pusat pencarian arsip." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModuleStub
      title="Arsip"
      description="Pencarian arsip lintas modul — semua tersinkron ke Google Drive tenant."
      features={[
        "Full-text search (subjek, nomor, isi ringkas)",
        "Filter: jenis, tahun, status, PIC",
        "Retensi & Soft Delete (Pindah ke Sampah / Nonaktifkan)",
      ]}
    />
  ),
});
