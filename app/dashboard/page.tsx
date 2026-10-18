"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BriefcaseBusiness, Building2, CircleDollarSign, Landmark, RefreshCw, UsersRound, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { use_query } from "@/lib/api/use_query";

const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const money = (value: unknown) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const number = (value: unknown) => new Intl.NumberFormat("id-ID").format(Number(value) || 0);
const shortcuts = [
  { href: "/dashboard/proyek", title: "Proyek", description: "Pantau portofolio proyek.", icon: BriefcaseBusiness },
  { href: "/dashboard/ro", title: "Rencana Operasional", description: "Lihat plafon, realisasi, dan saldo RO.", icon: Landmark },
  { href: "/dashboard/dana-operasional", title: "Dana Operasional", description: "Pantau penggunaan dana operasional.", icon: Wallet },
  { href: "/dashboard/alokasi-gaji/rekap", title: "Rekap Alokasi Gaji", description: "Tinjau alokasi gaji per periode.", icon: Banknote },
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
  const trend = Array.isArray(summary.monthly_trend) ? summary.monthly_trend : [];
  const budgets = Array.isArray(summary.budget_per_koordinator) ? summary.budget_per_koordinator : [];
  const totalRoBudget = budgets.reduce((sum: number, item: any) => sum + (Number(item.total_plafon) || 0), 0);
  const totalRoSpent = budgets.reduce((sum: number, item: any) => sum + (Number(item.total_terpakai) || 0), 0);
  const totalOpsBudget = budgets.reduce((sum: number, item: any) => sum + (Number(item.total_plafon_operasional) || 0), 0);
  const totalOpsSpent = budgets.reduce((sum: number, item: any) => sum + (Number(item.terpakai_operasional) || 0), 0);
  const figures = [
    { label: "Pagu RO", value: money(totalRoBudget), used: money(totalRoSpent), percent: totalRoBudget ? Math.min(100, (totalRoSpent / totalRoBudget) * 100) : 0, icon: Landmark, tone: "blue" },
    {
      label: "Sisa anggaran RO",
      value: money(totalRoBudget - totalRoSpent),
      used: `${money(totalRoSpent)} terealisasi`,
      percent: totalRoBudget ? Math.min(100, (totalRoSpent / totalRoBudget) * 100) : 0,
      icon: CircleDollarSign,
      tone: "green",
    },
    { label: "Pagu operasional", value: money(totalOpsBudget), used: money(totalOpsSpent), percent: totalOpsBudget ? Math.min(100, (totalOpsSpent / totalOpsBudget) * 100) : 0, icon: Wallet, tone: "amber" },
    { label: "Proyek & RO", value: `${number(summary.total_proyek)} / ${number(summary.total_ro)}`, used: "Jumlah proyek / RO aktif", percent: 0, icon: BriefcaseBusiness, tone: "violet" },
  ];
  const maxTrend = Math.max(...trend.map((item: any) => Number(item.total_jumlah) || 0), 1);
  const maxBudget = Math.max(...budgets.map((item: any) => Number(item.total_plafon) || 0), 1);
  return (
    <section className="hris-page dashboard-page space-y-6" aria-labelledby="dashboard-title">
      <header
        className="finance-dashboard-hero"
        style={{ background: "radial-gradient(ellipse at 86% 14%, rgba(250, 204, 21, 0.25), transparent 34%), linear-gradient(120deg, #101827 0%, #152b45 58%, #184d56 100%)", padding: "36px 36px 58px", minHeight: 220, color: "#fff" }}
      >
        <div className="relative z-10 max-w-2xl">
          <span className="finance-dashboard-eyebrow">
            <Activity size={15} /> DASHBOARD KEUANGAN · {summary.tahun ?? new Date().getFullYear()}
          </span>
          <h1 id="dashboard-title" style={{ color: "#fff" }}>
            Kontrol anggaran, lebih jelas.
          </h1>
          <p style={{ color: "#fff" }}>Ringkasan pagu, realisasi, saldo, dan tren alokasi dari seluruh unit kerja.</p>
        </div>
        <div className="finance-hero-mark" aria-hidden="true">
          <CircleDollarSign size={118} strokeWidth={1.1} />
        </div>
        <div className="finance-hero-foot">
          <span>
            <span className={`status-dot ${stats.isError ? "status-dot-error" : ""}`} />
            {stats.isLoading ? "Memuat data keuangan" : stats.isError ? "Data belum tersedia" : "Data keuangan terkini"}
          </span>
          <span>
            <RefreshCw size={13} /> Diperbarui saat halaman dimuat
          </span>
        </div>
      </header>
      {stats.isError && (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Ringkasan keuangan belum dapat dimuat. Periksa akses akun dan koneksi API.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {figures.map(({ label, value, used, percent, icon: Icon, tone }) => (
          <Card key={label} className="finance-kpi-card">
            <CardContent className="p-5" style={{ padding: "24px 22px 22px" }}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600">{label}</p>
                <span className={`finance-kpi-icon finance-kpi-${tone}`}>
                  <Icon size={19} />
                </span>
              </div>
              <p className="mt-4 truncate text-2xl font-extrabold tracking-tight text-slate-950">{stats.isLoading ? "…" : value}</p>
              <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="truncate">{used}</span>
                {percent > 0 && <span className="font-bold text-slate-700">{percent.toFixed(0)}%</span>}
              </div>
              {percent > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full finance-progress-${tone}`} style={{ width: `${percent}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card className="finance-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0" style={{ padding: "24px 24px 14px" }}>
            <div>
              <CardTitle className="text-base font-bold">Tren alokasi bulanan</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Total alokasi gaji per bulan · {summary.tahun ?? new Date().getFullYear()}</p>
            </div>
            <span className="finance-panel-badge">
              <ArrowUpRight size={14} /> Bulanan
            </span>
          </CardHeader>
          <CardContent className="pt-2" style={{ padding: "8px 24px 24px" }}>
            {stats.isLoading ? (
              <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
            ) : trend.length ? (
              <div className="finance-chart" role="img" aria-label="Grafik tren alokasi bulanan">
                {trend.map((item: any, index: number) => {
                  const amount = Number(item.total_jumlah) || 0;
                  const height = Math.max(5, (amount / maxTrend) * 100);
                  return (
                    <div key={`${item.tahun}-${item.bulan}-${index}`} className="finance-chart-column" title={`${item.label}: ${money(amount)}`}>
                      <span className="finance-chart-value">{amount ? money(amount) : "—"}</span>
                      <div className="finance-chart-track">
                        <div className="finance-chart-bar" style={{ height: `${height}%` }} />
                      </div>
                      <span className="finance-chart-label">{item.label ?? item.bulan}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="finance-empty-chart">
                <Activity size={22} />
                <span>Belum ada data alokasi untuk ditampilkan.</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="finance-panel">
          <CardHeader style={{ padding: "24px 24px 14px" }}>
            <CardTitle className="text-base font-bold">Komposisi realisasi</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Penggunaan pagu anggaran</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-1" style={{ padding: "8px 24px 24px" }}>
            {[
              { label: "Rencana Operasional", spent: totalRoSpent, budget: totalRoBudget, color: "blue" },
              { label: "Dana Operasional", spent: totalOpsSpent, budget: totalOpsBudget, color: "amber" },
            ].map((item) => {
              const pct = item.budget ? Math.min(100, (item.spent / item.budget) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                    <span className="text-sm font-bold text-slate-900">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full finance-progress-${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between gap-3 text-xs text-slate-500">
                    <span>Terpakai {money(item.spent)}</span>
                    <span>Pagu {money(item.budget)}</span>
                  </div>
                </div>
              );
            })}
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <ArrowDownRight size={16} className="text-emerald-600" />
                Saldo tersedia
              </div>
              <p className="mt-2 text-xl font-extrabold text-slate-950">{money(totalRoBudget - totalRoSpent + (totalOpsBudget - totalOpsSpent))}</p>
              <p className="mt-1 text-xs text-slate-500">Gabungan sisa pagu RO dan operasional</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="finance-panel">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0" style={{ padding: "24px 24px 14px" }}>
          <div>
            <CardTitle className="text-base font-bold">Anggaran per unit koordinator</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Pagu dan realisasi Rencana Operasional</p>
          </div>
          <Link href="/dashboard/ro" className="finance-text-link">
            Lihat RO <ArrowRight size={15} />
          </Link>
        </CardHeader>
        <CardContent className="space-y-5 pt-2" style={{ padding: "8px 24px 24px" }}>
          {budgets.length ? (
            budgets.slice(0, 6).map((item: any) => {
              const budget = Number(item.total_plafon) || 0;
              const spent = Number(item.total_terpakai) || 0;
              const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
              return (
                <div key={item.id_unit_koordinator} className="finance-unit-row">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-slate-800">{item.nama_unit}</div>
                      <div className="shrink-0 text-xs font-semibold text-slate-600">{pct.toFixed(0)}%</div>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="finance-chart-bar h-full rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>
                        {money(spent)} terealisasi dari {money(budget)}
                      </span>
                      <span>Sisa {money(Number(item.sisa_saldo) || budget - spent)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="finance-empty-chart">
              <Building2 size={22} />
              <span>{stats.isLoading ? "Memuat anggaran unit…" : "Belum ada ringkasan anggaran unit."}</span>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Akses cepat keuangan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buka modul untuk menelusuri detail transaksi dan anggaran.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="finance-mini-card">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="finance-kpi-icon finance-kpi-green">
              <UsersRound size={19} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pegawai aktif</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{stats.isLoading ? "…" : number(summary.total_pegawai_aktif)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="finance-mini-card">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="finance-kpi-icon finance-kpi-violet">
              <Building2 size={19} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit kerja</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{stats.isLoading ? "…" : number(summary.total_unit)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
