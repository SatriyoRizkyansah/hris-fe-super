"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleDollarSign,
  Eye,
  FileCheck2,
  FileText,
  LoaderCircle,
  PackageCheck,
  Paperclip,
  Printer,
  Wallet,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal, ModalSection } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { useCurrentUser } from "@/lib/api/hooks";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
type ExpenseForm = { nama_kegiatan: string; tanggal: string; jumlah: string; keterangan: string };
type PaymentForm = { nomor_pembayaran: string; tanggal_bayar: string; catatan: string };
const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const blankExpense = (): ExpenseForm => ({ nama_kegiatan: "", tanggal: today(), jumlah: "", keterangan: "" });
const blankPayment = (): PaymentForm => ({ nomor_pembayaran: "", tanggal_bayar: today(), catatan: "" });

function payload(value: unknown): Row {
  let current: any = value;
  for (let index = 0; index < 5 && current && typeof current === "object" && current.data && typeof current.data === "object"; index += 1) current = current.data;
  return current && typeof current === "object" ? current : {};
}

function dateLabel(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function fileUrl(path: string) {
  const normalized = path.replace(/^\/+/, "").replace(/^uploads\//, "").replace(/^api\//, "");
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/${normalized.startsWith("uploaded/") ? normalized : `uploaded/${normalized}`}`;
}

function statusInfo(status: string): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  const map: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
    PENGUJIAN: { label: "Dalam pengujian", tone: "warn" },
    PERMOHONAN_DITERIMA: { label: "Permohonan diterima", tone: "neutral" },
    PERCONTO_DITERIMA: { label: "Perconto diterima", tone: "neutral" },
    LHU_TERBIT: { label: "LHU terbit", tone: "warn" },
    SIAP_DITAGIH: { label: "Siap ditagih", tone: "warn" },
    INVOICE_DITERBITKAN: { label: "Invoice diterbitkan", tone: "warn" },
    LUNAS: { label: "Lunas", tone: "ok" },
    SELESAI: { label: "Selesai", tone: "ok" },
    DIBATALKAN: { label: "Dibatalkan", tone: "danger" },
  };
  return map[status] ?? { label: status.replaceAll("_", " ") || "—", tone: "neutral" };
}

function expenseStatus(status: string): { label: string; tone: "ok" | "warn" | "danger" | "neutral" } {
  const map: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
    DIAJUKAN: { label: "Menunggu KARWAS", tone: "warn" },
    DISETUJUI_KARWAS: { label: "Menunggu pembayaran", tone: "ok" },
    DITOLAK_KARWAS: { label: "Ditolak", tone: "danger" },
    DIBAYAR: { label: "Dibayar", tone: "ok" },
    DIBATALKAN: { label: "Dibatalkan", tone: "neutral" },
  };
  return map[status] ?? { label: status.replaceAll("_", " ") || "—", tone: "neutral" };
}

const flowSteps = [
  { title: "Terima sampel", role: "SUBKOOR / PILT", detail: "Catat tanda terima dan mulai pengujian." },
  { title: "Input LHU", role: "SUBKOOR / PILT", detail: "Isi nomor dan file LHU setelah uji selesai." },
  { title: "Terbitkan invoice", role: "KEU_BILLING", detail: "Invoice menjadi piutang klien." },
  { title: "Catat penerimaan", role: "KEU_BENDAHARA", detail: "Cocokkan mutasi bank sampai lunas." },
  { title: "Cetak / serah LHU", role: "SETELAH LUNAS", detail: "Akses LHU terbuka setelah pembayaran lunas." },
];

function currentFlowIndex(status: string) {
  if (["PENGUJIAN", "PERMOHONAN_DITERIMA", "PERCONTO_DITERIMA"].includes(status)) return 0;
  if (["LHU_TERBIT", "SIAP_DITAGIH"].includes(status)) return 1;
  if (status === "INVOICE_DITERBITKAN") return 2;
  if (status === "LUNAS") return 4;
  if (status === "SELESAI") return 5;
  return 0;
}

export default function RetailOrderDetailPage({ id }: { id: string }) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>(blankExpense);
  const [expenseError, setExpenseError] = useState("");
  const [expenseDetail, setExpenseDetail] = useState<Row | null>(null);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [supportFile, setSupportFile] = useState<File | null>(null);
  const [supportError, setSupportError] = useState("");
  const [paymentExpense, setPaymentExpense] = useState<Row | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(blankPayment);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [lhuOpen, setLhuOpen] = useState(false);
  const [lhuNumber, setLhuNumber] = useState("");
  const [lhuDate, setLhuDate] = useState(today());
  const [lhuFile, setLhuFile] = useState<File | null>(null);
  const [lhuError, setLhuError] = useState("");

  const user = useCurrentUser();
  const role = user.data?.role?.toLowerCase() ?? "";
  const canManage = ["superadmin", "koordinator", "subkoor"].includes(role);
  const canBill = ["superadmin", "keu_billing"].includes(role);
  const canSettle = ["superadmin", "keu_bendahara"].includes(role);
  const canReviewExpense = ["superadmin", "keu_karwas"].includes(role);
  const canPayExpense = ["superadmin", "keu_bendahara"].includes(role);
  const invalidate = [apiQueryKeys.resource("retail")];
  const detail = use_query({
    tag: "retail",
    method: "retailJobDetail",
    params: { id },
    queryFn: async () => requestHrisApi(`/api/retail/jobs/${id}`),
  });
  const job = payload(detail.data);
  const status = String(job.status ?? "");
  const invoice = job.invoice && typeof job.invoice === "object" ? job.invoice as Row : {};
  const expenses = Array.isArray(job.pengajuan_belanja) ? job.pengajuan_belanja as Row[] : [];
  const serviceItems = Array.isArray(job.rincian_layanan) ? job.rincian_layanan as Row[] : [];
  const paid = Number(invoice.nominal_dibayar ?? 0);
  const invoiceAmount = Number(invoice.nominal ?? 0);
  const receivable = Math.max(0, invoiceAmount - paid);

  const createExpenseMutation = use_mutation<unknown, Error, ExpenseForm>({
    tag: "retail",
    method: "createRetailExpense",
    invalidateKeys: invalidate,
    mutationFn: async (form) => requestHrisApi(`/api/retail/jobs/${id}/pengajuan-belanja`, {
      method: "POST",
      body: JSON.stringify({ ...form, jumlah: Number(form.jumlah) }),
    }),
    onSuccess: async () => {
      await detail.refetch();
      setExpenseOpen(false);
      setExpenseForm(blankExpense());
      setExpenseError("");
    },
    onError: (cause) => setExpenseError(apiErrorMessage(cause)),
  });

  const reviewExpenseMutation = use_mutation<unknown, Error, { id: string; disetujui: boolean; catatan: string }>({
    tag: "retail",
    method: "reviewRetailExpense",
    invalidateKeys: invalidate,
    mutationFn: async ({ id: expenseId, disetujui, catatan }) => requestHrisApi(`/api/retail/pengajuan-belanja/${expenseId}/review`, {
      method: "POST",
      body: JSON.stringify({ disetujui, catatan }),
    }),
    onSuccess: async () => {
      await detail.refetch();
      setExpenseDetail(null);
      setReviewMode(false);
      setReviewNote("");
      setReviewError("");
    },
    onError: (cause) => setReviewError(apiErrorMessage(cause)),
  });

  const payExpenseMutation = use_mutation<unknown, Error, { id: string; form: PaymentForm; file: File }>({
    tag: "retail",
    method: "payRetailExpense",
    invalidateKeys: invalidate,
    mutationFn: async ({ id: expenseId, form, file }) => uploadHrisFile(`/api/retail/pengajuan-belanja/${expenseId}/bayar`, file, form),
    onSuccess: async () => {
      await detail.refetch();
      setPaymentExpense(null);
      setPaymentForm(blankPayment());
      setPaymentFile(null);
      setPaymentError("");
    },
    onError: (cause) => setPaymentError(apiErrorMessage(cause)),
  });

  const uploadSupportMutation = use_mutation<unknown, Error, { id: string; file: File }>({
    tag: "retail",
    method: "uploadRetailExpenseDocument",
    invalidateKeys: invalidate,
    mutationFn: async ({ id: expenseId, file }) => uploadHrisFile(`/api/retail/pengajuan-belanja/${expenseId}/dokumen`, file),
    onSuccess: async (response) => {
      await detail.refetch();
      const updated = payload(response);
      setExpenseDetail((current) => current ? { ...current, ...updated } : current);
      setSupportFile(null);
      setSupportError("");
    },
    onError: (cause) => setSupportError(apiErrorMessage(cause)),
  });

  const readyInvoiceMutation = use_mutation<unknown, Error, { nomor_lhu: string; tanggal_lhu: string; file: File }>({
    tag: "retail",
    method: "readyRetailInvoice",
    invalidateKeys: invalidate,
    mutationFn: async ({ nomor_lhu, tanggal_lhu, file }) => {
      await uploadHrisFile(`/api/retail/jobs/${id}/documents/LHU`, file);
      return requestHrisApi(`/api/retail/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nomor_lhu, tanggal_lhu, status: "SIAP_DITAGIH" }),
      });
    },
    onSuccess: async () => {
      await detail.refetch();
      setLhuOpen(false);
      setLhuFile(null);
      setLhuError("");
    },
    onError: (cause) => setLhuError(apiErrorMessage(cause)),
  });

  function issueInvoice() {
    window.location.assign(`/dashboard/invoice?createRetail=1&retailJobId=${encodeURIComponent(id)}`);
  }

  function recordReceipt() {
    if (invoice.id) window.location.assign(`/dashboard/invoice?settleInvoiceId=${encodeURIComponent(String(invoice.id))}`);
  }

  async function submitExpense() {
    if (!expenseForm.nama_kegiatan.trim() || !expenseForm.tanggal || !expenseForm.jumlah.trim()) {
      setExpenseError("Barang/kebutuhan, tanggal, dan nominal wajib diisi.");
      return;
    }
    const amount = Number(expenseForm.jumlah);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setExpenseError("Nominal harus berupa bilangan bulat lebih besar dari nol.");
      return;
    }
    try {
      setExpenseError("");
      await createExpenseMutation.mutateAsync(expenseForm);
    } catch (cause) {
      setExpenseError(apiErrorMessage(cause));
    }
  }

  async function reviewExpense(disetujui: boolean) {
    if (!expenseDetail) return;
    if (!disetujui && !reviewNote.trim()) {
      setReviewError("Alasan penolakan wajib diisi.");
      return;
    }
    try {
      setReviewError("");
      await reviewExpenseMutation.mutateAsync({ id: String(expenseDetail.id), disetujui, catatan: reviewNote.trim() });
    } catch (cause) {
      setReviewError(apiErrorMessage(cause));
    }
  }

  async function payExpense() {
    if (!paymentExpense || !paymentForm.nomor_pembayaran.trim() || !paymentForm.tanggal_bayar || !paymentFile) {
      setPaymentError("Nomor pembayaran, tanggal bayar, dan bukti pembayaran wajib diisi.");
      return;
    }
    try {
      setPaymentError("");
      await payExpenseMutation.mutateAsync({ id: String(paymentExpense.id), form: paymentForm, file: paymentFile });
    } catch (cause) {
      setPaymentError(apiErrorMessage(cause));
    }
  }

  async function submitLhu() {
    if (!lhuNumber.trim() || !lhuDate || !lhuFile) {
      setLhuError("Nomor LHU, tanggal, dan file LHU wajib diisi.");
      return;
    }
    try {
      setLhuError("");
      await readyInvoiceMutation.mutateAsync({ nomor_lhu: lhuNumber.trim(), tanggal_lhu: lhuDate, file: lhuFile });
    } catch (cause) {
      setLhuError(apiErrorMessage(cause));
    }
  }

  if (detail.isLoading) return <div className="p-6 text-sm text-muted-foreground">Memuat order retail...</div>;
  if (detail.isError || !job.id) return <div className="space-y-4 p-6"><Alert variant="destructive"><AlertTitle>Order retail tidak ditemukan</AlertTitle><AlertDescription>{detail.error ? apiErrorMessage(detail.error) : "Data order tidak tersedia."}</AlertDescription></Alert><Button variant="outline" render={<Link href="/dashboard/retail" />}><ArrowLeft size={16} /> Kembali ke Layanan Retail</Button></div>;

  const progressIndex = currentFlowIndex(status);
  const currentStatus = statusInfo(status);

  return <section className="hris-page space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 !p-6 sm:!p-7">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" render={<Link href="/dashboard/retail" />}><ArrowLeft size={16} /> Semua Order Retail</Button>
        <h1 className="text-2xl font-bold">{job.nama_pelanggan}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{job.nomor_job} · {job.unit_pelaksana?.nama_unit ?? "Unit belum tersedia"} · Diterima {dateLabel(job.tanggal_perconto_diterima ?? job.tanggal_permohonan)}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={currentStatus.tone}>{currentStatus.label}</StatusBadge>{invoice.nomor_invoice && <span className="rounded-full border bg-background px-3 py-1 text-xs font-medium">Invoice {invoice.nomor_invoice}</span>}</div>
    </header>

    <section className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="font-semibold">Alur order dan penagihan</h2>
        <p className="mt-1 text-sm text-muted-foreground">Setiap tahap menunjukkan siapa yang memproses dan kapan langkah berikutnya tersedia.</p>
      </div>
      {status === "DIBATALKAN" ? <Alert variant="destructive"><AlertDescription>Order dibatalkan dan tidak dapat dilanjutkan.</AlertDescription></Alert> : <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {flowSteps.map((step, index) => {
          const complete = index < progressIndex;
          const active = index === progressIndex && progressIndex < flowSteps.length;
          return <li key={step.title} className="relative min-w-0">
            <div className="flex items-start gap-3">
              <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${complete ? "bg-emerald-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{complete ? <Check size={15} /> : index + 1}</span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-sm font-semibold leading-snug ${active ? "text-foreground" : complete ? "text-emerald-800" : "text-muted-foreground"}`}>{step.title}</p>
                <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted-foreground">{step.role}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                <p className={`mt-2 text-xs font-medium ${complete ? "text-emerald-700" : active ? "text-primary" : "text-muted-foreground"}`}>{complete ? "Selesai" : active ? "Tahap saat ini" : "Menunggu"}</p>
              </div>
            </div>
          </li>;
        })}
      </ol>}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t pt-4">
        {canManage && ["PENGUJIAN", "LHU_TERBIT"].includes(status) && <Button onClick={() => { setLhuNumber(String(job.nomor_lhu ?? "")); setLhuDate(String(job.tanggal_lhu ?? today()).slice(0, 10)); setLhuFile(null); setLhuError(""); setLhuOpen(true); }}><FileCheck2 size={15} /> Input LHU · Siap Ditagih</Button>}
        {canBill && status === "SIAP_DITAGIH" && !invoice.id && <Button onClick={issueInvoice}><FileText size={15} /> Terbitkan Invoice</Button>}
        {canSettle && status === "INVOICE_DITERBITKAN" && <Button onClick={recordReceipt}><CircleDollarSign size={15} /> Catat Penerimaan</Button>}
        {canManage && ["LUNAS", "SELESAI"].includes(status) && job.file_lhu && <a className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90" href={fileUrl(String(job.file_lhu))} target="_blank" rel="noreferrer"><Printer size={15} /> Cetak / Serah Terima LHU</a>}
      </div>
      <div className="mt-5 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 sm:flex-row sm:items-center">
        <Wallet className="size-4 shrink-0 text-amber-700" />
        <p className="text-sm leading-relaxed text-amber-950"><strong>Belanja bahan bila diperlukan:</strong> ajukan dari tahap pengujian, KARWAS meninjau dan mencadangkan OPS_KANTOR, lalu Bendahara mencatat pembayaran.</p>
      </div>
    </section>

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Nilai layanan", value: formatRupiah(job.nilai_layanan), icon: PackageCheck, accent: "bg-sky-50 text-sky-700" },
        { label: "Penerimaan tercatat", value: formatRupiah(paid), icon: CircleDollarSign, accent: "bg-emerald-50 text-emerald-700" },
        { label: "Sisa piutang", value: formatRupiah(receivable), icon: Wallet, accent: "bg-amber-50 text-amber-700" },
      ].map(({ label, value, icon: Icon, accent }) => <Card key={label}><CardContent className="flex min-h-[112px] items-center justify-between gap-4 !p-5 sm:!p-6"><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 break-words text-xl font-semibold tracking-tight tabular-nums">{value}</p></div><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}><Icon size={19} /></span></CardContent></Card>)}
    </div>

    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="border-b bg-muted/30 px-5 py-4 sm:px-6">
        <h2 className="font-semibold">Informasi order dan sampel</h2>
        <p className="mt-1 text-sm text-muted-foreground">Identitas klien, tanda terima perconto, rincian pengujian, dan dokumen terkait.</p>
      </div>
      <dl className="grid gap-x-8 px-5 py-2 sm:grid-cols-2 sm:px-6">
        {[
          ["Nomor job", job.nomor_job],
          ["Nama klien", job.nama_pelanggan],
          ["Unit pelaksana", job.unit_pelaksana?.nama_unit ?? "—"],
          ["Nomor tanda terima perconto", job.nomor_tanda_terima_perconto ?? "—"],
          ["Tanggal sampel diterima", dateLabel(job.tanggal_perconto_diterima)],
          ["Nomor LHU", job.nomor_lhu ?? "Belum dicatat"],
          ["Tanggal LHU", dateLabel(job.tanggal_lhu)],
          ["Catatan umum order", job.detail_perconto ?? "—"],
          ["Nomor invoice", invoice.nomor_invoice ?? "Belum diterbitkan"],
          ["Status tagihan", invoice.status ? String(invoice.status).replaceAll("_", " ") : "Belum ditagihkan"],
        ].map(([label, value]) => <div key={String(label)} className="border-b py-3"><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
      </dl>
      <div className="flex flex-wrap gap-4 border-t px-5 py-4 text-sm sm:px-6">
        {job.file_tanda_terima && <a className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline" href={fileUrl(String(job.file_tanda_terima))} target="_blank" rel="noreferrer"><Paperclip size={14} /> Tanda terima perconto</a>}
        {job.file_lhu && ["LUNAS", "SELESAI"].includes(status) && <a className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline" href={fileUrl(String(job.file_lhu))} target="_blank" rel="noreferrer"><FileText size={14} /> Buka file LHU</a>}
        {job.file_lhu && !["LUNAS", "SELESAI"].includes(status) && <span className="inline-flex items-center gap-1.5 text-muted-foreground"><FileText size={14} /> File LHU tersedia setelah tagihan lunas</span>}
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="border-b bg-muted/30 px-5 py-4 sm:px-6">
        <h2 className="font-semibold">Daftar sampel dan rincian pengujian</h2>
        <p className="mt-1 text-sm text-muted-foreground">Rincian perconto yang dicatat dari tanda terima sampel.</p>
      </div>
      {serviceItems.length ? <div className="overflow-x-auto p-4 sm:p-5">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead><tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><th className="w-12 p-3">No.</th><th className="p-3">Nama</th><th className="w-24 p-3 text-right">Jumlah</th><th className="w-32 p-3">Satuan</th><th className="w-40 p-3">ID sampel</th><th className="min-w-64 p-3">Keterangan / analisa</th></tr></thead>
          <tbody>{serviceItems.map((item, index) => <tr key={String(item.id ?? index)} className="border-b last:border-0 align-top"><td className="p-3 text-muted-foreground">{index + 1}</td><td className="p-3 font-medium">{item.nama_layanan || "—"}</td><td className="p-3 text-right tabular-nums">{item.jumlah ?? 1}</td><td className="p-3">{item.satuan || "—"}</td><td className="p-3">{item.id_sampel || "—"}</td><td className="whitespace-pre-wrap p-3 text-muted-foreground">{item.catatan || item.parameter_uji || item.metode_uji || "—"}</td></tr>)}</tbody>
        </table>
      </div> : <div className="px-5 py-8 text-sm text-muted-foreground sm:px-6">{job.detail_perconto || "Belum ada rincian sampel yang dicatat."}</div>}
    </section>

    <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4 sm:px-6">
        <div><h2 className="font-semibold">Pengajuan belanja bahan</h2><p className="mt-1 text-sm text-muted-foreground">Riwayat kebutuhan bahan untuk order ini dan status pemeriksaan/pembayarannya.</p></div>
        {canManage && status === "PENGUJIAN" && <Button onClick={() => { setExpenseForm(blankExpense()); setExpenseError(""); setExpenseOpen(true); }}><Wallet size={15} /> Ajukan Belanja</Button>}
      </div>
      {expenses.length ? <div className="overflow-x-auto p-4 sm:p-5"><table className="w-full min-w-[54rem] text-left text-sm"><thead><tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><th className="rounded-l-lg p-3">Pengajuan</th><th className="p-3">Kebutuhan</th><th className="p-3 text-right">Nominal</th><th className="p-3">Status</th><th className="rounded-r-lg p-3">Aksi</th></tr></thead><tbody>{expenses.map((expense) => { const value = expenseStatus(String(expense.status ?? "")); return <tr key={String(expense.id)} className="border-b last:border-0"><td className="p-3"><p className="font-medium">{expense.nomor_pengajuan}</p><p className="text-xs text-muted-foreground">{dateLabel(expense.tanggal)}</p></td><td className="p-3"><p>{expense.nama_kegiatan}</p>{expense.keterangan && <p className="mt-0.5 text-xs text-muted-foreground">{expense.keterangan}</p>}</td><td className="p-3 text-right font-medium tabular-nums">{formatRupiah(expense.jumlah)}</td><td className="p-3"><StatusBadge status={value.tone}>{value.label}</StatusBadge></td><td className="p-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setExpenseDetail(expense); setReviewMode(false); setReviewNote(""); setReviewError(""); }}><Eye size={14} /> Rincian</Button>{canReviewExpense && expense.status === "DIAJUKAN" && <Button size="sm" onClick={() => { setExpenseDetail(expense); setReviewMode(true); setReviewNote(""); setReviewError(""); }}><Check size={14} /> Review</Button>}{canPayExpense && expense.status === "DISETUJUI_KARWAS" && <Button size="sm" onClick={() => { setPaymentExpense(expense); setPaymentForm(blankPayment()); setPaymentFile(null); setPaymentError(""); }}><CircleDollarSign size={14} /> Catat Bayar</Button>}</div></td></tr>; })}</tbody></table></div> : <div className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada pengajuan belanja bahan untuk order ini.</div>}
    </section>

    <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Ajukan Belanja Layanan Retail" description={`${job.nomor_job} · ${job.nama_pelanggan} · sumber dana OPS_KANTOR`} size="md" bodyClassName="space-y-4" footer={<><Button variant="outline" onClick={() => setExpenseOpen(false)}>Batal</Button><Button disabled={createExpenseMutation.isPending} onClick={submitExpense}>{createExpenseMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Wallet size={15} />} Kirim ke KARWAS</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">Barang / kebutuhan *<Input maxLength={200} value={expenseForm.nama_kegiatan} onChange={(event) => setExpenseForm((current) => ({ ...current, nama_kegiatan: event.target.value }))} placeholder="Contoh: reagen untuk pengujian sampel" /></label>
        <label className="grid gap-1 text-sm">Tanggal pengajuan *<Input type="date" value={expenseForm.tanggal} onChange={(event) => setExpenseForm((current) => ({ ...current, tanggal: event.target.value }))} /></label>
        <label className="grid gap-1 text-sm">Nominal *<MoneyInput value={expenseForm.jumlah} onValueChange={(value) => setExpenseForm((current) => ({ ...current, jumlah: value }))} placeholder="0" /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Rincian dan alasan<textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={expenseForm.keterangan} onChange={(event) => setExpenseForm((current) => ({ ...current, keterangan: event.target.value }))} placeholder="Jumlah dan satuan barang untuk order ini" /></label>
      </div>
      <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Saldo OPS_KANTOR dicadangkan setelah KARWAS menyetujui. Bendahara mencatat pengeluaran setelah pembayaran dilakukan.</p>
      {expenseError && <Alert variant="destructive"><AlertDescription>{expenseError}</AlertDescription></Alert>}
    </Modal>

    <Modal
      open={Boolean(expenseDetail)}
      onClose={() => { setExpenseDetail(null); setReviewMode(false); setReviewError(""); }}
      title={reviewMode ? "Review Pengajuan Belanja Retail" : "Rincian Pengajuan Belanja Retail"}
      description={expenseDetail ? `${expenseDetail.nomor_pengajuan} · ${job.nomor_job} · ${job.nama_pelanggan}` : undefined}
      size="lg"
      bodyClassName="space-y-4"
      footer={<>
        <Button variant="outline" onClick={() => { setExpenseDetail(null); setReviewMode(false); }}>Tutup</Button>
        {expenseDetail && !reviewMode && canManage && expenseDetail.status === "DIAJUKAN" && <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"><Paperclip size={14} />{supportFile ? supportFile.name : "Lampirkan dokumen"}<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => { setSupportFile(event.target.files?.[0] ?? null); setSupportError(""); }} /></label>}
        {expenseDetail && !reviewMode && supportFile && <Button variant="outline" disabled={uploadSupportMutation.isPending} onClick={() => uploadSupportMutation.mutate({ id: String(expenseDetail.id), file: supportFile })}>{uploadSupportMutation.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Paperclip size={15} />} Unggah</Button>}
        {expenseDetail && reviewMode && canReviewExpense && expenseDetail.status === "DIAJUKAN" && <>
          <Button variant="destructive" disabled={reviewExpenseMutation.isPending} onClick={() => reviewExpense(false)}>{reviewExpenseMutation.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <X size={15} />} Tolak</Button>
          <Button disabled={reviewExpenseMutation.isPending} onClick={() => reviewExpense(true)}>{reviewExpenseMutation.isPending ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />} Setujui & Reservasi</Button>
        </>}
      </>}
    >
      {expenseDetail && <>
        <ModalSection title="Rincian kebutuhan dan sumber dana">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            {[
              ["Nomor pengajuan", expenseDetail.nomor_pengajuan],
              ["Status", expenseStatus(String(expenseDetail.status ?? "")).label],
              ["Order retail", `${job.nomor_job} · ${job.nama_pelanggan}`],
              ["Unit pelaksana", job.unit_pelaksana?.nama_unit ?? "—"],
              ["Barang / kebutuhan", expenseDetail.nama_kegiatan],
              ["Tanggal pengajuan", dateLabel(expenseDetail.tanggal)],
              ["Nominal", formatRupiah(expenseDetail.jumlah)],
              ["Sumber dana", `OPS_KANTOR · TA ${job.tahun_fiscal ?? "—"}`],
              ["Diajukan oleh", expenseDetail.pembuat?.nama ?? "—"],
              ["Keterangan", expenseDetail.keterangan ?? "—"],
            ].map(([label, value]) => <div key={String(label)} className="border-b py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium tabular-nums">{value}</dd></div>)}
          </dl>
        </ModalSection>
        <ModalSection title="Pemeriksaan dan pembayaran">
          <dl className="grid gap-x-6 sm:grid-cols-2">
            <div className="border-b py-2.5"><dt className="text-xs text-muted-foreground">Pemeriksa KARWAS</dt><dd className="mt-1 text-sm font-medium">{expenseDetail.pemeriksa?.nama ?? "Belum diperiksa"}</dd></div>
            <div className="border-b py-2.5"><dt className="text-xs text-muted-foreground">Catatan pemeriksa</dt><dd className="mt-1 text-sm font-medium">{expenseDetail.catatan_pemeriksa ?? "—"}</dd></div>
            <div className="border-b py-2.5"><dt className="text-xs text-muted-foreground">Nomor pembayaran</dt><dd className="mt-1 text-sm font-medium">{expenseDetail.nomor_pembayaran ?? "Belum dibayar"}</dd></div>
            <div className="border-b py-2.5"><dt className="text-xs text-muted-foreground">Tanggal bayar / Bendahara</dt><dd className="mt-1 text-sm font-medium">{expenseDetail.tanggal_bayar ? `${dateLabel(expenseDetail.tanggal_bayar)} · ${expenseDetail.pembayar?.nama ?? "—"}` : "—"}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-3 text-sm">
            {expenseDetail.file_dokumen && <a className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline" href={fileUrl(String(expenseDetail.file_dokumen))} target="_blank" rel="noreferrer"><Paperclip size={14} /> Dokumen pendukung</a>}
            {expenseDetail.file_bukti_bayar && <a className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline" href={fileUrl(String(expenseDetail.file_bukti_bayar))} target="_blank" rel="noreferrer"><FileText size={14} /> Bukti pembayaran</a>}
            {!expenseDetail.file_dokumen && !expenseDetail.file_bukti_bayar && <span className="text-muted-foreground">Belum ada dokumen terlampir.</span>}
          </div>
          {supportError && <Alert variant="destructive"><AlertDescription>{supportError}</AlertDescription></Alert>}
        </ModalSection>
        {reviewMode && <label className="grid gap-1 text-sm">Catatan KARWAS <span className="text-xs text-muted-foreground">Wajib diisi jika pengajuan ditolak.</span><textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Catatan pemeriksaan atau alasan penolakan" /></label>}
        {reviewError && <Alert variant="destructive"><AlertDescription>{reviewError}</AlertDescription></Alert>}
      </>}
    </Modal>

    <Modal
      open={Boolean(paymentExpense)}
      onClose={() => { setPaymentExpense(null); setPaymentError(""); }}
      title="Catat Pembayaran Belanja Retail"
      description={paymentExpense ? `${paymentExpense.nomor_pengajuan} · ${paymentExpense.nama_kegiatan} · ${formatRupiah(paymentExpense.jumlah)}` : undefined}
      size="md"
      bodyClassName="space-y-4"
      footer={<><Button variant="outline" onClick={() => setPaymentExpense(null)}>Batal</Button><Button disabled={payExpenseMutation.isPending} onClick={payExpense}>{payExpenseMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={15} />} Simpan Pembayaran</Button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Nomor pembayaran *<Input maxLength={100} value={paymentForm.nomor_pembayaran} onChange={(event) => setPaymentForm((current) => ({ ...current, nomor_pembayaran: event.target.value }))} /></label>
        <label className="grid gap-1 text-sm">Tanggal bayar *<Input type="date" value={paymentForm.tanggal_bayar} onChange={(event) => setPaymentForm((current) => ({ ...current, tanggal_bayar: event.target.value }))} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Bukti pembayaran *<Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setPaymentFile(event.target.files?.[0] ?? null)} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">Catatan<textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={paymentForm.catatan} onChange={(event) => setPaymentForm((current) => ({ ...current, catatan: event.target.value }))} /></label>
      </div>
      {paymentError && <Alert variant="destructive"><AlertDescription>{paymentError}</AlertDescription></Alert>}
    </Modal>

    <Modal open={lhuOpen} onClose={() => setLhuOpen(false)} title="Input LHU dan Siapkan Tagihan" description={`${job.nomor_job} · ${job.nama_pelanggan}`} size="md" bodyClassName="space-y-4" footer={<><Button variant="outline" onClick={() => setLhuOpen(false)}>Batal</Button><Button disabled={readyInvoiceMutation.isPending} onClick={submitLhu}>{readyInvoiceMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <FileCheck2 size={15} />} Simpan LHU · Siap Ditagih</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Nomor LHU *<Input maxLength={100} value={lhuNumber} onChange={(event) => setLhuNumber(event.target.value)} /></label>
        <label className="grid gap-1 text-sm">Tanggal LHU *<Input type="date" value={lhuDate} onChange={(event) => setLhuDate(event.target.value)} /></label>
        <label className="grid gap-1 text-sm sm:col-span-2">File LHU *<Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setLhuFile(event.target.files?.[0] ?? null)} /></label>
      </div>
      {lhuError && <Alert variant="destructive"><AlertDescription>{lhuError}</AlertDescription></Alert>}
    </Modal>
  </section>;
}
