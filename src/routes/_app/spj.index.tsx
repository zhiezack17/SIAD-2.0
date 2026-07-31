import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  FolderKanban,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useKegiatanList, useCreateKegiatan, useMasterKegiatan } from "@/hooks/use-spj";
import { statusLabel, statusVariant, type SpjStatus, type SpjBidang } from "@/lib/spj";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/formatting";

export const Route = createFileRoute("/_app/spj/")({
  head: () => ({
    meta: [
      { title: "SPJ Kegiatan — SIAD 2.0" },
      { name: "description", content: "Kelola Surat Pertanggungjawaban kegiatan dengan verifikasi berjenjang." },
      { property: "og:title", content: "SPJ Kegiatan — SIAD 2.0" },
      { property: "og:description", content: "Alur verifikasi SPJ Kaur → Bendahara → Sekretaris → Penghulu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpjIndexPage,
});

function SpjIndexPage() {
  const auth = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<SpjStatus | "all">("all");
  const [tahunFilter, setTahunFilter] = useState<number | "all">("all");
  const [bidangFilter, setBidangFilter] = useState<SpjBidang | "all">("all");

  const { data, isLoading } = useKegiatanList({
    q: q || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    tahun: tahunFilter === "all" ? undefined : tahunFilter,
    bidang: bidangFilter === "all" ? undefined : bidangFilter,
  });

  const items = data?.items ?? [];
  const canCreate = ["super_admin", "kaur", "operator", "penghulu"].includes(auth.user?.peran ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SPJ Kegiatan</h1>
          <p className="text-sm text-muted-foreground">
            Alur verifikasi berjenjang: Kaur → Bendahara → Sekretaris → Penghulu.
          </p>
        </div>
        {canCreate && <NewKegiatanDialog />}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau nama kegiatan…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SpjStatus | "all")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="diajukan">Diajukan</SelectItem>
              <SelectItem value="dicek_bendahara">Dicek Bendahara</SelectItem>
              <SelectItem value="diverifikasi_sekretaris">Diverifikasi Sekretaris</SelectItem>
              <SelectItem value="disetujui">Disetujui</SelectItem>
              <SelectItem value="ditolak">Ditolak</SelectItem>
            </SelectContent>
          </Select>

          <Select value={String(tahunFilter)} onValueChange={(v) => setTahunFilter(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tahun</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2023">2023</SelectItem>
            </SelectContent>
          </Select>

          <Select value={bidangFilter} onValueChange={(v) => setBidangFilter(v as SpjBidang | "all")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Bidang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua bidang</SelectItem>
              <SelectItem value="Pemerintahan">Pemerintahan</SelectItem>
              <SelectItem value="Kesejahteraan">Kesejahteraan</SelectItem>
              <SelectItem value="Pelayanan">Pelayanan</SelectItem>
              <SelectItem value="Ketentraman">Ketentraman</SelectItem>
              <SelectItem value="Pemberdayaan">Pemberdayaan</SelectItem>
              <SelectItem value="Lainnya">Lainnya</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode / Nama</TableHead>
              <TableHead>Tahun</TableHead>
              <TableHead>Anggaran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Kelengkapan</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Memuat kegiatan…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <FolderKanban className="mx-auto h-8 w-8 opacity-50" />
                  <p className="mt-2">Belum ada kegiatan SPJ.</p>
                  {canCreate && <p className="text-xs">Klik "Kegiatan Baru" untuk mulai.</p>}
                </TableCell>
              </TableRow>
            ) : (
              items.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <div className="font-medium">{k.kode}</div>
                    <div className="text-sm text-muted-foreground">{k.nama}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDate(k.tanggalMulai)} – {formatDate(k.tanggalSelesai)}
                    </div>
                  </TableCell>
                  <TableCell>{k.tahun}</TableCell>
                  <TableCell>{formatCurrency(k.anggaran)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(k.status)}>{statusLabel(k.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="w-full max-w-[140px]">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{k.progress?.ada ?? 0}/{k.progress?.wajib ?? 0} dokumen</span>
                      </div>
                      <Progress
                        value={
                          k.progress && k.progress.wajib > 0
                            ? (k.progress.ada / k.progress.wajib) * 100
                            : 0
                        }
                        className="mt-1 h-1.5"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link to="/spj/kegiatan/$id" params={{ id: k.id }}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function NewKegiatanDialog() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const create = useCreateKegiatan();
  const { data: masterData } = useMasterKegiatan();
  const masterList = masterData ?? [];
  const [form, setForm] = useState({
    masterKegiatanId: "",
    tahun: new Date().getFullYear(),
    anggaran: "",
    tanggalMulai: "",
    tanggalSelesai: "",
    lokasi: "",
    keterangan: "",
  });

  const selectedMaster = masterList.find((m) => m.id === form.masterKegiatanId);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMaster) return;
    if (!auth.tenant?.id) {
      toast.error("Kepenghuluan belum dipilih", {
        description: "Pilih kepenghuluan pada bagian atas halaman sebelum menyimpan kegiatan.",
      });
      return;
    }
    if (auth.user?.role === "viewer") {
      toast.error("Role akun masih viewer", {
        description: "Backend VPS belum mengizinkan akun ini membuat SPJ. Ubah kolom role user, lalu logout dan login ulang.",
      });
      return;
    }
    create.mutate(
      {
        kepenghuluanId: auth.tenant.id,
        masterKegiatanId: form.masterKegiatanId,
        namaKegiatan: selectedMaster.nama,
        kode: selectedMaster.kode,
        tahun: Number(form.tahun),
        anggaran: form.anggaran ? Number(form.anggaran) : undefined,
        tanggalMulai: form.tanggalMulai || undefined,
        tanggalSelesai: form.tanggalSelesai || undefined,
        lokasi: form.lokasi || undefined,
        keterangan: form.keterangan || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Kegiatan berhasil disimpan");
          setOpen(false);
          setForm({
            masterKegiatanId: "",
            tahun: new Date().getFullYear(),
            anggaran: "",
            tanggalMulai: "",
            tanggalSelesai: "",
            lokasi: "",
            keterangan: "",
          });
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message
              : err && typeof err === "object" && "message" in err
                ? String((err as { message: unknown }).message)
                : "Gagal menyimpan kegiatan";
          toast.error("Gagal menyimpan kegiatan", { description: msg });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Kegiatan Baru
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} className="min-w-0">
          <DialogHeader>
            <DialogTitle>Buat Kegiatan Baru</DialogTitle>
            <DialogDescription>
              Pilih master kegiatan dan isi data dasar. Folder Google Drive akan otomatis dibuat saat kegiatan tersimpan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-w-0 gap-4 py-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="master">Master Kegiatan</Label>
              <Select
                value={form.masterKegiatanId}
                onValueChange={(v) => setForm({ ...form, masterKegiatanId: v })}
              >
                <SelectTrigger id="master" className="w-full min-w-0 overflow-hidden">
                  <span className="min-w-0 flex-1 truncate text-left">
                    {selectedMaster ? selectedMaster.kode : "Pilih kegiatan dari master"}
                  </span>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  className="max-h-72 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-3rem)] [&_[data-radix-select-viewport]]:h-auto"
                >
                  {masterList.map((m) => (
                    <SelectItem
                      key={m.id}
                      value={m.id}
                      className="min-w-0 items-start whitespace-normal pr-8 [&>span:last-child]:min-w-0 [&>span:last-child]:whitespace-normal [&>span:last-child]:break-words"
                    >
                      {m.kode} — {m.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedMaster && (
                <p className="max-w-full break-words text-xs leading-5 text-muted-foreground">
                  Nama kegiatan: <span className="font-medium text-foreground">{selectedMaster.nama}</span>
                </p>
              )}
            </div>


            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tahun">Tahun</Label>
                <Input
                  id="tahun"
                  type="number"
                  required
                  value={form.tahun}
                  onChange={(e) => setForm({ ...form, tahun: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anggaran">Anggaran (Rp)</Label>
                <Input
                  id="anggaran"
                  type="number"
                  value={form.anggaran}
                  onChange={(e) => setForm({ ...form, anggaran: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mulai">Tanggal Mulai</Label>
                <Input
                  id="mulai"
                  type="date"
                  value={form.tanggalMulai}
                  onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selesai">Tanggal Selesai</Label>
                <Input
                  id="selesai"
                  type="date"
                  value={form.tanggalSelesai}
                  onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lokasi">Lokasi</Label>
              <Input
                id="lokasi"
                value={form.lokasi}
                onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                placeholder="Lokasi pelaksanaan kegiatan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keterangan">Keterangan</Label>
              <Input
                id="keterangan"
                value={form.keterangan}
                onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                placeholder="Ringkasan singkat kegiatan"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending || !form.masterKegiatanId || !auth.tenant?.id}>
              {create.isPending ? "Menyimpan…" : "Simpan Kegiatan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
