"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, envelopeRows, requestHrisApi, unwrapEnvelope } from "@/lib/hris/api";
import { formatDate } from "@/lib/hris/format";
import type { CreateRoDto, ProyekItemDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, unknown>;
type Form = {
  id_mak: string;
  id_proyek: string;
  id_unit_koordinator: string;
  id_rekening: string;
  tahun_fiscal: string;
  total_plafon: string;
  no_kontrak: string;
  job_proyek_id: string;
  nama_job: string;
  kategori_job: string;
  nomor_job: string;
  nomor_job_reservasi_id: string;
  pj: string;
};
const blank = (): Form => ({
  id_mak: "",
  id_proyek: "",
  id_unit_koordinator: "",
  id_rekening: "",
  tahun_fiscal: String(new Date().getFullYear()),
  total_plafon: "",
  no_kontrak: "",
  job_proyek_id: "",
  nama_job: "",
  kategori_job: "",
  nomor_job: "",
  nomor_job_reservasi_id: "",
  pj: "",
});

export function CreateRoDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => Promise<unknown> | void }) {
  const [form, setForm] = useState<Form>(blank);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>([]);
  const [collaboratorCandidate, setCollaboratorCandidate] = useState("");
  const [error, setError] = useState("");
  const reservationRequests = useRef(new Set<string>());
  const mak = use_query({
    tag: "masterMak",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterMak.masterMakFindAllControllerFindAll();
    },
  });
  const project = use_query({
    tag: "masterProyek",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekGetDataControllerGetData({ limit: 200 });
    },
  });
  const projectDetail = use_query({
    tag: "masterProyek",
    method: "detail-ro-form",
    params: { id: form.id_proyek },
    enabled: Boolean(form.id_proyek),
    queryFn: async ({ id }) => {
      setBrowserToken();
      return browserApi.masterProyek.proyekGetDetailControllerGetDetail(id);
    },
  });
  const unit = use_query({
    tag: "masterUnitKerja",
    method: "coordinator-options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetGetDataControllerGetData({ tipe_unit: "KOORDINATOR", limit: 200 });
    },
  });
  const rekening = use_query({
    tag: "masterRekening",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRekeningBank.masterRekeningFindAllControllerFindAll();
    },
  });
  const create = use_mutation({
    tag: "masterRo",
    method: "create",
    mutationFn: async (data: CreateRoDto) => {
      setBrowserToken();
      return browserApi.masterRo.roCreateControllerCreate(data);
    },
    onSuccess: async () => {
      await onCreated();
      setForm(blank());
      setCollaboratorIds([]);
      setCollaboratorCandidate("");
      setError("");
      onOpenChange(false);
    },
  });
  const maks = envelopeRows<Row>(mak.data);
  const projects = envelopeRows<ProyekItemDto>(project.data);
  const units = envelopeRows<Row>(unit.data);
  const selectedProject = projects.find((row) => row.id === form.id_proyek);
  const selectedProjectDetail = envelopeData<Row>(projectDetail.data);
  const projectJobs = Array.isArray(selectedProjectDetail?.job_list)
    ? selectedProjectDetail.job_list as Row[]
    : [];
  const selectedJob = projectJobs.find((job) => String(job.id) === form.job_proyek_id);
  const creatingJob = form.job_proyek_id === "__new__" || (!form.job_proyek_id && !projectJobs.length);
  useEffect(() => {
    if (!open || !form.id_proyek || !creatingJob || projectDetail.isFetching || form.nomor_job_reservasi_id) return;
    const projectId = form.id_proyek;
    const jobId = form.job_proyek_id;
    const requestKey = `${projectId}:${jobId || "new"}`;
    if (reservationRequests.current.has(requestKey)) return;
    reservationRequests.current.add(requestKey);
    void (async () => {
      try {
        const response = await requestHrisApi("/api/proyek/job-number/reserve", { method: "POST" });
        const reservation = unwrapEnvelope<{ id: string; nomor_job: string }>(response).data;
        if (!reservation?.id || !reservation.nomor_job) throw new Error("Nomor Job tidak diterima dari server.");
        setForm((current) => current.id_proyek === projectId && current.job_proyek_id === jobId
          ? { ...current, nomor_job: reservation.nomor_job, nomor_job_reservasi_id: reservation.id }
          : current);
      } catch (cause) {
        setError(apiErrorMessage(cause, "Nomor Job belum dapat disiapkan. Pilih ulang proyek untuk mencoba lagi."));
      } finally {
        reservationRequests.current.delete(requestKey);
      }
    })();
  }, [open, form.id_proyek, form.job_proyek_id, form.nomor_job_reservasi_id, creatingJob, projectDetail.isFetching]);
  const projectUnits = units.filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const collaboratorOptions = projectUnits
    .filter((row) => String(row.id) !== form.id_unit_koordinator && !collaboratorIds.includes(String(row.id)))
    .map((row) => ({ value: String(row.id), label: `${String(row.kode_unit)} — ${String(row.nama_unit)}` }));
  const rekenings = envelopeRows<Row>(rekening.data);
  const field = (key: keyof Form, value: string) => {
    setForm((state) => ({
      ...state,
      [key]: value,
      ...(key === "job_proyek_id" && value !== "__new__" ? { nomor_job: "", nomor_job_reservasi_id: "" } : {}),
    }));
    if (key === "id_unit_koordinator") setCollaboratorIds((ids) => ids.filter((id) => id !== value));
  };
  async function submit() {
    if (!form.id_mak || !form.id_proyek || !form.id_unit_koordinator || !form.tahun_fiscal || Number(form.total_plafon) <= 0 || (creatingJob && (!form.nama_job.trim() || !form.kategori_job || !form.nomor_job_reservasi_id)) || (!creatingJob && !form.job_proyek_id)) {
      setError("Lengkapi MAK, proyek, unit pemilik, tahun fiskal, Job, dan plafon.");
      return;
    }
    try {
      setError("");
      await create.mutateAsync({
        id_mak: form.id_mak,
        id_proyek: form.id_proyek,
        id_unit_koordinator: form.id_unit_koordinator,
        id_rekening: form.id_rekening || undefined,
        tahun_fiscal: Number(form.tahun_fiscal),
        total_plafon: Number(form.total_plafon),
        no_kontrak: form.no_kontrak || undefined,
        ...(creatingJob ? {
          nama_job: form.nama_job.trim(),
          kategori_job: form.kategori_job as CreateRoDto["kategori_job"],
          nomor_job_reservasi_id: form.nomor_job_reservasi_id,
        } : { job_proyek_id: form.job_proyek_id }),
        unit_kolaborasi_ids: collaboratorIds,
        pj: form.pj || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Gagal membuat RO."));
    }
  }
  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title="Tambah RO"
      description="RO mandiri hanya untuk Superadmin. Total plafon tidak boleh melampaui direct cost proyek."
      size="lg"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button disabled={create.isPending} onClick={submit}>
            {create.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan RO
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Tahun fiskal *<Input type="number" value={form.tahun_fiscal} onChange={(event) => field("tahun_fiscal", event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          MAK *
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_mak} onChange={(event) => field("id_mak", event.target.value)}>
            <option value="">Pilih MAK</option>
            {maks.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.kode_mak)} — {String(row.nama_mak)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Proyek *
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_proyek} onChange={(event) => {
            const projectId = event.target.value;
            const nextProject = projects.find((row) => row.id === projectId);
            const nextParticipantIds = nextProject?.unit_terlibat?.map((participant) => participant.id) ?? [];
            setForm((state) => ({
              ...state,
              id_proyek: projectId,
              job_proyek_id: "",
              nama_job: "",
              kategori_job: "",
              nomor_job: "",
              nomor_job_reservasi_id: "",
              id_unit_koordinator: nextParticipantIds.includes(state.id_unit_koordinator)
                ? state.id_unit_koordinator
                : nextParticipantIds[0] ?? "",
              no_kontrak: String(nextProject?.no_kontrak ?? ""),
            }));
            setCollaboratorIds([]);
            setCollaboratorCandidate("");
          }}>
            <option value="">Pilih proyek</option>
            {projects.map((row) => (
              <option key={row.id} value={row.id}>
                {row.kode_proyek} — {row.nama_proyek}
              </option>
            ))}
          </select>
        </label>
        {form.id_proyek && (
          <label className="grid gap-1 text-sm sm:col-span-2">
            Job proyek *
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.job_proyek_id} onChange={(event) => field("job_proyek_id", event.target.value)}>
              <option value="">Pilih Job</option>
              {projectJobs.map((job) => (
                <option key={String(job.id)} value={String(job.id)}>
                  {String(job.nomor_job)} · {String(job.nama_job ?? "Job tanpa nama")}
                </option>
              ))}
              <option value="__new__">Buat Job baru</option>
            </select>
            {selectedJob && <span className="text-xs text-muted-foreground">{String(selectedJob.kategori_job ?? "Kategori belum diisi")}</span>}
          </label>
        )}
        {form.id_proyek && creatingJob && (
          <>
            <label className="grid gap-1 text-sm sm:col-span-2">Nama Job *<Input value={form.nama_job} onChange={(event) => field("nama_job", event.target.value)} /></label>
            <label className="grid gap-1 text-sm">Kategori Job *
              <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.kategori_job} onChange={(event) => field("kategori_job", event.target.value)}>
                <option value="">Pilih kategori</option><option value="LABORATORIUM">Laboratorium</option><option value="STUDI">Studi</option><option value="KAJIAN">Kajian</option><option value="DOMINAN_LAB">Dominan Lab</option><option value="DOMINAN_STUDI">Dominan Studi</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">Nomor Job
              <Input readOnly value={form.nomor_job || "Menyiapkan nomor..."} className="bg-muted/40 font-mono" />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Nomor Job dibuat otomatis dan tidak dapat diubah.</p>
          </>
        )}
        <label className="grid gap-1 text-sm">
          Unit koordinator *
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_unit_koordinator} onChange={(event) => field("id_unit_koordinator", event.target.value)}>
            <option value="">Pilih unit</option>
            {projectUnits.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.kode_unit)} — {String(row.nama_unit)}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">Unit baru akan ditambahkan sebagai kolaborator proyek saat RO disimpan.</span>
        </label>
        <label className="grid gap-1 text-sm">
          Rekening bank
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={form.id_rekening} onChange={(event) => field("id_rekening", event.target.value)}>
            <option value="">Tanpa rekening</option>
            {rekenings.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {String(row.nama_bank)} — {String(row.nomor_rekening)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm sm:col-span-2">
          Plafon *<Input type="number" min="1" value={form.total_plafon} onChange={(event) => field("total_plafon", event.target.value)} />
        </label>
        <div className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">Unit kolaborasi RO</span>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><FilterCombobox options={collaboratorOptions} value={collaboratorCandidate} onValueChange={setCollaboratorCandidate} label="Pilih unit kolaborasi (opsional)" /></div>
            <Button type="button" variant="outline" disabled={!collaboratorCandidate} onClick={() => { if (collaboratorCandidate) setCollaboratorIds((ids) => [...new Set([...ids, collaboratorCandidate])]); setCollaboratorCandidate(""); }}><Plus size={14} /> Tambah</Button>
          </div>
          {collaboratorIds.length ? <div className="flex flex-wrap gap-1.5">{collaboratorIds.map((unitId) => {
            const selected = projectUnits.find((item) => String(item.id) === unitId);
            return <span key={unitId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{String(selected?.nama_unit ?? "Unit")}
              <button type="button" aria-label="Hapus unit kolaborasi" className="rounded-full px-1 hover:bg-background" onClick={() => setCollaboratorIds((ids) => ids.filter((id) => id !== unitId))}>×</button>
            </span>;
          })}</div> : <span className="text-xs text-muted-foreground">Pilih jika RO ini dikerjakan bersama unit lain. Nomor Job yang sama menandai RO split.</span>}
        </div>
        {selectedProject?.no_kontrak ? (
          <p className="rounded-md bg-muted/40 p-3 text-sm sm:col-span-2">Nomor kontrak bersama · {String(selectedProject.no_kontrak)}</p>
        ) : (
          <label className="grid gap-1 text-sm">
            No kontrak
            <Input value={form.no_kontrak} onChange={(event) => field("no_kontrak", event.target.value)} />
          </label>
        )}
        <label className="grid gap-1 text-sm">
          PJ
          <Input value={form.pj} onChange={(event) => field("pj", event.target.value)} />
        </label>
        {selectedProject && (
          <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground sm:col-span-2">
            Periode kontrak proyek: {selectedProject.mulai_kontrak ? formatDate(String(selectedProject.mulai_kontrak)) : "Belum diatur"}
            {" – "}
            {selectedProject.berakhir_kontrak ? formatDate(String(selectedProject.berakhir_kontrak)) : "Belum diatur"}
          </p>
        )}
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Modal>
  );
}
