"use client";
import { useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { DataTable } from "@/components/table";
import { Card, CardContent } from "@/components/ui/card";
export default function Page() {
  const now = new Date();
  const [page, setPage] = useState(1),
    [pageSize, setPageSize] = useState(10),
    [search, setSearch] = useState(""),
    [bulan, setBulan] = useState(now.getMonth() + 1),
    [tahun, setTahun] = useState(now.getFullYear());
  const query = use_query({
    tag: "alokasiGajiTa",
    method: "alokasiRekapControllerGetRekap",
    params: { periode_bulan: bulan, periode_tahun: tahun },
    queryFn: async (params) => {
      setBrowserToken();
      return browserApi.alokasiGajiTa.alokasiRekapControllerGetRekap(params, { format: "json" }) as any;
    },
  });
  const response = (query.data as any)?.data ?? query.data;
  const rows = Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
  const meta = response?.pagination ?? {};
  const columns = Object.keys(rows[0] ?? {})
    .filter((key) => key !== "id")
    .map((key) => ({ key, header: key.replaceAll("_", " ").toUpperCase(), render: (row: any) => <span>{String(row[key] ?? "—")}</span> }));
  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Rekap Alokasi Gaji</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rekap alokasi gaji TA per bulan.</p>
      </header>
      <Card>
        <CardContent className="pt-4">
          {query.isLoading ? (
            <p role="status">Memuat rekap…</p>
          ) : query.isError ? (
            <p role="alert">{query.error instanceof Error ? query.error.message : "Gagal memuat rekap."}</p>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(r: any, i) => String(r.id ?? i)}
              remoteSearch
              searchValue={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              pagination={{
                page,
                pageSize,
                total: meta.total_datas ?? rows.length,
                totalPages: meta.total_pages ?? 1,
                onPageChange: setPage,
                onPageSizeChange: (n) => {
                  setPageSize(n);
                  setPage(1);
                },
              }}
            />
          )}
        </CardContent>
      </Card>
    </section>
  );
}
