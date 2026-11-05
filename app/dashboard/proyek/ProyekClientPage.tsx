"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Eye, LoaderCircle, Plus, Trash2, FilePenLine } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/table/DataTable";
import { EmptyData } from "@/components/loading/EmptyData";
import { ProjectFinalReportButton } from "@/components/proyek/ProjectFinalReportButton";
import { ProjectApplicationModal } from "@/components/proyek/ProjectApplicationModal";
import { ProjectWorkflowDiagram, type ProjectWorkflowAction } from "@/components/proyek/ProjectWorkflowDiagram";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { envelopeRows, unwrapEnvelope, apiErrorMessage, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, humanizeStatus, projectStatusLabel, projectStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { CreateProyekDto, ProyekItemDto } from "@/lib/api/generated/api-generated";
import type { JobDraft, ProjectForm, RoDraft, TerminDraft } from "@/components/proyek/project-form.types";

type LookupRow = { id: string; [key: string]: unknown };
type UnitOption = LookupRow & { kode_unit?: string; nama_unit?: string; status_aktif?: string };
type AccountOption = LookupRow & { nama_rekening?: string; nama_bank?: string; nomor_rekening?: string; status_aktif?: string };
type MakOption = LookupRow & { kode_mak?: string; nama_mak?: string; tipe_akun?: string; status_aktif?: string };
type LegacyRoDraft = RoDraft & { nomor_job?: string };
type ProjectLocalDraft = { id: string; savedAt: string; form: ProjectForm; jobs?: JobDraft[]; ros?: LegacyRoDraft[]; terms: TerminDraft[]; unitPengusulId?: string; unitKolaborasiIds?: string[] };
const DRAFTS_STORAGE_KEY = "lemigas:proyek:drafts:v1";
const PROJECT_STATUS_FILTERS = [
  { label: "Menunggu validasi Koordinator Umum", value: "MENUNGGU_VALIDASI_UMUM" },
  { label: "Menunggu notulen", value: "MENUNGGU_NOTULEN" },
  { label: "Menunggu persetujuan Pimpinan", value: "MENUNGGU_VALIDASI_PIMPINAN" },
  { label: "Berjalan · Disetujui Pimpinan", value: "DISETUJUI_PIMPINAN" },
  { label: "Selesai", value: "SELESAI" },
  { label: "Ditolak Koordinator Umum", value: "DITOLAK_UMUM" },
  { label: "Ditolak Pimpinan", value: "DITOLAK_PIMPINAN" },
];
const currentYear = new Date().getFullYear();
const normalizeUnitId = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const blankForm = (): ProjectForm => ({
  kode_proyek: "",
  nama_proyek: "",
  tahun_fiscal: String(currentYear),
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
const blankRo = (unitId = ""): RoDraft => ({
  key: crypto.randomUUID(),
  nama_ro: "",
  mak_id: "",
  id_unit_koordinator: unitId,
  rekening_id: "",
  plafon: 0,
  plafonText: "",
  detailMode: "later",
  no_kontrak: "",
  pj: "",
  unit_kolaborasi_ids: [],
});
const blankJob = (unitId = ""): JobDraft => ({ key: crypto.randomUUID(), nomor_job: "", ros: [blankRo(unitId)] });
const blankTermin = (persentase = ""): TerminDraft => ({ key: crypto.randomUUID(), nomor_termin: 1, persentase: Number(persentase) || 0, persentaseText: persentase });

function restoreJobDrafts(draft: ProjectLocalDraft, defaultUnitId: string): JobDraft[] {
  if (draft.jobs?.length) {
    return draft.jobs.map((job) => ({
      ...job,
      key: job.key || crypto.randomUUID(),
      ros: job.ros.map((row) => ({ ...blankRo(defaultUnitId), ...row, key: row.key || crypto.randomUUID() })),
    }));
  }

  const grouped = new Map<string, JobDraft>();
  (draft.ros ?? []).forEach((legacyRow, index) => {
    const nomorJob = legacyRow.nomor_job?.trim() ?? "";
    const groupKey = nomorJob || `__legacy_blank_${index}`;
    const { nomor_job: _legacyNumber, ...roFields } = legacyRow;
    const existing = grouped.get(groupKey);
    const row = { ...blankRo(defaultUnitId), ...roFields, key: legacyRow.key || crypto.randomUUID() };
    if (existing) existing.ros.push(row);
    else grouped.set(groupKey, { key: crypto.randomUUID(), nomor_job: nomorJob, ros: [row] });
  });
  return grouped.size ? [...grouped.values()] : [blankJob(defaultUnitId)];
}

function responseRows<T extends LookupRow>(response: unknown): T[] {
  let value: unknown = response;
  for (let depth = 0; depth < 5 && value && typeof value === "object"; depth += 1) {
    if (Array.isArray(value)) return value as T[];
    const record = value as Record<string, unknown>;
    const rows = record.list ?? record.items ?? record.results;
    if (Array.isArray(rows)) return rows as T[];
    value = record.data;
  }
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function ProyekClientPage() {
  const [identity, setIdentity] = useState<ReturnType<typeof browserIdentity>>({ role: null, userId: "", unitKerjaId: "", token: "" });
  const canCreate = identity.role === "superadmin" || identity.role === "koordinator";
  const [search, setSearch] = useState("");
  const [tahun, setTahun] = useState("__all");
  const [koordinator, setKoordinator] = useState("__all");
  const [statusProyek, setStatusProyek] = useState("__all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(blankForm);
  const [jobs, setJobs] = useState<JobDraft[]>([blankJob()]);
  const [unitPengusulId, setUnitPengusulId] = useState("");
  const [unitKolaborasiIds, setUnitKolaborasiIds] = useState<string[]>([]);
  const [terms, setTerms] = useState<TerminDraft[]>([blankTermin("100")]);
  const [sk, setSk] = useState<File | null>(null);
  const [rab, setRab] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [localDrafts, setLocalDrafts] = useState<ProjectLocalDraft[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [validationProject, setValidationProject] = useState<ProyekItemDto | null>(null);
  const [validationApproved, setValidationApproved] = useState(true);
  const [validationNote, setValidationNote] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    const activeIdentity = browserIdentity();
    setIdentity(activeIdentity);
    setUnitPengusulId(activeIdentity.unitKerjaId);
    try {
      const saved = localStorage.getItem(DRAFTS_STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      setLocalDrafts(Array.isArray(parsed) ? (parsed as ProjectLocalDraft[]) : []);
    } catch {
      setLocalDrafts([]);
    }
  }, []);

  const list = use_query({
    tag: "masterProyek",
    method: "list",
    params: { search, tahun, koordinator, statusProyek, page, pageSize },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekGetDataControllerGetData({
        query: search || undefined,
        tahun_fiscal: tahun === "__all" ? undefined : Number(tahun),
        id_unit_koordinator: koordinator === "__all" ? undefined : koordinator,
        status_proyek: statusProyek === "__all" ? undefined : statusProyek as ProyekItemDto["status_proyek"],
        page,
        limit: pageSize,
      });
    },
  });
  const projects = envelopeRows<ProyekItemDto>(list.data);
  const pagination = unwrapEnvelope<ProyekItemDto[]>(list.data).pagination;

  const units = use_query({
    tag: "masterUnitKerja",
    method: "list",
    params: { tipe: "KOORDINATOR" },
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterUnitKerja.unitKerjaGetGetDataControllerGetData({ tipe_unit: "KOORDINATOR", limit: 200 }, { format: "json" }));
    },
  });
  const makLookup = use_query({
    tag: "masterMak",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterMak.masterMakFindAllControllerFindAll({ format: "json" }));
    },
  });
  const rekeningLookup = use_query({
    tag: "masterRekeningBank",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterRekeningBank.masterRekeningFindAllControllerFindAll({ format: "json" }));
    },
  });
  const unitOptions = responseRows<UnitOption>(units.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const makOptions = responseRows<MakOption>(makLookup.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const rekeningOptions = responseRows<AccountOption>(rekeningLookup.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const currentUnit = unitOptions.find((unit) => unit.id === identity.unitKerjaId);
  const isUmumValidator = identity.role === "superadmin" || (identity.role === "koordinator" && String(currentUnit?.kode_unit ?? "") === "ORG-UMUM");
  const isPimpinanValidator = identity.role === "superadmin" || identity.role === "pimpinan";
  const makComboboxOptions = makOptions.map((option) => ({ value: option.id, label: [option.kode_mak, option.nama_mak, option.tipe_akun ? `(${option.tipe_akun})` : ""].filter(Boolean).join(" — ") }));
  const unitComboboxOptions = unitOptions.map((option) => ({ value: option.id, label: [option.kode_unit, option.nama_unit].filter(Boolean).join(" — ") }));
  const projectUnitIds = [...new Set([unitPengusulId, ...unitKolaborasiIds].filter(Boolean))];
  const roUnitComboboxOptions = unitComboboxOptions.filter((option) => projectUnitIds.includes(option.value));
  const availableCollaboratorOptions = unitComboboxOptions.filter((option) => option.value !== unitPengusulId && !unitKolaborasiIds.includes(option.value));
  const rekeningComboboxOptions = rekeningOptions.map((option) => ({ value: option.id, label: [option.nama_bank, option.nama_rekening, option.nomor_rekening ? `(${option.nomor_rekening})` : ""].filter(Boolean).join(" — ") }));

  const validation = use_mutation({
    tag: "masterProyek",
    method: "workflow",
    mutationFn: async ({ projectId, stage, approved, note }: { projectId: string; stage: "umum" | "pimpinan"; approved: boolean; note?: string }) => {
      setBrowserToken();
      const payload = { disetujui: approved, catatan: note };
      return stage === "umum" ? browserApi.masterProyek.proyekValidasiUmumControllerValidasiUmum(projectId, payload) : browserApi.masterProyek.proyekValidasiPimpinanControllerValidasiPimpinan(projectId, payload);
    },
    invalidateKeys: [["api", "masterProyek"]],
  });

  function showProjectQueue(status: string) {
    setSearch("");
    setKoordinator("__all");
    setStatusProyek(status);
    setPage(1);
    window.requestAnimationFrame(() => document.getElementById("project-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const workflowActions: ProjectWorkflowAction[] = [
    {
      label: canCreate ? "Ajukan proyek" : "Lihat daftar proyek",
      onClick: () => {
        if (!canCreate) return showProjectQueue("__all");
        resetForm();
        setOpen(true);
      },
    },
    {
      label: isUmumValidator ? "Tinjau antrean" : "Lihat antrean",
      onClick: () => showProjectQueue("MENUNGGU_VALIDASI_UMUM"),
    },
    {
      label: "Lengkapi notulen",
      onClick: () => showProjectQueue("MENUNGGU_NOTULEN"),
    },
    {
      label: isPimpinanValidator ? "Tinjau persetujuan" : "Lihat antrean",
      onClick: () => showProjectQueue("MENUNGGU_VALIDASI_PIMPINAN"),
    },
    { label: "Buka daftar RO", href: "/dashboard/ro" },
    { label: "Pilih proyek aktif", onClick: () => showProjectQueue("DISETUJUI_PIMPINAN") },
  ];

  const create = use_mutation({
    tag: "masterProyek",
    method: "create",
    mutationFn: async (payload: CreateProyekDto) => {
      setBrowserToken();
      return browserApi.masterProyek.proyekCreateControllerCreate(payload);
    },
    invalidateKeys: [["api", "masterProyek"]],
  });

  const numeric = (key: "nilai_kontrak" | "total_direct_cost" | "total_margin") => Number(form[key]) || 0;
  const contractOk = numeric("nilai_kontrak") === numeric("total_direct_cost") + numeric("total_margin");
  const roRows = jobs.flatMap((job) => job.ros);
  const roTotal = roRows.reduce((total, row) => total + (Number(row.plafonText) || 0), 0);
  const termsTotal = terms.reduce((total, term) => total + (Number(term.persentaseText) || 0), 0);
  const assignedRoUnitIds = new Set(roRows.flatMap((row) => [
    row.id_unit_koordinator,
    ...(row.unit_kolaborasi_ids ?? []),
  ]).map(normalizeUnitId).filter(Boolean));
  // Unit pengusul may coordinate the project without owning an RO; only project collaborators must be assigned to an RO.
  const unassignedCollaboratorIds = unitKolaborasiIds.filter((unitId) => !assignedRoUnitIds.has(normalizeUnitId(unitId)));
  const collaborationAssigned = unassignedCollaboratorIds.length === 0;
  const jobNumbers = jobs.map((job) => job.nomor_job.trim());
  const filledJobNumbers = jobNumbers.filter(Boolean).map((number) => number.toLocaleUpperCase("id-ID"));
  const jobNumbersUnique = new Set(filledJobNumbers).size === filledJobNumbers.length;
  const allocationsValid = jobs.length > 0 && jobs.every((job) =>
    job.nomor_job.trim() && job.ros.length > 0 && job.ros.every((row) =>
      row.nama_ro && row.mak_id && projectUnitIds.some((unitId) => normalizeUnitId(unitId) === normalizeUnitId(row.id_unit_koordinator)) &&
      (row.unit_kolaborasi_ids ?? []).every((unitId) => projectUnitIds.some((projectUnitId) => normalizeUnitId(projectUnitId) === normalizeUnitId(unitId)) && normalizeUnitId(unitId) !== normalizeUnitId(row.id_unit_koordinator)) &&
      Number(row.plafonText) > 0 && (row.detailMode === "later" || row.pj.trim()),
    ),
  );
  const contractDatesRequired = roRows.some((row) => row.detailMode === "detail");
  const contractDateRangeValid = (
    !form.mulai_kontrak && !form.berakhir_kontrak && !contractDatesRequired
  ) || Boolean(form.mulai_kontrak && form.berakhir_kontrak && form.berakhir_kontrak >= form.mulai_kontrak);
  const valid = Boolean(
    form.kode_proyek &&
    form.nama_proyek &&
    form.tahun_fiscal &&
    form.nilai_kontrak !== "" &&
    form.total_direct_cost !== "" &&
    form.total_margin !== "" &&
    contractOk &&
    contractDateRangeValid &&
    unitPengusulId &&
    collaborationAssigned &&
    allocationsValid &&
    jobNumbersUnique &&
    roTotal === numeric("total_direct_cost") &&
    terms.length &&
    terms.every((term) => Number(term.persentaseText) > 0) &&
    termsTotal === 100,
  );

  function resetForm() {
    setForm(blankForm());
    setJobs([blankJob(identity.unitKerjaId)]);
    setUnitPengusulId(identity.unitKerjaId);
    setUnitKolaborasiIds([]);
    setTerms([blankTermin("100")]);
    setSk(null);
    setRab(null);
    setFormError("");
    setEditingDraftId(null);
  }
  function persistDrafts(drafts: ProjectLocalDraft[]) {
    setLocalDrafts(drafts);
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  }
  function hasDraftContent() {
    const projectFieldsChanged = Object.entries(form).some(([key, value]) =>
      key === "tahun_fiscal" ? value !== String(currentYear) : Boolean(value.trim()),
    );
    const allocationChanged = jobs.length > 1 || jobs.some((job) =>
      Boolean(job.nomor_job.trim()) || job.ros.length > 1 || job.ros.some((row) =>
        Boolean(
          row.nama_ro.trim() ||
          row.mak_id ||
          row.rekening_id ||
          row.plafonText.trim() ||
          row.pj.trim() ||
          row.no_kontrak.trim() ||
          row.unit_kolaborasi_ids?.length ||
          row.detailMode === "detail" ||
          normalizeUnitId(row.id_unit_koordinator) !== normalizeUnitId(unitPengusulId),
        ),
      ),
    );
    const termsChanged = terms.length > 1 || terms.some((term, index) =>
      term.persentaseText !== (index === 0 ? "100" : ""),
    );

    return projectFieldsChanged || allocationChanged || termsChanged ||
      unitPengusulId !== identity.unitKerjaId || unitKolaborasiIds.length > 0 || Boolean(sk || rab);
  }
  function saveCurrentDraft() {
    if (!hasDraftContent()) return;
    const draft: ProjectLocalDraft = { id: editingDraftId ?? crypto.randomUUID(), savedAt: new Date().toISOString(), form, jobs, terms, unitPengusulId, unitKolaborasiIds };
    persistDrafts([draft, ...localDrafts.filter((item) => item.id !== draft.id)]);
    setEditingDraftId(draft.id);
    setFormError("");
  }
  function closeApplicationModal() {
    saveCurrentDraft();
    setOpen(false);
    resetForm();
  }
  function saveDraft() {
    saveCurrentDraft();
    setOpen(false);
    resetForm();
  }
  function editDraft(draft: ProjectLocalDraft) {
    const savedForm = draft.form as ProjectForm & { mulai_sk?: string; berakhir_sk?: string };
    setForm({
      ...blankForm(),
      ...savedForm,
      mulai_kontrak: savedForm.mulai_kontrak || savedForm.mulai_sk || "",
      berakhir_kontrak: savedForm.berakhir_kontrak || savedForm.berakhir_sk || "",
    });
    const savedLeadId = draft.unitPengusulId ?? identity.unitKerjaId;
    setUnitPengusulId(savedLeadId);
    setUnitKolaborasiIds(draft.unitKolaborasiIds ?? []);
    setJobs(restoreJobDrafts(draft, savedLeadId));
    setTerms(draft.terms);
    setEditingDraftId(draft.id);
    setFormError("");
    setSk(null);
    setRab(null);
    setOpen(true);
  }
  function deleteDraft(id: string) {
    persistDrafts(localDrafts.filter((draft) => draft.id !== id));
    if (editingDraftId === id) resetForm();
  }
  function updateRo(key: string, field: keyof RoDraft, value: string) {
    setJobs((currentJobs) => currentJobs.map((job) => ({
      ...job,
      ros: job.ros.map((row) => (row.key === key ? {
        ...row,
        [field]: value,
        ...(field === "id_unit_koordinator" ? { unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((unitId) => unitId !== value) } : {}),
      } : row)),
    })));
  }
  function updateJob(key: string, nomorJob: string) {
    setJobs((currentJobs) => currentJobs.map((job) => job.key === key ? { ...job, nomor_job: nomorJob } : job));
  }
  function addJob() {
    setJobs((currentJobs) => [...currentJobs, blankJob(unitPengusulId)]);
  }
  function removeJob(key: string) {
    if (jobs.length <= 1) return;
    setJobs((currentJobs) => currentJobs.filter((job) => job.key !== key));
  }
  function addRo(jobKey: string) {
    setJobs((currentJobs) => currentJobs.map((job) => job.key === jobKey
      ? { ...job, ros: [...job.ros, blankRo(unitPengusulId)] }
      : job));
  }
  function removeRo(key: string) {
    setJobs((currentJobs) => currentJobs.map((job) => job.ros.length > 1
      ? { ...job, ros: job.ros.filter((row) => row.key !== key) }
      : job));
  }
  function addCollaborator(unitId: string) {
    if (!unitId || unitId === unitPengusulId || unitKolaborasiIds.includes(unitId)) return;
    setUnitKolaborasiIds((ids) => [...ids, unitId]);
  }
  function removeCollaborator(unitId: string) {
    setUnitKolaborasiIds((ids) => ids.filter((id) => id !== unitId));
    setJobs((currentJobs) => currentJobs.map((job) => ({
      ...job,
      ros: job.ros.map((row) => ({
        ...row,
        ...(row.id_unit_koordinator === unitId ? { id_unit_koordinator: unitPengusulId } : {}),
        unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((id) => id !== unitId),
      })),
    })));
  }
  function addRoCollaborator(roKey: string, unitId: string) {
    if (!unitId) return;
    setJobs((currentJobs) => currentJobs.map((job) => ({
      ...job,
      ros: job.ros.map((row) => {
        if (row.key !== roKey || normalizeUnitId(row.id_unit_koordinator) === normalizeUnitId(unitId)) return row;
        const currentIds = row.unit_kolaborasi_ids ?? [];
        return currentIds.some((id) => normalizeUnitId(id) === normalizeUnitId(unitId))
          ? row
          : { ...row, unit_kolaborasi_ids: [...currentIds, unitId] };
      }),
    })));
  }
  function removeRoCollaborator(roKey: string, unitId: string) {
    setJobs((currentJobs) => currentJobs.map((job) => ({
      ...job,
      ros: job.ros.map((row) => row.key === roKey
        ? { ...row, unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).filter((id) => id !== unitId) }
        : row),
    })));
  }
  function changeLeadUnit(unitId: string) {
    const previousLeadId = unitPengusulId;
    setUnitPengusulId(unitId);
    setUnitKolaborasiIds((ids) => {
      const next = ids.filter((id) => id !== unitId);
      if (previousLeadId && previousLeadId !== unitId && roRows.some((row) => row.id_unit_koordinator === previousLeadId) && !next.includes(previousLeadId)) next.push(previousLeadId);
      return next;
    });
    setJobs((currentJobs) => currentJobs.map((job) => ({
      ...job,
      ros: job.ros.map((row) => !row.id_unit_koordinator ? { ...row, id_unit_koordinator: unitId } : row),
    })));
  }
  function updateTerm(key: string, value: string) {
    setTerms((rows) => rows.map((row) => (row.key === key ? { ...row, persentaseText: value } : row)));
  }
  function addTerm() {
    setTerms((rows) => [...rows, blankTermin()]);
  }

  async function submitValidation() {
    if (!validationProject) return;
    if (!validationApproved && !validationNote.trim()) {
      setValidationError("Catatan wajib diisi saat menolak pengajuan.");
      return;
    }
    const stage = validationProject.status_proyek === "MENUNGGU_VALIDASI_UMUM" ? "umum" : "pimpinan";
    setValidationError("");
    try {
      await validation.mutateAsync({ projectId: validationProject.id, stage, approved: validationApproved, note: validationNote.trim() || undefined });
      setValidationProject(null);
    } catch (error) {
      setValidationError(apiErrorMessage(error, "Validasi proyek gagal."));
    }
  }

  async function submit() {
    if (!contractDateRangeValid) {
      setFormError("Isi Mulai Kontrak dan Berakhir Kontrak secara lengkap; tanggal akhir tidak boleh sebelum tanggal mulai.");
      return;
    }
    if (!valid || create.isPending) {
      setFormError(!unitPengusulId
        ? "Pilih unit pengusul proyek."
        : !collaborationAssigned
          ? `Unit kolaborator berikut belum ditugaskan ke RO: ${unassignedCollaboratorIds.map((unitId) => unitComboboxOptions.find((option) => normalizeUnitId(option.value) === normalizeUnitId(unitId))?.label ?? unitId).join(", ")}. Pilih sebagai pemilik RO atau tambahkan sebagai kolaborator RO.`
          : !jobNumbersUnique
            ? "Nomor Job hanya boleh digunakan pada satu card Job. Tambahkan RO split di dalam card Job yang sama."
            : !allocationsValid
              ? "Lengkapi nomor Job dan seluruh alokasi RO di dalamnya."
          : "Lengkapi data. Kontrak = direct cost + margin, plafon RO = direct cost, termin = 100%."
      );
      return;
    }
    setFormError("");
    try {
      const payload: CreateProyekDto = {
        ...form,
        tahun_fiscal: Number(form.tahun_fiscal),
        mulai_kontrak: form.mulai_kontrak || undefined,
        berakhir_kontrak: form.berakhir_kontrak || undefined,
        nilai_kontrak: numeric("nilai_kontrak"),
        total_direct_cost: numeric("total_direct_cost"),
        total_margin: numeric("total_margin"),
        no_kontrak: form.no_kontrak || undefined,
        unit_pengusul_id: normalizeUnitId(unitPengusulId),
        unit_kolaborasi_ids: unitKolaborasiIds.map(normalizeUnitId),
        job_list: jobs.map((job) => ({
          nomor_job: job.nomor_job.trim(),
          ro_list: job.ros.map((row) => ({
            nama_ro: row.nama_ro,
            mak_id: row.mak_id,
            id_unit_koordinator: normalizeUnitId(row.id_unit_koordinator),
            ...(row.rekening_id ? { rekening_id: row.rekening_id } : {}),
            plafon: Number(row.plafonText),
            unit_kolaborasi_ids: (row.unit_kolaborasi_ids ?? []).map(normalizeUnitId),
            ...(row.detailMode === "detail" ? { pj: row.pj } : {}),
          })),
        })),
        termin_list: terms.map(({ key, persentaseText }, index) => ({ nomor_termin: index + 1, persentase: Number(persentaseText) })),
      };
      const response = await create.mutateAsync(payload);
      const project = unwrapEnvelope<ProyekItemDto>(response).data;
      if (!project?.id) throw new Error("Proyek tersimpan, tetapi ID proyek tidak diterima.");

      const draftId = editingDraftId;
      if (draftId) {
        persistDrafts(localDrafts.filter((draft) => draft.id !== draftId));
      }
      setOpen(false);
      resetForm();

      try {
        if (sk) await uploadHrisFile(`/api/proyek/${project.id}/sk`, sk);
        if (rab) await uploadHrisFile(`/api/proyek/${project.id}/rab`, rab);
      } catch (error) {
        setFormError(`Proyek tersimpan. ${apiErrorMessage(error, "Unggah dokumen gagal.")} Unggah ulang dari detail proyek.`);
      }
    } catch (error) {
      setFormError(apiErrorMessage(error, "Gagal mengajukan proyek."));
    }
  }

  const years = Array.from({ length: 4 }, (_, index) => String(currentYear - index));
  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proyek</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pengajuan proyek, RO awal, dan rencana termin.</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
          >
            <Plus size={16} /> Ajukan Proyek
          </Button>
        )}
      </header>
      <ProjectWorkflowDiagram actions={workflowActions} />
      {localDrafts.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <div className="space-y-3 pt-4">
              <div>
                <h2 className="font-semibold">Draft Pengajuan Proyek ({localDrafts.length})</h2>
                <p className="mt-1 text-sm text-muted-foreground">Draft hanya tersimpan di browser ini. Berpindah browser, profil, atau perangkat membuat draft tidak tersedia.</p>
              </div>
              {localDrafts.map((draft) => (
                <div key={draft.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{draft.form.nama_proyek || draft.form.kode_proyek || "Draft tanpa nama"}</p>
                    <p className="text-xs text-muted-foreground">
                      Disimpan {new Date(draft.savedAt).toLocaleString("id-ID")} · {draft.form.kode_proyek || "Kode belum diisi"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editDraft(draft)}>
                      Lanjutkan
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteDraft(draft.id)} aria-label="Hapus draft">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card id="project-list" className="scroll-mt-6">
        <CardContent className="pt-4">
          {list.isError ? <EmptyData label="Daftar proyek belum dapat dimuat." action={<Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>Coba lagi</Button>} /> : <DataTable
            columns={[
              {
                key: "kode",
                header: "Kode / Proyek",
                className: "min-w-[15rem]",
                render: (row: ProyekItemDto) => (
                  <div className="space-y-1">
                    <p className="font-medium">{row.kode_proyek}</p>
                    <p className="text-xs text-muted-foreground">{row.nama_proyek}</p>
                    {row.unit_terlibat?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.unit_terlibat.map((unit) => (
                          <span key={unit.id} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                            {unit.nama_unit}{unit.peran === "PENGUSUL" ? " · Pengusul" : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              { key: "tahun", header: "Tahun", className: "w-24 whitespace-nowrap text-center tabular-nums", render: (row: ProyekItemDto) => row.tahun_fiscal },
              {
                key: "periode_kontrak",
                header: "Periode kontrak",
                className: "min-w-[13rem] whitespace-nowrap",
                render: (row: ProyekItemDto) => {
                  const start = row.mulai_kontrak == null ? null : String(row.mulai_kontrak);
                  const end = row.berakhir_kontrak == null ? null : String(row.berakhir_kontrak);
                  const days = start && end ? Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1 : null;
                  return (
                    <div className="text-sm">
                      <span>
                        {formatDate(start)} – {formatDate(end)}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">{days !== null && days > 0 ? `${days} hari kontrak` : "Periode kontrak belum diatur"}</p>
                    </div>
                  );
                },
              },
              {
                key: "pengaju",
                header: "Pengaju",
                className: "min-w-[12rem]",
                render: (row: ProyekItemDto) => (
                  <div className="text-sm">
                    {String(row.nama_pengaju ?? "—")}
                    <p className="mt-1 text-xs text-muted-foreground">{String(row.nama_unit_pengaju ?? "—")}</p>
                  </div>
                ),
              },
              { key: "kontrak", header: "Nilai Kontrak", className: "min-w-[10rem] whitespace-nowrap text-right tabular-nums", render: (row: ProyekItemDto) => <span>{formatRupiah(row.nilai_kontrak)}</span> },
              {
                key: "ro",
                header: "Pagu RO / Posisi Kas",
                className: "min-w-[15rem] whitespace-nowrap text-right tabular-nums",
                render: (row: ProyekItemDto) => {
                  const financial = row as ProyekItemDto & { total_saldo_ro?: number; total_sisa_hak_belanja_ro?: number };
                  const cashPosition = Number(financial.total_saldo_ro) || 0;
                  const remainingRight = Number(financial.total_sisa_hak_belanja_ro) || 0;
                  return (
                    <div className="space-y-1 text-sm">
                      <span className="block">Pagu RO {formatRupiah(row.total_plafon_ro)}</span>
                      <span className={`block text-xs ${cashPosition < 0 ? "text-rose-700" : "text-emerald-700"}`}>Posisi kas {formatRupiah(cashPosition)}</span>
                      <span className={`block text-xs ${remainingRight < 0 ? "text-rose-700" : "text-muted-foreground"}`}>Sisa hak belanja {formatRupiah(remainingRight)} · {row.jumlah_ro ?? 0} RO</span>
                    </div>
                  );
                },
              },
              { key: "status", header: "Status", className: "min-w-[14rem] whitespace-nowrap", render: (row: ProyekItemDto) => <StatusBadge status={projectStatusTone(row.status_proyek)}>{projectStatusLabel(row.status_proyek)}</StatusBadge> },
              {
                key: "aksi",
                header: "Aksi",
                className: "min-w-[14rem] whitespace-nowrap text-right",
                render: (row: ProyekItemDto) => {
                  const canValidateUmum = isUmumValidator && row.status_proyek === "MENUNGGU_VALIDASI_UMUM";
                  const canValidatePimpinan = isPimpinanValidator && row.status_proyek === "MENUNGGU_VALIDASI_PIMPINAN";
                  return (
                    <div className="flex justify-end gap-1">
                      {(canValidateUmum || canValidatePimpinan) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setValidationProject(row);
                            setValidationApproved(true);
                            setValidationNote("");
                            setValidationError("");
                          }}
                        >
                          <Check size={15} /> Validasi
                        </Button>
                      )}
                      <ProjectFinalReportButton compact project={row} />
                      <Button variant="ghost" size="sm" render={<Link href={`/dashboard/proyek/${row.id}`} />}>
                        <Eye size={15} /> Detail
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            rows={projects}
            rowKey={(row) => row.id}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            remoteSearch
            rowsPerPageOptions={[10, 25, 50]}
            filters={[
              { field: "tahun", label: "Tahun Fiscal", options: years.map((value) => ({ label: value, value })) },
              { field: "koordinator", label: "Koordinator", options: unitComboboxOptions },
              { field: "status_proyek", label: "Status Proyek", options: PROJECT_STATUS_FILTERS },
            ]}
            filterValues={{ tahun, koordinator, status_proyek: statusProyek }}
            onFilterChange={(field, value) => {
              if (field === "tahun") setTahun(value);
              if (field === "koordinator") setKoordinator(value);
              if (field === "status_proyek") setStatusProyek(value);
              setPage(1);
            }}
            pagination={{
              page,
              pageSize,
              total: pagination?.total_datas ?? projects.length,
              totalPages: pagination?.total_pages,
              onPageChange: setPage,
              onPageSizeChange: (value) => {
                setPageSize(value);
                setPage(1);
              },
            }}
            emptyMessage={list.isLoading ? "Memuat proyek..." : "Belum ada proyek."}
          />}
        </CardContent>
      </Card>
      <Modal
        open={Boolean(validationProject)}
        onClose={() => {
          if (!validation.isPending) setValidationProject(null);
        }}
        title="Validasi Pengajuan Proyek"
        size="sm"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" disabled={validation.isPending} onClick={() => setValidationProject(null)}>
              Batal
            </Button>
            <Button disabled={validation.isPending || (!validationApproved && !validationNote.trim())} variant={validationApproved ? "default" : "destructive"} onClick={submitValidation}>
              {validation.isPending && <LoaderCircle className="animate-spin" size={16} />}
              {validationApproved ? "Setujui Pengajuan" : "Tolak Pengajuan"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-medium">{validationProject?.nama_proyek}</p>
            <p className="text-muted-foreground">
              {validationProject?.kode_proyek} · {humanizeStatus(validationProject?.status_proyek)}
            </p>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Keputusan validasi</legend>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${validationApproved ? "border-primary bg-primary/5" : ""}`}>
              <input
                type="radio"
                name="project-validation-decision"
                checked={validationApproved}
                onChange={() => {
                  setValidationApproved(true);
                  setValidationError("");
                }}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">Setujui</span>
                <span className="block text-xs text-muted-foreground">Lanjutkan pengajuan ke proses berikutnya.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${!validationApproved ? "border-destructive bg-destructive/5" : ""}`}>
              <input type="radio" name="project-validation-decision" checked={!validationApproved} onChange={() => setValidationApproved(false)} className="mt-1 accent-destructive" />
              <span>
                <span className="block text-sm font-medium">Tolak</span>
                <span className="block text-xs text-muted-foreground">Pengajuan dikembalikan dengan catatan.</span>
              </span>
            </label>
          </fieldset>
          <label className="grid gap-1.5 text-sm font-medium">
            Catatan {!validationApproved && <span className="text-destructive">(wajib saat menolak)</span>}
            <textarea
              value={validationNote}
              onChange={(event) => setValidationNote(event.target.value)}
              rows={3}
              placeholder={validationApproved ? "Catatan tambahan (opsional)" : "Tuliskan alasan penolakan"}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          {validationError && (
            <Alert variant="destructive">
              <AlertDescription>{validationError}</AlertDescription>
            </Alert>
          )}
        </div>
      </Modal>
      <ProjectApplicationModal
        open={open}
        closeModal={closeApplicationModal}
        form={form}
        setForm={setForm}
        contractDatesRequired={contractDatesRequired}
        editingDraftId={editingDraftId}
        identity={identity}
        currentUnit={currentUnit}
        unitComboboxOptions={unitComboboxOptions}
        unitPengusulId={unitPengusulId}
        changeLeadUnit={changeLeadUnit}
        availableCollaboratorOptions={availableCollaboratorOptions}
        addCollaborator={addCollaborator}
        unitKolaborasiIds={unitKolaborasiIds}
        assignedRoUnitIds={assignedRoUnitIds}
        normalizeUnitId={normalizeUnitId}
        removeCollaborator={removeCollaborator}
        numeric={numeric}
        contractOk={contractOk}
        jobs={jobs}
        addJob={addJob}
        removeJob={removeJob}
        updateJob={updateJob}
        updateRo={updateRo}
        addRo={addRo}
        removeRo={removeRo}
        addRoCollaborator={addRoCollaborator}
        removeRoCollaborator={removeRoCollaborator}
        roUnitComboboxOptions={roUnitComboboxOptions}
        makComboboxOptions={makComboboxOptions}
        rekeningComboboxOptions={rekeningComboboxOptions}
        roTotal={roTotal}
        terms={terms}
        setTerms={setTerms}
        addTerm={addTerm}
        updateTerm={updateTerm}
        termsTotal={termsTotal}
        sk={sk}
        setSk={setSk}
        rab={rab}
        setRab={setRab}
        formError={formError}
        saveDraft={saveDraft}
        submit={submit}
        submitting={create.isPending}
      />
    </section>
  );
}
