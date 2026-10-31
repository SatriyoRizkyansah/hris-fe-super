"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Eye, LoaderCircle, Plus, Trash2, FilePenLine, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/modal/Modal";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { DataTable } from "@/components/table/DataTable";
import { ProjectFinalReportButton } from "@/components/proyek/ProjectFinalReportButton";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { envelopeRows, unwrapEnvelope, apiErrorMessage, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, humanizeStatus, projectStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { CreateProyekDto, ProyekItemDto, RoInputDto, TerminInputDto } from "@/lib/api/generated/api-generated";

type ProjectForm = {
  kode_proyek: string;
  nama_proyek: string;
  tahun_fiscal: string;
  mulai_proyek: string;
  estimasi_selesai_proyek: string;
  mulai_sk: string;
  berakhir_sk: string;
  sumber_pendanaan: string;
  nama_client: string;
  no_kontrak: string;
  pj_1: string;
  pj_2: string;
  nilai_kontrak: string;
  total_direct_cost: string;
  total_margin: string;
};
type RoDraft = Omit<RoInputDto, "nomor_job"> & { key: string; plafonText: string; detailMode: "detail" | "later"; no_kontrak: string; pj: string };
type JobDraft = { key: string; nomor_job: string; ros: RoDraft[] };
type TerminDraft = TerminInputDto & { key: string; persentaseText: string };
type LookupRow = { id: string; [key: string]: unknown };
type UnitOption = LookupRow & { kode_unit?: string; nama_unit?: string; status_aktif?: string };
type AccountOption = LookupRow & { nama_rekening?: string; nama_bank?: string; nomor_rekening?: string; status_aktif?: string };
type MakOption = LookupRow & { kode_mak?: string; nama_mak?: string; tipe_akun?: string; status_aktif?: string };
type LegacyRoDraft = RoDraft & { nomor_job?: string };
type ProjectLocalDraft = { id: string; savedAt: string; form: ProjectForm; jobs?: JobDraft[]; ros?: LegacyRoDraft[]; terms: TerminDraft[]; unitPengusulId?: string; unitKolaborasiIds?: string[] };
const DRAFTS_STORAGE_KEY = "lemigas:proyek:drafts:v1";
const currentYear = new Date().getFullYear();
const normalizeUnitId = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("en-US");
const blankForm = (): ProjectForm => ({
  kode_proyek: "",
  nama_proyek: "",
  tahun_fiscal: String(currentYear),
  mulai_proyek: "",
  estimasi_selesai_proyek: "",
  mulai_sk: "",
  berakhir_sk: "",
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

function MoneyField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <MoneyInput aria-label={label} value={value} onValueChange={onChange} />
    </label>
  );
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

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function ProyekClientPage() {
  const [identity, setIdentity] = useState<ReturnType<typeof browserIdentity>>({ role: null, userId: "", unitKerjaId: "", token: "" });
  const canCreate = identity.role === "superadmin" || identity.role === "koordinator";
  const [search, setSearch] = useState("");
  const [tahun, setTahun] = useState("__all");
  const [koordinator, setKoordinator] = useState("__all");
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
    params: { search, tahun, koordinator, page, pageSize },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetData({
        query: search || undefined,
        tahun_fiscal: tahun === "__all" ? undefined : Number(tahun),
        id_unit_koordinator: koordinator === "__all" ? undefined : koordinator,
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
      return apiData(browserApi.masterUnitKerja.unitKerjaGetControllerGetData({ tipe_unit: "KOORDINATOR", limit: 200 }, { format: "json" }));
    },
  });
  const makLookup = use_query({
    tag: "masterMak",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterMak.masterMakControllerFindAll({ format: "json" }));
    },
  });
  const rekeningLookup = use_query({
    tag: "masterRekeningBank",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterRekeningBank.masterRekeningControllerFindAll({ format: "json" }));
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
      return stage === "umum" ? browserApi.masterProyek.proyekControllerValidasiUmum(projectId, payload) : browserApi.masterProyek.proyekControllerValidasiPimpinan(projectId, payload);
    },
    invalidateKeys: [["api", "masterProyek"]],
  });

  const create = use_mutation({
    tag: "masterProyek",
    method: "create",
    mutationFn: async (payload: CreateProyekDto) => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerCreate(payload);
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
  const projectSkRequired = roRows.some((row) => row.detailMode === "detail");
  const projectSkRangeValid = (
    !form.mulai_sk && !form.berakhir_sk && !projectSkRequired
  ) || Boolean(form.mulai_sk && form.berakhir_sk && form.berakhir_sk >= form.mulai_sk);
  const valid = Boolean(
    form.kode_proyek &&
    form.nama_proyek &&
    form.tahun_fiscal &&
    form.nilai_kontrak !== "" &&
    form.total_direct_cost !== "" &&
    form.total_margin !== "" &&
    contractOk &&
    projectSkRangeValid &&
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
  function saveDraft() {
    const draft: ProjectLocalDraft = { id: editingDraftId ?? crypto.randomUUID(), savedAt: new Date().toISOString(), form, jobs, terms, unitPengusulId, unitKolaborasiIds };
    persistDrafts([draft, ...localDrafts.filter((item) => item.id !== draft.id)]);
    setEditingDraftId(draft.id);
    setFormError("");
    setOpen(false);
  }
  function editDraft(draft: ProjectLocalDraft) {
    setForm({ ...blankForm(), ...draft.form });
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
    if (!projectSkRangeValid) {
      setFormError("Isi tanggal Mulai SK dan Berakhir SK proyek secara lengkap; tanggal akhir tidak boleh sebelum tanggal mulai.");
      return;
    }
    if (form.mulai_proyek && form.estimasi_selesai_proyek && form.estimasi_selesai_proyek < form.mulai_proyek) {
      setFormError("Estimasi selesai proyek tidak boleh sebelum tanggal mulai.");
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
        mulai_proyek: form.mulai_proyek || undefined,
        estimasi_selesai_proyek: form.estimasi_selesai_proyek || undefined,
        mulai_sk: form.mulai_sk || undefined,
        berakhir_sk: form.berakhir_sk || undefined,
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
      <Card>
        <CardHeader>
          <CardTitle>Tahapan persetujuan proyek</CardTitle>
          <CardDescription>Proyek diproses secara berurutan. Rencana Operasional (RO) aktif setelah persetujuan pimpinan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="grid gap-2 sm:grid-cols-4">
            {["Pengajuan proyek", "Validasi Koordinator Umum", "Unggah notulen", "Persetujuan pimpinan"].map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span>
                <span className="font-medium leading-snug">{step}</span>
              </li>
            ))}
          </ol>
          <p className="border-t pt-3 text-sm text-muted-foreground">Setelah disetujui pimpinan, RO aktif dan proses keuangan per termin dapat dilanjutkan.</p>
        </CardContent>
      </Card>
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
      <Card>
        <CardContent className="pt-4">
          {list.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Gagal memuat proyek</AlertTitle>
              <AlertDescription>{apiErrorMessage(list.error)}</AlertDescription>
            </Alert>
          )}
          <DataTable
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
                key: "durasi",
                header: "Durasi proyek",
                className: "min-w-[13rem] whitespace-nowrap",
                render: (row: ProyekItemDto) => {
                  const start = typeof row.mulai_proyek === "string" ? row.mulai_proyek : null;
                  const end = typeof row.estimasi_selesai_proyek === "string" ? row.estimasi_selesai_proyek : null;
                  const days = start && end ? Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1 : null;
                  return (
                    <div className="text-sm">
                      <span>
                        {formatDate(start)} – {formatDate(end)}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">{days !== null && days > 0 ? `Â±${days} hari` : "Tanggal RO belum lengkap"}</p>
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
              { key: "status", header: "Status", className: "min-w-[9rem] whitespace-nowrap", render: (row: ProyekItemDto) => <StatusBadge status={projectStatusTone(row.status_proyek)}>{humanizeStatus(row.status_proyek)}</StatusBadge> },
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
            ]}
            filterValues={{ tahun, koordinator }}
            onFilterChange={(field, value) => {
              if (field === "tahun") setTahun(value);
              if (field === "koordinator") setKoordinator(value);
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
          />
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
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Ajukan Proyek"
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button variant="outline" onClick={saveDraft}>
              Simpan Draft
            </Button>
            <Button disabled={create.isPending} onClick={submit}>
              {create.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan Pengajuan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert>
            <AlertTitle>Tahapan persetujuan</AlertTitle>
            <AlertDescription>Pengajuan proyek → validasi Koordinator Umum → unggah notulen → persetujuan pimpinan. RO aktif setelah pimpinan menyetujui proyek.</AlertDescription>
          </Alert>
          {editingDraftId && (
            <Alert>
              <AlertTitle>Draft tersimpan di browser ini</AlertTitle>
              <AlertDescription>Draft tidak tersedia di browser, profil, atau perangkat lain. Berkas SK dan RAB harus dipilih kembali sebelum pengajuan.</AlertDescription>
            </Alert>
          )}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">RO awal dan rencana termin wajib seimbang sebelum proyek dikirim.</div>
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-semibold">Informasi proyek</h2>
            <p className="mt-1 text-xs text-muted-foreground">Identitas dan penanggung jawab proyek.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode proyek" required value={form.kode_proyek} onChange={(value) => setForm((current) => ({ ...current, kode_proyek: value }))} />
            <Field label="Tahun fiscal" type="number" required value={form.tahun_fiscal} onChange={(value) => setForm((current) => ({ ...current, tahun_fiscal: value }))} />
            <Field label="Nama proyek" required value={form.nama_proyek} onChange={(value) => setForm((current) => ({ ...current, nama_proyek: value }))} />
            <Field label="Nama client" value={form.nama_client} onChange={(value) => setForm((current) => ({ ...current, nama_client: value }))} />
            <Field label="Sumber pendanaan" value={form.sumber_pendanaan} onChange={(value) => setForm((current) => ({ ...current, sumber_pendanaan: value }))} />
            <Field label="Nomor kontrak" value={form.no_kontrak} onChange={(value) => setForm((current) => ({ ...current, no_kontrak: value }))} />
            <Field label="PJ 1" value={form.pj_1} onChange={(value) => setForm((current) => ({ ...current, pj_1: value }))} />
            <Field label="PJ 2" value={form.pj_2} onChange={(value) => setForm((current) => ({ ...current, pj_2: value }))} />
            <Field label="Mulai proyek" type="date" value={form.mulai_proyek} onChange={(value) => setForm((current) => ({ ...current, mulai_proyek: value }))} />
            <Field label="Estimasi selesai proyek" type="date" value={form.estimasi_selesai_proyek} onChange={(value) => setForm((current) => ({ ...current, estimasi_selesai_proyek: value }))} />
            <Field label="Mulai SK" type="date" required={projectSkRequired} value={form.mulai_sk} onChange={(value) => setForm((current) => ({ ...current, mulai_sk: value }))} />
            <Field label="Berakhir SK" type="date" required={projectSkRequired} value={form.berakhir_sk} onChange={(value) => setForm((current) => ({ ...current, berakhir_sk: value }))} />
          </div>
          <p className="text-xs text-muted-foreground">Periode SK ini berlaku untuk seluruh RO. Wajib diisi jika detail administrasi RO dilengkapi sekarang.</p>
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Unit terlibat</h2>
            <p className="max-w-3xl text-xs leading-5 text-muted-foreground">Daftarkan unit pengusul dan unit kerja yang terlibat. Pilih unit pemilik di tiap RO; beberapa RO dapat memakai nomor Job yang sama untuk membagi alokasi.</p>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2">
            <label className="grid min-w-0 gap-1.5 text-sm font-medium">
              <span>Unit pengusul *</span>
              {identity.role === "superadmin" ? (
                <FilterCombobox options={unitComboboxOptions} value={unitPengusulId} onValueChange={changeLeadUnit} label="Pilih unit pengusul" />
              ) : (
                <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm font-normal">
                  {[currentUnit?.kode_unit, currentUnit?.nama_unit].filter(Boolean).join(" · ") || "Unit akun belum tersedia"}
                </div>
              )}
            </label>
            <div className="grid min-w-0 gap-1.5 text-sm font-medium">
              <span>Tambah unit kolaborator</span>
              <FilterCombobox options={availableCollaboratorOptions} value="" onValueChange={addCollaborator} label="Pilih unit untuk ditambahkan" />
              <span className="text-xs font-normal leading-4 text-muted-foreground">Unit yang dipilih langsung masuk ke daftar.</span>
            </div>
          </div>
          {(unitPengusulId || unitKolaborasiIds.length > 0) && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span>Unit pada proyek</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{unitKolaborasiIds.length + Number(Boolean(unitPengusulId))}</span>
              </div>
              <div className="grid gap-1.5">
                {unitPengusulId && (() => {
                  const unitLabel = unitComboboxOptions.find((option) => option.value === unitPengusulId)?.label ?? "Unit pengusul";
                  return (
                    <div title={unitLabel} className="flex min-h-9 min-w-0 items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs">
                      <span className="inline-flex w-24 shrink-0 justify-center rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">Pengusul</span>
                      <span className="min-w-0 flex-1 truncate text-foreground">{unitLabel}</span>
                    </div>
                  );
                })()}
                {unitKolaborasiIds.map((unitId) => {
                  const unitLabel = unitComboboxOptions.find((option) => option.value === unitId)?.label ?? "Unit kolaborator";
                  return (
                    <div key={unitId} title={unitLabel} className="flex min-h-9 min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs">
                      <span className="inline-flex w-24 shrink-0 justify-center rounded-full bg-muted px-2 py-1 font-medium text-muted-foreground">Kolaborator</span>
                      <span className="min-w-0 flex-1 truncate">{unitLabel}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${assignedRoUnitIds.has(normalizeUnitId(unitId)) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {assignedRoUnitIds.has(normalizeUnitId(unitId)) ? "Ada di RO" : "Belum di RO"}
                      </span>
                      <button type="button" aria-label={`Hapus ${unitLabel}`} onClick={() => removeCollaborator(unitId)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={13} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!unitPengusulId && <p className="text-xs text-amber-700">Pilih unit pengusul sebelum menentukan pemilik RO.</p>}
        </section>
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-semibold">Nilai proyek</h2>
            <p className="mt-1 text-xs text-muted-foreground">Pastikan nilai kontrak sama dengan direct cost dan margin.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MoneyField label="Nilai kontrak" required value={form.nilai_kontrak} onChange={(value) => setForm((current) => ({ ...current, nilai_kontrak: value }))} />
            <MoneyField label="Total direct cost" required value={form.total_direct_cost} onChange={(value) => setForm((current) => ({ ...current, total_direct_cost: value }))} />
            <MoneyField label="Total margin" required value={form.total_margin} onChange={(value) => setForm((current) => ({ ...current, total_margin: value }))} />
          </div>
          <p className={`rounded-md px-3 py-2 text-xs ${contractOk ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
            Kontrak {formatRupiah(numeric("nilai_kontrak"))} = direct cost {formatRupiah(numeric("total_direct_cost"))} + margin {formatRupiah(numeric("total_margin"))}
          </p>
        </section>
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Job dan alokasi RO</h2>
              <p className="mt-1 text-xs text-muted-foreground">Nomor Job menjadi induk. Tambahkan beberapa RO di dalam Job yang sama jika anggaran dibagi ke unit berbeda.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addJob}>
              <Plus size={14} /> Tambah Job
            </Button>
          </div>
          {jobs.map((job, jobIndex) => {
            const jobRoTotal = job.ros.reduce((total, row) => total + (Number(row.plafonText) || 0), 0);
            const duplicateJob = job.nomor_job.trim() && jobs.some((other) => other.key !== job.key && other.nomor_job.trim().toLocaleUpperCase("id-ID") === job.nomor_job.trim().toLocaleUpperCase("id-ID"));
            return (
              <article key={job.key} className="overflow-hidden rounded-xl border bg-background shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                  <div>
                    <h3 className="font-semibold">Job {String(jobIndex + 1).padStart(2, "0")}{job.nomor_job.trim() ? ` · ${job.nomor_job.trim()}` : ""}</h3>
                    <p className="text-xs text-muted-foreground">{job.ros.length > 1 ? `Split ke ${job.ros.length} RO · Total ${formatRupiah(jobRoTotal)}` : "Satu Job dapat memuat satu atau beberapa alokasi RO."}</p>
                  </div>
                  {jobs.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeJob(job.key)}>
                      <Trash2 size={14} /> Hapus Job
                    </Button>
                  )}
                </header>
                <div className="space-y-4 p-4">
                  <div className="max-w-xl">
                    <Field label="Nomor Job *" required value={job.nomor_job} onChange={(value) => updateJob(job.key, value)} />
                    {duplicateJob && <p className="mt-1 text-xs text-destructive">Nomor Job sudah dipakai. Tambahkan RO split pada card Job yang sama.</p>}
                  </div>
                  <div className="space-y-3">
                    {job.ros.map((row, rowIndex) => {
                      const availableRoCollaborators = roUnitComboboxOptions.filter((option) => option.value !== row.id_unit_koordinator && !(row.unit_kolaborasi_ids ?? []).includes(option.value));
                      return (
                        <article key={row.key} className="overflow-hidden rounded-lg border">
                          <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2">
                            <div>
                              <h4 className="text-sm font-semibold">RO {String(rowIndex + 1).padStart(2, "0")}{row.nama_ro.trim() ? ` · ${row.nama_ro.trim()}` : ""}</h4>
                              <p className="text-xs text-muted-foreground">{row.detailMode === "detail" ? "PJ RO diisi sekarang" : "PJ RO dilengkapi nanti"}</p>
                            </div>
                            {job.ros.length > 1 && <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeRo(row.key)}><Trash2 size={14} /> Hapus RO</Button>}
                          </header>
                          <div className="grid gap-4 p-3 sm:grid-cols-2">
                            <Field label="Nama RO" required value={row.nama_ro} onChange={(value) => updateRo(row.key, "nama_ro", value)} />
                            <MoneyField label="Plafon" required value={row.plafonText} onChange={(value) => updateRo(row.key, "plafonText", value)} />
                            <fieldset className="grid gap-2 sm:col-span-2">
                              <legend className="text-sm font-medium">Detail administrasi RO</legend>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${row.detailMode === "detail" ? "border-primary bg-primary/5" : ""}`}>
                                  <input type="radio" name={`ro-detail-${row.key}`} checked={row.detailMode === "detail"} onChange={() => updateRo(row.key, "detailMode", "detail")} className="mt-1 accent-primary" />
                                  <span><strong className="block">Isi sekarang</strong><span className="text-xs text-muted-foreground">Isi PJ khusus untuk RO ini. Periode SK diatur di informasi proyek.</span></span>
                                </label>
                                <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm ${row.detailMode === "later" ? "border-primary bg-primary/5" : ""}`}>
                                  <input type="radio" name={`ro-detail-${row.key}`} checked={row.detailMode === "later"} onChange={() => updateRo(row.key, "detailMode", "later")} className="mt-1 accent-primary" />
                                  <span><strong className="block">Lengkapi nanti</strong><span className="text-xs text-muted-foreground">PJ RO dapat dilengkapi setelah proyek disetujui.</span></span>
                                </label>
                              </div>
                            </fieldset>
                            {row.detailMode === "detail" && (
                              <>
                                <div className="sm:col-span-2">
                                  <Field label="Penanggung jawab RO" required value={row.pj} onChange={(value) => updateRo(row.key, "pj", value)} />
                                </div>
                              </>
                            )}
                            <div className="sm:col-span-2">
                              <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                                <span>MAK *</span>
                                <FilterCombobox options={makComboboxOptions} value={row.mak_id} onValueChange={(value) => updateRo(row.key, "mak_id", value)} label="Pilih MAK" />
                              </label>
                            </div>
                            <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                              <span>Unit pemilik RO *</span>
                              <FilterCombobox options={roUnitComboboxOptions} value={row.id_unit_koordinator} onValueChange={(value) => updateRo(row.key, "id_unit_koordinator", value)} label="Pilih unit pemilik RO" />
                            </label>
                            <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                              <span>Rekening tujuan</span>
                              <FilterCombobox options={rekeningComboboxOptions} value={row.rekening_id ?? ""} onValueChange={(value) => updateRo(row.key, "rekening_id", value)} label="Pilih rekening (opsional)" />
                            </label>
                            <div className="grid min-w-0 content-start gap-1.5 text-sm font-medium sm:col-span-2">
                              <span>Unit kolaborasi RO</span>
                              {availableRoCollaborators.length ? (
                                <FilterCombobox options={availableRoCollaborators} value="" onValueChange={(value) => addRoCollaborator(row.key, value)} label="Pilih unit untuk langsung ditambahkan ke RO ini" />
                              ) : <p className="flex h-10 items-center rounded-md border border-dashed px-3 text-xs font-normal text-muted-foreground">Tidak ada unit lain untuk dipilih.</p>}
                              {(row.unit_kolaborasi_ids ?? []).length ? (
                                <div className="grid gap-1.5 pt-1">
                                  {(row.unit_kolaborasi_ids ?? []).map((unitId) => (
                                    <div key={unitId} title={unitComboboxOptions.find((option) => option.value === unitId)?.label ?? "Unit kolaborator"} className="flex min-h-9 min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs font-normal">
                                      <span className="min-w-0 flex-1 truncate text-foreground">{unitComboboxOptions.find((option) => option.value === unitId)?.label ?? "Unit kolaborator"}</span>
                                      <button type="button" aria-label="Hapus unit kolaborasi" onClick={() => removeRoCollaborator(row.key, unitId)} className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X size={12} /></button>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-xs font-normal text-muted-foreground">Opsional. Gunakan untuk unit yang ikut terlibat dalam RO ini.</span>}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Total alokasi Job: <strong className="text-foreground">{formatRupiah(jobRoTotal)}</strong></p>
                    <Button type="button" size="sm" variant="outline" onClick={() => addRo(job.key)}><Plus size={14} /> Tambah RO split</Button>
                  </div>
                </div>
              </article>
            );
          })}
          <p className={roTotal === numeric("total_direct_cost") ? "text-sm text-emerald-700" : "text-sm text-destructive"}>Total plafon RO: {formatRupiah(roTotal)}. Harus sama dengan direct cost.</p>
        </section>
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Rencana termin</h2>
              <p className="mt-1 text-xs text-muted-foreground">Total persentase termin harus tepat 100%.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setTerms((rows) => [...rows, blankTermin()])}>
              <Plus size={14} /> Tambah Termin
            </Button>
          </div>
          {terms.map((term, index) => (
            <div key={term.key} className="grid items-end gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <p className="pb-2 text-sm font-medium">Termin {String(index + 1).padStart(2, "0")}</p>
              <div>
                <Field label="Persentase (%)" type="number" required value={term.persentaseText} onChange={(value) => updateTerm(term.key, value)} />
                <p className="mt-1 text-xs text-muted-foreground">{formatRupiah((numeric("total_margin") * (Number(term.persentaseText) || 0)) / 100)}</p>
              </div>
              {terms.length > 1 && (
                <Button type="button" variant="destructive" size="sm" onClick={() => setTerms((rows) => rows.filter((item) => item.key !== term.key))}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
          <p className={termsTotal === 100 ? "text-sm text-emerald-700" : "text-sm text-destructive"}>Total termin: {termsTotal}% / 100%.</p>
        </section>
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-semibold">Dokumen pendukung</h2>
            <p className="mt-1 text-xs text-muted-foreground">Unggah dokumen opsional untuk melengkapi pengajuan.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DocumentUploadField label="SK Proyek" accept=".pdf" value={sk} onChange={setSk} />
            <DocumentUploadField label="RAB Proyek" accept=".pdf,.xls,.xlsx" value={rab} onChange={setRab} />
          </div>
        </section>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
      </Modal>
    </section>
  );
}
