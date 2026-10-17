"use client";

import { useMemo, useState } from "react";
import { UserRoundPlus, Eye, Pencil, UserRoundX } from "lucide-react";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/table/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

const unwrap = (v: any) => v?.data ?? v;

export default function PegawaiPage() {
  const [search, setSearch] = useState("");
  const [tipe, setTipe] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ nip_nik: "", nama: "", tipe_pegawai: "TA", ta_kategori: "BIASA", jabatan: "", email: "", telepon: "", tanggal_mulai: "" });
  const session =
    typeof document !== "undefined"
      ? readSession(
          document.cookie
            .split(";")
            .map((x) => x.trim())
            .find((x) => x.startsWith(`${SESSION_COOKIE}=`))
            ?.slice(SESSION_COOKIE.length + 1),
        )
      : null;
  const role = session?.user.role ?? "";
  const canEdit = role === "superadmin";
  const params = useMemo(() => ({ query: search || undefined, page, limit: 10, tipe_pegawai: tipe || undefined, status_aktif: status || undefined }) as any, [search, page, tipe, status]);
  const list = use_query({
    tag: "masterPegawai",
    method: "pegawaiGetControllerGetData",
    params,
    queryFn: async (p) => {
      setBrowserToken();
      return browserApi.masterPegawai.pegawaiGetControllerGetData(p) as any;
    },
  });
  const payload: any = unwrap(list.data);
  const rows: any[] = payload?.data ?? [];
  const pagination = payload?.pagination ?? {};
  const refreshKey = apiQueryKeys.resource("masterPegawai");
  const create = use_mutation({
    tag: "masterPegawai",
    method: "pegawaiPostControllerCreate",
    mutationFn: async (data: any) => {
      setBrowserToken();
      return browserApi.masterPegawai.pegawaiPostControllerCreate(data) as any;
    },
    invalidateKeys: [refreshKey],
    onSuccess: () => setFormOpen(false),
  });
  const update = use_mutation({
    tag: "masterPegawai",
    method: "pegawaiPutControllerUpdate",
    mutationFn: async ({ id, data }: any) => {
      setBrowserToken();
      return browserApi.masterPegawai.pegawaiPutControllerUpdate(id, data) as any;
    },
    invalidateKeys: [refreshKey],
    onSuccess: () => setFormOpen(false),
  });
  const deactivate = use_mutation({
    tag: "masterPegawai",
    method: "pegawaiDeleteControllerRemove",
    mutationFn: async (id: string) => {
      setBrowserToken();
      return browserApi.masterPegawai.pegawaiDeleteControllerRemove(id) as any;
    },
    invalidateKeys: [refreshKey],
  });
  const detail = use_query({
    tag: "masterPegawai",
    method: "pegawaiGetControllerGetDetail",
    params: selected?.id ?? "",
    enabled: Boolean(selected?.id),
    queryFn: async (id: string) => {
      setBrowserToken();
      return browserApi.masterPegawai.pegawaiGetControllerGetDetail(id) as any;
    },
  });
  const openEdit = (row: any) => {
    setSelected(row);
    setForm({
      nip_nik: row.nip_nik ?? "",
      nama: row.nama ?? "",
      tipe_pegawai: row.tipe_pegawai ?? "TA",
      ta_kategori: row.ta_kategori ?? "BIASA",
      jabatan: row.jabatan ?? "",
      email: row.email ?? "",
      telepon: row.telepon ?? "",
      tanggal_mulai: row.tanggal_mulai?.slice(0, 10) ?? "",
    });
    setFormOpen(true);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, tanggal_mulai: form.tanggal_mulai || undefined } as any;
    selected ? update.mutate({ id: String(selected.id), data }) : create.mutate(data);
  };

  return (
    <section className="hris-page space-y-5" aria-labelledby="pegawai-title">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="pegawai-title" className="text-2xl font-bold">
            Data Pegawai
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Kelola data pegawai LEMIGAS.</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setSelected(null);
              setForm({ nip_nik: "", nama: "", tipe_pegawai: "TA", ta_kategori: "BIASA", jabatan: "", email: "", telepon: "", tanggal_mulai: "" });
              setFormOpen(true);
            }}
          >
            <UserRoundPlus className="mr-2 size-4" />
            Tambah Pegawai
          </Button>
        )}
      </header>
      <Card>
        <CardContent className="space-y-4">
          {list.isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Memuat data pegawai…
            </p>
          ) : list.isError ? (
            <p role="alert" className="py-8 text-center text-sm text-destructive">
              Data gagal dimuat. Periksa koneksi API.
            </p>
          ) : (
            <DataTable
              columns={[
                { key: "nip_nik", header: "NIP/NIK", render: (r: any) => r.nip_nik ?? "—" },
                { key: "nama", header: "Nama", render: (r: any) => <span className="font-medium">{r.nama}</span> },
                { key: "tipe_pegawai", header: "Tipe", render: (r: any) => r.tipe_pegawai },
                { key: "jabatan", header: "Jabatan", render: (r: any) => r.jabatan ?? "—" },
                { key: "nama_unit_kerja", header: "Unit kerja", render: (r: any) => r.nama_unit_kerja ?? "—" },
                { key: "status_aktif", header: "Status", render: (r: any) => r.status_aktif },
                {
                  key: "actions",
                  header: "Aksi",
                  filterable: false,
                  render: (r: any) => (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Detail ${r.nama}`} onClick={() => setSelected(r)}>
                        <Eye className="size-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" aria-label={`Edit ${r.nama}`} onClick={() => openEdit(r)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Nonaktifkan ${r.nama}`}
                            onClick={() => {
                              if (confirm(`Nonaktifkan ${r.nama}?`)) deactivate.mutate(String(r.id));
                            }}
                          >
                            <UserRoundX className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
              rows={rows}
              rowKey={(r: any) => r.id}
              searchValue={search}
              searchPlaceholder="Cari nama atau NIP/NIK"
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              filters={[
                { field: "tipe_pegawai", label: "Tipe pegawai", options: ["PNS", "ASN", "OUTSOURCING", "TA"].map((value) => ({ label: value, value })) },
                { field: "status_aktif", label: "Status pegawai", options: ["AKTIF", "NONAKTIF"].map((value) => ({ label: value, value })) },
              ]}
              filterValues={{ tipe_pegawai: tipe || "__all", status_aktif: status || "__all" }}
              onFilterChange={(field, value) => {
                if (field === "tipe_pegawai") setTipe(value === "__all" ? "" : value);
                if (field === "status_aktif") setStatus(value === "__all" ? "" : value);
                setPage(1);
              }}
              remoteSearch
              pagination={{ page, pageSize: 10, total: pagination.total_datas ?? rows.length, totalPages: pagination.total_pages ?? 1, onPageChange: setPage, onPageSizeChange: () => undefined }}
              emptyMessage="Tidak ada data pegawai."
            />
          )}
        </CardContent>
      </Card>
      {formOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation">
          <form onSubmit={submit} aria-label={selected ? "Edit pegawai" : "Tambah pegawai"} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{selected ? "Edit Pegawai" : "Tambah Pegawai"}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["nip_nik", "NIP/NIK"],
                  ["nama", "Nama"],
                  ["jabatan", "Jabatan"],
                  ["email", "Email"],
                  ["telepon", "Telepon"],
                  ["tanggal_mulai", "Tanggal mulai"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-sm">
                  {label}
                  <Input type={key === "tanggal_mulai" ? "date" : "text"} required={key === "nama"} value={(form as any)[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                </label>
              ))}
              <label className="space-y-1 text-sm">
                Tipe pegawai
                <select className="h-10 w-full rounded-md border bg-background px-3" value={form.tipe_pegawai} onChange={(e) => setForm((f) => ({ ...f, tipe_pegawai: e.target.value }))}>
                  {["PNS", "ASN", "OUTSOURCING", "TA"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              {form.tipe_pegawai === "TA" && (
                <label className="space-y-1 text-sm">
                  Kategori TA
                  <select className="h-10 w-full rounded-md border bg-background px-3" value={form.ta_kategori} onChange={(e) => setForm((f) => ({ ...f, ta_kategori: e.target.value }))}>
                    {["BIASA", "KOORDINATOR", "SUBKOORDINATOR"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {selected ? "Simpan" : "Tambah"}
              </Button>
            </div>
          </form>
        </div>
      )}
      {selected && !formOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setSelected(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="detail-title" className="w-full max-w-lg rounded-xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="detail-title" className="text-lg font-semibold">
              Detail Pegawai
            </h2>
            <p className="mt-4">
              <b>Nama:</b> {unwrap(detail.data)?.nama ?? selected.nama}
            </p>
            <p className="mt-2">
              <b>NIP/NIK:</b> {unwrap(detail.data)?.nip_nik ?? selected.nip_nik ?? "—"}
            </p>
            <p className="mt-2">
              <b>Tipe:</b> {unwrap(detail.data)?.tipe_pegawai ?? selected.tipe_pegawai}
            </p>
            <p className="mt-2">
              <b>Status:</b> {unwrap(detail.data)?.status_aktif ?? selected.status_aktif}
            </p>
            <div className="mt-5 flex justify-end">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Tutup
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
