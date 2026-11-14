"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, ClipboardList, Eye, LoaderCircle, Plus, ShieldCheck, WalletCards } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { EmptyData } from "@/components/loading/EmptyData";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { WorkflowDiagram, type WorkflowAction, type WorkflowStage } from "@/components/common/WorkflowDiagram";
import { PurchaseRequestDetailModals } from "@/components/pengajuan-belanja/PurchaseRequestDetailModals";
import { PurchaseRequestReviewModal } from "@/components/pengajuan-belanja/PurchaseRequestReviewModal";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { CreatePengajuanBelanjaDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type Form = { ro_id: string; nama_kegiatan: string; no_kuitansi: string; tanggal: string; jumlah: string; keterangan: string; jenis: "BELANJA_LANGSUNG" | "PANJAR_PERJALANAN" };
type ProjectRow = { id: string; kode_proyek?: string; nama_proyek?: string; tahun_fiscal?: number };
type PaymentForm = { nomor_pembayaran: string; tanggal_bayar: string; catatan?: string; dana_sumber_id?: string };
type ReviewPengajuanBelanjaDto = { disetujui: boolean; catatan?: string };
type BayarPengajuanBelanjaDto = { nomor_pembayaran: string; tanggal_bayar: string; catatan?: string; dana_sumber_id: string };
const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (): Form => ({ ro_id: "", nama_kegiatan: "", no_kuitansi: "", tanggal: today(), jumlah: "", keterangan: "", jenis: "BELANJA_LANGSUNG" });
const blankPayment = (): PaymentForm => ({ nomor_pembayaran: "", tanggal_bayar: today(), catatan: "" });
function listRows(value: unknown): Row[] {
  let current: any = value;
  for (let index = 0; index < 4 && current && typeof current === "object"; index += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.list)) return current.list;
    current = current.data;
  }
  return [];
}
function objectData(value: unknown): Row {
  let current: any = value;
  for (let index = 0; index < 4 && current && typeof current === "object"; index += 1) {
    if (current.data && typeof current.data === "object") current = current.data;
    else break;
  }
  return current && typeof current === "object" ? current : {};
}
function roDisplayName(ro: Row) {
  return String(ro.nama_ro ?? "RO");
}
function roAccountingReference(ro: Row) {
  return ro.kode_mak ? `MAK ${String(ro.kode_mak)}` : ro.nomor_job ? `Job ${String(ro.nomor_job)}` : null;
}
function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DISETUJUI_KARWAS: "Menunggu Keuangan",
  DITOLAK_KARWAS: "Ditolak KARWAS",
  DISETUJUI_KEUANGAN: "Menunggu Kabag",
  DITOLAK_KEUANGAN: "Ditolak Keuangan",
  DISETUJUI_KABAG: "Menunggu Bendahara Pengeluaran",
  DITOLAK_KABAG: "Ditolak Kabag",
  DIBAYAR: "Dibayar Bendahara Pengeluaran",
  DIBATALKAN: "Dibatalkan",
};
const statusTone = (status?: string): "ok" | "warn" | "danger" | "neutral" => {
  if (["DIBAYAR", "DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN", "DISETUJUI_KABAG"].includes(status ?? "")) return "ok";
  if (status === "DIAJUKAN") return "warn";
  if (["DITOLAK_KARWAS", "DITOLAK_KEUANGAN", "DITOLAK_KABAG", "DIBATALKAN"].includes(status ?? "")) return "danger";
  return "neutral";
};

const purchaseWorkflowStages: WorkflowStage[] = [
  {
    title: "Ajukan belanja",
    owner: "KOORDINATOR / SUBKOOR",
    icon: ClipboardList,
    color: "sky",
    summary: "Kirim kebutuhan dari RO proyek atau order layanan retail.",
    result: "Pengajuan tercatat",
    next: "Pengajuan masuk ke antrean KARWAS. Sumber dana mengikuti jenisnya: pagu RO untuk proyek atau OPS_KANTOR untuk retail.",
  },
  {
    title: "Review & reservasi",
    owner: "KEU_KARWAS",
    icon: ShieldCheck,
    color: "violet",
    summary: "Periksa kebutuhan, dokumen, dan kecukupan pagu atau saldo.",
    result: "Disetujui atau ditolak",
    next: "Jika disetujui, dana direservasi dan pengajuan diteruskan ke Bendahara. Jika ditolak, proses dihentikan dengan catatan pemeriksa.",
  },
  {
    title: "Validasi Keuangan",
    owner: "UNIT_KODE_KEUANGAN",
    icon: WalletCards,
    color: "emerald",
    summary: "Periksa kelengkapan administrasi dan kesesuaian pembiayaan.",
    result: "Disetujui atau ditolak",
    next: "Pengajuan yang disetujui diteruskan ke Kabag.",
  },
  {
    title: "Persetujuan Kabag",
    owner: "UNIT_KODE_KABAG",
    icon: ShieldCheck,
    color: "amber",
    summary: "Kabag memberi persetujuan akhir sebelum pembayaran.",
    result: "Siap dibayar",
    next: "Setelah disetujui Kabag, pengajuan diteruskan ke Bendahara Pengeluaran.",
  },
  {
    title: "Pembayaran",
    owner: "BENDAHARA PENGELUARAN",
    icon: CircleDollarSign,
    color: "sky",
    summary: "Catat nomor, tanggal, nominal, dan bukti pembayaran.",
    result: "Pembayaran tercatat",
    next: "Belanja dibukukan ke ledger sumber dana terkait.",
  },
];

export default function PengajuanBelanjaPageClient() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Row | null>(null);
  const [retailDetailRequest, setRetailDetailRequest] = useState<Row | null>(null);
  const [retailPaying, setRetailPaying] = useState<Row | null>(null);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [payment, setPayment] = useState<PaymentForm>(blankPayment);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentWallets, setPaymentWallets] = useState<Row[]>([]);
  const [paymentWalletsLoading, setPaymentWalletsLoading] = useState(false);
  const [panjarAction, setPanjarAction] = useState<Row | null>(null);
  const [panjarFile, setPanjarFile] = useState<File | null>(null);
  const [panjarForm, setPanjarForm] = useState({ jumlah_realisasi: "", jumlah_pengembalian: "", nomor_penerimaan: "", tanggal_diterima: today(), dana_tujuan_id: "", catatan: "" });
  const [refundWallets, setRefundWallets] = useState<Row[]>([]);
  const [panjarError, setPanjarError] = useState("");
  const [note, setNote] = useState("");
  const [retailReviewNote, setRetailReviewNote] = useState("");
  const [retailReviewError, setRetailReviewError] = useState("");
  const [retailPayment, setRetailPayment] = useState<PaymentForm>(blankPayment);
  const [retailPaymentFile, setRetailPaymentFile] = useState<File | null>(null);
  const [retailPaymentError, setRetailPaymentError] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const [projectFilter, setProjectFilter] = useState("__all");
  const [coordinatorFilter, setCoordinatorFilter] = useState("__all");
  const [roFilter, setRoFilter] = useState("__all");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("__all");
  const [sourceFilter, setSourceFilter] = useState("__all");
  const [unitPelaksanaFilter, setUnitPelaksanaFilter] = useState("__all");
  const user = useCurrentUser();
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const requestId = new URLSearchParams(window.location.search).get("pengajuan_id");
    if (!requestId) return;

    let active = true;
    requestHrisApi(`/api/pengajuan-belanja/${encodeURIComponent(requestId)}`)
      .then((response) => {
        const request = objectData(response);
        if (active && request.id) setDetailRequest(request);
      })
      .catch((cause) => {
        if (active) {
          window.dispatchEvent(new CustomEvent("api:error", { detail: { error: cause } }));
        }
      });

    return () => {
      active = false;
    };
  }, []);
  const role = user.data?.role?.toLowerCase() ?? "";
  const canViewRetail = user.data?.canViewRetail === true;
  const canCreate = mounted && ["superadmin", "koordinator", "subkoor"].includes(role);
  const isSuperadmin = role === "superadmin";
  const unitCode = user.data?.unitKerjaKode?.trim().toLocaleUpperCase("id-ID") ?? "";
  const canReviewKarwas = isSuperadmin || role === "keu_karwas";
  const financeUnit = (process.env.NEXT_PUBLIC_UNIT_KODE_KEUANGAN ?? "").trim().toLocaleUpperCase("id-ID");
  const kabagUnit = (process.env.NEXT_PUBLIC_UNIT_KODE_KABAG ?? "").trim().toLocaleUpperCase("id-ID");
  const canReviewKeuangan = isSuperadmin || (role === "subkoor" && !!financeUnit && unitCode === financeUnit);
  const canReviewKabag = isSuperadmin || ((role === "koordinator" || role === "subkoor") && !!kabagUnit && unitCode === kabagUnit);
  const canReview = canReviewKarwas || canReviewKeuangan || canReviewKabag;
  const canPay = isSuperadmin || role === "keu_bendahara_pengeluaran";
  const payingPanjar = paying?.jenis === "PANJAR_PERJALANAN";

  useEffect(() => {
    if (!paying?.id) {
      setPaymentWallets([]);
      return;
    }
    let active = true;
    setPaymentWalletsLoading(true);
    requestHrisApi(`/api/pengajuan-belanja/${encodeURIComponent(String(paying.id))}/sumber-dana`)
      .then((response) => {
        if (active) setPaymentWallets(listRows(response));
      })
      .catch((cause) => {
        if (active) {
          setPaymentWallets([]);
          setError(apiErrorMessage(cause, "Daftar kamar dana belum dapat dimuat."));
        }
      })
      .finally(() => { if (active) setPaymentWalletsLoading(false); });
    return () => { active = false; };
  }, [paying?.id]);

  const panjarMode = panjarAction?.panjar?.status === "DIAJUKAN_PERTANGGUNGJAWABAN" ? "review"
    : panjarAction?.panjar?.status === "MENUNGGU_PENGEMBALIAN" ? "refund" : "accountability";
  useEffect(() => {
    if (panjarMode !== "refund" || !panjarAction?.id) { setRefundWallets([]); return; }
    let active = true;
    requestHrisApi(`/api/pengajuan-belanja/${encodeURIComponent(String(panjarAction.id))}/sumber-dana`)
      .then((response) => { if (active) setRefundWallets(listRows(response)); })
      .catch((cause) => { if (active) setPanjarError(apiErrorMessage(cause, "Daftar kamar tujuan belum dapat dimuat.")); });
    return () => { active = false; };
  }, [panjarMode, panjarAction?.id]);
  const detailStatus = String(detailRequest?.status ?? "");
  const detailRejected = detailStatus.startsWith("DITOLAK_");
  const detailCanceled = detailStatus === "DIBATALKAN";
  const detailPaid = detailStatus === "DIBAYAR";
  const detailApproved = ["DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(detailStatus);
  const detailReviewed = Boolean(detailRequest?.diperiksa_pada) || detailApproved || detailRejected;
  const detailSubmitted = detailStatus !== "DRAFT" && Boolean(detailStatus);
  const detailSteps = detailRequest
    ? [
        {
          title: "Pengajuan dikirim",
          state: detailSubmitted ? "done" : "waiting",
          description: detailSubmitted ? `${detailRequest.pembuat?.nama ?? "Pemohon"} · ${formatDateTime(detailRequest.diajukan_pada ?? detailRequest.created_at)}` : "Pengajuan belum dikirim.",
        },
        {
          title: "Pemeriksaan KARWAS",
          state: detailRejected ? "rejected" : detailReviewed ? "done" : detailCanceled ? "skipped" : detailSubmitted ? "active" : "waiting",
          description: detailRejected
            ? `Ditolak ${detailRequest.pemeriksa?.nama ? `oleh ${detailRequest.pemeriksa.nama} ` : ""}· ${formatDateTime(detailRequest.diperiksa_pada)}${detailRequest.catatan_pemeriksa ? ` · ${detailRequest.catatan_pemeriksa}` : ""}`
            : detailReviewed
              ? `Disetujui ${detailRequest.pemeriksa?.nama ? `oleh ${detailRequest.pemeriksa.nama} ` : ""}· reservasi pagu ${formatRupiah(detailRequest.reservasi?.nominal ?? detailRequest.jumlah)} · ${formatDateTime(detailRequest.diperiksa_pada)}`
              : detailCanceled
                ? "Proses dihentikan karena pengajuan dibatalkan."
                : detailSubmitted
                  ? "Menunggu pemeriksaan dan reservasi pagu oleh KARWAS."
                  : "Menunggu pengajuan dikirim.",
        },
        {
          title: "Validasi Keuangan",
          state:
            detailStatus === "DITOLAK_KEUANGAN"
              ? "rejected"
              : ["DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(detailStatus)
                ? "done"
                : detailRejected || detailCanceled
                  ? "skipped"
                  : detailStatus === "DISETUJUI_KARWAS"
                    ? "active"
                    : "waiting",
          description: detailRequest.validator_keuangan?.nama
            ? `Diproses oleh ${detailRequest.validator_keuangan.nama} · ${formatDateTime(detailRequest.divalidasi_keuangan_pada)}${detailRequest.catatan_keuangan ? ` · ${detailRequest.catatan_keuangan}` : ""}`
            : "Menunggu validasi Keuangan.",
        },
        {
          title: "Persetujuan Kabag",
          state: detailStatus === "DITOLAK_KABAG" ? "rejected" : ["DISETUJUI_KABAG", "DIBAYAR"].includes(detailStatus) ? "done" : detailRejected || detailCanceled ? "skipped" : detailStatus === "DISETUJUI_KEUANGAN" ? "active" : "waiting",
          description: detailRequest.validator_kabag?.nama
            ? `Diproses oleh ${detailRequest.validator_kabag.nama} · ${formatDateTime(detailRequest.divalidasi_kabag_pada)}${detailRequest.catatan_kabag ? ` · ${detailRequest.catatan_kabag}` : ""}`
            : "Menunggu persetujuan Kabag.",
        },
        {
          title: "Pembayaran Bendahara Pengeluaran",
          state: detailPaid ? "done" : detailRejected || detailCanceled ? "skipped" : detailStatus === "DISETUJUI_KABAG" ? "active" : "waiting",
          description: detailPaid
            ? `${detailRequest.pembayaran?.nomor_pembayaran ?? "Pembayaran tercatat"} · ${formatRupiah(detailRequest.pembayaran?.nominal ?? detailRequest.jumlah)} · ${formatDateTime(detailRequest.pembayaran?.tanggal_bayar)}${detailRequest.pembayaran?.pembayar?.nama ? ` · ${detailRequest.pembayaran.pembayar.nama}` : ""}`
            : detailRejected
              ? "Tidak dilanjutkan karena pengajuan ditolak."
              : detailCanceled
                ? "Tidak dilanjutkan karena pengajuan dibatalkan."
                : detailStatus === "DISETUJUI_KABAG"
                  ? "Disetujui Kabag dan menunggu pembayaran Bendahara Pengeluaran."
                  : "Menunggu persetujuan berjenjang.",
        },
      ]
    : [];
  const retailDetailStatus = String(retailDetailRequest?.status ?? "");
  const retailDetailRejected = retailDetailStatus.startsWith("DITOLAK_");
  const retailDetailCanceled = retailDetailStatus === "DIBATALKAN";
  const retailDetailPaid = retailDetailStatus === "DIBAYAR";
  const retailDetailApproved = ["DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(retailDetailStatus);
  const retailDetailSteps = retailDetailRequest
    ? [
        {
          title: "Pengajuan dikirim",
          state: retailDetailStatus ? "done" : "waiting",
          description: retailDetailStatus ? `${retailDetailRequest.pembuat?.nama ?? "Pemohon"} · ${formatDateTime(retailDetailRequest.diajukan_pada ?? retailDetailRequest.created_at)}` : "Pengajuan belum dikirim.",
        },
        {
          title: "Pemeriksaan KARWAS",
          state: retailDetailRejected ? "rejected" : retailDetailApproved ? "done" : retailDetailCanceled ? "skipped" : "active",
          description: retailDetailRejected
            ? `Ditolak${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : ""} · ${formatDateTime(retailDetailRequest.diperiksa_pada)}`
            : retailDetailApproved
              ? `Disetujui${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : ""} · ${formatDateTime(retailDetailRequest.diperiksa_pada)}`
              : retailDetailCanceled
                ? "Tidak dilanjutkan karena pengajuan dibatalkan."
                : "Menunggu pemeriksaan KARWAS dan reservasi saldo OPS_KANTOR.",
        },
        {
          title: "Validasi Keuangan",
          state:
            retailDetailStatus === "DITOLAK_KEUANGAN"
              ? "rejected"
              : ["DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(retailDetailStatus)
                ? "done"
                : retailDetailRejected || retailDetailCanceled
                  ? "skipped"
                  : retailDetailStatus === "DISETUJUI_KARWAS"
                    ? "active"
                    : "waiting",
          description: retailDetailRequest.validator_keuangan?.nama
            ? `Diproses oleh ${retailDetailRequest.validator_keuangan.nama} · ${formatDateTime(retailDetailRequest.divalidasi_keuangan_pada)}${retailDetailRequest.catatan_keuangan ? ` · ${retailDetailRequest.catatan_keuangan}` : ""}`
            : "Menunggu validasi Keuangan.",
        },
        {
          title: "Persetujuan Kabag",
          state:
            retailDetailStatus === "DITOLAK_KABAG"
              ? "rejected"
              : ["DISETUJUI_KABAG", "DIBAYAR"].includes(retailDetailStatus)
                ? "done"
                : retailDetailRejected || retailDetailCanceled
                  ? "skipped"
                  : retailDetailStatus === "DISETUJUI_KEUANGAN"
                    ? "active"
                    : "waiting",
          description: retailDetailRequest.validator_kabag?.nama
            ? `Diproses oleh ${retailDetailRequest.validator_kabag.nama} · ${formatDateTime(retailDetailRequest.divalidasi_kabag_pada)}${retailDetailRequest.catatan_kabag ? ` · ${retailDetailRequest.catatan_kabag}` : ""}`
            : "Menunggu persetujuan Kabag.",
        },
        {
          title: "Pembayaran Bendahara Pengeluaran",
          state: retailDetailPaid ? "done" : retailDetailRejected || retailDetailCanceled ? "skipped" : retailDetailStatus === "DISETUJUI_KABAG" ? "active" : "waiting",
          description: retailDetailPaid
            ? `${retailDetailRequest.nomor_pembayaran ?? "Pembayaran tercatat"} · ${formatRupiah(retailDetailRequest.jumlah)} · ${formatDateTime(retailDetailRequest.tanggal_bayar)}${retailDetailRequest.pembayar?.nama ? ` · ${retailDetailRequest.pembayar.nama}` : ""}`
            : retailDetailRejected
              ? "Tidak dilanjutkan karena pengajuan ditolak."
              : retailDetailCanceled
                ? "Tidak dilanjutkan karena pengajuan dibatalkan."
                : retailDetailStatus === "DISETUJUI_KABAG"
                  ? "Disetujui Kabag dan menunggu pembayaran Bendahara Pengeluaran."
                  : "Menunggu persetujuan berjenjang.",
        },
      ]
    : [];
  const listQuery = use_query({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaListControllerList",
    params: {
      query: search || undefined,
      status: status === "__all" ? undefined : status,
      id_proyek: projectFilter === "__all" ? undefined : projectFilter,
      id_unit_koordinator: coordinatorFilter === "__all" ? undefined : coordinatorFilter,
      ro_id: roFilter === "__all" ? undefined : roFilter,
      tahun_fiscal: fiscalYearFilter === "__all" ? undefined : Number(fiscalYearFilter),
      jenis_sumber: sourceFilter === "__all" ? undefined : sourceFilter,
      unit_pelaksana_id: unitPelaksanaFilter === "__all" ? undefined : unitPelaksanaFilter,
      limit: 100,
      page: 1,
    },
    queryFn: async (params) => {
      setBrowserToken();
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") searchParams.set(key, String(value));
      });
      return requestHrisApi(`/api/pengajuan-belanja?${searchParams.toString()}`);
    },
  });
  const rows = useMemo(() => listRows(listQuery.data), [listQuery.data]);
  const filterOptionsQuery = use_query({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaFilterOptionsControllerFilterOptions",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaFilterOptionsControllerFilterOptions({ format: "json" }));
    },
  });
  const filterOptionData = objectData(filterOptionsQuery.data);
  const filterRos = Array.isArray(filterOptionData.ro_list) ? (filterOptionData.ro_list as Row[]) : [];
  const filterUnits = Array.isArray(filterOptionData.unit_koordinator_list) ? (filterOptionData.unit_koordinator_list as Row[]) : [];
  const filterProjects = Array.isArray(filterOptionData.proyek_list) ? (filterOptionData.proyek_list as Row[]) : [];
  const filterRetailUnits = Array.isArray(filterOptionData.unit_pelaksana_list) ? (filterOptionData.unit_pelaksana_list as Row[]) : [];
  const coordinatorOptions = useMemo(() => filterUnits.map((unit) => ({ value: String(unit.id), label: `${String(unit.kode_unit ?? "")} · ${String(unit.nama_unit ?? "Koordinator")}` })), [filterUnits]);
  const retailUnitOptions = useMemo(() => filterRetailUnits.map((unit) => ({ value: String(unit.id), label: `${String(unit.kode_unit ?? "")} · ${String(unit.nama_unit ?? "Unit pelaksana")}` })), [filterRetailUnits]);
  const filterProjectOptions = useMemo(() => {
    const coordinatorsByProject = new Map<string, Set<string>>();
    for (const ro of filterRos) {
      const projectId = ro.proyek?.id ? String(ro.proyek.id) : "";
      const unitName = ro.unit_koordinator?.nama_unit ? String(ro.unit_koordinator.nama_unit) : "";
      if (!projectId || !unitName) continue;
      const coordinators = coordinatorsByProject.get(projectId) ?? new Set<string>();
      coordinators.add(`Koor · ${unitName}`);
      coordinatorsByProject.set(projectId, coordinators);
    }
    return filterProjects.map((project) => {
      const badges = [...(coordinatorsByProject.get(String(project.id)) ?? [])];
      return {
        value: String(project.id),
        label: `${String(project.kode_proyek ?? "")} · ${String(project.nama_proyek ?? "Proyek")}`,
        badges: badges.length ? badges : ["Belum ada RO"],
      };
    });
  }, [filterProjects, filterRos]);
  const roFilterOptions = useMemo(
    () =>
      filterRos
        .filter(
          (ro) =>
            (projectFilter === "__all" || String(ro.proyek?.id) === projectFilter) &&
            (coordinatorFilter === "__all" || String(ro.unit_koordinator?.id) === coordinatorFilter) &&
            (fiscalYearFilter === "__all" || String(ro.tahun_fiscal) === fiscalYearFilter),
        )
        .map((ro) => ({ value: String(ro.id), label: `${String(ro.kode_ro ?? "")} · ${String(ro.nama_ro ?? "RO")}` })),
    [filterRos, projectFilter, coordinatorFilter, fiscalYearFilter],
  );
  const fiscalYearOptions = useMemo(() => {
    const years = Array.isArray(filterOptionData.tahun_fiscal_list) ? filterOptionData.tahun_fiscal_list.map(Number) : filterRos.map((ro) => Number(ro.tahun_fiscal));
    return Array.from(new Set(years.filter((year) => year > 0)))
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: `TA ${year}` }));
  }, [filterOptionData.tahun_fiscal_list, filterRos]);
  const reviewContextQuery = use_query({
    tag: "keuanganPengajuanBelanjaReviewContext",
    method: "pengajuanBelanjaReviewContextControllerReviewContext",
    params: { id: String(reviewing?.id ?? "") },
    enabled: Boolean(reviewing && canReview && ["DIAJUKAN", "DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN"].includes(String(reviewing.status))),
    queryFn: async ({ id }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaReviewContextControllerReviewContext(id, { format: "json" }));
    },
  });
  const reviewContext = objectData(reviewContextQuery.data);
  const reviewRequest = (reviewContext.pengajuan ?? reviewing ?? {}) as Row;
  const reviewProject = (reviewContext.proyek ?? {}) as Row;
  const reviewRoBalance = (reviewContext.ro_balance ?? {}) as Row;
  const reviewCashFlow = (reviewContext.arus_kas ?? {}) as Row;
  const reviewChecks = (reviewContext.pemeriksaan ?? {}) as Row;
  const reviewProjectRos = Array.isArray(reviewProject.ro_list) ? (reviewProject.ro_list as Row[]) : [];
  const reviewTerms = Array.isArray(reviewProject.termin_list) ? (reviewProject.termin_list as Row[]) : [];
  const reviewLedger = Array.isArray(reviewContext.ro_ledger?.list) ? (reviewContext.ro_ledger.list as Row[]) : [];
  const projectsQuery = use_query({
    tag: "masterProyek",
    method: "proyekGetDataControllerGetData",
    params: { limit: 200, page: 1 },
    enabled: open && canCreate,
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.masterProyek.proyekGetDataControllerGetData(params, { format: "json" }));
    },
  });
  const projects = listRows(projectsQuery.data) as ProjectRow[];
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const rosQuery = use_query({
    tag: "masterRo",
    method: "roGetDataControllerGetData",
    params: { limit: 200, page: 1, id_proyek: selectedProjectId || undefined },
    enabled: open && canCreate && Boolean(selectedProjectId),
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.masterRo.roGetDataControllerGetData(params, { format: "json" }));
    },
  });
  const ros = listRows(rosQuery.data);
  const projectOptions = projects.map((project) => ({ value: String(project.id), label: `${project.kode_proyek ?? ""} · ${project.nama_proyek ?? "Proyek"} · TA ${project.tahun_fiscal ?? "—"}` }));
  const roOptions = ros.map((ro) => ({
    value: String(ro.id),
    label: [roDisplayName(ro), roAccountingReference(ro), `sisa ${formatRupiah(ro.sisa_saldo ?? ro.total_plafon)}`].filter(Boolean).join(" · "),
  }));
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId);
  const selectedRo = ros.find((ro) => String(ro.id) === form.ro_id);
  const retailDetailJob = (retailDetailRequest?.retail_job ?? {}) as Row;
  const retailDetailDocuments = retailDetailRequest
    ? [
        { label: "Dokumen pengajuan belanja", path: retailDetailRequest.file_dokumen },
        { label: "Bukti pembayaran", path: retailDetailRequest.file_bukti_bayar },
        { label: "Surat permohonan layanan", path: retailDetailJob.file_permohonan },
        { label: "Tanda terima perconto", path: retailDetailJob.file_tanda_terima },
        { label: "Laporan hasil uji (LHU)", path: retailDetailJob.file_lhu },
        ...(Array.isArray(retailDetailJob.dokumen) ? retailDetailJob.dokumen.map((document: Row) => ({ label: document.nama_file ?? document.jenis ?? "Dokumen order retail", path: document.path_file })) : []),
      ]
    : [];
  const hasRetailDetailDocuments = retailDetailDocuments.some((document) => typeof document.path === "string" && document.path.length > 0);
  const createMutation = use_mutation<unknown, Error, CreatePengajuanBelanjaDto & { jenis?: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaCreateControllerCreate",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async (data) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaCreateControllerCreate(data, { format: "json" }));
    },
    successMessage: "Pengajuan belanja berhasil dibuat.",
    onSuccess: () => {
      setOpen(false);
      setForm(blankForm());
      setError("");
    },
  });
  const reviewMutation = use_mutation<unknown, Error, { id: string; data: ReviewPengajuanBelanjaDto; stage: "karwas" | "keuangan" | "kabag" }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaReviewControllerReview",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async ({ id, data, stage }) => {
      setBrowserToken();
      const path = stage === "karwas" ? "review" : stage === "keuangan" ? "validasi-keuangan" : "validasi-kabag";
      return requestHrisApi(`/api/pengajuan-belanja/${id}/${path}`, { method: "POST", body: JSON.stringify(data) });
    },
    successMessage: "Reservasi pagu berhasil disimpan.",
    onSuccess: () => {
      setReviewing(null);
      setNote("");
      setError("");
    },
  });
  const payMutation = use_mutation<unknown, Error, { id: string; data: BayarPengajuanBelanjaDto; file: File }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaBayarControllerBayar",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, data, file }) =>
      uploadHrisFile(`/api/pengajuan-belanja/${id}/bayar`, file, {
        nomor_pembayaran: data.nomor_pembayaran,
        tanggal_bayar: data.tanggal_bayar,
        ...(data.dana_sumber_id ? { dana_sumber_id: data.dana_sumber_id } : {}),
        ...(data.catatan ? { catatan: data.catatan } : {}),
      }),
    successMessage: "Pembayaran berhasil dicatat.",
    onSuccess: () => {
      setPaying(null);
      setPayment(blankPayment());
      setPaymentFile(null);
      setError("");
    },
  });
  const panjarSubmitMutation = use_mutation<unknown, Error, { id: string; jumlah_realisasi: number; jumlah_pengembalian: number; catatan: string; file: File }>({
    tag: "keuanganPengajuanBelanja",
    method: "submitTravelAdvanceAccountability",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, file, jumlah_realisasi, jumlah_pengembalian, catatan }) => uploadHrisFile(`/api/pengajuan-belanja/${id}/panjar/pertanggungjawaban`, file, { jumlah_realisasi: String(jumlah_realisasi), jumlah_pengembalian: String(jumlah_pengembalian), catatan }),
    successMessage: "Pertanggungjawaban panjar berhasil diajukan ke KARWAS.",
    onSuccess: async () => { await refreshPanjarDetail(); setPanjarAction(null); setPanjarFile(null); },
    onError: (cause) => setPanjarError(apiErrorMessage(cause, "Pertanggungjawaban panjar gagal diajukan.")),
  });
  const panjarReviewMutation = use_mutation<unknown, Error, { id: string; disetujui: boolean; catatan: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "reviewTravelAdvanceAccountability",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, ...data }) => { setBrowserToken(); return requestHrisApi(`/api/pengajuan-belanja/${id}/panjar/review`, { method: "POST", body: JSON.stringify(data) }); },
    successMessage: "Keputusan KARWAS atas panjar berhasil disimpan.",
    onSuccess: async () => { await refreshPanjarDetail(); setPanjarAction(null); },
    onError: (cause) => setPanjarError(apiErrorMessage(cause, "Review pertanggungjawaban gagal disimpan.")),
  });
  const panjarRefundMutation = use_mutation<unknown, Error, { id: string; file: File; nomor_penerimaan: string; tanggal_diterima: string; dana_tujuan_id: string; catatan: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "receiveTravelAdvanceRefund",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, file, ...data }) => uploadHrisFile(`/api/pengajuan-belanja/${id}/panjar/pengembalian`, file, data),
    successMessage: "Penerimaan pengembalian panjar berhasil dicatat.",
    onSuccess: async () => { await refreshPanjarDetail(); setPanjarAction(null); setPanjarFile(null); },
    onError: (cause) => setPanjarError(apiErrorMessage(cause, "Penerimaan pengembalian panjar gagal dicatat.")),
  });
  const retailReviewMutation = use_mutation<unknown, Error, { id: string; disetujui: boolean; stage: "karwas" | "keuangan" | "kabag" }>({
    tag: "keuanganPengajuanBelanja",
    method: "reviewRetailExpense",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("retail"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, disetujui, stage }) => {
      setBrowserToken();
      const path = stage === "karwas" ? "review" : stage === "keuangan" ? "validasi-keuangan" : "validasi-kabag";
      return requestHrisApi(`/api/retail/pengajuan-belanja/${id}/${path}`, {
        method: "POST",
        body: JSON.stringify({ disetujui, catatan: retailReviewNote.trim() || undefined }),
      });
    },
    successMessage: "Review pengajuan retail berhasil disimpan.",
    onSuccess: (response, variables) => {
      const updated = objectData(response);
      const reviewerKey = variables.stage === "karwas" ? "pemeriksa" : variables.stage === "keuangan" ? "validator_keuangan" : "validator_kabag";
      setRetailDetailRequest((current) =>
        current
          ? {
              ...current,
              ...updated,
              [reviewerKey]: updated[reviewerKey] ?? { nama: user.data?.nama ?? "Pemeriksa" },
            }
          : current,
      );
      setRetailReviewNote("");
      setRetailReviewError("");
      const responseMessage = response && typeof response === "object" && "message" in response && typeof response.message === "string" ? response.message : "";
      const stageLabel = variables.stage === "karwas" ? "KARWAS" : variables.stage === "keuangan" ? "Keuangan" : "Kabag";
      const fallbackMessage = variables.disetujui ? `Pengajuan belanja retail disetujui pada tahap ${stageLabel}.` : `Pengajuan belanja retail ditolak pada tahap ${stageLabel}.`;
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message: responseMessage || fallbackMessage } }));
    },
    onError: (cause) => setRetailReviewError(apiErrorMessage(cause, "Review pengajuan retail gagal disimpan.")),
  });
  const retailPayMutation = use_mutation<unknown, Error, { id: string; form: PaymentForm; file: File }>({
    tag: "keuanganPengajuanBelanja",
    method: "payRetailExpense",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("retail"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, form, file }) => uploadHrisFile(`/api/retail/pengajuan-belanja/${id}/bayar`, file, form),
    successMessage: "Pembayaran pengajuan retail berhasil dicatat.",
    onSuccess: (response) => {
      const updated = objectData(response);
      setRetailDetailRequest((current) => (current ? { ...current, ...updated } : current));
      setRetailPaying(null);
      setRetailPayment(blankPayment());
      setRetailPaymentFile(null);
      setRetailPaymentError("");
    },
    onError: (cause) => setRetailPaymentError(apiErrorMessage(cause, "Pembayaran pengajuan retail gagal dicatat.")),
  });
  const field = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function refreshPanjarDetail() {
    if (!panjarAction?.id) return;
    const response = await requestHrisApi(`/api/pengajuan-belanja/${encodeURIComponent(String(panjarAction.id))}`);
    const updated = objectData(response);
    if (updated.id) setDetailRequest(updated);
  }
  function startPanjarAction(request: Row) {
    setDetailRequest(null);
    setPanjarAction(request);
    setPanjarFile(null);
    setPanjarError("");
    setPanjarForm({
      jumlah_realisasi: String(request.panjar?.jumlah_realisasi ?? ""),
      jumlah_pengembalian: String(request.panjar?.jumlah_pengembalian ?? ""),
      nomor_penerimaan: "",
      tanggal_diterima: today(),
      dana_tujuan_id: "",
      catatan: "",
    });
  }
  async function submitPanjarAction(approved?: boolean) {
    if (!panjarAction) return;
    setPanjarError("");
    try {
      if (panjarMode === "accountability") {
        if (!panjarFile || panjarFile.size > 10 * 1024 * 1024 || !panjarFile.name.toLowerCase().endsWith(".pdf")) {
          setPanjarError("Dokumen pertanggungjawaban wajib berupa PDF maksimal 10 MB.");
          return;
        }
        const actual = Number(panjarForm.jumlah_realisasi);
        const refund = Number(panjarForm.jumlah_pengembalian);
        if (actual < 0 || refund < 0 || actual + refund !== Number(panjarAction.panjar?.nominal)) {
          setPanjarError("Realisasi dan pengembalian harus sama dengan total panjar yang diterima.");
          return;
        }
        await panjarSubmitMutation.mutateAsync({ id: String(panjarAction.id), jumlah_realisasi: actual, jumlah_pengembalian: refund, catatan: panjarForm.catatan.trim(), file: panjarFile });
      } else if (panjarMode === "review") {
        if (approved === false && !panjarForm.catatan.trim()) { setPanjarError("Alasan penolakan wajib diisi."); return; }
        await panjarReviewMutation.mutateAsync({ id: String(panjarAction.id), disetujui: approved === true, catatan: panjarForm.catatan.trim() });
      } else {
        if (!panjarForm.nomor_penerimaan.trim() || !panjarForm.tanggal_diterima || !panjarForm.dana_tujuan_id || !panjarFile) {
          setPanjarError("Nomor, tanggal, kamar tujuan, dan bukti penerimaan wajib diisi.");
          return;
        }
        if (!panjarFile.name.toLowerCase().endsWith(".pdf") || panjarFile.size > 10 * 1024 * 1024) { setPanjarError("Bukti penerimaan wajib berupa PDF maksimal 10 MB."); return; }
        await panjarRefundMutation.mutateAsync({ id: String(panjarAction.id), nomor_penerimaan: panjarForm.nomor_penerimaan.trim(), tanggal_diterima: panjarForm.tanggal_diterima, dana_tujuan_id: panjarForm.dana_tujuan_id, catatan: panjarForm.catatan.trim(), file: panjarFile });
      }
    } catch (cause) {
      setPanjarError(apiErrorMessage(cause, "Proses panjar gagal disimpan."));
    }
  }
  async function submit() {
    if (!form.ro_id || !form.nama_kegiatan.trim() || !form.tanggal || Number(form.jumlah) <= 0) {
      setError("RO, nama kegiatan, tanggal, dan jumlah lebih dari nol wajib diisi.");
      return;
    }
    try {
      setError("");
      await createMutation.mutateAsync({
        ro_id: form.ro_id,
        nama_kegiatan: form.nama_kegiatan.trim(),
        no_kuitansi: form.no_kuitansi.trim() || undefined,
        tanggal: form.tanggal,
        jumlah: Number(form.jumlah),
        jenis: form.jenis,
        keterangan: form.keterangan.trim() || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pengajuan belanja gagal disimpan."));
    }
  }
  async function review(disetujui: boolean) {
    if (!reviewing) return;
    const stage = reviewing.status === "DIAJUKAN" ? "karwas" : reviewing.status === "DISETUJUI_KARWAS" ? "keuangan" : "kabag";
    try {
      setError("");
      await reviewMutation.mutateAsync({ id: String(reviewing.id), stage, data: { disetujui, catatan: note.trim() || undefined } });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Review pengajuan gagal disimpan."));
    }
  }
  async function pay() {
    if (!paying) return;
    if (!payment.nomor_pembayaran.trim() || !payment.tanggal_bayar || !paymentFile) {
      setError("Nomor pembayaran, tanggal, dan bukti pembayaran PDF wajib diisi.");
      return;
    }
    if (!paymentFile.name.toLowerCase().endsWith(".pdf") || paymentFile.size > 10 * 1024 * 1024) {
      setError("Bukti pembayaran harus berupa PDF maksimal 10 MB.");
      return;
    }
    if (!payment.dana_sumber_id) {
      setError("Pilih kamar sumber dana yang digunakan untuk pembayaran.");
      return;
    }
    try {
      setError("");
      await payMutation.mutateAsync({
        id: String(paying.id),
        data: {
          nomor_pembayaran: payment.nomor_pembayaran.trim(),
          tanggal_bayar: payment.tanggal_bayar,
          dana_sumber_id: payment.dana_sumber_id!,
          catatan: payment.catatan?.trim() || undefined,
        },
        file: paymentFile,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pembayaran pengajuan gagal disimpan."));
    }
  }

  async function reviewRetail(disetujui: boolean) {
    if (!retailDetailRequest) return;
    if (!disetujui && !retailReviewNote.trim()) {
      setRetailReviewError("Alasan penolakan wajib diisi.");
      return;
    }
    try {
      setRetailReviewError("");
      const stage = retailDetailStatus === "DIAJUKAN" ? "karwas" : retailDetailStatus === "DISETUJUI_KARWAS" ? "keuangan" : "kabag";
      await retailReviewMutation.mutateAsync({ id: String(retailDetailRequest.id), disetujui, stage });
    } catch (cause) {
      setRetailReviewError(apiErrorMessage(cause, "Review pengajuan retail gagal disimpan."));
    }
  }

  async function payRetail() {
    if (!retailPaying) return;
    if (!retailPayment.nomor_pembayaran.trim() || !retailPayment.tanggal_bayar || !retailPaymentFile) {
      setRetailPaymentError("Nomor pembayaran, tanggal bayar, dan bukti pembayaran wajib diisi.");
      return;
    }
    try {
      setRetailPaymentError("");
      await retailPayMutation.mutateAsync({
        id: String(retailPaying.id),
        form: { ...retailPayment, nomor_pembayaran: retailPayment.nomor_pembayaran.trim(), catatan: retailPayment.catatan?.trim() },
        file: retailPaymentFile,
      });
    } catch (cause) {
      setRetailPaymentError(apiErrorMessage(cause, "Pembayaran pengajuan retail gagal dicatat."));
    }
  }

  function startRetailPayment(request: Row) {
    setRetailPaying(request);
    setRetailDetailRequest(null);
    setRetailPayment(blankPayment());
    setRetailPaymentFile(null);
    setRetailPaymentError("");
  }

  function showPurchaseQueue(nextStatus = "__all") {
    setSearch("");
    setStatus(nextStatus);
    setSourceFilter("__all");
    setProjectFilter("__all");
    setCoordinatorFilter("__all");
    setRoFilter("__all");
    setFiscalYearFilter("__all");
    setUnitPelaksanaFilter("__all");
    window.requestAnimationFrame(() => document.getElementById("pengajuan-belanja-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const purchaseWorkflowActions: WorkflowAction[] = [
    {
      label: canCreate ? "Ajukan belanja" : "Lihat pengajuan",
      onClick: () => {
        if (!canCreate) return showPurchaseQueue();
        setForm(blankForm());
        setSelectedProjectId("");
        setError("");
        setOpen(true);
      },
    },
    { label: "Lihat antrean KARWAS", onClick: () => showPurchaseQueue("DIAJUKAN") },
    { label: "Lihat siap dibayar", onClick: () => showPurchaseQueue("DISETUJUI_KARWAS") },
  ];

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pengajuan Belanja</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pantau pengajuan belanja proyek dan layanan retail dalam satu daftar, dengan sumber dana dan konteks masing-masing.</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setForm(blankForm());
              setSelectedProjectId("");
              setError("");
              setOpen(true);
            }}
          >
            <Plus size={18} /> Ajukan Belanja
          </Button>
        )}
      </header>
      <WorkflowDiagram
        title="Alur Pengajuan Belanja"
        description="Pilih tahap untuk memahami proses dan penanggung jawab, atau gunakan tombol untuk membuka antrean terkait."
        stages={purchaseWorkflowStages}
        actions={purchaseWorkflowActions}
        footerNote="Proyek memakai pagu RO yang disetujui Pimpinan; Proyek Retail memakai saldo OPS_KANTOR. Persetujuan KARWAS mereservasi sumber dana sebelum Bendahara mencatat pembayaran."
      />
      <Card id="pengajuan-belanja-list" className="scroll-mt-6">
        <CardContent className="pt-4">
          {listQuery.isLoading && (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Memuat pengajuan belanja…
            </p>
          )}
          {listQuery.isError && (
            <EmptyData
              label="Daftar pengajuan belanja belum dapat dimuat."
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                  Coba lagi
                </Button>
              }
            />
          )}
          {!listQuery.isLoading && !listQuery.isError && (
            <>
              {filterOptionsQuery.isError && (
                <EmptyData
                  className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden"
                  label="Opsi filter belum dapat dimuat."
                  action={
                    <Button type="button" variant="outline" size="sm" onClick={() => void filterOptionsQuery.refetch()}>
                      Coba lagi
                    </Button>
                  }
                />
              )}
              <DataTable
                rows={rows}
                rowKey={(row, index) => `${String(row.jenis_sumber ?? "PROYEK")}:${String(row.id ?? index)}`}
                remoteSearch
                searchValue={search}
                searchPlaceholder="Cari kegiatan / kuitansi…"
                onSearchChange={setSearch}
                filters={[
                  {
                    field: "jenis_sumber",
                    label: "Asal Pengajuan",
                    options: canViewRetail
                      ? [
                          { value: "PROYEK", label: "Proyek" },
                          { value: "LAYANAN_RETAIL", label: "Proyek Retail" },
                        ]
                      : [{ value: "PROYEK", label: "Proyek" }],
                  },
                  { field: "status", label: "Status", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
                  { field: "koordinator", label: "Koordinator", options: coordinatorOptions },
                  { field: "proyek", label: "Proyek", options: filterProjectOptions },
                  { field: "ro", label: "RO", options: roFilterOptions },
                  ...(canViewRetail ? [{ field: "unit_pelaksana_id", label: "Unit Pelaksana Retail", options: retailUnitOptions }] : []),
                  { field: "tahun_fiscal", label: "Tahun Fiskal", options: fiscalYearOptions },
                ]}
                filterLayout="balanced-4-3"
                filterValues={{ jenis_sumber: sourceFilter, status, koordinator: coordinatorFilter, proyek: projectFilter, ro: roFilter, unit_pelaksana_id: unitPelaksanaFilter, tahun_fiscal: fiscalYearFilter }}
                onFilterChange={(field, value) => {
                  if (field === "jenis_sumber") setSourceFilter(value);
                  if (field === "status") setStatus(value);
                  if (field === "koordinator") {
                    setCoordinatorFilter(value);
                    setRoFilter("__all");
                  }
                  if (field === "proyek") {
                    setProjectFilter(value);
                    setRoFilter("__all");
                  }
                  if (field === "ro") setRoFilter(value);
                  if (field === "unit_pelaksana_id") setUnitPelaksanaFilter(value);
                  if (field === "tahun_fiscal") {
                    setFiscalYearFilter(value);
                    setRoFilter("__all");
                  }
                }}
                columns={[
                  {
                    key: "nomor_pengajuan",
                    header: "Nomor",
                    className: "min-w-[11rem]",
                    render: (row) => (
                      <div>
                        <p className="font-medium">{row.nomor_pengajuan ?? "—"}</p>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.jenis_sumber === "LAYANAN_RETAIL" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}>
                          {row.jenis_sumber === "LAYANAN_RETAIL" ? "Proyek Retail" : "Proyek"}
                        </span>
                      </div>
                    ),
                  },
                  {
                    key: "nama_kegiatan",
                    header: "Kebutuhan",
                    className: "min-w-[13rem]",
                    render: (row) => (
                      <div>
                        <p className="font-medium">{row.nama_kegiatan ?? "—"}</p>
                        {row.keterangan && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{row.keterangan}</p>}
                      </div>
                    ),
                  },
                  {
                    key: "context",
                    header: "Proyek / Order Retail",
                    className: "min-w-[16rem]",
                    render: (row) =>
                      row.jenis_sumber === "LAYANAN_RETAIL" ? (
                        <div>
                          <span className="font-medium">
                            {row.retail_job?.nomor_job ?? "Order Retail"} · {row.retail_job?.nama_pelanggan ?? "Klien belum tercatat"}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {row.retail_job?.unit_pelaksana?.nama_unit ?? "Unit belum tercatat"} · {row.retail_job?.nomor_lhu ? `LHU ${row.retail_job.nomor_lhu}` : "LHU belum dicatat"}
                          </span>
                        </div>
                      ) : row.ro ? (
                        <div>
                          <span>
                            {row.ro.proyek?.kode_proyek ?? ""} · {row.ro.proyek?.nama_proyek ?? "Proyek"}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {row.ro.kode_ro} · {row.ro.nama_ro} · {row.ro.unit_koordinator?.nama_unit ?? "—"}
                          </span>
                        </div>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "dana",
                    header: "Sumber Dana",
                    className: "min-w-[10rem]",
                    render: (row) =>
                      row.jenis_sumber === "LAYANAN_RETAIL" ? (
                        <div>
                          <p className="font-medium">{row.dana?.kategori_kamar ?? "OPS_KANTOR"}</p>
                          <p className="text-xs text-muted-foreground">TA {row.dana?.tahun_fiscal ?? row.retail_job?.tahun_fiscal ?? "—"}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium">Kamar RO</p>
                          <p className="text-xs text-muted-foreground">
                            {row.ro?.mak?.kode_mak ?? "MAK belum terhubung"}
                            {row.pembayaran?.talangan ? " · talangan OPS_KANTOR" : ""}
                          </p>
                        </div>
                      ),
                  },
                  { key: "tanggal", header: "Tanggal", render: (row) => (row.tanggal ? new Date(row.tanggal).toLocaleDateString("id-ID") : "—") },
                  { key: "jumlah", header: "Jumlah", render: (row) => formatRupiah(row.jumlah) },
                  { key: "status", header: "Status", render: (row) => <StatusBadge status={statusTone(row.status)}>{statusLabels[row.status] ?? row.status ?? "—"}</StatusBadge> },
                  ...(canCreate || canReview || canPay
                    ? [
                        {
                          key: "aksi",
                          header: "Aksi",
                          render: (row: Row) => (
                            <div className="flex flex-wrap gap-2">
                              {row.jenis_sumber === "LAYANAN_RETAIL" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setRetailDetailRequest(row);
                                    setRetailReviewNote("");
                                    setRetailReviewError("");
                                  }}
                                >
                                  <Eye size={15} /> Detail Pengajuan
                                </Button>
                              )}
                              {row.jenis_sumber !== "LAYANAN_RETAIL" && (canCreate || canReview || canPay) && (
                                <Button size="sm" variant="outline" onClick={() => setDetailRequest(row)}>
                                  <Eye size={15} /> Detail
                                </Button>
                              )}
                              {((canReviewKarwas && row.status === "DIAJUKAN") || (canReviewKeuangan && row.status === "DISETUJUI_KARWAS") || (canReviewKabag && row.status === "DISETUJUI_KEUANGAN")) &&
                                row.jenis_sumber !== "LAYANAN_RETAIL" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReviewing(row);
                                      setNote("");
                                      setError("");
                                    }}
                                  >
                                    Review
                                  </Button>
                                )}
                              {canPay && row.jenis_sumber !== "LAYANAN_RETAIL" && row.status === "DISETUJUI_KABAG" && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setPaying(row);
                                    setPayment(blankPayment());
                                    setPaymentFile(null);
                                    setError("");
                                  }}
                                >
                                  <CircleDollarSign size={15} /> Bayar
                                </Button>
                              )}
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </>
          )}
        </CardContent>
      </Card>
      <PurchaseRequestDetailModals
        detailRequest={detailRequest}
        setDetailRequest={setDetailRequest}
        detailStatus={detailStatus}
        detailSteps={detailSteps}
        retailDetailRequest={retailDetailRequest}
        setRetailDetailRequest={setRetailDetailRequest}
        retailDetailStatus={retailDetailStatus}
        retailDetailRejected={retailDetailRejected}
        retailDetailCanceled={retailDetailCanceled}
        retailDetailPaid={retailDetailPaid}
        retailDetailApproved={retailDetailApproved}
        retailDetailSteps={retailDetailSteps}
        retailDetailJob={retailDetailJob}
        retailDetailDocuments={retailDetailDocuments}
        hasRetailDetailDocuments={hasRetailDetailDocuments}
        canReview={canReview}
        canReviewKarwas={canReviewKarwas}
        canReviewKeuangan={canReviewKeuangan}
        canReviewKabag={canReviewKabag}
        canPay={canPay}
        canSubmitPanjar={canCreate}
        onStartPanjar={startPanjarAction}
        retailReviewPending={retailReviewMutation.isPending}
        reviewRetail={reviewRetail}
        retailReviewNote={retailReviewNote}
        setRetailReviewNote={setRetailReviewNote}
        retailReviewError={retailReviewError}
        onStartRetailPayment={startRetailPayment}
        formatDateTime={formatDateTime}
        statusLabels={statusLabels}
        statusTone={statusTone}
      />{" "}
      <Modal
        open={Boolean(retailPaying)}
        onClose={() => {
          setRetailPaying(null);
          setRetailPaymentError("");
        }}
        title="Catat Pembayaran Belanja Retail"
        description={retailPaying ? `${String(retailPaying.nomor_pengajuan ?? "")} · ${String(retailPaying.nama_kegiatan ?? "")} · ${formatRupiah(retailPaying.jumlah)}` : undefined}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setRetailPaying(null)}>
              Batal
            </Button>
            <Button disabled={retailPayMutation.isPending} onClick={payRetail}>
              {retailPayMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={15} />} Simpan Pembayaran
            </Button>
          </>
        }
      >
        {retailPaying && (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {String(retailPaying.retail_job?.nomor_job ?? "Order retail")} · {String(retailPaying.retail_job?.nama_pelanggan ?? "Klien")}
              </p>
              <p className="mt-1 text-muted-foreground">Pembayaran dicatat sebagai pengeluaran OPS_KANTOR.</p>
              <p className="mt-2 font-semibold tabular-nums">Nominal {formatRupiah(retailPaying.jumlah)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                Nomor pembayaran *
                <Input maxLength={100} value={retailPayment.nomor_pembayaran} onChange={(event) => setRetailPayment((current) => ({ ...current, nomor_pembayaran: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">
                Tanggal bayar *
                <Input type="date" value={retailPayment.tanggal_bayar} onChange={(event) => setRetailPayment((current) => ({ ...current, tanggal_bayar: event.target.value }))} />
              </label>
              <div className="sm:col-span-2">
                <DocumentUploadField label="Bukti pembayaran *" accept=".pdf,.jpg,.jpeg,.png" value={retailPaymentFile} onChange={setRetailPaymentFile} disabled={retailPayMutation.isPending} className="p-3 sm:p-3" />
                <p className="mt-1 text-xs text-muted-foreground">Lampirkan bukti transfer atau dokumen pembayaran (PDF/JPG/PNG, maks. 10 MB).</p>
              </div>
              <label className="grid gap-1 text-sm sm:col-span-2">
                Catatan
                <textarea
                  className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  maxLength={500}
                  value={retailPayment.catatan}
                  onChange={(event) => setRetailPayment((current) => ({ ...current, catatan: event.target.value }))}
                  placeholder="Catatan pembayaran (opsional)"
                />
              </label>
            </div>
            {retailPaymentError && (
              <Alert variant="destructive">
                <AlertDescription>{retailPaymentError}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajukan Belanja"
        description="Pengajuan akan menunggu pemeriksaan KARWAS."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={createMutation.isPending} onClick={submit}>
              {createMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Kirim Pengajuan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Jenis pengajuan</label>
            <FilterCombobox
              label="Jenis pengajuan"
              value={form.jenis}
              onValueChange={(value) => field("jenis", value as Form["jenis"])}
              options={[
                { value: "BELANJA_LANGSUNG", label: "Belanja langsung" },
                { value: "PANJAR_PERJALANAN", label: "Panjar perjalanan" },
              ]}
            />
            {form.jenis === "PANJAR_PERJALANAN" && (
              <p className="mt-1 text-xs text-muted-foreground">Bendahara memilih kamar sumber saat mencairkan. Setelah perjalanan, pemohon melaporkan realisasi dan KARWAS memeriksa sebelum pengembalian diterima Bendahara.</p>
            )}
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold">1. Pilih Proyek</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Cari proyek yang memiliki RO untuk pengajuan belanja ini.</p>
                </div>
                <FilterCombobox
                  options={projectOptions}
                  value={selectedProjectId}
                  onValueChange={(value) => {
                    setSelectedProjectId(value === "__all" ? "" : value);
                    field("ro_id", "");
                  }}
                  label="Proyek"
                />
                {selectedProject && (
                  <div className="rounded-lg border border-primary/15 bg-background px-3 py-2.5">
                    <p className="text-xs font-medium text-muted-foreground">Proyek terpilih</p>
                    <p className="mt-0.5 font-semibold">{selectedProject.nama_proyek}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedProject.kode_proyek} · Tahun fiskal {selectedProject.tahun_fiscal ?? "—"}
                    </p>
                  </div>
                )}
                {projectsQuery.isLoading && <p className="text-xs text-muted-foreground">Memuat daftar proyek…</p>}
                {projectsQuery.isError && (
                  <EmptyData
                    className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden"
                    label="Daftar proyek belum dapat dimuat."
                    action={
                      <Button type="button" variant="outline" size="sm" onClick={() => void projectsQuery.refetch()}>
                        Coba lagi
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
            {selectedProjectId && (
              <Card className="animate-in fade-in slide-in-from-top-1 duration-200">
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">
                      2. Pilih RO <span className="text-destructive">*</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">Pilih RO yang akan menjadi sumber dana pengajuan.</p>
                  </div>
                  <FilterCombobox options={roOptions} value={form.ro_id} onValueChange={(value) => field("ro_id", value)} label="RO" />
                  {selectedRo && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                      <p className="text-xs font-medium text-emerald-800">RO terpilih</p>
                      <p className="mt-0.5 font-semibold text-emerald-950">{String(selectedRo.nama_ro ?? "RO")}</p>
                      <p className="mt-0.5 text-xs text-emerald-800">{[roAccountingReference(selectedRo), `Sisa saldo ${formatRupiah(selectedRo.sisa_saldo ?? selectedRo.total_plafon)}`].filter(Boolean).join(" · ")}</p>
                    </div>
                  )}
                  {rosQuery.isLoading && <p className="text-xs text-muted-foreground">Memuat daftar RO…</p>}
                  {rosQuery.isError && (
                    <EmptyData
                      className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden"
                      label="Daftar RO belum dapat dimuat."
                      action={
                        <Button type="button" variant="outline" size="sm" onClick={() => void rosQuery.refetch()}>
                          Coba lagi
                        </Button>
                      }
                    />
                  )}
                  {!rosQuery.isLoading && !rosQuery.isError && !ros.length && <p className="text-xs text-amber-700">Belum ada RO pada proyek ini.</p>}
                </CardContent>
              </Card>
            )}
          </div>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nama kegiatan *<Input maxLength={200} value={form.nama_kegiatan} onChange={(event) => field("nama_kegiatan", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal *<Input type="date" value={form.tanggal} onChange={(event) => field("tanggal", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Jumlah *<MoneyInput value={form.jumlah} onValueChange={(value) => field("jumlah", value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nomor kuitansi
            <Input maxLength={100} value={form.no_kuitansi} onChange={(event) => field("no_kuitansi", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Keterangan
            <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={form.keterangan} onChange={(event) => field("keterangan", event.target.value)} />
          </label>
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </Modal>
      <PurchaseRequestReviewModal
        reviewing={reviewing}
        setReviewing={setReviewing}
        reviewRequest={reviewRequest}
        reviewProject={reviewProject}
        reviewRoBalance={reviewRoBalance}
        reviewCashFlow={reviewCashFlow}
        reviewChecks={reviewChecks}
        reviewProjectRos={reviewProjectRos}
        reviewTerms={reviewTerms}
        reviewLedger={reviewLedger}
        reviewContextQuery={reviewContextQuery}
        reviewMutation={reviewMutation}
        reviewStage={reviewing?.status === "DIAJUKAN" ? "karwas" : reviewing?.status === "DISETUJUI_KARWAS" ? "keuangan" : "kabag"}
        review={review}
        note={note}
        setNote={setNote}
        error={error}
      />
      <Modal
        open={Boolean(paying)}
        onClose={() => {
          setPaying(null);
          setPaymentFile(null);
          setError("");
        }}
        title="Bayar Pengajuan"
        description={paying ? `${String(paying.nama_kegiatan)} · ${formatRupiah(paying.jumlah)}` : "Pembayaran pengajuan belanja."}
        size="lg"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setPaying(null);
                setPaymentFile(null);
                setError("");
              }}
            >
              Batal
            </Button>
            <Button disabled={payMutation.isPending || !paymentFile || paymentWalletsLoading || !payment.dana_sumber_id} onClick={pay}>
              {payMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={16} />} Simpan Pembayaran
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nomor pembayaran *
            <Input maxLength={100} value={payment.nomor_pembayaran} onChange={(event) => setPayment((current) => ({ ...current, nomor_pembayaran: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal bayar *
            <Input type="date" value={payment.tanggal_bayar} onChange={(event) => setPayment((current) => ({ ...current, tanggal_bayar: event.target.value }))} />
          </label>
        </div>
        <section className={`space-y-3 rounded-lg border p-4 ${payingPanjar ? "border-sky-200 bg-sky-50/60" : "border-emerald-200 bg-emerald-50/60"}`}>
          <div>
            <h3 className={`font-semibold ${payingPanjar ? "text-sky-950" : "text-emerald-950"}`}>Pilih kamar sumber dana</h3>
            <p className={`mt-1 text-sm ${payingPanjar ? "text-sky-800" : "text-emerald-800"}`}>
              {payingPanjar
                ? "Pilih kamar yang benar-benar digunakan untuk membayar panjar. Pengembalian sisa panjar dicatat ke kamar tujuan yang dipilih Bendahara."
                : "Pilih kamar yang benar-benar digunakan untuk membayar pengajuan ini. Jika tercatat sebagai talangan proyek, penerimaan invoice akan memulihkan dana ke kamar sumber yang sama."}
            </p>
          </div>
          <FilterCombobox
            label="Kamar sumber dana"
            value={payment.dana_sumber_id ?? ""}
            onValueChange={(value) => setPayment((current) => ({ ...current, dana_sumber_id: value }))}
            options={paymentWallets.map((wallet) => ({
              value: String(wallet.id),
              label: `${String(wallet.kategori_kamar ?? "Kamar").replaceAll("_", " ")} · ${String(wallet.unit_koordinator?.nama_unit ?? "Unit")} · tersedia ${formatRupiah(wallet.saldo_tersedia)}`,
            }))}
          />
          {paymentWalletsLoading && <p className="text-xs text-muted-foreground">Memuat kamar dana…</p>}
          {!paymentWalletsLoading && paymentWallets.length === 0 && <p className="text-xs text-amber-800">Belum ada kamar dana untuk tahun fiskal proyek ini.</p>}
        </section>
        <div>
          <DocumentUploadField label="Bukti pembayaran (PDF) *" accept=".pdf" value={paymentFile} onChange={setPaymentFile} disabled={payMutation.isPending} className="p-3 sm:p-3" />
          <p className="mt-1 text-xs text-muted-foreground">Unggah bukti transfer atau dokumen pembayaran dalam format PDF, maksimal 10 MB.</p>
        </div>
        <label className="grid gap-1 text-sm">
          Catatan
          <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={payment.catatan} onChange={(event) => setPayment((current) => ({ ...current, catatan: event.target.value }))} />
        </label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(panjarAction)}
        onClose={() => { setPanjarAction(null); setPanjarFile(null); setPanjarError(""); }}
        title={panjarMode === "review" ? "Tinjau Pertanggungjawaban Panjar" : panjarMode === "refund" ? "Catat Pengembalian Panjar" : "Ajukan Pertanggungjawaban Panjar"}
        description={panjarAction ? `${String(panjarAction.nomor_pengajuan)} · ${String(panjarAction.nama_kegiatan)} · Panjar ${formatRupiah(panjarAction.panjar?.nominal)}` : undefined}
        size="lg"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => { setPanjarAction(null); setPanjarFile(null); setPanjarError(""); }}>Batal</Button>
            {panjarMode === "review" ? (
              <>
                <Button variant="destructive" disabled={panjarReviewMutation.isPending} onClick={() => void submitPanjarAction(false)}>{panjarReviewMutation.isPending && <LoaderCircle className="animate-spin" size={15} />} Tolak</Button>
                <Button disabled={panjarReviewMutation.isPending} onClick={() => void submitPanjarAction(true)}>{panjarReviewMutation.isPending && <LoaderCircle className="animate-spin" size={15} />} Setujui</Button>
              </>
            ) : (
              <Button disabled={panjarSubmitMutation.isPending || panjarReviewMutation.isPending || panjarRefundMutation.isPending} onClick={() => void submitPanjarAction()}>
                {(panjarSubmitMutation.isPending || panjarRefundMutation.isPending) && <LoaderCircle className="animate-spin" size={15} />}
                {panjarMode === "refund" ? "Simpan Penerimaan" : "Kirim ke KARWAS"}
              </Button>
            )}
          </>
        }
      >
        {panjarAction && panjarMode === "accountability" && (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              Jumlah panjar <strong className="tabular-nums">{formatRupiah(panjarAction.panjar?.nominal)}</strong>. Isi realisasi biaya dan sisa yang dikembalikan; totalnya harus sama dengan panjar.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Realisasi biaya *<MoneyInput value={panjarForm.jumlah_realisasi} onValueChange={(value) => setPanjarForm((form) => ({ ...form, jumlah_realisasi: value }))} /></label>
              <label className="grid gap-1 text-sm">Pengembalian *<MoneyInput value={panjarForm.jumlah_pengembalian} onValueChange={(value) => setPanjarForm((form) => ({ ...form, jumlah_pengembalian: value }))} /></label>
            </div>
            <DocumentUploadField label="Bukti pertanggungjawaban (PDF) *" accept=".pdf" value={panjarFile} onChange={setPanjarFile} disabled={panjarSubmitMutation.isPending} className="p-3 sm:p-3" />
            <label className="grid gap-1 text-sm">Catatan untuk KARWAS<textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={panjarForm.catatan} onChange={(event) => setPanjarForm((form) => ({ ...form, catatan: event.target.value }))} /></label>
          </>
        )}
        {panjarAction && panjarMode === "review" && (
          <>
            <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 text-sm">
              <p>Realisasi dilaporkan <strong>{formatRupiah(panjarAction.panjar?.jumlah_realisasi)}</strong></p>
              <p>Sisa untuk dikembalikan <strong>{formatRupiah(panjarAction.panjar?.jumlah_pengembalian)}</strong></p>
              <p className="sm:col-span-2">Bukti: {panjarAction.panjar?.file_pertanggungjawaban ? <a className="text-primary underline" href={String(panjarAction.panjar.file_pertanggungjawaban)} target="_blank" rel="noreferrer">Buka dokumen</a> : "—"}</p>
            </div>
            <label className="grid gap-1 text-sm">Catatan pemeriksa<textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={panjarForm.catatan} onChange={(event) => setPanjarForm((form) => ({ ...form, catatan: event.target.value }))} placeholder="Wajib jika menolak" /></label>
          </>
        )}
        {panjarAction && panjarMode === "refund" && (
          <>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950">KARWAS menyetujui pengembalian sebesar <strong>{formatRupiah(panjarAction.panjar?.jumlah_pengembalian)}</strong>. Pilih kamar tujuan sesuai bukti penerimaan aktual.</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Nomor penerimaan *<Input maxLength={100} value={panjarForm.nomor_penerimaan} onChange={(event) => setPanjarForm((form) => ({ ...form, nomor_penerimaan: event.target.value }))} /></label>
              <label className="grid gap-1 text-sm">Tanggal diterima *<Input type="date" value={panjarForm.tanggal_diterima} onChange={(event) => setPanjarForm((form) => ({ ...form, tanggal_diterima: event.target.value }))} /></label>
            </div>
            <FilterCombobox label="Kamar tujuan penerimaan" value={panjarForm.dana_tujuan_id} onValueChange={(value) => setPanjarForm((form) => ({ ...form, dana_tujuan_id: value }))} options={refundWallets.map((wallet) => ({ value: String(wallet.id), label: `${String(wallet.kategori_kamar ?? "Kamar").replaceAll("_", " ")} · ${String(wallet.unit_koordinator?.nama_unit ?? "Unit")}`}))} />
            <DocumentUploadField label="Bukti penerimaan pengembalian (PDF) *" accept=".pdf" value={panjarFile} onChange={setPanjarFile} disabled={panjarRefundMutation.isPending} className="p-3 sm:p-3" />
            <label className="grid gap-1 text-sm">Catatan<textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={panjarForm.catatan} onChange={(event) => setPanjarForm((form) => ({ ...form, catatan: event.target.value }))} /></label>
          </>
        )}
        {panjarError && <Alert variant="destructive"><AlertDescription>{panjarError}</AlertDescription></Alert>}
      </Modal>
    </section>
  );
}
