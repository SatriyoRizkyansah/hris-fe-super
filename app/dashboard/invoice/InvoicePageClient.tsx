"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, CircleDollarSign, Eye, FileCheck2, FilePlus2, Landmark, LoaderCircle, Plus, ReceiptText, Scale, Trash2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { MoneyFlow } from "@/components/common/MoneyFlow";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/table";
import { EmptyData } from "@/components/loading/EmptyData";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, getBrowserToken, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { BayarInvoiceDto, CreateInvoiceDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type InvoiceForm = { termin_id: string; retail_job_id: string; nomor_invoice: string; kode_program: string; nsfp: string; tarif_ppn: string; tanggal_jatuh_tempo: string };
type ReceiptForm = { rekening_id: string; tanggal_transaksi: string; nominal: string; referensi_bank: string; nama_pengirim: string; keterangan: string };
type AlokasiRow = { ro_id: string; kode_program: string; mak_id: string; nominal: string; keterangan: string };
type AlokasiRowRequest = { ro_id?: string; mak_id?: string; kode_program?: string; nominal: number; keterangan?: string };
type PeriodFilter = { tahun: string; mode: "tahun" | "bulan" | "triwulan"; bulan: string; triwulan: string };
type PostingForm = { no_posting: string; tanggal_posting: string; catatan: string };
type SelisihForm = { jenis: "KURANG" | "LEBIH"; nominal: string; alasan: string; nomor_bukti: string };
type CancelForm = { alasan_pembatalan: string };
type CreateMutasiBankDto = {
  rekening_id: string;
  tanggal_transaksi: string;
  nominal: number;
  referensi_bank: string;
  nama_pengirim?: string;
  keterangan?: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const blankInvoice = (): InvoiceForm => ({ termin_id: "", retail_job_id: "", nomor_invoice: "", kode_program: "", nsfp: "", tarif_ppn: "12", tanggal_jatuh_tempo: "" });
const blankReceipt = (): ReceiptForm => ({ rekening_id: "", tanggal_transaksi: today(), nominal: "", referensi_bank: "", nama_pengirim: "", keterangan: "" });
const blankPosting = (): PostingForm => ({ no_posting: "", tanggal_posting: today(), catatan: "" });
const blankCancel = (): CancelForm => ({ alasan_pembatalan: "" });
const currentYear = () => new Date().getFullYear();
const bulanLabels = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  DITERBITKAN: "Diterbitkan",
  SEBAGIAN_DIBAYAR: "Sebagian Dibayar",
  LUNAS: "Lunas",
  DIBATALKAN: "Dibatalkan",
};
const mutasiStatusLabels: Record<string, string> = {
  BELUM_DICOCOKKAN: "Belum dicocokkan",
  COCOK_SEBAGIAN: "Cocok sebagian",
  COCOK: "Cocok",
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
  const normalized = path
    .replace(/^\/+/, "")
    .replace(/^uploads\//, "")
    .replace(/^api\//, "");
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/${normalized.startsWith("uploaded/") ? normalized : `uploaded/${normalized}`}`;
};
const date = (value: unknown) => (typeof value === "string" ? new Date(value).toLocaleDateString("id-ID") : "—");
const sourceLabel = (row: Row) => {
  const termin = nested(row, "termin");
  const project = nested(termin ?? {}, "proyek");
  const retail = nested(row, "retail_job");
  if (project) return `${String(project.no_kontrak ?? "")} · ${String(project.nama_proyek ?? "Proyek")} · Termin ${String(termin?.nomor_termin ?? "")}`;
  if (retail) return `${String(retail.nomor_job ?? "")} · ${String(retail.nama_pelanggan ?? "Retail")} · LHU ${String(retail.nomor_lhu ?? "—")}`;
  return "—";
};
/**
 * Cerminan `hitungPajakPenerimaan` backend: netto -> DPP (nilai lain 11/12) ->
 * PPN (tarif%) -> bruto. Dipakai hanya untuk pratinjau di form.
 */
function hitungPajak(netto: number, tarifPpn: number) {
  const dpp = Math.round((netto * 11) / 12);
  const ppn = Math.round((dpp * tarifPpn) / 100);
  return { netto, dpp, ppn, bruto: netto + ppn };
}
const invoiceNetto = (row: Row) => Number(row.netto ?? row.nominal ?? 0);
const invoiceBruto = (row: Row) => {
  const netto = invoiceNetto(row);
  return row.bruto === undefined || row.bruto === null ? netto : Number(row.bruto);
};
/**
 * Porsi netto dari nominal transfer yang dicatat Bendahara. Cerminan
 * `pecahPembayaranInvoice()` di backend: netto diakui proporsional terhadap
 * komposisi sisa tagihan (netto sisa : bruto sisa), sisanya PPN titipan.
 */
function sisaTagihan(row: Row) {
  const nettoTotal = invoiceNetto(row);
  const nettoTersisa = Math.max(0, nettoTotal - Number(row.nominal_dibayar ?? 0));
  const ppnTotal = Number(row.ppn ?? 0);
  // PPN sisa dihitung proporsional terhadap netto sisa (sama seperti backend).
  const ppnTersisa = Number(row.nominal_bruto ?? 0) <= 0 || nettoTotal <= 0 || nettoTersisa <= 0 ? 0 : Math.min(ppnTotal, Math.round((ppnTotal * nettoTersisa) / nettoTotal));
  return { nettoTersisa, ppnTersisa, brutoTersisa: nettoTersisa + ppnTersisa };
}
function nettoDiterima(row: Row, amount: number) {
  const { nettoTersisa, brutoTersisa } = sisaTagihan(row);
  if (amount >= brutoTersisa || brutoTersisa <= 0) {
    return Math.max(0, Math.min(amount, nettoTersisa));
  }
  return Math.max(0, Math.min(nettoTersisa, Math.round((amount * nettoTersisa) / brutoTersisa)));
}
/** Identitas satker BLU LEMIGAS, dipakai pada header kwitansi dan laporan. */
const SATKER = {
  nama: "Balai Besar Pengujian Minyak dan Gas Bumi LEMIGAS",
  kode_satker: "620041",
  nomor_dipa: "020-14.1.620041/2026",
  npwp: "0615510807013000",
  rekening_idr_display: "101 000 2727 772",
  rekening_idr_nama: "RPL 019 BLU LEMIGAS",
  bank: "Bank Mandiri",
  klausul_pph: "BLU LEMIGAS bukan Subjek PPh/Seluruh Penerimaan PNBP tidak dipotong PPh (UU PPh No. 36 Th. 2008 Pasal 2 ayat 3 butir b).",
  klausul_kwitansi: "Kwitansi ini sah jika sudah ada bukti pembayaran ke Rekening LEMIGAS",
  batas_e_meterai: 5_000_000,
  e_meterai: 10_000,
} as const;
const triwulanLabels = ["I", "II", "III", "IV"];
const blankPeriod = (): PeriodFilter => ({ tahun: String(new Date().getFullYear()), mode: "bulan", bulan: String(new Date().getMonth() + 1), triwulan: "1" });
/** Menerjemahkan filter periode UI menjadi query params laporan backend. */
const periodParams = (period: PeriodFilter) => ({
  tahun: period.tahun ? Number(period.tahun) : undefined,
  bulan: period.mode === "bulan" ? Number(period.bulan) : undefined,
  triwulan: period.mode === "triwulan" ? Number(period.triwulan) : undefined,
});
const periodLabel = (period: PeriodFilter) => {
  if (!period.tahun) return "Seluruh periode";
  if (period.mode === "bulan") return `Bulan ${bulanLabels[Number(period.bulan) - 1] ?? period.bulan} ${period.tahun}`;
  if (period.mode === "triwulan") return `Triwulan ${triwulanLabels[Number(period.triwulan) - 1] ?? period.triwulan} ${period.tahun}`;
  return `Tahun ${period.tahun}`;
};
/** Unduh berkas Excel laporan yang memerlukan header Authorization. */
async function downloadReport(path: string, params: Record<string, unknown>, fallbackName: string) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const token = getBrowserToken();
  const response = await fetch(`${base}${path}${query.toString() ? `?${query.toString()}` : ""}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(`Ekspor gagal (HTTP ${response.status}).`);
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackName;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function InvoicePageClient() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"invoice" | "rekap" | "mutasi" | "laporan">("invoice");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const [diposting, setDiposting] = useState("__all");
  const [mutasiSearch, setMutasiSearch] = useState("");
  const [mutasiRekening, setMutasiRekening] = useState("__all");
  const [mutasiStatus, setMutasiStatus] = useState("__all");
  const [rekapTahun, setRekapTahun] = useState(String(currentYear()));
  const [rekapBulan, setRekapBulan] = useState("__all");
  const [reportTab, setReportTab] = useState<"sptj" | "realisasi">("sptj");
  const [reportPeriod, setReportPeriod] = useState<PeriodFilter>(blankPeriod);
  const [exporting, setExporting] = useState("");
  const [creating, setCreating] = useState(false);
  const [invoiceSource, setInvoiceSource] = useState<"project" | "retail">("project");
  const [settling, setSettling] = useState<Row | null>(null);
  const [postingTarget, setPostingTarget] = useState<Row | null>(null);
  const [postingBatchOpen, setPostingBatchOpen] = useState(false);
  const [selisihTarget, setSelisihTarget] = useState<Row | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [selectedPostingIds, setSelectedPostingIds] = useState<string[]>([]);
  const [detailInvoice, setDetailInvoice] = useState<Row | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState("");
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(blankInvoice);
  const [receiptForm, setReceiptForm] = useState<ReceiptForm>(blankReceipt);
  const [receiptProof, setReceiptProof] = useState<File | null>(null);
  const [alokasiRows, setAlokasiRows] = useState<AlokasiRow[]>([]);
  const [postingForm, setPostingForm] = useState<PostingForm>(blankPosting);
  const [selisihForm, setSelisihForm] = useState<SelisihForm>({ jenis: "KURANG", nominal: "", alasan: "", nomor_bukti: "" });
  const [cancelForm, setCancelForm] = useState<CancelForm>(blankCancel);
  const [error, setError] = useState("");
  const user = useCurrentUser();
  const role = user.data?.role?.toLowerCase() ?? "";
  useEffect(() => setMounted(true), []);
  // Seluruh flag berbasis role harus menunggu `mounted` agar render server dan
  // render pertama di klien identik (mencegah React hydration mismatch).
  const canCreate = mounted && ["superadmin", "keuangan", "keu_billing"].includes(role);
  const canSettle = mounted && ["superadmin", "keuangan", "keu_bendahara_pendapatan"].includes(role);
  const canPosting = mounted && ["superadmin", "keu_bendahara_pendapatan"].includes(role);
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
    method: "invoiceListControllerList",
    params: { query: search || undefined, status: status === "__all" ? undefined : status, diposting: diposting === "__all" ? undefined : diposting, limit: 100, page: 1 },
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceListControllerList(params, { format: "json" }));
    },
  });
  const rows = useMemo(() => listRows(listQuery.data), [listQuery.data]);
  const postingReadyQuery = use_query({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoicePostingControllerSiapPosting",
    params: {
      tahun: rekapTahun ? Number(rekapTahun) : undefined,
      bulan: rekapBulan === "__all" ? undefined : Number(rekapBulan),
    },
    enabled: canPosting && (postingBatchOpen || view === "rekap"),
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoicePostingControllerSiapPosting(params, { format: "json" }));
    },
  });
  const postingReady = payload(postingReadyQuery.data);
  const postingReadyRows = useMemo(() => listRows(postingReady.list), [postingReady.list]);
  const summaryQuery = use_query({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceSummaryControllerSummary",
    params: { tahun: rekapTahun ? Number(rekapTahun) : undefined, bulan: rekapBulan === "__all" ? undefined : Number(rekapBulan) },
    enabled: view === "rekap" || view === "invoice",
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceSummaryControllerSummary(params, { format: "json" }));
    },
  });
  const rekap = payload(summaryQuery.data);
  const titipanPpnQuery = use_query({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceTitipanPpnControllerTitipanPpn",
    params: { tahun: rekapTahun ? Number(rekapTahun) : undefined, bulan: rekapBulan === "__all" ? undefined : Number(rekapBulan) },
    enabled: view === "rekap",
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceTitipanPpnControllerTitipanPpn(params as { tahun?: number; bulan?: number }, { format: "json" }));
    },
  });
  const titipanPpn = payload(titipanPpnQuery.data);
  const titipanPpnPerProgram = Array.isArray(titipanPpn.per_program) ? (titipanPpn.per_program as Row[]) : [];
  // Laporan resmi Bendahara Penerimaan (SPTJ & Realisasi per MAP).
  const reportParams = useMemo(() => periodParams(reportPeriod), [reportPeriod]);
  const sptjQuery = use_query({
    tag: "keuanganLaporanPenerimaan",
    method: "invoiceReportControllerSptj",
    params: reportParams,
    enabled: view === "laporan" && reportTab === "sptj",
    queryFn: async (params) => {
      setBrowserToken();
      const endpoint = browserApi.keuanganLaporanBendaharaPenerimaan.invoiceReportControllerSptj as unknown as (p: typeof reportParams, options: { format: "json" }) => Promise<{ data: unknown }>;
      return apiData(endpoint(params, { format: "json" }));
    },
  });
  const sptj = payload(sptjQuery.data);
  const sptjRows = useMemo(() => listRows(sptj.baris), [sptj.baris]);
  const sptjKelompok = Array.isArray(sptj.kelompok) ? (sptj.kelompok as Row[]) : [];
  const realisasiQuery = use_query({
    tag: "keuanganLaporanPenerimaan",
    method: "invoiceReportControllerRealisasi",
    params: reportParams,
    enabled: view === "laporan" && reportTab === "realisasi",
    queryFn: async (params) => {
      setBrowserToken();
      const endpoint = browserApi.keuanganLaporanBendaharaPenerimaan.invoiceReportControllerRealisasi as unknown as (p: typeof reportParams, options: { format: "json" }) => Promise<{ data: unknown }>;
      return apiData(endpoint(params, { format: "json" }));
    },
  });
  const realisasi = payload(realisasiQuery.data);
  const realisasiRows = useMemo(() => listRows(realisasi.baris), [realisasi.baris]);
  const realisasiBulan = useMemo(() => (Array.isArray(realisasi.bulan) ? (realisasi.bulan as Row[]) : []), [realisasi.bulan]);
  // MAP (Klasifikasi Pendapatan) untuk split program saat validasi penerimaan.
  const mapQuery = use_query({
    tag: "keuanganLaporanPenerimaan",
    method: "invoiceReportControllerMapPendapatan",
    params: undefined,
    enabled: Boolean(settling) && canSettle,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.keuanganLaporanBendaharaPenerimaan.invoiceReportControllerMapPendapatan({ format: "json" }));
    },
  });
  const mapRows = useMemo(() => listRows(mapQuery.data), [mapQuery.data]);
  const mapOptions = useMemo(() => mapRows.map((item) => ({ value: String(item.id), label: `${String(item.kode_mak ?? "—")} · ${String(item.nama_mak ?? "MAP")}` })), [mapRows]);
  const mutasiQuery = use_query({
    tag: "keuanganMutasiBank",
    method: "mutasiBankListControllerList",
    params: { query: mutasiSearch || undefined, rekening_id: mutasiRekening === "__all" ? undefined : mutasiRekening, status: mutasiStatus === "__all" ? undefined : mutasiStatus, limit: 100, page: 1 },
    enabled: view === "mutasi",
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.mutasiBankListControllerList(params, { format: "json" }));
    },
  });
  const mutasiRows = useMemo(() => listRows(mutasiQuery.data), [mutasiQuery.data]);
  useEffect(() => {
    if (!canSettle || listQuery.isLoading || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const invoiceId = url.searchParams.get("settleInvoiceId");
    if (!invoiceId) return;
    const invoice = rows.find((row) => String(row.id) === invoiceId);
    if (invoice && ["DITERBITKAN", "SEBAGIAN_DIBAYAR"].includes(String(invoice.status))) {
      setSettling(invoice);
      setReceiptForm({ ...blankReceipt(), nominal: String(sisaTagihan(invoice).brutoTersisa) });
      setAlokasiRows([]);
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
    method: "proyekGetTerminQueueControllerGetTerminQueue",
    params: { page: 1, limit: 100 },
    enabled: creating && canCreate,
    queryFn: async () => {
      setBrowserToken();
      const endpoint = browserApi.masterProyek.proyekGetTerminQueueControllerGetTerminQueue as unknown as (params: { query: { page: number; limit: number }; format: "json" }) => Promise<{ data: unknown }>;
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
  const retailJobOptions = useMemo(
    () =>
      retailJobRows.map((item) => ({
        value: String(item.id),
        label: `${String(item.nomor_job ?? "Job retail")} · ${String(item.nama_pelanggan ?? "Klien")} · LHU ${String(item.nomor_lhu ?? "—")} · ${formatRupiah(item.nilai_layanan)}`,
      })),
    [retailJobRows],
  );
  // Pratinjau pajak dari nilai tagihan netto termin/job retail terpilih.
  const invoicePreview = useMemo(() => {
    const netto =
      invoiceSource === "retail" ? Number(retailJobRows.find((item) => String(item.id) === invoiceForm.retail_job_id)?.nilai_layanan ?? 0) : Number(terminRows.find((item) => String(item.id) === invoiceForm.termin_id)?.nilai_termin ?? 0);
    if (!netto) return null;
    const tarif = invoiceForm.tarif_ppn.trim() === "" ? 12 : Number(invoiceForm.tarif_ppn);
    if (!Number.isFinite(tarif)) return null;
    return hitungPajak(netto, tarif);
  }, [invoiceForm.retail_job_id, invoiceForm.tarif_ppn, invoiceForm.termin_id, invoiceSource, retailJobRows, terminRows]);
  // RO/MAK yang boleh menerima alokasi netto pada invoice yang sedang disettle.
  const settlingRoOptions = useMemo(() => {
    if (!settling) return [] as { value: string; label: string }[];
    const project = nested(nested(settling, "termin") ?? {}, "proyek");
    const roList = Array.isArray(project?.ro_list) ? (project!.ro_list as Row[]) : [];
    const retailJob = nested(settling, "retail_job");
    const retailRo = retailJob ? nested(retailJob, "ro") : undefined;
    const ros = roList.length ? roList.filter((ro) => ro.tipe_ro !== "RETAIL") : retailRo ? [retailRo] : [];
    return ros.map((ro) => ({
      value: String(ro.id),
      label: [String(ro.kode_ro ?? "RO"), String(nested(ro, "mak")?.nama_mak ?? "MAK belum ditetapkan"), `pagu ${formatRupiah(ro.total_plafon ?? ro.nilai_rencana ?? 0)}`].join(" · "),
    }));
  }, [settling]);
  const accountsQuery = use_query({
    tag: "masterRekeningBank",
    method: "masterRekeningFindAllControllerFindAll",
    params: undefined,
    enabled: (Boolean(settling) && canSettle) || view === "mutasi",
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterRekeningBank.masterRekeningFindAllControllerFindAll({ format: "json" }));
    },
  });
  const accounts = listRows(accountsQuery.data).length
    ? listRows(accountsQuery.data)
    : (() => {
        const item = payload(accountsQuery.data);
        return Array.isArray(item) ? item : [];
      })();
  const accountOptions = useMemo(
    () =>
      accounts.map((item) => ({
        value: String(item.id),
        label: [item.nama_bank, item.nomor_rekening, item.nama_rekening].filter(Boolean).join(" · ") || "Rekening bank",
      })),
    [accounts],
  );
  const invalidate = [apiQueryKeys.resource("keuanganInvoiceDanSettlement"), apiQueryKeys.resource("keuanganMutasiBank"), apiQueryKeys.resource("retail")];
  const createMutation = use_mutation<unknown, Error, CreateInvoiceDto>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceCreateInvoiceControllerCreateInvoice",
    invalidateKeys: invalidate,
    mutationFn: async (data) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceCreateInvoiceControllerCreateInvoice(data, { format: "json" }));
    },
    onSuccess: () => {
      setCreating(false);
      setInvoiceForm(blankInvoice());
      setError("");
    },
  });
  const receiptMutation = use_mutation<unknown, Error, { mutasi: CreateMutasiBankDto; invoiceId: string; payment: { nominal: number; catatan?: string; izinkan_selisih?: boolean; alokasi?: AlokasiRowRequest[] }; proof: File }>({
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
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceBayarControllerBayar(invoiceId, { ...payment, mutasi_bank_id: mutationId } as unknown as BayarInvoiceDto, { format: "json" }));
    },
    onSuccess: () => {
      setSettling(null);
      setReceiptForm(blankReceipt());
      setReceiptProof(null);
      setError("");
    },
  });
  const postingMutation = use_mutation<unknown, Error, { invoiceId: string; body: PostingForm }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoicePostingControllerPosting",
    invalidateKeys: invalidate,
    mutationFn: async ({ invoiceId, body }) => {
      setBrowserToken();
      return apiData(
        browserApi.keuanganInvoiceDanSettlement.invoicePostingControllerPosting(
          invoiceId,
          {
            ...(body.no_posting ? { no_posting: body.no_posting } : {}),
            ...(body.tanggal_posting ? { tanggal_posting: body.tanggal_posting } : {}),
            ...(body.catatan ? { catatan: body.catatan } : {}),
          },
          { format: "json" },
        ),
      );
    },
    onSuccess: () => {
      setPostingTarget(null);
      setPostingForm(blankPosting());
      setError("");
    },
  });
  const postingBatchMutation = use_mutation<unknown, Error, { invoice_ids: string[]; body: PostingForm }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoicePostingControllerPostingBatch",
    invalidateKeys: invalidate,
    mutationFn: async ({ invoice_ids, body }) => {
      setBrowserToken();
      return apiData(
        browserApi.keuanganInvoiceDanSettlement.invoicePostingControllerPostingBatch(
          {
            invoice_ids,
            ...(body.no_posting ? { no_posting: body.no_posting } : {}),
            ...(body.tanggal_posting ? { tanggal_posting: body.tanggal_posting } : {}),
            ...(body.catatan ? { catatan: body.catatan } : {}),
          },
          { format: "json" },
        ),
      );
    },
    onSuccess: () => {
      setPostingBatchOpen(false);
      setPostingForm(blankPosting());
      setSelectedPostingIds([]);
      setError("");
    },
  });
  const selisihMutation = use_mutation<unknown, Error, { invoiceId: string; body: SelisihForm }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoicePostingControllerSelesaikanSelisih",
    invalidateKeys: invalidate,
    mutationFn: async ({ invoiceId, body }) => {
      setBrowserToken();
      return apiData(
        browserApi.keuanganInvoiceDanSettlement.invoicePostingControllerSelesaikanSelisih(
          invoiceId,
          {
            jenis: body.jenis,
            ...(body.nominal ? { nominal: Number(body.nominal) } : {}),
            alasan: body.alasan,
            ...(body.nomor_bukti ? { nomor_bukti: body.nomor_bukti } : {}),
          },
          { format: "json" },
        ),
      );
    },
    onSuccess: () => {
      setSelisihTarget(null);
      setSelisihForm({ jenis: "KURANG", nominal: "", alasan: "", nomor_bukti: "" });
      setError("");
    },
  });
  const cancelMutation = use_mutation<unknown, Error, { invoiceId: string; body: CancelForm }>({
    tag: "keuanganInvoiceDanSettlement",
    method: "invoiceCancelControllerBatal",
    invalidateKeys: invalidate,
    mutationFn: async ({ invoiceId, body }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganInvoiceDanSettlement.invoiceCancelControllerBatal(invoiceId, { alasan_pembatalan: body.alasan_pembatalan }, { format: "json" }));
    },
    onSuccess: () => {
      setCancelTarget(null);
      setCancelForm(blankCancel());
      setError("");
    },
  });
  async function openDetail(row: Row) {
    setDetailInvoice(row);
    setDetailLoadingId(String(row.id));
    setError("");
    try {
      const fresh = await requestHrisApi<unknown>(`/api/keuangan/invoice/detail/${String(row.id)}`);
      const data = payload(fresh);
      if (data && data.id) setDetailInvoice(data);
    } catch {
      // Daftar sudah menyertakan sebagian besar relasi; detail hanya memperkaya data.
    } finally {
      setDetailLoadingId("");
    }
  }
  async function createInvoice() {
    const sourceId = invoiceSource === "retail" ? invoiceForm.retail_job_id : invoiceForm.termin_id;
    if (!sourceId) {
      setError(`${invoiceSource === "retail" ? "Job retail" : "Termin"} wajib dipilih.`);
      return;
    }
    const tarifPpn = invoiceForm.tarif_ppn.trim() === "" ? 12 : Number(invoiceForm.tarif_ppn);
    if (!Number.isFinite(tarifPpn) || tarifPpn < 0 || tarifPpn > 100) {
      setError("Tarif PPN harus berupa angka 0-100.");
      return;
    }
    const nsfp = invoiceForm.nsfp.replace(/\D/g, "");
    if (nsfp && nsfp.length !== 17) {
      setError("NSFP Coretax harus 17 digit angka (mis. 04002600420989765).");
      return;
    }
    try {
      setError("");
      const shared = {
        nomor_invoice: invoiceForm.nomor_invoice.trim() || undefined,
        kode_program: invoiceForm.kode_program.trim() || undefined,
        ...(nsfp ? { nsfp } : {}),
        tarif_ppn: tarifPpn,
        tanggal_terbit: today(),
        tanggal_jatuh_tempo: invoiceForm.tanggal_jatuh_tempo || undefined,
      };
      await createMutation.mutateAsync(
        invoiceSource === "retail"
          ? ({ jenis: "RETAIL", retail_job_id: invoiceForm.retail_job_id, ...shared } as unknown as CreateInvoiceDto)
          : ({ jenis: "PROYEK", termin_id: invoiceForm.termin_id, ...shared } as unknown as CreateInvoiceDto),
      );
    } catch (cause) {
      setError(apiErrorMessage(cause, "Invoice gagal dibuat."));
    }
  }
  async function settle() {
    if (!settling) return;
    const amount = Number(receiptForm.nominal);
    // Netto yang masih tertagih (nominal invoice) selalu netto; sisa bank
    // memakai bruto karena mutasi berisi netto + PPN.
    const { brutoTersisa } = sisaTagihan(settling);
    if (!receiptForm.rekening_id || !receiptForm.tanggal_transaksi || !receiptForm.referensi_bank.trim() || !receiptProof || amount <= 0) {
      setError("Rekening, tanggal, referensi bank, bukti penerimaan, dan nominal positif wajib diisi.");
      return;
    }
    if (receiptProof.size > 10 * 1024 * 1024) {
      setError("Ukuran bukti penerimaan maksimal 10 MB.");
      return;
    }
    const izinkanSelisih = amount !== brutoTersisa;
    // Alokasi manual (opsional) harus tepat menjumlah netto yang diterima.
    const nettoPortion = nettoDiterima(settling, amount);
    const alokasi = alokasiRows
      .filter((row) => Number(row.nominal) > 0 && Boolean(row.ro_id || row.mak_id || row.kode_program.trim()))
      .map((row) => ({
        ...(row.ro_id ? { ro_id: row.ro_id } : {}),
        nominal: Number(row.nominal),
        ...(row.kode_program.trim() ? { kode_program: row.kode_program.trim() } : {}),
        ...(row.mak_id ? { mak_id: row.mak_id } : {}),
        ...(row.keterangan.trim() ? { keterangan: row.keterangan.trim() } : {}),
      }));
    if (alokasi.length) {
      const total = alokasi.reduce((sum, row) => sum + row.nominal, 0);
      if (total !== nettoPortion) {
        setError(`Total alokasi ${formatRupiah(total)} harus sama dengan netto diterima ${formatRupiah(nettoPortion)}.`);
        return;
      }
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
        payment: {
          nominal: amount,
          catatan: receiptForm.keterangan.trim() || undefined,
          ...(alokasi.length ? { alokasi } : {}),
          ...(izinkanSelisih ? { izinkan_selisih: true } : {}),
        },
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Penerimaan invoice gagal disimpan."));
    }
  }
  async function submitPosting() {
    if (!postingTarget) return;
    try {
      setError("");
      await postingMutation.mutateAsync({ invoiceId: String(postingTarget.id), body: postingForm });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Posting invoice gagal disimpan."));
    }
  }
  async function submitPostingBatch() {
    if (!selectedPostingIds.length) {
      setError("Pilih minimal satu invoice untuk diposting.");
      return;
    }
    try {
      setError("");
      await postingBatchMutation.mutateAsync({ invoice_ids: selectedPostingIds, body: postingForm });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Posting batch gagal disimpan."));
    }
  }
  async function submitSelisih() {
    if (!selisihTarget) return;
    if (!selisihForm.alasan.trim()) {
      setError("Alasan penyelesaian selisih wajib diisi.");
      return;
    }
    try {
      setError("");
      await selisihMutation.mutateAsync({ invoiceId: String(selisihTarget.id), body: selisihForm });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Penyelesaian selisih gagal disimpan."));
    }
  }
  async function submitCancel() {
    if (!cancelTarget) return;
    if (!cancelForm.alasan_pembatalan.trim()) {
      setError("Alasan pembatalan invoice wajib diisi.");
      return;
    }
    try {
      setError("");
      await cancelMutation.mutateAsync({ invoiceId: String(cancelTarget.id), body: cancelForm });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pembatalan invoice gagal disimpan."));
    }
  }
  const postingRowsUnposted = rows.filter((row) => String(row.status) === "LUNAS" && !row.diposting_pada);
  const tabs = [
    { id: "invoice" as const, label: "Daftar Invoice", count: rows.length },
    { id: "rekap" as const, label: "Rekap Bulanan", count: Number(rekap?.ringkasan?.total_invoice ?? 0) },
    { id: "mutasi" as const, label: "Mutasi Bank", count: mutasiRows.length },
    { id: "laporan" as const, label: "Laporan Penerimaan", count: sptjRows.length + realisasiRows.length },
  ];
  const modalOpen = creating || Boolean(settling) || Boolean(postingTarget) || postingBatchOpen || Boolean(selisihTarget) || Boolean(cancelTarget);

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="mt-1 text-sm text-muted-foreground">Billing menerbitkan invoice sebagai piutang. Bendahara mencatat pembayaran setelah dana masuk ke rekening, lalu memposting lunas sebagai bukti pembukuan.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPosting && (
            <Button
              variant="outline"
              onClick={() => {
                setPostingForm({ ...blankPosting(), tanggal_posting: today() });
                setSelectedPostingIds([]);
                setError("");
                setPostingBatchOpen(true);
              }}
            >
              <FileCheck2 size={17} /> Posting Lunas
              {postingRowsUnposted.length ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">{postingRowsUnposted.length}</span> : null}
            </Button>
          )}
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
        </div>
      </header>
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Tampilan invoice">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={view === tab.id}
            onClick={() => {
              setView(tab.id);
              setError("");
            }}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {tab.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${view === tab.id ? "bg-slate-100 text-slate-700" : "bg-white/70 text-slate-500"}`}>{tab.count}</span>
          </button>
        ))}
      </div>
      {error && !modalOpen && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {view === "invoice" && (
        <Card>
          <CardContent className="pt-4">
            {listQuery.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Memuat invoice…</p>}
            {listQuery.isError && (
              <EmptyData
                label="Daftar invoice belum dapat dimuat."
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                    Coba lagi
                  </Button>
                }
              />
            )}
            {!listQuery.isLoading && !listQuery.isError && (
              <DataTable
                rows={rows}
                rowKey={(row, index) => String(row.id ?? index)}
                remoteSearch
                searchValue={search}
                searchPlaceholder="Cari nomor invoice…"
                onSearchChange={setSearch}
                filters={[
                  { field: "status", label: "Status", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
                  {
                    field: "diposting",
                    label: "Posting",
                    options: [
                      { value: "sudah", label: "Sudah diposting" },
                      { value: "belum", label: "Belum diposting" },
                    ],
                  },
                ]}
                filterValues={{ status, diposting }}
                onFilterChange={(field, value) => (field === "diposting" ? setDiposting(value) : setStatus(value))}
                columns={[
                  { key: "nomor_invoice", header: "Nomor Invoice", render: (row) => row.nomor_invoice ?? "—" },
                  { key: "sumber", header: "Proyek / Job", render: (row) => sourceLabel(row) },
                  { key: "tanggal_terbit", header: "Terbit", render: (row) => date(row.tanggal_terbit) },
                  { key: "nominal", header: "Netto (PNBP)", render: (row) => formatRupiah(invoiceNetto(row)) },
                  {
                    key: "bruto",
                    header: "Bruto (transfer)",
                    render: (row) => {
                      const bruto = invoiceBruto(row);
                      const ppn = Number(row.ppn ?? 0);
                      return (
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium tabular-nums">{formatRupiah(bruto)}</span>
                          {ppn > 0 ? <span className="text-xs text-muted-foreground">PPN {formatRupiah(ppn)}</span> : null}
                        </span>
                      );
                    },
                  },
                  { key: "nominal_dibayar", header: "Dibayar (netto)", render: (row) => formatRupiah(row.nominal_dibayar) },
                  {
                    key: "selisih",
                    header: "Selisih",
                    render: (row) => {
                      const kurang = Number(row.nilai_kurang_bayar ?? 0);
                      const lebih = Number(row.nilai_lebih_bayar ?? 0);
                      if (!kurang && !lebih) return <span className="text-muted-foreground">—</span>;
                      return (
                        <span className="flex flex-col gap-0.5 text-xs">
                          {kurang ? <span className="font-medium text-amber-700">Kurang {formatRupiah(kurang)}</span> : null}
                          {lebih ? <span className="font-medium text-sky-700">Lebih {formatRupiah(lebih)}</span> : null}
                        </span>
                      );
                    },
                  },
                  {
                    key: "posting",
                    header: "Posting",
                    render: (row) =>
                      row.diposting_pada ? (
                        <span className="flex flex-col gap-0.5 text-xs">
                          <span className="font-medium">{String(row.no_posting ?? "—")}</span>
                          <span className="text-muted-foreground">{date(row.diposting_pada)}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{String(row.status) === "LUNAS" ? "Menunggu posting" : "—"}</span>
                      ),
                  },
                  { key: "status", header: "Status", render: (row) => statusLabels[row.status] ?? row.status ?? "—" },
                  {
                    key: "aksi",
                    header: "Aksi",
                    render: (row: Row) => (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void openDetail(row)}>
                          <Eye size={14} /> Detail
                        </Button>
                        {canSettle && ["DITERBITKAN", "SEBAGIAN_DIBAYAR"].includes(String(row.status)) && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSettling(row);
                              setReceiptForm({ ...blankReceipt(), nominal: String(sisaTagihan(row).brutoTersisa) });
                              setAlokasiRows([]);
                              setReceiptProof(null);
                              setError("");
                            }}
                          >
                            <CircleDollarSign size={15} /> Terima
                          </Button>
                        )}
                        {canPosting && String(row.status) === "LUNAS" && !row.diposting_pada && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPostingTarget(row);
                              setPostingForm({ ...blankPosting(), tanggal_posting: today() });
                              setError("");
                            }}
                          >
                            <FileCheck2 size={15} /> Posting
                          </Button>
                        )}
                        {canPosting && (Number(row.nilai_kurang_bayar ?? 0) > 0 || Number(row.nilai_lebih_bayar ?? 0) > 0) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelisihTarget(row);
                              setSelisihForm({
                                jenis: Number(row.nilai_kurang_bayar ?? 0) > 0 ? "KURANG" : "LEBIH",
                                nominal: "",
                                alasan: "",
                                nomor_bukti: "",
                              });
                              setError("");
                            }}
                          >
                            <Scale size={15} /> Selisih
                          </Button>
                        )}
                        {canPosting && ["DRAFT", "DITERBITKAN"].includes(String(row.status)) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCancelTarget(row);
                              setCancelForm(blankCancel());
                              setError("");
                            }}
                          >
                            <Ban size={15} /> Batalkan
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
      )}
      {view === "rekap" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-4">
              <label className="grid gap-1 text-sm">
                Tahun
                <Input type="number" min={2000} max={2200} className="w-32" value={rekapTahun} onChange={(event) => setRekapTahun(event.target.value)} />
              </label>
              <label className="grid gap-1 text-sm">
                Bulan
                <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={rekapBulan} onChange={(event) => setRekapBulan(event.target.value)}>
                  <option value="__all">Seluruh tahun</option>
                  {bulanLabels.map((label, index) => (
                    <option key={label} value={String(index + 1)}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <ReceiptText size={15} /> Rekap validasi penerimaan per periode.
              </div>
            </CardContent>
          </Card>
          {summaryQuery.isLoading && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Memuat rekap…</CardContent>
            </Card>
          )}
          {summaryQuery.isError && (
            <EmptyData
              label="Rekap penerimaan belum dapat dimuat."
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => void summaryQuery.refetch()}>
                  Coba lagi
                </Button>
              }
            />
          )}
          {!summaryQuery.isLoading && !summaryQuery.isError && (
            <>
              <Card>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <h2 className="text-sm font-semibold">Ringkasan penerimaan</h2>
                    <p className="text-xs text-muted-foreground">
                      {rekap?.periode?.bulan ? `${bulanLabels[Number(rekap.periode.bulan) - 1]} ${String(rekap.periode.tahun ?? rekapTahun)}` : `Tahun ${String(rekap?.periode?.tahun ?? rekapTahun)}`}
                    </p>
                  </div>
                  <MoneyFlow
                    items={[
                      { label: "Total tagihan", amount: rekap?.ringkasan?.total_tagihan },
                      { label: "Tervalidasi", amount: rekap?.ringkasan?.total_tervalidasi, operator: "−", tone: "text-sky-700" },
                      { label: "Sisa piutang", amount: rekap?.ringkasan?.sisa_piutang, operator: "=", tone: Number(rekap?.ringkasan?.sisa_piutang ?? 0) > 0 ? "text-amber-700" : "text-emerald-700" },
                    ]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                      [
                        ["Jumlah invoice", String(rekap?.ringkasan?.total_invoice ?? 0)],
                        ["Kurang bayar tercatat", formatRupiah(rekap?.ringkasan?.total_kurang_bayar)],
                        ["Lebih bayar tercatat", formatRupiah(rekap?.ringkasan?.total_lebih_bayar)],
                        ["Menunggu posting", `${String(rekap?.posting?.menunggu_posting ?? 0)} invoice`],
                      ] as Array<[string, string]>
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-white px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <h2 className="text-sm font-semibold">Status posting lunas</h2>
                    <p className="text-xs text-muted-foreground">Invoice LUNAS yang belum diposting belum tercatat sebagai bukti pembukuan.</p>
                  </div>
                  <MoneyFlow
                    items={[
                      { label: "Sudah diposting", amount: rekap?.posting?.nominal_sudah_diposting, tone: "text-emerald-700" },
                      { label: "Menunggu posting", amount: rekap?.posting?.nominal_menunggu_posting, operator: "+", tone: Number(rekap?.posting?.menunggu_posting ?? 0) > 0 ? "text-amber-700" : "text-foreground" },
                      { label: "Total tervalidasi", amount: rekap?.ringkasan?.total_tervalidasi, operator: "=" },
                    ]}
                  />
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["Invoice sudah diposting", `${String(rekap?.posting?.sudah_diposting ?? 0)} invoice`],
                        ["Invoice menunggu posting", `${String(rekap?.posting?.menunggu_posting ?? 0)} invoice`],
                        ["Jumlah invoice periode", String(rekap?.ringkasan?.total_invoice ?? 0)],
                      ] as Array<[string, string]>
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-md border bg-white px-3 py-2.5">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-4">
                  <div>
                    <h2 className="text-sm font-semibold">PPN titipan penerimaan</h2>
                    <p className="text-xs text-muted-foreground">PPN yang sudah dipungut dari penerimaan dan belum disetorkan ke kas negara. Beban PPN dititipkan, bukan penerimaan PNBP.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border bg-white px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Total PPN titipan</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{formatRupiah(titipanPpn.total_ppn_titipan)}</p>
                    </div>
                    <div className="rounded-md border bg-white px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Jumlah penerimaan ber-PPN</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{String(titipanPpnPerProgram.reduce((sum, row) => sum + Number(row.jumlah ?? 0), 0))} transaksi</p>
                    </div>
                    <div className="rounded-md border bg-white px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">Kode program terlibat</p>
                      <p className="mt-1 text-sm font-semibold tabular-nums">{String(titipanPpnPerProgram.length)} program</p>
                    </div>
                  </div>
                  {titipanPpnPerProgram.length ? (
                    <div className="overflow-x-auto rounded-md border bg-white">
                      <table className="w-full min-w-[24rem] text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="p-2.5">Kode program</th>
                            <th className="p-2.5 text-right">Transaksi</th>
                            <th className="p-2.5 text-right">PPN titipan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {titipanPpnPerProgram.map((row) => (
                            <tr key={String(row.kode_program)} className="border-t">
                              <td className="p-2.5">{String(row.kode_program ?? "—")}</td>
                              <td className="p-2.5 text-right tabular-nums">{String(row.jumlah ?? 0)}</td>
                              <td className="p-2.5 text-right font-medium tabular-nums">{formatRupiah(row.nominal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Belum ada PPN titipan pada periode ini.</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Ekspor resmi SPTJ dan Laporan Realisasi Penerimaan tersedia pada tab Laporan Penerimaan.</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReportPeriod({ tahun: rekapTahun, mode: rekapBulan === "__all" ? "tahun" : "bulan", bulan: rekapBulan === "__all" ? "1" : rekapBulan, triwulan: "1" });
                        setReportTab("sptj");
                        setView("laporan");
                      }}
                    >
                      <ReceiptText size={14} /> Buka laporan
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold">Rincian per status invoice</h2>
                    <p className="text-xs text-muted-foreground">Nilai tagihan dan yang sudah divalidasi untuk setiap status.</p>
                  </div>
                  <div className="overflow-x-auto rounded-md border bg-white">
                    <table className="w-full min-w-[32rem] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5 text-right">Jumlah invoice</th>
                          <th className="p-2.5 text-right">Nilai tagihan</th>
                          <th className="p-2.5 text-right">Tervalidasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(rekap?.per_status) ? (rekap.per_status as Row[]) : []).map((row) => (
                          <tr key={String(row.status)} className="border-t">
                            <td className="p-2.5">{statusLabels[String(row.status)] ?? String(row.status)}</td>
                            <td className="p-2.5 text-right tabular-nums">{String(row.jumlah ?? 0)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(row.nominal)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(row.nominal_dibayar)}</td>
                          </tr>
                        ))}
                        {!(Array.isArray(rekap?.per_status) && rekap.per_status.length) && (
                          <tr>
                            <td colSpan={4} className="p-3 text-center text-muted-foreground">
                              Belum ada invoice pada periode ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
      {view === "laporan" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <ReceiptText size={15} /> Laporan Bendahara Penerimaan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {SATKER.nama} · Satker {SATKER.kode_satker} · DIPA {SATKER.nomor_dipa}. Dasar penerimaan adalah tanggal validasi mutasi bank; nilai hanya mencakup netto PNBP (PPN titipan tidak diakui sebagai pendapatan).
                  </p>
                </div>
                <div className="flex gap-1 rounded-md border p-0.5">
                  {(
                    [
                      ["sptj", "SPTJ Penerimaan"],
                      ["realisasi", "Realisasi per MAP"],
                    ] as const
                  ).map(([id, label]) => (
                    <Button key={id} type="button" size="sm" variant={reportTab === id ? "default" : "ghost"} onClick={() => setReportTab(id)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="grid gap-1 text-sm">
                  Tahun
                  <Input type="number" min={2000} max={2200} value={reportPeriod.tahun} onChange={(event) => setReportPeriod((current) => ({ ...current, tahun: event.target.value }))} />
                </label>
                <label className="grid gap-1 text-sm">
                  Jenis periode
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={reportPeriod.mode}
                    onChange={(event) => setReportPeriod((current) => ({ ...current, mode: event.target.value as PeriodFilter["mode"] }))}
                  >
                    <option value="tahun">Setahun penuh</option>
                    <option value="bulan">Per bulan</option>
                    <option value="triwulan">Per triwulan</option>
                  </select>
                </label>
                {reportPeriod.mode === "bulan" && (
                  <label className="grid gap-1 text-sm">
                    Bulan
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={reportPeriod.bulan} onChange={(event) => setReportPeriod((current) => ({ ...current, bulan: event.target.value }))}>
                      {bulanLabels.map((label, index) => (
                        <option key={label} value={String(index + 1)}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {reportPeriod.mode === "triwulan" && (
                  <label className="grid gap-1 text-sm">
                    Triwulan
                    <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={reportPeriod.triwulan} onChange={(event) => setReportPeriod((current) => ({ ...current, triwulan: event.target.value }))}>
                      {triwulanLabels.map((label, index) => (
                        <option key={label} value={String(index + 1)}>
                          Triwulan {label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <div className="grid gap-1 text-sm">
                  Berkas
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={exporting !== ""}
                      onClick={async () => {
                        const key = reportTab === "sptj" ? "sptj" : "realisasi";
                        setExporting(key);
                        setError("");
                        try {
                          await downloadReport(reportTab === "sptj" ? "/api/keuangan/laporan/sptj/export" : "/api/keuangan/laporan/realisasi-penerimaan/export", reportParams, `${key}-${reportPeriod.tahun}.xlsx`);
                        } catch (cause) {
                          setError(apiErrorMessage(cause, "Ekspor laporan gagal diunduh."));
                        } finally {
                          setExporting("");
                        }
                      }}
                    >
                      {exporting ? <LoaderCircle className="animate-spin" size={14} /> : <FileCheck2 size={14} />} Unduh Excel
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void (reportTab === "sptj" ? sptjQuery.refetch() : realisasiQuery.refetch())}>
                      <Upload size={14} /> Muat ulang
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Periode aktif: {periodLabel(reportPeriod)}.</p>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          {reportTab === "sptj" ? (
            <>
              <Card>
                <CardContent className="pt-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold">Surat Pertanggungjawaban Penerimaan (SPTJ)</h2>
                      <p className="text-xs text-muted-foreground">Rincian per MAP, dikelompokkan menurut klasifikasi pendapatan.</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total penerimaan (netto)</p>
                      <p className="text-lg font-semibold tabular-nums">{formatRupiah(sptj.total_penerimaan_netto)}</p>
                    </div>
                  </div>
                  {sptjQuery.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Menyusun SPTJ…</p>}
                  {sptjQuery.isError && (
                    <EmptyData
                      label="SPTJ belum dapat dimuat."
                      action={
                        <Button type="button" variant="outline" size="sm" onClick={() => void sptjQuery.refetch()}>
                          Coba lagi
                        </Button>
                      }
                    />
                  )}
                  {!sptjQuery.isLoading && !sptjQuery.isError && (
                    <>
                      {sptjKelompok.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {sptjKelompok.map((group) => (
                            <span key={String(group.map)} className="rounded-md border bg-muted/40 px-2.5 py-1 text-xs">
                              <span className="font-medium">{String(group.map)}</span> · {formatRupiah(group.nominal)}
                            </span>
                          ))}
                        </div>
                      )}
                      <DataTable
                        rows={sptjRows}
                        rowKey={(row, index) => `${String(row.no ?? index)}-${String(row.no_invoice ?? "")}`}
                        columns={[
                          { key: "no", header: "No", render: (row) => String(row.no ?? "—") },
                          { key: "map", header: "MAP", render: (row) => <span className="font-medium">{String(row.map ?? "—")}</span> },
                          { key: "pembayar", header: "Pembayar / Penyeto", render: (row) => String(row.pembayar ?? "—") },
                          { key: "uraian", header: "Uraian", render: (row) => String(row.uraian ?? "—") },
                          { key: "tanggal_bayar", header: "Tgl. bayar", render: (row) => String(row.tanggal_bayar ?? "—") },
                          { key: "no_invoice", header: "No. invoice / bukti", render: (row) => String(row.no_invoice ?? row.no_bukti ?? "—") },
                          { key: "kode_program", header: "Program", render: (row) => String(row.kode_program ?? "—") },
                          { key: "nominal_netto", header: "Jumlah (netto)", render: (row) => <span className="tabular-nums font-medium">{formatRupiah(row.nominal_netto)}</span> },
                        ]}
                        emptyMessage="Belum ada penerimaan tervalidasi pada periode ini."
                      />
                    </>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Catatan pertanggungjawaban</p>
                  <p className="mt-1">{SATKER.klausul_pph}</p>
                  <p className="mt-1">
                    Penerimaan disetor ke {SATKER.rekening_idr_nama} · {SATKER.rekening_idr_display} ({SATKER.bank}). NPWP satker {SATKER.npwp}. SPTJ ditandatangani Bendahara Penerimaan dan disahkan Pejabat Pembuat Komitmen di lingkungan
                    BLU LEMIGAS.
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">Laporan Realisasi Penerimaan per MAP</h2>
                    <p className="text-xs text-muted-foreground">Akumulasi netto per klasifikasi pendapatan pada {periodLabel(reportPeriod)}.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Jumlah keseluruhan</p>
                    <p className="text-lg font-semibold tabular-nums">{formatRupiah(realisasi.jumlah_keseluruhan)}</p>
                  </div>
                </div>
                {realisasiQuery.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Menyusun realisasi…</p>}
                {realisasiQuery.isError && (
                  <EmptyData
                    label="Laporan realisasi belum dapat dimuat."
                    action={
                      <Button type="button" variant="outline" size="sm" onClick={() => void realisasiQuery.refetch()}>
                        Coba lagi
                      </Button>
                    }
                  />
                )}
                {!realisasiQuery.isLoading && !realisasiQuery.isError && (
                  <div className="overflow-x-auto rounded-md border bg-white">
                    <table className="w-full min-w-[44rem] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2.5">MAK</th>
                          <th className="p-2.5">Uraian</th>
                          {realisasiBulan.map((slot) => (
                            <th key={String(slot.key)} className="p-2.5 text-right">
                              SPM {String(slot.label)}
                            </th>
                          ))}
                          <th className="p-2.5 text-right">Jumlah keseluruhan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realisasiRows.map((row, index) => (
                          <tr key={String(row.mak ?? index)} className="border-t">
                            <td className="p-2.5 font-medium">{String(row.mak ?? "—")}</td>
                            <td className="p-2.5">{String(row.uraian ?? "—")}</td>
                            {realisasiBulan.map((slot) => (
                              <td key={String(slot.key)} className="p-2.5 text-right tabular-nums">
                                {row.per_bulan && Number((row.per_bulan as Row)[String(slot.key)] ?? 0) > 0 ? formatRupiah((row.per_bulan as Row)[String(slot.key)]) : "—"}
                              </td>
                            ))}
                            <td className="p-2.5 text-right font-semibold tabular-nums">{formatRupiah(row.total)}</td>
                          </tr>
                        ))}
                        {!realisasiRows.length && (
                          <tr>
                            <td colSpan={realisasiBulan.length + 3} className="p-3 text-center text-muted-foreground">
                              Belum ada realisasi penerimaan pada periode ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">Laporan ini hanya memuat realisasi penerimaan PNBP. SPTJM panjar Bendahara Pengeluaran dan PPN titipan tidak digabungkan ke dalam laporan ini.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {view === "mutasi" && (
        <Card>
          <CardContent className="pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Landmark size={15} /> Mutasi bank
                </h2>
                <p className="text-xs text-muted-foreground">Dana masuk yang dicatat bendahara. Mutasi tanpa invoice terkait belum masuk rekap penerimaan.</p>
              </div>
            </div>
            {mutasiQuery.isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Memuat mutasi bank…</p>}
            {mutasiQuery.isError && (
              <EmptyData
                label="Daftar mutasi bank belum dapat dimuat."
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => void mutasiQuery.refetch()}>
                    Coba lagi
                  </Button>
                }
              />
            )}
            {!mutasiQuery.isLoading && !mutasiQuery.isError && (
              <DataTable
                rows={mutasiRows}
                rowKey={(row, index) => String(row.id ?? index)}
                remoteSearch
                searchValue={mutasiSearch}
                searchPlaceholder="Cari referensi bank atau nama pengirim…"
                onSearchChange={setMutasiSearch}
                filters={[
                  { field: "rekening_id", label: "Rekening", options: accountOptions },
                  {
                    field: "status",
                    label: "Status",
                    options: [
                      { value: "BELUM_DICOCOKKAN", label: "Belum dicocokkan" },
                      { value: "COCOK_SEBAGIAN", label: "Cocok sebagian" },
                      { value: "COCOK", label: "Cocok" },
                    ],
                  },
                ]}
                filterValues={{ rekening_id: mutasiRekening, status: mutasiStatus }}
                onFilterChange={(field, value) => (field === "rekening_id" ? setMutasiRekening(value) : setMutasiStatus(value))}
                columns={[
                  { key: "tanggal_transaksi", header: "Tanggal", render: (row) => date(row.tanggal_transaksi) },
                  { key: "referensi_bank", header: "Referensi", render: (row) => <span className="font-medium">{String(row.referensi_bank ?? "—")}</span> },
                  { key: "nama_pengirim", header: "Pengirim", render: (row) => row.nama_pengirim ?? "—" },
                  {
                    key: "rekening",
                    header: "Rekening",
                    render: (row) => {
                      const account = nested(row, "rekening");
                      return account ? [account.nama_bank, account.nomor_rekening].filter(Boolean).join(" · ") : "—";
                    },
                  },
                  { key: "nominal", header: "Nominal", render: (row) => formatRupiah(row.nominal) },
                  {
                    key: "sisa_belum_dicocokkan",
                    header: "Belum dicocokkan",
                    render: (row) => <span className={Number(row.sisa_belum_dicocokkan ?? 0) > 0 ? "font-medium text-amber-700" : "text-emerald-700"}>{formatRupiah(row.sisa_belum_dicocokkan)}</span>,
                  },
                  {
                    key: "pembayaran",
                    header: "Dicocokkan ke invoice",
                    render: (row) => {
                      const payments = Array.isArray(row.pembayaran) ? (row.pembayaran as Row[]) : [];
                      if (!payments.length) return <span className="text-amber-700">Belum dicocokkan</span>;
                      return (
                        <span className="flex flex-col gap-0.5 text-xs">
                          {payments.map((payment, index) => {
                            const invoice = nested(payment, "invoice");
                            return (
                              <span key={String(payment.id ?? index)} className="font-medium">
                                {String(invoice?.nomor_invoice ?? "—")}
                              </span>
                            );
                          })}
                        </span>
                      );
                    },
                  },
                  {
                    key: "file_bukti",
                    header: "Bukti",
                    render: (row) =>
                      typeof row.file_bukti === "string" && row.file_bukti ? (
                        <a className="font-medium text-primary underline-offset-4 hover:underline" href={uploadedFileUrl(row.file_bukti)} target="_blank" rel="noreferrer">
                          Lihat bukti
                        </a>
                      ) : (
                        "—"
                      ),
                  },
                  { key: "status", header: "Status", render: (row) => mutasiStatusLabels[String(row.status ?? "")] ?? String(row.status ?? "—") },
                ]}
              />
            )}
          </CardContent>
        </Card>
      )}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title={invoiceSource === "retail" ? "Buat Invoice Layanan Retail" : "Buat Invoice Proyek"}
        description={
          invoiceSource === "retail"
            ? "Tagihan retail diterbitkan setelah LHU tercatat. Porsi penerimaan untuk OPS_KANTOR mengikuti persentase yang dikonfigurasi."
            : "Invoice langsung diterbitkan sebagai piutang. Status lunas dicatat Bendahara setelah pembayaran terkonfirmasi di rekening."
        }
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
        <label className="grid min-w-0 gap-1 text-sm">
          {invoiceSource === "retail" ? (
            <>
              Job retail siap ditagih *
              <FilterCombobox options={retailJobOptions} value={invoiceForm.retail_job_id} onValueChange={(value) => setInvoiceForm((current) => ({ ...current, retail_job_id: value }))} label="Pilih job retail" />
              {retailJobsQuery.isError && (
                <EmptyData
                  className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden"
                  label="Daftar job retail belum dapat dimuat."
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={() => void retailJobsQuery.refetch()}>
                      Coba lagi
                    </Button>
                  }
                />
              )}
            </>
          ) : (
            <>
              Termin proyek *
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={invoiceForm.termin_id} onChange={(event) => setInvoiceForm((current) => ({ ...current, termin_id: event.target.value }))}>
                <option value="">Pilih termin</option>
                {terminRows.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {String(item.proyek?.no_kontrak ?? "Proyek")} · Termin {String(item.nomor_termin)} · {formatRupiah(item.nilai_termin)}
                  </option>
                ))}
              </select>
            </>
          )}
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nomor invoice
            <Input maxLength={100} placeholder="Kosongkan agar sistem membuat otomatis" value={invoiceForm.nomor_invoice} onChange={(event) => setInvoiceForm((current) => ({ ...current, nomor_invoice: event.target.value }))} />
            <span className="text-xs text-muted-foreground">16 digit: prefix + kode program + YYMM + urut.</span>
          </label>
          <label className="grid gap-1 text-sm">
            Kode program
            <Input maxLength={50} placeholder="mis. 5.09" value={invoiceForm.kode_program} onChange={(event) => setInvoiceForm((current) => ({ ...current, kode_program: event.target.value }))} />
            <span className="text-xs text-muted-foreground">Dipakai untuk nomor invoice &amp; kwitansi. Kosong = RO pertama proyek.</span>
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          NSFP Coretax (opsional)
          <Input maxLength={20} inputMode="numeric" placeholder="mis. 04002600420989765" value={invoiceForm.nsfp} onChange={(event) => setInvoiceForm((current) => ({ ...current, nsfp: event.target.value }))} />
          <span className="text-xs text-muted-foreground">17 digit: kode transaksi 04 + kode barang/jasa 160404 + nomor seri. Kosongkan bila belum tersedia dari Coretax.</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Tarif PPN (%)
            <Input type="number" min={0} max={100} value={invoiceForm.tarif_ppn} onChange={(event) => setInvoiceForm((current) => ({ ...current, tarif_ppn: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal jatuh tempo
            <Input type="date" value={invoiceForm.tanggal_jatuh_tempo} onChange={(event) => setInvoiceForm((current) => ({ ...current, tanggal_jatuh_tempo: event.target.value }))} />
          </label>
        </div>
        {invoicePreview && (
          <div className="rounded-md border bg-muted/40 px-3 py-2.5 text-xs">
            <p className="font-semibold">Pratinjau tagihan (nilai netto PNBP)</p>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
              {[
                ["Netto", invoicePreview.netto],
                ["DPP (11/12)", invoicePreview.dpp],
                ["PPN", invoicePreview.ppn],
                ["Total transfer", invoicePreview.bruto],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{formatRupiah(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {terminQuery.isError && invoiceSource === "project" && (
          <EmptyData
            className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden"
            label="Daftar termin belum dapat dimuat."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void terminQuery.refetch()}>
                Coba lagi
              </Button>
            }
          />
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
        footer={
          <Button variant="outline" onClick={() => setDetailInvoice(null)}>
            Tutup
          </Button>
        }
      >
        {detailInvoice &&
          (() => {
            const summary = detailInvoice.ringkasan && typeof detailInvoice.ringkasan === "object" ? (detailInvoice.ringkasan as Row) : undefined;
            const paid = summary ? Number(summary.nominal_dibayar ?? 0) : Number(detailInvoice.nominal_dibayar ?? 0);
            const amount = summary ? Number(summary.nominal ?? 0) : Number(detailInvoice.nominal ?? 0);
            const netto = Number(summary?.netto ?? detailInvoice.netto ?? amount);
            const dpp = Number(summary?.dpp ?? detailInvoice.dpp ?? 0);
            const ppn = Number(summary?.ppn ?? detailInvoice.ppn ?? 0);
            const bruto = Number(summary?.bruto ?? detailInvoice.bruto ?? netto);
            const ppnDititipkan = Number(summary?.ppn_dititipkan ?? detailInvoice.ppn_dititipkan ?? 0);
            const pakaiPajak = Boolean(detailInvoice.jenis_pajak) || bruto !== netto;
            const remaining = summary ? Number(summary.sisa_tagihan ?? 0) : Math.max(0, amount - paid);
            const kurangTercatat = summary ? Number(summary.kurang_bayar_tercatat ?? 0) : Number(detailInvoice.nilai_kurang_bayar ?? 0);
            const kurangSelesai = summary ? Number(summary.kurang_bayar_diselesaikan ?? 0) : 0;
            const lebihTercatat = summary ? Number(summary.lebih_bayar_tercatat ?? 0) : Number(detailInvoice.nilai_lebih_bayar ?? 0);
            const lebihSelesai = summary ? Number(summary.lebih_bayar_diselesaikan ?? 0) : 0;
            const penyelesaian = Array.isArray(detailInvoice.penyelesaian_selisih) ? (detailInvoice.penyelesaian_selisih as Row[]) : [];
            const project = nested(nested(detailInvoice, "termin") ?? {}, "proyek");
            const retailJob = nested(detailInvoice, "retail_job");
            const retailLines = Array.isArray(retailJob?.rincian_layanan) ? (retailJob.rincian_layanan as Row[]) : [];
            const payments = Array.isArray(detailInvoice.pembayaran) ? (detailInvoice.pembayaran as Row[]) : [];
            const invoiceStatus = String(detailInvoice.status ?? "");
            const invoiceTone = invoiceStatus === "LUNAS" ? "ok" : invoiceStatus === "DITOLAK_KEUANGAN" || invoiceStatus === "DIBATALKAN" ? "danger" : invoiceStatus === "SEBAGIAN_DIBAYAR" ? "warn" : "neutral";
            return (
              <div className="space-y-4">
                {detailLoadingId === String(detailInvoice.id) && <p className="text-xs text-muted-foreground">Memuat rincian terkini…</p>}
                <ModalSection title="Informasi invoice" action={<StatusBadge status={invoiceTone}>{statusLabels[invoiceStatus] ?? (invoiceStatus || "—")}</StatusBadge>}>
                  <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                    {[
                      ["Nomor invoice", detailInvoice.nomor_invoice ?? "—"],
                      ["Nomor kwitansi", detailInvoice.no_kwitansi ?? "Belum diterbitkan"],
                      ["Kode program", detailInvoice.kode_program ?? "—"],
                      ["NSFP", detailInvoice.nsfp ?? "—"],
                      ["Jenis invoice", detailInvoice.jenis ?? "—"],
                      ["Proyek sumber", project ? `${String(project.no_kontrak ?? "—")} · ${String(project.nama_proyek ?? "—")}` : sourceLabel(detailInvoice)],
                      ["Termin", nested(detailInvoice, "termin") ? `Termin ${String(nested(detailInvoice, "termin")?.nomor_termin ?? "—")}` : "—"],
                      ["Tanggal terbit", date(detailInvoice.tanggal_terbit)],
                      ["Jatuh tempo", date(detailInvoice.tanggal_jatuh_tempo)],
                      ["Dibuat oleh", nested(detailInvoice, "pembuat")?.nama ?? "—"],
                      ["Diterbitkan pada", date(detailInvoice.diterbitkan_pada)],
                      ["Nomor posting", detailInvoice.no_posting ?? "Belum diposting"],
                      ["Diposting pada", detailInvoice.diposting_pada ? `${date(detailInvoice.diposting_pada)} · ${String(nested(detailInvoice, "pemosting")?.nama ?? "—")}` : "—"],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="min-w-0 py-3 sm:border-b">
                        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                        <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {invoiceStatus === "DIBATALKAN" && (
                    <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                      <p className="font-semibold">
                        Invoice dibatalkan {detailInvoice.dibatalkan_pada ? `pada ${date(detailInvoice.dibatalkan_pada)}` : ""} oleh {String(nested(detailInvoice, "pembatal")?.nama ?? "—")}
                      </p>
                      <p className="mt-1">{String(detailInvoice.alasan_pembatalan ?? "Tanpa alasan tercatat.")}</p>
                    </div>
                  )}
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                    <p className="font-semibold">Ketentuan kwitansi &amp; e-Meterai</p>
                    <p className="mt-1">{SATKER.klausul_kwitansi}.</p>
                    <p className="mt-1">{SATKER.klausul_pph}</p>
                    <p className="mt-1">
                      Nilai bruto di atas {formatRupiah(SATKER.batas_e_meterai)} wajib dibubuhi e-Meterai Rp {SATKER.e_meterai.toLocaleString("id-ID")} pada kwitansi. Rekening penerimaan: {SATKER.rekening_idr_nama} ·{" "}
                      {SATKER.rekening_idr_display} ({SATKER.bank}).
                    </p>
                  </div>
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
                          <thead className="bg-muted/50 text-muted-foreground">
                            <tr>
                              <th className="p-2.5">Layanan uji</th>
                              <th className="p-2.5">Parameter / metode</th>
                              <th className="p-2.5 text-right">Jumlah</th>
                              <th className="p-2.5 text-right">Tarif</th>
                              <th className="p-2.5 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {retailLines.map((line, index) => (
                              <tr key={String(line.id ?? index)} className="border-t">
                                <td className="p-2.5">
                                  {String(line.nama_layanan ?? "—")}
                                  <span className="block text-muted-foreground">{String(line.satuan ?? "sampel")}</span>
                                </td>
                                <td className="p-2.5">
                                  {String(line.parameter_uji ?? "—")}
                                  <span className="block text-muted-foreground">{String(line.metode_uji ?? "Metode belum dicatat")}</span>
                                </td>
                                <td className="p-2.5 text-right tabular-nums">{String(line.jumlah ?? 0)}</td>
                                <td className="p-2.5 text-right tabular-nums">{formatRupiah(line.tarif)}</td>
                                <td className="p-2.5 text-right font-medium tabular-nums">{formatRupiah(line.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t bg-muted/20">
                            <tr>
                              <td colSpan={4} className="p-2.5 font-semibold">
                                Total nilai layanan
                              </td>
                              <td className="p-2.5 text-right font-semibold tabular-nums">{formatRupiah(retailJob.nilai_layanan)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Rincian layanan belum tersedia untuk job retail lama.</p>
                    )}
                  </ModalSection>
                )}
                {pakaiPajak && (
                  <ModalSection title="Perhitungan pajak penerimaan" description="Nilai netto PNBP adalah dasar tagihan; PPN dipungut di atasnya dan dititipkan ke kas negara.">
                    <dl className="grid gap-x-8 sm:grid-cols-2">
                      {[
                        ["Nilai netto (PNBP)", formatRupiah(netto)],
                        ["DPP (nilai lain 11/12)", formatRupiah(dpp)],
                        [`PPN ${String(detailInvoice.tarif_ppn ?? 12)}%`, formatRupiah(ppn)],
                        ["Total transfer (bruto)", formatRupiah(bruto)],
                        ["PPN sudah dipungut", formatRupiah(ppnDititipkan)],
                        ["PPN belum dipungut", formatRupiah(Math.max(0, ppn - ppnDititipkan))],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="border-b py-2.5">
                          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                          <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </ModalSection>
                )}
                <ModalSection title="Status pencairan" description="Pembayaran dapat masuk bertahap sampai jumlah netto diterima sama dengan nilai tagihan.">
                  <MoneyFlow
                    items={[
                      { label: "Nilai tagihan (netto)", amount: netto },
                      { label: "Sudah diterima", amount: paid, operator: "−", tone: "text-sky-700" },
                      { label: "Sisa pencairan", amount: remaining, operator: "=", tone: remaining === 0 && paid > 0 ? "text-emerald-700" : "text-amber-700" },
                    ]}
                  />
                  {pakaiPajak && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Total transfer yang diharapkan dari pelanggan: <span className="font-medium text-foreground">{formatRupiah(bruto)}</span> (netto + PPN).
                    </p>
                  )}
                  {(kurangTercatat > 0 || lebihTercatat > 0) && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {kurangTercatat > 0 && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                          <p className="text-xs font-medium text-amber-800">Kurang bayar</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-amber-900">{formatRupiah(kurangTercatat)}</p>
                          <p className="mt-1 text-xs text-amber-800">
                            Diselesaikan {formatRupiah(kurangSelesai)} · sisa {formatRupiah(Math.max(0, kurangTercatat - kurangSelesai))}
                          </p>
                        </div>
                      )}
                      {lebihTercatat > 0 && (
                        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5">
                          <p className="text-xs font-medium text-sky-800">Lebih bayar</p>
                          <p className="mt-1 text-sm font-semibold tabular-nums text-sky-900">{formatRupiah(lebihTercatat)}</p>
                          <p className="mt-1 text-xs text-sky-800">
                            Diselesaikan {formatRupiah(lebihSelesai)} · sisa {formatRupiah(Math.max(0, lebihTercatat - lebihSelesai))}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </ModalSection>
                <ModalSection title="Riwayat penerimaan bank" description={`${payments.length} transaksi penerimaan tercatat`}>
                  {payments.length ? (
                    <div className="overflow-x-auto rounded-md border bg-white">
                      <table className="w-full min-w-[46rem] text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="p-2.5">Tanggal</th>
                            <th className="p-2.5">Referensi / rekening</th>
                            <th className="p-2.5">Divalidasi oleh</th>
                            <th className="p-2.5 text-right">Nominal</th>
                            <th className="p-2.5">Selisih</th>
                            <th className="p-2.5">Bukti</th>
                            <th className="p-2.5">Catatan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((payment, index) => {
                            const bankMutation = nested(payment, "mutasi_bank");
                            const account = nested(bankMutation ?? {}, "rekening");
                            const jenisSelisih = payment.jenis_selisih ? String(payment.jenis_selisih) : "";
                            const alokasi = Array.isArray(payment.alokasi_list) ? (payment.alokasi_list as Row[]) : [];
                            return (
                              <tr key={String(payment.id ?? index)} className="border-t">
                                <td className="whitespace-nowrap p-2.5">{date(payment.divalidasi_pada ?? bankMutation?.tanggal_transaksi)}</td>
                                <td className="p-2.5">
                                  <span className="font-medium">{String(bankMutation?.referensi_bank ?? "—")}</span>
                                  <span className="mt-0.5 block text-muted-foreground">{[account?.nama_bank, account?.nomor_rekening, account?.nama_rekening].filter(Boolean).join(" · ") || "Rekening tidak tersedia"}</span>
                                </td>
                                <td className="p-2.5">{nested(payment, "validator")?.nama ?? "—"}</td>
                                <td className="whitespace-nowrap p-2.5 text-right font-semibold tabular-nums">
                                  {formatRupiah(payment.nominal)}
                                  {Number(payment.ppn_dititipkan ?? 0) > 0 && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">PPN titipan {formatRupiah(payment.ppn_dititipkan)}</span>}
                                  {alokasi.length > 0 && (
                                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{alokasi.map((row, rowIndex) => `${String(nested(row, "ro")?.kode_ro ?? "RO")} ${formatRupiah(row.nominal)}`).join(" · ")}</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap p-2.5">
                                  {jenisSelisih ? (
                                    <span className={jenisSelisih === "KURANG" ? "font-medium text-amber-700" : "font-medium text-sky-700"}>
                                      {jenisSelisih === "KURANG" ? "Kurang" : "Lebih"} {formatRupiah(payment.selisih)}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="p-2.5">
                                  {typeof bankMutation?.file_bukti === "string" && bankMutation.file_bukti ? (
                                    <a className="font-medium text-primary underline-offset-4 hover:underline" href={uploadedFileUrl(bankMutation.file_bukti)} target="_blank" rel="noreferrer">
                                      Lihat bukti
                                    </a>
                                  ) : (
                                    "—"
                                  )}
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
                {penyelesaian.length > 0 && (
                  <ModalSection title="Riwayat penyelesaian selisih" description="Kurang/lebih bayar yang sudah ditutup beserta dasar/bukti penyelesaiannya.">
                    <div className="overflow-x-auto rounded-md border bg-white">
                      <table className="w-full min-w-[36rem] text-left text-xs">
                        <thead className="bg-muted/50 text-muted-foreground">
                          <tr>
                            <th className="p-2.5">Jenis</th>
                            <th className="p-2.5 text-right">Nominal</th>
                            <th className="p-2.5">Alasan</th>
                            <th className="p-2.5">Nomor bukti</th>
                            <th className="p-2.5">Diselesaikan oleh</th>
                            <th className="p-2.5">Waktu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {penyelesaian.map((row, index) => (
                            <tr key={String(row.id ?? index)} className="border-t">
                              <td className="p-2.5">
                                <span className={String(row.jenis) === "KURANG" ? "font-medium text-amber-700" : "font-medium text-sky-700"}>{String(row.jenis) === "KURANG" ? "Kurang bayar" : "Lebih bayar"}</span>
                              </td>
                              <td className="whitespace-nowrap p-2.5 text-right font-semibold tabular-nums">{formatRupiah(row.nominal)}</td>
                              <td className="p-2.5">{String(row.alasan ?? "—")}</td>
                              <td className="p-2.5">{String(row.nomor_bukti ?? "—")}</td>
                              <td className="p-2.5">{nested(row, "penyelesai")?.nama ?? "—"}</td>
                              <td className="whitespace-nowrap p-2.5">{date(row.diselesaikan_pada)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ModalSection>
                )}
              </div>
            );
          })()}
      </Modal>
      <Modal
        open={Boolean(settling)}
        onClose={() => {
          setSettling(null);
          setReceiptProof(null);
        }}
        title="Catat Penerimaan Invoice"
        description={
          settling
            ? `${String(settling.nomor_invoice)} · sisa netto ${formatRupiah(sisaTagihan(settling).nettoTersisa)}${Number(settling.nominal_bruto ?? 0) > 0 ? ` · transfer yang diharapkan ${formatRupiah(sisaTagihan(settling).brutoTersisa)}` : ""}. Catat dana yang sudah masuk rekening dan lampirkan bukti penerimaannya.`
            : "Penerimaan invoice."
        }
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setSettling(null);
                setReceiptProof(null);
              }}
            >
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
            Nominal diterima *
            <MoneyInput value={receiptForm.nominal} onValueChange={(value) => setReceiptForm((current) => ({ ...current, nominal: value }))} />
            {settling && Number(settling.nominal_bruto ?? 0) > 0 && <span className="text-xs text-muted-foreground">Isi total transfer termasuk PPN. Porsi netto dan PPN titipan dihitung otomatis oleh sistem.</span>}
          </label>
        </div>
        <label className="grid gap-1 text-sm">
          Nomor referensi bank *
          <Input maxLength={150} placeholder="Nomor transaksi yang tercantum pada bukti transfer" value={receiptForm.referensi_bank} onChange={(event) => setReceiptForm((current) => ({ ...current, referensi_bank: event.target.value }))} />
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
        {settling && (
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Alokasi netto ke program / MAP (opsional)</p>
                <p className="text-xs text-muted-foreground">
                  Kosongkan agar sistem membagi otomatis ke pagu RO. Bila diisi, total harus sama dengan netto diterima
                  {settling ? ` (${formatRupiah(nettoDiterima(settling, Number(receiptForm.nominal) || 0))})` : ""}. Isi MAP saat satu penerimaan dibagi ke beberapa program.
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => setAlokasiRows((current) => [...current, { ro_id: settlingRoOptions[0]?.value ?? "", kode_program: "", mak_id: "", nominal: "", keterangan: "" }])}>
                <Plus size={14} /> Tambah alokasi
              </Button>
            </div>
            {alokasiRows.length > 0 && (
              <div className="mt-3 space-y-2">
                {alokasiRows.map((row, index) => (
                  <div key={index} className="grid gap-2 rounded-md border bg-white p-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]">
                    <select
                      className="h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                      value={row.ro_id}
                      onChange={(event) => setAlokasiRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ro_id: event.target.value } : item)))}
                    >
                      <option value="">Pilih RO</option>
                      {settlingRoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      maxLength={50}
                      placeholder="Kode program"
                      value={row.kode_program}
                      onChange={(event) => setAlokasiRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, kode_program: event.target.value } : item)))}
                    />
                    <FilterCombobox
                      options={mapOptions}
                      value={row.mak_id}
                      onValueChange={(value) => setAlokasiRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, mak_id: value } : item)))}
                      label={mapQuery.isLoading ? "Memuat MAP…" : "MAP (klasifikasi pendapatan)"}
                    />
                    <MoneyInput value={row.nominal} onValueChange={(value) => setAlokasiRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, nominal: value } : item)))} />
                    <Button type="button" size="sm" variant="outline" onClick={() => setAlokasiRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      <Trash2 size={14} />
                    </Button>
                    <Input
                      className="sm:col-span-4"
                      maxLength={200}
                      placeholder="Keterangan (opsional)"
                      value={row.keterangan}
                      onChange={(event) => setAlokasiRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, keterangan: event.target.value } : item)))}
                    />
                  </div>
                ))}
                {(() => {
                  const total = alokasiRows.reduce((sum, row) => sum + (Number(row.nominal) || 0), 0);
                  const target = settling ? nettoDiterima(settling, Number(receiptForm.nominal) || 0) : 0;
                  return (
                    <p className={`text-xs ${total === target ? "text-emerald-700" : "text-amber-700"}`}>
                      Total alokasi {formatRupiah(total)} dari netto diterima {formatRupiah(target)}.
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        <div>
          <DocumentUploadField label="Bukti penerimaan bank *" accept=".pdf,.jpg,.jpeg,.png" value={receiptProof} onChange={setReceiptProof} disabled={receiptMutation.isPending} className="p-3 sm:p-3" />
          <p className="mt-1.5 text-xs text-muted-foreground">Unggah bukti transfer masuk atau cuplikan mutasi rekening agar pembayaran dapat diverifikasi. Format PDF, JPG, atau PNG; maksimal 10 MB.</p>
        </div>
        {accountsQuery.isError && (
          <EmptyData
            className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden"
            label="Daftar rekening belum dapat dimuat."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void accountsQuery.refetch()}>
                Coba lagi
              </Button>
            }
          />
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(postingTarget)}
        onClose={() => setPostingTarget(null)}
        title="Posting Invoice Lunas"
        description={postingTarget ? `${String(postingTarget.nomor_invoice ?? "—")} · ${formatRupiah(postingTarget.nominal)}. Posting menandai invoice lunas sebagai bukti pembukuan dan tidak dapat dibatalkan.` : "Posting invoice."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setPostingTarget(null)}>
              Batal
            </Button>
            <Button onClick={() => void submitPosting()} disabled={postingMutation.isPending}>
              <FileCheck2 size={16} /> {postingMutation.isPending ? "Memposting…" : "Posting Lunas"}
            </Button>
          </>
        }
      >
        {postingTarget && (
          <>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
              <p className="font-semibold">Invoice ini sudah lunas dan siap diposting.</p>
              <p className="mt-1">
                Nilai tagihan (netto) {formatRupiah(postingTarget.nominal)} · diterima {formatRupiah(postingTarget.nominal_dibayar)}
                {Number(postingTarget.nominal_bruto ?? 0) > 0 ? ` · total transfer ${formatRupiah(postingTarget.nominal_bruto)}` : ""}
              </p>
            </div>
            <label className="grid gap-1 text-sm">
              Nomor posting
              <Input maxLength={100} placeholder="Kosongkan agar sistem membuat nomor otomatis" value={postingForm.no_posting} onChange={(event) => setPostingForm((current) => ({ ...current, no_posting: event.target.value }))} />
              <span className="text-xs text-muted-foreground">Nomor bukti posting lunas dari sistem akuntansi, contoh JLT/2026/11/000123 atau GLT/2026/11/000123.</span>
            </label>
            <label className="grid gap-1 text-sm">
              Tanggal posting *<Input type="date" value={postingForm.tanggal_posting} onChange={(event) => setPostingForm((current) => ({ ...current, tanggal_posting: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Catatan
              <textarea
                className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={500}
                value={postingForm.catatan}
                onChange={(event) => setPostingForm((current) => ({ ...current, catatan: event.target.value }))}
              />
            </label>
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={postingBatchOpen}
        onClose={() => {
          setPostingBatchOpen(false);
          setSelectedPostingIds([]);
        }}
        title="Posting Batch Invoice Lunas"
        description="Posting seluruh invoice lunas pada periode terpilih dalam satu langkah. Invoice yang belum lunas otomatis dilewati."
        size="lg"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPostingBatchOpen(false);
                setSelectedPostingIds([]);
              }}
            >
              Batal
            </Button>
            <Button onClick={() => void submitPostingBatch()} disabled={postingBatchMutation.isPending || !selectedPostingIds.length}>
              <FileCheck2 size={16} /> {postingBatchMutation.isPending ? "Memposting…" : `Posting ${selectedPostingIds.length} invoice`}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            Tahun
            <Input type="number" min={2000} max={2200} value={rekapTahun} onChange={(event) => setRekapTahun(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Bulan
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={rekapBulan} onChange={(event) => setRekapBulan(event.target.value)}>
              <option value="__all">Seluruh tahun</option>
              {bulanLabels.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal posting *
            <Input type="date" value={postingForm.tanggal_posting} onChange={(event) => setPostingForm((current) => ({ ...current, tanggal_posting: event.target.value }))} />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-slate-50 px-3 py-2.5 text-xs">
          <span className="font-medium">
            {postingReadyRows.length} invoice siap posting · total {formatRupiah(postingReady.total_nominal)}
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedPostingIds(postingReadyRows.map((row) => String(row.id)))} disabled={!postingReadyRows.length}>
              Pilih semua
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedPostingIds([])} disabled={!selectedPostingIds.length}>
              Kosongkan
            </Button>
          </span>
        </div>
        {postingReadyQuery.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Memuat invoice siap posting…</p>}
        {postingReadyQuery.isError && (
          <EmptyData
            className="min-h-0 border-0 [&_.empty-pyramid]:hidden"
            label="Daftar invoice siap posting belum dapat dimuat."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void postingReadyQuery.refetch()}>
                Coba lagi
              </Button>
            }
          />
        )}
        {!postingReadyQuery.isLoading && !postingReadyQuery.isError && postingReadyRows.length > 0 && (
          <div className="max-h-80 overflow-auto rounded-md border bg-white">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="sticky top-0 bg-muted/70 text-muted-foreground">
                <tr>
                  <th className="w-10 p-2.5"></th>
                  <th className="p-2.5">Nomor invoice</th>
                  <th className="p-2.5">Terbit</th>
                  <th className="p-2.5 text-right">Nominal</th>
                  <th className="p-2.5 text-right">Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {postingReadyRows.map((row, index) => {
                  const id = String(row.id);
                  return (
                    <tr key={String(row.id ?? index)} className="border-t">
                      <td className="p-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={selectedPostingIds.includes(id)}
                          onChange={(event) => setSelectedPostingIds((current) => (event.target.checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)))}
                        />
                      </td>
                      <td className="p-2.5">
                        <span className="font-medium">{String(row.nomor_invoice ?? "—")}</span>
                        <span className="mt-0.5 block text-muted-foreground">{sourceLabel(row)}</span>
                      </td>
                      <td className="whitespace-nowrap p-2.5">{date(row.tanggal_terbit)}</td>
                      <td className="whitespace-nowrap p-2.5 text-right tabular-nums">{formatRupiah(row.nominal)}</td>
                      <td className="whitespace-nowrap p-2.5 text-right tabular-nums">{formatRupiah(row.nominal_dibayar)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!postingReadyQuery.isLoading && !postingReadyQuery.isError && !postingReadyRows.length && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
            <p className="font-semibold">Tidak ada invoice LUNAS yang menunggu posting pada periode ini.</p>
            {postingRowsUnposted.length > 0 && <p className="mt-1">Terdapat {postingRowsUnposted.length} invoice lunas pada halaman daftar yang mungkin berada di periode lain. Sesuaikan tahun/bulan di atas.</p>}
          </div>
        )}
        <label className="grid gap-1 text-sm">
          Nomor posting awal
          <Input maxLength={100} placeholder="Kosongkan agar sistem membuat nomor otomatis" value={postingForm.no_posting} onChange={(event) => setPostingForm((current) => ({ ...current, no_posting: event.target.value }))} />
          <span className="text-xs text-muted-foreground">Hanya dipakai untuk invoice pertama bila diisi; sisanya memakai nomor urut berikutnya.</span>
        </label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(selisihTarget)}
        onClose={() => setSelisihTarget(null)}
        title="Penyelesaian Selisih Pembayaran"
        description={selisihTarget ? `${String(selisihTarget.nomor_invoice ?? "—")} · kurang ${formatRupiah(selisihTarget.nilai_kurang_bayar)} · lebih ${formatRupiah(selisihTarget.nilai_lebih_bayar)}` : "Penyelesaian selisih."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelisihTarget(null)}>
              Batal
            </Button>
            <Button onClick={() => void submitSelisih()} disabled={selisihMutation.isPending}>
              <Scale size={16} /> {selisihMutation.isPending ? "Menyimpan…" : "Selesaikan Selisih"}
            </Button>
          </>
        }
      >
        {selisihTarget &&
          (() => {
            const kurang = Number(selisihTarget.nilai_kurang_bayar ?? 0);
            const lebih = Number(selisihTarget.nilai_lebih_bayar ?? 0);
            const belumSelesai = selisihForm.jenis === "KURANG" ? kurang : lebih;
            return (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border bg-white px-3 py-2.5 text-xs">
                    <p className="text-muted-foreground">Kurang bayar tercatat</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-amber-700">{formatRupiah(kurang)}</p>
                  </div>
                  <div className="rounded-md border bg-white px-3 py-2.5 text-xs">
                    <p className="text-muted-foreground">Lebih bayar tercatat</p>
                    <p className="mt-1 text-sm font-semibold tabular-nums text-sky-700">{formatRupiah(lebih)}</p>
                  </div>
                </div>
                <label className="grid gap-1 text-sm">
                  Jenis selisih *
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={selisihForm.jenis}
                    onChange={(event) => setSelisihForm((current) => ({ ...current, jenis: event.target.value as "KURANG" | "LEBIH" }))}
                  >
                    <option value="KURANG" disabled={!kurang}>
                      Kurang bayar
                    </option>
                    <option value="LEBIH" disabled={!lebih}>
                      Lebih bayar
                    </option>
                  </select>
                  <span className="text-xs text-muted-foreground">Tersisa {formatRupiah(belumSelesai)} untuk jenis ini.</span>
                </label>
                <label className="grid gap-1 text-sm">
                  Nominal diselesaikan
                  <MoneyInput value={selisihForm.nominal} onValueChange={(value) => setSelisihForm((current) => ({ ...current, nominal: value }))} />
                  <span className="text-xs text-muted-foreground">Kosongkan untuk menyelesaikan seluruh sisa selisih ({formatRupiah(belumSelesai)}).</span>
                </label>
                <label className="grid gap-1 text-sm">
                  Alasan penyelesaian *
                  <textarea
                    className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    maxLength={500}
                    placeholder="Contoh: selisih ditutup dengan penyesuaian pajak, atau disetorkan sebagai pendapatan lain-lain."
                    value={selisihForm.alasan}
                    onChange={(event) => setSelisihForm((current) => ({ ...current, alasan: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Nomor bukti
                  <Input maxLength={100} placeholder="Nomor berita acara / bukti penyesuaian" value={selisihForm.nomor_bukti} onChange={(event) => setSelisihForm((current) => ({ ...current, nomor_bukti: event.target.value }))} />
                </label>
              </>
            );
          })()}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Batalkan Invoice"
        description="Invoice yang dibatalkan tidak lagi dihitung sebagai piutang. Pembatalan hanya dapat dilakukan pada invoice yang belum diposting dan belum menerima pembayaran."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => void submitCancel()} disabled={cancelMutation.isPending}>
              <Ban size={16} /> {cancelMutation.isPending ? "Membatalkan…" : "Batalkan Invoice"}
            </Button>
          </>
        }
      >
        {cancelTarget && (
          <>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <p className="font-semibold">
                {String(cancelTarget.nomor_invoice ?? "—")} · {formatRupiah(cancelTarget.nominal)}
              </p>
              <p className="mt-1">{sourceLabel(cancelTarget)}</p>
              <p className="mt-1">Tindakan ini tercatat pada jejak audit dan tidak dapat dikembalikan.</p>
            </div>
            <label className="grid gap-1 text-sm">
              Alasan pembatalan *
              <textarea
                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={500}
                placeholder="Contoh: termin dibatalkan karena proyek dihentikan, atau invoice terbit ganda."
                value={cancelForm.alasan_pembatalan}
                onChange={(event) => setCancelForm({ alasan_pembatalan: event.target.value })}
              />
            </label>
          </>
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
