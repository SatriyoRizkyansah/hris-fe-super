"use client";

import { useMemo, useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { DataTable } from "@/components/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/modal/Modal";
import { Plus } from "lucide-react";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { useCurrentUser } from "@/lib/api/hooks";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getApiErrorMessage } from "@/lib/api/errors";

type Props = {
  title: string;
  description: string;
  group: string;
  method: string;
  searchPlaceholder?: string;
  columns?: { key: string; header: string }[];
  query?: Record<string, unknown>;
  create?: { method: string; fields: { name: string; label: string; required?: boolean }[] };
};

const humanize = (key: string) => key.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
const display = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function HrisResourcePage({ title, description, group, method, searchPlaceholder, columns: configuredColumns, query: initialQuery = {}, create }: Props) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const currentUser = useCurrentUser();
  const role = currentUser.data?.role?.toLowerCase();
  const canCreate = role === "superadmin" || role === "keuangan";
  const createMutation = use_mutation<unknown, Error, Record<string, string>>({
    tag: group,
    method: create?.method ?? "create",
    invalidateKeys: [apiQueryKeys.resource(group)],
    mutationFn: async (body) => {
      setBrowserToken();
      return apiData((browserApi as any)[group][create!.method](body, { format: "json" }));
    },
    onSuccess: () => {
      setCreateOpen(false);
      setForm({});
      setFormError("");
    },
  });
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
      return apiData(api[method]({ ...input, format: "json" }));
    },
  });
  let payload: any = result.data;
  let meta: Record<string, any> = {};
  let rows: Record<string, any>[] = [];
  for (let depth = 0; depth < 6 && payload; depth += 1) {
    if (Array.isArray(payload)) {
      rows = payload;
      break;
    }
    if (typeof payload !== "object") break;
    meta = payload.pagination ?? meta;
    const nested = payload.data ?? payload.list ?? payload.items ?? payload.results;
    if (Array.isArray(nested)) {
      rows = nested;
      break;
    }
    payload = nested;
  }
  const keys =
    configuredColumns ??
    Object.keys(rows[0] ?? {})
      .filter((key) => !["id", "created_at", "updated_at", "deleted_at"].includes(key))
      .slice(0, 7)
      .map((key) => ({ key, header: humanize(key) }));
  const tableColumns = keys.map(({ key, header }) => ({ key, header, render: (row: Record<string, any>) => <span>{display(row[key])}</span> }));

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {create && canCreate ? (
          <Button
            type="button"
            onClick={() => {
              setForm({});
              setFormError("");
              setCreateOpen(true);
            }}
          >
            <Plus size={18} /> Tambah
          </Button>
        ) : null}
      </header>
      <Card>
        <CardContent className="pt-4">
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
        </CardContent>
      </Card>
      {create ? (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title={`Tambah ${title}`}
          description={`Isi data ${title.toLocaleLowerCase("id-ID")} baru.`}
          size="md"
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" form="hris-resource-create" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          }
        >
          <form
            id="hris-resource-create"
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const missing = create.fields.find((field) => field.required && !form[field.name]?.trim());
              if (missing) {
                setFormError(`${missing.label} wajib diisi.`);
                return;
              }
              setFormError("");
              createMutation.mutate(Object.fromEntries(create.fields.map((field) => [field.name, form[field.name]?.trim() ?? ""])));
            }}
          >
            {create.fields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={`create-${field.name}`}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                {field.name === "tipe_akun" ? (
                  <select
                    id={`create-${field.name}`}
                    required
                    value={form[field.name] ?? ""}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Pilih tipe akun</option>
                    <option value="BELANJA">Belanja</option>
                    <option value="PENDAPATAN">Pendapatan</option>
                  </select>
                ) : (
                  <Input id={`create-${field.name}`} required={field.required} value={form[field.name] ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, [field.name]: event.target.value }))} />
                )}
              </div>
            ))}
            {formError || createMutation.isError ? (
              <Alert variant="destructive">
                <AlertDescription>{formError || getApiErrorMessage(createMutation.error)}</AlertDescription>
              </Alert>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </section>
  );
}
