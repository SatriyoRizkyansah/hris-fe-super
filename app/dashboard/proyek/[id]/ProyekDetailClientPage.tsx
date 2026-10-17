"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, envelopeRows, unwrapEnvelope, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, humanizeStatus, projectStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { ProyekItemDto } from "@/lib/api/generated/api-generated";

type Workflow = "umum" | "pimpinan" | "notulen" | null;
type Row = Record<string, unknown>;

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
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
  const roTotal = roRows.reduce((total, row) => total + (Number(row.total_plafon) || 0), 0);
  const roUsed = roRows.reduce((total, row) => total + (Number(row.total_terpakai) || 0), 0);
  const marginDistributed = distributionRows.reduce((total, row) => total + (Number(row.debit) || 0), 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/proyek" />}>
            <ArrowLeft size={16} /> Semua Proyek
          </Button>
          <h1 className="text-2xl font-semibold">{project.nama_proyek}</h1>
          <p className="text-sm text-muted-foreground">
            {project.kode_proyek} · Tahun {project.tahun_fiscal} · Diajukan {formatDate(project.created_at)}
          </p>
        </div>
        <StatusBadge status={projectStatusTone(status)}>{humanizeStatus(status)}</StatusBadge>
      </div>
      {detail.error && (
        <Alert variant="destructive">
          <AlertDescription>{apiErrorMessage(detail.error)}</AlertDescription>
        </Alert>
      )}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Status pengajuan</p>
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
        <p className="mt-3 text-xs text-muted-foreground">Urutan: validasi umum, unggah notulen, validasi pimpinan, validasi keuangan per termin, pencairan termin.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Nilai Kontrak" value={formatRupiah(project.nilai_kontrak)} />
        <Card label="Direct Cost" value={formatRupiah(project.total_direct_cost)} hint={`${roRows.length} RO`} />
        <Card label="Margin" value={formatRupiah(project.total_margin)} hint={`Terdistribusi ${formatRupiah(marginDistributed)}`} />
        <Card label="Realisasi RO" value={formatRupiah(roUsed)} hint={`Sisa ${formatRupiah(roTotal - roUsed)}`} />
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Termin pencairan</h2>
        <div className="mt-3 grid gap-3">
          {termRows.length ? (
            termRows.map((term) => {
              const termId = String(term.id);
              const termStatus = String(term.status ?? "—");
              const finance = identity.role === "keuangan" || identity.role === "superadmin";
              return (
                <div key={termId} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      Termin {String(term.nomor_termin ?? "—")} · {String(term.persentase ?? 0)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatRupiah(term.nilai ?? term.nominal)} · {humanizeStatus(termStatus)}
                    </p>
                  </div>
                  {finance && (
                    <div className="flex gap-2">
                      {termStatus === "MENUNGGU_VALIDASI_KEUANGAN" && (
                        <Button size="sm" variant="outline" disabled={terminMutation.isPending} onClick={() => terminMutation.mutate({ termId, action: "validasi" })}>
                          Validasi
                        </Button>
                      )}
                      {termStatus === "DISETUJUI_KEUANGAN" && status === "DISETUJUI_PIMPINAN" && (
                        <Button size="sm" disabled={terminMutation.isPending} onClick={() => terminMutation.mutate({ termId, action: "cairkan" })}>
                          Cairkan
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
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">RO terkait</h2>
        <div className="mt-3 grid gap-2">
          {roRows.length ? (
            roRows.map((row) => (
              <Link key={String(row.id)} href={`/dashboard/ro/${String(row.id)}`} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted">
                <span>
                  <span className="font-medium">{String(row.nama_ro ?? "RO")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {String(row.kode_mak ?? "—")} · {String(row.nama_unit_koordinator ?? "—")}
                  </span>
                </span>
                <span className="text-sm">{formatRupiah(row.sisa_saldo)}</span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada RO terkait.</p>
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
            <Input type="file" accept=".pdf,.doc,.docx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
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
    </div>
  );
}
