"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";

const body = (value: any) => value?.data?.data ?? value?.data ?? value;
const money = (value: unknown) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value ?? 0));
const date = (value: unknown) => (value ? new Date(String(value)).toLocaleDateString("id-ID") : "—");

export default function ProfilPage() {
  const [page, setPage] = useState(1);
  const profile = use_query({
    tag: "myProfile",
    method: "myProfileControllerGetProfile",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.myProfile.myProfileControllerGetProfile() as any;
    },
  });
  const skHistory = use_query({
    tag: "myProfile",
    method: "myProfileControllerGetMySk",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.myProfile.myProfileControllerGetMySk() as any;
    },
  });
  const allocations = use_query({
    tag: "myProfile",
    method: "myProfileControllerGetMyAlokasi",
    params: { page, limit: 10 },
    queryFn: async (p) => {
      setBrowserToken();
      return browserApi.myProfile.myProfileControllerGetMyAlokasi(p) as any;
    },
  });
  const info = body(profile.data) ?? {};
  const account = info.user ?? {};
  const employee = info.pegawai ?? null;
  const skActive = employee?.sk_aktif;
  const skPayload = body(skHistory.data);
  const sks = Array.isArray(skPayload) ? skPayload : Array.isArray(skPayload?.data) ? skPayload.data : [];
  const allocationPayload = body(allocations.data) ?? {};
  const allocationRows = allocationPayload.alokasi ?? allocationPayload.data ?? [];
  const pagination = allocationPayload.pagination ?? {};
  const accountName = String(account.nama ?? "Pengguna");
  const initials = accountName.split(/\s+/).filter(Boolean).slice(0, 2).map((part: string) => part[0]).join("").toUpperCase() || "P";
  const unitName = employee?.unit_kerja?.nama_unit ?? account.unit_kerja?.nama_unit;

  return (
    <section className="hris-page space-y-5" aria-labelledby="profile-title">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 id="profile-title" className="text-2xl font-bold">
            Profil Saya
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Informasi akun, data kepegawaian, riwayat SK, dan alokasi gaji.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            void profile.refetch();
            void skHistory.refetch();
            void allocations.refetch();
          }}
        >
          Muat ulang
        </Button>
      </header>
      {profile.isError && (
        <p role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {profile.error instanceof Error ? profile.error.message : "Gagal memuat data profil."}
        </p>
      )}
      {profile.isLoading ? (
        <p role="status">Memuat profil…</p>
      ) : (
        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200 bg-gradient-to-r from-white via-white to-amber-50/70">
            <CardContent className="flex flex-wrap items-center gap-4 p-5 sm:p-6">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-slate-900 text-xl font-bold tracking-wide text-amber-300 shadow-sm">{initials}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Akun aktif</p>
                <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900">{accountName}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{account.email ?? "Email belum tersedia"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{account.nama_role ?? account.role ?? "Role belum tersedia"}</span>
                {unitName && <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">{unitName}</span>}
                {employee?.status_aktif && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{employee.status_aktif}</span>}
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Informasi Akun</CardTitle></CardHeader>
              <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {[["Nama", account.nama], ["Email", account.email], ["Role", account.nama_role ?? account.role], ["Unit Kerja", unitName]].map(([label, value]) => (
                  <div key={label} className="min-w-0 border-b border-border/70 pb-3 last:border-0">
                    <p className="text-xs font-medium text-muted-foreground">{label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">{value || "Belum tersedia"}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Data Kepegawaian</CardTitle></CardHeader>
              <CardContent>
                {employee ? (
                  <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                    {[["NIP/NIK", employee.nip_nik], ["Jabatan", employee.jabatan], ["Tipe Pegawai", employee.tipe_pegawai], ["Unit Kerja", unitName], ["Gaji Bulanan", employee.gaji_bulanan == null ? null : money(employee.gaji_bulanan)], ["SK Aktif", skActive ? `${skActive.nomor_sk ?? "—"} · ${date(skActive.masa_berlaku_mulai)} – ${date(skActive.masa_berlaku_akhir)}` : "Belum ada SK aktif"]].map(([label, value]) => (
                      <div key={label} className="min-w-0 border-b border-border/70 pb-3 last:border-0">
                        <p className="text-xs font-medium text-muted-foreground">{label}</p>
                        <p className="mt-1 break-words text-sm font-semibold text-foreground">{value || "Belum tersedia"}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/20 p-4">
                    <p className="text-sm font-semibold">Belum tertaut ke data pegawai</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Profil akun dan hak akses tetap aktif. Data jabatan, SK, dan alokasi gaji muncul setelah akun dihubungkan ke data pegawai.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat SK</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {skHistory.isError ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Riwayat SK tidak dapat dimuat saat ini.</p>
          ) : !employee ? (
            <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">Riwayat SK belum tersedia karena akun ini belum tertaut ke data pegawai.</p>
          ) : skHistory.isLoading ? (
            <p role="status">Memuat riwayat SK…</p>
          ) : sks.length ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  {["Nomor SK", "Jabatan", "Masa berlaku", "Status"].map((x) => (
                    <th key={x} className="px-3 py-2">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sks.map((row: any) => (
                  <tr key={row.id ?? row.nomor_sk} className="border-b">
                    <td className="px-3 py-3">{row.nomor_sk ?? "—"}</td>
                    <td className="px-3 py-3">{row.jabatan ?? "—"}</td>
                    <td className="px-3 py-3">
                      {date(row.masa_berlaku_mulai)} – {date(row.masa_berlaku_akhir)}
                    </td>
                    <td className="px-3 py-3">{row.status_aktif ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-5 text-sm text-muted-foreground">Belum ada riwayat SK.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alokasi Gaji</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          {allocations.isError ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Riwayat alokasi gaji tidak dapat dimuat saat ini.</p>
          ) : !employee ? (
            <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">Riwayat alokasi gaji belum tersedia karena akun ini belum tertaut ke data pegawai.</p>
          ) : allocations.isLoading ? (
            <p role="status">Memuat alokasi…</p>
          ) : allocationRows.length ? (
            <>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    {["Periode", "Sumber", "RO / Operasional", "Jumlah", "Status", "Keterangan"].map((x) => (
                      <th key={x} className="px-3 py-2">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allocationRows.map((row: any) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-3">
                        {row.periode_bulan}/{row.periode_tahun}
                      </td>
                      <td className="px-3 py-3">{row.sumber_dana ?? "—"}</td>
                      <td className="px-3 py-3">{row.nama_ro ?? row.dana_operasional_id ?? "—"}</td>
                      <td className="px-3 py-3">{money(row.jumlah)}</td>
                      <td className="px-3 py-3">{row.status ?? "—"}</td>
                      <td className="px-3 py-3">{row.keterangan ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-3 text-sm">
                <span>
                  Halaman {page} dari {pagination.total_pages ?? 1}
                </span>
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= (pagination.total_pages ?? 1)} onClick={() => setPage((p) => p + 1)}>
                  Berikutnya
                </Button>
              </div>
            </>
          ) : (
            <p className="py-5 text-sm text-muted-foreground">Belum ada data alokasi gaji.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
