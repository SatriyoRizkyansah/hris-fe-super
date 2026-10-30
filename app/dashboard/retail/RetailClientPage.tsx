"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CircleDollarSign, Eye, FileText, LoaderCircle, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { useCurrentUser } from "@/lib/api/hooks";
import { apiErrorMessage, requestHrisApi } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
type OrderForm = {
  unit_pelaksana_id: string;
  nama_pelanggan: string;
  nomor_lhu: string;
  tanggal_permohonan: string;
  nilai_layanan: string;
  detail_perconto: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const blankOrder = (): OrderForm => ({
  unit_pelaksana_id: "",
  nama_pelanggan: "",
  nomor_lhu: "",
  tanggal_permohonan: today(),
  nilai_layanan: "",
  detail_perconto: "",
});

function listRows(value: unknown): Row[] {
  let current: any = value;
  for (let index = 0; index < 5 && current && typeof current === "object"; index += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.list)) return current.list;
    current = current.data;
  }
  return [];
}

function payload(value: unknown): Row {
  let current: any = value;
  for (let index = 0; index < 5 && current && typeof current === "object" && current.data && typeof current.data === "object"; index += 1) {
    current = current.data;
  }
  return current && typeof current === "object" ? current : {};
}

function displayDate(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("id-ID");
}

function billingStatus(job: Row): { value: string; label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  const status = String(job.invoice?.status ?? "");
  if (status === "LUNAS") return { value: "LUNAS", label: "LUNAS", tone: "ok" };
  if (status === "DITERBITKAN" || status === "SEBAGIAN_DIBAYAR") return { value: "DITERBITKAN", label: "DITERBITKAN", tone: "warn" };
  if (status === "DIBATALKAN") return { value: "DIBATALKAN", label: "DIBATALKAN", tone: "danger" };
  return { value: "DRAFT", label: "DRAFT", tone: "neutral" };
}

export default function RetailClientPage() {
  const [search, setSearch] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(blankOrder);
  const [detailJob, setDetailJob] = useState<Row | null>(null);
  const [error, setError] = useState("");

  const user = useCurrentUser();
  const role = user.data?.role?.toLowerCase() ?? "";
  const canCreateOrder = ["superadmin", "koordinator", "subkoor"].includes(role);
  const canBill = ["superadmin", "keuangan", "keu_billing"].includes(role);
  const canSettle = ["superadmin", "keuangan", "keu_bendahara"].includes(role);
  const invalidate = [apiQueryKeys.resource("retail")];

  const unitsQuery = use_query({
    tag: "retail",
    method: "retailUnits",
    params: {},
    queryFn: async () => requestHrisApi("/api/retail/units"),
  });
  const units = useMemo(() => listRows(unitsQuery.data), [unitsQuery.data]);

  const jobsQuery = use_query({
    tag: "retail",
    method: "retailJobs",
    params: { search },
    queryFn: async ({ search: query }) => requestHrisApi(`/api/retail/jobs?limit=100&page=1${query ? `&query=${encodeURIComponent(query)}` : ""}`),
  });
  const jobs = useMemo(() => listRows(jobsQuery.data), [jobsQuery.data]);

  const summaryQuery = use_query({
    tag: "retail",
    method: "retailSummary",
    params: {},
    queryFn: async () => payload(await requestHrisApi("/api/retail/summary")),
  });
  const summary = (summaryQuery.data as Row | undefined) ?? {};

  const createOrderMutation = use_mutation<unknown, Error, OrderForm>({
    tag: "retail",
    method: "createRetailOrder",
    invalidateKeys: invalidate,
    mutationFn: async (form) => requestHrisApi("/api/retail/jobs", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        nilai_layanan: Number(form.nilai_layanan),
      }),
    }),
    onSuccess: () => {
      setOrderOpen(false);
      setOrderForm(blankOrder());
      setError("");
    },
    onError: (cause) => setError(apiErrorMessage(cause)),
  });

  async function saveOrder() {
    if (!orderForm.unit_pelaksana_id || !orderForm.nama_pelanggan.trim() || !orderForm.nomor_lhu.trim() || !orderForm.tanggal_permohonan || !orderForm.nilai_layanan.trim()) {
      setError("Unit, nama klien, nomor LHU, tanggal, dan nominal layanan wajib diisi.");
      return;
    }
    const amount = Number(orderForm.nilai_layanan);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Nominal layanan harus berupa bilangan bulat lebih besar dari nol.");
      return;
    }
    try {
      setError("");
      await createOrderMutation.mutateAsync(orderForm);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }

  function issueInvoice(job: Row) {
    window.location.assign(`/dashboard/invoice?createRetail=1&retailJobId=${encodeURIComponent(String(job.id))}`);
  }

  function recordReceipt(job: Row) {
    if (!job.invoice?.id) return;
    window.location.assign(`/dashboard/invoice?settleInvoiceId=${encodeURIComponent(String(job.invoice.id))}`);
  }

  const orderColumns = [
    {
      key: "number",
      header: "NO. JOB / LHU",
      render: (row: Row) => <div><p className="font-medium">{row.nomor_job}</p><p className="text-xs text-muted-foreground">LHU · {row.nomor_lhu || "Belum dicatat"}</p></div>,
    },
    { key: "client", header: "NAMA KLIEN", render: (row: Row) => row.nama_pelanggan || "—" },
    { key: "date", header: "TANGGAL", render: (row: Row) => displayDate(row.tanggal_permohonan ?? row.created_at) },
    { key: "amount", header: "NOMINAL LAYANAN", render: (row: Row) => <span className="whitespace-nowrap tabular-nums">{formatRupiah(row.nilai_layanan)}</span> },
    {
      key: "status",
      header: "STATUS TAGIHAN",
      render: (row: Row) => {
        const status = billingStatus(row);
        return <StatusBadge status={status.tone}>{status.label}</StatusBadge>;
      },
    },
    {
      key: "actions",
      header: "AKSI",
      render: (row: Row) => {
        const status = billingStatus(row).value;
        return <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetailJob(row)}><Eye size={14} /> Detail</Button>
          {canBill && status === "DRAFT" && <Button size="sm" onClick={() => issueInvoice(row)}><FileText size={14} /> Terbitkan Invoice</Button>}
          {canSettle && status === "DITERBITKAN" && <Button size="sm" onClick={() => recordReceipt(row)}><CircleDollarSign size={14} /> Catat Penerimaan</Button>}
        </div>;
      },
    },
  ];

  return <section className="hris-page space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Layanan Retail</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Catat order pengujian sampel harian. Billing menerbitkan invoice dan Bendahara mencatat penerimaan sampai lunas.</p>
      </div>
      {canCreateOrder && <Button onClick={() => { setOrderForm(blankOrder()); setOrderOpen(true); setError(""); }}><Plus size={16} /> Buat Order Retail / Input Sampel</Button>}
    </header>

    <div className="grid gap-3 md:grid-cols-3">
      {[
        { label: "Total Tagihan (Ritel Terbit)", value: summary.tagihan_terbit, icon: FileText },
        { label: "Total Penerimaan Lunas", value: summary.penerimaan_lunas, icon: CircleDollarSign },
        { label: "Total Piutang", value: summary.piutang, icon: CircleDollarSign },
      ].map(({ label, value, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between gap-3 py-4"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatRupiah(Number(value ?? 0))}</p></div><Icon className="size-5 text-muted-foreground" /></CardContent></Card>)}
    </div>

    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Daftar Order Layanan Retail</h2><p className="text-sm text-muted-foreground">Status tagihan berubah saat Billing menerbitkan invoice dan Bendahara mencatat pembayaran.</p></div>
        </div>
        {jobsQuery.isError && <Alert variant="destructive"><AlertDescription>{apiErrorMessage(jobsQuery.error, "Gagal memuat order retail.")}</AlertDescription></Alert>}
        <DataTable
          rows={jobs}
          rowKey={(row, index) => String(row.id ?? index)}
          remoteSearch
          searchValue={search}
          searchPlaceholder="Cari nomor job, LHU, atau nama klien..."
          onSearchChange={setSearch}
          emptyMessage={jobsQuery.isLoading ? "Memuat order retail..." : "Belum ada order layanan retail."}
          columns={orderColumns}
        />
      </CardContent>
    </Card>

    <Modal
      open={orderOpen}
      onClose={() => { setOrderOpen(false); setError(""); }}
      title="Buat Order Retail / Input Sampel"
      description="Catat klien, nomor LHU, dan nilai layanan. Order yang tersimpan siap diterbitkan invoice oleh Billing."
      size="md"
      bodyClassName="space-y-4"
      footer={<><Button variant="outline" onClick={() => setOrderOpen(false)}>Batal</Button><Button disabled={createOrderMutation.isPending} onClick={saveOrder}>{createOrderMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={15} />} Simpan Order</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">Unit pelaksana *
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={orderForm.unit_pelaksana_id} onChange={(event) => setOrderForm((current) => ({ ...current, unit_pelaksana_id: event.target.value }))}>
            <option value="">Pilih unit</option>
            {units.map((unit) => <option key={String(unit.id)} value={String(unit.id)}>{unit.kode_unit} · {unit.nama_unit}</option>)}
          </select>
          {unitsQuery.isError && <span className="text-xs text-destructive">{apiErrorMessage(unitsQuery.error, "Gagal memuat unit pelaksana.")}</span>}
        </label>
        <label className="grid gap-1 text-sm">Nama klien *<Input maxLength={200} value={orderForm.nama_pelanggan} onChange={(event) => setOrderForm((current) => ({ ...current, nama_pelanggan: event.target.value }))} placeholder="Nama pelanggan atau instansi" /></label>
        <label className="grid gap-1 text-sm">Nomor LHU *<Input maxLength={100} value={orderForm.nomor_lhu} onChange={(event) => setOrderForm((current) => ({ ...current, nomor_lhu: event.target.value }))} placeholder="Nomor laporan hasil uji" /></label>
        <label className="grid gap-1 text-sm">Tanggal order *<Input type="date" value={orderForm.tanggal_permohonan} onChange={(event) => setOrderForm((current) => ({ ...current, tanggal_permohonan: event.target.value }))} /></label>
        <label className="grid gap-1 text-sm">Nominal layanan *<Input type="number" min="1" step="1" value={orderForm.nilai_layanan} onChange={(event) => setOrderForm((current) => ({ ...current, nilai_layanan: event.target.value }))} placeholder="0" /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Jenis layanan / sampel<textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={2000} value={orderForm.detail_perconto} onChange={(event) => setOrderForm((current) => ({ ...current, detail_perconto: event.target.value }))} placeholder="Keterangan singkat pengujian atau sampel (opsional)" /></label>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </Modal>

    <Modal open={Boolean(detailJob)} onClose={() => setDetailJob(null)} title="Detail Order Retail" description={detailJob ? `${detailJob.nomor_job} · ${detailJob.nama_pelanggan}` : undefined} size="md" bodyClassName="space-y-4" footer={<><Button variant="outline" onClick={() => setDetailJob(null)}>Tutup</Button>{detailJob && canBill && billingStatus(detailJob).value === "DRAFT" && <Button onClick={() => issueInvoice(detailJob)}>Terbitkan Invoice <ArrowRight size={15} /></Button>}{detailJob && canSettle && billingStatus(detailJob).value === "DITERBITKAN" && <Button onClick={() => recordReceipt(detailJob)}>Catat Penerimaan <ArrowRight size={15} /></Button>}</>}>
      {detailJob && <div className="space-y-4">
        <ModalSection title="Informasi order">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {[
              ["No. job", detailJob.nomor_job],
              ["Nama klien", detailJob.nama_pelanggan],
              ["Unit pelaksana", detailJob.unit_pelaksana?.nama_unit ?? "—"],
              ["Tanggal", displayDate(detailJob.tanggal_permohonan ?? detailJob.created_at)],
              ["Nomor LHU", detailJob.nomor_lhu ?? "—"],
              ["Jenis layanan / sampel", detailJob.detail_perconto ?? "—"],
              ["Nominal layanan", formatRupiah(detailJob.nilai_layanan)],
            ].map(([label, value]) => <div key={String(label)} className="border-b py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
          </dl>
        </ModalSection>
        <ModalSection title="Status tagihan">
          <div className="mb-3"><StatusBadge status={billingStatus(detailJob).tone}>{billingStatus(detailJob).label}</StatusBadge></div>
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {[
              ["Nomor invoice", detailJob.invoice?.nomor_invoice ?? "Belum diterbitkan"],
              ["Nilai tagihan", formatRupiah(detailJob.invoice?.nominal ?? 0)],
              ["Sudah diterima", formatRupiah(detailJob.invoice?.nominal_dibayar ?? 0)],
              ["Sisa piutang", formatRupiah(Math.max(0, Number(detailJob.invoice?.nominal ?? 0) - Number(detailJob.invoice?.nominal_dibayar ?? 0)))],
            ].map(([label, value]) => <div key={String(label)} className="border-b py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{value}</dd></div>)}
          </dl>
        </ModalSection>
      </div>}
    </Modal>
  </section>;
}
