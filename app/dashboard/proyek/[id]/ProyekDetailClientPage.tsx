"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, FileClock, LoaderCircle, Pencil, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { ProjectFinalReportButton } from "@/components/proyek/ProjectFinalReportButton";
import { EmptyData } from "@/components/loading/EmptyData";
import { ProjectFinancialSections } from "@/components/proyek/ProjectFinancialSections";
import { ProjectRoSection } from "@/components/proyek/ProjectRoSection";
import { ProjectApplicationModal } from "@/components/proyek/ProjectApplicationModal";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, envelopeRows, requestHrisApi, unwrapEnvelope, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, humanizeStatus, projectStatusLabel, projectStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import { createClientId } from "@/lib/utils/client-id";
import type { JobDraft, JobMetadataField, KategoriJob, ProjectForm, RoDraft, TerminDraft } from "@/components/proyek/project-form.types";
import type { ProyekItemDto } from "@/lib/api/generated/api-generated";

type Workflow = "layanan" | "umum" | "pimpinan" | "notulen" | "bast" | null;
type Row = Record<string, unknown>;
type ProjectRevisionRow = { id: string; nomor_revisi: number; tahap: string; alasan: string; diminta_oleh_id: string; diminta_pada: string; diajukan_ulang_oleh_id?: string | null; diajukan_ulang_pada?: string | null };
type ProjectExtensionRow = {
  id: string;
  berakhir_sk_sebelumnya: string;
  berakhir_sk_baru: string;
  alasan: string;
  file_dokumen: string;
  status: string;
  diajukan_pada: string;
  diajukan_oleh?: { nama?: string } | null;
  diperiksa_pada?: string | null;
  diperiksa_oleh?: { nama?: string } | null;
  catatan_pemeriksa?: string | null;
};
type ProjectDetail = ProyekItemDto & {
  file_bast?: string | null;
  selesai_oleh_id?: string | null;
  selesai_pada?: string | null;
  perpanjangan_list?: ProjectExtensionRow[];
  alur_proyek_version?: number;
  riwayat_revisi?: ProjectRevisionRow[];
  catatan_layanan?: string | null;
  divalidasi_layanan_pada?: string | null;
  job_list?: Array<{ id: string; nomor_job: string; nama_job?: string | null; kategori_job?: JobDraft["kategori_job"] | null; ro_list: Array<{ id: string; nama_ro: string; mak_id?: string | null; mak?: { id?: string; kode_mak?: string; nama_mak?: string } | null; id_unit_koordinator: string; rekening_id?: string | null; plafon: number; no_kontrak?: string | null; pj?: string | null; unit_kolaborasi_ids?: string[] }> }>;
  ro_list?: Array<{ id: string; job_proyek_id?: string | null; nomor_job?: string | null; nama_job?: string | null; kategori_job?: JobDraft["kategori_job"] | null; nama_ro: string; mak_id?: string | null; mak?: { id?: string; kode_mak?: string; nama_mak?: string } | null; id_unit_koordinator: string; rekening_id?: string | null; plafon: number; no_kontrak?: string | null; pj?: string | null; unit_kolaborasi_ids?: string[] }>;
  termin_list?: Array<{ id: string; nomor_termin: number; persentase: number; nilai_termin: number; has_invoice?: boolean }>;
  unit_terlibat?: Array<{ id: string; peran?: string }>;
};
type LookupRow = { id: string; [key: string]: unknown };
type Option = { value: string; label: string };
const blankProjectForm = (): ProjectForm => ({ kode_proyek: "", nama_proyek: "", tahun_fiscal: String(new Date().getFullYear()), mulai_kontrak: "", berakhir_kontrak: "", sumber_pendanaan: "", nama_client: "", no_kontrak: "", pj_1: "", pj_2: "", nilai_kontrak: "", total_direct_cost: "", total_margin: "" });
const blankRevisionRo = (unitId = ""): RoDraft => ({ key: createClientId(), mak_id: "", id_unit_koordinator: unitId, rekening_id: "", plafon: 0, plafonText: "", detailMode: "later", no_kontrak: "", pj: "", unit_kolaborasi_ids: [] });
const blankRevisionJob = (unitId = ""): JobDraft => ({ key: createClientId(), nama_job: "", kategori_job: "", ros: [blankRevisionRo(unitId)] });
const blankRevisionTerm = (percentage = ""): TerminDraft => ({ key: createClientId(), nomor_termin: 1, persentase: Number(percentage) || 0, persentaseText: percentage });
const normalizeUnitId = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const text = (value: unknown, fallback = "—") => (value === null || value === undefined || value === "" ? fallback : String(value));
const financeOf = (row: Row): Row => (row.balance && typeof row.balance === "object" ? (row.balance as Row) : {});
const dateKey = (value: unknown) => String(value ?? "").slice(0, 10);
const statusIsApproved = (value?: string) => value === "DISETUJUI_PIMPINAN";

function jakartaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

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
  const [requestRevision, setRequestRevision] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionForm, setRevisionForm] = useState<ProjectForm>(blankProjectForm);
  const [revisionJobs, setRevisionJobs] = useState<JobDraft[]>([blankRevisionJob()]);
  const reservationRequests = useRef(new Set<string>());
  const [revisionLeadUnitId, setRevisionLeadUnitId] = useState("");
  const [revisionCollaboratorIds, setRevisionCollaboratorIds] = useState<string[]>([]);
  const [revisionTerms, setRevisionTerms] = useState<TerminDraft[]>([blankRevisionTerm("100")]);
  const [revisionContractFile, setRevisionContractFile] = useState<File | null>(null);
  const [revisionRabFile, setRevisionRabFile] = useState<File | null>(null);
  const [revisionError, setRevisionError] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState("");
  const [coordinatorCode, setCoordinatorCode] = useState("");
  const [expandedRos, setExpandedRos] = useState<Record<string, boolean>>({});
  const [roDetails, setRoDetails] = useState<Record<string, Row>>({});
  const [roLoading, setRoLoading] = useState<Record<string, boolean>>({});
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [extensionEndDate, setExtensionEndDate] = useState("");
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionFile, setExtensionFile] = useState<File | null>(null);
  const [extensionError, setExtensionError] = useState("");
  const [reviewingExtension, setReviewingExtension] = useState<ProjectExtensionRow | null>(null);
  const [extensionApproved, setExtensionApproved] = useState(true);
  const [extensionReviewNote, setExtensionReviewNote] = useState("");
  const [extensionReviewError, setExtensionReviewError] = useState("");

  const detail = use_query({
    tag: "masterProyek",
    method: "detail",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekGetDetailControllerGetDetail(id);
    },
  });
  const ros = use_query({
    tag: "masterRo",
    method: "byProject",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRo.roGetDataControllerGetData({ id_proyek: id, limit: 100, page: 1 });
    },
  });
  const terms = use_query({
    tag: "masterProyek",
    method: "termin",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekGetTerminControllerGetTermin(id, { format: "json" });
    },
  });
  const settings = use_query({
    tag: "masterPengaturanMargin",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterPengaturanMargin.pengaturanMarginGetDataControllerGetData({ format: "json" });
    },
  });
  const distribution = use_query({
    tag: "masterProyek",
    method: "distribusi",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekGetDistribusiControllerGetDistribusi(id, { format: "json" });
    },
  });
  const units = use_query({
    tag: "masterUnitKerja",
    method: "list",
    params: { purpose: "project-collaborators" },
    queryFn: async () => {
      setBrowserToken();
      return requestHrisApi("/api/unit-kerja/kolaborator-proyek?limit=200", { method: "GET" });
    },
  });
  const makLookup = use_query({
    tag: "masterMak",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterMak.masterMakFindAllControllerFindAll({ format: "json" });
    },
  });
  const rekeningLookup = use_query({
    tag: "masterRekeningBank",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRekeningBank.masterRekeningFindAllControllerFindAll({ format: "json" });
    },
  });
  const project = envelopeData<ProjectDetail>(detail.data);
  const roRows = envelopeRows<Row>(ros.data);
  const hasRestrictedRos = roRows.some((row) => row.can_access_detail === false);
  const roGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; rows: Row[] }>();
    for (const row of roRows) {
      const id = String(row.id_unit_koordinator ?? row.nama_unit_koordinator ?? "unit-tidak-diketahui");
      const name = String(row.nama_unit_koordinator ?? "Unit belum tersedia");
      const group = groups.get(id) ?? { id, name, rows: [] };
      group.rows.push(row);
      groups.set(id, group);
    }
    return [...groups.values()].sort((left, right) => left.name.localeCompare(right.name, "id"));
  }, [roRows]);
  const termRows = envelopeRows<Row>(terms.data);
  const distributionRows = envelopeRows<Row>(distribution.data);
  const settingsData = envelopeData<Row>(settings.data);
  const settingRows = Array.isArray(settingsData?.list) ? (settingsData.list as Row[]) : [];
  const unitOptions = envelopeRows<LookupRow>(units.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const makOptions = envelopeRows<LookupRow & { kode_mak?: string; nama_mak?: string; tipe_akun?: string }>(makLookup.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const rekeningOptions = envelopeRows<LookupRow>(rekeningLookup.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const currentUnit = unitOptions.find((unit) => String(unit.id) === identity.unitKerjaId);
  const unitComboboxOptions: Option[] = unitOptions.map((unit) => ({ value: unit.id, label: [unit.kode_unit, unit.nama_unit].filter(Boolean).join(" — ") }));
  const makComboboxOptions: Option[] = makOptions.map((mak) => ({ value: mak.id, label: [mak.kode_mak, mak.nama_mak, mak.tipe_akun ? `(${mak.tipe_akun})` : ""].filter(Boolean).join(" — ") }));
  const makNameById = Object.fromEntries(makOptions.map((mak) => [mak.id, String(mak.nama_mak ?? "")]));
  const rekeningComboboxOptions: Option[] = rekeningOptions.map((account) => ({ value: account.id, label: [account.nama_bank, account.nama_rekening, account.nomor_rekening ? `(${account.nomor_rekening})` : ""].filter(Boolean).join(" — ") }));
  const revisionProjectUnitIds = [...new Set([revisionLeadUnitId, ...revisionCollaboratorIds].filter(Boolean))];
  const roUnitComboboxOptions = unitComboboxOptions.filter((option) => revisionProjectUnitIds.includes(option.value));
  const availableCollaboratorOptions = unitComboboxOptions.filter((option) => option.value !== revisionLeadUnitId && !revisionCollaboratorIds.includes(option.value));
  const revisionRoRows = revisionJobs.flatMap((job) => job.ros);
  const revisionNumeric = (key: "nilai_kontrak" | "total_direct_cost" | "total_margin") => Number(revisionForm[key]) || 0;
  const revisionContractOk = revisionNumeric("nilai_kontrak") === revisionNumeric("total_direct_cost") + revisionNumeric("total_margin");
  const revisionRoTotal = revisionRoRows.reduce((total, row) => total + (Number(row.plafonText) || 0), 0);
  const revisionTermsTotal = revisionTerms.reduce((total, term) => total + (Number(term.persentaseText) || 0), 0);
  const assignedRoUnitIds = new Set(revisionRoRows.flatMap((row) => [row.id_unit_koordinator, ...(row.unit_kolaborasi_ids ?? [])]).map(normalizeUnitId).filter(Boolean));
  const revisionCollaboratorsAssigned = revisionCollaboratorIds.every((unitId) => assignedRoUnitIds.has(normalizeUnitId(unitId)));
  const revisionAllocationsValid = revisionJobs.length > 0 && revisionJobs.every((job) => job.nama_job.trim() && job.kategori_job && job.nomor_job && (job.id || job.nomor_job_reservasi_id) && job.ros.length > 0 && job.ros.every((row) => row.mak_id && revisionProjectUnitIds.some((unitId) => normalizeUnitId(unitId) === normalizeUnitId(row.id_unit_koordinator)) && Number(row.plafonText) > 0 && (row.detailMode === "later" || row.pj.trim()) && (row.unit_kolaborasi_ids ?? []).every((unitId) => revisionProjectUnitIds.some((projectUnitId) => normalizeUnitId(projectUnitId) === normalizeUnitId(unitId)) && normalizeUnitId(unitId) !== normalizeUnitId(row.id_unit_koordinator))));
  const revisionContractDatesRequired = revisionRoRows.some((row) => row.detailMode === "detail");
  const revisionContractDatesValid = (!revisionForm.mulai_kontrak && !revisionForm.berakhir_kontrak && !revisionContractDatesRequired) || Boolean(revisionForm.mulai_kontrak && revisionForm.berakhir_kontrak && revisionForm.berakhir_kontrak >= revisionForm.mulai_kontrak);
  const serviceUnitCode = (process.env.NEXT_PUBLIC_UNIT_KODE_LAYANAN ?? "").trim().toLocaleUpperCase("id-ID");
  const umumUnitCode = (process.env.NEXT_PUBLIC_UNIT_KODE_KABAG ?? "").trim().toLocaleUpperCase("id-ID");
  const currentUnitCode = String(currentUnit?.kode_unit ?? coordinatorCode).trim().toLocaleUpperCase("id-ID");
  const isLayanan = identity.role === "superadmin" || (identity.role === "koordinator" && Boolean(serviceUnitCode) && currentUnitCode === serviceUnitCode);
  const isUmum = identity.role === "superadmin" || (identity.role === "koordinator" && Boolean(umumUnitCode) && currentUnitCode === umumUnitCode);
  const isSubmitter = identity.role === "superadmin" || (identity.role === "koordinator" && identity.userId === String(project?.diajukan_oleh_id ?? ""));

  async function reserveRevisionJobNumber(jobKey: string) {
    if (reservationRequests.current.has(jobKey)) return;
    reservationRequests.current.add(jobKey);
    try {
      setBrowserToken();
      const response = await requestHrisApi("/api/proyek/job-number/reserve", { method: "POST" });
      const reservation = unwrapEnvelope<{ id: string; nomor_job: string }>(response).data;
      if (!reservation?.id || !reservation.nomor_job) throw new Error("Nomor Job tidak diterima dari server.");
      setRevisionJobs((current) => current.map((job) => job.key === jobKey && !job.id
        ? { ...job, nomor_job: reservation.nomor_job, nomor_job_reservasi_id: reservation.id }
        : job));
    } catch (error) {
      setRevisionError(apiErrorMessage(error, "Nomor Job belum dapat disiapkan. Tutup lalu buka kembali form untuk mencoba lagi."));
    } finally {
      reservationRequests.current.delete(jobKey);
    }
  }

  useEffect(() => {
    if (!revisionOpen) return;
    for (const job of revisionJobs) {
      if (!job.id && !job.nomor_job_reservasi_id) void reserveRevisionJobNumber(job.key);
    }
  }, [revisionOpen, revisionJobs]);
  const isKarwas = identity.role === "keu_karwas" || identity.role === "superadmin";
  const extensionRows = project?.perpanjangan_list ?? [];
  const pendingExtension = extensionRows.find((item) => item.status === "DIAJUKAN");
  const projectEndDate = dateKey(project?.berakhir_kontrak);
  const extensionOpenForSubmission = Boolean(
    isSubmitter && statusIsApproved(project?.status_proyek) && projectEndDate && jakartaToday() <= projectEndDate,
  );

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
      if (workflow === "bast") {
        if (!file) throw new Error("Pilih dokumen BAST dalam format PDF.");
        return uploadHrisFile(`/api/proyek/${id}/bast`, file);
      }
       if (!workflow) throw new Error("Aksi workflow tidak dipilih.");
       if ((requestRevision || !approved) && !note.trim()) throw new Error("Catatan wajib diisi saat meminta revisi atau menolak.");
       return requestHrisApi(`/api/proyek/${id}/validasi-${workflow}`, {
         method: "POST",
         body: JSON.stringify({ disetujui: approved, minta_revisi: requestRevision, catatan: note.trim() || undefined }),
       });
    },
    onSuccess: async () => {
      await invalidate();
      setWorkflow(null);
    },
    successMessage: () => {
      if (workflow === "notulen") return "Notulen proyek berhasil diunggah.";
      if (workflow === "bast") return "Dokumen BAST berhasil diunggah. Proyek ditandai selesai.";
      if (requestRevision) return "Permintaan revisi proyek berhasil dikirim.";
      if (!approved) return "Pengajuan proyek berhasil ditolak.";
      const stageLabel = workflow === "layanan" ? "Koordinator Layanan" : workflow === "umum" ? "Bagian Umum" : "Pimpinan";
      return `Proyek berhasil disetujui pada tahap ${stageLabel}.`;
    },
  });
  function updateRevisionRo(key: string, field: keyof RoDraft, value: string) {
    setRevisionJobs((current) => current.map((job) => ({
      ...job,
      ros: job.ros.map((row) => row.key !== key ? row : {
        ...row,
        [field]: value,
        ...(field === "id_unit_koordinator" ? { unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((unitId) => normalizeUnitId(unitId) !== normalizeUnitId(value)) } : {}),
      }),
    })));
  }
  function updateRevisionJob(key: string, field: JobMetadataField, value: string) {
    setRevisionJobs((current) => current.map((job) => job.key === key ? { ...job, [field]: value } : job));
  }
  function addRevisionJob() { setRevisionJobs((current) => [...current, blankRevisionJob(revisionLeadUnitId)]); }
  function removeRevisionJob(key: string) { setRevisionJobs((current) => current.length > 1 ? current.filter((job) => job.key !== key) : current); }
  function addRevisionRo(jobKey: string) { setRevisionJobs((current) => current.map((job) => job.key === jobKey ? { ...job, ros: [...job.ros, blankRevisionRo(revisionLeadUnitId)] } : job)); }
  function removeRevisionRo(key: string) { setRevisionJobs((current) => current.map((job) => job.ros.length > 1 ? { ...job, ros: job.ros.filter((row) => row.key !== key) } : job)); }
  function addRevisionCollaborator(unitId: string) {
    if (!unitId || normalizeUnitId(unitId) === normalizeUnitId(revisionLeadUnitId) || revisionCollaboratorIds.includes(unitId)) return;
    setRevisionCollaboratorIds((current) => [...current, unitId]);
  }
  function removeRevisionCollaborator(unitId: string) {
    setRevisionCollaboratorIds((current) => current.filter((candidate) => candidate !== unitId));
    setRevisionJobs((current) => current.map((job) => ({ ...job, ros: job.ros.map((row) => ({
      ...row,
      ...(normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(unitId) ? { id_unit_koordinator: revisionLeadUnitId } : {}),
      unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((candidate) => normalizeUnitId(candidate) !== normalizeUnitId(unitId)),
    })) })));
  }
  function changeRevisionLeadUnit(unitId: string) {
    const previous = revisionLeadUnitId;
    setRevisionLeadUnitId(unitId);
    setRevisionCollaboratorIds((current) => {
      const next = current.filter((candidate) => normalizeUnitId(candidate) !== normalizeUnitId(unitId));
      if (previous && normalizeUnitId(previous) !== normalizeUnitId(unitId) && revisionRoRows.some((row) => normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(previous)) && !next.some((candidate) => normalizeUnitId(candidate) === normalizeUnitId(previous))) next.push(previous);
      return next;
    });
    setRevisionJobs((current) => current.map((job) => ({ ...job, ros: job.ros.map((row) => row.id_unit_koordinator ? row : { ...row, id_unit_koordinator: unitId }) })));
  }
  function addRevisionRoCollaborator(roKey: string, unitId: string) {
    setRevisionJobs((current) => current.map((job) => ({ ...job, ros: job.ros.map((row) => {
      if (row.key !== roKey || normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(unitId)) return row;
      const ids = row.unit_kolaborasi_ids ?? [];
      return ids.some((candidate) => normalizeUnitId(candidate) === normalizeUnitId(unitId)) ? row : { ...row, unit_kolaborasi_ids: [...ids, unitId] };
    }) })));
  }
  function removeRevisionRoCollaborator(roKey: string, unitId: string) {
    setRevisionJobs((current) => current.map((job) => ({ ...job, ros: job.ros.map((row) => row.key === roKey ? { ...row, unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((candidate) => normalizeUnitId(candidate) !== normalizeUnitId(unitId)) } : row) })));
  }
  function updateRevisionTerm(key: string, value: string) { setRevisionTerms((current) => current.map((term) => term.key === key ? { ...term, persentaseText: value } : term)); }
  function addRevisionTerm() { setRevisionTerms((current) => [...current, blankRevisionTerm()]); }
  const revisionMutation = use_mutation({
    tag: "masterProyek",
    method: "revision-resubmit",
    mutationFn: async () => {
      setBrowserToken();
      if (revisionContractFile) {
        await uploadHrisFile(`/api/proyek/${id}/sk`, revisionContractFile);
      }
      if (revisionRabFile) {
        await uploadHrisFile(`/api/proyek/${id}/rab`, revisionRabFile);
      }
      return requestHrisApi(`/api/proyek/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          kode_proyek: revisionForm.kode_proyek.trim(),
          nama_proyek: revisionForm.nama_proyek.trim(),
          tahun_fiscal: Number(revisionForm.tahun_fiscal),
          nama_client: revisionForm.nama_client.trim() || null,
          sumber_pendanaan: revisionForm.sumber_pendanaan.trim() || null,
          no_kontrak: revisionForm.no_kontrak.trim() || null,
          pj_1: revisionForm.pj_1.trim() || null,
          pj_2: revisionForm.pj_2.trim() || null,
          mulai_kontrak: revisionForm.mulai_kontrak || null,
          berakhir_kontrak: revisionForm.berakhir_kontrak || null,
          nilai_kontrak: revisionNumeric("nilai_kontrak"),
          total_direct_cost: revisionNumeric("total_direct_cost"),
          total_margin: revisionNumeric("total_margin"),
          unit_pengusul_id: revisionLeadUnitId,
          unit_kolaborasi_ids: revisionCollaboratorIds,
          job_list: revisionJobs.map((job) => ({
            ...(job.id ? { id: job.id } : {}),
            ...(!job.id && job.nomor_job_reservasi_id ? { nomor_job_reservasi_id: job.nomor_job_reservasi_id } : {}),
            nama_job: job.nama_job.trim(),
            kategori_job: job.kategori_job as KategoriJob,
            ro_list: job.ros.map((row) => ({
              ...(row.id ? { id: row.id } : {}),
              mak_id: row.mak_id,
              id_unit_koordinator: row.id_unit_koordinator,
              rekening_id: row.rekening_id || null,
              plafon: Number(row.plafonText),
              unit_kolaborasi_ids: row.unit_kolaborasi_ids ?? [],
              pj: row.detailMode === "detail" ? row.pj.trim() : "",
            })),
          })),
          termin_list: revisionTerms.map((term, index) => ({
            ...(term.id ? { id: term.id } : {}),
            nomor_termin: index + 1,
            persentase: Number(term.persentaseText),
          })),
        }),
      });
    },
    onSuccess: async () => {
      await invalidate();
      setRevisionOpen(false);
      setRevisionError("");
      setRevisionContractFile(null);
      setRevisionRabFile(null);
    },
    successMessage: "Pengajuan proyek berhasil diajukan ulang dan dikirim ke pemeriksaan Koordinator Layanan.",
  });
  const extensionMutation = use_mutation<unknown, Error, { endDate: string; reason: string; file: File }>({
    tag: "masterProyek",
    method: "extension-create",
    mutationFn: async ({ endDate, reason, file: document }) => {
      setBrowserToken();
      return uploadHrisFile(`/api/proyek/${id}/perpanjangan`, document, {
        berakhir_sk_baru: endDate,
        alasan: reason,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setExtensionOpen(false);
      setExtensionEndDate("");
      setExtensionReason("");
      setExtensionFile(null);
      setExtensionError("");
    },
    successMessage: "Pengajuan perpanjangan SK proyek berhasil dikirim ke KARWAS.",
  });
  const extensionReviewMutation = use_mutation<unknown, Error, { extensionId: string; approved: boolean; note: string }>({
    tag: "masterProyek",
    method: "extension-review",
    mutationFn: async ({ extensionId, approved: decision, note: reviewNote }) => {
      setBrowserToken();
      return requestHrisApi(`/api/proyek/${id}/perpanjangan/${extensionId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ disetujui: decision, catatan: reviewNote.trim() || undefined }),
      });
    },
    onSuccess: async () => {
      await invalidate();
      setReviewingExtension(null);
      setExtensionReviewNote("");
      setExtensionReviewError("");
    },
    successMessage: (_response, variables) => variables.approved
      ? "Perpanjangan masa SK proyek berhasil disetujui."
      : "Pengajuan perpanjangan masa SK proyek ditolak.",
  });
  function openWorkflow(action: Exclude<Workflow, null>) {
    setWorkflow(action);
    setApproved(true);
    setRequestRevision(false);
    setNote("");
    setFile(null);
    setActionError("");
  }
  function openRevisionForm() {
    if (!project) return;
    setRevisionForm({
      ...blankProjectForm(),
      kode_proyek: String(project.kode_proyek ?? ""),
      nama_proyek: String(project.nama_proyek ?? ""),
      tahun_fiscal: String(project.tahun_fiscal ?? new Date().getFullYear()),
      nama_client: String(project.nama_client ?? ""),
      sumber_pendanaan: String(project.sumber_pendanaan ?? ""),
      no_kontrak: String(project.no_kontrak ?? ""),
      pj_1: String(project.pj_1 ?? ""),
      pj_2: String(project.pj_2 ?? ""),
      mulai_kontrak: dateKey(project.mulai_kontrak),
      berakhir_kontrak: dateKey(project.berakhir_kontrak),
      nilai_kontrak: String(project.nilai_kontrak ?? 0),
      total_direct_cost: String(project.total_direct_cost ?? 0),
      total_margin: String(project.total_margin ?? 0),
    });
    const participants = project.unit_terlibat ?? [];
    const lead = participants.find((unit) => unit.peran === "PENGUSUL")?.id ?? identity.unitKerjaId;
    setRevisionLeadUnitId(lead);
    setRevisionCollaboratorIds(participants.filter((unit) => unit.peran !== "PENGUSUL").map((unit) => unit.id));
    const existingJobs = (project.job_list ?? []).map((job) => ({ ...job, ro_list: [...job.ro_list] }));
    const assignedRoIds = new Set(existingJobs.flatMap((job) => job.ro_list.map((ro) => ro.id)));
    for (const ro of project.ro_list ?? []) {
      if (assignedRoIds.has(ro.id)) continue;
      const nomorJob = String(ro.nomor_job ?? "").trim() || `JOB-${ro.id.slice(0, 8)}`;
      let group = existingJobs.find((job) => job.nomor_job === nomorJob);
      if (!group) {
        group = { id: "", nomor_job: nomorJob, nama_job: ro.nama_job ?? "", kategori_job: ro.kategori_job ?? null, ro_list: [] };
        existingJobs.push(group);
      }
      group.ro_list.push(ro);
    }
    setRevisionJobs(existingJobs.length ? existingJobs.map((job) => ({
      id: job.id,
      key: createClientId(),
      nomor_job: job.id ? job.nomor_job : undefined,
      nama_job: job.nama_job ?? "",
      kategori_job: job.kategori_job ?? "",
      ros: job.ro_list.map((row) => ({
        ...blankRevisionRo(lead),
        id: row.id,
        key: createClientId(),
        mak_id: String(row.mak_id ?? ""),
        id_unit_koordinator: row.id_unit_koordinator,
        rekening_id: String(row.rekening_id ?? ""),
        plafon: Number(row.plafon) || 0,
        plafonText: String(row.plafon ?? ""),
        pj: String(row.pj ?? ""),
        detailMode: row.pj ? "detail" : "later",
        no_kontrak: String(row.no_kontrak ?? ""),
        unit_kolaborasi_ids: row.unit_kolaborasi_ids ?? [],
      })),
    })) : [blankRevisionJob(lead)]);
    const existingTerms = [...(project.termin_list ?? [])].sort((left, right) => left.nomor_termin - right.nomor_termin);
    setRevisionTerms(existingTerms.length ? existingTerms.map((term) => ({
      id: term.id,
      key: createClientId(),
      nomor_termin: term.nomor_termin,
      persentase: term.persentase,
      persentaseText: String(term.persentase),
    })) : [blankRevisionTerm("100")]);
    setRevisionContractFile(null);
    setRevisionRabFile(null);
    setRevisionError("");
    setRevisionOpen(true);
  }
  async function submitRevision() {
    setRevisionError("");
    if (!revisionForm.kode_proyek.trim() || !revisionForm.nama_proyek.trim() || !revisionForm.tahun_fiscal.trim()) {
      setRevisionError("Kode, nama, dan tahun fiskal proyek wajib diisi.");
      return;
    }
    if (!revisionContractOk || revisionRoTotal !== revisionNumeric("total_direct_cost")) {
      setRevisionError("Nilai kontrak harus sama dengan direct cost + margin, dan total plafon RO harus sama dengan direct cost.");
      return;
    }
    if (!revisionContractDatesValid) {
      setRevisionError("Isi tanggal kontrak berpasangan dan pastikan tanggal akhir tidak sebelum tanggal mulai.");
      return;
    }
    if (!revisionLeadUnitId || !revisionCollaboratorsAssigned || !revisionAllocationsValid) {
      setRevisionError("Lengkapi unit terlibat, nama, kategori, tipe Job, dan seluruh detail RO. Setiap unit kolaborator harus digunakan pada minimal satu RO.");
      return;
    }
    if (!revisionTerms.length || revisionTerms.some((term) => !(Number(term.persentaseText) > 0)) || revisionTermsTotal !== 100) {
      setRevisionError("Rencana termin harus bernilai lebih dari 0 dan total persentasenya harus tepat 100%.");
      return;
    }
    try {
      await revisionMutation.mutateAsync();
    } catch (error) {
      setRevisionError(apiErrorMessage(error, "Pengajuan revisi gagal dikirim."));
    }
  }
  async function submitWorkflow() {
    setActionError("");
    try {
      await workflowMutation.mutateAsync();
    } catch (error) {
      setActionError(apiErrorMessage(error));
    }
  }
  async function submitExtension() {
    setExtensionError("");
    if (!extensionFile) {
      setExtensionError("Lampirkan dokumen pendukung perpanjangan SK.");
      return;
    }
    if (!extensionEndDate || extensionEndDate <= projectEndDate) {
      setExtensionError("Tanggal akhir SK baru harus setelah tanggal akhir SK saat ini.");
      return;
    }
    if (extensionReason.trim().length < 10) {
      setExtensionError("Jelaskan alasan perpanjangan minimal 10 karakter.");
      return;
    }
    try {
      await extensionMutation.mutateAsync({ endDate: extensionEndDate, reason: extensionReason.trim(), file: extensionFile });
    } catch (error) {
      setExtensionError(apiErrorMessage(error));
    }
  }
  async function submitExtensionReview() {
    if (!reviewingExtension) return;
    setExtensionReviewError("");
    if (!extensionApproved && !extensionReviewNote.trim()) {
      setExtensionReviewError("Catatan pemeriksa wajib diisi saat menolak pengajuan.");
      return;
    }
    try {
      await extensionReviewMutation.mutateAsync({
        extensionId: reviewingExtension.id,
        approved: extensionApproved,
        note: extensionReviewNote,
      });
    } catch (error) {
      setExtensionReviewError(apiErrorMessage(error));
    }
  }
  if (detail.isLoading) return <div className="p-6 text-sm text-muted-foreground">Memuat proyek...</div>;
  if (!project)
    return (
      <div className="space-y-4 p-6">
        <EmptyData label="Detail proyek belum dapat dimuat." action={<Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>Coba lagi</Button>} />
        <Button variant="outline" render={<Link href="/dashboard/proyek" />}>
          <ArrowLeft size={16} /> Kembali
        </Button>
      </div>
    );
  const status = String(project.status_proyek);
  const workflowVersion = Number(project.alur_proyek_version ?? 1);
  const isRevisionPending = status.startsWith("PERLU_REVISI_");
  const isNotulenUploader = isSubmitter || (workflowVersion >= 2 && isLayanan);
  const hasProjectActions = (extensionOpenForSubmission && !pendingExtension) || (isSubmitter && statusIsApproved(status)) || Boolean(pendingExtension && isSubmitter);
  const roPlan = roRows.reduce((total, row) => total + (Number(row.nilai_rencana) || Number(row.total_plafon) || 0), 0);
  const approvedRoBudget = roRows.reduce((total, row) => total + (Number(financeOf(row).pagu_disetujui) || 0), 0);
  const roUsed = roRows.reduce((total, row) => total + (Number(financeOf(row).realisasi ?? row.total_terpakai) || 0), 0);
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
  const usedPercent = approvedRoBudget ? Math.min(100, (roUsed / approvedRoBudget) * 100) : 0;
  const marginPercent = margin ? (marginDistributed / margin) * 100 : 0;
  async function toggleRo(roId: string) {
    const opening = !expandedRos[roId];
    setExpandedRos((items) => ({ ...items, [roId]: opening }));
    if (!opening || roDetails[roId] || roLoading[roId]) return;
    setRoLoading((items) => ({ ...items, [roId]: true }));
    try {
      setBrowserToken();
      const response = await browserApi.masterRo.roGetDetailControllerGetDetail(roId);
      setRoDetails((items) => ({ ...items, [roId]: envelopeData<Row>(response) ?? {} }));
    } catch (error) {
      setRoDetails((items) => ({ ...items, [roId]: { error: apiErrorMessage(error) } }));
    } finally {
      setRoLoading((items) => ({ ...items, [roId]: false }));
    }
  }

  return (
    <section className="hris-page space-y-5">
      <header className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/proyek" />}>
            <ArrowLeft size={16} /> Semua Proyek
          </Button>
          <h1 className="text-2xl font-bold">{project.nama_proyek}</h1>
          <p className="text-sm text-muted-foreground">
            {project.kode_proyek} · Tahun {project.tahun_fiscal} · Diajukan {formatDate(project.created_at)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-muted px-2.5 py-1.5">Nomor kontrak · {text(project.no_kontrak)}</span>
            <span className="rounded-md bg-muted px-2.5 py-1.5">Periode kontrak · {formatDate(String(project.mulai_kontrak ?? ""))} – {formatDate(String(project.berakhir_kontrak ?? ""))}</span>
          </div>
          {project.unit_terlibat?.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {project.unit_terlibat.map((unit) => (
                <span key={unit.id} className={`rounded-full px-2.5 py-1 text-xs ${unit.peran === "PENGUSUL" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {unit.nama_unit}{unit.peran === "PENGUSUL" ? " · Pengusul" : " · Kolaborator"}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center">
          <StatusBadge status={projectStatusTone(status)}>{projectStatusLabel(status)}</StatusBadge>
        </div>
        </div>
        <div className="border-t border-border pt-4">
          {hasProjectActions && (
            <>
              <div className="mb-3">
                <p className="text-sm font-semibold">Tindakan proyek</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ajukan perpanjangan masa SK atau unggah BAST untuk menyelesaikan proyek.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {extensionOpenForSubmission && !pendingExtension && (
                  <Button type="button" size="sm" variant="outline" onClick={() => { setExtensionError(""); setExtensionOpen(true); }}>
                    <FileClock size={15} /> Ajukan perpanjangan SK
                  </Button>
                )}
                {isSubmitter && statusIsApproved(status) && (
                  <Button type="button" size="sm" onClick={() => openWorkflow("bast")}>
                    <Upload size={15} /> Unggah BAST untuk menyelesaikan
                  </Button>
                )}
                {pendingExtension && isSubmitter && (
                  <span className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                    Perpanjangan SK sedang diperiksa KARWAS
                  </span>
                )}
              </div>
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-xs font-medium text-muted-foreground">Laporan proyek</span>
            <ProjectFinalReportButton project={project} />
          </div>
        </div>
      </header>
      <div className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Status pengajuan</p>
            <p className="text-sm text-muted-foreground">{String(project.catatan_validasi ?? project.catatan_layanan ?? "Belum ada catatan validasi.")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isLayanan && status === "MENUNGGU_VALIDASI_LAYANAN" && (
              <Button variant="outline" onClick={() => openWorkflow("layanan")}>
                <Check size={16} /> Tinjau Rencana
              </Button>
            )}
            {isUmum && status === "MENUNGGU_VALIDASI_UMUM" && (
              <Button variant="outline" onClick={() => openWorkflow("umum")}>
                <Check size={16} /> Validasi Umum
              </Button>
            )}
            {isNotulenUploader && status === "MENUNGGU_NOTULEN" && (
              <Button variant="outline" onClick={() => openWorkflow("notulen")}>
                <Upload size={16} /> Unggah Notulen
              </Button>
            )}
            {(identity.role === "pimpinan" || identity.role === "superadmin") && status === "MENUNGGU_VALIDASI_PIMPINAN" && (
              <Button variant="outline" onClick={() => openWorkflow("pimpinan")}>
                <Check size={16} /> Validasi Pimpinan
              </Button>
            )}
            {isSubmitter && isRevisionPending && (
              <Button variant="outline" onClick={openRevisionForm}>
                <Pencil size={16} /> Perbaiki dan Ajukan Ulang
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
            const steps = workflowVersion >= 2
              ? ["Pengajuan proyek", "Pemeriksaan Koordinator Layanan", "Rapat dan unggah notulen", "Validasi Bagian Umum", "Persetujuan Pimpinan", "Pelaksanaan dan BAST"]
              : ["Pengajuan proyek", "Validasi Bagian Umum", "Unggah notulen", "Persetujuan Pimpinan", "Pelaksanaan dan BAST"];
            const currentIndex = workflowVersion >= 2
              ? status === "MENUNGGU_VALIDASI_LAYANAN" || status === "PERLU_REVISI_LAYANAN" ? 1
                : status === "MENUNGGU_NOTULEN" ? 2
                : status === "MENUNGGU_VALIDASI_UMUM" || status === "PERLU_REVISI_UMUM" ? 3
                : status === "MENUNGGU_VALIDASI_PIMPINAN" || status === "PERLU_REVISI_PIMPINAN" ? 4
                : status === "DISETUJUI_PIMPINAN" ? 5
                : status === "SELESAI" ? 6 : 0
              : status === "MENUNGGU_VALIDASI_UMUM" ? 1
                : status === "PERLU_REVISI_UMUM" ? 1
                : status === "MENUNGGU_NOTULEN" ? 2
                : status === "MENUNGGU_VALIDASI_PIMPINAN" ? 3
                : status === "PERLU_REVISI_PIMPINAN" ? 3
                : status === "DISETUJUI_PIMPINAN" ? 4
                : status === "SELESAI" ? 5 : 0;
            const rejected = String(status).startsWith("DITOLAK");
            return (
              <ol className={`grid grid-cols-1 gap-0 sm:grid-cols-5 ${workflowVersion >= 2 ? "xl:grid-cols-6" : ""}`}>
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
          {isRevisionPending && <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">Pengajuan perlu diperbaiki oleh pemilik proyek sebelum masuk kembali ke pemeriksaan Koordinator Layanan.</p>}
          {status === "DISETUJUI_PIMPINAN" && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Proyek berjalan dan RO aktif setelah disetujui Pimpinan.</p>}
          {status === "SELESAI" && <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Proyek telah dinyatakan selesai setelah pemilik proyek mengunggah BAST{project.selesai_pada ? ` pada ${formatDate(project.selesai_pada)}` : ""}.</p>}
          <p className="mt-4 text-xs text-muted-foreground">Setelah proyek disetujui, Billing menerbitkan invoice dan Bendahara mencatat pembayaran setelah dana masuk.</p>
        </div>
        {project.riwayat_revisi?.length ? (
          <div className="mt-5 border-t pt-4">
            <h3 className="text-sm font-semibold">Riwayat revisi</h3>
            <ol className="mt-3 space-y-2">
              {project.riwayat_revisi.map((revision) => (
                <li key={revision.id} className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">Revisi {revision.nomor_revisi} · {revision.tahap === "LAYANAN" ? "Koordinator Layanan" : revision.tahap === "UMUM" ? "Bagian Umum" : "Pimpinan"}</span>
                    <span className="text-xs text-muted-foreground">Diminta {formatDate(revision.diminta_pada)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{revision.alasan}</p>
                  {revision.diajukan_ulang_pada && <p className="mt-1 text-xs text-emerald-700">Diajukan ulang {formatDate(revision.diajukan_ulang_pada)}; versi sebelum dan sesudah tersimpan.</p>}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4">
          <div>
            <h2 className="font-semibold">Perpanjangan SK Proyek</h2>
            <p className="mt-1 text-sm text-muted-foreground">Perubahan jadwal SK diajukan sebelum tanggal akhir dan berlaku setelah disetujui KARWAS. Nilai kontrak dan alokasi RO tidak berubah.</p>
          </div>
          {pendingExtension && <StatusBadge status="warn">Menunggu pemeriksaan KARWAS</StatusBadge>}
        </div>
        <div className="space-y-3 p-5">
          {!extensionRows.length ? (
            <p className="text-sm text-muted-foreground">
              {extensionOpenForSubmission
                ? "Belum ada pengajuan perpanjangan. Ajukan sebelum masa SK berakhir jika proyek memerlukan tambahan waktu."
                : projectEndDate && jakartaToday() > projectEndDate
                  ? "Masa SK sudah berakhir dan pengajuan perpanjangan baru tidak dapat dibuat."
                  : "Belum ada riwayat perpanjangan masa SK."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3">Tanggal akhir SK</th>
                    <th className="p-3">Alasan</th>
                    <th className="p-3">Pengajuan</th>
                    <th className="p-3">Status / pemeriksaan</th>
                    {isKarwas && <th className="p-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {extensionRows.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 align-top">
                      <td className="p-3">
                        <span className="text-muted-foreground">{formatDate(item.berakhir_sk_sebelumnya)}</span>
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className="font-medium">{formatDate(item.berakhir_sk_baru)}</span>
                        <div className="mt-1 text-xs"><DocumentLinks documents={[{ label: "Dokumen pendukung", path: item.file_dokumen }]} /></div>
                      </td>
                      <td className="max-w-sm whitespace-normal p-3">{item.alasan}</td>
                      <td className="p-3">
                        <div>{text(item.diajukan_oleh?.nama)}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(item.diajukan_pada)}</div>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={item.status === "DISETUJUI_KARWAS" ? "ok" : item.status === "DITOLAK_KARWAS" ? "danger" : "warn"}>{humanizeStatus(item.status)}</StatusBadge>
                        {item.diperiksa_oleh && <div className="mt-1 text-xs text-muted-foreground">{item.diperiksa_oleh.nama} · {formatDate(item.diperiksa_pada)}</div>}
                        {item.catatan_pemeriksa && <div className="mt-1 max-w-xs whitespace-normal text-xs text-muted-foreground">{item.catatan_pemeriksa}</div>}
                      </td>
                      {isKarwas && <td className="p-3 text-right">{item.status === "DIAJUKAN" && <Button size="sm" onClick={() => { setReviewingExtension(item); setExtensionApproved(true); setExtensionReviewNote(""); setExtensionReviewError(""); }}>Tinjau</Button>}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pendingExtension && isSubmitter && <p className="text-xs text-muted-foreground">Pengajuan perpanjangan sedang diperiksa. Pengajuan baru dapat dibuat setelah pemeriksaan ini selesai.</p>}
          {!extensionOpenForSubmission && isSubmitter && projectEndDate && jakartaToday() > projectEndDate && <p className="flex items-center gap-2 text-xs text-amber-700"><Clock3 size={14} /> Masa SK telah berakhir; perpanjangan tidak dapat diajukan setelah tanggal tersebut.</p>}
        </div>
      </section>
      <ProjectFinancialSections
        summary={{ contract, directCost, margin, marginDistributed, roPlan, approvedRoBudget, roUsed, roCashReceived, roCashPosition, roRemainingRight, usedPercent, marginPercent }}
        roRows={roRows}
        termRows={termRows}
        termTotal={termTotal}
        termPaid={termPaid}
        termRemaining={termRemaining}
        roCount={roRows.length}
        hasRestrictedRos={hasRestrictedRos}
      />
      <ProjectRoSection
        roGroups={roGroups}
        roRows={roRows}
        project={project}
        roDetails={roDetails}
        roLoading={roLoading}
        expandedRos={expandedRos}
        toggleRo={toggleRo}
      />      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">Dokumen proyek</h2>
          <p className="mt-1 text-sm text-muted-foreground">Dokumen administrasi yang tersimpan dan dapat dibuka.</p>
        </div>
        <div className="p-5">
          <DocumentLinks
            documents={[
              { label: "Kontrak Proyek", path: project.file_sk },
              { label: "RAB Proyek", path: project.file_rab },
              { label: "Notulen", path: project.file_notulen },
              { label: "BAST Proyek", path: project.file_bast },
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
      <ProjectApplicationModal
        open={revisionOpen}
        closeModal={() => !revisionMutation.isPending && setRevisionOpen(false)}
        mode="revision"
        revisionNote={String(project.catatan_validasi ?? project.catatan_layanan ?? "")}
        currentSk={typeof project.file_sk === "string" ? project.file_sk : null}
        currentRab={typeof project.file_rab === "string" ? project.file_rab : null}
        form={revisionForm}
        setForm={setRevisionForm}
        contractDatesRequired={revisionContractDatesRequired}
        editingDraftId={null}
        identity={identity}
        currentUnit={currentUnit as { kode_unit?: string; nama_unit?: string } | undefined}
        unitComboboxOptions={unitComboboxOptions}
        unitPengusulId={revisionLeadUnitId}
        changeLeadUnit={changeRevisionLeadUnit}
        availableCollaboratorOptions={availableCollaboratorOptions}
        addCollaborator={addRevisionCollaborator}
        unitKolaborasiIds={revisionCollaboratorIds}
        assignedRoUnitIds={assignedRoUnitIds}
        normalizeUnitId={normalizeUnitId}
        removeCollaborator={removeRevisionCollaborator}
        numeric={revisionNumeric}
        contractOk={revisionContractOk}
        jobs={revisionJobs}
        addJob={addRevisionJob}
        removeJob={removeRevisionJob}
        updateJob={updateRevisionJob}
        updateRo={updateRevisionRo}
        addRo={addRevisionRo}
        removeRo={removeRevisionRo}
        addRoCollaborator={addRevisionRoCollaborator}
        removeRoCollaborator={removeRevisionRoCollaborator}
        roUnitComboboxOptions={roUnitComboboxOptions}
        makComboboxOptions={makComboboxOptions}
        makNameById={makNameById}
        rekeningComboboxOptions={rekeningComboboxOptions}
        roTotal={revisionRoTotal}
        terms={revisionTerms}
        setTerms={setRevisionTerms}
        addTerm={addRevisionTerm}
        updateTerm={updateRevisionTerm}
        termsTotal={revisionTermsTotal}
        sk={revisionContractFile}
        setSk={setRevisionContractFile}
        rab={revisionRabFile}
        setRab={setRevisionRabFile}
        formError={revisionError}
        submit={() => void submitRevision()}
        submitting={revisionMutation.isPending}
      />
      <Dialog open={workflow !== null} onOpenChange={(value) => !value && setWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{workflow === "notulen" ? "Unggah Notulen" : workflow === "bast" ? "Unggah BAST dan Selesaikan Proyek" : `Validasi ${workflow === "layanan" ? "Koordinator Layanan" : workflow === "umum" ? "Bagian Umum" : "Pimpinan"}`}</DialogTitle>
            <DialogDescription>{workflow === "notulen" ? "Unggah PDF, DOC, atau DOCX notulen." : workflow === "bast" ? "Unggah Berita Acara Serah Terima dalam format PDF. Setelah berhasil, status proyek berubah menjadi Selesai." : "Setujui, minta revisi, atau tolak pengajuan. Catatan wajib untuk revisi dan penolakan."}</DialogDescription>
          </DialogHeader>
          {workflow === "notulen" || workflow === "bast" ? (
            <DocumentUploadField label={workflow === "bast" ? "BAST (Berita Acara Serah Terima) · PDF" : "Dokumen Notulen"} accept={workflow === "bast" ? ".pdf" : ".pdf,.doc,.docx"} value={file} onChange={setFile} currentFile={typeof (workflow === "bast" ? project.file_bast : project.file_notulen) === "string" ? String(workflow === "bast" ? project.file_bast : project.file_notulen) : null} />
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
                  <input type="radio" name="project-detail-validation-decision" checked={approved && !requestRevision} onChange={() => { setApproved(true); setRequestRevision(false); }} className="mt-1 accent-primary" />
                  <span>
                    <span className="block text-sm font-medium">Setujui</span>
                    <span className="block text-xs text-muted-foreground">Lanjutkan pengajuan ke proses berikutnya.</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${requestRevision ? "border-amber-400 bg-amber-50" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={requestRevision} onChange={() => { setApproved(false); setRequestRevision(true); }} className="mt-1 accent-amber-600" />
                  <span>
                    <span className="block text-sm font-medium">Minta revisi</span>
                    <span className="block text-xs text-muted-foreground">Kembalikan kepada pemilik untuk diperbaiki; riwayat versi disimpan.</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!approved && !requestRevision ? "border-destructive bg-destructive/5" : ""}`}>
                  <input type="radio" name="project-detail-validation-decision" checked={!approved && !requestRevision} onChange={() => { setApproved(false); setRequestRevision(false); }} className="mt-1 accent-destructive" />
                  <span>
                    <span className="block text-sm font-medium">Tolak</span>
                    <span className="block text-xs text-muted-foreground">Akhiri pengajuan dengan alasan yang tercatat.</span>
                  </span>
                </label>
              </fieldset>
              <label className="grid gap-1.5 text-sm font-medium">
                Catatan{(!approved || requestRevision) ? <span className="text-destructive">(wajib)</span> : null}
                <textarea
                  rows={3}
                  placeholder={approved ? "Catatan tambahan (opsional)" : requestRevision ? "Tuliskan bagian yang perlu diperbaiki" : "Tuliskan alasan penolakan"}
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
            <Button disabled={workflowMutation.isPending || ((workflow === "notulen" || workflow === "bast") && !file) || ((workflow === "layanan" || workflow === "umum" || workflow === "pimpinan") && (!approved || requestRevision) && !note.trim())} onClick={submitWorkflow}>
              {workflowMutation.isPending && <LoaderCircle className="animate-spin" size={16} />}
              {workflow === "bast" ? "Selesaikan Proyek" : workflow === "notulen" ? "Unggah Notulen" : approved ? "Setujui" : requestRevision ? "Minta Revisi" : "Tolak Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={extensionOpen} onOpenChange={(value) => !value && setExtensionOpen(false)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajukan Perpanjangan Masa SK</DialogTitle>
            <DialogDescription>Ajukan sebelum tanggal akhir SK saat ini. Persetujuan hanya mengubah tanggal akhir SK, tanpa mengubah nilai kontrak atau alokasi RO.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <p className="font-medium">{project.nama_proyek}</p>
              <p className="text-muted-foreground">Akhir SK saat ini: {formatDate(projectEndDate)}</p>
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Tanggal akhir SK yang baru
              <Input type="date" min={projectEndDate} value={extensionEndDate} onChange={(event) => setExtensionEndDate(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Alasan perpanjangan
              <textarea rows={4} maxLength={1000} value={extensionReason} onChange={(event) => setExtensionReason(event.target.value)} placeholder="Jelaskan alasan dan pekerjaan yang masih perlu diselesaikan." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
              <span className="text-xs font-normal text-muted-foreground">{extensionReason.length}/1000 karakter</span>
            </label>
            <DocumentUploadField label="Dokumen pendukung perpanjangan (PDF)" accept=".pdf" value={extensionFile} onChange={setExtensionFile} />
            {extensionError && <Alert variant="destructive"><AlertDescription>{extensionError}</AlertDescription></Alert>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={extensionMutation.isPending} onClick={() => setExtensionOpen(false)}>Batal</Button>
            <Button disabled={extensionMutation.isPending} onClick={() => void submitExtension()}>
              {extensionMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Kirim ke KARWAS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={reviewingExtension !== null} onOpenChange={(value) => !value && setReviewingExtension(null)}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tinjau Perpanjangan SK Proyek</DialogTitle>
            <DialogDescription>Periksa alasan dan dokumen. Jika disetujui, tanggal akhir SK proyek akan diperbarui.</DialogDescription>
          </DialogHeader>
          {reviewingExtension && <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{project.nama_proyek}</p>
              <p className="mt-1 text-muted-foreground">{formatDate(reviewingExtension.berakhir_sk_sebelumnya)} → <span className="font-semibold text-foreground">{formatDate(reviewingExtension.berakhir_sk_baru)}</span></p>
              <p className="mt-3 whitespace-pre-wrap">{reviewingExtension.alasan}</p>
              <div className="mt-3"><DocumentLinks documents={[{ label: "Dokumen pendukung perpanjangan", path: reviewingExtension.file_dokumen }]} columns={1} /></div>
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Keputusan KARWAS</legend>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${extensionApproved ? "border-primary bg-primary/5" : ""}`}>
                <input type="radio" name="project-extension-decision" checked={extensionApproved} onChange={() => setExtensionApproved(true)} className="mt-1 accent-primary" />
                <span><span className="block text-sm font-medium">Setujui</span><span className="block text-xs text-muted-foreground">Perbarui tanggal akhir SK proyek.</span></span>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!extensionApproved ? "border-destructive bg-destructive/5" : ""}`}>
                <input type="radio" name="project-extension-decision" checked={!extensionApproved} onChange={() => setExtensionApproved(false)} className="mt-1 accent-destructive" />
                <span><span className="block text-sm font-medium">Tolak</span><span className="block text-xs text-muted-foreground">Tanggal akhir SK tetap seperti saat ini.</span></span>
              </label>
            </fieldset>
            <label className="grid gap-1.5 text-sm font-medium">
              Catatan pemeriksa{!extensionApproved && <span className="text-destructive"> (wajib saat menolak)</span>}
              <textarea rows={3} value={extensionReviewNote} onChange={(event) => setExtensionReviewNote(event.target.value)} placeholder={extensionApproved ? "Catatan tambahan (opsional)" : "Tuliskan alasan penolakan"} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40" />
            </label>
            {extensionReviewError && <Alert variant="destructive"><AlertDescription>{extensionReviewError}</AlertDescription></Alert>}
          </div>}
          <DialogFooter>
            <Button variant="outline" disabled={extensionReviewMutation.isPending} onClick={() => setReviewingExtension(null)}>Batal</Button>
            <Button disabled={extensionReviewMutation.isPending} onClick={() => void submitExtensionReview()}>
              {extensionReviewMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Proses keputusan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
