"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Clock3, FileClock, LoaderCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/table/DataTable";
import { EmptyData } from "@/components/loading/EmptyData";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { StatusBadge } from "@/components/common/StatusBadge";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, type ApiEnvelope, requestHrisApi } from "@/lib/hris/api";
import { formatDate } from "@/lib/hris/format";

type ExtensionStatus = "DIAJUKAN" | "DISETUJUI_KARWAS" | "DITOLAK_KARWAS";
type ExtensionRequest = {
  id: string;
  proyek_id: string;
  berakhir_sk_sebelumnya: string;
  berakhir_sk_baru: string;
  alasan: string;
  file_dokumen: string;
  status: ExtensionStatus;
  diajukan_pada: string;
  diajukan_oleh?: { nama?: string; unit_kerja?: { nama_unit?: string; kode_unit?: string } } | null;
  diperiksa_oleh?: { nama?: string } | null;
  diperiksa_pada?: string | null;
  catatan_pemeriksa?: string | null;
  proyek: { id: string; kode_proyek: string; nama_proyek: string; tahun_fiscal: number; berakhir_sk?: string | null };
};
type QueueParams = { page: number; limit: number; query: string; status: string };

const statusTone = (status: ExtensionStatus) => status === "DISETUJUI_KARWAS" ? "ok" : status === "DITOLAK_KARWAS" ? "danger" : "warn";
const statusLabel = (status: ExtensionStatus) => status === "DIAJUKAN" ? "Menunggu KARWAS" : status === "DISETUJUI_KARWAS" ? "Disetujui" : "Ditolak";

export default function ProjectExtensionQueuePage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("DIAJUKAN");
  const [reviewing, setReviewing] = useState<ExtensionRequest | null>(null);
  const [approved, setApproved] = useState(true);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const params = useMemo<QueueParams>(() => ({ page, limit: pageSize, query: search.trim(), status }), [page, pageSize, search, status]);
  const queue = use_query<ApiEnvelope<ExtensionRequest[]>, Error, QueueParams>({
    tag: "masterProyek",
    method: "extensionQueue",
    params,
    queryFn: async ({ page: currentPage, limit, query, status: currentStatus }) => {
      setBrowserToken();
      const searchParams = new URLSearchParams({ page: String(currentPage), limit: String(limit) });
      if (query) searchParams.set("query", query);
      if (currentStatus !== "__all") searchParams.set("status", currentStatus);
      return requestHrisApi<ApiEnvelope<ExtensionRequest[]>>(`/api/proyek/perpanjangan/antrean?${searchParams.toString()}`);
    },
  });
  const rows = queue.data?.data ?? [];
  const pagination = queue.data?.pagination;
  const queueCountLabel = status === "DIAJUKAN" ? "menunggu tinjauan" : status === "DISETUJUI_KARWAS" ? "disetujui" : status === "DITOLAK_KARWAS" ? "ditolak" : "pengajuan";

  const reviewMutation = use_mutation<ApiEnvelope<unknown>, Error, { request: ExtensionRequest; disetujui: boolean; catatan: string }>({
    tag: "masterProyek",
    method: "extension-review",
    mutationFn: async ({ request, disetujui, catatan }) => {
      setBrowserToken();
      return requestHrisApi<ApiEnvelope<unknown>>(`/api/proyek/${request.proyek_id}/perpanjangan/${request.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ disetujui, catatan: catatan.trim() || undefined }),
      });
    },
    onSuccess: async (response) => {
      await queue.refetch();
      setSuccessMessage(response.message ?? "Keputusan perpanjangan berhasil disimpan.");
      setReviewing(null);
      setNote("");
      setActionError("");
    },
  });

  function openReview(request: ExtensionRequest) {
    setReviewing(request);
    setApproved(true);
    setNote("");
    setActionError("");
    setSuccessMessage("");
  }

  async function submitDecision() {
    if (!reviewing) return;
    if (!approved && !note.trim()) {
      setActionError("Catatan pemeriksa wajib diisi saat menolak pengajuan.");
      return;
    }
    setActionError("");
    try {
      await reviewMutation.mutateAsync({ request: reviewing, disetujui: approved, catatan: note });
    } catch (error) {
      setActionError(apiErrorMessage(error, "Keputusan belum dapat disimpan. Silakan coba lagi."));
    }
  }

  const columns = useMemo(() => [
    {
      key: "proyek",
      header: "PROYEK",
      render: (row: ExtensionRequest) => <div className="min-w-52"><p className="font-medium text-foreground">{row.proyek.nama_proyek}</p><p className="text-xs text-muted-foreground">{row.proyek.kode_proyek} · TA {row.proyek.tahun_fiscal}</p></div>,
    },
    {
      key: "tanggal_sk",
      header: "PERUBAHAN MASA SK",
      render: (row: ExtensionRequest) => <div className="min-w-40"><p className="text-muted-foreground">{formatDate(row.berakhir_sk_sebelumnya)}</p><p className="font-semibold text-foreground">{formatDate(row.berakhir_sk_baru)}</p></div>,
    },
    {
      key: "diajukan_oleh",
      header: "DIAJUKAN OLEH",
      render: (row: ExtensionRequest) => <div className="min-w-40"><p>{row.diajukan_oleh?.nama ?? "—"}</p><p className="text-xs text-muted-foreground">{row.diajukan_oleh?.unit_kerja?.nama_unit ?? "Unit tidak tersedia"}</p></div>,
    },
    {
      key: "diajukan_pada",
      header: "TANGGAL PENGAJUAN",
      render: (row: ExtensionRequest) => formatDate(row.diajukan_pada),
    },
    {
      key: "status",
      header: "STATUS",
      render: (row: ExtensionRequest) => <StatusBadge status={statusTone(row.status)}>{statusLabel(row.status)}</StatusBadge>,
    },
    {
      key: "aksi",
      header: "AKSI",
      className: "text-right",
      filterable: false,
      render: (row: ExtensionRequest) => row.status === "DIAJUKAN"
        ? <Button size="sm" onClick={() => openReview(row)}><FileClock size={14} /> Tinjau</Button>
        : <Button size="sm" variant="outline" onClick={() => openReview(row)}>Rincian</Button>,
    },
  ], []);

  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-gradient-to-r from-white to-amber-50/60 shadow-none">
        <CardContent className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Management Proyek · KARWAS</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Perpanjangan SK Proyek</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Tinjau alasan dan dokumen perpanjangan. Tanggal akhir SK hanya berubah setelah disetujui KARWAS.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm text-amber-950"><Clock3 size={16} /><span>{pagination?.total_datas ?? rows.length} {queueCountLabel}</span></div>
        </CardContent>
      </Card>

      {successMessage && <Alert><AlertDescription>{successMessage}</AlertDescription></Alert>}
      {queue.error ? (
        <EmptyData label="Antrean perpanjangan belum dapat dimuat." action={<Button type="button" size="sm" variant="outline" onClick={() => void queue.refetch()}>Coba lagi</Button>} />
      ) : (
        <Card className="border-slate-200 shadow-none">
          <CardContent className="p-4 sm:p-5">
            <DataTable
              title="Daftar pengajuan"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              searchPlaceholder="Cari proyek, kode, atau pengaju..."
              searchValue={search}
              onSearchChange={(value) => { setSearch(value); setPage(1); }}
              remoteSearch
              filters={[{ field: "status", label: "Status pengajuan", options: [
                { value: "DIAJUKAN", label: "Menunggu KARWAS" },
                { value: "DISETUJUI_KARWAS", label: "Disetujui" },
                { value: "DITOLAK_KARWAS", label: "Ditolak" },
              ] }]}
              filterValues={{ status }}
              onFilterChange={(field, value) => { if (field === "status") { setStatus(value); setPage(1); } }}
              emptyMessage={status === "DIAJUKAN" ? "Belum ada pengajuan perpanjangan yang menunggu tinjauan." : "Belum ada pengajuan perpanjangan pada status ini."}
              pagination={{
                page,
                pageSize,
                total: pagination?.total_datas ?? 0,
                totalPages: pagination?.total_pages ?? 1,
                onPageChange: setPage,
                onPageSizeChange: (value) => { setPageSize(value); setPage(1); },
              }}
            />
            {queue.isLoading && <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="animate-spin" size={14} /> Memuat pengajuan...</div>}
          </CardContent>
        </Card>
      )}

      <Dialog open={reviewing !== null} onOpenChange={(open) => { if (!open && !reviewMutation.isPending) setReviewing(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader className="border-b pb-4">
            <DialogTitle>{reviewing?.status === "DIAJUKAN" ? "Tinjau Perpanjangan SK Proyek" : "Rincian Perpanjangan SK Proyek"}</DialogTitle>
            <DialogDescription>Periksa perubahan tanggal, alasan, dan dokumen sebelum mengambil keputusan.</DialogDescription>
          </DialogHeader>
          {reviewing && <div className="space-y-4">
            <section className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold leading-5">{reviewing.proyek.nama_proyek}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{reviewing.proyek.kode_proyek} · TA {reviewing.proyek.tahun_fiscal}</p>
                </div>
                <StatusBadge status={statusTone(reviewing.status)}>{statusLabel(reviewing.status)}</StatusBadge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-background px-3 py-2.5"><p className="text-xs text-muted-foreground">Tanggal akhir SK saat ini</p><p className="mt-1 font-medium tabular-nums">{formatDate(reviewing.berakhir_sk_sebelumnya)}</p></div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5"><p className="text-xs text-emerald-800">Tanggal akhir yang diajukan</p><p className="mt-1 font-semibold tabular-nums text-emerald-950">{formatDate(reviewing.berakhir_sk_baru)}</p></div>
              </div>
              <div className="mt-3 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
                <p><span className="text-muted-foreground">Pengaju: </span>{reviewing.diajukan_oleh?.nama ?? "—"}</p>
                <p><span className="text-muted-foreground">Unit: </span>{reviewing.diajukan_oleh?.unit_kerja?.nama_unit ?? "—"}</p>
                <p><span className="text-muted-foreground">Diajukan: </span>{formatDate(reviewing.diajukan_pada)}</p>
                {reviewing.diperiksa_oleh?.nama && <p><span className="text-muted-foreground">Pemeriksa: </span>{reviewing.diperiksa_oleh.nama}</p>}
              </div>
            </section>

            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Alasan perpanjangan</h3>
              <p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border bg-background px-3 py-2.5 text-sm leading-6">{reviewing.alasan}</p>
            </section>

            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Dokumen pendukung</h3>
              <DocumentLinks documents={[{ label: "Dokumen perpanjangan SK", path: reviewing.file_dokumen }]} columns={1} />
            </section>

            {reviewing.catatan_pemeriksa && <Alert><AlertDescription><strong>Catatan KARWAS:</strong> {reviewing.catatan_pemeriksa}</AlertDescription></Alert>}

            {reviewing.status === "DIAJUKAN" && <>
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold">Keputusan KARWAS</legend>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${approved ? "border-emerald-300 bg-emerald-50/70" : "bg-background hover:bg-muted/40"}`}>
                  <input type="radio" name="extension-decision" checked={approved} onChange={() => setApproved(true)} className="mt-0.5 accent-emerald-700" />
                  <span><span className="block text-sm font-medium">Setujui</span><span className="mt-0.5 block text-xs leading-4 text-muted-foreground">Perbarui tanggal akhir SK.</span></span>
                </label>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${!approved ? "border-rose-300 bg-rose-50/70" : "bg-background hover:bg-muted/40"}`}>
                  <input type="radio" name="extension-decision" checked={!approved} onChange={() => setApproved(false)} className="mt-0.5 accent-rose-700" />
                  <span><span className="block text-sm font-medium">Tolak</span><span className="mt-0.5 block text-xs leading-4 text-muted-foreground">Masa SK tetap seperti saat ini.</span></span>
                </label>
              </fieldset>
              <label className="grid gap-1.5 text-sm font-medium">
                Catatan pemeriksa{!approved && <span className="text-destructive"> (wajib saat menolak)</span>}
                <textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder={approved ? "Catatan tambahan (opsional)" : "Tuliskan alasan penolakan"} className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
              </label>
            </>}

            {actionError && <Alert variant="destructive"><AlertDescription>{actionError}</AlertDescription></Alert>}
          </div>}
          <DialogFooter className="sticky bottom-0">
            {reviewing?.status === "DIAJUKAN" && <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => setReviewing(null)}>Batal</Button>}
            {reviewing?.status !== "DIAJUKAN" && <Button variant="outline" onClick={() => setReviewing(null)}>Tutup</Button>}
            {reviewing?.status === "DIAJUKAN" && <Button disabled={reviewMutation.isPending} onClick={() => void submitDecision()}>
              {reviewMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : approved ? <Check size={16} /> : <X size={16} />}
              {approved ? "Setujui Perpanjangan" : "Tolak Pengajuan"}
            </Button>}
            {reviewing && <Link className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted" href={`/dashboard/proyek/${reviewing.proyek.id}`}><span>Buka proyek</span><ArrowUpRight size={14} /></Link>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
