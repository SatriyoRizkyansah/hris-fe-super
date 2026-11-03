"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CircleDollarSign,
  Eye,
  FileUp,
  FileText,
  LoaderCircle,
  PackageCheck,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Modal } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { EmptyData } from "@/components/loading/EmptyData";
import { StatusBadge } from "@/components/common/StatusBadge";
import { WorkflowDiagram, type WorkflowAction, type WorkflowStage } from "@/components/common/WorkflowDiagram";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { useCurrentUser } from "@/lib/api/hooks";
import { apiErrorMessage, requestHrisApi } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
type SampleItemForm = {
  nama_layanan: string;
  jumlah: string;
  satuan: string;
  id_sampel: string;
  catatan: string;
};
type OrderForm = {
  unit_pelaksana_id: string;
  nama_pelanggan: string;
  nomor_tanda_terima_perconto: string;
  tanggal_permohonan: string;
  tanggal_perconto_diterima: string;
  nilai_layanan: string;
  detail_perconto: string;
  rincian_layanan: SampleItemForm[];
};

const retailWorkflowStages: WorkflowStage[] = [
  { title: "Terima sampel", owner: "SUBKOOR / PILT", icon: PackageCheck, color: "sky", summary: "Catat klien, tanda terima, dan rincian sampel yang diuji.", result: "PENGUJIAN", next: "Order tercatat saat sampel diterima dan proses pengujian dimulai." },
  { title: "Input LHU", owner: "SUBKOOR / PILT", icon: FileUp, color: "violet", summary: "Lengkapi nomor dan dokumen LHU setelah pengujian selesai.", result: "SIAP_DITAGIH", next: "Setelah LHU disimpan, order masuk antrean Billing untuk dibuatkan invoice." },
  { title: "Terbitkan invoice", owner: "KEU_BILLING", icon: FileText, color: "amber", summary: "Terbitkan tagihan kepada klien berdasarkan nilai layanan.", result: "INVOICE_DITERBITKAN", next: "Invoice menjadi piutang sampai penerimaan pembayaran dicatat Bendahara." },
  { title: "Catat penerimaan", owner: "KEU_BENDAHARA", icon: CircleDollarSign, color: "indigo", summary: "Cocokkan mutasi bank dan catat pembayaran, termasuk pembayaran bertahap.", result: "LUNAS", next: "Pembayaran dapat dicatat bertahap; LHU dapat diserahterimakan setelah invoice lunas." },
  { title: "Serah terima LHU", owner: "SUBKOOR / PILT", icon: Printer, color: "emerald", summary: "Unggah bukti serah terima dan catat penerima dokumen LHU.", result: "SELESAI", next: "Akses serah terima terbuka setelah pembayaran lunas dan order dapat ditandai selesai." },
];

const blankSampleItem = (): SampleItemForm => ({
  nama_layanan: "",
  jumlah: "1",
  satuan: "SAMPEL",
  id_sampel: "",
  catatan: "",
});

const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const blankOrder = (): OrderForm => ({
  unit_pelaksana_id: "",
  nama_pelanggan: "",
  nomor_tanda_terima_perconto: "",
  tanggal_permohonan: today(),
  tanggal_perconto_diterima: today(),
  nilai_layanan: "",
  detail_perconto: "",
  rincian_layanan: [blankSampleItem()],
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
  if (status === "LUNAS") return { value: "LUNAS", label: "Lunas", tone: "ok" };
  if (status === "DITERBITKAN" || status === "SEBAGIAN_DIBAYAR") return { value: "DITERBITKAN", label: status === "SEBAGIAN_DIBAYAR" ? "Dibayar sebagian" : "Ditagihkan", tone: "warn" };
  if (status === "DIBATALKAN") return { value: "DIBATALKAN", label: "Dibatalkan", tone: "danger" };
  return { value: "DRAFT", label: "Belum ditagihkan", tone: "neutral" };
}

function serviceStatus(job: Row) {
  const status = String(job.status ?? "");
  const labels: Record<string, string> = {
    PERMOHONAN_DITERIMA: "Permohonan diterima",
    PERCONTO_DITERIMA: "Perconto diterima",
    PENGUJIAN: "Dalam pengujian",
    LHU_TERBIT: "LHU terbit",
    SIAP_DITAGIH: "Siap ditagih",
    INVOICE_DITERBITKAN: "Invoice diterbitkan",
    LUNAS: "Lunas",
    SELESAI: "Selesai",
    DIBATALKAN: "Dibatalkan",
  };
  return labels[status] ?? (status.replaceAll("_", " ") || "—");
}

export default function RetailClientPage() {
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("__all");
  const [billingFilter, setBillingFilter] = useState("__all");
  const [unitFilter, setUnitFilter] = useState("__all");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("__all");
  const [orderOpen, setOrderOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<OrderForm>(blankOrder);
  const [error, setError] = useState("");

  const user = useCurrentUser();
  const canViewRetail = user.data?.canViewRetail === true;
  const canCreateOrder = user.data?.canManageRetail === true;
  const invalidate = [apiQueryKeys.resource("retail")];

  const unitsQuery = use_query({
    tag: "retail",
    method: "retailUnits",
    params: {},
    enabled: canViewRetail,
    queryFn: async () => requestHrisApi("/api/retail/units"),
  });
  const units = useMemo(() => listRows(unitsQuery.data), [unitsQuery.data]);
  const unitOptions = useMemo(() => units.map((unit) => ({
    value: String(unit.id),
    label: [unit.kode_unit, unit.nama_unit].filter(Boolean).join(" · "),
  })), [units]);

  const jobsQuery = use_query({
    tag: "retail",
    method: "retailJobs",
    params: { search, serviceFilter, billingFilter, unitFilter, fiscalYearFilter },
    enabled: canViewRetail,
    queryFn: async ({ search: query, serviceFilter: serviceStatus, billingFilter: invoiceStatus, unitFilter: unitId, fiscalYearFilter: year }) => {
      const params = new URLSearchParams({ limit: "100", page: "1" });
      if (query) params.set("query", query);
      if (serviceStatus !== "__all") params.set("status", serviceStatus);
      if (invoiceStatus !== "__all") params.set("status_invoice", invoiceStatus);
      if (unitId !== "__all") params.set("unit_pelaksana_id", unitId);
      if (year !== "__all") params.set("tahun_fiscal", year);
      return requestHrisApi(`/api/retail/jobs?${params.toString()}`);
    },
  });
  const jobs = useMemo(() => listRows(jobsQuery.data), [jobsQuery.data]);
  const serviceFilterOptions = [
    { value: "PERMOHONAN_DITERIMA", label: "Permohonan diterima" },
    { value: "PERCONTO_DITERIMA", label: "Perconto diterima" },
    { value: "PENGUJIAN", label: "Dalam pengujian" },
    { value: "LHU_TERBIT", label: "LHU terbit" },
    { value: "SIAP_DITAGIH", label: "Siap ditagih" },
    { value: "INVOICE_DITERBITKAN", label: "Invoice diterbitkan" },
    { value: "LUNAS", label: "Lunas" },
    { value: "SELESAI", label: "Selesai" },
    { value: "DIBATALKAN", label: "Dibatalkan" },
  ];
  const billingFilterOptions = [
    { value: "DRAFT", label: "Belum ditagihkan" },
    { value: "DITERBITKAN", label: "Ditagihkan / dibayar sebagian" },
    { value: "LUNAS", label: "Lunas" },
    { value: "DIBATALKAN", label: "Invoice dibatalkan" },
  ];
  const fiscalYearOptions = useMemo(() => {
    const years = new Set(jobs.map((job) => Number(job.tahun_fiscal)).filter((year) => year > 0));
    years.add(new Date().getFullYear());
    if (fiscalYearFilter !== "__all") years.add(Number(fiscalYearFilter));
    return [...years].sort((a, b) => b - a).map((year) => ({ value: String(year), label: `TA ${year}` }));
  }, [jobs, fiscalYearFilter]);

  const summaryQuery = use_query({
    tag: "retail",
    method: "retailSummary",
    params: {},
    enabled: canViewRetail,
    queryFn: async () => payload(await requestHrisApi("/api/retail/summary")),
  });
  const summary = (summaryQuery.data as Row | undefined) ?? {};

  function showRetailQueue(serviceStatus = "__all", invoiceStatus = "__all") {
    setSearch("");
    setServiceFilter(serviceStatus);
    setBillingFilter(invoiceStatus);
    setUnitFilter("__all");
    setFiscalYearFilter("__all");
    window.requestAnimationFrame(() => document.getElementById("retail-order-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const workflowActions: WorkflowAction[] = [
    {
      label: canCreateOrder ? "Input Sampel" : "Lihat order",
      onClick: () => {
        if (!canCreateOrder) return showRetailQueue();
        setOrderForm(blankOrder());
        setOrderOpen(true);
        setError("");
      },
    },
    { label: "Lihat order diuji", onClick: () => showRetailQueue("PENGUJIAN") },
    { label: "Lihat siap ditagih", onClick: () => showRetailQueue("SIAP_DITAGIH") },
    { label: "Lihat tagihan", onClick: () => showRetailQueue("INVOICE_DITERBITKAN", "DITERBITKAN") },
    { label: "Lihat tagihan lunas", onClick: () => showRetailQueue("__all", "LUNAS") },
  ];

  const createOrderMutation = use_mutation<unknown, Error, OrderForm>({
    tag: "retail",
    method: "createRetailOrder",
    invalidateKeys: invalidate,
    mutationFn: async (form) => requestHrisApi("/api/retail/jobs", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        nilai_layanan: Number(form.nilai_layanan),
        rincian_layanan: form.rincian_layanan.map((item) => ({
          ...item,
          nama_layanan: item.nama_layanan.trim(),
          jumlah: Number(item.jumlah),
          satuan: item.satuan.trim(),
          id_sampel: item.id_sampel.trim() || undefined,
          catatan: item.catatan.trim() || undefined,
        })),
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
    if (!orderForm.unit_pelaksana_id || !orderForm.nama_pelanggan.trim() || !orderForm.nomor_tanda_terima_perconto.trim() || !orderForm.tanggal_perconto_diterima || !orderForm.nilai_layanan.trim()) {
      setError("Unit, nama klien, nomor dan tanggal tanda terima perconto, serta nominal layanan wajib diisi.");
      return;
    }
    const amount = Number(orderForm.nilai_layanan);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError("Nominal layanan harus berupa bilangan bulat lebih besar dari nol.");
      return;
    }
    if (!orderForm.rincian_layanan.length || orderForm.rincian_layanan.some((item) =>
      !item.nama_layanan.trim() || !item.satuan.trim() || !Number.isSafeInteger(Number(item.jumlah)) || Number(item.jumlah) < 1
    )) {
      setError("Isi nama sampel/layanan, jumlah, dan satuan untuk setiap rincian.");
      return;
    }
    try {
      setError("");
      await createOrderMutation.mutateAsync(orderForm);
    } catch (cause) {
      setError(apiErrorMessage(cause));
    }
  }

  const orderColumns = [
    {
      key: "job",
      header: "JOB / KLIEN",
      className: "min-w-[15rem]",
      render: (row: Row) => <div><p className="font-semibold">{row.nomor_job}</p><p className="mt-1 text-sm">{row.nama_pelanggan}</p><p className="mt-0.5 text-xs text-muted-foreground">LHU · {row.nomor_lhu || "Belum dicatat"}</p></div>,
    },
    { key: "date", header: "TANGGAL TERIMA", className: "min-w-[8rem] whitespace-nowrap", render: (row: Row) => displayDate(row.tanggal_perconto_diterima ?? row.tanggal_permohonan ?? row.created_at) },
    { key: "amount", header: "NILAI LAYANAN", className: "min-w-[10rem] whitespace-nowrap", render: (row: Row) => <div><p className="font-semibold tabular-nums">{formatRupiah(row.nilai_layanan)}</p><p className="mt-1 text-xs text-muted-foreground">{serviceStatus(row)}</p></div> },
    {
      key: "status",
      header: "STATUS TAGIHAN",
      className: "min-w-[10rem]",
      render: (row: Row) => {
        const status = billingStatus(row);
        return <StatusBadge status={status.tone}>{status.label}</StatusBadge>;
      },
    },
    {
      key: "actions",
      header: "AKSI",
      className: "min-w-[8rem]",
      render: (row: Row) => <Button size="sm" variant="outline" render={<Link href={`/dashboard/retail/${row.id}`} />}><Eye size={14} /> Lihat detail</Button>,
    },
  ];

  if (user.isLoading) return <div className="p-6 text-sm text-muted-foreground">Memeriksa akses...</div>;
  if (!canViewRetail) return <Alert variant="destructive" className="m-6"><AlertDescription>Akses Proyek Retail hanya tersedia untuk Superadmin, role Keuangan, Koordinator Umum, dan operator retail yang ditetapkan.</AlertDescription></Alert>;

  return <section className="hris-page space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 !p-6 sm:!p-7">
      <div>
        <h1 className="text-2xl font-bold">Layanan Retail</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">Kelola order pengujian sampel dari tanda terima sampai invoice lunas dan LHU diserahkan.</p>
      </div>
      {canCreateOrder && <Button onClick={() => { setOrderForm(blankOrder()); setOrderOpen(true); setError(""); }}><Plus size={16} /> Input Sampel</Button>}
    </header>

    <WorkflowDiagram
      title="Alur Layanan Retail"
      description="Pilih tahap untuk melihat status dan penanggung jawab, atau gunakan tombol untuk membuka order yang perlu diproses."
      stages={retailWorkflowStages}
      actions={workflowActions}
      footerNote="Belanja bahan bersifat opsional: ajukan dari detail order saat pengujian; KARWAS meninjau dan mencadangkan OPS_KANTOR, lalu Bendahara mencatat pembayarannya."
    />

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Tagihan terbit", value: summary.tagihan_terbit, icon: FileText, accent: "bg-sky-50 text-sky-700" },
        { label: "Penerimaan tercatat", value: summary.penerimaan_lunas, icon: CircleDollarSign, accent: "bg-emerald-50 text-emerald-700" },
        { label: "Piutang berjalan", value: summary.piutang, icon: CircleDollarSign, accent: "bg-amber-50 text-amber-700" },
      ].map(({ label, value, icon: Icon, accent }) => <Card key={label}><CardContent className="flex min-h-[108px] items-center justify-between gap-4 !p-5 sm:!p-6"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums">{formatRupiah(Number(value ?? 0))}</p></div><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon size={19} /></span></CardContent></Card>)}
    </div>

    <Card id="retail-order-list" className="scroll-mt-6">
      <CardContent className="!space-y-4 !p-5 sm:!p-6">
        <div><h2 className="font-semibold">Daftar Order Layanan Retail</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Buka detail order untuk melihat progres, mencatat LHU, dan mengajukan belanja bahan bila diperlukan.</p></div>
        {jobsQuery.isError ? <EmptyData label="Daftar order retail belum dapat dimuat." action={<Button type="button" variant="outline" size="sm" onClick={() => void jobsQuery.refetch()}>Coba lagi</Button>} /> : <DataTable
          rows={jobs}
          rowKey={(row, index) => String(row.id ?? index)}
          remoteSearch
          searchValue={search}
          searchPlaceholder="Cari nomor job, LHU, atau nama klien..."
          onSearchChange={setSearch}
          filters={[
            { field: "status", label: "Progres layanan", options: serviceFilterOptions },
            { field: "status_invoice", label: "Status tagihan", options: billingFilterOptions },
            { field: "unit_pelaksana_id", label: "Unit pelaksana", options: unitOptions },
            { field: "tahun_fiscal", label: "Tahun fiskal", options: fiscalYearOptions },
          ]}
          filterValues={{ status: serviceFilter, status_invoice: billingFilter, unit_pelaksana_id: unitFilter, tahun_fiscal: fiscalYearFilter }}
          onFilterChange={(field, value) => {
            if (field === "status") setServiceFilter(value);
            if (field === "status_invoice") setBillingFilter(value);
            if (field === "unit_pelaksana_id") setUnitFilter(value);
            if (field === "tahun_fiscal") setFiscalYearFilter(value);
          }}
          emptyMessage={jobsQuery.isLoading ? "Memuat order retail..." : "Belum ada order layanan retail."}
          columns={orderColumns}
        />}
      </CardContent>
    </Card>

    <Modal
      open={orderOpen}
      onClose={() => { setOrderOpen(false); setError(""); }}
      title="Input Order Sampel"
      description="Catat informasi tanda terima dan setiap sampel sesuai dokumen. Nomor LHU dimasukkan setelah pengujian selesai."
      size="xl"
      bodyClassName="space-y-5"
      footer={<><Button variant="outline" onClick={() => setOrderOpen(false)}>Batal</Button><Button disabled={createOrderMutation.isPending} onClick={saveOrder}>{createOrderMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={15} />} Simpan Order</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Unit pelaksana *
          <FilterCombobox
            options={unitOptions}
            value={orderForm.unit_pelaksana_id}
            onValueChange={(value) => setOrderForm((current) => ({ ...current, unit_pelaksana_id: value }))}
            label="Pilih unit pelaksana"
          />
          {unitsQuery.isError && <EmptyData className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden" label="Daftar unit pelaksana belum dapat dimuat." action={<Button type="button" variant="outline" size="sm" onClick={() => void unitsQuery.refetch()}>Coba lagi</Button>} />}
        </label>
        <label className="grid gap-1 text-sm">Nama klien *<Input maxLength={200} value={orderForm.nama_pelanggan} onChange={(event) => setOrderForm((current) => ({ ...current, nama_pelanggan: event.target.value }))} placeholder="Nama pelanggan atau instansi" /></label>
        <label className="grid gap-1 text-sm">Nomor tanda terima perconto *<Input maxLength={100} value={orderForm.nomor_tanda_terima_perconto} onChange={(event) => setOrderForm((current) => ({ ...current, nomor_tanda_terima_perconto: event.target.value }))} placeholder="Nomor tanda terima sampel" /></label>
        <label className="grid gap-1 text-sm">Tanggal perconto diterima *<Input type="date" value={orderForm.tanggal_perconto_diterima} onChange={(event) => setOrderForm((current) => ({ ...current, tanggal_perconto_diterima: event.target.value, tanggal_permohonan: event.target.value }))} /></label>
        <label className="grid gap-1 text-sm">Nominal layanan total *<MoneyInput value={orderForm.nilai_layanan} onValueChange={(value) => setOrderForm((current) => ({ ...current, nilai_layanan: value }))} placeholder="Nilai total tagihan layanan" /></label>
      </div>
      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold">Rincian sampel / pengujian</h3><p className="mt-1 text-xs text-muted-foreground">Isi setiap baris sesuai kolom pada tanda terima perconto.</p></div>
          <Button type="button" variant="outline" size="sm" onClick={() => setOrderForm((current) => ({ ...current, rincian_layanan: [...current.rincian_layanan, blankSampleItem()] }))}><Plus size={14} /> Tambah sampel</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead><tr className="border-b bg-muted/40 text-xs text-muted-foreground"><th className="w-10 p-2.5">No.</th><th className="min-w-48 p-2.5">Nama *</th><th className="w-24 p-2.5">Jumlah *</th><th className="w-32 p-2.5">Satuan *</th><th className="w-36 p-2.5">ID sampel</th><th className="min-w-64 p-2.5">Keterangan / analisa</th><th className="w-12 p-2.5"><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>{orderForm.rincian_layanan.map((item, index) => <tr key={index} className="border-b last:border-0 align-top">
              <td className="p-2.5 pt-5 text-muted-foreground">{index + 1}</td>
              <td className="p-2.5"><Input maxLength={200} value={item.nama_layanan} onChange={(event) => setOrderForm((current) => ({ ...current, rincian_layanan: current.rincian_layanan.map((row, rowIndex) => rowIndex === index ? { ...row, nama_layanan: event.target.value } : row) }))} placeholder="Nama sampel / layanan" /></td>
              <td className="p-2.5"><Input type="number" min="1" step="1" value={item.jumlah} onChange={(event) => setOrderForm((current) => ({ ...current, rincian_layanan: current.rincian_layanan.map((row, rowIndex) => rowIndex === index ? { ...row, jumlah: event.target.value } : row) }))} /></td>
              <td className="p-2.5"><Input maxLength={40} value={item.satuan} onChange={(event) => setOrderForm((current) => ({ ...current, rincian_layanan: current.rincian_layanan.map((row, rowIndex) => rowIndex === index ? { ...row, satuan: event.target.value } : row) }))} placeholder="SAMPEL" /></td>
              <td className="p-2.5"><Input maxLength={100} value={item.id_sampel} onChange={(event) => setOrderForm((current) => ({ ...current, rincian_layanan: current.rincian_layanan.map((row, rowIndex) => rowIndex === index ? { ...row, id_sampel: event.target.value } : row) }))} placeholder="ID pada dokumen" /></td>
              <td className="p-2.5"><textarea className="min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={2000} value={item.catatan} onChange={(event) => setOrderForm((current) => ({ ...current, rincian_layanan: current.rincian_layanan.map((row, rowIndex) => rowIndex === index ? { ...row, catatan: event.target.value } : row) }))} placeholder="Parameter / analisa / keterangan sampel" /></td>
              <td className="p-2.5 pt-4"><Button type="button" variant="ghost" size="icon" aria-label={`Hapus sampel ${index + 1}`} disabled={orderForm.rincian_layanan.length <= 1} onClick={() => setOrderForm((current) => ({ ...current, rincian_layanan: current.rincian_layanan.filter((_, rowIndex) => rowIndex !== index) }))}><Trash2 size={15} /></Button></td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <label className="grid gap-1 text-sm">Catatan umum order<textarea className="min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={2000} value={orderForm.detail_perconto} onChange={(event) => setOrderForm((current) => ({ ...current, detail_perconto: event.target.value }))} placeholder="Catatan tambahan di luar rincian sampel" /></label>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </Modal>

  </section>;
}
