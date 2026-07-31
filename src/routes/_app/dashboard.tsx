import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  Mail,
  MailPlus,
  ClipboardCheck,
  Scale,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — SIAD 2.0" },
      {
        name: "description",
        content: "Ringkasan arsip, SPJ berjalan, dan aktivitas terbaru kepenghuluan.",
      },
      { property: "og:title", content: "Dashboard — SIAD 2.0" },
      { property: "og:description", content: "Ringkasan arsip kepenghuluan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const STATS = [
  { label: "Surat Masuk", sub: "Bulan ini", value: "—", icon: Mail, to: "/surat" },
  { label: "Surat Keluar", sub: "Bulan ini", value: "—", icon: MailPlus, to: "/surat" },
  {
    label: "SPJ Menunggu",
    sub: "Verifikasi",
    value: "—",
    icon: ClipboardCheck,
    to: "/spj",
    accent: true,
  },
  {
    label: "Produk Hukum",
    sub: "Terbit tahun ini",
    value: "—",
    icon: Scale,
    to: "/produk-hukum",
  },
];

function Dashboard() {
  const { user, tenant } = useAuth();

  return (
    <div className="space-y-8">
      {/* Hero card */}
      <div className="bg-gradient-primary shadow-elegant relative overflow-hidden rounded-2xl p-6 text-primary-foreground sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gold/25 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.4)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium backdrop-blur">
            <Sparkles className="h-3 w-3 text-gold" />
            Selamat datang kembali
          </div>
          <h1 className="font-display mt-4 text-3xl tracking-tight sm:text-4xl">
            Halo, {user?.nama}.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-primary-foreground/80">
            Kepenghuluan aktif:{" "}
            <span className="font-semibold text-gold">
              {tenant?.nama ?? "—"}
            </span>
            . Berikut ringkasan aktivitas arsip Anda hari ini.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              to={s.to}
              className="shadow-soft group relative overflow-hidden rounded-xl border border-border bg-card p-5 text-card-foreground transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex items-start justify-between">
                <div
                  className={
                    "flex h-10 w-10 items-center justify-center rounded-lg " +
                    (s.accent
                      ? "bg-gradient-gold text-gold-foreground shadow-gold"
                      : "bg-gradient-primary text-primary-foreground shadow-elegant")
                  }
                >
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-tight">
                {s.value}
              </div>
              <div className="mt-1 text-sm font-medium">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </Link>
          );
        })}
      </div>

      {/* Info card */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="font-semibold">Aktivitas Terbaru</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Feed aktivitas akan muncul di sini setelah ada surat masuk, SPJ, atau
            produk hukum baru yang tercatat.
          </p>
          <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada aktivitas.
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="font-semibold">Akses Cepat</h2>
          <div className="mt-4 space-y-2">
            {[
              { to: "/spj", label: "Input SPJ Kegiatan" },
              { to: "/surat", label: "Registrasi Surat" },
              { to: "/produk-hukum", label: "Daftar Produk Hukum" },
              { to: "/arsip", label: "Cari Arsip" },
            ].map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary hover:bg-accent"
              >
                {q.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
