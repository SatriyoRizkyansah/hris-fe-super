"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus, Send, Trash2 } from "lucide-react";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiErrorMessage, envelopeData, requestHrisApi } from "@/lib/hris/api";
import { formatDate, formatRupiah } from "@/lib/hris/format";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { createClientId } from "@/lib/utils/client-id";
import type { ProjectDetail } from "./types";

type Option = { value: string; label: string };
type Lookup = {
  id: string;
  kode_unit?: string;
  nama_unit?: string;
  kode_mak?: string;
  nama_mak?: string;
  nama_bank?: string;
  nama_rekening?: string;
  nomor_rekening?: string;
};
type AllocationRo = { key: string; mak_id: string; plafon: string; rekening_id: string; pj: string; unit_kolaborasi_ids: string[] };
type AllocationJob = { key: string; job_proyek_id: string; nomor_job?: string; nomor_job_reservasi_id?: string; nama_job: string; kategori_job: string; ros: AllocationRo[] };
type ProjectInfoForm = {
  nama_proyek: string;
  no_kontrak: string;
  no_kontrak_reservasi_id: string;
  mulai_kontrak: string;
  berakhir_kontrak: string;
  pj_1: string;
  pj_2: string;
  nilai_kontrak: string;
  total_margin: string;
  termin_list: Array<{ key: string; persentase: string }>;
};
const categories = [
  ["LABORATORIUM", "Laboratorium"], ["STUDI", "Studi"], ["KAJIAN", "Kajian"],
  ["DOMINAN_LAB", "Dominan Lab"], ["DOMINAN_STUDI", "Dominan Studi"],
] as const;

function newRo(): AllocationRo {
  return { key: createClientId(), mak_id: "", plafon: "", rekening_id: "", pj: "", unit_kolaborasi_ids: [] };
}

function newJob(): AllocationJob {
  return { key: createClientId(), job_proyek_id: "", nama_job: "", kategori_job: "", ros: [newRo()] };
}

function projectInfoFrom(project: ProjectDetail): ProjectInfoForm {
  const existingTerms = project.termin_list ?? [];
  return {
    nama_proyek: String(project.nama_proyek ?? ""),
    no_kontrak: String(project.no_kontrak ?? ""),
    no_kontrak_reservasi_id: "",
    mulai_kontrak: String(project.mulai_kontrak ?? "").slice(0, 10),
    berakhir_kontrak: String(project.berakhir_kontrak ?? "").slice(0, 10),
    pj_1: String(project.pj_1 ?? ""),
    pj_2: String(project.pj_2 ?? ""),
    nilai_kontrak: project.nilai_kontrak ? String(project.nilai_kontrak) : "",
    total_margin: project.total_margin !== undefined && project.total_margin !== null ? String(project.total_margin) : "",
    termin_list: existingTerms.length
      ? existingTerms.map((term) => ({ key: createClientId(), persentase: String(term.persentase) }))
      : [{ key: createClientId(), persentase: "100" }],
  };
}

export function ProjectDpmAllocationSection({
  project,
  identity,
  unitAkunProyekId,
  units,
  maks,
  accounts,
  onChanged,
}: {
  project: ProjectDetail;
  identity: { role: string | null; userId: string; unitKerjaId: string };
  unitAkunProyekId: string;
  units: Lookup[];
  maks: Lookup[];
  accounts: Lookup[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [targetUnitId, setTargetUnitId] = useState("");
  const [jobs, setJobs] = useState<AllocationJob[]>([]);
  const [projectInfo, setProjectInfo] = useState<ProjectInfoForm>(() => projectInfoFrom(project));
  const [error, setError] = useState("");
  const reservationRequests = useRef(new Set<string>());
  const contractReservation = useRef<{ id: string; number: string } | null>(null);
  const participants = project.unit_terlibat ?? [];
  const isAdmin = identity.role === "superadmin";
  const isSubmitter = isAdmin || identity.userId === String(project.diajukan_oleh_id ?? "");
  const currentParticipant = participants.find((unit) => unit.id === (unitAkunProyekId || identity.unitKerjaId));
  const mayEdit = isAdmin || (["koordinator", "subkoor"].includes(identity.role ?? "") && Boolean(currentParticipant));
  const selectedUnit = participants.find((unit) => unit.id === targetUnitId);
  const isLeadUnit = selectedUnit?.peran === "PENGUSUL";
  const selectedUnitLabel = selectedUnit ? [selectedUnit.kode_unit, selectedUnit.nama_unit].filter(Boolean).join(" — ") : "Unit belum tersedia";
  const participantsAsOptions: Option[] = participants.map((unit) => ({ value: unit.id, label: [unit.kode_unit, unit.nama_unit].filter(Boolean).join(" — ") }));
  const makOptions: Option[] = maks.map((row) => ({ value: row.id, label: [row.kode_mak, row.nama_mak].filter(Boolean).join(" — ") }));
  const accountOptions: Option[] = accounts.map((row) => ({ value: row.id, label: [row.nama_bank, row.nama_rekening, row.nomor_rekening ? `(${row.nomor_rekening})` : ""].filter(Boolean).join(" — ") }));
  const existingJobs = project.job_list ?? [];
  const jobTotals = (project.ro_list ?? []).reduce((sum, ro) => sum + Number(ro.plafon ?? 0), 0);
  const allSubmitted = participants.length > 0 && participants.every((unit) => Boolean(unit.alokasi_dikirim_pada));
  const currentUnitTotal = jobs.reduce((sum, job) => sum + job.ros.reduce((jobSum, ro) => jobSum + (Number(ro.plafon) || 0), 0), 0);
  const otherUnitsTotal = (project.ro_list ?? []).filter((ro) => ro.id_unit_koordinator !== targetUnitId).reduce((sum, ro) => sum + Number(ro.plafon ?? 0), 0);
  const plannedDirectCost = targetUnitId ? otherUnitsTotal + currentUnitTotal : jobTotals;
  const totalMargin = Number(projectInfo.total_margin) || 0;
  const contractValue = Number(projectInfo.nilai_kontrak) || 0;
  const termsTotal = projectInfo.termin_list.reduce((sum, term) => sum + (Number(term.persentase) || 0), 0);
  const projectInfoValid = Boolean(projectInfo.nama_proyek.trim() && projectInfo.no_kontrak && contractValue > 0 && totalMargin >= 0 && termsTotal === 100 && (Boolean(projectInfo.mulai_kontrak) === Boolean(projectInfo.berakhir_kontrak)) && (!projectInfo.mulai_kontrak || projectInfo.berakhir_kontrak >= projectInfo.mulai_kontrak));
  const totalsMatch = contractValue > 0 && contractValue === plannedDirectCost + totalMargin;
  const readyToSubmit = allSubmitted && projectInfoValid && totalsMatch;
  const pendingUnits = participants.filter((unit) => !unit.alokasi_dikirim_pada);
  async function reserveJobNumber(key: string) {
    if (reservationRequests.current.has(key)) return;
    reservationRequests.current.add(key);
    try {
      setBrowserToken();
      const response = await requestHrisApi<{ data?: { id: string; nomor_job: string } }>("/api/proyek/job-number/reserve", { method: "POST" });
      const reservation = envelopeData<{ id: string; nomor_job: string }>(response);
      if (!reservation?.id || !reservation.nomor_job) throw new Error("Nomor Job tidak diterima dari server.");
      setJobs((current) => current.map((job) => job.key === key && !job.job_proyek_id ? { ...job, nomor_job: reservation.nomor_job, nomor_job_reservasi_id: reservation.id } : job));
    } catch (cause) {
      setError(apiErrorMessage(cause, "Nomor Job belum dapat disiapkan."));
    } finally {
      reservationRequests.current.delete(key);
    }
  }

  async function reserveProjectContractNumber() {
    if (contractReservation.current) return contractReservation.current;
    setBrowserToken();
    const response = await requestHrisApi<{ data?: { id: string; no_kontrak: string } }>(`/api/proyek/${project.id}/contract-number/reserve`, { method: "POST" });
    const reservation = envelopeData<{ id: string; no_kontrak: string }>(response);
    if (!reservation?.id || !reservation.no_kontrak) throw new Error("Nomor kontrak tidak diterima dari server.");
    contractReservation.current = { id: reservation.id, number: reservation.no_kontrak };
    setProjectInfo((current) => ({ ...current, no_kontrak: reservation.no_kontrak, no_kontrak_reservasi_id: reservation.id }));
    return contractReservation.current;
  }

  function loadUnitAllocation(unitId: string) {
    setTargetUnitId(unitId);
    const participant = participants.find((unit) => unit.id === unitId);
    const nextProjectInfo = projectInfoFrom(project);
    if (participant?.peran === "PENGUSUL" && !project.no_kontrak && contractReservation.current) {
      nextProjectInfo.no_kontrak = contractReservation.current.number;
      nextProjectInfo.no_kontrak_reservasi_id = contractReservation.current.id;
    }
    setProjectInfo(nextProjectInfo);
    const rows: AllocationJob[] = existingJobs.flatMap((job) => {
      const ownedRos = (job.ro_list ?? []).filter((ro) => ro.id_unit_koordinator === unitId);
      if (!ownedRos.length) return [];
      return [{
        key: createClientId(),
        job_proyek_id: job.id,
        nomor_job: job.nomor_job,
        nama_job: job.nama_job ?? "",
        kategori_job: job.kategori_job ?? "",
        ros: ownedRos.map((ro) => ({
          key: createClientId(),
          mak_id: ro.mak_id ?? "",
          plafon: String(ro.plafon ?? ""),
          rekening_id: ro.rekening_id ?? "",
          pj: ro.pj ?? "",
          unit_kolaborasi_ids: ro.unit_kolaborasi_ids ?? [],
        })),
      }];
    });
    const initialJobs = rows.length ? rows : [newJob()];
    setJobs(initialJobs);
    setError("");
    for (const job of initialJobs) if (!job.job_proyek_id && !job.nomor_job_reservasi_id) void reserveJobNumber(job.key);
    if (participant?.peran === "PENGUSUL" && !project.no_kontrak && !contractReservation.current) {
      void reserveProjectContractNumber().catch((cause) => setError(apiErrorMessage(cause, "Nomor kontrak belum dapat disiapkan.")));
    }
  }

  useEffect(() => {
    if (!open || !targetUnitId) return;
    for (const job of jobs) if (!job.job_proyek_id && !job.nomor_job_reservasi_id) void reserveJobNumber(job.key);
  }, [open, targetUnitId, jobs]);

  const saveAllocation = use_mutation({
    tag: "masterProyek",
    method: "saveDpmAllocation",
    mutationFn: async () => {
      setBrowserToken();
      const job_list = jobs.map((job) => ({
        ...(job.job_proyek_id ? { job_proyek_id: job.job_proyek_id } : { nomor_job_reservasi_id: job.nomor_job_reservasi_id, nama_job: job.nama_job.trim(), kategori_job: job.kategori_job }),
        ro_list: job.ros.map((ro) => ({
          mak_id: ro.mak_id,
          id_unit_koordinator: targetUnitId,
          plafon: Number(ro.plafon),
          ...(ro.rekening_id ? { rekening_id: ro.rekening_id } : {}),
          ...(ro.pj.trim() ? { pj: ro.pj.trim() } : {}),
          unit_kolaborasi_ids: ro.unit_kolaborasi_ids,
        })),
      }));
      const informasi_proyek = isLeadUnit ? {
        nama_proyek: projectInfo.nama_proyek.trim(),
        ...(projectInfo.no_kontrak_reservasi_id ? { no_kontrak_reservasi_id: projectInfo.no_kontrak_reservasi_id } : {}),
        mulai_kontrak: projectInfo.mulai_kontrak || undefined,
        berakhir_kontrak: projectInfo.berakhir_kontrak || undefined,
        pj_1: projectInfo.pj_1.trim() || undefined,
        pj_2: projectInfo.pj_2.trim() || undefined,
        nilai_kontrak: Number(projectInfo.nilai_kontrak),
        total_margin: Number(projectInfo.total_margin),
        termin_list: projectInfo.termin_list.map((term, index) => ({ nomor_termin: index + 1, persentase: Number(term.persentase) })),
      } : undefined;
      return requestHrisApi(`/api/proyek/${project.id}/alokasi-unit`, { method: "PUT", body: JSON.stringify({ ...(isAdmin ? { unit_kerja_id: targetUnitId } : {}), ...(informasi_proyek ? { informasi_proyek } : {}), job_list }) });
    },
    successMessage: "Alokasi Job dan RO unit berhasil dikirim.",
    invalidateKeys: [["api", "masterProyek"]],
    onSuccess: async () => {
      if (isLeadUnit) contractReservation.current = null;
      await onChanged();
      setOpen(false);
    },
  });

  const submitFinal = use_mutation({
    tag: "masterProyek",
    method: "submitAfterDpmAllocations",
    mutationFn: async () => {
      setBrowserToken();
      return requestHrisApi(`/api/proyek/${project.id}/kirim-validasi`, { method: "POST" });
    },
    successMessage: "Proyek dikirim ke pemeriksaan Koordinator Layanan.",
    invalidateKeys: [["api", "masterProyek"]],
    onSuccess: onChanged,
  });

  function updateJob(key: string, field: keyof AllocationJob, value: string) {
    setJobs((current) => current.map((job) => job.key === key ? { ...job, [field]: value } : job));
  }

  function updateRo(jobKey: string, roKey: string, field: keyof AllocationRo, value: string) {
    setJobs((current) => current.map((job) => job.key === jobKey ? { ...job, ros: job.ros.map((ro) => ro.key === roKey ? { ...ro, [field]: value } : ro) } : job));
  }

  function addJob() {
    const job = newJob();
    setJobs((current) => [...current, job]);
    void reserveJobNumber(job.key);
  }

  function addRo(jobKey: string) {
    setJobs((current) => current.map((job) => job.key === jobKey ? { ...job, ros: [...job.ros, newRo()] } : job));
  }

  function addRoCollaborator(jobKey: string, roKey: string, unitId: string) {
    if (!unitId) return;
    setJobs((current) => current.map((job) => job.key !== jobKey ? job : {
      ...job,
      ros: job.ros.map((ro) => ro.key !== roKey || ro.unit_kolaborasi_ids.includes(unitId) ? ro : { ...ro, unit_kolaborasi_ids: [...ro.unit_kolaborasi_ids, unitId] }),
    }));
  }

  function submitAllocation() {
    setError("");
    if (!targetUnitId || !jobs.length) return setError("Pilih unit DPM dan tambahkan minimal satu Job.");
    if (jobs.some((job) => !job.ros.length || job.ros.some((ro) => !ro.mak_id || Number(ro.plafon) <= 0))) return setError("Setiap RO harus memiliki MAK dan plafon lebih dari nol.");
    if (jobs.some((job) => !job.job_proyek_id && (!job.nomor_job_reservasi_id || !job.nama_job.trim() || !job.kategori_job))) return setError("Lengkapi nama, kategori, dan nomor Job otomatis.");
    if (isLeadUnit && !projectInfoValid) return setError("Lengkapi informasi proyek, kontrak, nilai, dan termin dengan benar.");
    void saveAllocation.mutateAsync().catch((cause) => setError(apiErrorMessage(cause, "Alokasi unit gagal disimpan.")));
  }

  if (project.status_proyek !== "MENUNGGU_ALOKASI_DPM") return null;

  return (
    <section className="space-y-4 rounded-xl border bg-background p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Alokasi Job dan RO per unit DPM</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Setiap DPM mengisi Job dan RO miliknya. Pilih Job yang sudah ada jika alokasi ini merupakan pecahan dari Job yang sama.</p>
        </div>
        <StatusBadge status="warn">Draft menunggu alokasi</StatusBadge>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {participants.map((unit) => {
          const submitted = Boolean(unit.alokasi_dikirim_pada);
          // The backend resolves Subkoordinator accounts to their parent DPM.
          const isCurrentUnit = (unitAkunProyekId || identity.unitKerjaId) === unit.id;
          return (
            <article key={unit.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={[unit.kode_unit, unit.nama_unit].filter(Boolean).join(" — ")}>{unit.nama_unit}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{unit.kode_unit} · {unit.peran === "PENGUSUL" ? "DPM utama" : "DPM terlibat"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${submitted ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{submitted ? "Terkirim" : "Menunggu"}</span>
              </div>
              {submitted && <p className="mt-2 text-xs text-muted-foreground">Dikirim {formatDate(unit.alokasi_dikirim_pada)}</p>}
              {(isAdmin || (mayEdit && isCurrentUnit)) && (
                <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={() => { loadUnitAllocation(unit.id); setOpen(true); }}>
                  {submitted ? "Perbarui alokasi" : "Isi alokasi Job/RO"}
                </Button>
              )}
            </article>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2 text-sm">
        <p className="text-muted-foreground">Total plafon RO saat ini: <strong className="text-foreground">{formatRupiah(jobTotals)}</strong>.</p>
        {isSubmitter && (
          <Button type="button" size="sm" disabled={!readyToSubmit || submitFinal.isPending} onClick={() => void submitFinal.mutateAsync().catch(() => undefined)}>
            {submitFinal.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
            Kirim ke pemeriksaan
          </Button>
        )}
      </div>
      {isSubmitter && !allSubmitted && <p className="text-xs text-amber-800">Menunggu alokasi dari {pendingUnits.length} unit DPM.</p>}
      {allSubmitted && !projectInfoValid && <p className="text-xs text-amber-800">DPM utama perlu melengkapi informasi kontrak, nilai proyek, dan termin.</p>}
      {allSubmitted && projectInfoValid && !totalsMatch && <p className="text-xs text-destructive">Nilai kontrak {formatRupiah(contractValue)} harus sama dengan total plafon RO {formatRupiah(plannedDirectCost)} ditambah margin {formatRupiah(totalMargin)}.</p>}

      <Modal
        open={open}
        onClose={() => !saveAllocation.isPending && setOpen(false)}
        title="Isi alokasi Job dan RO"
        description="Nomor Job dibuat oleh sistem. RO yang memakai Job yang sama akan tercatat sebagai split alokasi."
        size="xl"
        bodyClassName="space-y-4"
        footer={<>
          <Button type="button" variant="outline" disabled={saveAllocation.isPending} onClick={() => setOpen(false)}>Batal</Button>
          <Button type="button" disabled={saveAllocation.isPending} onClick={submitAllocation}>{saveAllocation.isPending && <LoaderCircle className="animate-spin" size={15} />} {isLeadUnit ? "Simpan data proyek & alokasi" : "Kirim alokasi unit"}</Button>
        </>}
      >
        <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm font-medium">Unit DPM</p>
          {isAdmin ? <FilterCombobox options={participantsAsOptions} value={targetUnitId} onValueChange={loadUnitAllocation} label="Pilih unit DPM" /> : <p className="text-sm text-muted-foreground">{selectedUnitLabel}</p>}
          <p className="text-xs text-muted-foreground">RO yang dibuat pada formulir ini otomatis dimiliki unit tersebut.</p>
        </section>

        {isLeadUnit && <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h3 className="text-sm font-semibold">Informasi proyek dan kontrak</h3>
            <p className="mt-1 text-xs text-muted-foreground">Diisi DPM utama setelah order dari PILT diterima. Direct cost dihitung dari total plafon seluruh RO.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>Nama proyek *</span><Input value={projectInfo.nama_proyek} onChange={(event) => setProjectInfo((current) => ({ ...current, nama_proyek: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>Nomor kontrak *</span><Input value={projectInfo.no_kontrak} readOnly className="bg-muted/30 font-mono" placeholder="Menyiapkan nomor kontrak..." /></label>
            <p className="self-end pb-2 text-xs text-muted-foreground">Nomor dibuat otomatis untuk DPM utama.</p>
            <label className="grid gap-1.5 text-sm font-medium"><span>Mulai kontrak</span><Input type="date" value={projectInfo.mulai_kontrak} onChange={(event) => setProjectInfo((current) => ({ ...current, mulai_kontrak: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>Berakhir kontrak</span><Input type="date" value={projectInfo.berakhir_kontrak} onChange={(event) => setProjectInfo((current) => ({ ...current, berakhir_kontrak: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>PJ 1</span><Input value={projectInfo.pj_1} onChange={(event) => setProjectInfo((current) => ({ ...current, pj_1: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>PJ 2</span><Input value={projectInfo.pj_2} onChange={(event) => setProjectInfo((current) => ({ ...current, pj_2: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>Nilai kontrak *</span><MoneyInput value={projectInfo.nilai_kontrak} onValueChange={(value) => setProjectInfo((current) => ({ ...current, nilai_kontrak: value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium"><span>Total margin *</span><MoneyInput value={projectInfo.total_margin} onValueChange={(value) => setProjectInfo((current) => ({ ...current, total_margin: value }))} /></label>
          </div>
          <div className="space-y-2 rounded-md bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2"><div><p className="text-sm font-medium">Rencana termin *</p><p className="text-xs text-muted-foreground">Persentase termin harus berjumlah 100%.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setProjectInfo((current) => ({ ...current, termin_list: [...current.termin_list, { key: createClientId(), persentase: "" }] }))}><Plus size={13} /> Tambah</Button></div>
            {projectInfo.termin_list.map((term, index) => <div key={term.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"><label className="grid gap-1 text-sm"><span className="text-xs text-muted-foreground">Termin {String(index + 1).padStart(2, "0")} (%)</span><Input type="number" min="1" max="100" value={term.persentase} onChange={(event) => setProjectInfo((current) => ({ ...current, termin_list: current.termin_list.map((item) => item.key === term.key ? { ...item, persentase: event.target.value } : item) }))} /></label>{projectInfo.termin_list.length > 1 && <Button type="button" size="sm" variant="ghost" aria-label="Hapus termin" onClick={() => setProjectInfo((current) => ({ ...current, termin_list: current.termin_list.filter((item) => item.key !== term.key) }))}><Trash2 size={14} /></Button>}</div>)}
            <p className={`text-xs ${termsTotal === 100 ? "text-emerald-700" : "text-amber-800"}`}>Total termin: {termsTotal}% / 100%. Direct cost sementara {formatRupiah(plannedDirectCost)}; margin {formatRupiah(totalMargin)}.</p>
          </div>
        </section>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold">Job dan alokasi RO</h3><p className="text-xs text-muted-foreground">Gunakan Job baru atau pilih Job untuk berbagi nomor Job dengan unit lain.</p></div>
          <Button type="button" size="sm" variant="outline" onClick={addJob}><Plus size={14} /> Tambah Job</Button>
        </div>

        {jobs.map((job, index) => {
          const selectedExisting = existingJobs.find((item) => item.id === job.job_proyek_id);
          return (
            <article key={job.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-semibold">Job {String(index + 1).padStart(2, "0")}</h4>{jobs.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setJobs((current) => current.filter((item) => item.key !== job.key))}><Trash2 size={14} /> Hapus</Button>}</div>
              <label className="grid gap-1.5 text-sm font-medium"><span>Nomor Job bersama</span>
                <select className="h-9 rounded-md border bg-background px-3 text-sm font-normal" value={job.job_proyek_id} onChange={(event) => {
                  const selected = existingJobs.find((item) => item.id === event.target.value);
                  if (selected) setJobs((current) => current.map((item) => item.key === job.key ? { ...item, job_proyek_id: selected.id, nomor_job: selected.nomor_job, nama_job: selected.nama_job ?? "", kategori_job: selected.kategori_job ?? "" } : item));
                  else { const next = { ...job, job_proyek_id: "", nomor_job: undefined, nama_job: "", kategori_job: "", nomor_job_reservasi_id: undefined }; setJobs((current) => current.map((item) => item.key === job.key ? next : item)); void reserveJobNumber(job.key); }
                }}>
                  <option value="">Buat Job baru</option>
                  {existingJobs.filter((item) => !jobs.some((other) => other.key !== job.key && other.job_proyek_id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.nomor_job} · {item.nama_job ?? "Job proyek"}</option>)}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium"><span>Nomor Job</span><Input readOnly value={selectedExisting?.nomor_job ?? job.nomor_job ?? "Menyiapkan nomor..."} className="bg-muted/30 font-mono" /></label>
                {!job.job_proyek_id && <>
                  <label className="grid gap-1.5 text-sm font-medium"><span>Nama Job *</span><Input value={job.nama_job} onChange={(event) => updateJob(job.key, "nama_job", event.target.value)} /></label>
                  <label className="grid gap-1.5 text-sm font-medium"><span>Kategori Job *</span><select className="h-9 rounded-md border bg-background px-3 text-sm font-normal" value={job.kategori_job} onChange={(event) => updateJob(job.key, "kategori_job", event.target.value)}><option value="">Pilih kategori</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                </>}
                {job.job_proyek_id && <div className="self-end text-sm text-muted-foreground">{selectedExisting?.nama_job} · {selectedExisting?.kategori_job}</div>}
              </div>

              {job.ros.map((ro, roIndex) => {
                const collaborators = participantsAsOptions.filter((option) => option.value !== targetUnitId && !ro.unit_kolaborasi_ids.includes(option.value));
                return <div key={ro.key} className="space-y-3 rounded-md bg-muted/20 p-3">
                  <div className="flex items-center justify-between"><p className="text-sm font-medium">Alokasi RO {String(roIndex + 1).padStart(2, "0")}</p>{job.ros.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setJobs((current) => current.map((item) => item.key === job.key ? { ...item, ros: item.ros.filter((row) => row.key !== ro.key) } : item))}><Trash2 size={13} /> Hapus RO</Button>}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-medium"><span>MAK *</span><FilterCombobox options={makOptions} value={ro.mak_id} onValueChange={(value) => updateRo(job.key, ro.key, "mak_id", value)} label="Pilih MAK" /></label>
                    <label className="grid gap-1.5 text-sm font-medium"><span>Plafon RO *</span><MoneyInput aria-label="Plafon RO" value={ro.plafon} onValueChange={(value) => updateRo(job.key, ro.key, "plafon", value)} /></label>
                    <label className="grid gap-1.5 text-sm font-medium"><span>Rekening tujuan</span><FilterCombobox options={accountOptions} value={ro.rekening_id} onValueChange={(value) => updateRo(job.key, ro.key, "rekening_id", value)} label="Pilih rekening (opsional)" /></label>
                    <label className="grid gap-1.5 text-sm font-medium"><span>Penanggung jawab RO</span><Input value={ro.pj} onChange={(event) => updateRo(job.key, ro.key, "pj", event.target.value)} placeholder="Opsional" /></label>
                    <div className="grid gap-1.5 text-sm font-medium sm:col-span-2"><span>Unit kolaborasi RO</span><FilterCombobox options={collaborators} value="" onValueChange={(value) => addRoCollaborator(job.key, ro.key, value)} label="Pilih unit DPM yang berkolaborasi" />{ro.unit_kolaborasi_ids.length > 0 && <p className="text-xs text-muted-foreground">{ro.unit_kolaborasi_ids.map((id) => participantsAsOptions.find((option) => option.value === id)?.label ?? id).join(" · ")}</p>}</div>
                  </div>
                </div>;
              })}
              <Button type="button" variant="outline" size="sm" onClick={() => addRo(job.key)}><Plus size={14} /> Tambah RO split</Button>
            </article>
          );
        })}

        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      </Modal>
    </section>
  );
}
