"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyData } from "@/components/loading/EmptyData";
import { ProjectFinancialSections } from "@/components/proyek/ProjectFinancialSections";
import { ProjectRoSection } from "@/components/proyek/ProjectRoSection";
import { ProjectApplicationModal } from "@/components/proyek/ProjectApplicationModal";
import { ProjectDetailHeader } from "@/components/proyek/project-detail/ProjectDetailHeader";
import { ProjectApprovalSection } from "@/components/proyek/project-detail/ProjectApprovalSection";
import { ProjectExtensionSection } from "@/components/proyek/project-detail/ProjectExtensionSection";
import { ProjectDocumentsSection } from "@/components/proyek/project-detail/ProjectDocumentsSection";
import { ProjectMarginSection } from "@/components/proyek/project-detail/ProjectMarginSection";
import { ProjectDetailActionDialogs, type ProjectWorkflowAction } from "@/components/proyek/project-detail/ProjectDetailActionDialogs";
import type { ProjectDetail, ProjectExtensionRow, ProjectDetailRow as Row } from "@/components/proyek/project-detail/types";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, envelopeRows, requestHrisApi, unwrapEnvelope, uploadHrisFile } from "@/lib/hris/api";
import { browserIdentity } from "@/lib/hris/identity";
import { createClientId } from "@/lib/utils/client-id";
import type { JobDraft, JobMetadataField, KategoriJob, ProjectForm, RoDraft, TerminDraft } from "@/components/proyek/project-form.types";

type Workflow = ProjectWorkflowAction;
type LookupRow = { id: string; [key: string]: unknown };
type Option = { value: string; label: string };
const blankProjectForm = (): ProjectForm => ({
  kode_proyek: "",
  nama_proyek: "",
  tahun_fiscal: String(new Date().getFullYear()),
  mulai_kontrak: "",
  berakhir_kontrak: "",
  sumber_pendanaan: "",
  nama_client: "",
  no_kontrak: "",
  pj_1: "",
  pj_2: "",
  nilai_kontrak: "",
  total_direct_cost: "",
  total_margin: "",
});
const blankRevisionRo = (unitId = ""): RoDraft => ({ key: createClientId(), mak_id: "", id_unit_koordinator: unitId, rekening_id: "", plafon: 0, plafonText: "", detailMode: "later", no_kontrak: "", pj: "", unit_kolaborasi_ids: [] });
const blankRevisionJob = (unitId = ""): JobDraft => ({ key: createClientId(), nama_job: "", kategori_job: "", ros: [blankRevisionRo(unitId)] });
const blankRevisionTerm = (percentage = ""): TerminDraft => ({ key: createClientId(), nomor_termin: 1, persentase: Number(percentage) || 0, persentaseText: percentage });
const normalizeUnitId = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("en-US");
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
  const rekeningComboboxOptions: Option[] = rekeningOptions.map((account) => ({
    value: account.id,
    label: [account.nama_bank, account.nama_rekening, account.nomor_rekening ? `(${account.nomor_rekening})` : ""].filter(Boolean).join(" — "),
  }));
  const revisionProjectUnitIds = [...new Set([revisionLeadUnitId, ...revisionCollaboratorIds].filter(Boolean))];
  const roUnitComboboxOptions = unitComboboxOptions.filter((option) => revisionProjectUnitIds.includes(option.value));
  const availableCollaboratorOptions = unitComboboxOptions.filter((option) => option.value !== revisionLeadUnitId && !revisionCollaboratorIds.includes(option.value));
  const revisionRoRows = revisionJobs.flatMap((job) => job.ros);
  const revisionNumeric = (key: "nilai_kontrak" | "total_direct_cost" | "total_margin") => Number(revisionForm[key]) || 0;
  const revisionContractOk = revisionNumeric("nilai_kontrak") === revisionNumeric("total_direct_cost") + revisionNumeric("total_margin");
  const revisionRoTotal = revisionRoRows.reduce((total, row) => total + (Number(row.plafonText) || 0), 0);
  const revisionTermsTotal = revisionTerms.reduce((total, term) => total + (Number(term.persentaseText) || 0), 0);
  const assignedRoUnitIds = new Set(
    revisionRoRows
      .flatMap((row) => [row.id_unit_koordinator, ...(row.unit_kolaborasi_ids ?? [])])
      .map(normalizeUnitId)
      .filter(Boolean),
  );
  const revisionCollaboratorsAssigned = revisionCollaboratorIds.every((unitId) => assignedRoUnitIds.has(normalizeUnitId(unitId)));
  const revisionAllocationsValid =
    revisionJobs.length > 0 &&
    revisionJobs.every(
      (job) =>
        job.nama_job.trim() &&
        job.kategori_job &&
        job.nomor_job &&
        (job.id || job.nomor_job_reservasi_id) &&
        job.ros.length > 0 &&
        job.ros.every(
          (row) =>
            row.mak_id &&
            revisionProjectUnitIds.some((unitId) => normalizeUnitId(unitId) === normalizeUnitId(row.id_unit_koordinator)) &&
            Number(row.plafonText) > 0 &&
            (row.detailMode === "later" || row.pj.trim()) &&
            (row.unit_kolaborasi_ids ?? []).every(
              (unitId) => revisionProjectUnitIds.some((projectUnitId) => normalizeUnitId(projectUnitId) === normalizeUnitId(unitId)) && normalizeUnitId(unitId) !== normalizeUnitId(row.id_unit_koordinator),
            ),
        ),
    );
  const revisionContractDatesRequired = revisionRoRows.some((row) => row.detailMode === "detail");
  const revisionContractDatesValid =
    (!revisionForm.mulai_kontrak && !revisionForm.berakhir_kontrak && !revisionContractDatesRequired) || Boolean(revisionForm.mulai_kontrak && revisionForm.berakhir_kontrak && revisionForm.berakhir_kontrak >= revisionForm.mulai_kontrak);
  const serviceUnitCode = (process.env.NEXT_PUBLIC_UNIT_KODE_LAYANAN ?? "").trim().toLocaleUpperCase("id-ID");
  const umumUnitCode = (process.env.NEXT_PUBLIC_UNIT_KODE_KABAG ?? "").trim().toLocaleUpperCase("id-ID");
  const currentUnitCode = String(currentUnit?.kode_unit ?? coordinatorCode)
    .trim()
    .toLocaleUpperCase("id-ID");
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
      setRevisionJobs((current) => current.map((job) => (job.key === jobKey && !job.id ? { ...job, nomor_job: reservation.nomor_job, nomor_job_reservasi_id: reservation.id } : job)));
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
  const extensionOpenForSubmission = Boolean(isSubmitter && statusIsApproved(project?.status_proyek) && projectEndDate && jakartaToday() <= projectEndDate);

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
    setRevisionJobs((current) =>
      current.map((job) => ({
        ...job,
        ros: job.ros.map((row) =>
          row.key !== key
            ? row
            : {
                ...row,
                [field]: value,
                ...(field === "id_unit_koordinator" ? { unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((unitId) => normalizeUnitId(unitId) !== normalizeUnitId(value)) } : {}),
              },
        ),
      })),
    );
  }
  function updateRevisionJob(key: string, field: JobMetadataField, value: string) {
    setRevisionJobs((current) => current.map((job) => (job.key === key ? { ...job, [field]: value } : job)));
  }
  function addRevisionJob() {
    setRevisionJobs((current) => [...current, blankRevisionJob(revisionLeadUnitId)]);
  }
  function removeRevisionJob(key: string) {
    setRevisionJobs((current) => (current.length > 1 ? current.filter((job) => job.key !== key) : current));
  }
  function addRevisionRo(jobKey: string) {
    setRevisionJobs((current) => current.map((job) => (job.key === jobKey ? { ...job, ros: [...job.ros, blankRevisionRo(revisionLeadUnitId)] } : job)));
  }
  function removeRevisionRo(key: string) {
    setRevisionJobs((current) => current.map((job) => (job.ros.length > 1 ? { ...job, ros: job.ros.filter((row) => row.key !== key) } : job)));
  }
  function addRevisionCollaborator(unitId: string) {
    if (!unitId || normalizeUnitId(unitId) === normalizeUnitId(revisionLeadUnitId) || revisionCollaboratorIds.includes(unitId)) return;
    setRevisionCollaboratorIds((current) => [...current, unitId]);
  }
  function removeRevisionCollaborator(unitId: string) {
    setRevisionCollaboratorIds((current) => current.filter((candidate) => candidate !== unitId));
    setRevisionJobs((current) =>
      current.map((job) => ({
        ...job,
        ros: job.ros.map((row) => ({
          ...row,
          ...(normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(unitId) ? { id_unit_koordinator: revisionLeadUnitId } : {}),
          unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((candidate) => normalizeUnitId(candidate) !== normalizeUnitId(unitId)),
        })),
      })),
    );
  }
  function changeRevisionLeadUnit(unitId: string) {
    const previous = revisionLeadUnitId;
    setRevisionLeadUnitId(unitId);
    setRevisionCollaboratorIds((current) => {
      const next = current.filter((candidate) => normalizeUnitId(candidate) !== normalizeUnitId(unitId));
      if (
        previous &&
        normalizeUnitId(previous) !== normalizeUnitId(unitId) &&
        revisionRoRows.some((row) => normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(previous)) &&
        !next.some((candidate) => normalizeUnitId(candidate) === normalizeUnitId(previous))
      )
        next.push(previous);
      return next;
    });
    setRevisionJobs((current) => current.map((job) => ({ ...job, ros: job.ros.map((row) => (row.id_unit_koordinator ? row : { ...row, id_unit_koordinator: unitId })) })));
  }
  function addRevisionRoCollaborator(roKey: string, unitId: string) {
    setRevisionJobs((current) =>
      current.map((job) => ({
        ...job,
        ros: job.ros.map((row) => {
          if (row.key !== roKey || normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(unitId)) return row;
          const ids = row.unit_kolaborasi_ids ?? [];
          return ids.some((candidate) => normalizeUnitId(candidate) === normalizeUnitId(unitId)) ? row : { ...row, unit_kolaborasi_ids: [...ids, unitId] };
        }),
      })),
    );
  }
  function removeRevisionRoCollaborator(roKey: string, unitId: string) {
    setRevisionJobs((current) =>
      current.map((job) => ({ ...job, ros: job.ros.map((row) => (row.key === roKey ? { ...row, unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((candidate) => normalizeUnitId(candidate) !== normalizeUnitId(unitId)) } : row)) })),
    );
  }
  function updateRevisionTerm(key: string, value: string) {
    setRevisionTerms((current) => current.map((term) => (term.key === key ? { ...term, persentaseText: value } : term)));
  }
  function addRevisionTerm() {
    setRevisionTerms((current) => [...current, blankRevisionTerm()]);
  }
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
    successMessage: (_response, variables) => (variables.approved ? "Perpanjangan masa SK proyek berhasil disetujui." : "Pengajuan perpanjangan masa SK proyek ditolak."),
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
    setRevisionJobs(
      existingJobs.length
        ? existingJobs.map((job) => ({
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
          }))
        : [blankRevisionJob(lead)],
    );
    const existingTerms = [...(project.termin_list ?? [])].sort((left, right) => left.nomor_termin - right.nomor_termin);
    setRevisionTerms(
      existingTerms.length
        ? existingTerms.map((term) => ({
            id: term.id,
            key: createClientId(),
            nomor_termin: term.nomor_termin,
            persentase: term.persentase,
            persentaseText: String(term.persentase),
          }))
        : [blankRevisionTerm("100")],
    );
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
        <EmptyData
          label="Detail proyek belum dapat dimuat."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>
              Coba lagi
            </Button>
          }
        />
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
      <ProjectDetailHeader
        project={project}
        status={status}
        hasActions={hasProjectActions}
        canExtend={extensionOpenForSubmission && !pendingExtension}
        pendingExtension={Boolean(pendingExtension)}
        isSubmitter={isSubmitter}
        onExtend={() => {
          setExtensionError("");
          setExtensionOpen(true);
        }}
        onWorkflow={openWorkflow}
      />
      <ProjectApprovalSection
        project={project}
        status={status}
        workflowVersion={workflowVersion}
        isLayanan={isLayanan}
        isUmum={isUmum}
        isNotulenUploader={isNotulenUploader}
        isSubmitter={isSubmitter}
        isRevisionPending={isRevisionPending}
        isPimpinan={identity.role === "pimpinan" || identity.role === "superadmin"}
        onWorkflow={openWorkflow}
        onRevision={openRevisionForm}
      />
      <ProjectExtensionSection
        rows={extensionRows}
        isKarwas={isKarwas}
        isSubmitter={isSubmitter}
        extensionOpenForSubmission={extensionOpenForSubmission}
        pendingExtension={Boolean(pendingExtension)}
        projectEndDate={projectEndDate}
        isExpired={Boolean(projectEndDate && jakartaToday() > projectEndDate)}
        onReview={(item) => {
          setReviewingExtension(item);
          setExtensionApproved(true);
          setExtensionReviewNote("");
          setExtensionReviewError("");
        }}
      />
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
      <ProjectRoSection roGroups={roGroups} roRows={roRows} project={project} roDetails={roDetails} roLoading={roLoading} expandedRos={expandedRos} toggleRo={toggleRo} />
      <ProjectDocumentsSection project={project} />
      <ProjectMarginSection settings={settingRows} distributions={distributionRows} margin={margin} distributed={marginDistributed} percentage={marginPercent} remaining={marginRemaining} />
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
      <ProjectDetailActionDialogs
        project={project}
        workflow={workflow}
        setWorkflow={setWorkflow}
        approved={approved}
        setApproved={setApproved}
        requestRevision={requestRevision}
        setRequestRevision={setRequestRevision}
        note={note}
        setNote={setNote}
        file={file}
        setFile={setFile}
        actionError={actionError}
        workflowPending={workflowMutation.isPending}
        submitWorkflow={() => void submitWorkflow()}
        extensionOpen={extensionOpen}
        setExtensionOpen={setExtensionOpen}
        projectEndDate={projectEndDate}
        extensionEndDate={extensionEndDate}
        setExtensionEndDate={setExtensionEndDate}
        extensionReason={extensionReason}
        setExtensionReason={setExtensionReason}
        extensionFile={extensionFile}
        setExtensionFile={setExtensionFile}
        extensionError={extensionError}
        extensionPending={extensionMutation.isPending}
        submitExtension={() => void submitExtension()}
        reviewingExtension={reviewingExtension}
        setReviewingExtension={setReviewingExtension}
        extensionApproved={extensionApproved}
        setExtensionApproved={setExtensionApproved}
        extensionReviewNote={extensionReviewNote}
        setExtensionReviewNote={setExtensionReviewNote}
        extensionReviewError={extensionReviewError}
        extensionReviewPending={extensionReviewMutation.isPending}
        submitExtensionReview={() => void submitExtensionReview()}
      />
    </section>
  );
}
