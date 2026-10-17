"use client";

import { useMemo, useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const unwrap = (value: any) => value?.data ?? value;
function Tree({ node, depth = 0 }: { node: any; depth?: number }) {
  if (!node) return null;
  return (
    <div className="border-b py-2" style={{ paddingLeft: depth * 22 }}>
      <span className="font-medium">{node.nama_unit ?? "—"}</span>
      <span className="ml-2 text-sm text-muted-foreground">
        {node.kode_unit ?? ""} · {node.tipe_unit ?? ""} · {node.status_aktif ?? ""}
      </span>
      {node.kepala_unit_nama && <span className="ml-2 text-xs text-muted-foreground">Kepala: {node.kepala_unit_nama}</span>}
      {(node.children ?? []).map((child: any) => (
        <Tree key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function UnitKerjaPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ kode_unit: "", nama_unit: "", tipe_unit: "KOORDINATOR", id_parent_unit: "", id_kepala_unit: "", deskripsi: "" });
  const params = useMemo(() => ({ query: search || undefined, page, limit: 10, tipe_unit: type || undefined }) as any, [search, page, type]);
  const list = use_query({
    tag: "masterUnitKerja",
    method: "unitKerjaGetControllerGetData",
    params,
    queryFn: async (p) => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetControllerGetData(p) as any;
    },
  });
  const treeQuery = use_query({
    tag: "masterUnitKerja",
    method: "unitKerjaGetControllerGetTree",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetControllerGetTree() as any;
    },
  });
  const people = use_query({
    tag: "masterPegawai",
    method: "pegawaiGetControllerGetData",
    params: { status_aktif: "AKTIF", limit: 200 } as any,
    queryFn: async (p) => {
      setBrowserToken();
      return browserApi.masterPegawai.pegawaiGetControllerGetData(p) as any;
    },
  });
  const keys = [apiQueryKeys.resource("masterUnitKerja")];
  const create = use_mutation({
    tag: "masterUnitKerja",
    method: "unitKerjaPostControllerCreate",
    mutationFn: async (data: any) => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaPostControllerCreate(data) as any;
    },
    invalidateKeys: keys,
    onSuccess: () => setFormOpen(false),
  });
  const update = use_mutation({
    tag: "masterUnitKerja",
    method: "unitKerjaPutControllerUpdate",
    mutationFn: async ({ id, data }: any) => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaPutControllerUpdate(id, data) as any;
    },
    invalidateKeys: keys,
    onSuccess: () => setFormOpen(false),
  });
  const remove = use_mutation({
    tag: "masterUnitKerja",
    method: "unitKerjaDeleteControllerRemove",
    mutationFn: async (id: string) => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaDeleteControllerRemove(id) as any;
    },
    invalidateKeys: keys,
  });
  const payload: any = unwrap(list.data) ?? {};
  const rows = payload.data ?? [];
  const pagination = payload.pagination ?? {};
  const units = rows.filter((row: any) => row.tipe_unit === "KOORDINATOR" && row.id !== selected?.id);
  const employees = unwrap(people.data)?.data ?? [];
  const tree = unwrap(treeQuery.data)?.data ?? unwrap(treeQuery.data);
  const refresh = () => {
    void list.refetch();
    void treeQuery.refetch();
  };
  const openEdit = (row: any) => {
    setSelected(row);
    setForm({ kode_unit: row.kode_unit ?? "", nama_unit: row.nama_unit ?? "", tipe_unit: row.tipe_unit ?? "KOORDINATOR", id_parent_unit: row.parent_unit_id ?? "", id_kepala_unit: row.id_kepala_unit ?? "", deskripsi: row.deskripsi ?? "" });
    setFormOpen(true);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { nama_unit: form.nama_unit, tipe_unit: form.tipe_unit, id_parent_unit: form.id_parent_unit || undefined, id_kepala_unit: form.id_kepala_unit || undefined, deskripsi: form.deskripsi || undefined };
    if (selected) update.mutate({ id: String(selected.id), data });
    else create.mutate({ ...data, kode_unit: form.kode_unit });
  };

  return (
    <section className="hris-page space-y-5" aria-labelledby="unit-title">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="unit-title" className="text-2xl font-bold">
            Struktur Organisasi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Pengelolaan unit kerja koordinator dan sub koordinator.</p>
        </div>
        <Button
          onClick={() => {
            setSelected(null);
            setForm({ kode_unit: "", nama_unit: "", tipe_unit: "KOORDINATOR", id_parent_unit: "", id_kepala_unit: "", deskripsi: "" });
            setFormOpen(true);
          }}
        >
          Tambah Unit
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Struktur Organisasi</CardTitle>
        </CardHeader>
        <CardContent>{treeQuery.isLoading ? <p role="status">Memuat struktur organisasi…</p> : tree ? <Tree node={tree} /> : <p className="text-sm text-muted-foreground">Belum ada data unit kerja.</p>}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Unit Kerja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-56 flex-1"
              aria-label="Cari unit kerja"
              placeholder="Cari kode atau nama unit"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              aria-label="Tipe unit"
              className="h-10 rounded-md border bg-background px-3"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua tipe</option>
              <option value="KOORDINATOR">Koordinator</option>
              <option value="SUB_KOORDINATOR">Sub Koordinator</option>
            </select>
          </div>
          {list.isLoading ? (
            <p role="status">Memuat unit kerja…</p>
          ) : list.isError ? (
            <p role="alert">Gagal memuat unit kerja.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    {["Kode", "Nama Unit", "Tipe", "Kepala Unit", "Pegawai Aktif", "Status", "Aksi"].map((x) => (
                      <th key={x} className="px-3 py-2">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-3">{row.kode_unit}</td>
                      <td className="px-3 py-3">
                        <b>{row.nama_unit}</b>
                        <p className="text-xs text-muted-foreground">{row.deskripsi}</p>
                      </td>
                      <td className="px-3 py-3">{row.tipe_unit}</td>
                      <td className="px-3 py-3">{row.kepala_unit_nama ?? "—"}</td>
                      <td className="px-3 py-3">{row.jumlah_pegawai_aktif ?? 0}</td>
                      <td className="px-3 py-3">{row.status_aktif}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            Ubah
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (confirm(`Nonaktifkan unit ${row.nama_unit}?`)) remove.mutate(String(row.id));
                            }}
                          >
                            Nonaktifkan
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        Tidak ada data unit kerja.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span>Total {pagination.total_datas ?? rows.length}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Sebelumnya
              </Button>
              <span>
                Halaman {page} dari {pagination.total_pages ?? 1}
              </span>
              <Button size="sm" variant="outline" disabled={page >= (pagination.total_pages ?? 1)} onClick={() => setPage((p) => p + 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {formOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form aria-label={selected ? "Edit unit kerja" : "Tambah unit kerja"} onSubmit={submit} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-auto rounded-xl bg-background p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{selected ? "Ubah Unit" : "Tambah Unit"}</h2>
            {!selected && (
              <label className="block space-y-1 text-sm">
                Kode Unit
                <Input required value={form.kode_unit} onChange={(e) => setForm((f) => ({ ...f, kode_unit: e.target.value }))} />
              </label>
            )}
            <label className="block space-y-1 text-sm">
              Nama Unit
              <Input required value={form.nama_unit} onChange={(e) => setForm((f) => ({ ...f, nama_unit: e.target.value }))} />
            </label>
            <label className="block space-y-1 text-sm">
              Tipe Unit
              <select className="h-10 w-full rounded-md border bg-background px-3" value={form.tipe_unit} onChange={(e) => setForm((f) => ({ ...f, tipe_unit: e.target.value, id_parent_unit: "" }))}>
                <option value="KOORDINATOR">Koordinator</option>
                <option value="SUB_KOORDINATOR">Sub Koordinator</option>
              </select>
            </label>
            {form.tipe_unit === "SUB_KOORDINATOR" && (
              <label className="block space-y-1 text-sm">
                Unit Koordinator
                <select required className="h-10 w-full rounded-md border bg-background px-3" value={form.id_parent_unit} onChange={(e) => setForm((f) => ({ ...f, id_parent_unit: e.target.value }))}>
                  <option value="">Pilih unit</option>
                  {units.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.kode_unit} — {u.nama_unit}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block space-y-1 text-sm">
              Kepala Unit
              <select className="h-10 w-full rounded-md border bg-background px-3" value={form.id_kepala_unit} onChange={(e) => setForm((f) => ({ ...f, id_kepala_unit: e.target.value }))}>
                <option value="">Pilih pegawai</option>
                {employees.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.nama} — {p.nip_nik}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              Deskripsi
              <textarea className="min-h-20 w-full rounded-md border bg-background p-2" value={form.deskripsi} onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                Simpan
              </Button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
