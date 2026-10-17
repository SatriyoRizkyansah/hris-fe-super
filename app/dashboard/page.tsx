"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Activity, ArrowRight, Building2, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { use_query } from "@/lib/api/use_query";

const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const shortcuts = [
  { href: "/dashboard/pegawai", title: "Data Pegawai", description: "Kelola data dan status pegawai.", icon: UsersRound },
  { href: "/dashboard/unit-kerja", title: "Struktur Organisasi", description: "Lihat unit koordinator dan subkoordinator.", icon: Building2 },
];

export default function DashboardPage() {
  const stats = use_query({
    tag: "dashboard",
    method: "dashboardControllerGetSuperadminDashboard",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      const rawCookie = document.cookie
        .split(";")
        .map((item) => item.trim())
        .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
        ?.slice(SESSION_COOKIE.length + 1);
      const role = readSession(rawCookie)?.user?.role;
      const request =
        role === "koordinator" ? browserApi.dashboard.dashboardControllerGetKoordinatorUnitDashboard(undefined, { format: "json" }) : browserApi.dashboard.dashboardControllerGetSuperadminDashboard(undefined, { format: "json" });
      return request as any;
    },
  });
  const summary = useMemo(() => unwrap(stats.data) ?? {}, [stats.data]);
  const figures = [
    { label: "Pegawai aktif", value: summary.pegawai_aktif ?? summary.total_pegawai_aktif ?? summary.total_pegawai ?? "—" },
    { label: "Unit kerja aktif", value: summary.unit_kerja_aktif ?? summary.total_unit_kerja ?? "—" },
    { label: "SK aktif", value: summary.sk_aktif ?? summary.total_sk_aktif ?? "—" },
  ];
  return (
    <section className="hris-page dashboard-page space-y-6" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <div>
          <span className="dashboard-eyebrow">
            <Activity size={15} /> SISTEM INFORMASI SDM LEMIGAS
          </span>
          <h1 id="dashboard-title">Ringkasan HRIS</h1>
          <p>Pantau data kepegawaian dan struktur organisasi dari satu tempat.</p>
        </div>
      </header>
      {stats.isError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ringkasan belum tersedia. Pastikan akun memiliki akses dashboard.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {figures.map((item, index) => (
          <Card key={item.label} className="dashboard-stat">
            <CardContent className="flex items-center justify-between gap-3 py-5">
              <div>
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stats.isLoading ? "…" : item.value}</p>
              </div>
              <span className={`dashboard-stat-icon dashboard-stat-icon-${index}`}>
                <UsersRound size={20} />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Akses cepat</h2>
          <p className="mt-1 text-sm text-muted-foreground">Fitur kepegawaian yang tersedia untuk akun Anda.</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {shortcuts.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="dashboard-shortcut">
            <span className="dashboard-shortcut-icon">
              <Icon size={21} />
            </span>
            <span className="min-w-0 flex-1">
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
            <ArrowRight size={18} className="dashboard-shortcut-arrow" />
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status koneksi</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 pb-5 text-sm">
          <span className={`status-dot ${stats.isError ? "status-dot-error" : ""}`} />
          {stats.isLoading ? "Menghubungkan ke layanan HRIS…" : stats.isError ? "Ringkasan API tidak dapat dimuat" : "Terhubung ke layanan HRIS"}
        </CardContent>
      </Card>
    </section>
  );
}
