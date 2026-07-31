import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Mail,
  Send,
  ChevronRight,
  Calendar,
  Inbox,
  Filter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSuratList, useCreateSuratMasuk, useCreateSuratKeluar } from "@/hooks/use-surat";
import {
  jenisLabel,
  sifatLabel,
  sifatVariant,
  statusMasukLabel,
  statusMasukVariant,
  statusKeluarLabel,
  statusKeluarVariant,
  SifatSurat,
  JenisSurat,
  type SuratMasuk,
  type SuratKeluar,
  type SuratItem,
} from "@/lib/surat";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/formatting";

export const Route = createFileRoute("/_app/surat/")({
  head: () => ({
    meta: [
      { title: "Surat Masuk & Keluar — SIAD 2.0" },
      { name: "description", content: "Registrasi, disposisi, dan pencarian surat masuk & keluar kepenghuluan." },
      { property: "og:title", content: "Surat Masuk & Keluar — SIAD 2.0" },
      { property: "og:description", content: "Modul surat masuk dan keluar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuratIndexPage,
});

function SuratIndexPage() {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<JenisSurat>("masuk");
  const [q, setQ] = useState("");
  const [tahun, setTahun] = useState<number | "all">("all");
  const [sifat, setSifat] = useState<SifatSurat | "all">("all");

  const { data, isLoading } = useSuratList({
    jenis: activeTab,
    q: q || undefined,
    tahun: tahun === "all" ? undefined : tahun,
    sifat: sifat === "all" ? undefined : sifat,
  });

  const items = data?.items ?? [];
  const canCreate = ["super_admin", "kaur", "operator", "penghulu", "sekretaris"].includes(
    auth.user?.peran ?? "",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Surat Masuk & Keluar</h1>
          <p className="text-sm text-muted-foreground">
            Registrasi, disposisi, dan tracking surat kepenghuluan.
          </p>
        </div>
        {canCreate && <NewSuratDialog jenis={activeTab} />}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as JenisSurat)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="masuk" className="gap-2">
            <Inbox className="h-4 w-4" />
            Surat Masuk
          </TabsTrigger>
          <TabsTrigger value="keluar" className="gap-2">
            <Send className="h-4 w-4" />
            Surat Keluar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="masuk" className="space-y-4">
          <SuratFilterBar
            q={q}
            setQ={setQ}
            tahun={tahun}
            setTahun={setTahun}
            sifat={sifat}
            setSifat={setSifat}
          />
          <SuratMasukTable items={items as SuratMasuk[]} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="keluar" className="space-y-4">
          <SuratFilterBar
            q={q}
            setQ={setQ}
            tahun={tahun}
            setTahun={setTahun}
            sifat={sifat}
            setSifat={setSifat}
          />
          <SuratKeluarTable items={items as SuratKeluar[]} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SuratFilterBar(props: {
  q: string;
  setQ: (v: string) => void;
  tahun: number | "all";
  setTahun: (v: number | "all") => void;
  sifat: SifatSurat | "all";
  setSifat: (v: SifatSurat | "all") => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari nomor surat, perihal, atau pengirim/tujuan…"
          value={props.q}
          onChange={(e) => props.setQ(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={String(props.tahun)} onValueChange={(v) => props.setTahun(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Tahun" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tahun</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2024">2024</SelectItem>
          </SelectContent>
        </Select>

        <Select value={props.sifat} onValueChange={(v) => props.setSifat(v as SifatSurat | "all")}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sifat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua sifat</SelectItem>
            <SelectItem value="biasa">Biasa</SelectItem>
            <SelectItem value="penting">Penting</SelectItem>
            <SelectItem value="rahasia">Rahasia</SelectItem>
            <SelectItem value="sangat_rahasia">Sangat Rahasia</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SuratMasukTable({ items, isLoading }: { items: SuratMasuk[]; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor Agenda</TableHead>
            <TableHead>Pengirim / Perihal</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Sifat</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Memuat surat masuk…
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                <Inbox className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2">Belum ada surat masuk.</p>
              </TableCell>
            </TableRow>
          ) : (
            items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.nomorAgenda}</div>
                  <div className="text-xs text-muted-foreground">{s.nomorSurat}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{s.pengirim}</div>
                  <div className="text-sm text-muted-foreground">{s.perihal}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Diterima {formatDate(s.tanggalMasuk)}
                  </div>
                  <div className="text-xs text-muted-foreground">Surat {formatDate(s.tanggalSurat)}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={sifatVariant(s.sifat)}>{sifatLabel(s.sifat)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusMasukVariant(s.status)}>{statusMasukLabel(s.status)}</Badge>
                </TableCell>
                <TableCell>
                  <Link to="/surat/$id" params={{ id: s.id }}>
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
  );
}

function SuratKeluarTable({ items, isLoading }: { items: SuratKeluar[]; isLoading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor Agenda</TableHead>
            <TableHead>Tujuan / Perihal</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Sifat</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Memuat surat keluar…
              </TableCell>
            </TableRow>
          ) : items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                <Send className="mx-auto h-8 w-8 opacity-50" />
                <p className="mt-2">Belum ada surat keluar.</p>
              </TableCell>
            </TableRow>
          ) : (
            items.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="font-medium">{s.nomorAgenda}</div>
                  <div className="text-xs text-muted-foreground">{s.nomorSurat}</div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">{s.tujuan}</div>
                  <div className="text-sm text-muted-foreground">{s.perihal}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Keluar {formatDate(s.tanggalKeluar)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={sifatVariant(s.sifat)}>{sifatLabel(s.sifat)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusKeluarVariant(s.status)}>{statusKeluarLabel(s.status)}</Badge>
                </TableCell>
                <TableCell>
                  <Link to="/surat/$id" params={{ id: s.id }}>
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
  );
}

function NewSuratDialog({ jenis }: { jenis: JenisSurat }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const createMasuk = useCreateSuratMasuk();
  const createKeluar = useCreateSuratKeluar();
  const isMasuk = jenis === "masuk";

  const [form, setForm] = useState<Record<string, string>>({
    tanggalMasuk: new Date().toISOString().split("T")[0],
    tanggalKeluar: new Date().toISOString().split("T")[0],
    tanggalSurat: new Date().toISOString().split("T")[0],
    nomorSurat: "",
    pengirim: "",
    tujuan: "",
    perihal: "",
    sifat: "biasa",
    lampiran: "",
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth.tenant?.id) {
      toast.error("Pilih Kepenghuluan dulu", {
        description: "Akun admin perlu memilih Kepenghuluan target di bagian atas.",
      });
      return;
    }
    const common = { sifat: form.sifat as SifatSurat, kepenghuluanId: auth.tenant.id };

    const onSuccess = () => {
      toast.success(`${jenisLabel(jenis)} berhasil disimpan`);
      setOpen(false);
      setForm({
        tanggalMasuk: new Date().toISOString().split("T")[0],
        tanggalKeluar: new Date().toISOString().split("T")[0],
        tanggalSurat: new Date().toISOString().split("T")[0],
        nomorSurat: "",
        pengirim: "",
        tujuan: "",
        perihal: "",
        sifat: "biasa",
        lampiran: "",
      });
    };

    const onError = (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Gagal menyimpan surat";
      toast.error("Gagal menyimpan surat", { description: msg });
    };

    if (isMasuk) {
      createMasuk.mutate(
        {
          ...common,
          tanggalMasuk: form.tanggalMasuk,
          tanggalSurat: form.tanggalSurat,
          nomorSurat: form.nomorSurat,
          pengirim: form.pengirim,
          perihal: form.perihal,
          lampiran: form.lampiran,
        },
        { onSuccess, onError },
      );
    } else {
      createKeluar.mutate(
        {
          ...common,
          tanggalKeluar: form.tanggalKeluar,
          nomorSurat: form.nomorSurat,
          tujuan: form.tujuan,
          perihal: form.perihal,
        },
        { onSuccess, onError },
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {isMasuk ? "Surat Masuk" : "Surat Keluar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isMasuk ? <Mail className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              Buat {jenisLabel(jenis)} Baru
            </DialogTitle>
            <DialogDescription>
              Isi data surat. Nomor agenda akan dibuat otomatis per tahun.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nomorSurat">Nomor Surat</Label>
                <Input
                  id="nomorSurat"
                  required
                  value={form.nomorSurat}
                  onChange={(e) => setForm({ ...form, nomorSurat: e.target.value })}
                  placeholder="420/2026/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggalSurat">Tanggal Surat</Label>
                <Input
                  id="tanggalSurat"
                  type="date"
                  required
                  value={form.tanggalSurat}
                  onChange={(e) => setForm({ ...form, tanggalSurat: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={isMasuk ? "tanggalMasuk" : "tanggalKeluar"}>
                  Tanggal {isMasuk ? "Diterima" : "Keluar"}
                </Label>
                <Input
                  id={isMasuk ? "tanggalMasuk" : "tanggalKeluar"}
                  type="date"
                  required
                  value={isMasuk ? form.tanggalMasuk : form.tanggalKeluar}
                  onChange={(e) =>
                    setForm(isMasuk ? { ...form, tanggalMasuk: e.target.value } : { ...form, tanggalKeluar: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sifat">Sifat</Label>
                <Select value={form.sifat} onValueChange={(v) => setForm({ ...form, sifat: v })}>
                  <SelectTrigger id="sifat">
                    <SelectValue placeholder="Pilih sifat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="biasa">Biasa</SelectItem>
                    <SelectItem value="penting">Penting</SelectItem>
                    <SelectItem value="rahasia">Rahasia</SelectItem>
                    <SelectItem value="sangat_rahasia">Sangat Rahasia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={isMasuk ? "pengirim" : "tujuan"}>
                {isMasuk ? "Pengirim" : "Tujuan"}
              </Label>
              <Input
                id={isMasuk ? "pengirim" : "tujuan"}
                required
                value={isMasuk ? form.pengirim : form.tujuan}
                onChange={(e) =>
                  setForm(isMasuk ? { ...form, pengirim: e.target.value } : { ...form, tujuan: e.target.value })
                }
                placeholder={isMasuk ? "Instansi pengirim" : "Instansi tujuan"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perihal">Perihal</Label>
              <Input
                id="perihal"
                required
                value={form.perihal}
                onChange={(e) => setForm({ ...form, perihal: e.target.value })}
                placeholder="Ringkasan perihal surat"
              />
            </div>

            {isMasuk && (
              <div className="space-y-2">
                <Label htmlFor="lampiran">Lampiran</Label>
                <Input
                  id="lampiran"
                  value={form.lampiran}
                  onChange={(e) => setForm({ ...form, lampiran: e.target.value })}
                  placeholder="Contoh: 1 (satu) berkas"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={createMasuk.isPending || createKeluar.isPending}>
              {createMasuk.isPending || createKeluar.isPending ? "Menyimpan…" : "Simpan Surat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
