"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, BriefcaseBusiness, Building2, CircleDollarSign, FileText, ReceiptText, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/table/DataTable";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { EmptyData } from "@/components/loading/EmptyData";
import { Button } from "@/components/ui/Button";
import { formatDate, formatRupiah, humanizeStatus } from "@/lib/hris/format";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

type Row = Record<string, any>;
type MonevPayload = {
  tahun: number;
  ringkasan: Row;
  proyek: Row[];
  unit: Row[];
  arus_kas_bulanan: Row[];
  piutang: Row[];
  catatan_metodologi: string[];
};

const unwrap = (value: unknown): any => {
  let current: any = value;
  for (let depth = 0; depth < 5 && current && typeof current === "object" && current.data && typeof current.data === "object"; depth += 1) {
    current = current.data;
  }
  return current ?? {};
};
const amount = (value: unknown) => formatRupiah(Number(value) || 0);
const shortStatus = (value: unknown) => humanizeStatus(String(value ?? "—"));
const compactAmount = (value: number) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
}).format(value);
const compactChartValue = (value: unknown) => new Intl.NumberFormat("id-ID", {
  notation: "compact",
  maximumFractionDigits: 1,
}).format(Number(value) || 0);
const compactLabel = (value: unknown, maxLength = 22) => {
  const label = String(value ?? "");
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
};

const cashChartConfig: ChartConfig = {
  penerimaan_invoice: { label: "Penerimaan invoice", color: "#0284c7" },
  pengeluaran_ledger: { label: "Pengeluaran ledger", color: "#f59e0b" },
};
const unitChartConfig: ChartConfig = {
  pagu_ro_disetujui_saat_ini: { label: "Pagu RO", color: "#94a3b8" },
  realisasi_ro_saat_ini: { label: "Realisasi RO", color: "#0284c7" },
};
const projectChartConfig: ChartConfig = {
  nilai_kontrak: { label: "Nilai kontrak", color: "#0284c7" },
  direct_cost_rencana: { label: "Direct cost rencana", color: "#94a3b8" },
  margin_rencana: { label: "Margin rencana", color: "#f59e0b" },
};
const receivableChartConfig: ChartConfig = {
  piutang: { label: "Sisa piutang", color: "#f59e0b" },
};

const sections = [
  { href: "/dashboard/karwas", label: "Ringkasan", icon: Activity },
  { href: "/dashboard/karwas/unit", label: "Kinerja Unit", icon: Building2 },
  { href: "/dashboard/karwas/proyek", label: "Analisis Proyek", icon: BriefcaseBusiness },
  { href: "/dashboard/karwas/arus-kas", label: "Arus Kas & Piutang", icon: CircleDollarSign },
];

function Metric({ label, value, hint, icon: Icon, href }: { label: string; value: string; hint?: string; icon: typeof Activity; href?: string }) {
  const content = (
    <Card className="h-full border-slate-200 shadow-none">
      <CardContent className={`flex min-h-[108px] items-start justify-between gap-3 p-4 ${href ? "transition-colors group-hover:bg-slate-50/70" : ""}`}>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}
        </div>
        <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon size={18} /></span>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" aria-label={`${label}: ${value}. Buka rincian.`}>{content}</Link> : content;
}

function TableSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="gap-1 pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-1">{children}</CardContent>
    </Card>
  );
}

function MonthlyCashChart({ rows, selectedMonth, onSelectMonth }: { rows: Row[]; selectedMonth?: string; onSelectMonth?: (month: string) => void }) {
  const selectedRow = rows.find((row) => String(row.bulan) === selectedMonth);
  return (
    <ChartSection title="Arus kas bulanan" description="Penerimaan invoice tervalidasi dibanding pengeluaran ledger. Klik grafik atau pilih bulan untuk melihat rinciannya.">
      <ChartContainer config={cashChartConfig} className="h-[300px]">
        <BarChart data={rows} margin={{ top: 22, right: 8, left: 4, bottom: 0 }} onClick={(event: any) => {
          const row = event?.activePayload?.[0]?.payload;
          if (row?.bulan) onSelectMonth?.(String(row.bulan));
        }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={54} tickFormatter={(value) => compactAmount(Number(value))} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="penerimaan_invoice" fill="var(--color-penerimaan_invoice)" radius={[4, 4, 0, 0]} maxBarSize={30}>
            <LabelList dataKey="penerimaan_invoice" position="top" formatter={compactChartValue} fill="#0369a1" fontSize={9} />
          </Bar>
          <Bar dataKey="pengeluaran_ledger" fill="var(--color-pengeluaran_ledger)" radius={[4, 4, 0, 0]} maxBarSize={30}>
            <LabelList dataKey="pengeluaran_ledger" position="top" formatter={compactChartValue} fill="#b45309" fontSize={9} />
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground sm:justify-end">
        <span>Lihat rincian bulan</span>
        <Select value={selectedMonth ?? ""} onValueChange={(value) => value && onSelectMonth?.(value)}>
          <SelectTrigger aria-label="Pilih bulan untuk rincian arus kas" className="h-8 w-36 bg-white"><SelectValue placeholder="Pilih bulan" /></SelectTrigger>
          <SelectContent>{rows.map((row) => <SelectItem key={row.bulan} value={String(row.bulan)}>{row.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {selectedRow && <div className="mt-3 flex flex-col gap-2 rounded-lg bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
        <div><p className="text-sm font-medium text-slate-900">Rincian {selectedRow.label}</p><p className="text-xs text-muted-foreground">Pilih batang bulan lain pada grafik untuk membandingkan.</p></div>
        <div className="grid grid-cols-3 gap-4 text-right text-xs sm:gap-6">
          <div><p className="text-muted-foreground">Masuk</p><p className="mt-0.5 font-semibold text-sky-800">{amount(selectedRow.penerimaan_invoice)}</p></div>
          <div><p className="text-muted-foreground">Keluar</p><p className="mt-0.5 font-semibold text-amber-800">{amount(selectedRow.pengeluaran_ledger)}</p></div>
          <div><p className="text-muted-foreground">Bersih</p><p className={`mt-0.5 font-semibold ${Number(selectedRow.arus_bersih) < 0 ? "text-rose-700" : "text-emerald-800"}`}>{amount(selectedRow.arus_bersih)}</p></div>
        </div>
      </div>}
    </ChartSection>
  );
}

function OverviewExplorer({ units, projects, receivables, unitHref, projectHref, receivableColumns }: {
  units: Row[];
  projects: Row[];
  receivables: Row[];
  unitHref: string;
  projectHref: string;
  receivableColumns: { key: string; header: string; render: (row: Row) => ReactNode }[];
}) {
  const [view, setView] = useState<"unit" | "project" | "receivable">("unit");
  const [unitQuery, setUnitQuery] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const unitRows = useMemo(() => [...units].sort((a, b) => Number(b.pagu_ro_disetujui_saat_ini) - Number(a.pagu_ro_disetujui_saat_ini)), [units]);
  const projectRows = useMemo(() => [...projects].sort((a, b) => Number(b.nilai_kontrak) - Number(a.nilai_kontrak)), [projects]);
  const visibleUnits = unitRows.filter((row) => `${row.nama_unit} ${row.kode_unit}`.toLocaleLowerCase("id-ID").includes(unitQuery.trim().toLocaleLowerCase("id-ID")));
  const visibleProjects = projectRows.filter((row) => `${row.nama_proyek} ${row.kode_proyek} ${row.nama_client ?? ""}`.toLocaleLowerCase("id-ID").includes(projectQuery.trim().toLocaleLowerCase("id-ID")));
  const activeUnit = unitRows.find((row) => row.id === selectedUnitId) ?? unitRows[0];
  const activeProject = projectRows.find((row) => row.id === selectedProjectId) ?? projectRows[0];
  const tabs = [
    { id: "unit" as const, label: "Per unit", count: units.length },
    { id: "project" as const, label: "Per proyek", count: projects.length },
    { id: "receivable" as const, label: "Piutang", count: receivables.length },
  ];

  return <Card className="border-slate-200 shadow-none">
    <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <div><CardTitle className="text-base">Telusuri ringkasan</CardTitle><CardDescription>Pilih unit atau proyek untuk membuka rincian posisi keuangannya.</CardDescription></div>
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Jenis rincian ringkasan">
        {tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={view === tab.id} onClick={() => setView(tab.id)} className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${view === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
          {tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${view === tab.id ? "bg-slate-100 text-slate-700" : "bg-white/70 text-slate-500"}`}>{tab.count}</span>
        </button>)}
      </div>
    </CardHeader>
    <CardContent>
      {view === "unit" && <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={unitQuery} onChange={(event) => setUnitQuery(event.target.value)} placeholder="Cari unit..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {visibleUnits.map((row) => <button key={row.id} type="button" onClick={() => setSelectedUnitId(row.id)} className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${activeUnit?.id === row.id ? "border-slate-300 bg-slate-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50/70"}`}>
              <span className="flex items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-900">{row.nama_unit}</span><span className="mt-0.5 block text-xs text-muted-foreground">{row.jumlah_proyek ?? 0} proyek · {row.jumlah_ro ?? 0} RO</span></span><span className="shrink-0 text-right text-xs font-medium text-slate-700">Sisa {amount(row.sisa_hak_belanja_saat_ini)}</span></span>
            </button>)}
            {!visibleUnits.length && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Unit tidak ditemukan.</p>}
          </div>
        </div>
        {activeUnit ? <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kinerja unit</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{activeUnit.nama_unit}</h3><p className="text-xs text-muted-foreground">{activeUnit.kode_unit} · {activeUnit.jumlah_proyek ?? 0} proyek · {activeUnit.jumlah_ro ?? 0} RO</p></div><Link href={unitHref} className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">Buka analisis unit →</Link></div>
          <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailValue label="Pagu RO disetujui" value={amount(activeUnit.pagu_ro_disetujui_saat_ini)} />
            <DetailValue label="Realisasi RO" value={amount(activeUnit.realisasi_ro_saat_ini)} />
            <DetailValue label="Komitmen aktif" value={amount(activeUnit.komitmen_ro_saat_ini)} />
            <DetailValue label="Sisa hak belanja" value={amount(activeUnit.sisa_hak_belanja_saat_ini)} emphasis />
            <DetailValue label="Penerimaan retail TA ini" value={amount(activeUnit.penerimaan_retail_tahun_ini)} />
            <DetailValue label="Piutang retail berjalan" value={amount(activeUnit.piutang_retail_saat_ini)} />
            <DetailValue label="Pengeluaran OPS TA ini" value={amount(activeUnit.pengeluaran_operasional_tahun_ini)} />
            <DetailValue label="Belanja retail tercatat" value={amount(activeUnit.belanja_retail_tahun_ini)} />
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-muted-foreground">Penerimaan retail ditampilkan berdasarkan unit pelaksana. Pendapatan proyek belum dialokasikan ke unit pemilik atau kolaborator.</p>
        </div> : <EmptyOverview label="Belum ada unit untuk ditampilkan." />}
      </div>}
      {view === "project" && <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Cari proyek atau klien..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {visibleProjects.map((row) => <button key={row.id} type="button" onClick={() => setSelectedProjectId(row.id)} className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${activeProject?.id === row.id ? "border-slate-300 bg-slate-50" : "border-transparent hover:border-slate-200 hover:bg-slate-50/70"}`}>
              <span className="block truncate text-sm font-medium text-slate-900">{row.nama_proyek}</span><span className="mt-0.5 flex justify-between gap-2 text-xs text-muted-foreground"><span className="truncate">{row.kode_proyek} · {row.nama_client || "Tanpa klien"}</span><span className="shrink-0">{amount(row.nilai_kontrak)}</span></span>
            </button>)}
            {!visibleProjects.length && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Proyek tidak ditemukan.</p>}
          </div>
        </div>
        {activeProject ? <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Posisi proyek · {shortStatus(activeProject.status)}</p><h3 className="mt-1 text-lg font-semibold text-slate-950">{activeProject.nama_proyek}</h3><p className="text-xs text-muted-foreground">{activeProject.kode_proyek} · {activeProject.nama_client || "Tanpa klien"} · {activeProject.jumlah_ro ?? 0} RO</p></div><Link href={projectHref} className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline">Buka analisis proyek →</Link></div>
          <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailValue label="Nilai kontrak" value={amount(activeProject.nilai_kontrak)} />
            <DetailValue label="Direct cost rencana" value={amount(activeProject.direct_cost_rencana)} />
            <DetailValue label="Margin rencana" value={amount(activeProject.margin_rencana)} />
            <DetailValue label="Pagu RO disetujui" value={amount(activeProject.pagu_ro_disetujui_saat_ini)} />
            <DetailValue label="Realisasi RO" value={amount(activeProject.realisasi_ro_saat_ini)} />
            <DetailValue label="Komitmen RO aktif" value={amount(activeProject.komitmen_ro_saat_ini)} />
            <DetailValue label="Penerimaan invoice TA ini" value={amount(activeProject.penerimaan_invoice_tahun_ini)} />
            <DetailValue label="Piutang berjalan" value={amount(activeProject.piutang_saat_ini)} />
            <DetailValue label="Pengeluaran ledger TA ini" value={amount(activeProject.pengeluaran_ledger_tahun_ini)} />
            <DetailValue label="Kas bersih tercatat TA ini" value={amount(activeProject.kas_bersih_tercatat_tahun_ini)} emphasis />
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-muted-foreground">Margin adalah selisih rencana kontrak dan direct cost; kas bersih hanya memakai transaksi yang tercatat pada ledger.</p>
        </div> : <EmptyOverview label="Belum ada proyek disetujui untuk ditampilkan." />}
      </div>}
      {view === "receivable" && <DataTable columns={receivableColumns} rows={receivables} rowKey={(row) => row.nomor_invoice} searchPlaceholder="Cari invoice, proyek, job, atau klien..." emptyMessage="Tidak ada piutang berjalan." />}
    </CardContent>
  </Card>;
}

function DetailValue({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className="border-b border-slate-100 pb-2"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-sm ${emphasis ? "font-semibold text-emerald-800" : "font-medium text-slate-900"}`}>{value}</p></div>;
}

function EmptyOverview({ label }: { label: string }) {
  return <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-muted-foreground">{label}</div>;
}

function UnitActivityExplorer({ units, tahun }: { units: Row[]; tahun: number }) {
  const [unitId, setUnitId] = useState("");
  const [activityView, setActivityView] = useState<"ro" | "retail" | "operasional">("ro");
  const [selectedRoId, setSelectedRoId] = useState<string | null>(null);
  const [selectedRetailId, setSelectedRetailId] = useState<string | null>(null);
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? units[0];
  const roRows: Row[] = selectedUnit?.ro_aktivitas ?? [];
  const retailRows: Row[] = selectedUnit?.retail_aktivitas ?? [];
  const operationalRows: Row[] = selectedUnit?.dana_operasional_aktivitas ?? [];
  const selectedRo = roRows.find((row) => row.id === selectedRoId) ?? roRows[0];
  const selectedRetail = retailRows.find((row) => row.id === selectedRetailId) ?? retailRows[0];

  const roColumns = useMemo(() => [
    { key: "search_text", header: "RO / PROYEK", render: (row: Row) => <div><p className="font-medium text-slate-900">{row.kode_ro} · {row.nama_ro}</p><p className="text-xs text-muted-foreground">{row.proyek?.kode_proyek} · {row.proyek?.nama_proyek}{row.nomor_job ? ` · Job ${row.nomor_job}` : ""}</p></div> },
    { key: "pagu_disetujui", header: "PAGU", render: (row: Row) => amount(row.pagu_disetujui) },
    { key: "realisasi", header: "REALISASI", render: (row: Row) => amount(row.realisasi) },
    { key: "komitmen_aktif", header: "KOMITMEN", render: (row: Row) => amount(row.komitmen_aktif) },
    { key: "sisa_hak_belanja", header: "SISA HAK", render: (row: Row) => <span className="font-semibold">{amount(row.sisa_hak_belanja)}</span> },
    { key: "pengeluaran_tahun_ini", header: `LEDGER TA ${tahun}`, render: (row: Row) => amount(row.pengeluaran_tahun_ini) },
    { key: "aksi", header: "AKTIVITAS", filterable: false, render: (row: Row) => <button type="button" onClick={() => setSelectedRoId(row.id)} aria-pressed={selectedRo?.id === row.id} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${selectedRo?.id === row.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Ledger ({row.transaksi?.length ?? 0})</button> },
  ], [selectedRo?.id, tahun]);
  const ledgerColumns = useMemo(() => [
    { key: "tanggal", header: "TANGGAL", render: (row: Row) => formatDate(row.tanggal) },
    { key: "nama_kegiatan", header: "KEGIATAN", render: (row: Row) => <div><p className="font-medium">{row.nama_kegiatan}</p><p className="text-xs text-muted-foreground">{shortStatus(row.jenis_transaksi)}{row.keterangan ? ` · ${row.keterangan}` : ""}</p></div> },
    { key: "no_kuitansi", header: "KUITANSI", render: (row: Row) => row.no_kuitansi || "—" },
    { key: "debit", header: "DEBIT", render: (row: Row) => amount(row.debit) },
    { key: "kredit", header: "KREDIT", render: (row: Row) => amount(row.kredit) },
  ], []);
  const retailColumns = useMemo(() => [
    { key: "search_text", header: "JOB / KLIEN", render: (row: Row) => <div><p className="font-medium text-slate-900">{row.nomor_job}</p><p className="text-xs text-muted-foreground">{row.nama_pelanggan}</p></div> },
    { key: "status", header: "PROGRES", render: (row: Row) => shortStatus(row.status) },
    { key: "tanggal_perconto_diterima", header: "SAMPEL DITERIMA", render: (row: Row) => row.tanggal_perconto_diterima ? formatDate(row.tanggal_perconto_diterima) : "—" },
    { key: "nomor_lhu", header: "NOMOR LHU", render: (row: Row) => row.nomor_lhu || "Belum dicatat" },
    { key: "nilai_layanan", header: "NILAI LAYANAN", render: (row: Row) => amount(row.nilai_layanan) },
    { key: "invoice", header: "TAGIHAN / DITERIMA", render: (row: Row) => row.invoice ? <div>{amount(row.invoice.nominal)}<p className="text-xs text-muted-foreground">Diterima TA ini {amount(row.invoice.penerimaan_tahun_ini)} · Total dibayar {amount(row.invoice.nominal_dibayar)}</p></div> : "Belum ada invoice" },
    { key: "transaksi", header: "BELANJA RETAIL", render: (row: Row) => amount((row.transaksi ?? []).reduce((sum: number, item: Row) => sum + Number(item.kredit || 0), 0)) },
    { key: "aksi", header: "AKTIVITAS", filterable: false, render: (row: Row) => <button type="button" onClick={() => setSelectedRetailId(row.id)} aria-pressed={selectedRetail?.id === row.id} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${selectedRetail?.id === row.id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Rincian</button> },
  ], [selectedRetail?.id]);
  const operationalColumns = useMemo(() => [
    { key: "tanggal", header: "TANGGAL", render: (row: Row) => formatDate(row.tanggal) },
    { key: "kategori_kamar", header: "KAMAR", render: (row: Row) => shortStatus(row.kategori_kamar) },
    { key: "nama_kegiatan", header: "KEGIATAN", render: (row: Row) => <div><p className="font-medium">{row.nama_kegiatan}</p><p className="text-xs text-muted-foreground">{row.keterangan || shortStatus(row.jenis_transaksi)}</p></div> },
    { key: "no_kuitansi", header: "KUITANSI", render: (row: Row) => row.no_kuitansi || "—" },
    { key: "debit", header: "DEBIT", render: (row: Row) => amount(row.debit) },
    { key: "kredit", header: "KREDIT", render: (row: Row) => amount(row.kredit) },
  ], []);
  const paymentColumns = useMemo(() => [
    { key: "divalidasi_pada", header: "TANGGAL VALIDASI", render: (row: Row) => formatDate(row.divalidasi_pada) },
    { key: "nominal", header: "NOMINAL DITERIMA", render: (row: Row) => <span className="font-medium">{amount(row.nominal)}</span> },
  ], []);

  const activityTabs = [
    { id: "ro" as const, label: "RO & proyek", count: roRows.length },
    { id: "retail" as const, label: "Layanan retail", count: retailRows.length },
    { id: "operasional" as const, label: "Dana operasional", count: operationalRows.length },
  ];

  return <Card className="border-slate-200 shadow-none">
    <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div><CardTitle className="text-base">Aktivitas detail unit</CardTitle><CardDescription>Telusuri alokasi, transaksi ledger, tagihan retail, dan mutasi dana operasional pada TA {tahun}.</CardDescription></div>
      <div className="w-full sm:w-[22rem]">
        <label htmlFor="monev-unit-select" className="mb-1 block text-xs text-muted-foreground">Pilih unit koordinator</label>
        <Select value={selectedUnit?.id ?? ""} onValueChange={(value) => { setUnitId(value); setSelectedRoId(null); setSelectedRetailId(null); }}>
          <SelectTrigger id="monev-unit-select" aria-label="Pilih unit koordinator"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
          <SelectContent>{units.map((unit) => <SelectItem key={unit.id} value={unit.id}>{unit.nama_unit}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {!selectedUnit ? <EmptyOverview label="Belum ada unit koordinator untuk ditampilkan." /> : <>
        <div className="rounded-lg bg-slate-50 p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h3 className="font-semibold text-slate-950">{selectedUnit.nama_unit}</h3><p className="text-xs text-muted-foreground">{selectedUnit.kode_unit} · {selectedUnit.jumlah_proyek ?? 0} proyek · {selectedUnit.jumlah_ro ?? 0} RO</p></div><p className="text-xs text-muted-foreground">Posisi anggaran saat ini · transaksi pada TA {tahun}</p></div>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailValue label="Pagu RO disetujui" value={amount(selectedUnit.pagu_ro_disetujui_saat_ini)} />
            <DetailValue label="Realisasi RO" value={amount(selectedUnit.realisasi_ro_saat_ini)} />
            <DetailValue label="Komitmen aktif" value={amount(selectedUnit.komitmen_ro_saat_ini)} />
            <DetailValue label="Sisa hak belanja" value={amount(selectedUnit.sisa_hak_belanja_saat_ini)} emphasis />
          </div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Kategori aktivitas unit">
          {activityTabs.map((tab) => <button key={tab.id} type="button" aria-pressed={activityView === tab.id} onClick={() => setActivityView(tab.id)} className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${activityView === tab.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
            {tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activityView === tab.id ? "bg-slate-100 text-slate-700" : "bg-white/70 text-slate-500"}`}>{tab.count}</span>
          </button>)}
        </div>
        {activityView === "ro" && <div className="space-y-4">
          <TableSection title="RO dan alokasi anggaran" description="Pilih tombol Ledger pada RO untuk melihat transaksi yang tercatat selama tahun fiskal ini.">
            <DataTable columns={roColumns} rows={roRows} rowKey={(row) => row.id} searchPlaceholder="Cari RO, proyek, atau nomor job..." emptyMessage="Belum ada RO reguler untuk unit ini pada tahun terpilih." />
          </TableSection>
          {selectedRo && <TableSection title={`Ledger · ${selectedRo.kode_ro} · ${selectedRo.nama_ro}`} description={`${selectedRo.proyek?.kode_proyek ?? "Tanpa proyek"} · ${selectedRo.proyek?.nama_proyek ?? ""}${selectedRo.nomor_job ? ` · Job ${selectedRo.nomor_job}` : ""}`}>
            <div className="mb-3 grid gap-3 sm:grid-cols-4"><DetailValue label="Pagu disetujui" value={amount(selectedRo.pagu_disetujui)} /><DetailValue label="Realisasi" value={amount(selectedRo.realisasi)} /><DetailValue label="Komitmen aktif" value={amount(selectedRo.komitmen_aktif)} /><DetailValue label="Sisa hak belanja" value={amount(selectedRo.sisa_hak_belanja)} emphasis /></div>
            <DataTable columns={ledgerColumns} rows={selectedRo.transaksi ?? []} rowKey={(row) => row.id} searchPlaceholder="Cari kegiatan atau kuitansi..." emptyMessage="Belum ada transaksi ledger pada RO ini di tahun terpilih." />
          </TableSection>}
        </div>}
        {activityView === "retail" && <div className="space-y-4">
          <TableSection title="Order layanan retail unit" description="Ringkasan progres pengujian, tagihan, penerimaan, dan belanja retail per order.">
            <DataTable columns={retailColumns} rows={retailRows} rowKey={(row) => row.id} searchPlaceholder="Cari nomor job, klien, atau LHU..." emptyMessage="Belum ada order retail untuk unit ini pada tahun terpilih." />
          </TableSection>
          {selectedRetail && <TableSection title={`Aktivitas retail · ${selectedRetail.nomor_job}`} description={`${selectedRetail.nama_pelanggan} · ${shortStatus(selectedRetail.status)} · diterima ${selectedRetail.tanggal_perconto_diterima ? formatDate(selectedRetail.tanggal_perconto_diterima) : "tanggal belum dicatat"}`}>
            <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><DetailValue label="Nilai layanan" value={amount(selectedRetail.nilai_layanan)} /><DetailValue label="Invoice" value={selectedRetail.invoice ? `${selectedRetail.invoice.nomor_invoice} · ${shortStatus(selectedRetail.invoice.status)}` : "Belum diterbitkan"} /><DetailValue label="Sudah dibayar" value={amount(selectedRetail.invoice?.nominal_dibayar)} /><DetailValue label="Piutang order" value={amount(selectedRetail.invoice ? Math.max(0, Number(selectedRetail.invoice.nominal) - Number(selectedRetail.invoice.nominal_dibayar)) : 0)} emphasis /></div>
            <div className="grid gap-4 xl:grid-cols-2">
              <TableSection title={`Penerimaan tervalidasi · TA ${tahun}`}><DataTable columns={paymentColumns} rows={selectedRetail.invoice?.pembayaran ?? []} rowKey={(row) => row.id} hideSearch emptyMessage="Belum ada penerimaan tervalidasi pada tahun ini." /></TableSection>
              <TableSection title={`Belanja retail · TA ${tahun}`}><DataTable columns={ledgerColumns} rows={selectedRetail.transaksi ?? []} rowKey={(row) => row.id} hideSearch emptyMessage="Belum ada transaksi belanja retail tercatat tahun ini." /></TableSection>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">LHU {selectedRetail.nomor_lhu || "belum dicatat"}{selectedRetail.tanggal_lhu ? ` · ${formatDate(selectedRetail.tanggal_lhu)}` : ""} · Tanda terima perconto {selectedRetail.nomor_tanda_terima_perconto || "belum dicatat"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Belanja retail tampil di sini sebagai transaksi per order dan juga ada di tab Dana operasional sebagai mutasi wallet; jangan dijumlahkan ganda.</p>
          </TableSection>}
        </div>}
        {activityView === "operasional" && <div className="space-y-4">
          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailValue label="Total plafon dana" value={amount(selectedUnit.plafon_dana_operasional)} />
            <DetailValue label={`Dana masuk · TA ${tahun}`} value={amount(selectedUnit.penerimaan_operasional_tahun_ini)} />
            <DetailValue label={`Dana keluar · TA ${tahun}`} value={amount(selectedUnit.pengeluaran_operasional_tahun_ini)} />
            <DetailValue label={`Arus bersih mutasi · TA ${tahun}`} value={amount(Number(selectedUnit.penerimaan_operasional_tahun_ini || 0) - Number(selectedUnit.pengeluaran_operasional_tahun_ini || 0))} emphasis />
          </div>
          <TableSection title={`Mutasi dana operasional · TA ${tahun}`} description="Mutasi dikelompokkan menurut kamar dana dan mengikuti unit pemilik wallet.">
            <DataTable columns={operationalColumns} rows={operationalRows} rowKey={(row) => row.id} searchPlaceholder="Cari kamar, transaksi, atau kuitansi..." emptyMessage="Belum ada mutasi dana operasional unit ini pada tahun terpilih." />
          </TableSection>
        </div>}
        <p className="text-xs leading-5 text-muted-foreground">Nilai pagu, realisasi, komitmen, dan sisa hak menunjukkan posisi RO saat ini. Penerimaan proyek tidak dialokasikan ke unit karena aturan atribusinya belum ditetapkan.</p>
      </>}
    </CardContent>
  </Card>;
}

function ReceivableChart({ projectAmount, retailAmount }: { projectAmount: number; retailAmount: number }) {
  const rows = [
    { jenis: "Proyek", piutang: projectAmount },
    { jenis: "Retail", piutang: retailAmount },
  ];
  return (
    <ChartSection title="Komposisi piutang" description="Sisa invoice yang belum lunas saat ini.">
      <ChartContainer config={receivableChartConfig} className="h-[280px]">
        <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 56, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactAmount(Number(value))} />
          <YAxis type="category" dataKey="jenis" tickLine={false} axisLine={false} width={56} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <Bar dataKey="piutang" fill="var(--color-piutang)" radius={[0, 5, 5, 0]} maxBarSize={34}>
            <LabelList dataKey="piutang" position="right" formatter={compactChartValue} fill="#92400e" fontSize={10} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartSection>
  );
}

function UnitBudgetChart({ rows }: { rows: Row[] }) {
  const chartRows = [...rows]
    .sort((a, b) => Number(b.pagu_ro_disetujui_saat_ini) - Number(a.pagu_ro_disetujui_saat_ini))
    .slice(0, 8);
  return (
    <ChartSection title="Pagu dan realisasi RO per unit" description="Delapan unit dengan pagu RO terbesar pada tahun fiskal terpilih.">
      <ChartContainer config={unitChartConfig} className="h-[320px]">
        <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 58, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactAmount(Number(value))} />
          <YAxis type="category" dataKey="nama_unit" tickLine={false} axisLine={false} width={170} tick={{ fontSize: 11 }} tickFormatter={(value) => compactLabel(value, 24)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="pagu_ro_disetujui_saat_ini" fill="var(--color-pagu_ro_disetujui_saat_ini)" radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="pagu_ro_disetujui_saat_ini" position="right" formatter={compactChartValue} fill="#475569" fontSize={9} />
          </Bar>
          <Bar dataKey="realisasi_ro_saat_ini" fill="var(--color-realisasi_ro_saat_ini)" radius={[0, 4, 4, 0]} maxBarSize={18}>
            <LabelList dataKey="realisasi_ro_saat_ini" position="right" formatter={compactChartValue} fill="#0369a1" fontSize={9} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartSection>
  );
}

function ProjectPlanChart({ rows }: { rows: Row[] }) {
  const chartRows = [...rows]
    .sort((a, b) => Number(b.nilai_kontrak) - Number(a.nilai_kontrak))
    .slice(0, 6);
  return (
    <ChartSection title="Rencana nilai proyek" description="Enam proyek dengan nilai kontrak terbesar. Direct cost dan margin adalah rencana, bukan realisasi laba.">
      <ChartContainer config={projectChartConfig} className="h-[330px]">
        <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 58, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactAmount(Number(value))} />
          <YAxis type="category" dataKey="nama_proyek" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 11 }} tickFormatter={(value) => compactLabel(value, 21)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="nilai_kontrak" fill="var(--color-nilai_kontrak)" radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList dataKey="nilai_kontrak" position="right" formatter={compactChartValue} fill="#0369a1" fontSize={9} />
          </Bar>
          <Bar dataKey="direct_cost_rencana" fill="var(--color-direct_cost_rencana)" radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList dataKey="direct_cost_rencana" position="right" formatter={compactChartValue} fill="#475569" fontSize={9} />
          </Bar>
          <Bar dataKey="margin_rencana" fill="var(--color-margin_rencana)" radius={[0, 4, 4, 0]} maxBarSize={16}>
            <LabelList dataKey="margin_rencana" position="right" formatter={compactChartValue} fill="#b45309" fontSize={9} />
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartSection>
  );
}

export default function MonevClientPage() {
  const pathname = usePathname() ?? "/dashboard/karwas";
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState("");
  const report = use_query<any, Error, { tahun: number }>({
    tag: "dashboard-monev",
    method: "dashboardGetMonevControllerGetMonev",
    params: { tahun },
    queryFn: async ({ tahun: selectedYear }) => {
      setBrowserToken();
      return unwrap(await apiData(browserApi.dashboard.dashboardGetMonevControllerGetMonev({ tahun: selectedYear }, { format: "json" })));
    },
  });
  const data = (report.data ?? {}) as MonevPayload;
  const totals = data.ringkasan ?? {};
  const monthlyRows = data.arus_kas_bulanan ?? [];
  const firstActiveMonth = monthlyRows.find((row) => Number(row.penerimaan_invoice) || Number(row.pengeluaran_ledger))?.bulan;
  const matchingMonth = monthlyRows.find((row) => String(row.bulan) === selectedMonth)?.bulan;
  const activeMonth = matchingMonth != null ? String(matchingMonth) : firstActiveMonth != null ? String(firstActiveMonth) : monthlyRows[0]?.bulan != null ? String(monthlyRows[0].bulan) : undefined;
  const activePath = sections.find((section) => section.href === pathname)?.href ?? sections.find((section) => section.href !== "/dashboard/karwas" && pathname.startsWith(`${section.href}/`))?.href ?? "/dashboard/karwas";
  const isUnit = activePath === "/dashboard/karwas/unit";
  const isProject = activePath === "/dashboard/karwas/proyek";
  const isCash = activePath === "/dashboard/karwas/arus-kas";
  const title = isUnit ? "Kinerja Unit" : isProject ? "Analisis Proyek" : isCash ? "Arus Kas & Piutang" : "Ringkasan Monev";
  const subtitle = isUnit
    ? "Pantau realisasi dan hak belanja RO per unit, serta layanan retail yang tercatat."
    : isProject
      ? "Bandingkan rencana kontrak dan margin dengan penerimaan, realisasi, serta piutang proyek."
      : isCash
        ? "Tinjau penerimaan invoice, pengeluaran ledger, arus bersih, dan tagihan yang belum lunas."
        : "Pantau kesehatan keuangan proyek dan kas berdasarkan data yang tercatat di aplikasi.";

  const flowColumns = useMemo(() => [
    { key: "label", header: "BULAN", render: (row: Row) => <span className="font-medium">{row.label}</span> },
    { key: "penerimaan_invoice", header: "PENERIMAAN INVOICE", render: (row: Row) => amount(row.penerimaan_invoice) },
    { key: "pengeluaran_ledger", header: "PENGELUARAN LEDGER", render: (row: Row) => amount(row.pengeluaran_ledger) },
    { key: "arus_bersih", header: "ARUS BERSIH", render: (row: Row) => <span className={`font-semibold ${Number(row.arus_bersih) < 0 ? "text-rose-700" : "text-slate-900"}`}>{amount(row.arus_bersih)}</span> },
  ], []);

  const unitColumns = useMemo(() => [
    { key: "nama_unit", header: "UNIT KOORDINATOR", render: (row: Row) => <div><p className="font-medium text-slate-900">{row.nama_unit}</p><p className="text-xs text-muted-foreground">{row.kode_unit}</p></div> },
    { key: "jumlah_proyek", header: "PROYEK / RO", render: (row: Row) => `${row.jumlah_proyek} proyek · ${row.jumlah_ro} RO` },
    { key: "pagu_ro_disetujui_saat_ini", header: "PAGU RO", render: (row: Row) => amount(row.pagu_ro_disetujui_saat_ini) },
    { key: "realisasi_ro_saat_ini", header: "REALISASI RO", render: (row: Row) => amount(row.realisasi_ro_saat_ini) },
    { key: "komitmen_ro_saat_ini", header: "KOMITMEN", render: (row: Row) => amount(row.komitmen_ro_saat_ini) },
    { key: "sisa_hak_belanja_saat_ini", header: "SISA HAK BELANJA", render: (row: Row) => <span className="font-semibold">{amount(row.sisa_hak_belanja_saat_ini)}</span> },
    { key: "tagihan_retail_tahun_fiskal", header: "TAGIHAN RETAIL", render: (row: Row) => <div>{amount(row.tagihan_retail_tahun_fiskal)}<p className="text-xs text-muted-foreground">Terima {amount(row.penerimaan_retail_tahun_ini)} · Piutang {amount(row.piutang_retail_saat_ini)}</p></div> },
    { key: "belanja_retail_tahun_ini", header: "BELANJA RETAIL · BAGIAN OPS", render: (row: Row) => amount(row.belanja_retail_tahun_ini) },
    { key: "pengeluaran_operasional_tahun_ini", header: "BELANJA OPS TOTAL", render: (row: Row) => amount(row.pengeluaran_operasional_tahun_ini) },
  ], []);

  const projectColumns = useMemo(() => [
    { key: "nama_proyek", header: "PROYEK", render: (row: Row) => <div className="min-w-44"><p className="font-medium text-slate-900">{row.nama_proyek}</p><p className="text-xs text-muted-foreground">{row.kode_proyek} · {shortStatus(row.status)}</p></div> },
    { key: "nilai_kontrak", header: "NILAI KONTRAK", render: (row: Row) => amount(row.nilai_kontrak) },
    { key: "margin_rencana", header: "MARGIN RENCANA", render: (row: Row) => <div>{amount(row.margin_rencana)}<p className="text-xs text-muted-foreground">Kontrak − direct cost</p></div> },
    { key: "pagu_ro_disetujui_saat_ini", header: "PAGU RO", render: (row: Row) => amount(row.pagu_ro_disetujui_saat_ini) },
    { key: "realisasi_ro_saat_ini", header: "REALISASI / KOMITMEN", render: (row: Row) => <div>{amount(row.realisasi_ro_saat_ini)}<p className="text-xs text-muted-foreground">Komitmen {amount(row.komitmen_ro_saat_ini)}</p></div> },
    { key: "sisa_hak_belanja_saat_ini", header: "SISA HAK RO", render: (row: Row) => amount(row.sisa_hak_belanja_saat_ini) },
    { key: "penerimaan_invoice_tahun_ini", header: "PENERIMAAN TAHUN INI", render: (row: Row) => amount(row.penerimaan_invoice_tahun_ini) },
    { key: "piutang_saat_ini", header: "PIUTANG", render: (row: Row) => amount(row.piutang_saat_ini) },
    { key: "kas_bersih_tercatat_tahun_ini", header: "KAS BERSIH TERCATAT", render: (row: Row) => <div className="font-semibold">{amount(row.kas_bersih_tercatat_tahun_ini)}<p className="text-xs font-normal text-muted-foreground">Penerimaan − pengeluaran ledger</p></div> },
  ], []);

  const receivableColumns = useMemo(() => [
    { key: "nomor_invoice", header: "INVOICE", render: (row: Row) => <span className="font-medium">{row.nomor_invoice}</span> },
    { key: "jenis", header: "JENIS", render: (row: Row) => row.jenis === "RETAIL" ? "Retail" : "Proyek" },
    { key: "referensi", header: "REFERENSI", render: (row: Row) => row.referensi },
    { key: "status", header: "STATUS", render: (row: Row) => shortStatus(row.status) },
    { key: "tanggal_jatuh_tempo", header: "JATUH TEMPO", render: (row: Row) => row.tanggal_jatuh_tempo ? formatDate(row.tanggal_jatuh_tempo) : "—" },
    { key: "nilai_tagihan", header: "NILAI TAGIHAN", render: (row: Row) => amount(row.nilai_tagihan) },
    { key: "sudah_dibayar", header: "SUDAH DIBAYAR", render: (row: Row) => amount(row.sudah_dibayar) },
    { key: "sisa_piutang", header: "SISA PIUTANG", render: (row: Row) => <span className="font-semibold text-amber-800">{amount(row.sisa_piutang)}</span> },
  ], []);

  const hasData = Array.isArray(data.proyek) || Array.isArray(data.unit);
  return (
    <div className="space-y-5">
      <Card className="border-slate-200 bg-gradient-to-r from-white to-amber-50/70 shadow-none">
        <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Monitoring & Evaluasi · KARWAS</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <label className="w-full shrink-0 text-sm sm:w-36">
            <span className="mb-1 block text-xs text-muted-foreground">Tahun fiskal</span>
            <Select value={String(tahun)} onValueChange={(value) => value && setTahun(Number(value))}>
              <SelectTrigger aria-label="Pilih tahun fiskal"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index).map((year) => <SelectItem key={year} value={String(year)}>TA {year}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        </CardContent>
      </Card>

      <nav className="grid w-full grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 sm:grid-cols-4" aria-label="Halaman Monev">
        {sections.map(({ href, label, icon: Icon }) => {
          const selected = href === activePath;
          return <Link key={href} href={href} aria-current={selected ? "page" : undefined} className={`inline-flex min-h-10 min-w-0 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-medium leading-4 transition-colors sm:whitespace-nowrap ${selected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon className="shrink-0" size={16} /><span>{label}</span></Link>;
        })}
      </nav>

      {report.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Memuat laporan Monev TA {tahun}…</CardContent></Card>}
      {report.error && <EmptyData label="Laporan Monev belum dapat dimuat." action={<Button type="button" variant="outline" size="sm" onClick={() => void report.refetch()}>Coba lagi</Button>} />}
      {!report.isLoading && !report.error && hasData && <>
        {isUnit && <Card className="border-sky-200 bg-sky-50/60 shadow-none"><CardContent className="p-4 text-sm leading-6 text-sky-950">Pendapatan proyek belum dibagi ke unit pemilik atau kolaborator. Karena itu halaman ini menampilkan pagu, realisasi, komitmen dan sisa hak RO; angka ini tidak dipakai untuk memberi label unit untung atau rugi.</CardContent></Card>}
        {isProject && <Card className="border-amber-200 bg-amber-50/60 shadow-none"><CardContent className="p-4 text-sm leading-6 text-amber-950">Margin rencana mengikuti nilai kontrak dan direct cost pada proyek. Margin ini bukan laba aktual. Kas bersih tercatat memakai penerimaan tervalidasi dikurangi pengeluaran ledger pada TA {tahun}.</CardContent></Card>}

        {!isUnit && !isProject && !isCash && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Nilai kontrak disetujui" value={amount(totals.nilai_kontrak)} hint={`${totals.jumlah_proyek ?? 0} proyek - ${totals.jumlah_ro ?? 0} RO pada TA ${tahun}`} icon={BriefcaseBusiness} href="/dashboard/karwas/proyek" />
            <Metric label="Margin rencana" value={amount(totals.margin_rencana)} hint={`Direct cost rencana ${amount(totals.direct_cost_rencana)} - bukan laba aktual`} icon={Activity} />
            <Metric label="Tagihan terbit tahun ini" value={amount(totals.tagihan_terbit_tahun_ini)} hint="Invoice proyek dan retail yang diterbitkan pada TA terpilih" icon={FileText} href="/dashboard/karwas/arus-kas" />
            <Metric label="Penerimaan invoice" value={amount(totals.penerimaan_invoice_tahun_ini)} hint={`Proyek ${amount(totals.penerimaan_proyek_tahun_ini)} - Retail ${amount(totals.penerimaan_retail_tahun_ini)}`} icon={ArrowDownRight} href="/dashboard/karwas/arus-kas" />
            <Metric label="Piutang berjalan" value={amount(totals.piutang_saat_ini)} hint={`Proyek ${amount(totals.piutang_proyek_saat_ini)} - Retail ${amount(totals.piutang_retail_saat_ini)}`} icon={ReceiptText} href="/dashboard/karwas/arus-kas" />
            <Metric label="Arus bersih tercatat" value={amount(totals.arus_bersih_tercatat_tahun_ini)} hint={`Penerimaan invoice dikurangi pengeluaran ledger - TA ${tahun}`} icon={Banknote} href="/dashboard/karwas/arus-kas" />
          </div>
          <Card className="border-slate-200 shadow-none">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
              <DetailValue label="Pagu RO disetujui saat ini" value={amount(totals.pagu_ro_disetujui_saat_ini)} />
              <DetailValue label="Realisasi RO saat ini" value={amount(totals.realisasi_ro_saat_ini)} />
              <DetailValue label="Komitmen RO aktif" value={amount(totals.komitmen_ro_saat_ini)} />
              <DetailValue label="Sisa hak belanja RO" value={amount(totals.sisa_hak_belanja_ro_saat_ini)} emphasis />
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
            <MonthlyCashChart rows={monthlyRows} selectedMonth={activeMonth} onSelectMonth={setSelectedMonth} />
            <ReceivableChart projectAmount={Number(totals.piutang_proyek_saat_ini) || 0} retailAmount={Number(totals.piutang_retail_saat_ini) || 0} />
          </div>
          <OverviewExplorer units={data.unit ?? []} projects={data.proyek ?? []} receivables={data.piutang ?? []} unitHref="/dashboard/karwas/unit" projectHref="/dashboard/karwas/proyek" receivableColumns={receivableColumns} />
        </>}

        {isUnit && <>
          <UnitBudgetChart rows={data.unit ?? []} />
          <TableSection title={`Kinerja anggaran per unit - ${tahun}`} description="Unit mengikuti unit pemilik RO; pendapatan proyek tidak dialokasikan antar unit.">
            <DataTable columns={unitColumns} rows={data.unit ?? []} rowKey={(row) => row.id} searchPlaceholder="Cari unit..." emptyMessage="Belum ada data unit." />
          </TableSection>
          <UnitActivityExplorer units={data.unit ?? []} tahun={tahun} />
        </>}

        {isProject && <>
          <ProjectPlanChart rows={data.proyek ?? []} />
          <TableSection title={`Portofolio proyek - TA ${tahun}`} description="Margin merupakan rencana; penerimaan dan pengeluaran menunjukkan transaksi yang tercatat.">
            <DataTable columns={projectColumns} rows={data.proyek ?? []} rowKey={(row) => row.id} searchPlaceholder="Cari proyek atau klien..." emptyMessage="Belum ada proyek disetujui pada tahun ini." />
          </TableSection>
        </>}

        {isCash && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Invoice terbit" value={amount(totals.tagihan_terbit_tahun_ini)} hint={`TA ${tahun}`} icon={FileText} />
            <Metric label="Penerimaan tervalidasi" value={amount(totals.penerimaan_invoice_tahun_ini)} hint={`Proyek ${amount(totals.penerimaan_proyek_tahun_ini)} - Retail ${amount(totals.penerimaan_retail_tahun_ini)}`} icon={ArrowDownRight} />
            <Metric label="Pengeluaran ledger" value={amount(totals.pengeluaran_ledger_tahun_ini)} hint="Transaksi kredit RO dan dana operasional" icon={ArrowUpRight} />
            <Metric label="Arus bersih tercatat" value={amount(totals.arus_bersih_tercatat_tahun_ini)} hint="Penerimaan dikurangi pengeluaran ledger" icon={Banknote} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
            <MonthlyCashChart rows={monthlyRows} selectedMonth={activeMonth} onSelectMonth={setSelectedMonth} />
            <ReceivableChart projectAmount={Number(totals.piutang_proyek_saat_ini) || 0} retailAmount={Number(totals.piutang_retail_saat_ini) || 0} />
          </div>
          <TableSection title={`Rincian arus kas bulanan - ${tahun}`} description="Transaksi berdasarkan tanggal validasi penerimaan dan tanggal ledger.">
            <DataTable columns={flowColumns} rows={data.arus_kas_bulanan ?? []} rowKey={(row) => row.bulan} hideSearch emptyMessage="Belum ada transaksi pada tahun ini." />
          </TableSection>
          <TableSection title="Invoice belum lunas" description="Sisa tagihan dihitung dari nilai invoice dikurangi pembayaran yang sudah divalidasi.">
            <DataTable columns={receivableColumns} rows={data.piutang ?? []} rowKey={(row) => row.nomor_invoice} searchPlaceholder="Cari invoice, proyek, atau klien..." emptyMessage="Tidak ada piutang berjalan." />
          </TableSection>
        </>}
      </>}
      {!report.isLoading && !report.error && !hasData && <Card><CardContent className="p-6 text-sm text-muted-foreground">Belum ada data Monev untuk TA {tahun}.</CardContent></Card>}
    </div>
  );
}
