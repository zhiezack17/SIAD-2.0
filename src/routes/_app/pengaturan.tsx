import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/module-stub";

export const Route = createFileRoute("/_app/pengaturan")({
  head: () => ({
    meta: [
      { title: "Pengaturan — SIAD 2.0" },
      { name: "description", content: "Pengaturan kepenghuluan, pengguna, dan integrasi." },
      { property: "og:title", content: "Pengaturan — SIAD 2.0" },
      { property: "og:description", content: "Pengaturan SIAD 2.0." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <ModuleStub
      title="Pengaturan"
      description="Profil kepenghuluan, perangkat/pengguna, dan integrasi."
      features={[
        "Data kepenghuluan (kode, alamat, kop)",
        "Manajemen perangkat (Penghulu, Sekretaris, Bendahara, Kaur, Kasi)",
        "Status integrasi Google Drive dan VPS",
      ]}
    />
  ),
});
