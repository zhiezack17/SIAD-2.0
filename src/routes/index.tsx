import { createFileRoute, Link } from "@tanstack/react-router";
import { config } from "@/lib/config";
import {
  ShieldCheck,
  FileText,
  Landmark,
  Boxes,
  Building2,
  Archive,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SIAD 2.0 — Arsip Aman, Pemerintahan Tenang" },
      {
        name: "description",
        content:
          "Platform arsip digital pemerintahan kepenghuluan/desa: kelola surat, SPJ, produk hukum, aset, dan BUMDes secara aman dan terlacak.",
      },
      { property: "og:title", content: "SIAD 2.0 — Arsip Aman, Pemerintahan Tenang" },
      {
        property: "og:description",
        content:
          "Platform arsip digital pemerintahan kepenghuluan/desa dengan alur verifikasi SPJ bertingkat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const MODULES = [
  {
    icon: FileText,
    t: "Surat Masuk & Keluar",
    d: "Registrasi, disposisi berjenjang, dan pencarian kilat.",
  },
  {
    icon: ShieldCheck,
    t: "SPJ Kegiatan",
    d: "Alur Kaur → Bendahara → Sekretaris → Penghulu, bersih dari temuan sepele.",
  },
  {
    icon: Landmark,
    t: "Produk Hukum",
    d: "Peraturan, Keputusan, dan Instruksi Penghulu — terarsip rapi & terlacak.",
  },
  {
    icon: Boxes,
    t: "Aset Kepenghuluan",
    d: "Inventaris barang milik desa lengkap dengan bukti dokumen.",
  },
  {
    icon: Building2,
    t: "BUMDes",
    d: "Dokumen usaha & laporan keuangan unit BUMDes.",
  },
  {
    icon: Archive,
    t: "Arsip Terpusat",
    d: "Semua dokumen tersinkron ke Google Drive per kepenghuluan.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-primary flex h-9 w-9 items-center justify-center rounded-lg font-bold text-primary-foreground shadow-elegant">
              S
            </div>
            <div>
              <div className="font-semibold leading-none">{config.appName}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Sistem Informasi Arsip Desa
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Masuk
            </Link>
            <Link
              to="/dashboard"
              className="bg-gradient-primary shadow-elegant inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Buka Aplikasi
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-gradient-hero relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_1px_1px,var(--color-border)_1px,transparent_0)] [background-size:24px_24px]" />
          <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" />
                Versi 2.0 · Rilis 2026
              </span>
              <h1 className="font-display mt-6 text-5xl leading-[1.05] tracking-tight sm:text-7xl">
                Arsip Aman,
                <br />
                <span className="italic text-primary">Pemerintahan Tenang.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Platform arsip digital untuk pemerintahan kepenghuluan & desa —
                Surat, SPJ Kegiatan, Produk Hukum, Aset, hingga BUMDes — dalam satu
                dasbor, dengan verifikasi bertingkat yang meredam temuan pemeriksaan.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="bg-gradient-primary shadow-elegant inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                >
                  Masuk ke SIAD
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#modul"
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-sm font-semibold hover:bg-accent"
                >
                  Lihat modul
                </a>
              </div>

              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
                {[
                  "Multi-tenant per kepenghuluan",
                  "Terhubung Google Drive",
                  "Alur SPJ berjenjang",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section id="modul" className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">
              Modul
            </div>
            <h2 className="font-display mt-2 text-4xl tracking-tight sm:text-5xl">
              Semua perangkat, satu ruang kerja.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Dirancang berdasarkan pengalaman auditor daerah — setiap modul
              menutup celah temuan sepele di pemerintahan kepenghuluan.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div
                key={m.t}
                className="shadow-soft group relative overflow-hidden rounded-xl border border-border bg-card p-6 text-card-foreground transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <div className="bg-gradient-primary shadow-elegant mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg text-primary-foreground">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{m.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {m.d}
                </p>
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gold/0 blur-2xl transition-all group-hover:bg-gold/20" />
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            © {new Date().getFullYear()} {config.appName} — {config.appTagline}
          </div>
          <div className="text-xs">Dibangun untuk kepenghuluan & pemerintahan desa.</div>
        </div>
      </footer>
    </div>
  );
}
