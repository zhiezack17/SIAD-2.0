import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  FolderOpen,
  Upload,
  User,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";

import {
  useKegiatanDetail,
  useDokumenList,
  useChecklist,
  useKegiatanHistory,
  useUploadDokumen,
  useTransitionKegiatan,
} from "@/hooks/use-spj";
import {
  statusLabel,
  statusVariant,
  dokumenStatusLabel,
  dokumenStatusVariant,
  actionLabel,
  type SpjStatus,
  type SpjTransitionAction,
} from "@/lib/spj";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime, formatFileSize } from "@/lib/formatting";

export const Route = createFileRoute("/_app/spj/kegiatan/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Detail SPJ Kegiatan — SIAD 2.0" },
      { name: "description", content: "Detail kegiatan, dokumen, checklist, dan riwayat verifikasi SPJ." },
      { property: "og:title", content: "Detail SPJ Kegiatan — SIAD 2.0" },
      { property: "og:description", content: "Detail kegiatan, dokumen, checklist, dan riwayat verifikasi SPJ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpjDetailPage,
});

function SpjDetailPage() {
  const { id } = useParams({ from: "/_app/spj/kegiatan/$id" });
  const auth = useAuth();
  const { data: kegiatanData } = useKegiatanDetail(id);
  const { data: dokumenData } = useDokumenList(id);
  const { data: checklistData } = useChecklist(id);
  const kegiatan = kegiatanData?.kegiatan;
  const dokumen = dokumenData?.items ?? [];
  const checklist = checklistData?.items ?? [];

  const canUpload = ["super_admin", "kaur", "operator", "penghulu"].includes(
    auth.user?.peran ?? "",
  );
  const canTransition = ["super_admin", "kaur", "operator", "bendahara", "sekretaris", "penghulu"].includes(
    auth.user?.peran ?? "",
  );

  if (!kegiatan) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Memuat detail kegiatan…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <Link to="/spj" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Kembali ke SPJ
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{kegiatan.nama}</h1>
              <Badge variant={statusVariant(kegiatan.status)}>{statusLabel(kegiatan.status)}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {kegiatan.kode} • Tahun {kegiatan.tahun}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canUpload && <UploadDokumenDialog kegiatanId={kegiatan.id} checklist={checklist} />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Anggaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(kegiatan.anggaran)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Periode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <Calendar className="mr-1 inline h-4 w-4" />
              {formatDate(kegiatan.tanggalMulai)} – {formatDate(kegiatan.tanggalSelesai)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Dokumen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {checklist.filter((c) => c.ada).length}/{checklist.filter((c) => c.wajib).length}
              <span className="ml-1 text-sm font-normal text-muted-foreground">wajib terpenuhi</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Folder Drive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              <FolderOpen className="mr-1 inline h-4 w-4" />
              {kegiatan.driveFolderId ? "Sudah dibuat" : "Belum dibuat"}
            </div>
          </CardContent>
        </Card>
      </div>

      {canTransition && (
        <KegiatanTransition kegiatan={kegiatan} />
      )}

      <Tabs defaultValue="dokumen" className="w-full">
        <TabsList>
          <TabsTrigger value="dokumen">Dokumen SPJ</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="timeline">Alur Verifikasi</TabsTrigger>
        </TabsList>

        <TabsContent value="dokumen" className="space-y-4">
          <DokumenTable dokumen={dokumen} />
        </TabsContent>

        <TabsContent value="checklist" className="space-y-4">
          <ChecklistCard checklist={checklist} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <StatusTimeline status={kegiatan.status} />
          <KegiatanHistory kegiatanId={kegiatan.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DokumenTable({ dokumen }: { dokumen: import("@/lib/spj").DokumenSpj[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-4">
        <h3 className="font-semibold">Daftar Dokumen</h3>
        <p className="text-sm text-muted-foreground">
          Dokumen checklist yang sudah diunggah akan terlihat di sini.
        </p>
      </div>
      <div className="divide-y divide-border">
        {dokumen.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Belum ada dokumen. Unggah dokumen pertama untuk memulai.
          </div>
        ) : (
          dokumen.map((d) => (
            <div key={d.id} className="p-4 hover:bg-muted/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-md border border-border bg-background p-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">{d.jenis}</div>
                    {d.fileName ? (
                      <div className="text-sm text-muted-foreground">
                        {d.fileName} • {formatFileSize(d.fileSize)}
                      </div>
                    ) : (
                      <div className="text-sm text-destructive">Belum ada file</div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Diunggah {formatDateTime(d.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={dokumenStatusVariant(d.status)}>{dokumenStatusLabel(d.status)}</Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KegiatanHistory({ kegiatanId }: { kegiatanId: string }) {
  const { data } = useKegiatanHistory(kegiatanId);
  const history = data?.items ?? [];
  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Kegiatan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {history.map((h) => (
            <div key={h.id} className="flex items-start gap-2 text-sm">
              <Clock className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1">
                <span className="font-medium">{h.actorNama ?? "Pengguna"}</span>
                {h.peran && <span className="text-muted-foreground"> ({h.peran})</span>} —{" "}
                {actionLabel(h.action as SpjTransitionAction)}
                <span className="ml-1 text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</span>
                {h.catatan && <div className="text-xs text-muted-foreground">Catatan: {h.catatan}</div>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistCard({ checklist }: { checklist: import("@/lib/spj").ChecklistItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist Kelengkapan Dokumen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {checklist.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-md border border-border p-3"
            >
              <div className="flex items-center gap-3">
                {c.ada ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="font-medium">{c.jenisDokumen}</div>
                  {c.wajib && <div className="text-xs text-destructive">Wajib</div>}
                </div>
              </div>
              <Badge variant={c.ada ? "default" : "outline"}>{c.ada ? "Ada" : "Belum ada"}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusTimeline({ status }: { status: SpjStatus }) {
  const steps: SpjStatus[] = ["draft", "diajukan", "dicek_bendahara", "diverifikasi_sekretaris", "disetujui"];
  const activeIndex = steps.indexOf(status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alur Verifikasi Berjenjang</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((s, idx) => {
            const done = idx <= activeIndex && status !== "ditolak";
            const current = idx === activeIndex && status !== "ditolak";
            return (
              <div key={s} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  {done ? (
                    <CheckCircle2 className={`h-6 w-6 ${current ? "text-primary" : "text-muted-foreground"}`} />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground" />
                  )}
                  {idx < steps.length - 1 && <div className="mt-1 h-8 w-px bg-border" />}
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${current ? "text-foreground" : "text-muted-foreground"}`}>
                    {statusLabel(s)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {s === "draft" && "Kaur/Kasi mengunggah dokumen awal."}
                    {s === "diajukan" && "Kegiatan diajukan ke Bendahara untuk dicek."}
                    {s === "dicek_bendahara" && "Bendahara mengecek nominal dan kelengkapan."}
                    {s === "diverifikasi_sekretaris" && "Sekretaris memverifikasi administrasi."}
                    {s === "disetujui" && "Penghulu memberikan persetujuan akhir."}
                  </div>
                </div>
              </div>
            );
          })}
          {status === "ditolak" && (
            <div className="flex items-start gap-4">
              <XCircle className="h-6 w-6 text-destructive" />
              <div>
                <div className="font-medium text-destructive">Ditolak</div>
                <div className="text-sm text-muted-foreground">Kegiatan dikembalikan dan perlu diperbaiki.</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KegiatanTransition({ kegiatan }: { kegiatan: import("@/lib/spj").Kegiatan }) {
  const auth = useAuth();
  const transition = useTransitionKegiatan(kegiatan.id);
  const [catatan, setCatatan] = useState("");
  const [selectedAction, setSelectedAction] = useState<SpjTransitionAction | "">("");

  const availableActions = useMemo<SpjTransitionAction[]>(() => {
    const role = auth.user?.peran;
    if (role === "super_admin") {
      return ["ajukan", "cek", "verifikasi", "setujui", "tolak"];
    }
    switch (kegiatan.status) {
      case "draft":
        return role === "kaur" || role === "operator" ? ["ajukan"] : [];
      case "diajukan":
        return role === "bendahara" ? ["cek", "tolak"] : [];
      case "dicek_bendahara":
        return role === "sekretaris" ? ["verifikasi", "tolak"] : [];
      case "diverifikasi_sekretaris":
        return role === "penghulu" ? ["setujui", "tolak"] : [];
      default:
        return [];
    }
  }, [kegiatan.status, auth.user?.peran]);

  if (availableActions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Aksi Verifikasi Kegiatan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Select value={selectedAction} onValueChange={(v) => setSelectedAction(v as SpjTransitionAction)}>
            <SelectTrigger className="w-full sm:w-[260px]">
              <SelectValue placeholder="Pilih aksi" />
            </SelectTrigger>
            <SelectContent>
              {availableActions.map((a) => (
                <SelectItem key={a} value={a}>
                  {actionLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            placeholder="Catatan verifikasi (opsional)"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className="min-h-[60px] flex-1"
          />
          <Button
            disabled={!selectedAction || transition.isPending}
            onClick={() => {
              if (!selectedAction) return;
              transition.mutate(
                { action: selectedAction, catatan },
                {
                  onSuccess: () => {
                    setCatatan("");
                    setSelectedAction("");
                  },
                },
              );
            }}
          >
            {transition.isPending ? "Memproses…" : "Proses"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadDokumenDialog({
  kegiatanId,
  checklist,
}: {
  kegiatanId: string;
  checklist: import("@/lib/spj").ChecklistItem[];
}) {
  const [open, setOpen] = useState(false);
  const upload = useUploadDokumen();
  const [dokumenId, setDokumenId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const jenisOptions = useMemo(() => {
    return checklist
      .filter((c) => !c.ada)
      .sort((a, b) => a.urutan - b.urutan);
  }, [checklist]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !dokumenId) return;
    upload.mutate(
      { kegiatanId, dokumenId, file, keterangan },
      {
        onSuccess: () => {
          setOpen(false);
          setDokumenId("");
          setKeterangan("");
          setFile(null);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4" />
          Unggah Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Unggah Dokumen SPJ</DialogTitle>
            <DialogDescription>
              Pilih slot checklist dan unggah file. File akan tersimpan ke folder Google Drive kegiatan ini.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dokumen">Jenis Dokumen</Label>
              <Select value={dokumenId} onValueChange={setDokumenId}>
                <SelectTrigger id="dokumen">
                  <SelectValue placeholder="Pilih jenis dokumen" />
                </SelectTrigger>
                <SelectContent>
                  {jenisOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.jenisDokumen} {c.wajib && "(Wajib)"}
                    </SelectItem>
                  ))}
                  {jenisOptions.length === 0 && (
                    <SelectItem value="" disabled>
                      Semua checklist sudah terunggah
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              />
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOC, XLS, maksimal sesuai kebijakan VPS.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keterangan">Keterangan</Label>
              <Textarea
                id="keterangan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Catatan singkat mengenai dokumen"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={upload.isPending || !file || !dokumenId}>
              {upload.isPending ? "Mengunggah…" : "Unggah"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
