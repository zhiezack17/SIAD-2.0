import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Scale,
  FileText,
  Calendar,
  Loader2,
  MoreHorizontal,
  Trash2,
  CheckCircle2,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateProdukHukum,
  useDeleteProdukHukum,
  useProdukHukumList,
  useUpdateProdukHukumStatus,
} from "@/hooks/use-produk-hukum";
import {
  JENIS_OPTIONS,
  isProdukHukumMockMode,
  jenisLabel,
  jenisShort,
  statusLabel,
  statusVariant,
  type JenisProdukHukum,
  type ProdukHukum,
  type StatusProdukHukum,
} from "@/lib/produk-hukum";
import { formatDate } from "@/lib/formatting";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/produk-hukum")({
  head: () => ({
    meta: [
      { title: "Produk Hukum — SIAD 2.0" },
      {
        name: "description",
        content:
          "Peraturan Kepenghuluan, Peraturan/Keputusan/Instruksi Penghulu — terarsip rapi dengan status hukum yang jelas.",
      },
      { property: "og:title", content: "Produk Hukum — SIAD 2.0" },
      {
        property: "og:description",
        content: "Arsip produk hukum kepenghuluan dengan status hukum yang jelas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProdukHukumPage,
});

function ProdukHukumPage() {
  const auth = useAuth();
  const [q, setQ] = useState("");
  const [jenisFilter, setJenisFilter] = useState<JenisProdukHukum | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusProdukHukum | "all">("all");
  const [tahunFilter, setTahunFilter] = useState<number | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useProdukHukumList({
    q: q || undefined,
    jenis: jenisFilter === "all" ? undefined : jenisFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    tahun: tahunFilter === "all" ? undefined : tahunFilter,
  });

  const items = data?.items ?? [];
  const tahunOptions = useMemo(() => {
    const s = new Set<number>();
    items.forEach((i) => s.add(i.tahun));
    return Array.from(s).sort((a, b) => b - a);
  }, [items]);

  const canCreate = ["super_admin", "admin", "operator", "penghulu"].includes(
    auth.user?.peran ?? "",
  );

  // Stats
  const total = items.length;
  const totalDiundangkan = items.filter((i) => i.status === "diundangkan").length;
  const totalDraft = items.filter((i) => i.status === "draft").length;
  const totalDicabut = items.filter((i) => i.status === "dicabut").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Produk Hukum</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Peraturan, Keputusan, dan Instruksi Penghulu — dengan status hukum yang
            jelas.
          </p>
        </div>

        {canCreate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-elegant gap-1.5 text-primary-foreground hover:opacity-95">
                <Plus className="h-4 w-4" />
                Registrasi Produk Hukum
              </Button>
            </DialogTrigger>
            <CreateProdukHukumDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

      {isProdukHukumMockMode() && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-foreground" />
          <div>
            Modul ini masih menggunakan data contoh (mock) di sisi browser. Data
            akan otomatis tersambung ke database VPS setelah endpoint{" "}
            <code className="rounded bg-muted px-1">/produk-hukum</code>{" "}
            dinyalakan.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total", value: total, icon: Scale, tone: "primary" as const },
          {
            label: "Diundangkan",
            value: totalDiundangkan,
            icon: CheckCircle2,
            tone: "gold" as const,
          },
          { label: "Draft", value: totalDraft, icon: FileText, tone: "muted" as const },
          {
            label: "Dicabut",
            value: totalDicabut,
            icon: Trash2,
            tone: "muted" as const,
          },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="shadow-soft flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-semibold tracking-tight">
                  {s.value}
                </div>
              </div>
              <div
                className={
                  "flex h-10 w-10 items-center justify-center rounded-lg " +
                  (s.tone === "gold"
                    ? "bg-gradient-gold text-gold-foreground shadow-gold"
                    : s.tone === "primary"
                    ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                    : "bg-muted text-muted-foreground")
                }
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="shadow-soft flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari judul, tentang, atau nomor…"
            className="pl-9"
          />
        </div>

        <Select
          value={jenisFilter}
          onValueChange={(v) => setJenisFilter(v as JenisProdukHukum | "all")}
        >
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Semua jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua jenis</SelectItem>
            {JENIS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusProdukHukum | "all")}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="ditetapkan">Ditetapkan</SelectItem>
            <SelectItem value="diundangkan">Diundangkan</SelectItem>
            <SelectItem value="dicabut">Dicabut</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={tahunFilter === "all" ? "all" : String(tahunFilter)}
          onValueChange={(v) => setTahunFilter(v === "all" ? "all" : Number(v))}
        >
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tahun</SelectItem>
            {tahunOptions.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Memuat…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Scale className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Belum ada produk hukum</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Registrasikan Peraturan, Keputusan, atau Instruksi Penghulu pertama Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <ProdukHukumCard key={p.id} item={p} canManage={canCreate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProdukHukumCard({
  item,
  canManage,
}: {
  item: ProdukHukum;
  canManage: boolean;
}) {
  const updateStatus = useUpdateProdukHukumStatus();
  const remove = useDeleteProdukHukum();

  async function changeStatus(status: StatusProdukHukum) {
    try {
      await updateStatus.mutateAsync({ id: item.id, status });
      toast.success(`Status diubah menjadi "${statusLabel(status)}"`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal mengubah status";
      toast.error(msg);
    }
  }

  async function onDelete() {
    if (!confirm(`Hapus "${item.judul}"?`)) return;
    try {
      await remove.mutateAsync(item.id);
      toast.success("Produk hukum dihapus");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus";
      toast.error(msg);
    }
  }

  return (
    <div className="shadow-soft group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-elegant sm:flex-row sm:items-center sm:gap-4">
      <div className="bg-gradient-primary shadow-elegant flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold tracking-wider text-primary-foreground">
        {jenisShort(item.jenis)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {jenisLabel(item.jenis)}
          </span>
          <span className="text-xs text-muted-foreground">
            No. {item.nomor}/{item.tahun}
          </span>
          <Badge variant={statusVariant(item.status)}>
            {statusLabel(item.status)}
          </Badge>
        </div>
        <div className="mt-1 truncate font-semibold">{item.tentang}</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {item.tanggalDitetapkan && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Ditetapkan {formatDate(item.tanggalDitetapkan)}
            </span>
          )}
          {item.tanggalDiundangkan && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Diundangkan {formatDate(item.tanggalDiundangkan)}
            </span>
          )}
          {item.ditetapkanOleh && (
            <span>
              oleh <span className="font-medium text-foreground">{item.ditetapkanOleh}</span>
            </span>
          )}
        </div>
      </div>

      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Aksi">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ubah status</DropdownMenuLabel>
            {(["draft", "ditetapkan", "diundangkan", "dicabut"] as StatusProdukHukum[]).map(
              (s) => (
                <DropdownMenuItem
                  key={s}
                  disabled={s === item.status}
                  onClick={() => changeStatus(s)}
                >
                  {statusLabel(s)}
                </DropdownMenuItem>
              ),
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function CreateProdukHukumDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const create = useCreateProdukHukum();

  const [jenis, setJenis] = useState<JenisProdukHukum>("keputusan_penghulu");
  const [nomor, setNomor] = useState("");
  const [tahun, setTahun] = useState<number>(new Date().getFullYear());
  const [tentang, setTentang] = useState("");
  const [tanggalDitetapkan, setTanggalDitetapkan] = useState("");
  const [tanggalDiundangkan, setTanggalDiundangkan] = useState("");
  const [ditetapkanOleh, setDitetapkanOleh] = useState(auth.user?.nama ?? "");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nomor.trim() || !tentang.trim()) {
      toast.error("Nomor dan Tentang wajib diisi");
      return;
    }
    const judul = `${jenisLabel(jenis)} Nomor ${nomor} Tahun ${tahun}`;
    try {
      await create.mutateAsync({
        jenis,
        nomor: nomor.trim(),
        tahun,
        judul,
        tentang: tentang.trim(),
        tanggalDitetapkan: tanggalDitetapkan || undefined,
        tanggalDiundangkan: tanggalDiundangkan || undefined,
        ditetapkanOleh: ditetapkanOleh || undefined,
        jabatan: auth.user?.peran === "penghulu" ? "Penghulu" : undefined,
      });
      toast.success("Produk hukum tersimpan");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      toast.error(msg);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Registrasi Produk Hukum</DialogTitle>
        <DialogDescription>
          Catat Peraturan, Keputusan, atau Instruksi Penghulu ke dalam arsip.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Jenis</Label>
          <Select value={jenis} onValueChange={(v) => setJenis(v as JenisProdukHukum)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JENIS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nomor</Label>
            <Input
              value={nomor}
              onChange={(e) => setNomor(e.target.value)}
              placeholder="01"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tahun</Label>
            <Input
              type="number"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tentang</Label>
          <Textarea
            value={tentang}
            onChange={(e) => setTentang(e.target.value)}
            placeholder="Contoh: Pembentukan Tim Pelaksana Kegiatan Pembangunan Drainase"
            rows={3}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Tanggal Ditetapkan</Label>
            <Input
              type="date"
              value={tanggalDitetapkan}
              onChange={(e) => setTanggalDitetapkan(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tanggal Diundangkan</Label>
            <Input
              type="date"
              value={tanggalDiundangkan}
              onChange={(e) => setTanggalDiundangkan(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Ditetapkan oleh</Label>
          <Input
            value={ditetapkanOleh}
            onChange={(e) => setDitetapkanOleh(e.target.value)}
            placeholder="Nama pejabat penetap"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={create.isPending}
            className="bg-gradient-primary text-primary-foreground"
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
