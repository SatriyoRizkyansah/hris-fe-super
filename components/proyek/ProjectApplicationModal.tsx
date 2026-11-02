"use client";

import type { Dispatch, SetStateAction } from "react";
import { LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/modal/Modal";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { formatRupiah } from "@/lib/hris/format";
import type { JobDraft, ProjectForm, RoDraft, TerminDraft } from "@/components/proyek/project-form.types";

type Option = { value: string; label: string };
type MoneyKey = "nilai_kontrak" | "total_direct_cost" | "total_margin";
type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  resetForm: () => void;
  form: ProjectForm;
  setForm: Dispatch<SetStateAction<ProjectForm>>;
  projectSkRequired: boolean;
  editingDraftId: string | null;
  identity: { role: string | null };
  currentUnit?: { kode_unit?: string; nama_unit?: string };
  unitComboboxOptions: Option[];
  unitPengusulId: string;
  changeLeadUnit: (unitId: string) => void;
  availableCollaboratorOptions: Option[];
  addCollaborator: (unitId: string) => void;
  unitKolaborasiIds: string[];
  assignedRoUnitIds: Set<string>;
  normalizeUnitId: (value: unknown) => string;
  removeCollaborator: (unitId: string) => void;
  numeric: (key: MoneyKey) => number;
  contractOk: boolean;
  jobs: JobDraft[];
  addJob: () => void;
  removeJob: (jobKey: string) => void;
  updateJob: (jobKey: string, value: string) => void;
  updateRo: (roKey: string, field: keyof RoDraft, value: string) => void;
  addRo: (jobKey: string) => void;
  removeRo: (roKey: string) => void;
  addRoCollaborator: (roKey: string, unitId: string) => void;
  removeRoCollaborator: (roKey: string, unitId: string) => void;
  roUnitComboboxOptions: Option[];
  makComboboxOptions: Option[];
  rekeningComboboxOptions: Option[];
  roTotal: number;
  terms: TerminDraft[];
  setTerms: Dispatch<SetStateAction<TerminDraft[]>>;
  addTerm: () => void;
  updateTerm: (termKey: string, value: string) => void;
  termsTotal: number;
  sk: File | null;
  setSk: (file: File | null) => void;
  rab: File | null;
  setRab: (file: File | null) => void;
  formError: string;
  saveDraft: () => void;
  submit: () => void;
  submitting: boolean;
};

function MoneyField({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}{required ? " *" : ""}</span>
      <MoneyInput aria-label={label} value={value} onValueChange={onChange} />
    </label>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}{required ? " *" : ""}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function ProjectApplicationModal(props: Props) {
  const {
    open, setOpen, resetForm, form, setForm, projectSkRequired, editingDraftId,
    identity, currentUnit, unitComboboxOptions, unitPengusulId, changeLeadUnit,
    availableCollaboratorOptions, addCollaborator, unitKolaborasiIds, assignedRoUnitIds,
    normalizeUnitId, removeCollaborator, numeric, contractOk, jobs, addJob, removeJob,
    updateJob, updateRo, addRo, removeRo, addRoCollaborator, removeRoCollaborator,
    roUnitComboboxOptions, makComboboxOptions, rekeningComboboxOptions, roTotal, terms,
    setTerms, addTerm, updateTerm, termsTotal, sk, setSk, rab, setRab, formError, saveDraft,
    submit, submitting,
  } = props;
  return (
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
            <Button disabled={submitting} onClick={submit}>
              {submitting && <LoaderCircle className="animate-spin" size={16} />} Simpan Pengajuan
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
            <Button type="button" size="sm" variant="outline" onClick={addTerm}>
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
  );
}
