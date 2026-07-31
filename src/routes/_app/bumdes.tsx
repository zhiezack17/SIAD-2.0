import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_app/bumdes")({
  head: () => ({
    meta: [
      { title: "BUMDes — SIAD 2.0" },
      { name: "description", content: "Dokumen dan laporan Badan Usaha Milik Desa." },
      { property: "og:title", content: "BUMDes — SIAD 2.0" },
      { property: "og:description", content: "Arsip BUMDes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModuleStub
      title="BUMDes"
      description="Dokumen usaha dan laporan keuangan Badan Usaha Milik Desa."
      features={[
        "Profil unit usaha",
        "Laporan keuangan bulanan/tahunan",
        "Dokumen legal (AD/ART, SK Pengurus)",
      ]}
    />
  ),
});
