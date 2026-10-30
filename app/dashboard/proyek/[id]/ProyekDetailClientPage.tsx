"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ExternalLink, LoaderCircle, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { ProjectFinalReportButton } from "@/components/proyek/ProjectFinalReportButton";
import { MoneyFlow } from "@/components/common/MoneyFlow";
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
const financeOf = (row: Row): Row => (row.balance && typeof row.balance === "object" ? (row.balance as Row) : {});

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
      return browserApi.masterProyek.proyekControllerGetTermin(id, { format: "json" });
    },
  });
  const settings = use_query({
    tag: "masterPengaturanMargin",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterPengaturanMargin.pengaturanMarginControllerGetData({ format: "json" });
    },
  });
  const distribution = use_query({
    tag: "masterProyek",
    method: "distribusi",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetDistribusi(id, { format: "json" });
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
  const settingsData = envelopeData<Row>(settings.data);
  const settingRows = Array.isArray(settingsData?.list) ? (settingsData.list as Row[]) : [];
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
  const approvedRoBudget = roRows.reduce((total, row) => total + (Number(financeOf(row).pagu_disetujui) || 0), 0);
  const roUsed = roRows.reduce((total, row) => total + (Number(financeOf(row).realisasi ?? row.total_terpakai) || 0), 0);
  const roCommitments = roRows.reduce((total, row) => total + (Number(financeOf(row).komitmen_aktif) || 0), 0);
  const roCashReceived = roRows.reduce((total, row) => total + (Number(financeOf(row).penerimaan_kas ?? row.trx_debit) || 0), 0);
  const roCashPosition = roRows.reduce((total, row) => total + (Number(financeOf(row).posisi_kas) || 0), 0);
  const roRemainingRight = roRows.reduce((total, row) => total + (Number(financeOf(row).sisa_hak_belanja ?? row.sisa_saldo) || 0), 0);
  const termTotal = termRows.reduce((sum, term) => sum + (Number(term.nilai_termin ?? term.nilai ?? term.nominal) || 0), 0);
  const termPaid = termRows.filter((term) => String(term.status) === "CAIR").reduce((sum, term) => sum + (Number(term.nilai_termin ?? term.nilai ?? term.nominal) || 0), 0);
  const termRemaining = Math.max(0, termTotal - termPaid);
  const marginDistributed = distributionRows.reduce((total, row) => total + (Number(row.debit) || 0), 0);
  const directCost = Number(project.total_direct_cost) || 0;
  const margin = Number(project.total_margin) || 0;
  const marginRemaining = Math.max(0, margin - marginDistributed);
  const contract = Number(project.nilai_kontrak) || 0;
  const usedPercent = approvedRoBudget ? Math.min(100, ((roUsed + roCommitments) / approvedRoBudget) * 100) : 0;
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
        <div className="flex flex-wrap items-center gap-2">
          <ProjectFinalReportButton project={project} />
          <StatusBadge status={projectStatusTone(status)}>{humanizeStatus(status)}</StatusBadge>
        </div>
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
          <p className="mt-4 text-xs text-muted-foreground">Setelah proyek disetujui, Billing menerbitkan invoice dan Bendahara mencatat pembayaran setelah dana masuk.</p>
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
          <Card label="Posisi kas seluruh RO" value={formatRupiah(roCashPosition)} hint={`Kas masuk ${formatRupiah(roCashReceived)} · realisasi ${formatRupiah(roUsed)}`} />
        </div>
        <div className="mt-5 grid gap-4 border-t pt-5 xl:grid-cols-2">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Hak belanja seluruh RO</p>
              <p className="text-xs text-muted-foreground">Pagu yang disetujui dikurangi realisasi dan komitmen aktif.</p>
            </div>
            <MoneyFlow items={[
              { label: "Pagu disetujui", amount: approvedRoBudget },
              { label: "Realisasi", amount: roUsed, operator: "−", tone: "text-rose-700" },
              { label: "Komitmen aktif", amount: roCommitments, operator: "−", tone: "text-amber-700" },
              { label: "Sisa hak belanja", amount: roRemainingRight, operator: "=", tone: roRemainingRight < 0 ? "text-rose-700" : "text-emerald-700" },
            ]} />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Arus kas seluruh RO</p>
              <p className="text-xs text-muted-foreground">Penerimaan dari invoice dikurangi realisasi belanja.</p>
            </div>
            <MoneyFlow items={[
              { label: "Penerimaan kas", amount: roCashReceived, tone: "text-sky-700" },
              { label: "Realisasi", amount: roUsed, operator: "−", tone: "text-rose-700" },
              { label: "Posisi kas", amount: roCashPosition, operator: "=", tone: roCashPosition < 0 ? "text-rose-700" : "text-foreground" },
            ]} />
          </div>
        </div>
        <div className="mt-5 grid gap-5 border-t pt-4 md:grid-cols-2">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pemakaian pagu RO</span>
              <strong>{usedPercent.toFixed(1)}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRupiah(roUsed + roCommitments)} dari {formatRupiah(approvedRoBudget)}
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
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">
            Jadwal termin invoice <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs">{termRows.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Termin menjadi jadwal tagihan. Status cair hanya berubah setelah Bendahara mencatat pembayaran invoice hingga lunas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Total nilai termin" value={formatRupiah(termTotal)} hint={`${termRows.length} termin`} />
            <Card label="Sudah cair" value={formatRupiah(termPaid)} hint={`${termRows.filter((term) => String(term.status) === "CAIR").length} termin dicairkan`} />
            <Card label="Belum cair" value={formatRupiah(termRemaining)} hint={`${termRows.filter((term) => String(term.status) !== "CAIR").length} termin tersisa`} />
            <Card label="Progres pencairan" value={`${termTotal ? ((termPaid / termTotal) * 100).toFixed(1) : "0.0"}%`} hint="Berdasarkan nilai termin" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${termTotal ? Math.min(100, (termPaid / termTotal) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="grid gap-3 p-5">
          {termRows.length ? (
            termRows.map((term) => {
              const termStatus = String(term.status ?? "—");
              const invoice = term.invoice && typeof term.invoice === "object" ? (term.invoice as Row) : undefined;
              const invoiceStatus = String(invoice?.status ?? "");
              const stage = termStatus === "CAIR" || invoiceStatus === "LUNAS"
                ? "Cair · invoice lunas"
                : invoiceStatus === "DITOLAK_KEUANGAN"
                    ? "Invoice ditolak Keuangan"
                    : invoiceStatus === "SEBAGIAN_DIBAYAR"
                      ? "Invoice dibayar sebagian"
                      : invoiceStatus === "DITERBITKAN"
                        ? "Menunggu pembayaran invoice"
                        : "Menunggu pengajuan invoice oleh Billing";
              return (
                <div key={String(term.id)} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      Termin {String(term.nomor_termin ?? "—")} · {String(term.persentase ?? 0)}%
                    </p>
                    <p className="text-sm font-semibold">{formatRupiah(term.nilai_termin ?? term.nilai ?? term.nominal)}</p>
                    <p className="text-xs text-muted-foreground">
                      Tahap: {stage}
                      {term.dicairkan_pada ? ` · Dicairkan ${formatDate(String(term.dicairkan_pada))}` : ""}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada termin.</p>
          )}
        </div>
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
              const roFinance = { ...financeOf(row), ...financeOf(detailRow ?? {}) };
              const approved = Number(roFinance.pagu_disetujui) || 0;
              const realized = Number(roFinance.realisasi ?? row.total_terpakai) || 0;
              const commitments = Number(roFinance.komitmen_aktif) || 0;
              const remainingRight = Number(roFinance.sisa_hak_belanja ?? row.sisa_saldo) || 0;
              const cashReceived = Number(roFinance.penerimaan_kas ?? row.trx_debit) || 0;
              const cashPosition = Number(roFinance.posisi_kas) || 0;
              const usage = approved > 0 ? Math.min(100, ((realized + commitments) / approved) * 100) : 0;
              const missing = [!row.no_kontrak && "No Kontrak", !row.pj && "PJ", !row.nomor_job && !row.no_sk && "Nomor Job", !row.mulai_sk && "Mulai SK", !row.berakhir_sk && "Berakhir SK"].filter(Boolean) as string[];
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
                      <span className="block font-semibold">{text(row.nama_ro, "RO")}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {text(row.nama_unit_koordinator)} · Tahun fiskal {text(row.tahun_fiscal)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={roStatusTone(String(row.status_ro ?? ""))}>{text(row.status_ro)}</StatusBadge>
                      <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">Pagu {formatRupiah(approved || planned)}</span>
                      <span className={`rounded-lg px-2.5 py-1 text-xs ${remainingRight < 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>Sisa hak {formatRupiah(remainingRight)}</span>
                      <span className={`rounded-lg px-2.5 py-1 text-xs ${cashPosition < 0 ? "bg-rose-100 text-rose-800" : "bg-muted text-foreground"}`}>Posisi kas {formatRupiah(cashPosition)}</span>
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
                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hak belanja</p>
                              <MoneyFlow items={[
                                { label: "Pagu disetujui", amount: approved },
                                { label: "Realisasi", amount: realized, operator: "−", tone: "text-rose-700" },
                                { label: "Komitmen aktif", amount: commitments, operator: "−", tone: "text-amber-700" },
                                { label: "Sisa hak belanja", amount: remainingRight, operator: "=", tone: remainingRight < 0 ? "text-rose-700" : "text-emerald-700" },
                              ]} />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arus kas</p>
                              <MoneyFlow items={[
                                { label: "Penerimaan kas", amount: cashReceived, tone: "text-sky-700" },
                                { label: "Realisasi", amount: realized, operator: "−", tone: "text-rose-700" },
                                { label: "Posisi kas", amount: cashPosition, operator: "=", tone: cashPosition < 0 ? "text-rose-700" : "text-foreground" },
                              ]} />
                            </div>
                          </div>
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p><span className="text-muted-foreground">Penanggung jawab:</span> {text(row.pj)}</p>
                            <p><span className="text-muted-foreground">Periode SK:</span> {formatDate(String(row.mulai_sk ?? ""))} – {formatDate(String(row.berakhir_sk ?? ""))}</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            No. kontrak: {text(row.no_kontrak)} · {row.nomor_job ? `No. Job: ${text(row.nomor_job)}` : `No. SK: ${text(row.no_sk)}`}
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
          <h2 className="font-semibold">Realisasi margin per kategori dan unit</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acuan, nilai yang sudah disalurkan, dan sisa per kategori dalam satu tabel.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Card label="Target margin" value={formatRupiah(margin)} />
            <Card label="Sudah didistribusikan" value={formatRupiah(marginDistributed)} hint={`${marginPercent.toFixed(1)}% dari target`} />
            <Card label="Sisa belum didistribusikan" value={formatRupiah(marginRemaining)} hint="Target dikurangi realisasi" />
          </div>
        </div>
        <div className="overflow-x-auto p-5">
          {settingRows.length ? (
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Unit penerima</th>
                  <th className="p-3 text-right">Persentase acuan</th>
                  <th className="p-3 text-right">Nilai acuan</th>
                  <th className="p-3 text-right">Transaksi</th>
                  <th className="p-3 text-right">Sudah disalurkan</th>
                  <th className="p-3 text-right">Sisa acuan</th>
                </tr>
              </thead>
              <tbody>
                {settingRows.map((setting, index) => {
                  const category = text(setting.kategori_kamar);
                  const unit = text(setting.nama_unit ?? (setting.unit as Row | undefined)?.nama_unit);
                  const matchingRows = distributionRows.filter(
                    (row) => text(row.dana_kategori ?? (row.dana as Row | undefined)?.kategori_kamar) === category && text((row.unit as Row | undefined)?.nama_unit ?? (row.dana as Row | undefined)?.nama_unit) === unit,
                  );
                  const actual = matchingRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
                  const pct = Number(setting.persentase) || 0;
                  const target = (margin * pct) / 100;
                  return (
                    <tr key={String(setting.id ?? index)} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium">{text(setting.nama_kamar ?? category)}</td>
                      <td className="p-3">{unit}</td>
                      <td className="p-3 text-right">{pct}%</td>
                      <td className="p-3 text-right">{formatRupiah(target)}</td>
                      <td className="p-3 text-right">{matchingRows.length}</td>
                      <td className="p-3 text-right font-semibold">{formatRupiah(actual)}</td>
                      <td className="p-3 text-right">{formatRupiah(Math.max(0, target - actual))}</td>
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
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">{text(project.nama_proyek)}</p>
                <p className="text-muted-foreground">
                  {text(project.kode_proyek)} · {humanizeStatus(project.status_proyek)}
                </p>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Keputusan validasi</legend>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${approved ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={approved} onChange={() => setApproved(true)} className="mt-1 accent-primary" />
                  <span>
                    <span className="block text-sm font-medium">Setujui</span>
                    <span className="block text-xs text-muted-foreground">Lanjutkan pengajuan ke proses berikutnya.</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!approved ? "border-destructive bg-destructive/5" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={!approved} onChange={() => setApproved(false)} className="mt-1 accent-destructive" />
                  <span>
                    <span className="block text-sm font-medium">Tolak</span>
                    <span className="block text-xs text-muted-foreground">Pengajuan dikembalikan dengan catatan.</span>
                  </span>
                </label>
              </fieldset>
              <label className="grid gap-1.5 text-sm font-medium">
                Catatan{!approved ? <span className="text-destructive">(wajib saat menolak)</span> : null}
                <textarea
                  rows={3}
                  placeholder={approved ? "Catatan tambahan (opsional)" : "Tuliskan alasan penolakan"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
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
