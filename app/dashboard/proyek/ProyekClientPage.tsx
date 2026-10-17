"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
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
const currentYear = new Date().getFullYear();
const blankForm = (): ProjectForm => ({ kode_proyek: "", nama_proyek: "", tahun_fiscal: String(currentYear), sumber_pendanaan: "", nama_client: "", pj_1: "", pj_2: "", nilai_kontrak: "", total_direct_cost: "", total_margin: "" });
const blankRo = (): RoDraft => ({ key: crypto.randomUUID(), nama_ro: "", mak_id: "", id_unit_koordinator: "", rekening_id: "", plafon: 0, plafonText: "" });
const blankTermin = (persentase = ""): TerminDraft => ({ key: crypto.randomUUID(), nomor_termin: 1, persentase: Number(persentase) || 0, persentaseText: persentase });

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
  const identity = useMemo(browserIdentity, []);
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
                render: (row: ProyekItemDto) => (
                  <div>
                    <p className="font-medium">{row.kode_proyek}</p>
                    <p className="text-xs text-muted-foreground">{row.nama_proyek}</p>
                  </div>
                ),
              },
              { key: "tahun", header: "Tahun", render: (row: ProyekItemDto) => row.tahun_fiscal },
              {
                key: "pengaju",
                header: "Pengaju",
                render: (row: ProyekItemDto) => (
                  <div className="text-sm">
                    {String(row.nama_pengaju ?? "—")}
                    <p className="text-xs text-muted-foreground">{String(row.nama_unit_pengaju ?? "")}</p>
                  </div>
                ),
              },
              { key: "kontrak", header: "Nilai Kontrak", className: "text-right", render: (row: ProyekItemDto) => <span className="whitespace-nowrap">{formatRupiah(row.nilai_kontrak)}</span> },
              {
                key: "ro",
                header: "RO",
                render: (row: ProyekItemDto) => (
                  <span>
                    {row.jumlah_ro ?? 0} · {formatRupiah(row.total_plafon_ro)}
                  </span>
                ),
              },
              { key: "status", header: "Status", render: (row: ProyekItemDto) => <StatusBadge status={projectStatusTone(row.status_proyek)}>{humanizeStatus(row.status_proyek)}</StatusBadge> },
              {
                key: "aksi",
                header: "Aksi",
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
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajukan Proyek</DialogTitle>
            <DialogDescription>RO awal dan termin wajib seimbang sebelum proyek dikirim.</DialogDescription>
          </DialogHeader>
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
            <Field label="Nilai kontrak" type="number" required value={form.nilai_kontrak} onChange={(value) => setForm((current) => ({ ...current, nilai_kontrak: value }))} />
            <Field label="Total direct cost" type="number" required value={form.total_direct_cost} onChange={(value) => setForm((current) => ({ ...current, total_direct_cost: value }))} />
            <Field label="Total margin" type="number" required value={form.total_margin} onChange={(value) => setForm((current) => ({ ...current, total_margin: value }))} />
          </div>
          <p className={contractOk ? "text-sm text-emerald-700" : "text-sm text-destructive"}>
            Kontrak {formatRupiah(numeric("nilai_kontrak"))} = direct cost {formatRupiah(numeric("total_direct_cost"))} + margin {formatRupiah(numeric("total_margin"))}
          </p>
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Alokasi RO awal</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => setRos((rows) => [...rows, blankRo()])}>
                <Plus size={14} /> Tambah RO
              </Button>
            </div>
            {ros.map((row, index) => (
              <div key={row.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
                <Field label={`Nama RO ${index + 1}`} required value={row.nama_ro} onChange={(value) => updateRo(row.key, "nama_ro", value)} />
                <Field label="ID MAK" required value={row.mak_id} onChange={(value) => updateRo(row.key, "mak_id", value)} />
                <Field label="ID Unit Koordinator" required value={row.id_unit_koordinator} onChange={(value) => updateRo(row.key, "id_unit_koordinator", value)} />
                <Field label="ID Rekening" value={row.rekening_id ?? ""} onChange={(value) => updateRo(row.key, "rekening_id", value)} />
                <Field label="Plafon" type="number" required value={row.plafonText} onChange={(value) => updateRo(row.key, "plafonText", value)} />
                {ros.length > 1 && (
                  <Button type="button" variant="destructive" size="sm" className="self-end" onClick={() => setRos((rows) => rows.filter((item) => item.key !== row.key))}>
                    <Trash2 size={14} /> Hapus
                  </Button>
                )}
              </div>
            ))}
            <p className={roTotal === numeric("total_direct_cost") ? "text-sm text-emerald-700" : "text-sm text-destructive"}>Total plafon RO: {formatRupiah(roTotal)}. Harus sama dengan direct cost.</p>
          </section>
          <section className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Rencana termin</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => setTerms((rows) => [...rows, blankTermin()])}>
                <Plus size={14} /> Tambah Termin
              </Button>
            </div>
            {terms.map((term, index) => (
              <div key={term.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label={`Termin ${index + 1} (%)`} type="number" required value={term.persentaseText} onChange={(value) => updateTerm(term.key, value)} />
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
          <section className="grid gap-3 border-t pt-4 sm:grid-cols-2">
            <DocumentUploadField label="SK Proyek" accept=".pdf" value={sk} onChange={setSk} />
            <DocumentUploadField label="RAB Proyek" accept=".pdf,.xls,.xlsx" value={rab} onChange={setRab} />
          </section>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={create.isPending} onClick={submit}>
              {create.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan Pengajuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
