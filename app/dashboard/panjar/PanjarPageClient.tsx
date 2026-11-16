"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, Circle, CircleCheck, CircleX, ClipboardList, Clock3, Eye, HandCoins, LoaderCircle, Plus, Receipt, RotateCcw, ShieldCheck, User, WalletCards, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal, ModalDetailGrid, ModalDetailItem, ModalSection } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { EmptyData } from "@/components/loading/EmptyData";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MoneyFlow, type MoneyFlowItem } from "@/components/common/MoneyFlow";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { WorkflowDiagram, type WorkflowAction, type WorkflowStage } from "@/components/common/WorkflowDiagram";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { PurchaseRequestReviewModal } from "@/components/pengajuan-belanja/PurchaseRequestReviewModal";
import { PanjarActionModal, PANJAR_STATUS_LABELS, panjarModeOf } from "@/components/panjar/PanjarActionModal";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { CreatePengajuanBelanjaDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type Form = { ro_id: string; nama_kegiatan: string; no_kuitansi: string; tanggal: string; jumlah: string; keterangan: string };
type ProjectRow = { id: string; no_kontrak?: string; nama_proyek?: string; tahun_fiscal?: number };
type PaymentForm = { nomor_pembayaran: string; tanggal_bayar: string; catatan?: string; dana_sumber_id?: string };

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (): Form => ({ ro_id: "", nama_kegiatan: "", no_kuitansi: "", tanggal: today(), jumlah: "", keterangan: "" });
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
function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
function roDisplayName(ro: Row) {
  return String(ro.nama_ro ?? "RO");
}
function roAccountingReference(ro: Row) {
  return ro.kode_mak ? `MAK ${String(ro.kode_mak)}` : ro.nomor_job ? `Job ${String(ro.nomor_job)}` : null;
}

const panjarStageTone = (status?: string): "ok" | "warn" | "danger" | "neutral" => {
  if (status === "SELESAI") return "ok";
  if (status === "MENUNGGU_PENGEMBALIAN" || status === "DIAJUKAN_PERTANGGUNGJAWABAN" || status === "MENUNGGU_DANA_TAMBAHAN") return "warn";
  if (status === "DITOLAK_KARWAS" || status === "DITOLAK_KEUANGAN") return "danger";
  return "neutral";
};
const pengajuanTone = (status?: string): "ok" | "warn" | "danger" | "neutral" => {
  if (["DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(status ?? "")) return "ok";
  if (status === "DIAJUKAN") return "warn";
  if ((status ?? "").startsWith("DITOLAK_") || status === "DIBATALKAN") return "danger";
  return "neutral";
};
const pengajuanStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DISETUJUI_KARWAS: "Menunggu Keuangan",
  DITOLAK_KARWAS: "Ditolak KARWAS",
  DISETUJUI_KEUANGAN: "Menunggu Kabag",
  DITOLAK_KEUANGAN: "Ditolak Keuangan",
  DISETUJUI_KABAG: "Menunggu Bendahara",
  DITOLAK_KABAG: "Ditolak Kabag",
  DIBAYAR: "Dana dicairkan",
  DIBATALKAN: "Dibatalkan",
};

type PanjarStep = { title: string; state: string; description: string };

/** Grouped detail block with an icon accent, used to give the panjar detail modal visual hierarchy. */
function PanjarDetailGroup({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border bg-white p-3.5">
      <div className="flex items-center gap-2.5 border-b pb-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <ModalDetailGrid className="sm:grid-cols-2">{children}</ModalDetailGrid>
    </div>
  );
}

/** Builds the waterfall/checkpoint stages for a panjar row, mirroring the Belanja detail checklist. */
function panjarSteps(request: Row, formatDate: (value: unknown) => string): PanjarStep[] {
  const pengajuanStatus = String(request?.status ?? "");
  const pembayaran = request?.pembayaran ?? null;
  const panjar = request?.panjar ?? null;
  const panjarStatus = String(panjar?.status ?? "");
  const pengembalian = panjar?.pengembalian ?? null;
  const rejected = pengajuanStatus.startsWith("DITOLAK_");
  const canceled = pengajuanStatus === "DIBATALKAN";
  const paid = pengajuanStatus === "DIBAYAR";
  const approved = ["DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(pengajuanStatus);
  const reviewed = Boolean(request?.diperiksa_pada) || approved || rejected;
  const submitted = Boolean(pengajuanStatus) && pengajuanStatus !== "DRAFT";
  const stopped = rejected || canceled;
  const panjarClosed = panjarStatus === "SELESAI";
  const shortfall = Number(panjar?.jumlah_kekurangan ?? 0);
  const needsTopUp = shortfall > 0;
  const accountabilityDone = ["MENUNGGU_DANA_TAMBAHAN", "MENUNGGU_PENGEMBALIAN", "SELESAI"].includes(panjarStatus);
  return [
    {
      title: "Pengajuan dikirim",
      state: submitted ? "done" : "waiting",
      description: submitted ? `${request?.pembuat?.nama ?? "Pemohon"} · ${formatDate(request?.diajukan_pada ?? request?.created_at)}` : "Pengajuan belum dikirim.",
    },
    {
      title: "Pemeriksaan KARWAS",
      state: rejected ? "rejected" : reviewed ? "done" : canceled ? "skipped" : submitted ? "active" : "waiting",
      description: rejected
        ? `Ditolak${request?.pemeriksa?.nama ? ` oleh ${request.pemeriksa.nama}` : ""} · ${formatDate(request?.diperiksa_pada)}${request?.catatan_pemeriksa ? ` · ${request.catatan_pemeriksa}` : ""}`
        : reviewed
          ? `Disetujui${request?.pemeriksa?.nama ? ` oleh ${request.pemeriksa.nama}` : ""} · reservasi pagu ${formatRupiah(request?.reservasi?.nominal ?? request?.jumlah)} · ${formatDate(request?.diperiksa_pada)}`
          : canceled
            ? "Proses dihentikan karena pengajuan dibatalkan."
            : "Menunggu pemeriksaan dan reservasi pagu oleh KARWAS.",
    },
    {
      title: "Validasi Keuangan",
      state:
        pengajuanStatus === "DITOLAK_KEUANGAN" ? "rejected" : ["DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(pengajuanStatus) ? "done" : stopped ? "skipped" : pengajuanStatus === "DISETUJUI_KARWAS" ? "active" : "waiting",
      description: request?.validator_keuangan?.nama
        ? `Diproses oleh ${request.validator_keuangan.nama} · ${formatDate(request?.divalidasi_keuangan_pada)}${request?.catatan_keuangan ? ` · ${request.catatan_keuangan}` : ""}`
        : "Menunggu validasi Keuangan.",
    },
    {
      title: "Persetujuan Kabag",
      state: pengajuanStatus === "DITOLAK_KABAG" ? "rejected" : ["DISETUJUI_KABAG", "DIBAYAR"].includes(pengajuanStatus) ? "done" : stopped ? "skipped" : pengajuanStatus === "DISETUJUI_KEUANGAN" ? "active" : "waiting",
      description: request?.validator_kabag?.nama
        ? `Diproses oleh ${request.validator_kabag.nama} · ${formatDate(request?.divalidasi_kabag_pada)}${request?.catatan_kabag ? ` · ${request.catatan_kabag}` : ""}`
        : "Menunggu persetujuan Kabag.",
    },
    {
      title: "Pencairan panjar",
      state: paid ? "done" : stopped ? "skipped" : pengajuanStatus === "DISETUJUI_KABAG" ? "active" : "waiting",
      description: paid
        ? `${pembayaran?.nomor_pembayaran ?? "Pembayaran tercatat"} · ${formatRupiah(pembayaran?.nominal ?? panjar?.nominal)} · ${formatDate(pembayaran?.tanggal_bayar)}`
        : stopped
          ? "Tidak dilanjutkan karena pengajuan ditolak/dibatalkan."
          : pengajuanStatus === "DISETUJUI_KABAG"
            ? "Disetujui Kabag dan menunggu pencairan oleh Bendahara Pengeluaran."
            : "Menunggu persetujuan berjenjang.",
    },
    {
      title: "Pertanggungjawaban",
      state: panjarStatus === "DIBAYARKAN" ? "active" : panjarStatus === "DITOLAK_KARWAS" ? "rejected" : accountabilityDone ? "done" : "waiting",
      description:
        panjarStatus === "DIBAYARKAN"
          ? `Panjar dicairkan ${formatRupiah(panjar?.nominal)}. Menunggu pemohon melaporkan realisasi dan bukti pertanggungjawaban.`
          : panjarStatus === "DIAJUKAN_PERTANGGUNGJAWABAN"
            ? `Diajukan ${formatDate(panjar?.diajukan_pada)} · realisasi ${formatRupiah(panjar?.jumlah_realisasi)} · menunggu tinjauan KARWAS.`
            : panjarStatus === "DITOLAK_KARWAS"
              ? `Ditolak${panjar?.pemeriksa?.nama ? ` oleh ${panjar.pemeriksa.nama}` : ""} · ${formatDate(panjar?.ditinjau_pada)}${panjar?.catatan_karwas ? ` · ${panjar.catatan_karwas}` : ""}`
              : accountabilityDone
                ? `Disetujui${panjar?.pemeriksa?.nama ? ` oleh ${panjar.pemeriksa.nama}` : ""} · realisasi ${formatRupiah(panjar?.jumlah_realisasi)}${needsTopUp ? ` · kurang ${formatRupiah(shortfall)}` : ` · sisa ${formatRupiah(panjar?.jumlah_pengembalian)}`} · ${formatDate(panjar?.ditinjau_pada)}`
                : "Menunggu pencairan panjar oleh Bendahara Pengeluaran.",
    },
    ...(needsTopUp
      ? [
          {
            title: "Pencairan dana tambahan",
            state: panjarStatus === "SELESAI" && panjar?.dana_tambahan_nomor ? "done" : panjarStatus === "MENUNGGU_DANA_TAMBAHAN" ? "active" : "waiting",
            description:
              panjarStatus === "SELESAI" && panjar?.dana_tambahan_nomor
                ? `Dana tambahan ${formatRupiah(panjar?.dana_tambahan_nominal)} dicairkan${panjar?.dana_tambahan_nomor ? ` · ${panjar.dana_tambahan_nomor}` : ""}${panjar?.dana_tambahan_tanggal ? ` · ${formatDate(panjar.dana_tambahan_tanggal)}` : ""}`
                : panjarStatus === "MENUNGGU_DANA_TAMBAHAN"
                  ? `Menunggu Bendahara Pengeluaran mencairkan dana tambahan ${formatRupiah(shortfall)} ke kamar dana sumber.`
                  : "Menunggu persetujuan KARWAS atas pertanggungjawaban.",
          } satisfies PanjarStep,
        ]
      : [
          {
            title: "Pengembalian sisa",
            state: panjarStatus === "SELESAI" ? "done" : panjarStatus === "MENUNGGU_PENGEMBALIAN" ? "active" : "waiting",
            description:
              panjarStatus === "SELESAI"
                ? `Panjar selesai · pengembalian ${formatRupiah(panjar?.jumlah_pengembalian)}${pengembalian?.nomor_penerimaan ? ` · ${pengembalian.nomor_penerimaan}` : ""}${pengembalian?.tanggal_diterima ? ` · ${formatDate(pengembalian.tanggal_diterima)}` : ""}`
                : panjarStatus === "MENUNGGU_PENGEMBALIAN"
                  ? `Menunggu Bendahara Pengeluaran mencatat penerimaan sisa ${formatRupiah(panjar?.jumlah_pengembalian)}${pengembalian?.dana_tujuan?.kategori_kamar ? ` ke kamar ${String(pengembalian.dana_tujuan.kategori_kamar).replaceAll("_", " ")}` : ""}.`
                  : "Menunggu pertanggungjawaban disetujui KARWAS.",
          } satisfies PanjarStep,
        ]),
  ];
}

const panjarWorkflowStages: WorkflowStage[] = [
  {
    title: "Ajukan panjar perjalanan",
    owner: "KOORDINATOR / SUBKOOR",
    icon: ClipboardList,
    color: "sky",
    summary: "Kirim kebutuhan panjar perjalanan dengan memilih proyek dan RO sumber.",
    result: "Pengajuan tercatat",
    next: "Pengajuan masuk antrean KARWAS untuk reservasi pagu RO.",
  },
  {
    title: "Persetujuan berjenjang",
    owner: "KARWAS · KEUANGAN · KABAG",
    icon: ShieldCheck,
    color: "violet",
    summary: "KARWAS mereservasi pagu, Keuangan memvalidasi, Kabag menyetujui.",
    result: "Siap dicairkan",
    next: "Bendahara Pengeluaran mencairkan panjar ke kamar sumber yang dipilih.",
  },
  {
    title: "Pencairan panjar",
    owner: "BENDAHARA PENGELUARAN",
    icon: HandCoins,
    color: "emerald",
    summary: "Catat nomor, tanggal, nominal, bukti pembayaran, dan kamar sumber panjar.",
    result: "Panjar diterima pemohon",
    next: "Setelah perjalanan, pemohon melaporkan realisasi dan sisa panjar.",
  },
  {
    title: "Pertanggungjawaban",
    owner: "PEMOHON → KARWAS",
    icon: WalletCards,
    color: "amber",
    summary: "Pemohon mengunggah bukti realisasi, KARWAS memeriksa kebenarannya.",
    result: "Realisasi disetujui atau ditolak",
    next: "Jika realisasi lebih kecil, sisa panjar menunggu penerimaan Bendahara Pengeluaran. Jika lebih besar, Bendahara Pengeluaran mencairkan dana tambahan (reimburse).",
  },
  {
    title: "Pengembalian sisa",
    owner: "BENDAHARA PENGELUARAN",
    icon: RotateCcw,
    color: "sky",
    summary: "Catat penerimaan sisa panjar ke kamar tujuan sesuai bukti penerimaan.",
    result: "Panjar selesai",
    next: "Sisa panjar kembali menambah saldo kamar dana tujuan dan tercatat di ledger.",
  },
];

export default function PanjarPageClient() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Row | null>(null);
  const [panjarAction, setPanjarAction] = useState<Row | null>(null);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [payment, setPayment] = useState<PaymentForm>(blankPayment);
  const [paymentFile, setPaymentFile] = useState<File | null>(null);
  const [paymentWallets, setPaymentWallets] = useState<Row[]>([]);
  const [paymentWalletsLoading, setPaymentWalletsLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("__all");
  const [projectFilter, setProjectFilter] = useState("__all");
  const [coordinatorFilter, setCoordinatorFilter] = useState("__all");
  const [fiscalYearFilter, setFiscalYearFilter] = useState("__all");
  const user = useCurrentUser();
  useEffect(() => setMounted(true), []);

  const role = user.data?.role?.toLowerCase() ?? "";
  const canCreate = mounted && ["superadmin", "koordinator", "subkoor"].includes(role);
  const isSuperadmin = role === "superadmin";
  const unitCode = user.data?.unitKerjaKode?.trim().toLocaleUpperCase("id-ID") ?? "";
  const charwasUnit = (process.env.NEXT_PUBLIC_UNIT_KODE_KARWAS ?? "").trim().toLocaleUpperCase("id-ID");
  const canReview = isSuperadmin || role === "keu_karwas" || (!!charwasUnit && unitCode === charwasUnit);
  const financeUnit = (process.env.NEXT_PUBLIC_UNIT_KODE_KEUANGAN ?? "").trim().toLocaleUpperCase("id-ID");
  const kabagUnit = (process.env.NEXT_PUBLIC_UNIT_KODE_KABAG ?? "").trim().toLocaleUpperCase("id-ID");
  const canReviewKeuangan = isSuperadmin || (role === "subkoor" && !!financeUnit && unitCode === financeUnit);
  const canReviewKabag = isSuperadmin || ((role === "koordinator" || role === "subkoor") && !!kabagUnit && unitCode === kabagUnit);
  const canPay = isSuperadmin || role === "keu_bendahara_pengeluaran";
  const canSubmitPanjar = canCreate || role === "koordinator" || role === "subkoor";
  // Pertanggungjawaban panjar hanya boleh dilaporkan oleh pemohon (pemilik pengajuan).
  const isPanjarOwner = (request: Row | null) => Boolean(request) && String(request?.pembuat?.id ?? request?.dibuat_oleh_id ?? "") === String(user.data?.id ?? "");
  const panjarOwnerName = (request: Row | null) => String(request?.pembuat?.nama ?? "") || "pemohon pengajuan ini";

  const listQuery = use_query({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaListControllerList",
    params: {
      query: search || undefined,
      id_proyek: projectFilter === "__all" ? undefined : projectFilter,
      id_unit_koordinator: coordinatorFilter === "__all" ? undefined : coordinatorFilter,
      tahun_fiscal: fiscalYearFilter === "__all" ? undefined : Number(fiscalYearFilter),
      jenis_sumber: "PROYEK",
      limit: 200,
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

  const rows = useMemo(
    () =>
      listRows(listQuery.data).filter((row) => {
        if (row.jenis !== "PANJAR_PERJALANAN") return false;
        if (stageFilter === "__all") return true;
        return String(row.panjar?.status ?? "") === stageFilter;
      }),
    [listQuery.data, stageFilter],
  );

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
      .finally(() => {
        if (active) setPaymentWalletsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [paying?.id]);

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
  const coordinatorOptions = useMemo(() => filterUnits.map((unit) => ({ value: String(unit.id), label: `${String(unit.kode_unit ?? "")} · ${String(unit.nama_unit ?? "Koordinator")}` })), [filterUnits]);
  const projectOptions = useMemo(() => filterProjects.map((project) => ({ value: String(project.id), label: `${String(project.no_kontrak ?? "")} · ${String(project.nama_proyek ?? "Proyek")}` })), [filterProjects]);
  const fiscalYearOptions = useMemo(() => {
    const years = Array.isArray(filterOptionData.tahun_fiscal_list) ? filterOptionData.tahun_fiscal_list.map(Number) : filterRos.map((ro) => Number(ro.tahun_fiscal));
    return Array.from(new Set(years.filter((year) => year > 0)))
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: `TA ${year}` }));
  }, [filterOptionData.tahun_fiscal_list, filterRos]);

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
  const projectChoices = projects.map((project) => ({ value: String(project.id), label: `${project.no_kontrak ?? ""} · ${project.nama_proyek ?? "Proyek"} · TA ${project.tahun_fiscal ?? "—"}` }));
  const roOptions = ros.map((ro) => ({
    value: String(ro.id),
    label: [roDisplayName(ro), roAccountingReference(ro), `sisa ${formatRupiah(ro.sisa_saldo ?? ro.total_plafon)}`].filter(Boolean).join(" · "),
  }));
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId);
  const selectedRo = ros.find((ro) => String(ro.id) === form.ro_id);

  const reviewContextQuery = use_query({
    tag: "keuanganPengajuanBelanjaReviewContext",
    method: "pengajuanBelanjaReviewContextControllerReviewContext",
    params: { id: String(reviewing?.id ?? "") },
    enabled: Boolean(reviewing && ["DIAJUKAN", "DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN"].includes(String(reviewing.status))),
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

  const createMutation = use_mutation<unknown, Error, CreatePengajuanBelanjaDto & { jenis?: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaCreateControllerCreate",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async (data) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaCreateControllerCreate(data, { format: "json" }));
    },
    successMessage: "Pengajuan panjar perjalanan berhasil dibuat.",
    onSuccess: () => {
      setOpen(false);
      setForm(blankForm());
      setSelectedProjectId("");
      setError("");
    },
  });

  const field = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const reviewMutation = use_mutation<unknown, Error, { id: string; data: { disetujui: boolean; catatan?: string }; stage: "karwas" | "keuangan" | "kabag" }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaReviewControllerReview",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async ({ id, data, stage }) => {
      setBrowserToken();
      const path = stage === "karwas" ? "review" : stage === "keuangan" ? "validasi-keuangan" : "validasi-kabag";
      return requestHrisApi(`/api/pengajuan-belanja/${id}/${path}`, { method: "POST", body: JSON.stringify(data) });
    },
    successMessage: "Reservasi pagu panjar berhasil disimpan.",
    onSuccess: () => {
      setReviewing(null);
      setNote("");
      setError("");
    },
  });

  const payMutation = use_mutation<unknown, Error, { id: string; data: PaymentForm; file: File }>({
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
    successMessage: "Pencairan panjar berhasil dicatat.",
    onSuccess: () => {
      setPaying(null);
      setPayment(blankPayment());
      setPaymentFile(null);
      setError("");
    },
  });

  async function review(disetujui: boolean) {
    if (!reviewing) return;
    const stage = reviewing.status === "DIAJUKAN" ? "karwas" : reviewing.status === "DISETUJUI_KARWAS" ? "keuangan" : "kabag";
    try {
      setError("");
      await reviewMutation.mutateAsync({ id: String(reviewing.id), stage, data: { disetujui, catatan: note.trim() || undefined } });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Review panjar gagal disimpan."));
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
      setError("Pilih kamar sumber dana yang digunakan untuk mencairkan panjar.");
      return;
    }
    try {
      setError("");
      await payMutation.mutateAsync({
        id: String(paying.id),
        data: {
          nomor_pembayaran: payment.nomor_pembayaran.trim(),
          tanggal_bayar: payment.tanggal_bayar,
          dana_sumber_id: payment.dana_sumber_id,
          catatan: payment.catatan?.trim() || undefined,
        },
        file: paymentFile,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pencairan panjar gagal disimpan."));
    }
  }

  function startReview(request: Row) {
    setDetailRequest(null);
    setReviewing(request);
    setNote("");
    setError("");
  }

  function startPayment(request: Row) {
    setDetailRequest(null);
    setPaying(request);
    setPayment(blankPayment());
    setPaymentFile(null);
    setError("");
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
        jenis: "PANJAR_PERJALANAN",
        keterangan: form.keterangan.trim() || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pengajuan panjar gagal disimpan."));
    }
  }

  async function refreshDetail() {
    if (!panjarAction?.id) return;
    const response = await requestHrisApi(`/api/pengajuan-belanja/${encodeURIComponent(String(panjarAction.id))}`);
    const updated = objectData(response);
    if (updated.id) setDetailRequest((current) => (current && String(current.id) === String(updated.id) ? updated : current));
  }

  function startPanjarAction(request: Row) {
    setDetailRequest(null);
    setPanjarAction(request);
  }

  const detailPanjar = detailRequest?.panjar ?? null;
  const detailPanjarMode = panjarModeOf(detailRequest);
  const detailIsOwnPanjar = isPanjarOwner(detailRequest);
  const canActOnDetail =
    Boolean(detailPanjar) &&
    ((detailPanjarMode === "accountability" && canSubmitPanjar && detailIsOwnPanjar && ["DIBAYARKAN", "DITOLAK_KARWAS", "DITOLAK_KEUANGAN"].includes(String(detailPanjar?.status))) ||
      (detailPanjarMode === "review" && canReview) ||
      (detailPanjarMode === "topup" && canPay) ||
      (detailPanjarMode === "refund" && canPay));
  const detailNeedsOwnershipNotice = Boolean(detailPanjar) && detailPanjarMode === "accountability" && canSubmitPanjar && !detailIsOwnPanjar && ["DIBAYARKAN", "DITOLAK_KARWAS", "DITOLAK_KEUANGAN"].includes(String(detailPanjar?.status));
  const detailPanjarStatus = detailPanjar?.status ? String(detailPanjar.status) : "";
  const detailStatusLabel = detailPanjarStatus ? (PANJAR_STATUS_LABELS[detailPanjarStatus] ?? detailPanjarStatus.replaceAll("_", " ")) : (pengajuanStatusLabels[detailRequest?.status] ?? detailRequest?.status ?? "—");
  const detailStatusTone = detailPanjarStatus ? panjarStageTone(detailPanjarStatus) : pengajuanTone(detailRequest?.status);
  const detailSteps: PanjarStep[] = detailRequest ? panjarSteps(detailRequest, formatDateTime) : [];

  const detailAcceptedPanjar = detailPanjar ? Number(detailPanjar.nominal ?? detailRequest?.jumlah ?? 0) : Number(detailRequest?.jumlah ?? 0);
  const detailActual = Number(detailPanjar?.jumlah_realisasi ?? 0);
  const detailRefund = Number(detailPanjar?.jumlah_pengembalian ?? Math.max(0, detailAcceptedPanjar - detailActual));
  const detailShortfall = Number(detailPanjar?.jumlah_kekurangan ?? Math.max(0, detailActual - detailAcceptedPanjar));
  const detailNeedsTopUp = detailShortfall > 0;
  const detailPendingAmount = Boolean(detailPanjar) && (detailActual <= 0 || (detailActual < detailAcceptedPanjar && detailRefund <= 0 && !detailNeedsTopUp));
  const detailMoneyItems: MoneyFlowItem[] = detailNeedsTopUp
    ? [
        { label: "Panjar diterima", amount: detailAcceptedPanjar },
        { label: "Realisasi dilaporkan", amount: detailPendingAmount ? 0 : detailActual, operator: "−", tone: detailPendingAmount ? "text-slate-400" : undefined },
        { label: "Kekurangan (dana tambahan)", amount: detailPendingAmount ? 0 : detailShortfall, operator: "=", tone: "text-amber-700" },
      ]
    : [
        { label: "Panjar diterima", amount: detailAcceptedPanjar },
        { label: "Realisasi dilaporkan", amount: detailPendingAmount ? 0 : detailActual, operator: "−", tone: detailPendingAmount ? "text-slate-400" : undefined },
        { label: "Sisa pengembalian", amount: detailPendingAmount ? 0 : detailRefund, operator: "=", tone: "text-emerald-700" },
      ];
  const detailHeroTone =
    detailStatusTone === "ok"
      ? { ring: "border-emerald-200", glow: "from-emerald-50/80", chip: "text-emerald-700" }
      : detailStatusTone === "warn"
        ? { ring: "border-amber-200", glow: "from-amber-50/80", chip: "text-amber-700" }
        : detailStatusTone === "danger"
          ? { ring: "border-red-200", glow: "from-red-50/80", chip: "text-red-700" }
          : { ring: "border-slate-200", glow: "from-slate-50/80", chip: "text-slate-600" };

  const detailContext = detailRequest?.ro;

  const panjarActions: WorkflowAction[] = [
    {
      label: canCreate ? "Ajukan panjar" : "Lihat daftar panjar",
      onClick: () => {
        if (!canCreate) return;
        setForm(blankForm());
        setSelectedProjectId("");
        setError("");
        setOpen(true);
      },
    },
    { label: "Menunggu pertanggungjawaban", onClick: () => setStageFilter("DIBAYARKAN") },
    { label: "Menunggu tinjauan KARWAS", onClick: () => setStageFilter("DIAJUKAN_PERTANGGUNGJAWABAN") },
    { label: "Menunggu dana tambahan", onClick: () => setStageFilter("MENUNGGU_DANA_TAMBAHAN") },
    { label: "Menunggu pengembalian", onClick: () => setStageFilter("MENUNGGU_PENGEMBALIAN") },
  ];

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Panjar Perjalanan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Menu khusus panjar perjalanan: pengajuan, pencairan, pertanggungjawaban, sampai penerimaan sisa panjar dipisahkan dari daftar pengajuan belanja.</p>
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
            <Plus size={18} /> Ajukan Panjar
          </Button>
        )}
      </header>

      <WorkflowDiagram
        title="Alur Panjar Perjalanan"
        description="Setiap tahap panjar dipantau di menu ini tanpa tercampur dengan belanja langsung maupun belanja retail."
        stages={panjarWorkflowStages}
        actions={panjarActions}
        footerNote="Panjar memakai pagu RO proyek. Sisa panjar yang tidak terpakai wajib dikembalikan ke kamar dana tujuan dan menambah kembali saldo RO."
      />

      <Card id="panjar-list" className="scroll-mt-6">
        <CardContent className="pt-4">
          {listQuery.isLoading && (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Memuat data panjar…
            </p>
          )}
          {listQuery.isError && (
            <EmptyData
              label="Daftar panjar belum dapat dimuat."
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
              searchPlaceholder="Cari kegiatan, nomor pengajuan, atau kuitansi…"
              onSearchChange={setSearch}
              filters={[
                {
                  field: "panjar_status",
                  label: "Tahap Panjar",
                  options: Object.entries(PANJAR_STATUS_LABELS)
                    .filter(([value]) => value !== "DIAJUKAN_PERTANGGUNGJAWAN")
                    .map(([value, label]) => ({ value, label })),
                },
                { field: "koordinator", label: "Koordinator", options: coordinatorOptions },
                { field: "proyek", label: "Proyek", options: projectOptions },
                { field: "tahun_fiscal", label: "Tahun Fiskal", options: fiscalYearOptions },
              ]}
              filterLayout="balanced-4-3"
              filterValues={{ panjar_status: stageFilter, koordinator: coordinatorFilter, proyek: projectFilter, tahun_fiscal: fiscalYearFilter }}
              onFilterChange={(field, value) => {
                if (field === "panjar_status") setStageFilter(value);
                if (field === "koordinator") setCoordinatorFilter(value);
                if (field === "proyek") setProjectFilter(value);
                if (field === "tahun_fiscal") setFiscalYearFilter(value);
              }}
              emptyMessage="Belum ada panjar perjalanan yang tercatat."
              columns={[
                {
                  key: "nomor_pengajuan",
                  header: "Nomor Panjar",
                  className: "min-w-[11rem]",
                  render: (row) => (
                    <div>
                      <p className="font-medium">{row.nomor_pengajuan ?? "—"}</p>
                      <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Panjar perjalanan</span>
                    </div>
                  ),
                },
                {
                  key: "nama_kegiatan",
                  header: "Keperluan Perjalanan",
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
                  header: "Proyek / RO",
                  className: "min-w-[15rem]",
                  render: (row) =>
                    row.ro ? (
                      <div>
                        <span>
                          {row.ro.proyek?.no_kontrak ?? ""} · {row.ro.proyek?.nama_proyek ?? "Proyek"}
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
                  key: "panjar_nominal",
                  header: "Nilai Panjar",
                  className: "min-w-[10rem]",
                  render: (row) => (
                    <div>
                      <p className="font-semibold tabular-nums">{formatRupiah(row.panjar?.nominal ?? row.jumlah)}</p>
                      <p className="text-xs text-muted-foreground">Kamar: {String(row.panjar?.dana_sumber?.kategori_kamar ?? "—").replaceAll("_", " ")}</p>
                    </div>
                  ),
                },
                {
                  key: "panjar_progress",
                  header: "Realisasi / Sisa",
                  className: "min-w-[11rem]",
                  render: (row) => (
                    <div className="space-y-0.5 text-xs">
                      <p>
                        Realisasi <strong className="tabular-nums">{formatRupiah(row.panjar?.jumlah_realisasi)}</strong>
                      </p>
                      <p>
                        Sisa <strong className="tabular-nums">{formatRupiah(row.panjar?.jumlah_pengembalian)}</strong>
                      </p>
                    </div>
                  ),
                },
                { key: "tanggal", header: "Tanggal", render: (row) => (row.tanggal ? new Date(row.tanggal).toLocaleDateString("id-ID") : "—") },
                {
                  key: "panjar_status",
                  header: "Tahap Panjar",
                  render: (row) => {
                    const panjarStatus = row.panjar?.status;
                    const label = panjarStatus ? (PANJAR_STATUS_LABELS[panjarStatus] ?? String(panjarStatus).replaceAll("_", " ")) : (pengajuanStatusLabels[row.status] ?? row.status ?? "—");
                    const tone = panjarStatus ? panjarStageTone(panjarStatus) : pengajuanTone(row.status);
                    return <StatusBadge status={tone}>{label}</StatusBadge>;
                  },
                },
                {
                  key: "aksi",
                  header: "Aksi",
                  render: (row: Row) => (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailRequest(row)}>
                        <Eye size={15} /> Detail
                      </Button>
                      {((canReview && row.status === "DIAJUKAN") || (canReviewKeuangan && row.status === "DISETUJUI_KARWAS") || (canReviewKabag && row.status === "DISETUJUI_KEUANGAN")) && (
                        <Button size="sm" variant="outline" onClick={() => startReview(row)}>
                          Review
                        </Button>
                      )}
                      {canPay && row.status === "DISETUJUI_KABAG" && (
                        <Button size="sm" onClick={() => startPayment(row)}>
                          <HandCoins size={15} /> Cairkan
                        </Button>
                      )}
                      {(() => {
                        const mode = panjarModeOf(row);
                        const status = String(row.panjar?.status ?? "");
                        const allowed =
                          (mode === "accountability" && canSubmitPanjar && isPanjarOwner(row) && ["DIBAYARKAN", "DITOLAK_KARWAS", "DITOLAK_KEUANGAN"].includes(status)) ||
                          (mode === "review" && canReview) ||
                          (mode === "topup" && canPay) ||
                          (mode === "refund" && canPay);
                        if (!allowed) return null;
                        const label =
                          mode === "accountability"
                            ? status === "DIBAYARKAN"
                              ? "Ajukan Pertanggungjawaban"
                              : "Perbaiki Pertanggungjawaban"
                            : mode === "review"
                              ? "Tinjau Pertanggungjawaban"
                              : mode === "topup"
                                ? "Cairkan Dana Tambahan"
                                : "Catat Pengembalian";
                        return (
                          <Button size="sm" onClick={() => startPanjarAction(row)}>
                            {label}
                          </Button>
                        );
                      })()}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(detailRequest)}
        onClose={() => setDetailRequest(null)}
        title="Detail Panjar Perjalanan"
        description={detailRequest ? `${String(detailRequest.nomor_pengajuan ?? "")} · ${String(detailRequest.nama_kegiatan ?? "")}` : undefined}
        size="lg"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={
          <>
            <Button variant="outline" onClick={() => setDetailRequest(null)}>
              Tutup
            </Button>
            {detailRequest && ((canReview && detailRequest.status === "DIAJUKAN") || (canReviewKeuangan && detailRequest.status === "DISETUJUI_KARWAS") || (canReviewKabag && detailRequest.status === "DISETUJUI_KEUANGAN")) && (
              <Button variant="outline" onClick={() => startReview(detailRequest)}>
                Review Pengajuan
              </Button>
            )}
            {detailRequest && canPay && detailRequest.status === "DISETUJUI_KABAG" && (
              <Button onClick={() => startPayment(detailRequest)}>
                <HandCoins size={15} /> Cairkan Panjar
              </Button>
            )}
            {canActOnDetail && (
              <Button onClick={() => detailRequest && startPanjarAction(detailRequest)}>
                {detailPanjarMode === "accountability"
                  ? String(detailPanjar?.status) === "DIBAYARKAN"
                    ? "Ajukan Pertanggungjawaban"
                    : "Perbaiki Pertanggungjawaban"
                  : detailPanjarMode === "review"
                    ? "Tinjau Pertanggungjawaban"
                    : detailPanjarMode === "topup"
                      ? "Cairkan Dana Tambahan"
                      : "Catat Pengembalian"}
              </Button>
            )}
          </>
        }
      >
        {detailRequest && (
          <>
            <div className={`overflow-hidden rounded-xl border bg-gradient-to-br via-white to-white ${detailHeroTone.ring} ${detailHeroTone.glow}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-white/60 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm">
                    <WalletCards size={20} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Panjar perjalanan</p>
                    <p className="truncate text-sm font-semibold text-foreground">{detailRequest.nama_kegiatan ?? "Kegiatan perjalanan"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {detailRequest.nomor_pengajuan ?? "—"}
                      {detailRequest.no_kuitansi ? ` · Kuitansi ${String(detailRequest.no_kuitansi)}` : ""}
                      {detailContext ? ` · ${String(detailContext.kode_ro ?? "RO")}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <StatusBadge status={detailStatusTone}>{detailStatusLabel}</StatusBadge>
                  <p className="text-[11px] text-muted-foreground">Pengajuan: {pengajuanStatusLabels[detailRequest.status] ?? detailRequest.status ?? "—"}</p>
                </div>
              </div>
              <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-5">
                {[
                  { label: "Panjar diterima", value: detailAcceptedPanjar, tone: "text-foreground" },
                  { label: "Realisasi dilaporkan", value: detailPendingAmount ? null : detailActual, tone: detailPendingAmount ? "text-slate-400" : "text-foreground" },
                  detailNeedsTopUp
                    ? { label: "Kekurangan (dana tambahan)", value: detailPendingAmount ? null : detailShortfall, tone: "text-amber-700" }
                    : { label: "Sisa pengembalian", value: detailPendingAmount ? null : detailRefund, tone: "text-emerald-700" },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${metric.tone}`}>{metric.value === null ? "Menunggu laporan" : formatRupiah(metric.value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {detailNeedsOwnershipNotice && (
              <Alert>
                <AlertDescription>
                  Hanya pemohon <strong>{panjarOwnerName(detailRequest)}</strong> yang dapat melaporkan pertanggungjawaban panjar ini. Anda hanya dapat melihat detailnya.
                </AlertDescription>
              </Alert>
            )}

            <ModalSection title="Rincian panjar" description="Ringkasan pemohon, nilai, dan konteks proyek/RO untuk panjar perjalanan ini.">
              <MoneyFlow items={detailMoneyItems} />
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <PanjarDetailGroup icon={User} title="Pengajuan" hint={detailRequest.pembuat?.nama ?? "Pemohon belum tercatat"}>
                  <ModalDetailItem label="Pemohon" value={detailRequest.pembuat?.nama ?? "—"} />
                  <ModalDetailItem label="Tanggal pengajuan" value={formatDateTime(detailRequest.diajukan_pada ?? detailRequest.created_at)} />
                  <ModalDetailItem
                    label="Kamar sumber"
                    value={detailPanjar?.dana_sumber ? `${String(detailPanjar.dana_sumber?.kategori_kamar ?? "—").replaceAll("_", " ")} · TA ${detailPanjar.dana_sumber?.tahun_fiscal ?? "—"}` : "Belum dicairkan"}
                  />
                  <ModalDetailItem label="Nomor kuitansi" value={detailRequest.no_kuitansi || "Belum dicantumkan"} />
                  <ModalDetailItem label="Keterangan" className="sm:col-span-2" value={detailRequest.keterangan || "Tidak ada keterangan tambahan."} />
                </PanjarDetailGroup>
                <PanjarDetailGroup icon={Building2} title="Proyek & RO" hint={detailContext?.nama_ro ?? "RO belum tercatat"}>
                  <ModalDetailItem label="Proyek" value={`${detailContext?.proyek?.no_kontrak ?? "—"} · ${detailContext?.proyek?.nama_proyek ?? "—"}`} />
                  <ModalDetailItem label="RO" value={`${detailContext?.kode_ro ?? "—"} · ${detailContext?.nama_ro ?? "—"}`} />
                  <ModalDetailItem label="Koordinator" value={detailContext?.unit_koordinator?.nama_unit ?? "—"} />
                  <ModalDetailItem label="MAK" value={`${detailContext?.mak?.kode_mak ?? "—"} · ${detailContext?.mak?.nama_mak ?? "—"}`} />
                </PanjarDetailGroup>
              </div>
              <div className="pt-1">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Dokumen terkait</p>
                <DocumentLinks
                  documents={[
                    { label: "Bukti kuitansi", path: detailRequest.file_bukti },
                    { label: "Bukti pembayaran panjar", path: detailRequest.pembayaran?.file_bukti },
                    { label: "Bukti pertanggungjawaban", path: detailPanjar?.file_pertanggungjawaban },
                    { label: "Bukti pencairan dana tambahan", path: detailPanjar?.dana_tambahan_file_bukti },
                    { label: "Bukti penerimaan pengembalian", path: detailPanjar?.pengembalian?.file_bukti },
                    { label: "RAB RO", path: detailContext?.file_rab },
                  ]}
                />
              </div>
            </ModalSection>

            <ModalSection title="Progress panjar perjalanan" description="Checklist tahapan dari pengajuan sampai pengembalian sisa panjar.">
              <ol className="space-y-0">
                {detailSteps.map((step, index) => {
                  const StepIcon = step.state === "done" ? CircleCheck : step.state === "rejected" ? CircleX : step.state === "active" ? Clock3 : Circle;
                  const iconClass =
                    step.state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : step.state === "rejected"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : step.state === "active"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-400";
                  const stateLabel = step.state === "done" ? "Selesai" : step.state === "rejected" ? "Ditolak" : step.state === "active" ? "Sedang diproses" : step.state === "skipped" ? "Tidak dilanjutkan" : "Menunggu";
                  return (
                    <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < detailSteps.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-border" aria-hidden="true" />}
                      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${iconClass}`}>
                        <StepIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{step.title}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${step.state === "done" ? "bg-emerald-50 text-emerald-700" : step.state === "rejected" ? "bg-red-50 text-red-700" : step.state === "active" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {stateLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ModalSection>

            {detailRequest.pembayaran && (
              <ModalSection title="Pencairan panjar" description="Pencatatan pembayaran panjar oleh Bendahara Pengeluaran.">
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700">
                    <HandCoins size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700/80">Nominal dicairkan</p>
                    <p className="text-lg font-semibold tabular-nums text-emerald-800">{formatRupiah(detailRequest.pembayaran.nominal)}</p>
                  </div>
                </div>
                <PanjarDetailGroup icon={Receipt} title="Catatan pembayaran" hint={detailRequest.pembayaran.nomor_pembayaran ?? "Nomor pembayaran belum tercatat"}>
                  <ModalDetailItem label="Nomor pembayaran" value={detailRequest.pembayaran.nomor_pembayaran} />
                  <ModalDetailItem label="Dibayar oleh" value={detailRequest.pembayaran.pembayar?.nama ?? "Bendahara"} />
                  <ModalDetailItem label="Tanggal bayar" value={formatDateTime(detailRequest.pembayaran.tanggal_bayar)} />
                  <ModalDetailItem label="Nominal dicairkan" value={formatRupiah(detailRequest.pembayaran.nominal)} />
                </PanjarDetailGroup>
                {detailRequest.pembayaran.catatan && (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    <strong className="text-foreground">Catatan Bendahara:</strong> {String(detailRequest.pembayaran.catatan)}
                  </p>
                )}
              </ModalSection>
            )}

            {detailPanjar && (
              <ModalSection title="Pertanggungjawaban & pengembalian" description="KARWAS memeriksa realisasi; Bendahara mencatat penerimaan sisa panjar.">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Realisasi", value: detailActual, tone: "text-foreground" },
                    detailNeedsTopUp ? { label: "Kekurangan (dana tambahan)", value: detailShortfall, tone: "text-amber-700" } : { label: "Sisa dikembalikan", value: detailRefund, tone: "text-emerald-700" },
                    { label: "Status panjar", value: PANJAR_STATUS_LABELS[detailPanjarStatus] ?? detailPanjarStatus.replaceAll("_", " "), tone: detailHeroTone.chip },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
                      <p className={`mt-1 text-sm font-semibold tabular-nums ${metric.tone}`}>{typeof metric.value === "number" ? formatRupiah(metric.value) : metric.value}</p>
                    </div>
                  ))}
                </div>
                <PanjarDetailGroup icon={ShieldCheck} title="Tinjauan KARWAS" hint={detailPanjar.pemeriksa?.nama ?? "Belum diperiksa KARWAS"}>
                  <ModalDetailItem label="Diperiksa oleh" value={detailPanjar.pemeriksa?.nama ?? "Belum diperiksa KARWAS"} />
                  <ModalDetailItem label="Waktu pemeriksaan" value={formatDateTime(detailPanjar.ditinjau_pada ?? detailPanjar.diajukan_pada)} />
                  <ModalDetailItem label="Diajukan pada" value={formatDateTime(detailPanjar.diajukan_pada)} />
                  <ModalDetailItem label="Catatan KARWAS" value={detailPanjar.catatan_karwas ? String(detailPanjar.catatan_karwas) : "Tidak ada catatan."} />
                </PanjarDetailGroup>
                {detailNeedsTopUp && (
                  <>
                    <PanjarDetailGroup icon={HandCoins} title="Dana tambahan (reimburse)" hint={detailPanjar.dana_tambahan_nomor ?? (detailPanjarStatus === "MENUNGGU_DANA_TAMBAHAN" ? "Menunggu pencairan Bendahara" : "Belum dicairkan")}>
                      <ModalDetailItem
                        label="Kamar sumber"
                        value={detailPanjar.dana_tambahan_sumber ? `${String(detailPanjar.dana_tambahan_sumber?.kategori_kamar ?? "—").replaceAll("_", " ")} · TA ${detailPanjar.dana_tambahan_sumber?.tahun_fiscal ?? "—"}` : "—"}
                      />
                      <ModalDetailItem label="Nominal" value={formatRupiah(detailPanjar.dana_tambahan_nominal ?? detailShortfall)} />
                      <ModalDetailItem label="Nomor pembayaran" value={detailPanjar.dana_tambahan_nomor ?? "—"} />
                      <ModalDetailItem label="Tanggal bayar" value={detailPanjar.dana_tambahan_tanggal ? new Date(String(detailPanjar.dana_tambahan_tanggal)).toLocaleDateString("id-ID") : "—"} />
                      <ModalDetailItem label="Dibayar oleh" value={detailPanjar.dana_tambahan_pembayar?.nama ?? "—"} />
                    </PanjarDetailGroup>
                    {detailPanjar.dana_tambahan_catatan && (
                      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">Catatan Bendahara:</strong> {String(detailPanjar.dana_tambahan_catatan)}
                      </p>
                    )}
                  </>
                )}
                {!detailNeedsTopUp && (
                  <>
                    <PanjarDetailGroup icon={WalletCards} title="Penerimaan pengembalian" hint={detailPanjar.pengembalian ? String(detailPanjar.pengembalian.nomor_penerimaan ?? "Pengembalian tercatat") : "Belum dicatat Bendahara"}>
                      <ModalDetailItem
                        label="Kamar penerimaan"
                        value={
                          detailPanjar.pengembalian ? `${String(detailPanjar.pengembalian?.dana_tujuan?.kategori_kamar ?? "—").replaceAll("_", " ")} · TA ${detailPanjar.pengembalian?.dana_tujuan?.tahun_fiscal ?? "—"}` : "Belum dicatat"
                        }
                      />
                      <ModalDetailItem label="Nomor penerimaan" value={detailPanjar.pengembalian?.nomor_penerimaan ?? "—"} />
                      <ModalDetailItem label="Tanggal diterima" value={detailPanjar.pengembalian?.tanggal_diterima ? new Date(String(detailPanjar.pengembalian.tanggal_diterima)).toLocaleDateString("id-ID") : "—"} />
                      <ModalDetailItem label="Dicatat oleh" value={detailPanjar.pengembalian?.pencatat?.nama ?? "—"} />
                    </PanjarDetailGroup>
                    {detailPanjar.pengembalian?.catatan && (
                      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        <strong className="text-foreground">Catatan Bendahara:</strong> {String(detailPanjar.pengembalian.catatan)}
                      </p>
                    )}
                  </>
                )}
              </ModalSection>
            )}
          </>
        )}
      </Modal>

      <PanjarActionModal request={panjarAction} onClose={() => setPanjarAction(null)} onCompleted={refreshDetail} />

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
        onClose={() => setPaying(null)}
        title="Pencairan Panjar Perjalanan"
        description={paying ? `${String(paying.nomor_pengajuan ?? "")} · ${formatRupiah(paying.jumlah)}` : undefined}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Batal
            </Button>
            <Button disabled={payMutation.isPending} onClick={pay}>
              {payMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Catat Pencairan
            </Button>
          </>
        }
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Nomor pembayaran</span>
            <Input value={payment.nomor_pembayaran} onChange={(event) => setPayment((current) => ({ ...current, nomor_pembayaran: event.target.value }))} placeholder="Nomor bukti pembayaran" />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Tanggal bayar</span>
            <Input type="date" value={payment.tanggal_bayar} onChange={(event) => setPayment((current) => ({ ...current, tanggal_bayar: event.target.value }))} />
          </label>
          <div className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Kamar sumber dana</span>
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
          </div>
          <div className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Catatan</span>
            <Input value={payment.catatan ?? ""} onChange={(event) => setPayment((current) => ({ ...current, catatan: event.target.value }))} placeholder="Catatan pencairan (opsional)" />
          </div>
          <div className="sm:col-span-2">
            <DocumentUploadField label="Bukti pembayaran (PDF) *" accept=".pdf" value={paymentFile} onChange={setPaymentFile} disabled={payMutation.isPending} className="p-3 sm:p-3" />
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajukan Panjar Perjalanan"
        description="Pengajuan panjar akan menunggu pemeriksaan KARWAS."
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
          <div className="space-y-3 sm:col-span-2">
            <Card className="border-primary/20 bg-primary/[0.02]">
              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold">1. Pilih Proyek</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Cari proyek yang memiliki RO sebagai sumber pagu panjar.</p>
                </div>
                <FilterCombobox
                  options={projectChoices}
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
                      {selectedProject.no_kontrak} · Tahun fiskal {selectedProject.tahun_fiscal ?? "—"}
                    </p>
                  </div>
                )}
                {projectsQuery.isLoading && <p className="text-xs text-muted-foreground">Memuat daftar proyek…</p>}
                {projectsQuery.isError && <p className="text-xs text-destructive">Daftar proyek belum dapat dimuat.</p>}
              </CardContent>
            </Card>
            {selectedProjectId && (
              <Card className="animate-in fade-in slide-in-from-top-1 duration-200">
                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="text-sm font-semibold">
                      2. Pilih RO <span className="text-destructive">*</span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">Pagu RO ini yang akan direservasi saat KARWAS menyetujui panjar.</p>
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
                  {!rosQuery.isLoading && !rosQuery.isError && !ros.length && <p className="text-xs text-amber-700">Belum ada RO pada proyek ini.</p>}
                </CardContent>
              </Card>
            )}
          </div>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nama kegiatan / tujuan perjalanan *<Input maxLength={200} value={form.nama_kegiatan} onChange={(event) => field("nama_kegiatan", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal *<Input type="date" value={form.tanggal} onChange={(event) => field("tanggal", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Jumlah panjar *<MoneyInput value={form.jumlah} onValueChange={(value) => field("jumlah", value)} />
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
    </section>
  );
}
