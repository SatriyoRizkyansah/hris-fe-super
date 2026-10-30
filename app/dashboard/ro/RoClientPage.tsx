"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTableFilters } from "@/components/table/DataTableFilters";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeRows, unwrapEnvelope } from "@/lib/hris/api";
import { formatDate, formatRupiah, roStatusTone } from "@/lib/hris/format";

import type { ProyekItemDto, RoItemDto } from "@/lib/api/generated/api-generated";

const missing = (row: RoItemDto) => [!row.no_kontrak && "No Kontrak", !row.pj && "PJ", (row.id_proyek ? !row.nomor_job && !row.no_sk : !row.no_sk) && (row.id_proyek ? "Nomor Job" : "No SK"), !row.mulai_sk && "Mulai SK", !row.berakhir_sk && "Berakhir SK"].filter(Boolean);
type RoListItem = RoItemDto & {
  balance?: { pagu_disetujui?: number; sisa_dapat_direservasi?: number; penerimaan_kas?: number; posisi_kas?: number };
  status_pencairan?: "BELUM_CAIR" | "SEBAGIAN_CAIR" | "CAIR";
  termin_cair_count?: number;
  termin_sebagian_count?: number;
  termin_total_count?: number;
};

export default function RoClientPage() {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("__all");
  const [unit, setUnit] = useState("__all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const list = use_query({
    tag: "masterRo",
    method: "list",
    params: { search, project, unit, page, pageSize },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRo.roControllerGetData({ query: search || undefined, id_proyek: project === "__all" ? undefined : project, id_unit_koordinator: unit === "__all" ? undefined : unit, page, limit: pageSize });
    },
  });
  const projects = use_query({
    tag: "masterProyek",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetData({ limit: 200 });
    },
  });
  const units = use_query({
    tag: "masterUnitKerja",
    method: "options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetControllerGetData({ tipe_unit: "KOORDINATOR", limit: 200 });
    },
  });
  const rows = envelopeRows<RoListItem>(list.data);
  const pagination = unwrapEnvelope<RoListItem[]>(list.data).pagination;
  const projectRows = envelopeRows<ProyekItemDto>(projects.data);
  const projectOptions = projectRows.map((item) => ({ value: item.id, label: `${item.kode_proyek} — ${item.nama_proyek}` }));
  const unitOptions = envelopeRows<Record<string, unknown>>(units.data).map((item) => ({ value: String(item.id), label: `${String(item.kode_unit ?? "")} — ${String(item.nama_unit ?? "")}` }));
  const projectGroups = useMemo(() => {
    const groups = new Map<string, RoListItem[]>();
    for (const row of rows) {
      const projectId = String(row.id_proyek ?? "");
      const key = projectId || `unassigned-${row.id}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    return Array.from(groups, ([key, projectRows]) => ({
      key,
      rows: projectRows,
      project: projectRows[0] ? projectRows[0].id_proyek : null,
    }));
  }, [rows]);
  const columns = [
    {
      key: "ro",
      header: "RO / MAK",
      className: "w-[15%]",
      render: (row: RoItemDto) => (
        <div className="min-w-0">
          <p className="break-words font-medium">{row.nama_ro}</p>
          <p className="break-words text-xs text-muted-foreground">
            {String(row.kode_mak ?? row.kode_ro)} · {String(row.nama_mak ?? "—")}
          </p>
        </div>
      ),
    },
    { key: "unit", header: "Unit Koordinator", className: "w-[25%]", render: (row: RoItemDto) => <span className="break-words">{String(row.nama_unit_koordinator ?? "—")}</span> },
    {
      key: "sk",
      header: "JOB / SK",
      className: "w-[12%]",
      render: (row: RoItemDto) => (
        <span className="break-words text-sm">
          {row.nomor_job ? `Job: ${String(row.nomor_job)}` : `SK: ${String(row.no_sk ?? "—")}`}
          <span className="block text-xs text-muted-foreground">
            {formatDate(row.mulai_sk)} – {formatDate(row.berakhir_sk)}
          </span>
        </span>
      ),
    },
    {
      key: "budget",
      header: "Pagu / Sisa Hak Belanja",
      className: "w-[28%] text-right",
      render: (row: RoListItem) => {
        const planned = Number((row as RoItemDto & { nilai_rencana?: number }).nilai_rencana) || Number(row.total_plafon) || 0;
        const approved = Number(row.balance?.pagu_disetujui ?? planned) || 0;
        const remaining = Number(row.balance?.sisa_dapat_direservasi ?? row.sisa_saldo) || 0;
        const cashPosition = Number(row.balance?.posisi_kas) || 0;
        const payoutStatus = row.status_pencairan ?? "BELUM_CAIR";
        const payoutTone = payoutStatus === "CAIR" ? "ok" : payoutStatus === "SEBAGIAN_CAIR" ? "warn" : "neutral";
        return (
          <div className="space-y-1 text-sm">
            <span className="block">Pagu disetujui {formatRupiah(approved)}</span>
            <span className={`block text-xs ${remaining < 0 ? "text-rose-700" : "text-emerald-700"}`}>Sisa hak belanja {formatRupiah(remaining)}</span>
            <span className={`block text-xs ${cashPosition < 0 ? "text-rose-700" : "text-muted-foreground"}`}>Posisi kas RO {formatRupiah(cashPosition)}</span>
            <span className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
              <StatusBadge status={payoutTone}>{payoutStatus === "CAIR" ? "Dana cair" : payoutStatus === "SEBAGIAN_CAIR" ? "Sebagian cair" : "Belum cair"}</StatusBadge>
              <span className="text-[11px] text-muted-foreground">{row.termin_cair_count ?? 0}/{row.termin_total_count ?? 0} cair{row.termin_sebagian_count ? ` · ${row.termin_sebagian_count} sebagian` : ""}</span>
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      className: "w-[12%]",
      render: (row: RoItemDto) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={roStatusTone(row.status_ro)}>{row.status_ro ?? "—"}</StatusBadge>
          {missing(row).length > 0 && <StatusBadge status="warn">{missing(row).length} data belum lengkap</StatusBadge>}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      className: "w-[8%] text-right",
      render: (row: RoItemDto) => (
        <Button variant="ghost" size="sm" className="whitespace-nowrap" render={<Link href={`/dashboard/ro/${row.id}`} />}>
          <Eye size={15} /> Detail
        </Button>
      ),
    },
  ];
  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rencana Operasi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pagu, sisa hak belanja, posisi kas, dan status pencairan termin proyek.</p>
        </div>
      </header>
      <Card>
        <CardContent className="!pt-4">
          {list.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{apiErrorMessage(list.error)}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-end">
                <input
                  className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm sm:max-w-md"
                  type="search"
                  placeholder="Cari kode atau nama RO…"
                  aria-label="Cari RO"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <DataTableFilters
                filters={[
                  { field: "project", label: "Proyek", options: projectOptions },
                  { field: "unit", label: "Unit koordinator", options: unitOptions },
                ]}
                values={{ project, unit }}
                onChange={(field, value) => {
                  if (field === "project") setProject(value);
                  if (field === "unit") setUnit(value);
                  setPage(1);
                }}
                onReset={() => {
                  setProject("__all");
                  setUnit("__all");
                  setSearch("");
                  setPage(1);
                }}
              />
            </div>
            {list.isLoading ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Memuat RO...</p>
            ) : projectGroups.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada RO.</p>
            ) : (
              <div className="space-y-4">
                {projectGroups.map(({ key, rows: groupRows }) => {
                  const projectId = String(groupRows[0]?.id_proyek ?? "");
                  const projectInfo = projectRows.find((item) => item.id === projectId);
                  const projectName = String(groupRows[0]?.nama_proyek ?? projectInfo?.nama_proyek ?? "Proyek tidak diketahui");
                  return (
                    <section key={key} className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                        <div>
                          <h2 className="font-semibold">{projectName}</h2>
                          <p className="text-xs text-muted-foreground">
                            {projectInfo ? `${projectInfo.kode_proyek} · TA ${projectInfo.tahun_fiscal}` : "Rencana Operasi"} · {groupRows.length} RO
                          </p>
                        </div>
                      </header>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[68rem] table-fixed text-sm">
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
                            {groupRows.map((row, index) => (
                              <tr key={row.id} className="border-t hover:bg-muted/20">
                                {columns.map((column) => (
                                  <td key={column.key} className={`px-3 py-3 align-middle ${column.className ?? ""}`}>
                                    {column.render(row)}
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
                {pagination?.total_datas ?? rows.length} RO · {projectGroups.length} proyek
              </span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  Baris
                  <select
                    className="h-8 rounded-md border bg-background px-2"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                  >
                    {[5, 10, 25, 50].map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <span>
                  Halaman {page} / {pagination?.total_pages ?? 1}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                    Sebelumnya
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= (pagination?.total_pages ?? 1)} onClick={() => setPage((current) => current + 1)}>
                    Berikutnya
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
