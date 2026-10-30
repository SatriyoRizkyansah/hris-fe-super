"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, FilePlus2, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/table";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeRows, requestHrisApi, unwrapEnvelope } from "@/lib/hris/api";
import { formatDate, formatRupiah, humanizeStatus, projectStatusTone } from "@/lib/hris/format";

type TerminRow = {
  id: string;
  nomor_termin: number;
  persentase?: number;
  nilai_termin?: number;
  nilai?: number;
  nominal?: number;
  status: string;
  created_at?: string;
  catatan_keuangan?: string | null;
  divalidasi_keuangan_pada?: string | null;
  dicairkan_pada?: string | null;
  invoice?: { id: string; status: string; nominal: number; nominal_dibayar: number } | null;
  proyek?: {
    id: string;
    kode_proyek: string;
    nama_proyek: string;
    tahun_fiscal: number;
    status_proyek: string;
    nilai_kontrak?: number;
    total_direct_cost?: number;
    total_margin?: number;
    termin_list?: { id: string; nomor_termin: number; persentase: number; nilai_termin: number; status: string }[];
    ro_list?: { id: string; kode_ro: string; nama_ro: string; nilai_rencana: number; total_plafon: number; unit_koordinator?: { nama_unit?: string }; mak?: { kode_mak?: string; nama_mak?: string }; transaksi_list?: { debit: number }[] }[];
  };
};
type RetailBillingRow = {
  id: string;
  nomor_job: string;
  nama_pelanggan: string;
  nomor_lhu?: string | null;
  tanggal_lhu?: string | null;
  tanggal_perconto_diterima?: string | null;
  nilai_layanan?: number | string;
  tahun_fiscal?: number;
  unit_pelaksana_id?: string;
  unit_pelaksana?: { nama_unit?: string } | null;
};
type RetailUnitRow = { id: string; kode_unit: string; nama_unit: string };
type TerminQueueQuery = { query?: string; status?: string; tahun_fiscal?: number; page: number; limit: number };
const ALL = "__all";
const SOURCES = { PROJECT: "project", RETAIL: "retail" } as const;
const statusLabels: Record<string, string> = {
  MENUNGGU_INVOICE: "Siap diterbitkan invoice",
  DITOLAK_KEUANGAN: "Invoice ditolak",
  MENUNGGU_PEMBAYARAN: "Menunggu pembayaran",
  SEBAGIAN_DIBAYAR: "Dibayar sebagian",
  CAIR: "Cair",
};
const statusOptions = Object.keys(statusLabels);

function listRows<T>(value: unknown): T[] {
  let current: any = value;
  for (let index = 0; index < 5 && current && typeof current === "object"; index += 1) {
    if (Array.isArray(current)) return current as T[];
    if (Array.isArray(current.list)) return current.list as T[];
    current = current.data;
  }
  return [];
}

function responseEnvelope(value: unknown) {
  let current: any = value;
  for (let index = 0; index < 5 && current && typeof current === "object"; index += 1) {
    if (Array.isArray(current.data) || current.pagination) return current;
    current = current.data;
  }
  return {};
}

export default function TerminQueuePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [source, setSource] = useState<string>(SOURCES.PROJECT);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [retailPage, setRetailPage] = useState(1);
  const [retailPageSize, setRetailPageSize] = useState(10);
  const [retailUnit, setRetailUnit] = useState(ALL);
  const [detail, setDetail] = useState<TerminRow | null>(null);
  const request = use_query({
    tag: "masterProyek",
    method: "terminQueue",
    params: { search, status, year, page, pageSize },
    queryFn: async () => {
      setBrowserToken();
      const endpoint = browserApi.masterProyek.proyekControllerGetTerminQueue as unknown as (params: { query: TerminQueueQuery; format: "json" }) => Promise<unknown>;
      return endpoint({
        query: {
          query: search || undefined,
          status: status === ALL ? undefined : status,
          tahun_fiscal: year === ALL ? undefined : Number(year),
          page,
          limit: pageSize,
        },
        format: "json",
      });
    },
  });
  const rows = envelopeRows<TerminRow>(request.data);
  const pagination = unwrapEnvelope<unknown>(request.data).pagination;
  const total = Number(pagination?.total_datas ?? rows.length);
  const totalPages = Number(pagination?.total_pages ?? Math.max(1, Math.ceil(total / pageSize)));
  const projectRows = useMemo(() => [...rows].sort((left, right) => {
    const projectOrder = (left.proyek?.nama_proyek ?? "").localeCompare(right.proyek?.nama_proyek ?? "", "id");
    return projectOrder || left.nomor_termin - right.nomor_termin;
  }), [rows]);
  const unitsQuery = use_query({
    tag: "retail",
    method: "retailBillingUnits",
    params: {},
    queryFn: async () => requestHrisApi("/api/retail/units"),
  });
  const retailUnits = listRows<RetailUnitRow>(unitsQuery.data);
  const retailUnitOptions = useMemo(() => retailUnits.map((unit) => ({
    value: unit.id,
    label: [unit.kode_unit, unit.nama_unit].filter(Boolean).join(" · "),
  })), [retailUnits]);
  const retailQuery = use_query({
    tag: "retail",
    method: "retailBillingQueue",
    params: { search, year, page: retailPage, pageSize: retailPageSize, retailUnit },
    queryFn: async () => {
      const query = new URLSearchParams({ status: "SIAP_DITAGIH", page: String(retailPage), limit: String(retailPageSize) });
      if (search.trim()) query.set("query", search.trim());
      if (year !== ALL) query.set("tahun_fiscal", year);
      if (retailUnit !== ALL) query.set("unit_pelaksana_id", retailUnit);
      return requestHrisApi(`/api/retail/jobs?${query.toString()}`);
    },
  });
  const retailRows = listRows<RetailBillingRow>(retailQuery.data);
  const retailPagination = responseEnvelope(retailQuery.data).pagination;
  const retailTotal = Number(retailPagination?.total_datas ?? retailRows.length);
  const retailTotalPages = Number(retailPagination?.total_pages ?? Math.max(1, Math.ceil(retailTotal / retailPageSize)));
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)), []);
  const priorUnpaid = (row: TerminRow) => row.proyek?.termin_list?.find((term) => term.nomor_termin < row.nomor_termin && term.status !== "CAIR");
  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Penagihan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Kelola sumber tagihan proyek dan layanan retail. KEU_BILLING menerbitkan invoice dari termin proyek atau order retail yang sudah siap ditagih.</p>
      </header>
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="space-y-5 p-4 sm:p-5">
          <div role="tablist" aria-label="Sumber penagihan" className="inline-flex rounded-lg border bg-muted/40 p-1">
            <button
              id="tab-termin-proyek"
              type="button"
              role="tab"
              aria-selected={source === SOURCES.PROJECT}
              aria-controls="panel-termin-proyek"
              onClick={() => setSource(SOURCES.PROJECT)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${source === SOURCES.PROJECT ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Termin Proyek
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{request.isFetching ? "…" : total}</span>
            </button>
            <button
              id="tab-tagihan-retail"
              type="button"
              role="tab"
              aria-selected={source === SOURCES.RETAIL}
              aria-controls="panel-tagihan-retail"
              onClick={() => setSource(SOURCES.RETAIL)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${source === SOURCES.RETAIL ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Tagihan Retail
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{retailQuery.isFetching ? "…" : retailTotal}</span>
            </button>
          </div>

          {source === SOURCES.PROJECT ? (
            <div id="panel-termin-proyek" role="tabpanel" aria-labelledby="tab-termin-proyek">
              {request.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Gagal memuat termin proyek</AlertTitle>
                  <AlertDescription>{apiErrorMessage(request.error)}</AlertDescription>
                </Alert>
              )}
              <DataTable<TerminRow>
                rows={projectRows}
                rowKey={(row) => row.id}
                groupBy={(row) => row.proyek?.id ?? `unknown-${row.id}`}
                groupHeader={(groupRows) => {
                  const project = groupRows[0]?.proyek;
                  const allTerms = project?.termin_list ?? [];
                  const paidTerms = allTerms.length
                    ? allTerms.filter((term) => term.status === "CAIR").length
                    : groupRows.filter((term) => term.status === "CAIR").length;
                  const termCount = allTerms.length || groupRows.length;
                  return (
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                      <div>
                        <h2 className="font-semibold">{project?.nama_proyek ?? "Proyek tidak diketahui"}</h2>
                        <p className="text-xs text-muted-foreground">{project?.kode_proyek ?? "—"} · TA {project?.tahun_fiscal ?? "—"} · {termCount} termin</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={projectStatusTone(project?.status_proyek)}>{humanizeStatus(project?.status_proyek)}</StatusBadge>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{paidTerms}/{termCount} cair</span>
                      </div>
                    </header>
                  );
                }}
                remoteSearch
                searchValue={search}
                searchPlaceholder="Cari kode atau nama proyek…"
                onSearchChange={(value) => {
                  setSearch(value);
                  setPage(1);
                  setRetailPage(1);
                }}
                rowsPerPageOptions={[10, 20, 50]}
                filters={[
                  { field: "status", label: "Status tagihan", options: statusOptions.map((value) => ({ value, label: statusLabels[value] })) },
                  { field: "tahun_fiscal", label: "Tahun fiskal", options: years.map((value) => ({ value, label: value })) },
                ]}
                filterValues={{ status, tahun_fiscal: year }}
                onFilterChange={(field, value) => {
                  if (field === "status") setStatus(value);
                  if (field === "tahun_fiscal") {
                    setYear(value);
                    setRetailPage(1);
                  }
                  setPage(1);
                }}
                pagination={{
                  page,
                  pageSize,
                  total,
                  totalPages,
                  onPageChange: setPage,
                  onPageSizeChange: (value) => {
                    setPageSize(value);
                    setPage(1);
                  },
                }}
                emptyMessage={request.isLoading ? "Memuat termin proyek…" : "Tidak ada termin proyek pada filter ini."}
                columns={[
                  {
                    key: "termin",
                    header: "Termin / Persentase",
                    className: "min-w-[11rem] whitespace-nowrap",
                    render: (row) => (
                      <div>
                        <p className="font-medium">Termin {row.nomor_termin}</p>
                        <p className="text-xs text-muted-foreground">{Number(row.persentase ?? 0)}% dari kontrak</p>
                      </div>
                    ),
                  },
                  { key: "nilai", header: "Nilai tagihan", className: "min-w-[10rem] whitespace-nowrap tabular-nums", render: (row) => formatRupiah(row.nilai_termin ?? row.nilai ?? row.nominal ?? 0) },
                  { key: "tanggal", header: "Terdaftar", className: "min-w-[8rem] whitespace-nowrap", render: (row) => formatDate(row.created_at) },
                  {
                    key: "status",
                    header: "Status",
                    className: "min-w-[10rem]",
                    render: (row) => <StatusBadge status={projectStatusTone(row.status)}>{statusLabels[row.status] ?? humanizeStatus(row.status)}</StatusBadge>,
                  },
                  {
                    key: "aksi",
                    header: "Aksi",
                    className: "min-w-[15rem] whitespace-nowrap text-right",
                    render: (row) => {
                      const blocked = priorUnpaid(row);
                      const canProcess = row.proyek?.status_proyek === "DISETUJUI_PIMPINAN" && row.status === "MENUNGGU_INVOICE" && !row.invoice && !blocked;
                      return (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
                            <Eye size={14} /> Rincian
                          </Button>
                          {canProcess && (
                            <Button size="sm" render={<Link href={`/dashboard/invoice?createInvoice=1&terminId=${encodeURIComponent(row.id)}`} />}>
                              <FilePlus2 size={14} /> Terbitkan Invoice
                            </Button>
                          )}
                          {blocked && row.status === "MENUNGGU_INVOICE" && !row.invoice && (
                            <span className="max-w-28 whitespace-normal text-left text-xs text-muted-foreground">Menunggu Termin {blocked.nomor_termin} cair</span>
                          )}
                        </div>
                      );
                    },
                  },
                ]}
              />
            </div>
          ) : (
            <div id="panel-tagihan-retail" role="tabpanel" aria-labelledby="tab-tagihan-retail">
              {retailQuery.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Gagal memuat tagihan retail</AlertTitle>
                  <AlertDescription>{apiErrorMessage(retailQuery.error)}</AlertDescription>
                </Alert>
              )}
              {unitsQuery.error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTitle>Gagal memuat unit pelaksana</AlertTitle>
                  <AlertDescription>{apiErrorMessage(unitsQuery.error)}</AlertDescription>
                </Alert>
              )}
              <p className="mb-3 text-sm text-muted-foreground">Order retail tampil setelah LHU dicatat dan unit mengonfirmasi status siap ditagih.</p>
              <DataTable<RetailBillingRow>
                title="Tagihan layanan retail"
                rows={retailRows}
                rowKey={(row) => row.id}
                remoteSearch
                searchValue={search}
                searchPlaceholder="Cari nomor job, klien, atau LHU…"
                onSearchChange={(value) => {
                  setSearch(value);
                  setRetailPage(1);
                  setPage(1);
                }}
                rowsPerPageOptions={[10, 20, 50]}
                filters={[
                  { field: "tahun_fiscal", label: "Tahun fiskal", options: years.map((value) => ({ value, label: value })) },
                  { field: "unit_pelaksana_id", label: "Unit pelaksana", options: retailUnitOptions },
                ]}
                filterValues={{ tahun_fiscal: year, unit_pelaksana_id: retailUnit }}
                onFilterChange={(field, value) => {
                  if (field === "tahun_fiscal") {
                    setYear(value);
                    setPage(1);
                  }
                  if (field === "unit_pelaksana_id") setRetailUnit(value);
                  setRetailPage(1);
                }}
                pagination={{
                  page: retailPage,
                  pageSize: retailPageSize,
                  total: retailTotal,
                  totalPages: retailTotalPages,
                  onPageChange: setRetailPage,
                  onPageSizeChange: (value) => {
                    setRetailPageSize(value);
                    setRetailPage(1);
                  },
                }}
                emptyMessage={retailQuery.isLoading ? "Memuat order retail…" : "Tidak ada order retail yang siap ditagih."}
                columns={[
                  {
                    key: "order",
                    header: "Order / Klien",
                    className: "min-w-[14rem]",
                    render: (job) => (
                      <div>
                        <p className="font-medium">{job.nomor_job}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{job.nama_pelanggan}</p>
                      </div>
                    ),
                  },
                  {
                    key: "lhu",
                    header: "LHU / Unit",
                    className: "min-w-[14rem]",
                    render: (job) => (
                      <div>
                        <p>LHU {job.nomor_lhu || "—"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{job.unit_pelaksana?.nama_unit ?? "Unit belum tersedia"}</p>
                      </div>
                    ),
                  },
                  { key: "nominal", header: "Nilai tagihan", className: "min-w-[10rem] whitespace-nowrap tabular-nums", render: (job) => formatRupiah(job.nilai_layanan ?? 0) },
                  {
                    key: "siap_ditagih",
                    header: "Siap ditagih",
                    className: "min-w-[10rem]",
                    render: (job) => (
                      <div>
                        <StatusBadge status="warn">Siap ditagih</StatusBadge>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(job.tanggal_lhu ?? job.tanggal_perconto_diterima)}</p>
                      </div>
                    ),
                  },
                  {
                    key: "aksi",
                    header: "Aksi",
                    className: "min-w-[15rem] whitespace-nowrap text-right",
                    render: (job) => (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" render={<Link href={`/dashboard/retail/${encodeURIComponent(job.id)}`} />}>
                          <Eye size={14} /> Rincian
                        </Button>
                        <Button size="sm" render={<Link href={`/dashboard/invoice?createRetail=1&retailJobId=${encodeURIComponent(job.id)}`} />}>
                          <FilePlus2 size={14} /> Terbitkan Invoice
                        </Button>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      </section>
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Rincian termin" size="lg">
        {detail &&
          (() => {
            const project = detail.proyek;
            const blocked = priorUnpaid(detail);
            return (
              <div className="space-y-5">
                <section className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{project?.nama_proyek ?? "Proyek"}</h3>
                      <p className="text-sm text-muted-foreground">
                        {project?.kode_proyek} · Tahun fiskal {project?.tahun_fiscal}
                      </p>
                    </div>
                    <StatusBadge status={projectStatusTone(detail.status)}>{statusLabels[detail.status] ?? humanizeStatus(detail.status)}</StatusBadge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Nilai kontrak proyek</p>
                      <p className="font-semibold">{formatRupiah(project?.nilai_kontrak)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Direct cost</p>
                      <p className="font-semibold">{formatRupiah(project?.total_direct_cost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Margin proyek</p>
                      <p className="font-semibold">{formatRupiah(project?.total_margin)}</p>
                    </div>
                  </div>
                </section>
                <section>
                  <h3 className="mb-2 font-semibold">Rincian termin dan urutan pencairan</h3>
                  <div className="space-y-2">
                    {(project?.termin_list ?? []).map((term) => (
                      <div key={term.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${term.id === detail.id ? "border-primary bg-primary/5" : ""}`}>
                        <div>
                          <p className="font-medium">
                            Termin {term.nomor_termin} · {term.persentase}%
                          </p>
                          <p className="text-xs text-muted-foreground">{formatRupiah(term.nilai_termin)}</p>
                        </div>
                        <StatusBadge status={projectStatusTone(term.status)}>{statusLabels[term.status] ?? humanizeStatus(term.status)}</StatusBadge>
                      </div>
                    ))}
                  </div>
                  {blocked ? (
                    <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-950">
                      <LockKeyhole size={16} />
                      <AlertTitle>Tertahan urutan termin</AlertTitle>
                      <AlertDescription>
                        Termin {blocked.nomor_termin} masih {statusLabels[blocked.status] ?? humanizeStatus(blocked.status)}. Invoice Termin {detail.nomor_termin} baru dapat diajukan setelah termin sebelumnya cair.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </section>
                <Alert className="border-sky-200 bg-sky-50/70 text-sky-950">
                  <AlertTitle>Alur invoice proyek</AlertTitle>
                  <AlertDescription>
                    Termin langsung tersedia setelah proyek disetujui Pimpinan. Billing menerbitkan invoice, kemudian Bendahara mencocokkan penerimaan bank. Termin berstatus cair setelah invoice lunas; dana masuk dipakai untuk melunasi talangan operasional lebih dulu.
                  </AlertDescription>
                </Alert>
                {project?.ro_list?.length ? (
                  <section>
                    <h3 className="mb-2 font-semibold">Rencana RO proyek</h3>
                    <div className="space-y-2">
                      {project.ro_list.map((ro) => (
                        <div key={ro.id} className="flex flex-wrap justify-between gap-3 rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{ro.nama_ro}</p>
                            <p className="text-xs text-muted-foreground">
                              {ro.kode_ro} · {ro.unit_koordinator?.nama_unit ?? "Unit—"} · MAK {ro.mak?.kode_mak ?? "—"} {ro.mak?.nama_mak ?? ""}
                            </p>
                          </div>
                          <p className="text-sm">
                            Rencana <strong>{formatRupiah(ro.nilai_rencana)}</strong>
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Diajukan {formatDate(detail.created_at)}
                  {detail.divalidasi_keuangan_pada ? ` · Divalidasi ${formatDate(detail.divalidasi_keuangan_pada)}` : ""}
                  {detail.dicairkan_pada ? ` · Dicairkan ${formatDate(detail.dicairkan_pada)}` : ""}
                </p>
              </div>
            );
          })()}
      </Modal>
    </section>
  );
}
