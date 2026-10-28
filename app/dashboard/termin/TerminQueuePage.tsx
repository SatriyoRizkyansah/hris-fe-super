"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, FilePlus2, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeRows, unwrapEnvelope } from "@/lib/hris/api";
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
type TerminQueueQuery = { query?: string; status?: string; tahun_fiscal?: number; page: number; limit: number };
type QueueResponse = { data?: TerminRow[]; pagination?: { page?: number; limit?: number; total_datas?: number; total_pages?: number } };
const ALL = "__all";
const statusLabels: Record<string, string> = {
  MENUNGGU_INVOICE: "Menunggu invoice",
  DITOLAK_KEUANGAN: "Invoice ditolak",
  MENUNGGU_PEMBAYARAN: "Menunggu pembayaran",
  SEBAGIAN_DIBAYAR: "Dibayar sebagian",
  CAIR: "Cair",
};
const statusOptions = Object.keys(statusLabels);

export default function TerminQueuePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<TerminRow | null>(null);
  const request = use_query({
    tag: "masterProyek",
    method: "terminQueue",
    params: { search, status, year, page },
    queryFn: async () => {
      setBrowserToken();
      const endpoint = browserApi.masterProyek.proyekControllerGetTerminQueue as unknown as (params: { query: TerminQueueQuery; format: "json" }) => Promise<unknown>;
      return endpoint({
        query: {
          query: search || undefined,
          status: status === ALL ? undefined : status,
          tahun_fiscal: year === ALL ? undefined : Number(year),
          page,
          limit: 20,
        },
        format: "json",
      });
    },
  });
  const rows = envelopeRows<TerminRow>(request.data);
  const pagination = unwrapEnvelope<unknown>(request.data).pagination;
  const total = Number(pagination?.total_datas ?? rows.length);
  const totalPages = Number(pagination?.total_pages ?? Math.max(1, Math.ceil(total / 20)));
  const responseSummary = (unwrapEnvelope<unknown>(request.data) as unknown as { summary?: Record<string, number> }).summary ?? {};
  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)), []);
  const projectGroups = useMemo(() => {
    const groups = new Map<string, TerminRow[]>();
    for (const row of rows) {
      const key = row.proyek?.id ?? `unknown-${row.id}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups.entries()).map(([key, projectRows]) => ({ key, rows: projectRows.sort((a, b) => a.nomor_termin - b.nomor_termin), project: projectRows[0]?.proyek }));
  }, [rows]);
  const priorUnpaid = (row: TerminRow) => row.proyek?.termin_list?.find((term) => term.nomor_termin < row.nomor_termin && term.status !== "CAIR");
  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Antrean Termin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Billing menerbitkan invoice dari jadwal termin. Bendahara mencocokkan dana masuk; termin cair setelah invoice lunas.</p>
      </header>
      {request.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat antrean termin</AlertTitle>
          <AlertDescription>{apiErrorMessage(request.error)}</AlertDescription>
        </Alert>
      )}
      <div className="termin-summary grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="termin-summary-content">
            <p className="text-sm text-muted-foreground">Total antrean</p>
            <p className="mt-1 text-2xl font-bold">{request.isLoading ? "—" : Object.values(responseSummary).reduce((sum, count) => sum + Number(count || 0), 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="termin-summary-content">
            <p className="text-sm text-muted-foreground">Menunggu invoice</p>
            <p className="mt-1 text-2xl font-bold">{request.isLoading ? "—" : Number(responseSummary.MENUNGGU_INVOICE ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="termin-summary-content">
            <p className="text-sm text-muted-foreground">Sudah cair</p>
            <p className="mt-1 text-2xl font-bold">{request.isLoading ? "—" : Number(responseSummary.CAIR ?? 0)}</p>
          </CardContent>
        </Card>
      </div>
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="space-y-5 p-4 sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="relative block w-full sm:max-w-md">
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari kode atau nama proyek…"
                  aria-label="Cari proyek"
                  className="h-9 rounded-xl"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filter status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value={ALL}>Semua status</option>
                  {statusOptions.map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value]}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter tahun fiskal"
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value={ALL}>Semua tahun</option>
                  {years.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {request.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Memuat antrean termin…</p>
          ) : projectGroups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Tidak ada termin pada filter ini.</p>
          ) : (
            <div className="space-y-4">
              {projectGroups.map(({ key, rows: projectRows, project }) => {
                const cair = projectRows.filter((row) => row.status === "CAIR").length;
                return (
                  <section key={key} className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                      <div>
                        <h2 className="font-semibold">{project?.nama_proyek ?? "Proyek tidak diketahui"}</h2>
                        <p className="text-xs text-muted-foreground">
                          {project?.kode_proyek ?? "—"} · TA {project?.tahun_fiscal ?? "—"} · {projectRows.length} termin
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={projectStatusTone(project?.status_proyek)}>{humanizeStatus(project?.status_proyek)}</StatusBadge>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          {cair}/{projectRows.length} cair
                        </span>
                      </div>
                    </header>
                    <div>
                      <div className="hidden grid-cols-[minmax(7rem,0.8fr)_minmax(9rem,1.1fr)_minmax(8rem,0.9fr)_minmax(12rem,1.3fr)_auto] items-center gap-4 bg-muted/20 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
                        <span>Termin</span>
                        <span>Nilai tagihan</span>
                        <span>Terdaftar</span>
                        <span>Status proses</span>
                        <span className="text-right">Aksi</span>
                      </div>
                      {projectRows.map((row) => {
                        const blocked = priorUnpaid(row);
                        const canProcess = project?.status_proyek === "DISETUJUI_PIMPINAN" && row.status === "MENUNGGU_INVOICE" && !row.invoice && !blocked;
                        return (
                          <div key={row.id} className="grid gap-3 border-t px-4 py-4 hover:bg-muted/20 lg:grid-cols-[minmax(7rem,0.8fr)_minmax(9rem,1.1fr)_minmax(8rem,0.9fr)_minmax(12rem,1.3fr)_auto] lg:items-center lg:gap-4">
                            <div>
                              <p className="font-semibold">Termin {row.nomor_termin}</p>
                              <p className="text-xs text-muted-foreground">{Number(row.persentase ?? 0)}% dari kontrak</p>
                            </div>
                            <p className="font-semibold tabular-nums">{formatRupiah(row.nilai_termin ?? row.nilai ?? row.nominal ?? 0)}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(row.created_at)}</p>
                            <div>
                              <StatusBadge status={projectStatusTone(row.status)}>
                                <span className="whitespace-normal">{statusLabels[row.status] ?? humanizeStatus(row.status)}</span>
                              </StatusBadge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                              <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
                                <Eye size={14} /> Rincian
                              </Button>
                              {canProcess && (
                                <Button
                                  size="sm"
                                  render={<Link href={`/dashboard/invoice?createInvoice=1&terminId=${encodeURIComponent(row.id)}`} />}
                                >
                                  <FilePlus2 size={14} /> Proses Invoice
                                </Button>
                              )}
                              {blocked && row.status === "MENUNGGU_INVOICE" && !row.invoice && (
                                <span className="text-xs text-muted-foreground">Menunggu Termin {blocked.nomor_termin} cair</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
            <span>
              {total} termin · {projectGroups.length} proyek
            </span>
            <div className="flex items-center gap-3">
              <span>
                Halaman {page} / {totalPages}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Sebelumnya
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </div>
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
