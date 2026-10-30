"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Banknote, Check, Circle, CircleAlert, CircleCheck, CircleDollarSign, CircleX, ClipboardList, Clock3, Eye, FileText, LoaderCircle, Plus, ShieldCheck, WalletCards, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal, ModalDetailGrid, ModalDetailItem, ModalSection } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { MoneyFlow } from "@/components/common/MoneyFlow";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { BayarPengajuanBelanjaDto, CreatePengajuanBelanjaDto, ReviewPengajuanBelanjaDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type Form = { ro_id: string; nama_kegiatan: string; no_kuitansi: string; tanggal: string; jumlah: string; keterangan: string };
type ProjectRow = { id: string; kode_proyek?: string; nama_proyek?: string; tahun_fiscal?: number };
type PaymentForm = { nomor_pembayaran: string; tanggal_bayar: string; catatan: string };
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
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DISETUJUI_KARWAS: "Direservasi KARWAS",
  DITOLAK_KARWAS: "Ditolak KARWAS",
  DIBAYAR: "Dibayar Bendahara",
  DIBATALKAN: "Dibatalkan",
};
const statusTone = (status?: string): "ok" | "warn" | "danger" | "neutral" => {
  if (status === "DIBAYAR" || status === "DISETUJUI_KARWAS") return "ok";
  if (status === "DIAJUKAN") return "warn";
  if (status === "DITOLAK_KARWAS" || status === "DIBATALKAN") return "danger";
  return "neutral";
};

export default function PengajuanBelanjaPageClient() {
  const [open, setOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<Row | null>(null);
  const [retailDetailRequest, setRetailDetailRequest] = useState<Row | null>(null);
  const [retailPaying, setRetailPaying] = useState<Row | null>(null);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [payment, setPayment] = useState<PaymentForm>(blankPayment);
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
  const role = user.data?.role?.toLowerCase() ?? "";
  const canCreate = ["superadmin", "koordinator", "subkoor"].includes(role);
  const canReview = ["superadmin", "keu_karwas"].includes(role);
  const canPay = ["superadmin", "keu_bendahara"].includes(role);
  const detailStatus = String(detailRequest?.status ?? "");
  const detailRejected = detailStatus === "DITOLAK_KARWAS";
  const detailCanceled = detailStatus === "DIBATALKAN";
  const detailPaid = detailStatus === "DIBAYAR";
  const detailApproved = detailStatus === "DISETUJUI_KARWAS" || detailPaid;
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
          title: "Pembayaran Bendahara",
          state: detailPaid ? "done" : detailRejected || detailCanceled ? "skipped" : detailApproved ? "active" : "waiting",
          description: detailPaid
            ? `${detailRequest.pembayaran?.nomor_pembayaran ?? "Pembayaran tercatat"} · ${formatRupiah(detailRequest.pembayaran?.nominal ?? detailRequest.jumlah)} · ${formatDateTime(detailRequest.pembayaran?.tanggal_bayar)}${detailRequest.pembayaran?.pembayar?.nama ? ` · ${detailRequest.pembayaran.pembayar.nama}` : ""}`
            : detailRejected
              ? "Tidak dilanjutkan karena pengajuan ditolak."
              : detailCanceled
                ? "Tidak dilanjutkan karena pengajuan dibatalkan."
                : detailApproved
                  ? "Disetujui KARWAS dan menunggu pembayaran Bendahara."
                  : "Menunggu persetujuan KARWAS.",
        },
      ]
    : [];
  const retailDetailStatus = String(retailDetailRequest?.status ?? "");
  const retailDetailRejected = retailDetailStatus === "DITOLAK_KARWAS";
  const retailDetailCanceled = retailDetailStatus === "DIBATALKAN";
  const retailDetailPaid = retailDetailStatus === "DIBAYAR";
  const retailDetailApproved = retailDetailStatus === "DISETUJUI_KARWAS" || retailDetailPaid;
  const retailDetailSteps = retailDetailRequest
    ? [
        {
          title: "Pengajuan dikirim",
          state: retailDetailStatus ? "done" : "waiting",
          description: retailDetailStatus
            ? `${retailDetailRequest.pembuat?.nama ?? "Pemohon"} · ${formatDateTime(retailDetailRequest.diajukan_pada ?? retailDetailRequest.created_at)}`
            : "Pengajuan belum dikirim.",
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
          title: "Pembayaran Bendahara",
          state: retailDetailPaid ? "done" : retailDetailRejected || retailDetailCanceled ? "skipped" : retailDetailApproved ? "active" : "waiting",
          description: retailDetailPaid
            ? `${retailDetailRequest.nomor_pembayaran ?? "Pembayaran tercatat"} · ${formatRupiah(retailDetailRequest.jumlah)} · ${formatDateTime(retailDetailRequest.tanggal_bayar)}${retailDetailRequest.pembayar?.nama ? ` · ${retailDetailRequest.pembayar.nama}` : ""}`
            : retailDetailRejected
              ? "Tidak dilanjutkan karena pengajuan ditolak."
              : retailDetailCanceled
                ? "Tidak dilanjutkan karena pengajuan dibatalkan."
                : retailDetailApproved
                  ? "Disetujui KARWAS dan menunggu pembayaran Bendahara."
                  : "Menunggu persetujuan KARWAS.",
        },
      ]
    : [];
  const listQuery = use_query({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerList",
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
    method: "pengajuanBelanjaControllerFilterOptions",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerFilterOptions({ format: "json" }));
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
    const years = Array.isArray(filterOptionData.tahun_fiscal_list)
      ? filterOptionData.tahun_fiscal_list.map(Number)
      : filterRos.map((ro) => Number(ro.tahun_fiscal));
    return Array.from(new Set(years.filter((year) => year > 0)))
      .sort((a, b) => b - a)
      .map((year) => ({ value: String(year), label: `TA ${year}` }));
  }, [filterOptionData.tahun_fiscal_list, filterRos]);
  const reviewContextQuery = use_query({
    tag: "keuanganPengajuanBelanjaReviewContext",
    method: "pengajuanBelanjaControllerReviewContext",
    params: { id: String(reviewing?.id ?? "") },
    enabled: Boolean(reviewing && canReview),
    queryFn: async ({ id }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerReviewContext(id, { format: "json" }));
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
    method: "proyekControllerGetData",
    params: { limit: 200, page: 1 },
    enabled: open && canCreate,
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.masterProyek.proyekControllerGetData(params, { format: "json" }));
    },
  });
  const projects = listRows(projectsQuery.data) as ProjectRow[];
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const rosQuery = use_query({
    tag: "masterRo",
    method: "roControllerGetData",
    params: { limit: 200, page: 1, id_proyek: selectedProjectId || undefined },
    enabled: open && canCreate && Boolean(selectedProjectId),
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.masterRo.roControllerGetData(params, { format: "json" }));
    },
  });
  const ros = listRows(rosQuery.data);
  const projectOptions = projects.map((project) => ({ value: String(project.id), label: `${project.kode_proyek ?? ""} · ${project.nama_proyek ?? "Proyek"} · TA ${project.tahun_fiscal ?? "—"}` }));
  const roOptions = ros.map((ro) => ({ value: String(ro.id), label: `${String(ro.kode_ro ?? "")} · ${String(ro.nama_ro ?? "RO")} · sisa ${formatRupiah(ro.sisa_saldo ?? ro.total_plafon)}` }));
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
        ...(Array.isArray(retailDetailJob.dokumen)
          ? retailDetailJob.dokumen.map((document: Row) => ({ label: document.nama_file ?? document.jenis ?? "Dokumen order retail", path: document.path_file }))
          : []),
      ]
    : [];
  const hasRetailDetailDocuments = retailDetailDocuments.some((document) => typeof document.path === "string" && document.path.length > 0);
  const createMutation = use_mutation<unknown, Error, CreatePengajuanBelanjaDto>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerCreate",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async (data) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerCreate(data, { format: "json" }));
    },
    onSuccess: () => {
      setOpen(false);
      setForm(blankForm());
      setError("");
    },
  });
  const reviewMutation = use_mutation<unknown, Error, { id: string; data: ReviewPengajuanBelanjaDto }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerReview",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async ({ id, data }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerReview(id, data, { format: "json" }));
    },
    onSuccess: () => {
      setReviewing(null);
      setNote("");
      setError("");
    },
  });
  const payMutation = use_mutation<unknown, Error, { id: string; data: BayarPengajuanBelanjaDto }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerBayar",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, data }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerBayar(id, data, { format: "json" }));
    },
    onSuccess: () => {
      setPaying(null);
      setPayment(blankPayment());
      setError("");
    },
  });
  const retailReviewMutation = use_mutation<unknown, Error, { id: string; disetujui: boolean }>({
    tag: "keuanganPengajuanBelanja",
    method: "reviewRetailExpense",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("retail"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, disetujui }) => {
      setBrowserToken();
      return requestHrisApi(`/api/retail/pengajuan-belanja/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ disetujui, catatan: retailReviewNote.trim() || undefined }),
      });
    },
    onSuccess: (response, variables) => {
      const updated = objectData(response);
      setRetailDetailRequest((current) => current ? {
        ...current,
        ...updated,
        pemeriksa: updated.pemeriksa ?? { nama: user.data?.nama ?? "KARWAS" },
      } : current);
      setRetailReviewNote("");
      setRetailReviewError("");
      const responseMessage = response && typeof response === "object" && "message" in response && typeof response.message === "string"
        ? response.message
        : "";
      const fallbackMessage = variables.disetujui
        ? "Pengajuan belanja retail disetujui dan saldo OPS_KANTOR direservasi."
        : "Pengajuan belanja retail ditolak.";
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message: responseMessage || fallbackMessage } }));
    },
    onError: (cause) => setRetailReviewError(apiErrorMessage(cause, "Review pengajuan retail gagal disimpan.")),
  });
  const retailPayMutation = use_mutation<unknown, Error, { id: string; form: PaymentForm; file: File }>({
    tag: "keuanganPengajuanBelanja",
    method: "payRetailExpense",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("retail"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, form, file }) => uploadHrisFile(`/api/retail/pengajuan-belanja/${id}/bayar`, file, form),
    onSuccess: (response) => {
      const updated = objectData(response);
      const responseMessage = response && typeof response === "object" && "message" in response && typeof response.message === "string"
        ? response.message
        : "";
      setRetailDetailRequest((current) => current ? { ...current, ...updated } : current);
      setRetailPaying(null);
      setRetailPayment(blankPayment());
      setRetailPaymentFile(null);
      setRetailPaymentError("");
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message: responseMessage || "Pembayaran pengajuan retail berhasil dicatat." } }));
    },
    onError: (cause) => setRetailPaymentError(apiErrorMessage(cause, "Pembayaran pengajuan retail gagal dicatat.")),
  });
  const field = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const paymentAmount = Number(paying?.jumlah ?? 0);
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
        keterangan: form.keterangan.trim() || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pengajuan belanja gagal disimpan."));
    }
  }
  async function review(disetujui: boolean) {
    if (!reviewing) return;
    try {
      setError("");
      await reviewMutation.mutateAsync({ id: String(reviewing.id), data: { disetujui, catatan: note.trim() || undefined } });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Review pengajuan gagal disimpan."));
    }
  }
  async function pay() {
    if (!paying) return;
    if (!payment.nomor_pembayaran.trim() || !payment.tanggal_bayar) {
      setError("Nomor pembayaran dan tanggal wajib diisi.");
      return;
    }
    try {
      setError("");
      await payMutation.mutateAsync({
        id: String(paying.id),
        data: {
          nomor_pembayaran: payment.nomor_pembayaran.trim(),
          tanggal_bayar: payment.tanggal_bayar,
          catatan: payment.catatan.trim() || undefined,
        },
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
      await retailReviewMutation.mutateAsync({ id: String(retailDetailRequest.id), disetujui });
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
        form: { ...retailPayment, nomor_pembayaran: retailPayment.nomor_pembayaran.trim(), catatan: retailPayment.catatan.trim() },
        file: retailPaymentFile,
      });
    } catch (cause) {
      setRetailPaymentError(apiErrorMessage(cause, "Pembayaran pengajuan retail gagal dicatat."));
    }
  }

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
      <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-white via-white to-amber-50/70">
        <CardHeader className="gap-1 px-5 pt-6 pb-4 sm:px-6">
          <CardTitle className="text-base">Alur Pengajuan Belanja</CardTitle>
          <CardDescription>Pengajuan diproses bertahap sampai pembayaran tercatat di ledger.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pt-0 pb-5 sm:px-6 sm:pb-6">
          <ol className="grid items-stretch gap-3 md:grid-cols-3">
            <li className="relative flex h-full gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 md:mr-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <ClipboardList size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Tahap 1</p>
                <p className="mt-1 font-semibold">Diajukan</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Koordinator atau Subkoordinator mengirim kebutuhan belanja dari RO proyek atau order layanan retail.</p>
              </div>
              <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-slate-400 md:block" />
            </li>
            <li className="relative flex h-full gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 md:mx-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                <ShieldCheck size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Tahap 2</p>
                <p className="mt-1 font-semibold">Direview KARWAS</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">KARWAS memeriksa pagu RO proyek atau ketersediaan OPS_KANTOR untuk retail.</p>
              </div>
              <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden size-5 -translate-y-1/2 text-slate-400 md:block" />
            </li>
            <li className="flex h-full gap-3 rounded-xl border border-slate-200 bg-white/90 p-4 md:ml-1">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <WalletCards size={19} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tahap 3</p>
                <p className="mt-1 font-semibold">Dibayar Bendahara</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Bendahara mencatat pembayaran ke sumber dana yang sesuai dengan jenis pengajuan.</p>
              </div>
            </li>
          </ol>
          <p className="flex items-start gap-2 border-t border-slate-200 pt-3 text-xs leading-relaxed text-muted-foreground">
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            Pengajuan proyek memerlukan proyek yang disetujui Pimpinan dan pagu RO yang cukup. Pengajuan retail menggunakan saldo OPS_KANTOR.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4">
          {listQuery.isLoading && (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Memuat pengajuan belanja…
            </p>
          )}
          {listQuery.isError && (
            <p role="alert" className="py-8 text-center text-sm text-destructive">
              {apiErrorMessage(listQuery.error, "Gagal memuat pengajuan belanja.")}
            </p>
          )}
          {!listQuery.isLoading && !listQuery.isError && (
            <>
              {filterOptionsQuery.isError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{apiErrorMessage(filterOptionsQuery.error, "Opsi filter pengajuan belanja gagal dimuat.")}</AlertDescription>
                </Alert>
              )}
              <DataTable
                rows={rows}
                rowKey={(row, index) => `${String(row.jenis_sumber ?? "PROYEK")}:${String(row.id ?? index)}`}
                remoteSearch
                searchValue={search}
                searchPlaceholder="Cari kegiatan / kuitansi…"
                onSearchChange={setSearch}
                filters={[
                  { field: "jenis_sumber", label: "Asal Pengajuan", options: [{ value: "PROYEK", label: "Proyek" }, { value: "LAYANAN_RETAIL", label: "Proyek Retail" }] },
                  { field: "status", label: "Status", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
                  { field: "koordinator", label: "Koordinator", options: coordinatorOptions },
                  { field: "proyek", label: "Proyek", options: filterProjectOptions },
                  { field: "ro", label: "RO", options: roFilterOptions },
                  { field: "unit_pelaksana_id", label: "Unit Pelaksana Retail", options: retailUnitOptions },
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
                    render: (row) => <div><p className="font-medium">{row.nomor_pengajuan ?? "—"}</p><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.jenis_sumber === "LAYANAN_RETAIL" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}>{row.jenis_sumber === "LAYANAN_RETAIL" ? "Proyek Retail" : "Proyek"}</span></div>,
                  },
                  {
                    key: "nama_kegiatan",
                    header: "Kebutuhan",
                    className: "min-w-[13rem]",
                    render: (row) => <div><p className="font-medium">{row.nama_kegiatan ?? "—"}</p>{row.keterangan && <p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">{row.keterangan}</p>}</div>,
                  },
                  {
                    key: "context",
                    header: "Proyek / Order Retail",
                    className: "min-w-[16rem]",
                    render: (row) => row.jenis_sumber === "LAYANAN_RETAIL" ? (
                      <div>
                        <span className="font-medium">{row.retail_job?.nomor_job ?? "Order Retail"} · {row.retail_job?.nama_pelanggan ?? "Klien belum tercatat"}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{row.retail_job?.unit_pelaksana?.nama_unit ?? "Unit belum tercatat"} · {row.retail_job?.nomor_lhu ? `LHU ${row.retail_job.nomor_lhu}` : "LHU belum dicatat"}</span>
                      </div>
                    ) : row.ro ? (
                        <div>
                          <span>{row.ro.proyek?.kode_proyek ?? ""} · {row.ro.proyek?.nama_proyek ?? "Proyek"}</span>
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
                    render: (row) => row.jenis_sumber === "LAYANAN_RETAIL"
                      ? <div><p className="font-medium">{row.dana?.kategori_kamar ?? "OPS_KANTOR"}</p><p className="text-xs text-muted-foreground">TA {row.dana?.tahun_fiscal ?? row.retail_job?.tahun_fiscal ?? "—"}</p></div>
                      : <div><p className="font-medium">Kamar RO</p><p className="text-xs text-muted-foreground">{row.ro?.mak?.kode_mak ?? "MAK belum terhubung"}{row.pembayaran?.talangan ? " · talangan OPS_KANTOR" : ""}</p></div>,
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
                                <Button size="sm" variant="outline" onClick={() => {
                                  setRetailDetailRequest(row);
                                  setRetailReviewNote("");
                                  setRetailReviewError("");
                                }}>
                                  <Eye size={15} /> Detail Pengajuan
                                </Button>
                              )}
                              {row.jenis_sumber !== "LAYANAN_RETAIL" && (canCreate || canReview || canPay) && (
                                <Button size="sm" variant="outline" onClick={() => setDetailRequest(row)}>
                                  <Eye size={15} /> Detail
                                </Button>
                              )}
                              {canReview && row.jenis_sumber !== "LAYANAN_RETAIL" && row.status === "DIAJUKAN" && (
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
                              {canPay && row.jenis_sumber !== "LAYANAN_RETAIL" && row.status === "DISETUJUI_KARWAS" && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setPaying(row);
                                    setPayment(blankPayment());
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
      <Modal
        open={Boolean(detailRequest)}
        onClose={() => setDetailRequest(null)}
        title="Detail Pengajuan Belanja"
        description={detailRequest ? `${String(detailRequest.nomor_pengajuan ?? "")} · ${String(detailRequest.nama_kegiatan ?? "")}` : undefined}
        size="lg"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={
          <Button variant="outline" onClick={() => setDetailRequest(null)}>
            Tutup
          </Button>
        }
      >
        {detailRequest && (
          <>
            <ModalSection title="Rincian pengajuan">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <p className="text-sm text-muted-foreground">Status saat ini</p>
                <StatusBadge status={statusTone(detailStatus)}>{statusLabels[detailStatus] ?? detailStatus}</StatusBadge>
              </div>
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Pemohon", detailRequest.pembuat?.nama ?? "—"],
                  ["Tanggal pengajuan", formatDateTime(detailRequest.diajukan_pada ?? detailRequest.created_at)],
                  ["Nama kegiatan", detailRequest.nama_kegiatan ?? "—"],
                  ["Nominal", formatRupiah(detailRequest.jumlah)],
                  ["Proyek", `${detailRequest.ro?.proyek?.kode_proyek ?? "—"} · ${detailRequest.ro?.proyek?.nama_proyek ?? "—"}`],
                  ["RO", `${detailRequest.ro?.kode_ro ?? "—"} · ${detailRequest.ro?.nama_ro ?? "—"}`],
                  ["Koordinator", detailRequest.ro?.unit_koordinator?.nama_unit ?? "—"],
                  ["MAK", `${detailRequest.ro?.mak?.kode_mak ?? "—"} · ${detailRequest.ro?.mak?.nama_mak ?? "—"}`],
                  ["Nomor kuitansi", detailRequest.no_kuitansi || "Belum dicantumkan"],
                  ["Keterangan", detailRequest.keterangan || "Tidak ada keterangan tambahan.", "sm:col-span-2"],
                ].map(([label, value, className]) => (
                  <div key={String(label)} className={`min-w-0 py-3 sm:border-b ${className ?? ""}`}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className={`mt-1 break-words text-sm ${label === "Nominal" ? "font-semibold tabular-nums text-foreground" : "text-foreground"}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <DocumentLinks
                  documents={[
                    { label: "Bukti kuitansi", path: detailRequest.file_bukti },
                    { label: "RAB RO", path: detailRequest.ro?.file_rab },
                    { label: "SK RO", path: detailRequest.ro?.file_sk },
                  ]}
                />
              </div>
            </ModalSection>

            <ModalSection title="Progress pengajuan" description="Checklist tahapan dari pengajuan sampai pembayaran oleh Bendahara.">
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
                        {index === 1 && detailRequest.catatan_pemeriksa && (
                          <p className="mt-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                            <strong>Catatan KARWAS:</strong> {String(detailRequest.catatan_pemeriksa)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ModalSection>

            {detailRequest.pembayaran && (
              <ModalSection title="Rincian pembayaran" description="Alokasi dana operasional yang dicatat Bendahara.">
                <ModalDetailGrid>
                  <ModalDetailItem label="Nomor pembayaran" value={detailRequest.pembayaran.nomor_pembayaran} />
                  <ModalDetailItem label="Dibayar oleh" value={detailRequest.pembayaran.pembayar?.nama ?? "Bendahara"} />
                  <ModalDetailItem label="Tanggal bayar" value={formatDateTime(detailRequest.pembayaran.tanggal_bayar)} />
                  <ModalDetailItem label="Total dibayar" value={formatRupiah(detailRequest.pembayaran.nominal)} />
                </ModalDetailGrid>
                {Array.isArray(detailRequest.pembayaran.alokasi_list) && detailRequest.pembayaran.alokasi_list.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {detailRequest.pembayaran.alokasi_list.map((allocation: Row) => (
                      <div key={String(allocation.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                        <span>
                          {String(allocation.dana_operasional?.kategori_kamar ?? "Dana operasional").replaceAll("_", " ")} · {String(allocation.dana_operasional?.unit_koordinator?.nama_unit ?? "Unit")}
                        </span>
                        <strong className="tabular-nums">{formatRupiah(allocation.nominal)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {detailRequest.pembayaran.catatan && <p className="mt-3 text-xs text-muted-foreground">Catatan Bendahara: {String(detailRequest.pembayaran.catatan)}</p>}
              </ModalSection>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={Boolean(retailDetailRequest)}
        onClose={() => setRetailDetailRequest(null)}
        title="Detail Pengajuan Belanja Retail"
        description={retailDetailRequest ? `${String(retailDetailRequest.nomor_pengajuan ?? "")} · ${String(retailDetailRequest.nama_kegiatan ?? "")}` : undefined}
        size="lg"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={
          <>
            {canReview && retailDetailStatus === "DIAJUKAN" && (
              <>
                <Button variant="destructive" disabled={retailReviewMutation.isPending} onClick={() => reviewRetail(false)}>
                  {retailReviewMutation.isPending && <LoaderCircle className="animate-spin" size={15} />} Tolak
                </Button>
                <Button disabled={retailReviewMutation.isPending} onClick={() => reviewRetail(true)}>
                  {retailReviewMutation.isPending && <LoaderCircle className="animate-spin" size={15} />} Setujui &amp; Reservasi OPS_KANTOR
                </Button>
              </>
            )}
            {canPay && retailDetailStatus === "DISETUJUI_KARWAS" && retailDetailRequest && (
              <Button onClick={() => {
                setRetailPaying(retailDetailRequest);
                setRetailDetailRequest(null);
                setRetailPayment(blankPayment());
                setRetailPaymentFile(null);
                setRetailPaymentError("");
              }}>
                <CircleDollarSign size={15} /> Catat Pembayaran
              </Button>
            )}
            <Button variant="outline" onClick={() => setRetailDetailRequest(null)}>
              Tutup
            </Button>
          </>
        }
      >
        {retailDetailRequest && (
          <>
            <ModalSection title="Rincian pengajuan">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <p className="text-sm text-muted-foreground">Status saat ini</p>
                <StatusBadge status={statusTone(retailDetailStatus)}>{statusLabels[retailDetailStatus] ?? retailDetailStatus}</StatusBadge>
              </div>
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Nomor pengajuan", retailDetailRequest.nomor_pengajuan ?? "—"],
                  ["Diajukan oleh", retailDetailRequest.pembuat?.nama ?? "—"],
                  ["Tanggal pengajuan", formatDateTime(retailDetailRequest.diajukan_pada ?? retailDetailRequest.created_at)],
                  ["Tanggal kebutuhan", formatDateTime(retailDetailRequest.tanggal)],
                  ["Barang / kebutuhan", retailDetailRequest.nama_kegiatan ?? "—"],
                  ["Nominal pengajuan", formatRupiah(retailDetailRequest.jumlah)],
                  ["Order retail", `${retailDetailJob.nomor_job ?? "—"} · ${retailDetailJob.nama_pelanggan ?? "Klien belum tercatat"}`],
                  ["Unit pelaksana", retailDetailJob.unit_pelaksana?.nama_unit ?? "—"],
                  ["Tanda terima perconto", retailDetailJob.nomor_tanda_terima_perconto ?? "Belum dicatat"],
                  ["Nomor LHU", retailDetailJob.nomor_lhu ?? "Belum dicatat"],
                  ["Sumber dana", `${retailDetailRequest.dana?.kategori_kamar ?? "OPS_KANTOR"} · TA ${retailDetailRequest.dana?.tahun_fiscal ?? retailDetailJob.tahun_fiscal ?? "—"}`],
                  ["Saldo OPS_KANTOR tersedia", formatRupiah(retailDetailRequest.saldo_ops_tersedia)],
                  ["Nomor kuitansi", retailDetailRequest.no_kuitansi || "Belum dicantumkan"],
                  ["Keterangan", retailDetailRequest.keterangan || "Tidak ada keterangan tambahan.", "sm:col-span-2"],
                ].map(([label, value, className]) => (
                  <div key={String(label)} className={`min-w-0 py-3 sm:border-b ${className ?? ""}`}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className={`mt-1 break-words text-sm ${label === "Nominal pengajuan" || label === "Saldo OPS_KANTOR tersedia" ? "font-semibold tabular-nums text-foreground" : "text-foreground"}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              {retailDetailRequest.catatan_pemeriksa && (
                <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed">
                  <strong>Catatan KARWAS:</strong> {String(retailDetailRequest.catatan_pemeriksa)}
                </p>
              )}
            </ModalSection>

            <ModalSection title="Validasi KARWAS" description="Status pemeriksaan kebutuhan belanja dan reservasi saldo OPS_KANTOR.">
              <div className={`rounded-lg border px-3.5 py-3 text-sm ${retailDetailRejected ? "border-red-200 bg-red-50 text-red-900" : retailDetailStatus === "DIAJUKAN" ? "border-amber-200 bg-amber-50 text-amber-950" : retailDetailCanceled ? "border-slate-200 bg-slate-50 text-slate-700" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                <p className="font-semibold">
                  {retailDetailStatus === "DIAJUKAN" ? "Menunggu pemeriksaan KARWAS" : retailDetailRejected ? "Pengajuan ditolak KARWAS" : retailDetailCanceled ? "Pengajuan dibatalkan" : retailDetailPaid ? "Validasi selesai · pembayaran tercatat" : "Disetujui KARWAS · menunggu pembayaran Bendahara"}
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  {retailDetailStatus === "DIAJUKAN"
                    ? "Bendahara dapat memproses pembayaran setelah KARWAS menyetujui pengajuan dan mereservasi saldo OPS_KANTOR."
                    : retailDetailRejected
                      ? `Ditolak${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : ""} pada ${formatDateTime(retailDetailRequest.diperiksa_pada)}.`
                      : retailDetailCanceled
                        ? "Pengajuan ini tidak diteruskan ke proses pembayaran."
                        : retailDetailPaid
                          ? `Disetujui${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : " oleh KARWAS"} pada ${formatDateTime(retailDetailRequest.diperiksa_pada)}.`
                          : `Disetujui${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : " oleh KARWAS"} pada ${formatDateTime(retailDetailRequest.diperiksa_pada)}. Bendahara dapat melanjutkan pencatatan pembayaran.`}
                </p>
              </div>
              {canReview && retailDetailStatus === "DIAJUKAN" && (
                <>
                  <label className="grid gap-1.5 text-sm">
                    Catatan pemeriksa
                    <span className="text-xs text-muted-foreground">Opsional saat menyetujui, wajib diisi jika menolak.</span>
                    <textarea
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      maxLength={500}
                      value={retailReviewNote}
                      onChange={(event) => setRetailReviewNote(event.target.value)}
                      placeholder="Catatan pemeriksaan atau alasan penolakan"
                    />
                  </label>
                  {retailReviewError && <p role="alert" className="text-sm text-destructive">{retailReviewError}</p>}
                </>
              )}
            </ModalSection>

            <ModalSection title="Progress pengajuan" description="Tahapan pemeriksaan dan pembayaran pengajuan belanja retail.">
              <ol className="space-y-0">
                {retailDetailSteps.map((step, index) => {
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
                      {index < retailDetailSteps.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-border" aria-hidden="true" />}
                      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${iconClass}`}>
                        <StepIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{step.title}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${step.state === "done" ? "bg-emerald-50 text-emerald-700" : step.state === "rejected" ? "bg-red-50 text-red-700" : step.state === "active" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
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

            {retailDetailPaid && (
              <ModalSection title="Rincian pembayaran" description="Pembayaran pengajuan dicatat sebagai pengeluaran OPS_KANTOR.">
                <ModalDetailGrid>
                  <ModalDetailItem label="Nomor pembayaran" value={retailDetailRequest.nomor_pembayaran ?? "—"} />
                  <ModalDetailItem label="Dibayar oleh" value={retailDetailRequest.pembayar?.nama ?? "Bendahara"} />
                  <ModalDetailItem label="Tanggal bayar" value={formatDateTime(retailDetailRequest.tanggal_bayar)} />
                  <ModalDetailItem label="Nominal dibayar" value={formatRupiah(retailDetailRequest.jumlah)} />
                </ModalDetailGrid>
                {retailDetailRequest.catatan_pembayaran && <p className="mt-3 text-xs text-muted-foreground">Catatan Bendahara: {String(retailDetailRequest.catatan_pembayaran)}</p>}
              </ModalSection>
            )}

            <ModalSection title="Dokumen pendukung">
              {hasRetailDetailDocuments ? <DocumentLinks documents={retailDetailDocuments} /> : <p className="text-sm text-muted-foreground">Belum ada dokumen pendukung.</p>}
            </ModalSection>
          </>
        )}
      </Modal>
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
            <Button variant="outline" onClick={() => setRetailPaying(null)}>Batal</Button>
            <Button disabled={retailPayMutation.isPending} onClick={payRetail}>
              {retailPayMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={15} />} Simpan Pembayaran
            </Button>
          </>
        }
      >
        {retailPaying && (
          <>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{String(retailPaying.retail_job?.nomor_job ?? "Order retail")} · {String(retailPaying.retail_job?.nama_pelanggan ?? "Klien")}</p>
              <p className="mt-1 text-muted-foreground">Pembayaran dicatat sebagai pengeluaran OPS_KANTOR.</p>
              <p className="mt-2 font-semibold tabular-nums">Nominal {formatRupiah(retailPaying.jumlah)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">Nomor pembayaran *
                <Input maxLength={100} value={retailPayment.nomor_pembayaran} onChange={(event) => setRetailPayment((current) => ({ ...current, nomor_pembayaran: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-sm">Tanggal bayar *
                <Input type="date" value={retailPayment.tanggal_bayar} onChange={(event) => setRetailPayment((current) => ({ ...current, tanggal_bayar: event.target.value }))} />
              </label>
              <div className="sm:col-span-2">
                <DocumentUploadField
                  label="Bukti pembayaran *"
                  accept=".pdf,.jpg,.jpeg,.png"
                  value={retailPaymentFile}
                  onChange={setRetailPaymentFile}
                  disabled={retailPayMutation.isPending}
                  className="p-3 sm:p-3"
                />
                <p className="mt-1 text-xs text-muted-foreground">Lampirkan bukti transfer atau dokumen pembayaran (PDF/JPG/PNG, maks. 10 MB).</p>
              </div>
              <label className="grid gap-1 text-sm sm:col-span-2">Catatan
                <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={retailPayment.catatan} onChange={(event) => setRetailPayment((current) => ({ ...current, catatan: event.target.value }))} placeholder="Catatan pembayaran (opsional)" />
              </label>
            </div>
            {retailPaymentError && <Alert variant="destructive"><AlertDescription>{retailPaymentError}</AlertDescription></Alert>}
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
                {projectsQuery.isLoading && <p className="text-xs text-muted-foreground">Memuat daftar proyek…</p>}
                {projectsQuery.isError && <p className="text-xs text-destructive">{apiErrorMessage(projectsQuery.error, "Gagal memuat proyek.")}</p>}
                {selectedProject && (
                  <div className="rounded-lg border border-primary/15 bg-background px-3 py-2.5">
                    <p className="text-xs font-medium text-muted-foreground">Proyek terpilih</p>
                    <p className="mt-0.5 font-semibold">{selectedProject.nama_proyek}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {selectedProject.kode_proyek} · Tahun fiskal {selectedProject.tahun_fiscal ?? "—"}
                    </p>
                  </div>
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
                      <p className="mt-0.5 text-xs text-emerald-800">
                        {String(selectedRo.kode_ro ?? "")} · Sisa saldo {formatRupiah(selectedRo.sisa_saldo ?? selectedRo.total_plafon)}
                      </p>
                    </div>
                  )}
                  {rosQuery.isLoading && <p className="text-xs text-muted-foreground">Memuat daftar RO…</p>}
                  {rosQuery.isError && <p className="text-xs text-destructive">{apiErrorMessage(rosQuery.error, "Gagal memuat RO.")}</p>}
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
      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Review Pengajuan"
        description={reviewing ? `${String(reviewRequest.nomor_pengajuan ?? reviewing.nomor_pengajuan ?? "")} · ${String(reviewRequest.nama_kegiatan ?? reviewing.nama_kegiatan)}` : "Review pengajuan belanja."}
        size="xl"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Batal
            </Button>
            <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => review(false)}>
              <X size={16} /> Tolak
            </Button>
            <Button
              disabled={reviewMutation.isPending || reviewContextQuery.isLoading || reviewContextQuery.isError || !reviewChecks.ro_reguler || !reviewChecks.proyek_disetujui || !reviewChecks.pagu_mencukupi}
              onClick={() => review(true)}
            >
              {reviewMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Reservasi Pagu
            </Button>
          </>
        }
      >
        {reviewContextQuery.isLoading && (
          <Card>
            <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
              <LoaderCircle size={18} className="animate-spin" /> Memuat data RO, proyek, dan arus kas…
            </CardContent>
          </Card>
        )}
        {reviewContextQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>{apiErrorMessage(reviewContextQuery.error, "Gagal memuat konteks keuangan untuk review.")}</AlertDescription>
          </Alert>
        )}
        {!reviewContextQuery.isLoading && !reviewContextQuery.isError && (
          <>
            <ModalSection title="Rincian pengajuan" description="Periksa kegiatan, pemohon, dokumen, dan sumber anggaran sebelum memberi keputusan.">
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Nomor pengajuan", reviewRequest.nomor_pengajuan ?? "—"],
                  ["Diajukan oleh", reviewRequest.pembuat?.nama ?? "—"],
                  ["Kegiatan", reviewRequest.nama_kegiatan ?? "—"],
                  ["Nilai pengajuan", formatRupiah(reviewRequest.jumlah)],
                  ["Tanggal transaksi", reviewRequest.tanggal ? new Date(reviewRequest.tanggal).toLocaleDateString("id-ID") : "—"],
                  ["No. kuitansi", reviewRequest.no_kuitansi || "Belum dicantumkan"],
                  ["Status reservasi", reviewRequest.reservasi?.status ?? "Belum direservasi"],
                  ["Unit koordinator", reviewRequest.ro?.unit_koordinator?.nama_unit ?? "—"],
                  ["MAK", `${reviewRequest.ro?.mak?.kode_mak ?? "—"} · ${reviewRequest.ro?.mak?.nama_mak ?? "Belum terhubung"}`],
                  ["Keterangan pemohon", reviewRequest.keterangan || "Tidak ada keterangan tambahan.", "sm:col-span-2"],
                ].map(([label, value, className]) => (
                  <div key={String(label)} className={`min-w-0 py-3 sm:border-b ${className ?? ""}`}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className={`mt-1 break-words text-sm ${label === "Nilai pengajuan" ? "font-semibold tabular-nums" : ""}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <DocumentLinks
                  documents={[
                    { label: "Bukti kuitansi", path: reviewRequest.file_bukti },
                    { label: "RAB RO", path: reviewRequest.ro?.file_rab },
                    { label: "SK RO", path: reviewRequest.ro?.file_sk },
                    { label: "RAB proyek", path: reviewProject.file_rab },
                    { label: "SK proyek", path: reviewProject.file_sk },
                  ]}
                />
              </div>
            </ModalSection>

            <ModalSection title="Kondisi RO yang diajukan" description="Pagu menunjukkan hak belanja. Posisi kas menunjukkan penerimaan kas dikurangi realisasi; keduanya bukan angka yang sama.">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hak belanja RO</p>
                <MoneyFlow
                  items={[
                    { label: "Pagu disetujui", amount: reviewRoBalance.pagu_disetujui },
                    { label: "Realisasi", amount: reviewRoBalance.realisasi, operator: "−", tone: "text-rose-700" },
                    { label: "Komitmen aktif", amount: reviewRoBalance.komitmen_aktif, operator: "−", tone: "text-amber-700" },
                    { label: "Sisa hak belanja", amount: reviewRoBalance.sisa_dapat_direservasi, operator: "=", tone: "text-emerald-700" },
                  ]}
                />
                <MoneyFlow
                  items={[
                    { label: "Sisa hak belanja", amount: reviewRoBalance.sisa_dapat_direservasi },
                    { label: "Pengajuan ini", amount: reviewRequest.jumlah, operator: "−", tone: "text-amber-700" },
                    { label: "Sisa setelah pengajuan", amount: reviewChecks.sisa_setelah_reservasi, operator: "=", tone: Number(reviewChecks.sisa_setelah_reservasi) < 0 ? "text-rose-700" : "text-emerald-700" },
                  ]}
                />
                <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arus kas RO</p>
                <MoneyFlow
                  items={[
                    { label: "Penerimaan kas", amount: reviewRoBalance.penerimaan_kas, tone: "text-sky-700" },
                    { label: "Realisasi", amount: reviewRoBalance.realisasi, operator: "−", tone: "text-rose-700" },
                    { label: "Posisi kas", amount: reviewRoBalance.posisi_kas, operator: "=", tone: Number(reviewRoBalance.posisi_kas) < 0 ? "text-rose-700" : "text-foreground" },
                  ]}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
                  <span className="text-muted-foreground">Talangan belum lunas</span>
                  <strong className="tabular-nums text-orange-700">{formatRupiah(reviewRoBalance.saldo_talangan)}</strong>
                </div>
                <p className="text-xs text-muted-foreground">Pengajuan yang masih menunggu review belum dihitung sebagai komitmen pagu.</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-1 font-medium ${reviewChecks.ro_reguler ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{reviewChecks.ro_reguler ? "RO reguler" : "Bukan RO reguler"}</span>
                <span className={`rounded-full px-2.5 py-1 font-medium ${reviewChecks.proyek_disetujui ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {reviewChecks.proyek_disetujui ? "Proyek disetujui Pimpinan" : "Proyek belum disetujui Pimpinan"}
                </span>
                <span className={`rounded-full px-2.5 py-1 font-medium ${reviewChecks.pagu_mencukupi ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {reviewChecks.pagu_mencukupi ? "Pagu cukup" : "Pagu tidak mencukupi"}
                </span>
              </div>
              {(!reviewChecks.ro_reguler || !reviewChecks.proyek_disetujui || !reviewChecks.pagu_mencukupi) && (
                <Alert variant="destructive" className="mt-3">
                  <CircleAlert size={16} />
                  <AlertDescription>Pengajuan belum memenuhi syarat reservasi pagu. Tombol persetujuan dinonaktifkan; KARWAS tetap dapat menolak dengan menyertakan catatan.</AlertDescription>
                </Alert>
              )}
            </ModalSection>

            {reviewProject.id && (
              <ModalSection
                title={`Ringkasan proyek · ${String(reviewProject.kode_proyek ?? "")}`}
                description={`${String(reviewProject.nama_proyek ?? "Proyek")}${reviewProject.nama_client ? ` · ${String(reviewProject.nama_client)}` : ""} · TA ${String(reviewProject.tahun_fiscal ?? "—")} · Status ${String(reviewProject.status_proyek ?? "—").replaceAll("_", " ")}`}
              >
                <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                  {[
                    ["Nilai kontrak", reviewProject.nilai_kontrak],
                    ["Direct Cost", reviewProject.total_direct_cost],
                  ].map(([label, amount]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-4 py-3 sm:border-b">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatRupiah(amount)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penagihan proyek</p>
                  <MoneyFlow
                    items={[
                      { label: "Tagihan terbit", amount: reviewCashFlow.nilai_tagihan_terbit },
                      { label: "Penerimaan terverifikasi", amount: reviewCashFlow.penerimaan_terverifikasi, operator: "−", tone: "text-sky-700" },
                      { label: "Sisa tagihan", amount: reviewCashFlow.sisa_tagihan, operator: "=", tone: "text-amber-700" },
                    ]}
                  />
                </div>
                <dl className="mt-3 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                  {[
                    ["Belanja terealisasi", reviewCashFlow.realisasi, "text-rose-700"],
                    ["Komitmen RO aktif", reviewCashFlow.komitmen, "text-amber-700"],
                    ["Pengajuan menunggu review", reviewCashFlow.pengajuan_menunggu, "text-slate-700"],
                    ["Sisa hak belanja seluruh RO", reviewCashFlow.sisa_hak_belanja, "text-emerald-700"],
                    ["Talangan proyek belum lunas", reviewCashFlow.saldo_talangan, "text-orange-700"],
                  ].map(([label, amount, tone]) => (
                    <div key={String(label)} className="flex items-center justify-between gap-4 py-3 sm:border-b">
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className={`text-sm font-semibold tabular-nums ${tone}`}>{formatRupiah(amount)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 overflow-hidden rounded-lg border bg-white">
                  <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
                    <Banknote size={16} className="text-primary" /> Posisi pagu dan komitmen per RO
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[52rem] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2.5">RO / Unit</th>
                          <th className="p-2.5">MAK</th>
                          <th className="p-2.5 text-right">Pagu</th>
                          <th className="p-2.5 text-right">Realisasi</th>
                          <th className="p-2.5 text-right">Komitmen</th>
                          <th className="p-2.5 text-right">Sisa hak</th>
                          <th className="p-2.5 text-right">Pengajuan menunggu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewProjectRos.map((ro) => {
                          const isCurrent = String(ro.id) === String(reviewRequest.ro_id);
                          return (
                            <tr key={String(ro.id)} className={`border-t ${isCurrent ? "bg-amber-50/70" : ""}`}>
                              <td className="p-2.5">
                                <span className="font-semibold">
                                  {String(ro.kode_ro)} · {String(ro.nama_ro)}
                                </span>
                                <span className="mt-0.5 block text-muted-foreground">
                                  {String(ro.nama_unit_koordinator ?? "Unit tidak diketahui")}
                                  {isCurrent ? " · RO pengajuan ini" : ""}
                                </span>
                              </td>
                              <td className="p-2.5">
                                {String(ro.mak?.kode_mak ?? "—")} · {String(ro.mak?.nama_mak ?? "—")}
                              </td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.balance?.pagu_disetujui)}</td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.balance?.realisasi)}</td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.balance?.komitmen_aktif)}</td>
                              <td className="p-2.5 text-right font-semibold tabular-nums">{formatRupiah(ro.balance?.sisa_dapat_direservasi)}</td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.pengajuan_menunggu?.reduce((sum: number, item: Row) => sum + Number(item.jumlah ?? 0), 0))}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">Pengajuan yang masih menunggu review belum dihitung sebagai komitmen pagu.</p>
                </div>
                <div className="mt-4 overflow-hidden rounded-lg border bg-white">
                  <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
                    <FileText size={16} className="text-primary" /> Status termin dan penerimaan invoice
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Termin</th>
                          <th className="p-2.5">Invoice / status</th>
                          <th className="p-2.5 text-right">Nilai termin</th>
                          <th className="p-2.5 text-right">Dibayar</th>
                          <th className="p-2.5 text-right">Sisa invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviewTerms.map((term) => {
                          const invoice = term.invoice as Row | null;
                          const paid = Number(invoice?.nominal_dibayar ?? 0);
                          return (
                            <tr key={String(term.id)} className="border-t">
                              <td className="p-2.5">
                                Termin {String(term.nomor_termin)} · {String(term.status).replaceAll("_", " ")}
                              </td>
                              <td className="p-2.5">
                                {invoice ? (
                                  <>
                                    {String(invoice.nomor_invoice)}
                                    <span className="mt-0.5 block text-muted-foreground">{String(invoice.status).replaceAll("_", " ")}</span>
                                  </>
                                ) : (
                                  "Belum ada invoice"
                                )}
                              </td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(term.nilai_termin)}</td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(paid)}</td>
                              <td className="p-2.5 text-right tabular-nums">{formatRupiah(invoice ? Math.max(0, Number(invoice.nominal ?? 0) - paid) : 0)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </ModalSection>
            )}

            <ModalSection title="Riwayat arus kas RO" description="Mutasi terbaru pada ledger RO ini; debit adalah dana masuk dan kredit adalah realisasi/pengeluaran.">
              <div className="overflow-x-auto rounded-lg border bg-white">
                <table className="w-full min-w-[38rem] text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Transaksi</th>
                      <th className="p-2.5 text-right">Dana masuk</th>
                      <th className="p-2.5 text-right">Realisasi</th>
                      <th className="p-2.5 text-right">Saldo ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewLedger
                      .slice(-10)
                      .reverse()
                      .map((transaction, index) => (
                        <tr key={String(transaction.id ?? index)} className="border-t">
                          <td className="whitespace-nowrap p-2.5">{transaction.tanggal ? new Date(transaction.tanggal).toLocaleDateString("id-ID") : "—"}</td>
                          <td className="p-2.5">
                            <span className="font-medium">{String(transaction.nama_kegiatan ?? "Mutasi RO")}</span>
                            <span className="mt-0.5 block text-muted-foreground">
                              {String(transaction.jenis_transaksi ?? "").replaceAll("_", " ")}
                              {transaction.keterangan ? ` · ${String(transaction.keterangan)}` : ""}
                            </span>
                          </td>
                          <td className="p-2.5 text-right tabular-nums">{Number(transaction.debit) ? formatRupiah(transaction.debit) : "—"}</td>
                          <td className="p-2.5 text-right tabular-nums">{Number(transaction.kredit) ? formatRupiah(transaction.kredit) : "—"}</td>
                          <td className="p-2.5 text-right tabular-nums">{formatRupiah(transaction.saldo)}</td>
                        </tr>
                      ))}
                    {!reviewLedger.length && (
                      <tr>
                        <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                          Belum ada transaksi kas pada ledger RO.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ModalSection>
          </>
        )}
        <label className="grid gap-1 text-sm">
          Catatan pemeriksa
          <textarea
            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Tuliskan alasan penolakan atau catatan pemeriksaan (opsional saat menyetujui)"
          />
        </label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="Bayar Pengajuan"
        description={paying ? `${String(paying.nama_kegiatan)} · ${formatRupiah(paying.jumlah)}` : "Pembayaran pengajuan belanja."}
        size="lg"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Batal
            </Button>
            <Button disabled={payMutation.isPending} onClick={pay}>
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
        <section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <WalletCards size={19} />
            </span>
            <div>
              <h3 className="font-semibold text-emerald-950">Sumber dana otomatis: OPS_KANTOR</h3>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                Sistem mengambil seluruh pembayaran dari dompet OPS_KANTOR sebesar <strong>{formatRupiah(paymentAmount)}</strong> dan mencatatnya sebagai talangan proyek.
              </p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-700">
                Saat pembayaran invoice proyek diterima, sistem memulihkan talangan ke OPS_KANTOR terlebih dahulu. Margin tersisa kemudian dibagi otomatis ke lima kamar sesuai pengaturan persentase.
              </p>
            </div>
          </div>
        </section>
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
    </section>
  );
}
