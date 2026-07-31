import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Boxes,
  Wrench,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  Trash2,
  Info,
  FileText,
  Package,
  MapPin,
  Calendar,
  Pencil,
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
  useAsetList,
  useCreateAset,
  useDeleteAset,
  useMutasiAset,
  useUpdateAset,
} from "@/hooks/use-aset";
import {
  ASAL_USUL_OPTIONS,
  KONDISI_OPTIONS,
  STATUS_OPTIONS,
  SUMBER_DANA_OPTIONS,
  fileToBase64,
  isAsetMockMode,
  kondisiLabel,
  kondisiVariant,
  statusLabel,
  statusVariant,
  type Aset,
  type KondisiAset,
  type StatusAset,
} from "@/lib/aset";
import { formatCurrency, formatDate } from "@/lib/formatting";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/aset")({
  head: () => ({
    meta: [
      { title: "Aset — SIAD 2.0" },
      {
        name: "description",
        content:
          "Inventaris barang milik kepenghuluan: kondisi, lokasi, mutasi, dan dokumen bukti perolehan.",
      },
      { property: "og:title", content: "Aset — SIAD 2.0" },
      {
        property: "og:description",
        content: "Inventaris barang milik kepenghuluan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AsetPage,
});

function AsetPage() {
  const auth = useAuth();
  const [q, setQ] = useState("");
  const [kondisiFilter, setKondisiFilter] = useState<KondisiAset | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusAset | "all">("all");
  const [tahunFilter, setTahunFilter] = useState<number | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useAsetList({
    q: q || undefined,
    kondisi: kondisiFilter === "all" ? undefined : kondisiFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    tahun: tahunFilter === "all" ? undefined : tahunFilter,
  });

  const items = data?.items ?? [];
  const tahunOptions = useMemo(() => {
    const s = new Set<number>();
    items.forEach((i) => {
      if (i.tahunPerolehan) s.add(i.tahunPerolehan);
    });
    return Array.from(s).sort((a, b) => b - a);
  }, [items]);

  const canCreate = ["super_admin", "admin", "operator", "penghulu"].includes(
    auth.user?.peran ?? "",
  );

  const total = items.length;
  const totalAktif = items.filter((i) => i.status === "aktif").length;
  const totalNilai = items.reduce((sum, i) => sum + (i.nilaiPerolehan || 0), 0);
  const totalRusak = items.filter((i) => i.kondisi === "rusak_berat" || i.kondisi === "tidak_dapat_digunakan").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Aset Kepenghuluan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inventaris barang milik desa dengan kondisi, lokasi, dan riwayat mutasi.
          </p>
        </div>

        {canCreate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary shadow-elegant gap-1.5 text-primary-foreground hover:opacity-95">
                <Plus className="h-4 w-4" />
                Tambah Aset
              </Button>
            </DialogTrigger>
            <AsetFormDialog onClose={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

      {isAsetMockMode() && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold-foreground" />
          <div>
            Modul ini masih menggunakan data contoh (mock) di sisi browser. Data
            akan otomatis tersambung ke database VPS setelah endpoint{" "}
            <code className="rounded bg-muted px-1">/aset</code>{" "}
            dinyalakan.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Aset", value: total, icon: Boxes, tone: "primary" as const },
          {
            label: "Aktif",
            value: totalAktif,
            icon: CheckCircle2,
            tone: "gold" as const,
          },
          {
            label: "Total Nilai",
            value: formatCurrency(totalNilai),
            icon: Package,
            tone: "muted" as const,
          },
          {
            label: "Rusak / Tidak Dapat Digunakan",
            value: totalRusak,
            icon: Wrench,
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
            placeholder="Cari kode, nama, atau lokasi…"
            className="pl-9"
          />
        </div>

        <Select
          value={kondisiFilter}
          onValueChange={(v) => setKondisiFilter(v as KondisiAset | "all")}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Semua kondisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua kondisi</SelectItem>
            {KONDISI_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusAset | "all")}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
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
          <Boxes className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 font-semibold">Belum ada aset</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Tambahkan inventaris barang milik kepenghuluan pertama Anda.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AsetCard key={item.id} item={item} canManage={canCreate} />
          ))}
        </div>
      )}
    </div>
  );
}

function AsetCard({ item, canManage }: { item: Aset; canManage: boolean }) {
  const [editOpen, setEditOpen] = useState(false);
  const [mutasiOpen, setMutasiOpen] = useState(false);
  const remove = useDeleteAset();

  async function onDelete() {
    if (!confirm(`Hapus aset "${item.nama}"?`)) return;
    try {
      await remove.mutateAsync(item.id);
      toast.success("Aset dihapus");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal menghapus";
      toast.error(msg);
    }
  }

  return (
    <div className="shadow-soft group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-elegant sm:flex-row sm:items-start sm:gap-4">
      <div className="bg-gradient-primary shadow-elegant flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-primary-foreground">
        <Boxes className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            {item.kode}
          </span>
          <Badge variant={kondisiVariant(item.kondisi)}>
            {kondisiLabel(item.kondisi)}
          </Badge>
          <Badge variant={statusVariant(item.status)}>
            {statusLabel(item.status)}
          </Badge>
        </div>
        <div className="mt-1 font-semibold">{item.nama}</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {item.merk && <span className="mr-2">{item.merk}</span>}
          {item.tipe && <span className="mr-2">{item.tipe}</span>}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Package className="h-3 w-3" />
            {item.jumlah} {item.satuan}
          </span>
          {item.tahunPerolehan && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Tahun {item.tahunPerolehan}
            </span>
          )}
          {item.lokasi && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.lokasi}
            </span>
          )}
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            {formatCurrency(item.nilaiPerolehan)}
          </span>
          {item.fileName && (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {item.fileName}
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
            <DropdownMenuLabel>Kelola Aset</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMutasiOpen(true)}>
              <ArrowRightLeft className="mr-2 h-3.5 w-3.5" />
              Mutasi / Status
            </DropdownMenuItem>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <AsetFormDialog aset={item} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={mutasiOpen} onOpenChange={setMutasiOpen}>
        <MutasiDialog aset={item} onClose={() => setMutasiOpen(false)} />
      </Dialog>
    </div>
  );
}

function AsetFormDialog({ aset, onClose }: { aset?: Aset; onClose: () => void }) {
  const auth = useAuth();
  const create = useCreateAset();
  const update = useUpdateAset();
  const isEdit = !!aset;

  const [kode, setKode] = useState(aset?.kode ?? "");
  const [nama, setNama] = useState(aset?.nama ?? "");
  const [merk, setMerk] = useState(aset?.merk ?? "");
  const [tipe, setTipe] = useState(aset?.tipe ?? "");
  const [ukuran, setUkuran] = useState(aset?.ukuran ?? "");
  const [bahan, setBahan] = useState(aset?.bahan ?? "");
  const [tahunPerolehan, setTahunPerolehan] = useState<number | undefined>(
    aset?.tahunPerolehan ?? new Date().getFullYear(),
  );
  const [kondisi, setKondisi] = useState<KondisiAset>(aset?.kondisi ?? "baik");
  const [jumlah, setJumlah] = useState<number>(aset?.jumlah ?? 1);
  const [satuan, setSatuan] = useState(aset?.satuan ?? "unit");
  const [hargaSatuan, setHargaSatuan] = useState<number>(aset?.hargaSatuan ?? 0);
  const [nilaiPerolehan, setNilaiPerolehan] = useState<number>(
    aset?.nilaiPerolehan ?? 0,
  );
  const [sumberDana, setSumberDana] = useState(aset?.sumberDana ?? "APBDes");
  const [asalUsul, setAsalUsul] = useState(aset?.asalUsul ?? "Pembelian");
  const [lokasi, setLokasi] = useState(aset?.lokasi ?? "");
  const [keterangan, setKeterangan] = useState(aset?.keterangan ?? "");
  const [status, setStatus] = useState<StatusAset>(aset?.status ?? "aktif");
  const [file, setFile] = useState<File | null>(null);

  function recalcNilai(j: number, h: number) {
    setNilaiPerolehan(j * h);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!kode.trim() || !nama.trim()) {
      toast.error("Kode dan nama aset wajib diisi");
      return;
    }

    let fileBase64: string | undefined;
    let fileName: string | undefined;
    if (file) {
      fileBase64 = await fileToBase64(file);
      fileName = file.name;
    }

    const input = {
      kepenghuluanId: auth.tenant?.id,
      kode: kode.trim(),
      nama: nama.trim(),
      merk: merk.trim() || undefined,
      tipe: tipe.trim() || undefined,
      ukuran: ukuran.trim() || undefined,
      bahan: bahan.trim() || undefined,
      tahunPerolehan,
      kondisi,
      jumlah,
      satuan: satuan.trim() || "unit",
      hargaSatuan,
      nilaiPerolehan,
      sumberDana: sumberDana || undefined,
      asalUsul: asalUsul || undefined,
      lokasi: lokasi.trim() || undefined,
      keterangan: keterangan.trim() || undefined,
      status,
      fileBase64,
      fileName,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id: aset.id, input });
        toast.success("Aset diperbarui");
      } else {
        await create.mutateAsync(input);
        toast.success("Aset tersimpan");
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      toast.error(msg);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Aset" : "Tambah Aset"}</DialogTitle>
        <DialogDescription>
          Catat inventaris barang milik kepenghuluan beserta kondisi dan nilainya.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Kode Aset</Label>
            <Input
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              placeholder="Contoh: KUR-001"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nama Aset</Label>
            <Input
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Kursi Kayu"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Merk</Label>
            <Input
              value={merk}
              onChange={(e) => setMerk(e.target.value)}
              placeholder="Merk/brand"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tipe/Model</Label>
            <Input
              value={tipe}
              onChange={(e) => setTipe(e.target.value)}
              placeholder="Model/seri"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Ukuran</Label>
            <Input
              value={ukuran}
              onChange={(e) => setUkuran(e.target.value)}
              placeholder="Ukuran barang"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Bahan</Label>
            <Input
              value={bahan}
              onChange={(e) => setBahan(e.target.value)}
              placeholder="Bahan utama"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Tahun Perolehan</Label>
            <Input
              type="number"
              value={tahunPerolehan ?? ""}
              onChange={(e) => setTahunPerolehan(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Tahun"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Kondisi</Label>
            <Select value={kondisi} onValueChange={(v) => setKondisi(v as KondisiAset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KONDISI_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusAset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Jumlah</Label>
            <Input
              type="number"
              min={1}
              value={jumlah}
              onChange={(e) => {
                const j = Number(e.target.value) || 1;
                setJumlah(j);
                recalcNilai(j, hargaSatuan);
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Satuan</Label>
            <Input
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
              placeholder="unit, buah, set, dll"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Harga Satuan</Label>
            <Input
              type="number"
              min={0}
              value={hargaSatuan}
              onChange={(e) => {
                const h = Number(e.target.value) || 0;
                setHargaSatuan(h);
                recalcNilai(jumlah, h);
              }}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nilai Perolehan</Label>
            <Input
              type="number"
              min={0}
              value={nilaiPerolehan}
              onChange={(e) => setNilaiPerolehan(Number(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">Diisi otomatis jumlah × harga satuan.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Lokasi</Label>
            <Input
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Ruang kantor / gudang / dll"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Sumber Dana</Label>
            <Select value={sumberDana} onValueChange={setSumberDana}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUMBER_DANA_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Asal Usul</Label>
            <Select value={asalUsul} onValueChange={setAsalUsul}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASAL_USUL_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Keterangan</Label>
          <Textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Catatan tambahan tentang aset"
            rows={2}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Dokumen Bukti Perolehan (nota/BAST/dll)</Label>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground">
            {aset?.fileName ? `Dokumen saat ini: ${aset.fileName}` : "Kosongkan jika tidak ingin mengganti dokumen."}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={create.isPending || update.isPending}
            className="bg-gradient-primary text-primary-foreground hover:opacity-95"
          >
            {(create.isPending || update.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {isEdit ? "Simpan Perubahan" : "Simpan Aset"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MutasiDialog({ aset, onClose }: { aset: Aset; onClose: () => void }) {
  const auth = useAuth();
  const mutasi = useMutasiAset();

  const [status, setStatus] = useState<StatusAset>(aset.status);
  const [kondisi, setKondisi] = useState<KondisiAset>(aset.kondisi);
  const [lokasi, setLokasi] = useState(aset.lokasi ?? "");
  const [pj, setPj] = useState(auth.user?.nama ?? "");
  const [catatan, setCatatan] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await mutasi.mutateAsync({
        id: aset.id,
        input: {
          status,
          kondisi,
          lokasi: lokasi.trim() || undefined,
          pj: pj.trim() || undefined,
          catatan: catatan.trim() || undefined,
        },
      });
      toast.success("Mutasi/status aset diperbarui");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      toast.error(msg);
    }
  }

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Mutasi / Ubah Status</DialogTitle>
        <DialogDescription>
          Catat perubahan status, kondisi, atau lokasi aset "{aset.nama}".
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusAset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Kondisi</Label>
            <Select value={kondisi} onValueChange={(v) => setKondisi(v as KondisiAset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KONDISI_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Lokasi Baru</Label>
          <Input
            value={lokasi}
            onChange={(e) => setLokasi(e.target.value)}
            placeholder="Lokasi terbaru aset"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Penanggung Jawab (PJ)</Label>
          <Input
            value={pj}
            onChange={(e) => setPj(e.target.value)}
            placeholder="Nama penanggung jawab"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Catatan</Label>
          <Textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Alasan mutasi / keterangan perubahan"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={mutasi.isPending}
            className="bg-gradient-primary text-primary-foreground hover:opacity-95"
          >
            {mutasi.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Mutasi
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
