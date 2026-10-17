"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { envelopeRows, unwrapEnvelope, apiErrorMessage, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah, humanizeStatus, projectStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { CreateProyekDto, ProyekItemDto, RoInputDto, TerminInputDto } from "@/lib/api/generated/api-generated";

type ProjectForm = {
  kode_proyek: string;
  nama_proyek: string;
  tahun_fiscal: string;
  sumber_pendanaan: string;
  nama_client: string;
  pj_1: string;
  pj_2: string;
  nilai_kontrak: string;
  total_direct_cost: string;
  total_margin: string;
};
type RoDraft = RoInputDto & { key: string; plafonText: string };
type TerminDraft = TerminInputDto & { key: string; persentaseText: string };
type LookupRow = { id: string; [key: string]: unknown };
type UnitOption = LookupRow & { kode_unit?: string; nama_unit?: string };
type AccountOption = LookupRow & { nama_rekening?: string; nama_bank?: string; nomor_rekening?: string; status_aktif?: string };
type MakOption = LookupRow & { kode_mak?: string; nama_mak?: string; tipe_akun?: string; status_aktif?: string };
const currentYear = new Date().getFullYear();
const blankForm = (): ProjectForm => ({ kode_proyek: "", nama_proyek: "", tahun_fiscal: String(currentYear), sumber_pendanaan: "", nama_client: "", pj_1: "", pj_2: "", nilai_kontrak: "", total_direct_cost: "", total_margin: "" });
const blankRo = (): RoDraft => ({ key: crypto.randomUUID(), nama_ro: "", mak_id: "", id_unit_koordinator: "", rekening_id: "", plafon: 0, plafonText: "" });
const blankTermin = (persentase = ""): TerminDraft => ({ key: crypto.randomUUID(), nomor_termin: 1, persentase: Number(persentase) || 0, persentaseText: persentase });

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

function Field({ label, value, onChange, type = "text", required = false, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export default function ProyekClientPage() {
  const [identity, setIdentity] = useState<ReturnType<typeof browserIdentity>>({ role: null, userId: "", unitKerjaId: "", token: "" });
  const canCreate = identity.role === "superadmin" || identity.role === "koordinator";
  const [search, setSearch] = useState("");
  const [tahun, setTahun] = useState("__all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(blankForm);
  const [ros, setRos] = useState<RoDraft[]>([blankRo()]);
  const [terms, setTerms] = useState<TerminDraft[]>([blankTermin("100")]);
  const [sk, setSk] = useState<File | null>(null);
  const [rab, setRab] = useState<File | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setIdentity(browserIdentity());
  }, []);

  const list = use_query({
    tag: "masterProyek",
    method: "list",
    params: { search, tahun, page, pageSize },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetData({ query: search || undefined, tahun_fiscal: tahun === "__all" ? undefined : Number(tahun), page, limit: pageSize });
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
  const unitOptions = responseRows<UnitOption>(units.data);
  const makOptions = responseRows<MakOption>(makLookup.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");
  const rekeningOptions = responseRows<AccountOption>(rekeningLookup.data).filter((row) => !row.status_aktif || row.status_aktif === "AKTIF");

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
  const roTotal = ros.reduce((total, row) => total + (Number(row.plafonText) || 0), 0);
  const termsTotal = terms.reduce((total, term) => total + (Number(term.persentaseText) || 0), 0);
  const valid = Boolean(
    form.kode_proyek &&
    form.nama_proyek &&
    form.tahun_fiscal &&
    form.nilai_kontrak !== "" &&
    form.total_direct_cost !== "" &&
    form.total_margin !== "" &&
    contractOk &&
    ros.length &&
    ros.every((row) => row.nama_ro && row.mak_id && row.id_unit_koordinator && Number(row.plafonText) > 0) &&
    roTotal === numeric("total_direct_cost") &&
    terms.length &&
    terms.every((term) => Number(term.persentaseText) > 0) &&
    termsTotal === 100,
  );

  function resetForm() {
    setForm(blankForm());
    setRos([blankRo()]);
    setTerms([blankTermin("100")]);
    setSk(null);
    setRab(null);
    setFormError("");
  }
  function updateRo(key: string, field: keyof RoDraft, value: string) {
    setRos((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }
  function updateTerm(key: string, value: string) {
    setTerms((rows) => rows.map((row) => (row.key === key ? { ...row, persentaseText: value } : row)));
  }

  async function submit() {
    if (!valid || create.isPending) {
      setFormError("Lengkapi data. Kontrak = direct cost + margin, plafon RO = direct cost, termin = 100%.");
      return;
    }
    setFormError("");
    try {
      const payload: CreateProyekDto = {
        ...form,
        tahun_fiscal: Number(form.tahun_fiscal),
        nilai_kontrak: numeric("nilai_kontrak"),
        total_direct_cost: numeric("total_direct_cost"),
        total_margin: numeric("total_margin"),
        ro_list: ros.map(({ key, plafonText, ...row }) => ({ ...row, plafon: Number(plafonText) })),
        termin_list: terms.map(({ key, persentaseText }, index) => ({ nomor_termin: index + 1, persentase: Number(persentaseText) })),
      };
      const response = await create.mutateAsync(payload);
      const project = unwrapEnvelope<ProyekItemDto>(response).data;
      if (!project?.id) throw new Error("Proyek tersimpan, tetapi ID proyek tidak diterima.");
      try {
        if (sk) await uploadHrisFile(`/api/proyek/${project.id}/sk`, sk);
        if (rab) await uploadHrisFile(`/api/proyek/${project.id}/rab`, rab);
      } catch (error) {
        setFormError(`Proyek tersimpan. ${apiErrorMessage(error, "Unggah dokumen gagal.")} Unggah ulang dari detail proyek.`);
        return;
      }
      setOpen(false);
      resetForm();
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
                  </div>
                ),
              },
              { key: "tahun", header: "Tahun", className: "w-24 whitespace-nowrap text-center tabular-nums", render: (row: ProyekItemDto) => row.tahun_fiscal },
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
                header: "RO / Total Plafon",
                className: "min-w-[11rem] whitespace-nowrap text-right tabular-nums",
                render: (row: ProyekItemDto) => (
                  <span className="text-sm">
                    {formatRupiah(row.total_plafon_ro)}
                    <span className="mt-1 block text-xs text-muted-foreground">{row.jumlah_ro ?? 0} RO</span>
                  </span>
                ),
              },
              { key: "status", header: "Status", className: "min-w-[9rem] whitespace-nowrap", render: (row: ProyekItemDto) => <StatusBadge status={projectStatusTone(row.status_proyek)}>{humanizeStatus(row.status_proyek)}</StatusBadge> },
              {
                key: "aksi",
                header: "Aksi",
                className: "w-28 whitespace-nowrap text-right",
                render: (row: ProyekItemDto) => (
                  <Button variant="ghost" size="sm" render={<Link href={`/dashboard/proyek/${row.id}`} />}>
                    <Eye size={15} /> Detail
                  </Button>
                ),
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
            filters={[{ field: "tahun", label: "Tahun Fiscal", options: [{ label: "Semua Tahun", value: "__all" }, ...years.map((value) => ({ label: value, value }))] }]}
            filterValues={{ tahun }}
            onFilterChange={(_, value) => {
              setTahun(value);
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
            <Button disabled={create.isPending} onClick={submit}>
              {create.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan Pengajuan
            </Button>
          </>
        }
      >
        <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">RO awal dan rencana termin wajib seimbang sebelum proyek dikirim.</div>
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-semibold">Informasi proyek</h2>
            <p className="mt-1 text-xs text-muted-foreground">Identitas dan penanggung jawab proyek.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode proyek" required value={form.kode_proyek} onChange={(value) => setForm((current) => ({ ...current, kode_proyek: value }))} />
            <Field label="Tahun fiscal" type="number" required value={form.tahun_fiscal} onChange={(value) => setForm((current) => ({ ...current, tahun_fiscal: value }))} />
            <div className="sm:col-span-2">
              <Field label="Nama proyek" required value={form.nama_proyek} onChange={(value) => setForm((current) => ({ ...current, nama_proyek: value }))} />
            </div>
            <Field label="Sumber pendanaan" value={form.sumber_pendanaan} onChange={(value) => setForm((current) => ({ ...current, sumber_pendanaan: value }))} />
            <Field label="Nama client" value={form.nama_client} onChange={(value) => setForm((current) => ({ ...current, nama_client: value }))} />
            <Field label="PJ 1" value={form.pj_1} onChange={(value) => setForm((current) => ({ ...current, pj_1: value }))} />
            <Field label="PJ 2" value={form.pj_2} onChange={(value) => setForm((current) => ({ ...current, pj_2: value }))} />
          </div>
        </section>
        <section className="space-y-4 rounded-lg border p-4">
          <div>
            <h2 className="text-sm font-semibold">Nilai proyek</h2>
            <p className="mt-1 text-xs text-muted-foreground">Pastikan nilai kontrak sama dengan direct cost dan margin.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Nilai kontrak" type="number" required value={form.nilai_kontrak} onChange={(value) => setForm((current) => ({ ...current, nilai_kontrak: value }))} />
            <Field label="Total direct cost" type="number" required value={form.total_direct_cost} onChange={(value) => setForm((current) => ({ ...current, total_direct_cost: value }))} />
            <Field label="Total margin" type="number" required value={form.total_margin} onChange={(value) => setForm((current) => ({ ...current, total_margin: value }))} />
          </div>
          <p className={`rounded-md px-3 py-2 text-xs ${contractOk ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"}`}>
            Kontrak {formatRupiah(numeric("nilai_kontrak"))} = direct cost {formatRupiah(numeric("total_direct_cost"))} + margin {formatRupiah(numeric("total_margin"))}
          </p>
        </section>
        <section className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Alokasi RO awal</h2>
              <p className="mt-1 text-xs text-muted-foreground">Pilih MAK, unit koordinator, dan rekening dari data master.</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setRos((rows) => [...rows, blankRo()])}>
              <Plus size={14} /> Tambah RO
            </Button>
          </div>
          {ros.map((row, index) => (
            <div key={row.key} className="space-y-4 rounded-md bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">RO {String(index + 1).padStart(2, "0")}</p>
                {ros.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setRos((rows) => rows.filter((item) => item.key !== row.key))}>
                    <Trash2 size={14} /> Hapus
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nama RO" required value={row.nama_ro} onChange={(value) => updateRo(row.key, "nama_ro", value)} />
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>MAK *</span>
                  <select value={row.mak_id} onChange={(event) => updateRo(row.key, "mak_id", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal">
                    <option value="">Pilih MAK…</option>
                    {makOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {[option.kode_mak, option.nama_mak, option.tipe_akun ? `(${option.tipe_akun})` : ""].filter(Boolean).join(" — ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Unit koordinator *</span>
                  <select value={row.id_unit_koordinator} onChange={(event) => updateRo(row.key, "id_unit_koordinator", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal">
                    <option value="">Pilih unit koordinator…</option>
                    {unitOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {[option.kode_unit, option.nama_unit].filter(Boolean).join(" — ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span>Rekening tujuan</span>
                  <select value={row.rekening_id ?? ""} onChange={(event) => updateRo(row.key, "rekening_id", event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-normal">
                    <option value="">Pilih rekening (opsional)…</option>
                    {rekeningOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {[option.nama_bank, option.nama_rekening, option.nomor_rekening ? `(${option.nomor_rekening})` : ""].filter(Boolean).join(" — ")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="sm:col-span-2">
                  <Field label="Plafon" type="number" required value={row.plafonText} onChange={(value) => updateRo(row.key, "plafonText", value)} />
                </div>
              </div>
            </div>
          ))}
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
