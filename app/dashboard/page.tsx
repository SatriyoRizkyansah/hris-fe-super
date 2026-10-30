"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Landmark,
  RefreshCw,
  ReceiptText,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { use_query } from "@/lib/api/use_query";

const unwrap = (value: any) => value?.data?.data ?? value?.data ?? value;
const money = (value: unknown) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const number = (value: unknown) => new Intl.NumberFormat("id-ID").format(Number(value) || 0);

const shortcuts = [
  { href: "/dashboard/proyek", title: "Proyek", description: "Lihat penerimaan termin dan posisi kas proyek.", icon: BriefcaseBusiness },
  { href: "/dashboard/ro", title: "Rencana Operasional", description: "Telusuri pagu, transaksi, dan sisa hak belanja RO.", icon: Landmark },
  { href: "/dashboard/dana-operasional", title: "Dana Operasional", description: "Pantau saldo dan pengeluaran dana operasional.", icon: Wallet },
  { href: "/dashboard/invoice", title: "Invoice", description: "Periksa penerimaan dan tagihan yang belum lunas.", icon: ReceiptText },
];

export default function DashboardPage() {
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => setHasMounted(true), []);

  const rawSession =
    typeof document === "undefined"
      ? undefined
      : document.cookie
          .split(";")
          .map((item) => item.trim())
          .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
          ?.slice(SESSION_COOKIE.length + 1);
  const sessionRole = readSession(rawSession)?.user?.role ?? "";
  const currentUser = useCurrentUser({}, sessionRole === "koordinator");
  const canSeeOperationalFunds =
    hasMounted &&
    (["superadmin", "keuangan", "keu_bendahara", "keu_karwas"].includes(sessionRole) ||
      (sessionRole === "koordinator" && currentUser.data?.unitKerjaKode === "ORG-UMUM"));

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
        role === "koordinator"
          ? browserApi.dashboard.dashboardControllerGetKoordinatorUnitDashboard(undefined, { format: "json" })
          : browserApi.dashboard.dashboardControllerGetSuperadminDashboard(undefined, { format: "json" });
      return request as any;
    },
  });

  const summary = useMemo(() => unwrap(stats.data) ?? {}, [stats.data]);
  const cashFlow = summary.cash_flow ?? {};
  const trend = Array.isArray(summary.monthly_trend) ? summary.monthly_trend : [];
  const budgets = useMemo(() => {
    if (Array.isArray(summary.budget_per_koordinator)) return summary.budget_per_koordinator;
    if (!summary.unit) return [];
    const ros = Array.isArray(summary.ro_breakdown) ? summary.ro_breakdown : [];
    const operational = Array.isArray(summary.operasional_breakdown) ? summary.operasional_breakdown : [];
    return [
      {
        id_unit_koordinator: summary.unit.id,
        nama_unit: summary.unit.nama_unit,
        total_plafon: ros.reduce((sum: number, row: any) => sum + Number(row.pagu_disetujui ?? row.total_plafon ?? 0), 0),
        total_terpakai: ros.reduce((sum: number, row: any) => sum + Number(row.realisasi ?? row.total_terpakai ?? 0), 0),
        sisa_saldo: ros.reduce((sum: number, row: any) => sum + Number(row.sisa_hak_belanja ?? 0), 0),
        total_plafon_operasional: operational.reduce((sum: number, row: any) => sum + Number(row.total_plafon ?? 0), 0),
        terpakai_operasional: operational.reduce((sum: number, row: any) => sum + Number(row.total_terpakai ?? 0), 0),
        sisa_operasional: operational.reduce((sum: number, row: any) => sum + Number(row.sisa_saldo ?? 0), 0),
        saldo_kas_tersedia: Number(cashFlow.saldo_kas_tersedia ?? 0),
      },
    ];
  }, [summary, cashFlow.saldo_kas_tersedia]);

  const totals = useMemo(() => {
    const totalRoBudget = budgets.reduce(
      (sum: number, item: any) => sum + (Number(item.total_plafon) || 0),
      0,
    );
    const totalRoRight = budgets.reduce(
      (sum: number, item: any) => sum + (Number(item.sisa_hak_belanja ?? item.sisa_saldo) || 0),
      0,
    );
    const totalOpsAvailable = budgets.reduce(
      (sum: number, item: any) => sum + (Number(item.sisa_operasional) || 0),
      0,
    );
    const cashPosition = Number(cashFlow.saldo_kas_tersedia ?? budgets.reduce(
      (sum: number, item: any) => sum + (Number(item.saldo_kas_tersedia) || 0),
      0,
    ));
    return {
      totalRoBudget,
      totalRoRight,
      totalOpsAvailable,
      cashPosition,
    };
  }, [budgets, cashFlow.saldo_kas_tersedia]);

  const maxFlow = Math.max(
    ...trend.map((item: any) => Math.max(Number(item.penerimaan_kas) || 0, Number(item.pengeluaran_kas) || 0)),
    1,
  );
  const incoming = Number(cashFlow.penerimaan_tahun_ini) || 0;
  const projectIncome = Number(cashFlow.penerimaan_proyek_tahun_ini) || 0;
  const retailIncome = Number(cashFlow.penerimaan_retail_tahun_ini) || 0;
  const outgoing = Number(cashFlow.pengeluaran_tahun_ini) || 0;
  const salaryAllocation = Number(cashFlow.alokasi_gaji_tahun_ini) || 0;
  const receivables = Number(cashFlow.piutang_invoice) || 0;
  const netFlow = incoming - outgoing;

  const figures = [
    {
      label: "Dana masuk",
      value: money(incoming),
      detail: `Proyek ${money(projectIncome)} · Retail ${money(retailIncome)}`,
      icon: ArrowDownRight,
      tone: "green",
    },
    {
      label: "Belanja tercatat",
      value: money(outgoing),
      detail: "Pengeluaran dari ledger RO dan operasional",
      icon: ArrowUpRight,
      tone: "amber",
    },
    {
      label: "Alokasi gaji",
      value: money(salaryAllocation),
      detail: "Alokasi aktif pada tahun fiskal ini",
      icon: Banknote,
      tone: "blue",
    },
    {
      label: "Saldo dana aktif",
      value: money(totals.cashPosition),
      detail: "Posisi kas RO + saldo operasional",
      icon: Wallet,
      tone: "violet",
    },
  ];

  return (
    <section className="hris-page dashboard-page space-y-6" aria-labelledby="dashboard-title">
      <header className="finance-dashboard-hero">
        <div className="relative z-10 max-w-2xl">
          <span className="finance-dashboard-eyebrow">
            <Activity size={15} /> RINGKASAN KEUANGAN · {summary.tahun ?? new Date().getFullYear()}
          </span>
          <h1 id="dashboard-title">Arus kas dan anggaran, dalam satu ringkasan.</h1>
          <p>Pantau dana masuk, belanja, saldo aktif, dan ruang anggaran seluruh unit kerja.</p>
        </div>
        <div className="finance-hero-mark" aria-hidden="true">
          <CircleDollarSign size={118} strokeWidth={1.1} />
        </div>
        <div className="finance-hero-foot">
          <span>
            <span className={`status-dot ${stats.isError ? "status-dot-error" : ""}`} />
            {stats.isLoading ? "Memuat arus kas" : stats.isError ? "Data belum tersedia" : "Ringkasan transaksi dan saldo"}
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
        {figures.map(({ label, value, detail, icon: Icon, tone }) => (
          <Card key={label} className="finance-kpi-card">
            <CardContent className="p-5" style={{ padding: "21px 22px 19px" }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600">{label}</p>
                <span className={`finance-kpi-icon finance-kpi-${tone}`}>
                  <Icon size={19} />
                </span>
              </div>
              <p className="mt-3 truncate text-2xl font-extrabold tracking-tight text-slate-950">
                {stats.isLoading ? "…" : stats.isError ? "—" : value}
              </p>
              <p className="mt-2 truncate text-xs text-slate-500" title={detail}>
                {detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="finance-panel">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base font-bold">Arus kas bulanan</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Penerimaan invoice dan pengeluaran ledger · {summary.tahun ?? new Date().getFullYear()}</p>
            </div>
            <span className="finance-panel-badge">
              <Activity size={14} /> Per bulan
            </span>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <div className="h-56 animate-pulse rounded-xl bg-slate-100" />
            ) : trend.length ? (
              <>
                <div className="finance-flow-legend" aria-label="Legenda arus kas">
                  <span><i className="finance-flow-dot finance-flow-dot-in" /> Dana masuk</span>
                  <span><i className="finance-flow-dot finance-flow-dot-out" /> Belanja tercatat</span>
                </div>
                <div className="finance-flow-chart" role="img" aria-label="Grafik arus masuk dan keluar per bulan">
                  {trend.map((item: any, index: number) => {
                    const received = Number(item.penerimaan_kas) || 0;
                    const spent = Number(item.pengeluaran_kas) || 0;
                    return (
                      <div
                        key={`${item.tahun}-${item.bulan}-${index}`}
                        className="finance-flow-month"
                        title={`${item.label}: masuk ${money(received)} · keluar ${money(spent)}`}
                      >
                        <div className="finance-flow-bars">
                          <span className="finance-flow-bar finance-flow-bar-in" style={{ height: `${Math.max(received ? 4 : 0, (received / maxFlow) * 100)}%` }} />
                          <span className="finance-flow-bar finance-flow-bar-out" style={{ height: `${Math.max(spent ? 4 : 0, (spent / maxFlow) * 100)}%` }} />
                        </div>
                        <span className="finance-chart-label">{item.label ?? item.bulan}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="finance-flow-footnote">
                  <span>Selisih penerimaan dan belanja</span>
                  <strong className={netFlow >= 0 ? "text-emerald-700" : "text-rose-700"}>{money(netFlow)}</strong>
                </div>
              </>
            ) : (
              <div className="finance-empty-chart">
                <Activity size={22} />
                <span>Belum ada transaksi untuk ditampilkan.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="finance-panel">
          <CardHeader>
            <CardTitle className="text-base font-bold">Posisi dana</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Hak anggaran dan tagihan berjalan</p>
          </CardHeader>
          <CardContent>
            <div className="finance-position-list">
              <div className="finance-position-row">
                <span>Pagu RO disetujui</span>
                <strong>{stats.isLoading ? "…" : money(totals.totalRoBudget)}</strong>
              </div>
              <div className="finance-position-row">
                <span>Sisa hak belanja RO</span>
                <strong>{stats.isLoading ? "…" : money(totals.totalRoRight)}</strong>
              </div>
              <div className="finance-position-row">
                <span>Sisa dana operasional</span>
                <strong>{stats.isLoading ? "…" : money(totals.totalOpsAvailable)}</strong>
              </div>
              <div className="finance-position-row finance-position-row-highlight">
                <span>Tagihan invoice belum lunas</span>
                <strong>{stats.isLoading ? "…" : money(receivables)}</strong>
              </div>
            </div>
            <p className="finance-position-note">
              Saldo kas menunjukkan uang yang tersedia. Sisa hak belanja menunjukkan pagu yang belum terpakai; nilainya dapat berbeda.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="finance-panel">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base font-bold">Anggaran dan kas per koordinator</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Realisasi, sisa hak belanja, serta posisi kas pada masing-masing unit.</p>
          </div>
          <Link href="/dashboard/ro" className="finance-text-link">
            Lihat RO <ArrowRight size={15} />
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          {budgets.length ? (
            budgets.slice(0, 8).map((item: any) => {
              const budget = Number(item.total_plafon) || 0;
              const spent = Number(item.total_terpakai) || 0;
              const right = Number(item.sisa_hak_belanja ?? item.sisa_saldo) || 0;
              const pct = budget ? Math.min(100, Math.max(0, (spent / budget) * 100)) : 0;
              const cash = Number(item.saldo_kas_tersedia ?? ((Number(item.posisi_kas_ro) || 0) + (Number(item.posisi_kas_operasional) || 0))) || 0;
              return (
                <div key={item.id_unit_koordinator ?? item.id} className="finance-unit-row">
                  <div className="finance-unit-heading">
                    <strong title={item.nama_unit}>{item.nama_unit}</strong>
                    <span>Kas tersedia <b>{money(cash)}</b></span>
                  </div>
                  <div className="finance-unit-progress" aria-label={`Realisasi pagu ${pct.toFixed(0)} persen`}>
                    <div className="finance-chart-bar h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="finance-unit-details">
                    <span>Terpakai {money(spent)} dari pagu RO {money(budget)}</span>
                    <span>Sisa hak {money(right)}</span>
                  </div>
                  {(Number(item.total_plafon_operasional) || 0) > 0 && (
                    <div className="finance-unit-details finance-unit-operational">
                      <span>Dana operasional {money(item.total_plafon_operasional)}</span>
                      <span>Tersisa {money(item.sisa_operasional)}</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="finance-empty-chart">
              <Building2 size={22} />
              <span>{stats.isLoading ? "Memuat posisi unit…" : "Belum ada ringkasan anggaran unit."}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Akses cepat keuangan</h2>
          <p className="mt-1 text-sm text-muted-foreground">Buka rincian transaksi, tagihan, dan sumber dana.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {shortcuts
          .filter((item) => item.href !== "/dashboard/dana-operasional" || canSeeOperationalFunds)
          .map(({ href, title, description, icon: Icon }) => (
            <Link key={href} href={href} className="dashboard-shortcut">
              <span className="dashboard-shortcut-icon"><Icon size={21} /></span>
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
            <span className="finance-kpi-icon finance-kpi-green"><UsersRound size={19} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pegawai aktif</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{stats.isLoading ? "…" : number(summary.total_pegawai_aktif ?? summary.jumlah_pegawai_aktif)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="finance-mini-card">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="finance-kpi-icon finance-kpi-violet"><Building2 size={19} /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyek dan RO</p>
              <p className="mt-1 text-xl font-extrabold text-slate-900">{stats.isLoading ? "…" : `${number(summary.total_proyek)} / ${number(summary.total_ro)}`}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
