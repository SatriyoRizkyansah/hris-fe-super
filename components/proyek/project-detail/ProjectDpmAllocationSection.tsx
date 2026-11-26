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
  const [error, setError] = useState("");
  const reservationRequests = useRef(new Set<string>());
  const participants = project.unit_terlibat ?? [];
  const isAdmin = identity.role === "superadmin";
  const isSubmitter = isAdmin || identity.userId === String(project.diajukan_oleh_id ?? "");
  const currentParticipant = participants.find((unit) => unit.id === (unitAkunProyekId || identity.unitKerjaId));
  const mayEdit = isAdmin || (["koordinator", "subkoor"].includes(identity.role ?? "") && Boolean(currentParticipant));
  const selectedUnit = participants.find((unit) => unit.id === targetUnitId);
  const selectedUnitLabel = selectedUnit ? [selectedUnit.kode_unit, selectedUnit.nama_unit].filter(Boolean).join(" — ") : "Unit belum tersedia";
  const participantsAsOptions: Option[] = participants.map((unit) => ({ value: unit.id, label: [unit.kode_unit, unit.nama_unit].filter(Boolean).join(" — ") }));
  const makOptions: Option[] = maks.map((row) => ({ value: row.id, label: [row.kode_mak, row.nama_mak].filter(Boolean).join(" — ") }));
  const accountOptions: Option[] = accounts.map((row) => ({ value: row.id, label: [row.nama_bank, row.nama_rekening, row.nomor_rekening ? `(${row.nomor_rekening})` : ""].filter(Boolean).join(" — ") }));
  const existingJobs = project.job_list ?? [];
  const jobTotals = (project.ro_list ?? []).reduce((sum, ro) => sum + Number(ro.plafon ?? 0), 0);
  const allSubmitted = participants.length > 0 && participants.every((unit) => Boolean(unit.alokasi_dikirim_pada));
  const directCost = Number(project.total_direct_cost ?? 0);
  const totalsMatch = jobTotals === directCost;
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

  function loadUnitAllocation(unitId: string) {
    setTargetUnitId(unitId);
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
      return requestHrisApi(`/api/proyek/${project.id}/alokasi-unit`, { method: "PUT", body: JSON.stringify({ ...(isAdmin ? { unit_kerja_id: targetUnitId } : {}), job_list }) });
    },
    successMessage: "Alokasi Job dan RO unit berhasil dikirim.",
    invalidateKeys: [["api", "masterProyek"]],
    onSuccess: async () => {
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
        <p className="text-muted-foreground">Total plafon RO: <strong className="text-foreground">{formatRupiah(jobTotals)}</strong> dari direct cost {formatRupiah(directCost)}.</p>
        {isSubmitter && (
          <Button type="button" size="sm" disabled={!allSubmitted || !totalsMatch || submitFinal.isPending} onClick={() => void submitFinal.mutateAsync().catch(() => undefined)}>
            {submitFinal.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
            Kirim ke pemeriksaan
          </Button>
        )}
      </div>
      {isSubmitter && !allSubmitted && <p className="text-xs text-amber-800">Menunggu alokasi dari {pendingUnits.length} unit DPM.</p>}
      {allSubmitted && !totalsMatch && <p className="text-xs text-destructive">Total plafon semua RO harus sama dengan direct cost sebelum proyek dikirim.</p>}

      <Modal
        open={open}
        onClose={() => !saveAllocation.isPending && setOpen(false)}
        title="Isi alokasi Job dan RO"
        description="Nomor Job dibuat oleh sistem. RO yang memakai Job yang sama akan tercatat sebagai split alokasi."
        size="xl"
        bodyClassName="space-y-4"
        footer={<>
          <Button type="button" variant="outline" disabled={saveAllocation.isPending} onClick={() => setOpen(false)}>Batal</Button>
          <Button type="button" disabled={saveAllocation.isPending} onClick={submitAllocation}>{saveAllocation.isPending && <LoaderCircle className="animate-spin" size={15} />} Kirim alokasi unit</Button>
        </>}
      >
        <section className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm font-medium">Unit DPM</p>
          {isAdmin ? <FilterCombobox options={participantsAsOptions} value={targetUnitId} onValueChange={loadUnitAllocation} label="Pilih unit DPM" /> : <p className="text-sm text-muted-foreground">{selectedUnitLabel}</p>}
          <p className="text-xs text-muted-foreground">RO yang dibuat pada formulir ini otomatis dimiliki unit tersebut.</p>
        </section>

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
