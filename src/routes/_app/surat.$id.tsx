import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Forward,
  Inbox,
  Mail,
  Send,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSuratDetail, useTransisiSurat, useCreateDisposisi } from "@/hooks/use-surat";
import {
  jenisLabel,
  sifatLabel,
  sifatVariant,
  statusMasukLabel,
  statusMasukVariant,
  statusKeluarLabel,
  statusKeluarVariant,
  type SuratMasuk,
  type SuratKeluar,
  type SuratItem,
  StatusSuratMasuk,
  StatusSuratKeluar,
} from "@/lib/surat";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/formatting";

export const Route = createFileRoute("/_app/surat/$id")({
  head: () => ({
    meta: [
      { title: "Detail Surat — SIAD 2.0" },
      { name: "description", content: "Detail, disposisi, dan tracking status surat." },
      { property: "og:title", content: "Detail Surat — SIAD 2.0" },
      { property: "og:description", content: "Detail surat masuk dan keluar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuratDetailPage,
});

function SuratDetailPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useSuratDetail(id);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        Memuat detail surat…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-muted-foreground">
        <FileText className="h-12 w-12 opacity-50" />
        <p className="mt-4">Surat tidak ditemukan.</p>
        <Link to="/surat" className="mt-4">
          <Button variant="outline">Kembali ke Daftar Surat</Button>
        </Link>
      </div>
    );
  }

  return data.jenis === "masuk" ? <SuratMasukDetail item={data as SuratMasuk} /> : <SuratKeluarDetail item={data as SuratKeluar} />;
}

function SuratMasukDetail({ item }: { item: SuratMasuk }) {
  const auth = useAuth();
  const canDisposisi = ["super_admin", "penghulu", "sekretaris"].includes(auth.user?.peran ?? "");
  const canSelesai = ["super_admin", "sekretaris", "operator"].includes(auth.user?.peran ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/surat">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Surat Masuk
            </h1>
            <p className="text-sm text-muted-foreground">{item.nomorAgenda} • {item.nomorSurat}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sifatVariant(item.sifat)}>{sifatLabel(item.sifat)}</Badge>
          <Badge variant={statusMasukVariant(item.status)}>{statusMasukLabel(item.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informasi Surat</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Pengirim" value={item.pengirim} icon={<User className="h-4 w-4" />} />
              <Info label="Perihal" value={item.perihal} />
              <Info label="Tanggal Surat" value={formatDate(item.tanggalSurat)} icon={<Calendar className="h-4 w-4" />} />
              <Info label="Tanggal Diterima" value={formatDate(item.tanggalMasuk)} icon={<Calendar className="h-4 w-4" />} />
              <Info label="Lampiran" value={item.lampiran || "-"} />
              <Info label="Diterima Oleh" value={item.penerimaNama || "-"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Riwayat Disposisi</CardTitle>
              {canDisposisi && <DisposisiDialog suratId={item.id} />}
            </CardHeader>
            <CardContent>
              {item.disposisi.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  Belum ada disposisi.
                </div>
              ) : (
                <div className="space-y-4">
                  {item.disposisi.map((d) => (
                    <div key={d.id} className="flex gap-4 rounded-lg border p-4">
                      <div className="mt-1">
                        <Forward className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-medium">
                            {d.dariNama} <span className="text-muted-foreground">→</span> {d.keNama || "Belum ditentukan"}
                          </div>
                          <div className="text-xs text-muted-foreground">{formatDate(d.createdAt)}</div>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Instruksi:</span> {d.instruksi}
                        </div>
                        {d.catatan && (
                          <div className="text-xs text-muted-foreground">Catatan: {d.catatan}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canDisposisi && item.status === "diterima" && (
                <TransisiButton
                  suratId={item.id}
                  status="didisposisi"
                  label="Didisposisi"
                  icon={<Forward className="h-4 w-4" />}
                />
              )}
              {canDisposisi && item.status === "didisposisi" && (
                <TransisiButton
                  suratId={item.id}
                  status="diproses"
                  label="Diproses"
                  icon={<Clock className="h-4 w-4" />}
                />
              )}
              {canSelesai && item.status === "diproses" && (
                <TransisiButton
                  suratId={item.id}
                  status="selesai"
                  label="Selesai"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
              )}
              {item.fileName && (
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Unduh Lampiran
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Dibuat</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Diperbarui</span>
                <span>{formatDate(item.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SuratKeluarDetail({ item }: { item: SuratKeluar }) {
  const auth = useAuth();
  const canTtd = ["super_admin", "penghulu"].includes(auth.user?.peran ?? "");
  const canKirim = ["super_admin", "sekretaris", "operator"].includes(auth.user?.peran ?? "");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link to="/surat">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Send className="h-5 w-5" />
              Surat Keluar
            </h1>
            <p className="text-sm text-muted-foreground">{item.nomorAgenda} • {item.nomorSurat}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={sifatVariant(item.sifat)}>{sifatLabel(item.sifat)}</Badge>
          <Badge variant={statusKeluarVariant(item.status)}>{statusKeluarLabel(item.status)}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informasi Surat</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Tujuan" value={item.tujuan} icon={<Mail className="h-4 w-4" />} />
              <Info label="Perihal" value={item.perihal} />
              <Info label="Tanggal Surat" value={formatDate(item.tanggalKeluar)} icon={<Calendar className="h-4 w-4" />} />
              <Info label="Penandatangan" value={item.penandatanganNama || "Belum ditentukan"} icon={<User className="h-4 w-4" />} />
              <Info label="Jabatan" value={item.jabatanPenandatangan || "-"} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Aksi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {canTtd && item.status === "draft" && (
                <TransisiButton
                  suratId={item.id}
                  status="menunggu_ttd"
                  label="Ajukan TTD"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
              )}
              {canTtd && item.status === "menunggu_ttd" && (
                <TransisiButton
                  suratId={item.id}
                  status="ditandatangani"
                  label="Tandatangani"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
              )}
              {canKirim && item.status === "ditandatangani" && (
                <TransisiButton
                  suratId={item.id}
                  status="dikirim"
                  label="Kirim Surat"
                  icon={<Send className="h-4 w-4" />}
                />
              )}
              {canKirim && item.status === "dikirim" && (
                <TransisiButton
                  suratId={item.id}
                  status="selesai"
                  label="Selesai"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
              )}
              {item.fileName && (
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  Unduh Surat
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Dibuat</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Diperbarui</span>
                <span>{formatDate(item.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function TransisiButton({
  suratId,
  status,
  label,
  icon,
}: {
  suratId: string;
  status: string;
  label: string;
  icon: React.ReactNode;
}) {
  const transisi = useTransisiSurat();
  return (
    <Button
      variant={status === "selesai" ? "default" : "outline"}
      className="w-full gap-2"
      disabled={transisi.isPending}
      onClick={() =>
        transisi.mutate(
          { id: suratId, input: { status, catatan: "" } },
          {
            onSuccess: () => toast.success("Status surat diperbarui"),
            onError: (err: unknown) => {
              const msg = err instanceof Error ? err.message : "Gagal memperbarui status";
              toast.error("Gagal memperbarui status", { description: msg });
            },
          },
        )
      }
    >
      {transisi.isPending ? "Memproses…" : icon}
      {label}
    </Button>
  );
}

function DisposisiDialog({ suratId }: { suratId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ keNama: "", keJabatan: "", instruksi: "", catatan: "" });
  const create = useCreateDisposisi();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { suratId, input: form },
      {
        onSuccess: () => {
          toast.success("Disposisi berhasil dibuat");
          setOpen(false);
          setForm({ keNama: "", keJabatan: "", instruksi: "", catatan: "" });
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : "Gagal membuat disposisi";
          toast.error("Gagal membuat disposisi", { description: msg });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Forward className="h-4 w-4" />
          Disposisi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Buat Disposisi</DialogTitle>
            <DialogDescription>Tentukan penerima dan instruksi disposisi.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="keNama">Diteruskan Ke</Label>
                <Input
                  id="keNama"
                  required
                  value={form.keNama}
                  onChange={(e) => setForm({ ...form, keNama: e.target.value })}
                  placeholder="Nama penerima"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="keJabatan">Jabatan</Label>
                <Input
                  id="keJabatan"
                  value={form.keJabatan}
                  onChange={(e) => setForm({ ...form, keJabatan: e.target.value })}
                  placeholder="Jabatan penerima"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="instruksi">Instruksi</Label>
              <Textarea
                id="instruksi"
                required
                value={form.instruksi}
                onChange={(e) => setForm({ ...form, instruksi: e.target.value })}
                placeholder="Instruksi yang harus dilakukan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catatan">Catatan</Label>
              <Textarea
                id="catatan"
                value={form.catatan}
                onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                placeholder="Catatan tambahan (opsional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Menyimpan…" : "Simpan Disposisi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
