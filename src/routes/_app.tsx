import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import {
  LayoutDashboard,
  Mail,
  ClipboardCheck,
  Scale,
  Boxes,
  Building2,
  Archive,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayoutRoot,
});

function AppLayoutRoot() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/surat", label: "Surat", icon: Mail },
  { to: "/spj", label: "SPJ Kegiatan", icon: ClipboardCheck },
  { to: "/produk-hukum", label: "Produk Hukum", icon: Scale },
  { to: "/aset", label: "Aset", icon: Boxes },
  { to: "/bumdes", label: "BUMDes", icon: Building2 },
  { to: "/arsip", label: "Arsip", icon: Archive },
  { to: "/pengaturan", label: "Pengaturan", icon: Settings },
];

function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      navigate({ to: "/login" });
    }
  }, [auth.loading, auth.user, navigate]);

  // Tutup drawer setiap ganti route
  useEffect(() => setMobileOpen(false), [pathname]);

  if (auth.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Memuat…
      </div>
    );
  }

  if (!auth.user) return null;

  const Sidebar = (
    <>
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="bg-gradient-gold flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-gold-foreground shadow-gold">
          S
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">{config.appName}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest opacity-70">
            Arsip Desa
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")
              }
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-sidebar-primary" />
              )}
              <Icon
                className={
                  "h-4 w-4 shrink-0 " +
                  (active ? "text-sidebar-primary" : "opacity-70")
                }
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 text-[11px] opacity-60">
        {config.appTagline}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        {Sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-elegant">
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Buka menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {auth.tenant ? (
              <div className="relative">
                <select
                  value={auth.tenant.id}
                  onChange={(e) => auth.switchTenant(e.target.value)}
                  className="appearance-none rounded-lg border border-input bg-card py-1.5 pl-3 pr-8 text-sm font-medium shadow-soft focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
                >
                  {auth.user.tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Tidak ada kepenghuluan</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <div className="font-medium leading-tight">{auth.user.nama}</div>
              <div className="text-xs capitalize text-muted-foreground">
                {auth.user.peran.replace("_", " ")}
              </div>
            </div>
            <div className="bg-gradient-primary flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-elegant">
              {auth.user.nama.slice(0, 1).toUpperCase()}
            </div>
            <button
              onClick={() => {
                auth.logout();
                navigate({ to: "/login" });
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-sm hover:bg-accent"
              aria-label="Keluar"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
      </div>
    </div>
  );
}
