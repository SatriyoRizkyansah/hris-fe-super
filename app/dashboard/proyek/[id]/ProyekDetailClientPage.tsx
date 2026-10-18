"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ExternalLink, FileText, LoaderCircle, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, envelopeRows, unwrapEnvelope, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, humanizeStatus, projectStatusTone, roStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { ProyekItemDto } from "@/lib/api/generated/api-generated";

type Workflow = "umum" | "pimpinan" | "notulen" | null;
type Row = Record<string, unknown>;
const text = (value: unknown, fallback = "—") => (value === null || value === undefined || value === "" ? fallback : String(value));

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ProyekDetailClientPage({ id }: { id: string }) {
  const identity = useMemo(browserIdentity, []);
  const [workflow, setWorkflow] = useState<Workflow>(null);
  const [approved, setApproved] = useState(true);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState("");
  const [coordinatorCode, setCoordinatorCode] = useState("");
  const [expandedRos, setExpandedRos] = useState<Record<string, boolean>>({});
  const [roDetails, setRoDetails] = useState<Record<string, Row>>({});
  const [roLoading, setRoLoading] = useState<Record<string, boolean>>({});

  const detail = use_query({
    tag: "masterProyek",
    method: "detail",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetDetail(id);
    },
  });
  const ros = use_query({
    tag: "masterRo",
    method: "byProject",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRo.roControllerGetData({ id_proyek: id, limit: 100, page: 1 });
    },
  });
  const terms = use_query({
    tag: "masterProyek",
    method: "termin",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetTermin(id);
    },
  });
  const settings = use_query({
    tag: "masterPengaturanMargin",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterPengaturanMargin.pengaturanMarginControllerGetData();
    },
  });
  const distribution = use_query({
    tag: "masterProyek",
    method: "distribusi",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetDistribusi(id);
    },
  });
  const units = use_query({
    tag: "masterUnitKerja",
    method: "list",
    params: { enabled: Boolean(identity.unitKerjaId) },
    enabled: Boolean(identity.unitKerjaId),
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetControllerGetData({ limit: 200 });
    },
  });
  const project = envelopeData<ProyekItemDto>(detail.data);
  const roRows = envelopeRows<Row>(ros.data);
  const termRows = envelopeRows<Row>(terms.data);
  const distributionRows = envelopeRows<Row>(distribution.data);
  const settingRows = envelopeRows<Row>(settings.data);
  const currentUnit = envelopeRows<Row>(units.data).find((unit) => String(unit.id) === identity.unitKerjaId);
  const isUmum = identity.role === "superadmin" || (identity.role === "koordinator" && String(currentUnit?.kode_unit ?? coordinatorCode) === "ORG-UMUM");
  const isSubmitter = identity.role === "superadmin" || (identity.role === "koordinator" && identity.userId === String(project?.diajukan_oleh_id ?? ""));

  const invalidate = async (): Promise<void> => {
    await Promise.all([detail.refetch(), ros.refetch(), terms.refetch(), distribution.refetch()]);
  };
  const workflowMutation = use_mutation({
    tag: "masterProyek",
    method: "workflow",
    mutationFn: async () => {
      setBrowserToken();
      if (workflow === "notulen") {
        if (!file) throw new Error("Pilih berkas notulen.");
        return uploadHrisFile(`/api/proyek/${id}/notulen`, file);
      }
      if (!workflow) throw new Error("Aksi workflow tidak dipilih.");
      if (!approved && !note.trim()) throw new Error("Catatan penolakan wajib diisi.");
      return workflow === "umum"
        ? browserApi.masterProyek.proyekControllerValidasiUmum(id, { disetujui: approved, catatan: note.trim() || undefined })
        : browserApi.masterProyek.proyekControllerValidasiPimpinan(id, { disetujui: approved, catatan: note.trim() || undefined });
    },
    onSuccess: async () => {
      await invalidate();
      setWorkflow(null);
    },
  });
  const terminMutation = use_mutation({
    tag: "masterProyek",
    method: "terminAction",
    mutationFn: async ({ termId, action }: { termId: string; action: "validasi" | "cairkan" }) => {
      setBrowserToken();
      return action === "validasi" ? browserApi.masterProyek.proyekControllerValidasiTerminKeuangan(id, termId, { disetujui: true }) : browserApi.masterProyek.proyekControllerCairkanTermin(id, termId);
    },
    onSuccess: invalidate,
  });

  function openWorkflow(action: Exclude<Workflow, null>) {
    setWorkflow(action);
    setApproved(true);
    setNote("");
    setFile(null);
    setActionError("");
  }
  async function submitWorkflow() {
    setActionError("");
    try {
      await workflowMutation.mutateAsync();
    } catch (error) {
      setActionError(apiErrorMessage(error));
    }
  }
  if (detail.isLoading) return <div className="p-6 text-sm text-muted-foreground">Memuat proyek...</div>;
  if (!project)
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>Proyek tidak ditemukan</AlertTitle>
          <AlertDescription>{detail.error ? apiErrorMessage(detail.error) : "Data proyek tidak tersedia."}</AlertDescription>
        </Alert>
        <Button variant="outline" render={<Link href="/dashboard/proyek" />}>
          <ArrowLeft size={16} /> Kembali
        </Button>
      </div>
    );
  const status = project.status_proyek;
  const roPlan = roRows.reduce((total, row) => total + (Number(row.nilai_rencana) || Number(row.total_plafon) || 0), 0);
  const roTotal = roRows.reduce((total, row) => total + (Number(row.total_plafon) || 0), 0);
  const roUsed = roRows.reduce((total, row) => total + (Number(row.total_terpakai) || 0), 0);
  const termsPaid = termRows.some((term) => String(term.status) === "CAIR");
  const marginDistributed = distributionRows.reduce((total, row) => total + (Number(row.debit) || 0), 0);
  const directCost = Number(project.total_direct_cost) || 0;
  const margin = Number(project.total_margin) || 0;
  const contract = Number(project.nilai_kontrak) || 0;
  const usedPercent = roTotal ? Math.min(100, (roUsed / roTotal) * 100) : 0;
  const marginPercent = margin ? (marginDistributed / margin) * 100 : 0;
  const groupedDistribution = new Map<string, { category: string; unit: string; amount: number; count: number }>();
  distributionRows.forEach((row) => {
    const category = text(row.dana_kategori ?? (row.dana as Row | undefined)?.kategori_kamar, "LAINNYA");
    const unit = text((row.unit as Row | undefined)?.nama_unit ?? (row.dana as Row | undefined)?.nama_unit, "Unit belum tersedia");
    const key = `${category}:${unit}`;
    const current = groupedDistribution.get(key) ?? { category, unit, amount: 0, count: 0 };
    current.amount += Number(row.debit) || 0;
    current.count += 1;
    groupedDistribution.set(key, current);
  });
  async function toggleRo(roId: string) {
    const opening = !expandedRos[roId];
    setExpandedRos((items) => ({ ...items, [roId]: opening }));
    if (!opening || roDetails[roId] || roLoading[roId]) return;
    setRoLoading((items) => ({ ...items, [roId]: true }));
    try {
      setBrowserToken();
      const response = await browserApi.masterRo.roControllerGetDetail(roId);
      setRoDetails((items) => ({ ...items, [roId]: envelopeData<Row>(response) ?? {} }));
    } catch (error) {
      setRoDetails((items) => ({ ...items, [roId]: { error: apiErrorMessage(error) } }));
    } finally {
      setRoLoading((items) => ({ ...items, [roId]: false }));
    }
  }

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/proyek" />}>
            <ArrowLeft size={16} /> Semua Proyek
          </Button>
          <h1 className="text-2xl font-bold">{project.nama_proyek}</h1>
          <p className="text-sm text-muted-foreground">
            {project.kode_proyek} · Tahun {project.tahun_fiscal} · Diajukan {formatDate(project.created_at)}
          </p>
        </div>
        <StatusBadge status={projectStatusTone(status)}>{humanizeStatus(status)}</StatusBadge>
      </header>
      {detail.error && (
        <Alert variant="destructive">
          <AlertDescription>{apiErrorMessage(detail.error)}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Status pengajuan</p>
            <p className="text-sm text-muted-foreground">{String(project.catatan_validasi ?? "Belum ada catatan validasi.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isUmum && status === "MENUNGGU_VALIDASI_UMUM" && (
              <Button variant="outline" onClick={() => openWorkflow("umum")}>
                <Check size={16} /> Validasi Umum
              </Button>
            )}
            {isSubmitter && status === "MENUNGGU_NOTULEN" && (
              <Button variant="outline" onClick={() => openWorkflow("notulen")}>
                <Upload size={16} /> Unggah Notulen
              </Button>
            )}
            {(identity.role === "pimpinan" || identity.role === "superadmin") && status === "MENUNGGU_VALIDASI_PIMPINAN" && (
              <Button variant="outline" onClick={() => openWorkflow("pimpinan")}>
                <Check size={16} /> Validasi Pimpinan
              </Button>
            )}
          </div>
        </div>
        <div className="mt-5 border-t pt-4">
          <div className="mb-5">
            <p className="text-sm font-semibold">Alur persetujuan proyek</p>
            <p className="text-xs text-muted-foreground">Proses berjalan berurutan. Rencana Operasional (RO) aktif setelah persetujuan pimpinan.</p>
          </div>
          {(() => {
            const steps = ["Pengajuan proyek", "Validasi Koordinator Umum", "Unggah notulen", "Persetujuan pimpinan"];
            const currentIndex = status === "MENUNGGU_VALIDASI_UMUM" ? 1 : status === "MENUNGGU_NOTULEN" ? 2 : status === "MENUNGGU_VALIDASI_PIMPINAN" ? 3 : status === "DISETUJUI_PIMPINAN" ? 4 : 0;
            const rejected = String(status).startsWith("DITOLAK");
            return (
              <ol className="grid grid-cols-1 gap-0 sm:grid-cols-4">
                {steps.map((step, index) => {
                  const complete = !rejected && index < currentIndex;
                  const active = !rejected && index === currentIndex && currentIndex < steps.length;
                  const color = complete ? "bg-emerald-600" : active ? "bg-primary" : "bg-border";
                  return (
                    <li key={step} className="relative flex gap-3 pb-5 last:pb-0 sm:flex-col sm:items-center sm:pb-0 sm:text-center">
                      {index < steps.length - 1 && (
                        <span aria-hidden="true" className={`absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5 ${complete ? "bg-emerald-600" : "bg-border"} sm:left-[calc(50%+16px)] sm:top-[15px] sm:h-0.5 sm:w-[calc(100%-32px)]`} />
                      )}
                      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${color}`} aria-label={complete ? "Selesai" : active ? "Sedang diproses" : "Menunggu"}>
                        {complete ? <Check size={16} /> : index + 1}
                      </span>
                      <span className="pt-1 sm:pt-2">
                        <span className={`block text-sm font-medium leading-snug ${complete ? "text-emerald-800" : active ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                        <span className={`mt-1 block text-xs ${complete ? "text-emerald-700" : active ? "text-primary" : "text-muted-foreground"}`}>{complete ? "Selesai" : active ? "Sedang diproses" : "Menunggu"}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            );
          })()}
          {String(status).startsWith("DITOLAK") && <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Pengajuan ditolak. Silakan periksa catatan validasi.</p>}
          {status === "DISETUJUI_PIMPINAN" && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Proyek disetujui pimpinan. RO telah memasuki tahap aktif.</p>}
          <p className="mt-4 text-xs text-muted-foreground">Setelah persetujuan pimpinan: validasi Keuangan dan pencairan setiap termin.</p>
        </div>
      </div>
      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Ringkasan keuangan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Validasi nilai kontrak, penggunaan plafon RO, dan distribusi margin.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${contract === directCost + margin ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {contract === directCost + margin ? "Kontrak seimbang" : "Kontrak tidak seimbang"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Nilai Kontrak" value={formatRupiah(contract)} />
          <Card label="Direct Cost" value={formatRupiah(directCost)} hint={`${roRows.length} RO · alokasi rencana ${formatRupiah(roPlan)}`} />
          <Card label="Total Margin" value={formatRupiah(margin)} hint={`Distribusi ${formatRupiah(marginDistributed)}`} />
          <Card label="Dana RO tersedia" value={formatRupiah(roTotal)} hint={termsPaid ? `Termin telah cair · terpakai ${formatRupiah(roUsed)}` : "Belum ada termin cair · dana belum tersedia"} />
        </div>
        <div className="mt-5 grid gap-5 border-t pt-4 md:grid-cols-3">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pemakaian plafon RO</span>
              <strong>{usedPercent.toFixed(1)}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRupiah(roUsed)} dari {formatRupiah(roTotal)}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margin terdistribusi</span>
              <strong>{marginPercent.toFixed(1)}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, marginPercent)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRupiah(marginDistributed)} dari {formatRupiah(margin)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Rekonsiliasi nilai</p>
            <p className="mt-1 font-semibold">
              {formatRupiah(contract)} = {formatRupiah(directCost)} + {formatRupiah(margin)}
            </p>
            <p className="text-xs text-muted-foreground">Nilai kontrak = Direct Cost + Margin</p>
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">
            Termin pencairan <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs">{termRows.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Alur Keuangan per termin: menunggu validasi → disetujui Keuangan → dicairkan. Pencairan menambah saldo RO dan mengalokasikan sisa ke dana operasional.</p>
        </div>
        <div className="grid gap-3 p-5">
          {termRows.length ? (
            termRows.map((term) => {
              const termId = String(term.id);
              const termStatus = String(term.status ?? "—");
              const finance = identity.role === "keuangan" || identity.role === "superadmin";
              return (
                <div key={termId} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      Termin {String(term.nomor_termin ?? "—")} · {String(term.persentase ?? 0)}%
                    </p>
                    <p className="text-sm font-semibold">{formatRupiah(term.nilai_termin ?? term.nilai ?? term.nominal)}</p>
                    <p className="text-xs text-muted-foreground">
                      Tahap:{" "}
                      {termStatus === "MENUNGGU_VALIDASI_KEUANGAN"
                        ? "Menunggu validasi Keuangan"
                        : termStatus === "DISETUJUI_KEUANGAN"
                          ? "Disetujui Keuangan · Menunggu pencairan"
                          : termStatus === "CAIR"
                            ? "Sudah dicairkan"
                            : humanizeStatus(termStatus)}
                      {term.dicairkan_pada ? ` · Dicairkan ${formatDate(String(term.dicairkan_pada))}` : ""}
                      {term.catatan_keuangan ? ` · ${String(term.catatan_keuangan)}` : ""}
                    </p>
                  </div>
                  {finance && (
                    <div className="flex gap-2">
                      {termStatus === "MENUNGGU_VALIDASI_KEUANGAN" && (
                        <Button size="sm" variant="outline" disabled={terminMutation.isPending} onClick={() => terminMutation.mutate({ termId, action: "validasi" })}>
                          Validasi termin
                        </Button>
                      )}
                      {termStatus === "DISETUJUI_KEUANGAN" && status === "DISETUJUI_PIMPINAN" && (
                        <Button size="sm" disabled={terminMutation.isPending} onClick={() => terminMutation.mutate({ termId, action: "cairkan" })}>
                          Cairkan termin
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada termin.</p>
          )}
        </div>
        {terminMutation.error && <p className="mt-3 text-sm text-destructive">{apiErrorMessage(terminMutation.error)}</p>}
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">
            Rencana Operasional (RO) <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs">{roRows.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Plafon, unit koordinator, realisasi, kelengkapan administrasi, dan alokasi per RO.</p>
        </div>
        <div className="grid gap-3 p-5">
          {roRows.length ? (
            roRows.map((row) => {
              const roId = String(row.id);
              const detailRow = roDetails[roId];
              const planned = Number(row.nilai_rencana) || Number(row.total_plafon) || 0;
              const available = Number(row.total_plafon) || 0;
              const usage = available > 0 ? Math.min(100, (Number(row.total_terpakai ?? 0) / available) * 100) : 0;
              const missing = [!row.no_kontrak && "No Kontrak", !row.pj && "PJ", !row.no_sk && "No SK", !row.mulai_sk && "Mulai SK", !row.berakhir_sk && "Berakhir SK"].filter(Boolean) as string[];
              const allocations = Array.isArray(detailRow?.alokasi_list) ? (detailRow.alokasi_list as Row[]) : [];
              const ledger = Array.isArray(detailRow?.transaksi_list) ? (detailRow.transaksi_list as Row[]) : [];
              return (
                <article key={roId} className="overflow-hidden rounded-xl border border-border">
                  <button
                    type="button"
                    aria-expanded={Boolean(expandedRos[roId])}
                    onClick={() => void toggleRo(roId)}
                    className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {text(row.kode_ro ?? row.kode_mak)} · {text(row.nama_ro, "RO")}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {text(row.nama_unit_koordinator)} · Tahun fiskal {text(row.tahun_fiscal)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={roStatusTone(String(row.status_ro ?? ""))}>{text(row.status_ro)}</StatusBadge>
                      <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">Rencana {formatRupiah(planned)}</span>
                      <span className={`rounded-lg px-2.5 py-1 text-xs ${available > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {available > 0 ? `Dana cair ${formatRupiah(available)}` : "Belum cair · Rp0 tersedia"}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usage >= 90 ? "bg-rose-100 text-rose-800" : usage >= 70 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {usage.toFixed(0)}% terpakai
                      </span>
                      <ChevronDown className={`size-4 transition-transform ${expandedRos[roId] ? "rotate-180" : ""}`} />
                    </span>
                  </button>
                  {expandedRos[roId] && (
                    <div className="space-y-4 border-t bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm">{missing.length ? <span className="text-amber-700">Data belum lengkap: {missing.join(", ")}</span> : <span className="text-emerald-700">Data administrasi lengkap</span>}</p>
                        <Link href={`/dashboard/ro/${roId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                          Buka detail RO <ExternalLink size={14} />
                        </Link>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${usage >= 90 ? "bg-rose-500" : usage >= 70 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${usage}%` }} />
                      </div>
                      {roLoading[roId] ? (
                        <p className="text-sm text-muted-foreground">Memuat detail RO...</p>
                      ) : detailRow?.error ? (
                        <Alert variant="destructive">
                          <AlertDescription>{String(detailRow.error)}</AlertDescription>
                        </Alert>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {[
                              ["Terpakai", formatRupiah(row.total_terpakai)],
                              ["Sisa saldo", formatRupiah(row.sisa_saldo)],
                              ["Penanggung jawab", text(row.pj)],
                              ["Periode SK", `${formatDate(String(row.mulai_sk ?? ""))} – ${formatDate(String(row.berakhir_sk ?? ""))}`],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-lg border bg-background p-3">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="mt-1 text-sm font-semibold">{value}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            No. kontrak: {text(row.no_kontrak)} · No. SK: {text(row.no_sk)}
                          </p>
                          <div className="grid gap-4 xl:grid-cols-2">
                            {[
                              ["Alokasi pegawai", allocations, "Belum ada alokasi pegawai."],
                              ["Transaksi ledger", ledger, "Belum ada transaksi ledger."],
                            ].map(([title, rows, empty]) => {
                              const list = rows as Row[];
                              return (
                                <div key={title as string} className="overflow-hidden rounded-lg border bg-background">
                                  <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">
                                    {title as string} <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
                                  </div>
                                  {list.length ? (
                                    <div className="max-h-72 overflow-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-muted text-muted-foreground">
                                          <tr>
                                            {title === "Alokasi pegawai" ? (
                                              <>
                                                <th className="p-2">Pegawai / periode</th>
                                                <th className="p-2">Status</th>
                                                <th className="p-2 text-right">Nilai</th>
                                              </>
                                            ) : (
                                              <>
                                                <th className="p-2">Tanggal / kegiatan</th>
                                                <th className="p-2 text-right">Debit</th>
                                                <th className="p-2 text-right">Kredit</th>
                                                <th className="p-2 text-right">Saldo</th>
                                              </>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {list.map((item, index) => (
                                            <tr key={String(item.id ?? index)} className="border-t">
                                              {title === "Alokasi pegawai" ? (
                                                <>
                                                  <td className="p-2">
                                                    {text(item.nama_pegawai ?? (item.pegawai as Row | undefined)?.nama)}
                                                    <span className="block text-muted-foreground">
                                                      {String(item.periode_bulan ?? "")}/{text(item.periode_tahun, "")}
                                                    </span>
                                                  </td>
                                                  <td className="p-2">{text(item.status)}</td>
                                                  <td className="p-2 text-right">{formatRupiah(item.jumlah ?? item.nominal ?? item.nilai)}</td>
                                                </>
                                              ) : (
                                                <>
                                                  <td className="p-2">
                                                    {formatDate(String(item.tanggal ?? ""))}
                                                    <span className="block text-muted-foreground">{text(item.nama_kegiatan)}</span>
                                                  </td>
                                                  <td className="p-2 text-right">{formatRupiah(item.debit)}</td>
                                                  <td className="p-2 text-right">{formatRupiah(item.kredit)}</td>
                                                  <td className="p-2 text-right">{formatRupiah(item.saldo)}</td>
                                                </>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="p-3 text-xs text-muted-foreground">{empty as string}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada RO terkait.</p>
          )}
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">Dokumen proyek</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dokumen administrasi yang tersimpan dan dapat dibuka.</p>
        </div>
        <div className="p-5">
          <DocumentLinks
            documents={[
              { label: "SK Proyek", path: project.file_sk },
              { label: "RAB Proyek", path: project.file_rab },
              { label: "Notulen", path: project.file_notulen },
            ]}
          />
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">Distribusi margin per kategori dan unit</h2>
          <p className="mt-1 text-sm text-muted-foreground">Realisasi pemindahan margin proyek ke dana operasional.</p>
        </div>
        <div className="overflow-x-auto p-5">
          {groupedDistribution.size ? (
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Unit penerima</th>
                  <th className="p-3 text-right">Transaksi</th>
                  <th className="p-3 text-right">Nilai distribusi</th>
                  <th className="p-3 text-right">Porsi margin</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(groupedDistribution.values()).map((group) => (
                  <tr key={`${group.category}:${group.unit}`} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">{group.category.replaceAll("_", " ")}</td>
                    <td className="p-3">{group.unit}</td>
                    <td className="p-3 text-right">{group.count}</td>
                    <td className="p-3 text-right font-semibold">{formatRupiah(group.amount)}</td>
                    <td className="p-3 text-right">{margin ? `${((group.amount / margin) * 100).toFixed(1)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada distribusi margin tercatat.</p>
          )}
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">Acuan pengaturan margin</h2>
          <p className="mt-1 text-sm text-muted-foreground">Persentase global dibanding distribusi aktual proyek.</p>
        </div>
        <div className="overflow-x-auto p-5">
          {settingRows.length ? (
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Unit penerima</th>
                  <th className="p-3 text-right">Persentase acuan</th>
                  <th className="p-3 text-right">Nilai acuan proyek</th>
                  <th className="p-3 text-right">Distribusi aktual</th>
                </tr>
              </thead>
              <tbody>
                {settingRows.map((setting, index) => {
                  const category = text(setting.kategori_kamar);
                  const actual = distributionRows.filter((row) => text(row.dana_kategori ?? (row.dana as Row | undefined)?.kategori_kamar) === category).reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
                  const pct = Number(setting.persentase) || 0;
                  return (
                    <tr key={String(setting.id ?? index)} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{text(setting.nama_kamar ?? category)}</td>
                      <td className="p-3">{text(setting.nama_unit ?? (setting.unit as Row | undefined)?.nama_unit)}</td>
                      <td className="p-3 text-right">{pct}%</td>
                      <td className="p-3 text-right">{formatRupiah((margin * pct) / 100)}</td>
                      <td className="p-3 text-right font-semibold">{formatRupiah(actual)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">Pengaturan margin tidak tersedia.</p>
          )}
        </div>
      </section>
      <Dialog open={workflow !== null} onOpenChange={(value) => !value && setWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{workflow === "notulen" ? "Unggah Notulen" : `Validasi ${workflow === "umum" ? "Bagian Umum" : "Pimpinan"}`}</DialogTitle>
            <DialogDescription>{workflow === "notulen" ? "Unggah PDF, DOC, atau DOCX notulen." : "Pilih setuju atau tolak. Catatan wajib saat menolak."}</DialogDescription>
          </DialogHeader>
          {workflow === "notulen" ? (
            <DocumentUploadField label="Dokumen Notulen" accept=".pdf,.doc,.docx" value={file} onChange={setFile} currentFile={typeof project.file_notulen === "string" ? project.file_notulen : null} />
          ) : (
            <>
              <div className="flex gap-2">
                <Button type="button" variant={approved ? "default" : "outline"} onClick={() => setApproved(true)}>
                  Setujui
                </Button>
                <Button type="button" variant={!approved ? "destructive" : "outline"} onClick={() => setApproved(false)}>
                  Tolak
                </Button>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                Catatan{!approved ? " *" : ""}
                <textarea className="min-h-24 rounded-md border bg-background p-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
            </>
          )}
          {actionError && (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkflow(null)}>
              Batal
            </Button>
            <Button disabled={workflowMutation.isPending} onClick={submitWorkflow}>
              {workflowMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Proses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
