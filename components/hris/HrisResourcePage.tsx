"use client";

import { useMemo, useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { DataTable } from "@/components/table";

type Props = {
  title: string;
  description: string;
  group: string;
  method: string;
  searchPlaceholder?: string;
  columns?: { key: string; header: string }[];
  query?: Record<string, unknown>;
};

const humanize = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const display = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function HrisResourcePage({ title, description, group, method, searchPlaceholder, columns: configuredColumns, query: initialQuery = {} }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const params = useMemo(() => ({ ...initialQuery, query: search || undefined, page, limit: pageSize }), [initialQuery, search, page, pageSize]);
  const result = use_query({
    tag: group,
    method,
    params,
    queryFn: async (input) => {
      setBrowserToken();
      const api = (browserApi as any)[group];
      return api[method](input);
    },
  });
  const response = (result.data as any)?.data ?? result.data;
  const payload = response?.data && !Array.isArray(response.data) ? response.data : response;
  const rows: Record<string, any>[] = Array.isArray(response?.data) ? response.data : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const meta = response?.pagination ?? payload?.pagination ?? {};
  const keys =
    configuredColumns ??
    Object.keys(rows[0] ?? {})
      .filter((key) => !["id", "created_at", "updated_at", "deleted_at"].includes(key))
      .slice(0, 7)
      .map((key) => ({ key, header: humanize(key) }));
  const tableColumns = keys.map(({ key, header }) => ({ key, header, render: (row: Record<string, any>) => <span>{display(row[key])}</span> }));

  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      {result.isLoading ? (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">
          Memuat {title.toLocaleLowerCase("id-ID")}…
        </p>
      ) : null}
      {result.isError ? (
        <p role="alert" className="py-8 text-center text-sm text-destructive">
          Gagal memuat data. Periksa koneksi API dan hak akses.
        </p>
      ) : null}
      {!result.isLoading && !result.isError ? (
        <DataTable
          title={title}
          rows={rows}
          columns={tableColumns}
          rowKey={(row, index) => String(row.id ?? index)}
          remoteSearch
          searchValue={search}
          searchPlaceholder={searchPlaceholder ?? `Cari ${title.toLocaleLowerCase("id-ID")}…`}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          emptyMessage={`Belum ada data ${title.toLocaleLowerCase("id-ID")}.`}
          pagination={{
            page,
            pageSize,
            total: meta.total_datas ?? rows.length,
            totalPages: meta.total_pages ?? 1,
            onPageChange: setPage,
            onPageSizeChange: (size) => {
              setPageSize(size);
              setPage(1);
            },
          }}
        />
      ) : null}
    </section>
  );
}
