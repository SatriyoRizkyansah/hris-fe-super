"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeRows, unwrapEnvelope } from "@/lib/hris/api";
import { formatDate, formatRupiah, roStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import { CreateRoDialog } from "./CreateRoDialog";
import type { ProyekItemDto, RoItemDto } from "@/lib/api/generated/api-generated";

const missing = (row: RoItemDto) => [!row.no_kontrak && "No Kontrak", !row.pj && "PJ", !row.no_sk && "No SK", !row.mulai_sk && "Mulai SK", !row.berakhir_sk && "Berakhir SK"].filter(Boolean);

export default function RoClientPage() {
  const identity = useMemo(browserIdentity, []);
  const canCreate = identity.role === "superadmin";
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("__all");
  const [unit, setUnit] = useState("__all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
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
  const rows = envelopeRows<RoItemDto>(list.data);
  const pagination = unwrapEnvelope<RoItemDto[]>(list.data).pagination;
  const projectOptions = envelopeRows<ProyekItemDto>(projects.data).map((item) => ({ value: item.id, label: `${item.kode_proyek} — ${item.nama_proyek}` }));
  const unitOptions = envelopeRows<Record<string, unknown>>(units.data).map((item) => ({ value: String(item.id), label: `${String(item.kode_unit ?? "")} — ${String(item.nama_unit ?? "")}` }));
  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Rencana Operasi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plafon, saldo, dokumen, dan ledger RO.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> Tambah RO
          </Button>
        )}
      </header>
      <Card>
        <CardContent className="pt-4">
          {list.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{apiErrorMessage(list.error)}</AlertDescription>
            </Alert>
          )}
          <DataTable
            columns={[
              {
                key: "ro",
                header: "RO / MAK",
                render: (row: RoItemDto) => (
                  <div>
                    <p className="font-medium">{row.nama_ro}</p>
                    <p className="text-xs text-muted-foreground">
                      {String(row.kode_mak ?? row.kode_ro)} · {String(row.nama_mak ?? "—")}
                    </p>
                  </div>
                ),
              },
              {
                key: "project",
                header: "Proyek / Unit",
                render: (row: RoItemDto) => (
                  <div className="text-sm">
                    {String(row.nama_proyek ?? "—")}
                    <p className="text-xs text-muted-foreground">{String(row.nama_unit_koordinator ?? "—")}</p>
                  </div>
                ),
              },
              {
                key: "sk",
                header: "SK",
                render: (row: RoItemDto) => (
                  <span className="text-sm">
                    {String(row.no_sk ?? "—")}
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(row.mulai_sk)} – {formatDate(row.berakhir_sk)}
                    </span>
                  </span>
                ),
              },
              {
                key: "budget",
                header: "Plafon / Sisa",
                className: "text-right",
                render: (row: RoItemDto) => (
                  <span className="whitespace-nowrap text-sm">
                    {formatRupiah(row.total_plafon)}
                    <span className="block text-xs text-muted-foreground">Sisa {formatRupiah(row.sisa_saldo)}</span>
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
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
                render: (row: RoItemDto) => (
                  <Button variant="ghost" size="sm" render={<Link href={`/dashboard/ro/${row.id}`} />}>
                    <Eye size={15} /> Detail
                  </Button>
                ),
              },
            ]}
            rows={rows}
            rowKey={(row) => row.id}
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            remoteSearch
            filters={[
              { field: "project", label: "Proyek", options: [{ value: "__all", label: "Semua Proyek" }, ...projectOptions] },
              { field: "unit", label: "Unit Koordinator", options: [{ value: "__all", label: "Semua Unit" }, ...unitOptions] },
            ]}
            filterValues={{ project, unit }}
            onFilterChange={(field, value) => {
              if (field === "project") setProject(value);
              if (field === "unit") setUnit(value);
              setPage(1);
            }}
            rowsPerPageOptions={[10, 25, 50]}
            pagination={{
              page,
              pageSize,
              total: pagination?.total_datas ?? rows.length,
              totalPages: pagination?.total_pages,
              onPageChange: setPage,
              onPageSizeChange: (value) => {
                setPageSize(value);
                setPage(1);
              },
            }}
            emptyMessage={list.isLoading ? "Memuat RO..." : "Belum ada RO."}
          />
        </CardContent>
      </Card>
      <CreateRoDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={list.refetch} />
    </section>
  );
}
