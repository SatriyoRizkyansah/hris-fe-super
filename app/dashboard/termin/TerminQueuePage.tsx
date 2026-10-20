"use client";

import { useMemo, useState } from "react";
import { Check, CircleDollarSign, Eye, LoaderCircle, LockKeyhole } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
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
type MarginConfig = { kategori_kamar: string; nama_kamar: string; persentase: number; nama_unit?: string; rekening?: { nama_bank?: string; nama_rekening?: string; nomor_rekening?: string } | null };
type TerminQueueQuery = { query?: string; status?: string; tahun_fiscal?: number; page: number; limit: number };
type QueueResponse = { data?: TerminRow[]; pagination?: { page?: number; limit?: number; total_datas?: number; total_pages?: number } };
const ALL = "__all";
const statusOptions = ["MENUNGGU_VALIDASI_KEUANGAN", "DISETUJUI_KEUANGAN", "CAIR", "DITOLAK_KEUANGAN"];

export default function TerminQueuePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TerminRow | null>(null);
  const [detail, setDetail] = useState<TerminRow | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
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
  const marginQuery = use_query({
    tag: "masterPengaturanMargin",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterPengaturanMargin.pengaturanMarginControllerGetData({ format: "json" });
    },
  });
  const marginConfigs = envelopeRows<MarginConfig>(marginQuery.data);
  const mutation = use_mutation({
    tag: "masterProyek",
    method: "terminQueueAction",
    mutationFn: async ({ row, action, catatan }: { row: TerminRow; action: "validate" | "pay"; catatan?: string }) => {
      setBrowserToken();
      return action === "validate" ? browserApi.masterProyek.proyekControllerValidasiTerminKeuangan(row.proyek!.id, row.id, { disetujui: true, catatan }) : browserApi.masterProyek.proyekControllerCairkanTermin(row.proyek!.id, row.id);
    },
    invalidateKeys: [["api", "masterProyek"]],
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
  const allocationPreview = (row: TerminRow) => {
    const project = row.proyek;
    let available = Number(row.nilai_termin ?? 0);
    const remainingDirect = Math.max(0, Number(project?.total_direct_cost ?? 0) - (project?.ro_list ?? []).reduce((sum, ro) => sum + (ro.transaksi_list ?? []).reduce((total, tx) => total + Number(tx.debit || 0), 0), 0));
    const forRos = Math.min(available, remainingDirect);
    available -= forRos;
    const allocations: { label: string; meta: string; amount: number }[] = [];
    let roBudget = forRos;
    for (const ro of project?.ro_list ?? []) {
      if (roBudget <= 0) break;
      const alreadyIn = (ro.transaksi_list ?? []).reduce((sum, tx) => sum + Number(tx.debit || 0), 0);
      const outstanding = Math.max(0, Number(ro.nilai_rencana || 0) - alreadyIn);
      const amount = Math.min(roBudget, outstanding);
      if (amount > 0) allocations.push({ label: ro.nama_ro, meta: [ro.kode_ro, ro.unit_koordinator?.nama_unit, ro.mak?.kode_mak].filter(Boolean).join(" · "), amount });
      roBudget -= amount;
    }
    const margin = Math.max(0, Number(project?.total_margin || 0));
    for (const config of marginConfigs) {
      const amount = Math.round((available * Number(config.persentase || 0)) / 100);
      allocations.push({
        label: config.nama_kamar,
        meta: `${config.persentase}% · ${config.nama_unit ?? "Unit belum diatur"} · ${config.rekening?.nama_bank ?? "Rekening belum diatur"} ${config.rekening?.nama_rekening ?? ""}`.trim(),
        amount,
      });
    }
    return { allocations, roAmount: forRos, marginAmount: available, remainingMargin: margin };
  };
  const columns = [
    {
      key: "proyek",
      header: "Proyek",
      render: (row: TerminRow) => (
        <div>
          <div className="font-semibold">{row.proyek?.nama_proyek ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {row.proyek?.kode_proyek ?? "—"} · TA {row.proyek?.tahun_fiscal ?? "—"}
          </div>
          <div className="mt-1">
            <StatusBadge status={projectStatusTone(row.proyek?.status_proyek)}>{humanizeStatus(row.proyek?.status_proyek)}</StatusBadge>
          </div>
        </div>
      ),
    },
    {
      key: "nomor",
      header: "Termin",
      render: (row: TerminRow) => (
        <div>
          <div className="font-semibold">Termin {row.nomor_termin}</div>
          <div className="text-xs text-muted-foreground">{Number(row.persentase ?? 0)}% dari kontrak</div>
        </div>
      ),
    },
    {
      key: "nilai",
      header: "Nilai Termin",
      className: "text-right",
      render: (row: TerminRow) => (
        <div className="font-semibold">
          {formatRupiah(row.nilai_termin ?? row.nilai ?? row.nominal ?? 0)}
          <div className="text-xs font-normal text-muted-foreground">Nilai tagihan</div>
        </div>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal diajukan",
      render: (row: TerminRow) => (
        <div>
          {formatDate(row.created_at)}
          <div className="text-xs text-muted-foreground">Termin #{row.nomor_termin}</div>
        </div>
      ),
    },
    { key: "status", header: "Status termin", render: (row: TerminRow) => <StatusBadge status={projectStatusTone(row.status)}>{humanizeStatus(row.status)}</StatusBadge> },
    {
      key: "aksi",
      header: "Aksi",
      className: "text-right",
      render: (row: TerminRow) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
            <Eye size={14} /> Rincian
          </Button>
          {row.status === "MENUNGGU_VALIDASI_KEUANGAN" && (
            <Button
              size="sm"
              disabled={Boolean(priorUnpaid(row))}
              title={priorUnpaid(row) ? `Termin ${priorUnpaid(row)?.nomor_termin} harus cair lebih dahulu` : undefined}
              onClick={() => {
                setSelected(row);
                setNote("");
                setActionError("");
              }}
            >
              <Check size={14} /> Validasi
            </Button>
          )}
          {row.status === "DISETUJUI_KEUANGAN" && (
            <Button
              size="sm"
              disabled={Boolean(priorUnpaid(row)) || row.proyek?.status_proyek !== "DISETUJUI_PIMPINAN"}
              title={priorUnpaid(row) ? `Termin ${priorUnpaid(row)?.nomor_termin} harus cair lebih dahulu` : undefined}
              onClick={() => void runAction(row, "pay")}
            >
              <CircleDollarSign size={14} /> Cairkan
            </Button>
          )}
        </div>
      ),
    },
  ];
  async function runAction(row: TerminRow, action: "validate" | "pay") {
    setActionError("");
    try {
      await mutation.mutateAsync({ row, action, catatan: note || undefined });
      setSelected(null);
    } catch (error) {
      setActionError(apiErrorMessage(error));
    }
  }

  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Antrean Termin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Validasi dan pencairan termin proyek.</p>
      </header>
      {request.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat antrean termin</AlertTitle>
          <AlertDescription>{apiErrorMessage(request.error)}</AlertDescription>
        </Alert>
      )}
      {mutation.error && !actionError && (
        <Alert variant="destructive">
          <AlertTitle>Aksi gagal</AlertTitle>
          <AlertDescription>{apiErrorMessage(mutation.error)}</AlertDescription>
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
            <p className="text-sm text-muted-foreground">Menunggu validasi</p>
            <p className="mt-1 text-2xl font-bold">{request.isLoading ? "—" : Number(responseSummary.MENUNGGU_VALIDASI_KEUANGAN ?? 0)}</p>
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
                      {value.replaceAll("_", " ")}
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
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[55rem] text-sm">
                        <thead className="bg-muted/20">
                          <tr>
                            {columns.map((column) => (
                              <th key={column.key} className={`h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground ${column.className ?? ""}`}>
                                {column.header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {projectRows.map((row, index) => (
                            <tr key={row.id} className="border-t hover:bg-muted/20">
                              {columns.map((column) => (
                                <td key={column.key} className={`px-3 py-3 align-middle ${column.className ?? ""}`}>
                                  {column.render(row, index)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
            const allocation = allocationPreview(detail);
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
                    <StatusBadge status={projectStatusTone(detail.status)}>{humanizeStatus(detail.status)}</StatusBadge>
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
                        <StatusBadge status={projectStatusTone(term.status)}>{humanizeStatus(term.status)}</StatusBadge>
                      </div>
                    ))}
                  </div>
                  {blocked ? (
                    <Alert className="mt-3 border-amber-300 bg-amber-50 text-amber-950">
                      <LockKeyhole size={16} />
                      <AlertTitle>Tertahan urutan termin</AlertTitle>
                      <AlertDescription>
                        Termin {blocked.nomor_termin} masih {humanizeStatus(blocked.status)}. Termin {detail.nomor_termin} baru dapat diproses setelah termin sebelumnya berstatus CAIR.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </section>
                <section>
                  <h3 className="mb-2 font-semibold">Perkiraan sebaran dana saat termin cair</h3>
                  <p className="mb-3 text-sm text-muted-foreground">Pencairan mengisi sisa direct cost ke RO secara berurutan. Sisa nilai termin dibagi ke wallet dana operasional sesuai persentase pengaturan margin.</p>
                  <div className="space-y-2">
                    {allocation.allocations.map((item, index) => (
                      <div key={`${item.label}-${index}`} className="flex flex-wrap justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.meta}</p>
                        </div>
                        <p className="font-semibold">{formatRupiah(item.amount)}</p>
                      </div>
                    ))}
                    {!allocation.allocations.length && <p className="text-sm text-muted-foreground">Tidak ada rincian tujuan tersedia.</p>}
                  </div>
                  <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
                    <p>
                      Dialokasikan ke RO: <strong>{formatRupiah(allocation.roAmount)}</strong>
                    </p>
                    <p>
                      Dialokasikan sebagai margin: <strong>{formatRupiah(allocation.marginAmount)}</strong>
                    </p>
                  </div>
                </section>
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
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          if (!mutation.isPending) setSelected(null);
        }}
        title="Validasi Termin"
      >
        {selected && (
          <div className="space-y-4">
            <p>
              Setujui Termin {selected.nomor_termin} untuk <strong>{selected.proyek?.nama_proyek}</strong>?
            </p>
            <label className="grid gap-1.5 text-sm font-medium">
              Catatan (opsional)
              <Input value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={mutation.isPending}>
                Batal
              </Button>
              <Button onClick={() => void runAction(selected, "validate")} disabled={mutation.isPending}>
                {mutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />} Setujui
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
