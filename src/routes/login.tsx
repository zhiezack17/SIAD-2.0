import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: `Masuk — ${config.appName}` },
      { name: "description", content: "Masuk ke SIAD 2.0 untuk mengelola arsip kepenghuluan." },
      { property: "og:title", content: `Masuk — ${config.appName}` },
      { property: "og:description", content: "Halaman masuk SIAD 2.0." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await auth.login(username, password);
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Login gagal";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="bg-gradient-primary relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-primary-foreground">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.35)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold/30 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="bg-gradient-gold flex h-9 w-9 items-center justify-center rounded-lg font-bold text-gold-foreground shadow-gold">
            S
          </div>
          <div>
            <div className="font-semibold leading-none">{config.appName}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-80">
              Sistem Informasi Arsip Desa
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <ShieldCheck className="mb-6 h-8 w-8 text-gold" />
          <h2 className="font-display text-4xl leading-tight tracking-tight">
            Arsip aman, <span className="italic text-gold">pemerintahan tenang.</span>
          </h2>
          <p className="mt-4 text-primary-foreground/80">
            Masuk untuk mengelola surat, SPJ kegiatan, produk hukum, aset, dan
            BUMDes kepenghuluan Anda.
          </p>
        </div>

        <div className="relative text-xs opacity-70">
          © {new Date().getFullYear()} {config.appName}
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-background px-4 py-12">
        <Link
          to="/"
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="bg-gradient-primary shadow-elegant flex h-10 w-10 items-center justify-center rounded-lg font-bold text-primary-foreground">
              S
            </div>
          </div>

          <div>
            <h1 className="font-display text-3xl tracking-tight">Selamat datang kembali</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Masuk dengan kredensial dari admin kepenghuluan Anda.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Username</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                placeholder="admin"
                autoComplete="username"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Kata sandi</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40"
                autoComplete="current-password"
              />
            </label>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="bg-gradient-primary shadow-elegant inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Memproses…" : "Masuk"}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Endpoint API: <code className="rounded bg-muted px-1.5 py-0.5">{config.apiBaseUrl}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
