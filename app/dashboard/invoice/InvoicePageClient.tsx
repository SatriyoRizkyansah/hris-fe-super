"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Eye, FilePlus2, LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { MoneyFlow } from "@/components/common/MoneyFlow";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/table";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { BayarInvoiceDto, CreateInvoiceDto, CreateMutasiBankDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type InvoiceForm = { termin_id: string; retail_job_id: string; nomor_invoice: string; tanggal_jatuh_tempo: string };
type ReceiptForm = { rekening_id: string; tanggal_transaksi: string; nominal: string; referensi_bank: string; nama_pengirim: string; keterangan: string };
const today = () => new Date().toISOString().slice(0, 10);
const blankInvoice = (): InvoiceForm => ({ termin_id: "", retail_job_id: "", nomor_invoice: "", tanggal_jatuh_tempo: "" });
const blankReceipt = (): ReceiptForm => ({ rekening_id: "", tanggal_transaksi: today(), nominal: "", referensi_bank: "", nama_pengirim: "", keterangan: "" });
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  DITERBITKAN: "Diterbitkan",
  SEBAGIAN_DIBAYAR: "Sebagian Dibayar",
  LUNAS: "Lunas",
  DIBATALKAN: "Dibatalkan",
};
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
  for (let index = 0; index < 4 && current && typeof current === "object" && current.data && typeof current.data === "object"; index += 1) current = current.data;
  return current && typeof current === "object" ? current : {};
}
const nested = (row: Row, key: string) => (row[key] && typeof row[key] === "object" ? (row[key] as Row) : undefined);
const uploadedFileUrl = (path: string) => {
  const normalized = path.replace(/^\/+/, "").replace(/^uploads\//, "").replace(/^api\//, "");
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/${normalized.startsWith("uploaded/") ? normalized : `uploaded/${normalized}`}`;
};
const date = (value: unknown) => (typeof value === "string" ? new Date(value).toLocaleDateString("id-ID") : "—");
const sourceLabel = (row: Row) => {
  const termin = nested(row, "termin");
  const project = nested(termin ?? {}, "proyek");
  const retail = nested(row, "retail_job");
  if (project) return `${String(project.kode_proyek ?? "")} · ${String(project.nama_proyek ?? "Proyek")} · Termin ${String(termin?.nomor_termin ?? "")}`;
  if (retail) return `${String(retail.nomor_job ?? "")} · ${String(retail.nama_pelanggan ?? "Retail")} · LHU ${String(retail.nomor_lhu ?? "—")}`;
  return "—";
};

export default function InvoicePageClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const [creating, setCreating] = useState(false);
  const [invoiceSource, setInvoiceSource] = useState<"project" | "retail">("project");
  const [settling, setSettling] = useState<Row | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Row | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(blankInvoice);
  const [receiptForm, setReceiptForm] = useState<ReceiptForm>(blankReceipt);
  const [receiptProof, setReceiptProof] = useState<File | null>(null);
  const [error, setError] = useState("");
  const user = useCurrentUser();
  const role = user.data?.role?.toLowerCase() ?? "";
  const canCreate = ["superadmin", "keuangan", "keu_billing"].includes(role);
  const canSettle = ["superadmin", "keuangan", "keu_bendahara"].includes(role);
  useEffect(() => {
    if (!canCreate) return;
    const params = new URLSearchParams(window.location.search);
    const retail = params.get("createRetail") === "1";
    if (params.get("createInvoice") !== "1" && !retail) return;
    setInvoiceSource(retail ? "retail" : "project");
    setInvoiceForm({ ...blankInvoice(), termin_id: params.get("terminId") ?? "", retail_job_id: params.get("retailJobId") ?? "" });
    setCreating(true);
    setError("");
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [canCreate]);
  const listQuery = use_query({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceControllerList",
    params: { query: search || undefined, status: status === "__all" ? undefined : status, limit: 100, page: 1 },
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceControllerList(params, { format: "json" }));
    },
  });
  const rows = useMemo(() => listRows(listQuery.data), [listQuery.data]);
  useEffect(() => {
    if (!canSettle || listQuery.isLoading || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const invoiceId = url.searchParams.get("settleInvoiceId");
    if (!invoiceId) return;
    const invoice = rows.find((row) => String(row.id) === invoiceId);
    if (invoice && ["DITERBITKAN", "SEBAGIAN_DIBAYAR"].includes(String(invoice.status))) {
      setSettling(invoice);
      setReceiptForm({ ...blankReceipt(), nominal: String(Math.max(0, Number(invoice.nominal ?? 0) - Number(invoice.nominal_dibayar ?? 0))) });
      setReceiptProof(null);
      setError("");
    } else {
      setError(invoice ? "Invoice ini tidak menunggu pembayaran." : "Invoice tidak ditemukan pada daftar invoice.");
    }
    url.searchParams.delete("settleInvoiceId");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [canSettle, listQuery.isLoading, rows]);
  const terminQuery = use_query({
    tag: "masterProyek",
    method: "proyekControllerGetTerminQueue",
    params: { page: 1, limit: 100 },
    enabled: creating && canCreate,
    queryFn: async () => {
      setBrowserToken();
      const endpoint = browserApi.masterProyek.proyekControllerGetTerminQueue as unknown as (params: { query: { page: number; limit: number }; format: "json" }) => Promise<{ data: unknown }>;
      return apiData(endpoint({ query: { page: 1, limit: 100 }, format: "json" }));
    },
  });
  const terminRows = listRows(terminQuery.data).filter((item) => {
    if (item.proyek?.status_proyek !== "DISETUJUI_PIMPINAN" || item.status !== "MENUNGGU_INVOICE" || item.invoice) return false;
    return !(item.proyek?.termin_list ?? []).some((term: Row) => Number(term.nomor_termin) < Number(item.nomor_termin) && term.status !== "CAIR");
  });
  const retailJobsQuery = use_query({
    tag: "retail",
    method: "retailJobsReadyForInvoice",
    params: {},
    enabled: creating && invoiceSource === "retail",
    queryFn: async () => requestHrisApi("/api/retail/jobs?status=SIAP_DITAGIH&limit=100&page=1"),
  });
  const retailJobRows = listRows(retailJobsQuery.data);
  const accountsQuery = use_query({
    tag: "masterRekeningBank",
    method: "masterRekeningControllerFindAll",
    params: undefined,
    enabled: Boolean(settling) && canSettle,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterRekeningBank.masterRekeningControllerFindAll({ format: "json" }));
    },
  });
  const accounts = listRows(accountsQuery.data).length
    ? listRows(accountsQuery.data)
    : (() => {
        const item = payload(accountsQuery.data);
        return Array.isArray(item) ? item : [];
      })();
  const invalidate = [apiQueryKeys.resource("keuanganInvoiceDanSettlement"), apiQueryKeys.resource("retail")];
  const createMutation = use_mutation<unknown, Error, CreateInvoiceDto>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceControllerCreateInvoice",
    invalidateKeys: invalidate,
    mutationFn: async (data) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceControllerCreateInvoice(data, { format: "json" }));
    },
    onSuccess: () => {
      setCreating(false);
      setInvoiceForm(blankInvoice());
      setError("");
    },
  });
  const receiptMutation = use_mutation<unknown, Error, { mutasi: CreateMutasiBankDto; invoiceId: string; payment: Omit<BayarInvoiceDto, "mutasi_bank_id">; proof: File }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceReceiptSettlement",
    invalidateKeys: invalidate,
    mutationFn: async ({ mutasi, invoiceId, payment, proof }) => {
      setBrowserToken();
      const created = await uploadHrisFile("/api/keuangan/mutasi-bank", proof, {
        rekening_id: mutasi.rekening_id,
        tanggal_transaksi: mutasi.tanggal_transaksi,
        nominal: String(mutasi.nominal),
        referensi_bank: mutasi.referensi_bank,
        ...(mutasi.nama_pengirim ? { nama_pengirim: mutasi.nama_pengirim } : {}),
        ...(mutasi.keterangan ? { keterangan: mutasi.keterangan } : {}),
      });
      const mutationId = String(payload(created).id ?? "");
      if (!mutationId) throw new Error("Server tidak mengembalikan ID mutasi bank.");
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceControllerBayar(invoiceId, { ...payment, mutasi_bank_id: mutationId }, { format: "json" }));
    },
    onSuccess: () => {
      setSettling(null);
      setReceiptForm(blankReceipt());
      setReceiptProof(null);
      setError("");
    },
  });
  async function createInvoice() {
    const sourceId = invoiceSource === "retail" ? invoiceForm.retail_job_id : invoiceForm.termin_id;
    if (!sourceId || !invoiceForm.nomor_invoice.trim()) {
      setError(`${invoiceSource === "retail" ? "Job retail" : "Termin"} dan nomor invoice wajib diisi.`);
      return;
    }
    try {
      setError("");
      await createMutation.mutateAsync(invoiceSource === "retail"
        ? { jenis: "RETAIL", retail_job_id: invoiceForm.retail_job_id, nomor_invoice: invoiceForm.nomor_invoice.trim(), tanggal_terbit: today(), tanggal_jatuh_tempo: invoiceForm.tanggal_jatuh_tempo || undefined }
        : { jenis: "PROYEK", termin_id: invoiceForm.termin_id, nomor_invoice: invoiceForm.nomor_invoice.trim(), tanggal_terbit: today(), tanggal_jatuh_tempo: invoiceForm.tanggal_jatuh_tempo || undefined });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Invoice gagal dibuat."));
    }
  }
  async function settle() {
    if (!settling) return;
    const amount = Number(receiptForm.nominal);
    const remaining = Number(settling.nominal ?? 0) - Number(settling.nominal_dibayar ?? 0);
    if (!receiptForm.rekening_id || !receiptForm.tanggal_transaksi || !receiptForm.referensi_bank.trim() || !receiptProof || amount <= 0) {
      setError("Rekening, tanggal, referensi bank, bukti penerimaan, dan nominal positif wajib diisi.");
      return;
    }
    if (receiptProof.size > 10 * 1024 * 1024) {
      setError("Ukuran bukti penerimaan maksimal 10 MB.");
      return;
    }
    if (amount > remaining) {
      setError(`Nominal melebihi sisa invoice ${formatRupiah(remaining)}.`);
      return;
    }
    try {
      setError("");
      await receiptMutation.mutateAsync({
        invoiceId: String(settling.id),
        proof: receiptProof,
        mutasi: {
          rekening_id: receiptForm.rekening_id,
          tanggal_transaksi: receiptForm.tanggal_transaksi,
          nominal: amount,
          referensi_bank: receiptForm.referensi_bank.trim(),
          nama_pengirim: receiptForm.nama_pengirim.trim() || undefined,
          keterangan: receiptForm.keterangan.trim() || undefined,
        },
        payment: { nominal: amount, catatan: receiptForm.keterangan.trim() || undefined },
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Penerimaan invoice gagal disimpan."));
    }
  }

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">Billing menerbitkan invoice sebagai piutang. Bendahara mencatat pembayaran setelah dana masuk ke rekening.</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setInvoiceSource("project");
              setCreating(true);
              setInvoiceForm(blankInvoice());
              setError("");
            }}
          >
            <FilePlus2 size={17} /> Buat Invoice Proyek
          </Button>
        )}
      </header>
      <Card>
        <CardContent className="pt-4">
          {listQuery.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Memuat invoice…</p>}
          {listQuery.isError && <p className="py-8 text-center text-sm text-destructive">{apiErrorMessage(listQuery.error, "Gagal memuat invoice.")}</p>}
          {!listQuery.isLoading && !listQuery.isError && (
            <DataTable
              rows={rows}
              rowKey={(row, index) => String(row.id ?? index)}
              remoteSearch
              searchValue={search}
              searchPlaceholder="Cari nomor invoice…"
              onSearchChange={setSearch}
              filters={[{ field: "status", label: "Status", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) }]}
              filterValues={{ status }}
              onFilterChange={(_field, value) => setStatus(value)}
              columns={[
                { key: "nomor_invoice", header: "Nomor Invoice", render: (row) => row.nomor_invoice ?? "—" },
                { key: "sumber", header: "Proyek / Job", render: (row) => sourceLabel(row) },
                { key: "tanggal_terbit", header: "Terbit", render: (row) => date(row.tanggal_terbit) },
                { key: "nominal", header: "Tagihan", render: (row) => formatRupiah(row.nominal) },
                { key: "nominal_dibayar", header: "Dibayar", render: (row) => formatRupiah(row.nominal_dibayar) },
                { key: "status", header: "Status", render: (row) => statusLabels[row.status] ?? row.status ?? "—" },
                {
                  key: "aksi",
                  header: "Aksi",
                  render: (row: Row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailInvoice(row)}>
                        <Eye size={14} /> Detail
                      </Button>
                            {canSettle && ["DITERBITKAN", "SEBAGIAN_DIBAYAR"].includes(String(row.status)) && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSettling(row);
                                  setReceiptForm({ ...blankReceipt(), nominal: String(Number(row.nominal ?? 0) - Number(row.nominal_dibayar ?? 0)) });
                                  setReceiptProof(null);
                                  setError("");
                                }}
                              >
                                <CircleDollarSign size={15} /> Terima
                              </Button>
                            )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={invoiceSource === "retail" ? "Buat Invoice Layanan Retail" : "Buat Invoice Proyek"}
        description={invoiceSource === "retail" ? "Tagihan retail diterbitkan setelah LHU tercatat. Porsi penerimaan untuk OPS_KANTOR mengikuti persentase yang dikonfigurasi." : "Invoice langsung diterbitkan sebagai piutang. Status lunas dicatat Bendahara setelah pembayaran terkonfirmasi di rekening."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Batal
            </Button>
            <Button disabled={createMutation.isPending || (invoiceSource === "retail" ? retailJobsQuery.isLoading : terminQuery.isLoading)} onClick={createInvoice}>
              {createMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Terbitkan Invoice
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          {invoiceSource === "retail" ? (
            <>
              Job retail siap ditagih *
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={invoiceForm.retail_job_id} onChange={(event) => setInvoiceForm((current) => ({ ...current, retail_job_id: event.target.value }))}>
                <option value="">Pilih job retail</option>
                {retailJobRows.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.nomor_job)} · {String(item.nama_pelanggan)} · LHU {String(item.nomor_lhu ?? "—")} · {formatRupiah(item.nilai_layanan)}</option>)}
              </select>
              {retailJobsQuery.isError && <p className="text-xs text-destructive">{apiErrorMessage(retailJobsQuery.error, "Gagal memuat job retail siap ditagih.")}</p>}
            </>
          ) : (
            <>
              Termin proyek *
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={invoiceForm.termin_id} onChange={(event) => setInvoiceForm((current) => ({ ...current, termin_id: event.target.value }))}>
                <option value="">Pilih termin</option>
                {terminRows.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.proyek?.kode_proyek ?? "Proyek")} · Termin {String(item.nomor_termin)} · {formatRupiah(item.nilai_termin)}</option>)}
              </select>
            </>
          )}
        </label>
        <label className="grid gap-1 text-sm">
          Nomor invoice *<Input maxLength={100} value={invoiceForm.nomor_invoice} onChange={(event) => setInvoiceForm((current) => ({ ...current, nomor_invoice: event.target.value }))} />
        </label>
        <label className="grid gap-1 text-sm">
          Tanggal jatuh tempo
          <Input type="date" value={invoiceForm.tanggal_jatuh_tempo} onChange={(event) => setInvoiceForm((current) => ({ ...current, tanggal_jatuh_tempo: event.target.value }))} />
        </label>
        {terminQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{apiErrorMessage(terminQuery.error, "Gagal memuat termin.")}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        title="Rincian Invoice"
        description={detailInvoice ? `${String(detailInvoice.nomor_invoice ?? "—")} · ${sourceLabel(detailInvoice)}` : undefined}
        size="lg"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={<Button variant="outline" onClick={() => setDetailInvoice(null)}>Tutup</Button>}
      >
        {detailInvoice && (() => {
          const paid = Number(detailInvoice.nominal_dibayar ?? 0);
          const amount = Number(detailInvoice.nominal ?? 0);
          const remaining = Math.max(0, amount - paid);
          const project = nested(nested(detailInvoice, "termin") ?? {}, "proyek");
          const retailJob = nested(detailInvoice, "retail_job");
          const retailLines = Array.isArray(retailJob?.rincian_layanan) ? retailJob.rincian_layanan as Row[] : [];
          const payments = Array.isArray(detailInvoice.pembayaran) ? detailInvoice.pembayaran as Row[] : [];
          const invoiceStatus = String(detailInvoice.status ?? "");
          const invoiceTone = invoiceStatus === "LUNAS" ? "ok" : invoiceStatus === "DITOLAK_KEUANGAN" || invoiceStatus === "DIBATALKAN" ? "danger" : invoiceStatus === "SEBAGIAN_DIBAYAR" ? "warn" : "neutral";
          return (
            <div className="space-y-4">
              <ModalSection title="Informasi invoice" action={<StatusBadge status={invoiceTone}>{statusLabels[invoiceStatus] ?? (invoiceStatus || "—")}</StatusBadge>}>
                <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                  {[
                    ["Nomor invoice", detailInvoice.nomor_invoice ?? "—"],
                    ["Jenis invoice", detailInvoice.jenis ?? "—"],
                    ["Proyek sumber", project ? `${String(project.kode_proyek ?? "—")} · ${String(project.nama_proyek ?? "—")}` : sourceLabel(detailInvoice)],
                    ["Termin", nested(detailInvoice, "termin") ? `Termin ${String(nested(detailInvoice, "termin")?.nomor_termin ?? "—")}` : "—"],
                    ["Tanggal terbit", date(detailInvoice.tanggal_terbit)],
                    ["Jatuh tempo", date(detailInvoice.tanggal_jatuh_tempo)],
                    ["Dibuat oleh", nested(detailInvoice, "pembuat")?.nama ?? "—"],
                    ["Diterbitkan pada", date(detailInvoice.diterbitkan_pada)],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="min-w-0 py-3 sm:border-b">
                      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </ModalSection>
              {retailJob && (
                <ModalSection title="Order retail dan rincian layanan" description="Detail klien, laporan hasil uji, dan nilai tagihan layanan retail.">
                  <dl className="mb-3 grid gap-x-8 sm:grid-cols-2">
                    {[
                      ["No. job", retailJob.nomor_job ?? "—"],
                      ["Nama klien", retailJob.nama_pelanggan ?? "—"],
                      ["Nomor LHU", retailJob.nomor_lhu ?? "—"],
                      ["Tanggal order", date(retailJob.tanggal_permohonan)],
                      ["Unit pelaksana", retailJob.unit_pelaksana?.nama_unit ?? "—"],
                      ["Jenis layanan / sampel", retailJob.detail_perconto ?? "—"],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="border-b py-2.5">
                        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                        <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {retailLines.length ? (
                    <div className="overflow-x-auto rounded-md border bg-white">
                      <table className="w-full min-w-[36rem] text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-2.5">Layanan uji</th><th className="p-2.5">Parameter / metode</th><th className="p-2.5 text-right">Jumlah</th><th className="p-2.5 text-right">Tarif</th><th className="p-2.5 text-right">Subtotal</th></tr></thead>
                        <tbody>{retailLines.map((line, index) => <tr key={String(line.id ?? index)} className="border-t"><td className="p-2.5">{String(line.nama_layanan ?? "—")}<span className="block text-muted-foreground">{String(line.satuan ?? "sampel")}</span></td><td className="p-2.5">{String(line.parameter_uji ?? "—")}<span className="block text-muted-foreground">{String(line.metode_uji ?? "Metode belum dicatat")}</span></td><td className="p-2.5 text-right tabular-nums">{String(line.jumlah ?? 0)}</td><td className="p-2.5 text-right tabular-nums">{formatRupiah(line.tarif)}</td><td className="p-2.5 text-right font-medium tabular-nums">{formatRupiah(line.subtotal)}</td></tr>)}</tbody>
                        <tfoot className="border-t bg-muted/20"><tr><td colSpan={4} className="p-2.5 font-semibold">Total nilai layanan</td><td className="p-2.5 text-right font-semibold tabular-nums">{formatRupiah(retailJob.nilai_layanan)}</td></tr></tfoot>
                      </table>
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Rincian layanan belum tersedia untuk job retail lama.</p>}
                </ModalSection>
              )}
              <ModalSection title="Status pencairan" description="Pembayaran dapat masuk bertahap sampai jumlah diterima sama dengan nilai tagihan.">
                <MoneyFlow items={[
                  { label: "Nilai tagihan", amount },
                  { label: "Sudah diterima", amount: paid, operator: "−", tone: "text-sky-700" },
                  { label: "Sisa pencairan", amount: remaining, operator: "=", tone: remaining === 0 && paid > 0 ? "text-emerald-700" : "text-amber-700" },
                ]} />
              </ModalSection>
              <ModalSection title="Riwayat penerimaan bank" description={`${payments.length} transaksi penerimaan tercatat`}>
                {payments.length ? (
                  <div className="overflow-x-auto rounded-md border bg-white">
                    <table className="w-full min-w-[42rem] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr><th className="p-2.5">Tanggal</th><th className="p-2.5">Referensi / rekening</th><th className="p-2.5">Divalidasi oleh</th><th className="p-2.5 text-right">Nominal</th><th className="p-2.5">Bukti</th><th className="p-2.5">Catatan</th></tr>
                      </thead>
                      <tbody>
                        {payments.map((payment, index) => {
                          const bankMutation = nested(payment, "mutasi_bank");
                          const account = nested(bankMutation ?? {}, "rekening");
                          return (
                            <tr key={String(payment.id ?? index)} className="border-t">
                              <td className="whitespace-nowrap p-2.5">{date(payment.divalidasi_pada ?? bankMutation?.tanggal_transaksi)}</td>
                              <td className="p-2.5">
                                <span className="font-medium">{String(bankMutation?.referensi_bank ?? "—")}</span>
                                <span className="mt-0.5 block text-muted-foreground">{[account?.nama_bank, account?.nomor_rekening, account?.nama_rekening].filter(Boolean).join(" · ") || "Rekening tidak tersedia"}</span>
                              </td>
                              <td className="p-2.5">{nested(payment, "validator")?.nama ?? "—"}</td>
                              <td className="whitespace-nowrap p-2.5 text-right font-semibold tabular-nums">{formatRupiah(payment.nominal)}</td>
                              <td className="p-2.5">
                                {typeof bankMutation?.file_bukti === "string" && bankMutation.file_bukti ? (
                                  <a className="font-medium text-primary underline-offset-4 hover:underline" href={uploadedFileUrl(bankMutation.file_bukti)} target="_blank" rel="noreferrer">Lihat bukti</a>
                                ) : "—"}
                              </td>
                              <td className="p-2.5">{String(payment.catatan ?? bankMutation?.keterangan ?? "—")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada penerimaan bank yang tercatat.</p>
                )}
              </ModalSection>
            </div>
          );
        })()}
      </Modal>
      <Modal
        open={Boolean(settling)}
        onClose={() => { setSettling(null); setReceiptProof(null); }}
        title="Catat Penerimaan Invoice"
        description={settling ? `${String(settling.nomor_invoice)} · sisa ${formatRupiah(Number(settling.nominal ?? 0) - Number(settling.nominal_dibayar ?? 0))}. Catat dana yang sudah masuk rekening dan lampirkan bukti penerimaannya.` : "Penerimaan invoice."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => { setSettling(null); setReceiptProof(null); }}>
              Batal
            </Button>
            <Button disabled={receiptMutation.isPending || accountsQuery.isLoading} onClick={settle}>
              {receiptMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={16} />} Konfirmasi Penerimaan
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          Rekening penerima *
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={receiptForm.rekening_id} onChange={(event) => setReceiptForm((current) => ({ ...current, rekening_id: event.target.value }))}>
            <option value="">Pilih rekening</option>
            {accounts.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {String(item.nama_bank ?? "Bank")} · {String(item.nomor_rekening ?? "")} · {String(item.nama_rekening ?? "")}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Tanggal transaksi *<Input type="date" value={receiptForm.tanggal_transaksi} onChange={(event) => setReceiptForm((current) => ({ ...current, tanggal_transaksi: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Nominal diterima *<MoneyInput value={receiptForm.nominal} onValueChange={(value) => setReceiptForm((current) => ({ ...current, nominal: value }))} />
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Nomor referensi bank *<Input maxLength={150} placeholder="Nomor transaksi yang tercantum pada bukti transfer" value={receiptForm.referensi_bank} onChange={(event) => setReceiptForm((current) => ({ ...current, referensi_bank: event.target.value }))} />
        </label>
        <label className="grid gap-1 text-sm">
          Nama pengirim
          <Input maxLength={200} value={receiptForm.nama_pengirim} onChange={(event) => setReceiptForm((current) => ({ ...current, nama_pengirim: event.target.value }))} />
        </label>
        <label className="grid gap-1 text-sm">
          Catatan
          <textarea
            className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
            maxLength={500}
            value={receiptForm.keterangan}
            onChange={(event) => setReceiptForm((current) => ({ ...current, keterangan: event.target.value }))}
          />
        </label>
        <div>
          <DocumentUploadField
            label="Bukti penerimaan bank *"
            accept=".pdf,.jpg,.jpeg,.png"
            value={receiptProof}
            onChange={setReceiptProof}
            disabled={receiptMutation.isPending}
            className="p-3 sm:p-3"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Unggah bukti transfer masuk atau cuplikan mutasi rekening agar pembayaran dapat diverifikasi. Format PDF, JPG, atau PNG; maksimal 10 MB.</p>
        </div>
        {accountsQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{apiErrorMessage(accountsQuery.error, "Gagal memuat rekening.")}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
    </section>
  );
}
