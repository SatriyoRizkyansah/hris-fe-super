"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, CircleDollarSign, Eye, FilePlus2, LoaderCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { BayarInvoiceDto, CreateInvoiceDto, CreateMutasiBankDto, ValidasiInvoiceKeuanganDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type InvoiceForm = { termin_id: string; nomor_invoice: string; tanggal_jatuh_tempo: string };
type ReceiptForm = { rekening_id: string; tanggal_transaksi: string; nominal: string; referensi_bank: string; nama_pengirim: string; keterangan: string };
type InvoiceInfo = { label: string; value: ReactNode };
const today = () => new Date().toISOString().slice(0, 10);
const blankInvoice = (): InvoiceForm => ({ termin_id: "", nomor_invoice: "", tanggal_jatuh_tempo: "" });
const blankReceipt = (): ReceiptForm => ({ rekening_id: "", tanggal_transaksi: today(), nominal: "", referensi_bank: "", nama_pengirim: "", keterangan: "" });
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  MENUNGGU_VALIDASI_KEUANGAN: "Menunggu Validasi Keuangan",
  DITOLAK_KEUANGAN: "Ditolak Keuangan",
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
const date = (value: unknown) => (typeof value === "string" ? new Date(value).toLocaleDateString("id-ID") : "—");
const dateTime = (value: unknown) => (typeof value === "string" ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—");
const invoiceStatusTone = (status: unknown): "ok" | "warn" | "danger" | "neutral" => {
  if (["LUNAS", "DITERBITKAN"].includes(String(status))) return "ok";
  if (["MENUNGGU_VALIDASI_KEUANGAN", "SEBAGIAN_DIBAYAR"].includes(String(status))) return "warn";
  if (["DITOLAK_KEUANGAN", "DIBATALKAN"].includes(String(status))) return "danger";
  return "neutral";
};
function InvoiceInfoGrid({ items }: { items: InvoiceInfo[] }) {
  return (
    <dl className="grid gap-x-8 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="grid min-w-0 grid-cols-[minmax(6.5rem,0.8fr)_minmax(0,1.2fr)] gap-3 border-b border-border/70 py-2.5 last:border-b-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 break-words text-right text-sm font-medium text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
const sourceLabel = (row: Row) => {
  const termin = nested(row, "termin");
  const project = nested(termin ?? {}, "proyek");
  const retail = nested(row, "retail_job");
  if (project) return `${String(project.kode_proyek ?? "")} · ${String(project.nama_proyek ?? "Proyek")} · Termin ${String(termin?.nomor_termin ?? "")}`;
  if (retail) return `${String(retail.nomor_job ?? "")} · ${String(retail.nama_pelanggan ?? "Retail")}`;
  return "—";
};

export default function InvoicePageClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const [creating, setCreating] = useState(false);
  const [validating, setValidating] = useState<Row | null>(null);
  const [settling, setSettling] = useState<Row | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Row | null>(null);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(blankInvoice);
  const [receiptForm, setReceiptForm] = useState<ReceiptForm>(blankReceipt);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const user = useCurrentUser();
  const role = user.data?.role?.toLowerCase() ?? "";
  const canCreate = ["superadmin", "keu_billing"].includes(role);
  const canValidate = ["superadmin", "keuangan"].includes(role);
  const canSettle = ["superadmin", "keu_bendahara"].includes(role);
  useEffect(() => {
    if (!canCreate) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("buat_invoice") !== "1") return;
    const terminId = params.get("termin_id") ?? "";
    setInvoiceForm({ ...blankInvoice(), termin_id: terminId });
    setCreating(true);
    setError("");
    params.delete("buat_invoice");
    params.delete("termin_id");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
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
  const terminRows = listRows(terminQuery.data).filter((item) => item.proyek?.status_proyek === "DISETUJUI_PIMPINAN");
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
  const invalidate = [apiQueryKeys.resource("keuanganInvoiceDanSettlement")];
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
  const validateMutation = use_mutation<unknown, Error, { id: string; data: ValidasiInvoiceKeuanganDto }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceControllerValidasiInvoiceKeuangan",
    invalidateKeys: invalidate,
    mutationFn: async ({ id, data }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceControllerValidasiInvoiceKeuangan(id, data, { format: "json" }));
    },
    onSuccess: () => {
      setValidating(null);
      setNote("");
      setError("");
    },
  });
  const receiptMutation = use_mutation<unknown, Error, { mutasi: CreateMutasiBankDto; invoiceId: string; payment: Omit<BayarInvoiceDto, "mutasi_bank_id"> }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceReceiptSettlement",
    invalidateKeys: invalidate,
    mutationFn: async ({ mutasi, invoiceId, payment }) => {
      setBrowserToken();
      const created = await apiData(browserApi.keuanganInvoiceDanSettlement.invoiceControllerCreateMutasi(mutasi, { format: "json" }));
      const mutationId = String(payload(created).id ?? "");
      if (!mutationId) throw new Error("Server tidak mengembalikan ID mutasi bank.");
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceControllerBayar(invoiceId, { ...payment, mutasi_bank_id: mutationId }, { format: "json" }));
    },
    onSuccess: () => {
      setSettling(null);
      setReceiptForm(blankReceipt());
      setError("");
    },
  });
  async function createInvoice() {
    if (!invoiceForm.termin_id || !invoiceForm.nomor_invoice.trim()) {
      setError("Termin dan nomor invoice wajib diisi.");
      return;
    }
    try {
      setError("");
      await createMutation.mutateAsync({ jenis: "PROYEK", termin_id: invoiceForm.termin_id, nomor_invoice: invoiceForm.nomor_invoice.trim(), tanggal_terbit: today(), tanggal_jatuh_tempo: invoiceForm.tanggal_jatuh_tempo || undefined });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Invoice gagal dibuat."));
    }
  }
  async function validate(disetujui: boolean) {
    if (!validating) return;
    if (!disetujui && !note.trim()) {
      setError("Catatan penolakan wajib diisi.");
      return;
    }
    try {
      setError("");
      await validateMutation.mutateAsync({ id: String(validating.id), data: { disetujui, catatan: note.trim() || undefined } });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Validasi invoice gagal disimpan."));
    }
  }
  async function settle() {
    if (!settling) return;
    const amount = Number(receiptForm.nominal);
    const remaining = Number(settling.nominal ?? 0) - Number(settling.nominal_dibayar ?? 0);
    if (!receiptForm.rekening_id || !receiptForm.tanggal_transaksi || !receiptForm.referensi_bank.trim() || amount <= 0) {
      setError("Rekening, tanggal, referensi bank, dan nominal positif wajib diisi.");
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
          <p className="mt-1 text-sm text-muted-foreground">Billing membuat invoice proyek, Keuangan menerbitkan, Bendahara mencatat penerimaan bank.</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
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
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setDetailInvoice(row)}>
                              <Eye size={15} /> Detail
                            </Button>
                            {canValidate && row.status === "MENUNGGU_VALIDASI_KEUANGAN" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setValidating(row);
                                  setNote("");
                                  setError("");
                                }}
                              >
                                Validasi
                              </Button>
                            )}
                            {canSettle && ["DITERBITKAN", "SEBAGIAN_DIBAYAR"].includes(String(row.status)) && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSettling(row);
                                  setReceiptForm({ ...blankReceipt(), nominal: String(Number(row.nominal ?? 0) - Number(row.nominal_dibayar ?? 0)) });
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
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        title="Rincian Invoice"
        description={detailInvoice ? `${String(detailInvoice.nomor_invoice ?? "Invoice")} · ${sourceLabel(detailInvoice)}` : undefined}
        size="xl"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={<Button variant="outline" onClick={() => setDetailInvoice(null)}>Tutup</Button>}
      >
        {detailInvoice && (() => {
          const termin = nested(detailInvoice, "termin");
          const project = nested(termin ?? {}, "proyek");
          const retail = nested(detailInvoice, "retail_job");
          const retailRo = nested(retail ?? {}, "ro");
          const retailProject = nested(retailRo ?? {}, "proyek");
          const invoiceProject = project ?? retailProject;
          const payments = Array.isArray(detailInvoice.pembayaran) ? detailInvoice.pembayaran as Row[] : [];
          const paidAmount = Number(detailInvoice.nominal_dibayar ?? 0);
          const invoiceAmount = Number(detailInvoice.nominal ?? 0);
          const remaining = Math.max(0, invoiceAmount - paidAmount);
          const status = String(detailInvoice.status ?? "");
          const canceled = status === "DIBATALKAN";
          const validationStatus = status === "DITOLAK_KEUANGAN"
            ? "Ditolak Keuangan"
            : detailInvoice.divalidasi_keuangan_pada
              ? "Disetujui Keuangan"
              : status === "MENUNGGU_VALIDASI_KEUANGAN"
                ? "Menunggu validasi"
                : "Tidak diperlukan";
          const projectRos = Array.isArray(invoiceProject?.ro_list) ? invoiceProject.ro_list as Row[] : [];
          return (
            <div className="space-y-4">
              <ModalSection
                title={invoiceProject ? "Informasi proyek sumber" : "Sumber invoice"}
                description={invoiceProject ? "Informasi kontrak dan unit kerja yang menjadi sumber tagihan." : "Detail Retail Job yang menjadi sumber tagihan."}
              >
                {invoiceProject ? (
                  <>
                    <InvoiceInfoGrid items={[
                      { label: "Kode proyek", value: invoiceProject.kode_proyek },
                      { label: "Nama proyek", value: invoiceProject.nama_proyek },
                      { label: "Tahun fiskal", value: invoiceProject.tahun_fiscal ? `TA ${String(invoiceProject.tahun_fiscal)}` : "—" },
                      { label: "Status proyek", value: String(invoiceProject.status_proyek ?? "—").replaceAll("_", " ") },
                      { label: "Klien", value: invoiceProject.nama_client || "—" },
                      { label: "Sumber pendanaan", value: invoiceProject.sumber_pendanaan || "—" },
                      { label: "Penanggung jawab 1", value: invoiceProject.pj_1 || "—" },
                      { label: "Penanggung jawab 2", value: invoiceProject.pj_2 || "—" },
                      { label: "Mulai proyek", value: date(invoiceProject.mulai_proyek) },
                      { label: "Estimasi selesai", value: date(invoiceProject.estimasi_selesai_proyek) },
                      { label: "Nilai kontrak", value: formatRupiah(invoiceProject.nilai_kontrak) },
                      { label: "Biaya langsung / margin", value: `${formatRupiah(invoiceProject.total_direct_cost)} / ${formatRupiah(invoiceProject.total_margin)}` },
                    ]} />
                    {project && termin && (
                      <div className="mt-4 border-t border-border/70 pt-3">
                        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Termin sumber</h3>
                        <InvoiceInfoGrid items={[
                          { label: "Termin", value: `Termin ${String(termin.nomor_termin ?? "—")}` },
                          { label: "Persentase", value: `${String(termin.persentase ?? 0)}%` },
                          { label: "Nilai", value: formatRupiah(termin.nilai_termin) },
                          { label: "Status", value: String(termin.status ?? "—").replaceAll("_", " ") },
                          { label: "Dibuat pada", value: dateTime(termin.created_at) },
                          { label: "Validasi Keuangan", value: dateTime(termin.divalidasi_keuangan_pada) },
                          { label: "Pencairan", value: dateTime(termin.dicairkan_pada) },
                          { label: "Catatan Keuangan", value: termin.catatan_keuangan || "Tidak ada catatan." },
                        ]} />
                      </div>
                    )}
                    {projectRos.length > 0 && (
                      <div className="mt-4 border-t border-border/70 pt-3">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">RO dalam proyek · {projectRos.length}</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[40rem] text-xs">
                            <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3 font-medium">RO</th><th className="py-2 pr-3 font-medium">Koordinator</th><th className="py-2 pr-3 font-medium">MAK</th><th className="py-2 pr-3 text-right font-medium">Plafon</th><th className="py-2 text-right font-medium">Status</th></tr></thead>
                            <tbody>{projectRos.map((row) => { const mak = row.mak as Row | undefined; return <tr key={String(row.id)} className="border-b last:border-0"><td className="py-2 pr-3"><strong>{String(row.kode_ro ?? "—")}</strong><span className="block text-muted-foreground">{String(row.nama_ro ?? "—")}</span></td><td className="py-2 pr-3">{String((row.unit_koordinator as Row | undefined)?.nama_unit ?? "—")}</td><td className="py-2 pr-3">{String(mak?.kode_mak ?? "—")} · {String(mak?.nama_mak ?? "")}</td><td className="py-2 pr-3 text-right tabular-nums">{formatRupiah(row.total_plafon ?? row.nilai_rencana)}</td><td className="py-2 text-right">{String(row.status_ro ?? "—").replaceAll("_", " ")}</td></tr>; })}</tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                ) : retail ? (
                  <InvoiceInfoGrid items={[
                    { label: "Nomor Retail Job", value: retail.nomor_job },
                    { label: "Pelanggan", value: retail.nama_pelanggan },
                    { label: "Status Retail Job", value: String(retail.status ?? "—").replaceAll("_", " ") },
                    { label: "Nilai layanan", value: formatRupiah(retail.nilai_layanan) },
                    { label: "Surat permohonan", value: retail.nomor_surat_permohonan || "—" },
                    { label: "Tanggal permohonan", value: date(retail.tanggal_permohonan) },
                    { label: "Nomor LHU", value: retail.nomor_lhu || "—" },
                    { label: "Tanggal LHU", value: date(retail.tanggal_lhu) },
                    { label: "Alamat pelanggan", value: retail.alamat_pelanggan || "—" },
                    { label: "NPWP pelanggan", value: retail.npwp_pelanggan || "—" },
                    { label: "RO", value: retailRo ? `${String(retailRo.kode_ro ?? "—")} · ${String(retailRo.nama_ro ?? "")}` : "—" },
                    { label: "Proyek RO", value: retailProject ? `${String(retailProject.kode_proyek ?? "—")} · ${String(retailProject.nama_proyek ?? "")}` : "Tidak terhubung ke proyek." },
                  ]} />
                ) : <p className="text-sm text-muted-foreground">Informasi proyek atau Retail Job belum tersedia.</p>}
              </ModalSection>

              <ModalSection title="Informasi invoice">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">Status saat ini</p>
                  <StatusBadge status={invoiceStatusTone(status)}>{(statusLabels[status] ?? status) || "—"}</StatusBadge>
                </div>
                <InvoiceInfoGrid items={[
                  { label: "Jenis invoice", value: String(detailInvoice.jenis ?? (project ? "PROYEK" : "RETAIL")) },
                  { label: "Nomor invoice", value: detailInvoice.nomor_invoice },
                  { label: "Tanggal terbit", value: date(detailInvoice.tanggal_terbit) },
                  { label: "Jatuh tempo", value: date(detailInvoice.tanggal_jatuh_tempo) },
                  { label: "Dibuat pada", value: dateTime(detailInvoice.created_at) },
                  { label: "Diperbarui pada", value: dateTime(detailInvoice.updated_at) },
                  { label: "Nilai tagihan", value: <strong>{formatRupiah(detailInvoice.nominal)}</strong> },
                  { label: "Sudah dibayar", value: formatRupiah(detailInvoice.nominal_dibayar) },
                  { label: "Sisa tagihan", value: <strong>{formatRupiah(remaining)}</strong> },
                  { label: "Dibuat oleh", value: nested(detailInvoice, "pembuat")?.nama ?? "—" },
                ]} />
              </ModalSection>

              <ModalSection title="Progres invoice" description="Tahapan proses invoice dan penerimaan tagihan.">
                <ol className="ml-2 border-l border-border pl-4">
                  <li className="relative pb-3 last:pb-0"><span className="absolute -left-[1.32rem] top-1 size-2.5 rounded-full bg-emerald-500 ring-4 ring-background" /><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Invoice dibuat</strong><StatusBadge status="ok">Selesai</StatusBadge></div><p className="mt-0.5 text-xs text-muted-foreground">{nested(detailInvoice, "pembuat")?.nama ?? "Pembuat tidak diketahui"} · {dateTime(detailInvoice.created_at)}</p></li>
                  <li className="relative border-t border-border/70 py-3"><span className={`absolute -left-[1.32rem] top-4 size-2.5 rounded-full ring-4 ring-background ${status === "DITOLAK_KEUANGAN" ? "bg-red-500" : detailInvoice.divalidasi_keuangan_pada ? "bg-emerald-500" : status === "MENUNGGU_VALIDASI_KEUANGAN" ? "bg-amber-500" : "bg-slate-300"}`} /><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Validasi Keuangan</strong><StatusBadge status={status === "MENUNGGU_VALIDASI_KEUANGAN" ? "warn" : status === "DITOLAK_KEUANGAN" ? "danger" : detailInvoice.divalidasi_keuangan_pada ? "ok" : "neutral"}>{validationStatus}</StatusBadge></div><p className="mt-0.5 text-xs text-muted-foreground">{nested(detailInvoice, "validator_keuangan")?.nama ? `Oleh ${String(nested(detailInvoice, "validator_keuangan")?.nama)} · ` : ""}{dateTime(detailInvoice.divalidasi_keuangan_pada)}</p>{detailInvoice.catatan_validasi_keuangan && <p className="mt-1 text-xs">Catatan: {String(detailInvoice.catatan_validasi_keuangan)}</p>}</li>
                  <li className="relative border-t border-border/70 py-3"><span className={`absolute -left-[1.32rem] top-4 size-2.5 rounded-full ring-4 ring-background ${detailInvoice.diterbitkan_pada || detailInvoice.tanggal_terbit ? "bg-emerald-500" : "bg-slate-300"}`} /><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Invoice diterbitkan</strong><StatusBadge status={detailInvoice.diterbitkan_pada || detailInvoice.tanggal_terbit ? "ok" : "neutral"}>{detailInvoice.diterbitkan_pada || detailInvoice.tanggal_terbit ? "Selesai" : canceled ? "Tidak dilanjutkan" : "Menunggu"}</StatusBadge></div><p className="mt-0.5 text-xs text-muted-foreground">{dateTime(detailInvoice.diterbitkan_pada ?? detailInvoice.tanggal_terbit)}</p></li>
                  <li className="relative border-t border-border/70 py-3"><span className={`absolute -left-[1.32rem] top-4 size-2.5 rounded-full ring-4 ring-background ${remaining === 0 && invoiceAmount > 0 ? "bg-emerald-500" : paidAmount > 0 ? "bg-amber-500" : "bg-slate-300"}`} /><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">Penerimaan tagihan</strong><StatusBadge status={remaining === 0 && invoiceAmount > 0 ? "ok" : paidAmount > 0 ? "warn" : "neutral"}>{remaining === 0 && invoiceAmount > 0 ? "Lunas" : paidAmount > 0 ? "Sebagian dibayar" : canceled ? "Tidak dilanjutkan" : "Belum dibayar"}</StatusBadge></div><p className="mt-0.5 text-xs text-muted-foreground">{payments.length} transaksi · {formatRupiah(paidAmount)} diterima dari {formatRupiah(invoiceAmount)}</p></li>
                  {canceled && <li className="relative border-t border-red-200 py-3"><span className="absolute -left-[1.32rem] top-4 size-2.5 rounded-full bg-red-500 ring-4 ring-background" /><strong className="text-sm text-red-800">Invoice dibatalkan</strong><p className="mt-0.5 text-xs text-red-700">{nested(detailInvoice, "pembatal")?.nama ?? "Pembatal tidak diketahui"} · {dateTime(detailInvoice.dibatalkan_pada)}</p>{detailInvoice.alasan_pembatalan && <p className="mt-1 text-xs text-red-700">Alasan: {String(detailInvoice.alasan_pembatalan)}</p>}</li>}
                </ol>
              </ModalSection>
            </div>
          );
        })()}
      </Modal>
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Buat Invoice Proyek"
        description="Invoice masuk antrean validasi Keuangan sebelum resmi diterbitkan."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Batal
            </Button>
            <Button disabled={createMutation.isPending || terminQuery.isLoading} onClick={createInvoice}>
              {createMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Kirim ke Keuangan
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          Termin proyek *
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={invoiceForm.termin_id} onChange={(event) => setInvoiceForm((current) => ({ ...current, termin_id: event.target.value }))}>
            <option value="">Pilih termin</option>
            {terminRows.map((item) => (
              <option key={String(item.id)} value={String(item.id)}>
                {String(item.proyek?.kode_proyek ?? "Proyek")} · Termin {String(item.nomor_termin)} · {formatRupiah(item.nilai_termin)}
              </option>
            ))}
          </select>
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
        open={Boolean(validating)}
        onClose={() => setValidating(null)}
        title="Validasi Invoice"
        description={validating ? `${String(validating.nomor_invoice)} · ${formatRupiah(validating.nominal)}` : "Validasi invoice proyek."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setValidating(null)}>
              Batal
            </Button>
            <Button variant="outline" disabled={validateMutation.isPending} onClick={() => validate(false)}>
              <X size={16} /> Tolak
            </Button>
            <Button disabled={validateMutation.isPending} onClick={() => validate(true)}>
              {validateMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Setujui & Terbitkan
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          Catatan
          <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(settling)}
        onClose={() => setSettling(null)}
        title="Catat Penerimaan Invoice"
        description={settling ? `${String(settling.nomor_invoice)} · sisa ${formatRupiah(Number(settling.nominal ?? 0) - Number(settling.nominal_dibayar ?? 0))}` : "Penerimaan invoice."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setSettling(null)}>
              Batal
            </Button>
            <Button disabled={receiptMutation.isPending || accountsQuery.isLoading} onClick={settle}>
              {receiptMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={16} />} Catat & Validasi
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
          Referensi bank *<Input maxLength={150} value={receiptForm.referensi_bank} onChange={(event) => setReceiptForm((current) => ({ ...current, referensi_bank: event.target.value }))} />
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
