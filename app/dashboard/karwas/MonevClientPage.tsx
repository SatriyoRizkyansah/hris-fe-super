"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Banknote, BriefcaseBusiness, Building2, CircleDollarSign, FileText, ReceiptText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/table/DataTable";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { formatDate, formatRupiah, humanizeStatus } from "@/lib/hris/format";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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

function Metric({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Activity }) {
  return (
    <Card className="h-full border-slate-200 shadow-none">
      <CardContent className="flex min-h-[108px] items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-slate-950">{value}</p>
          {hint && <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>}
        </div>
        <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon size={18} /></span>
      </CardContent>
    </Card>
  );
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

function MonthlyCashChart({ rows }: { rows: Row[] }) {
  return (
    <ChartSection title="Arus kas bulanan" description="Penerimaan invoice tervalidasi dibanding pengeluaran ledger.">
      <ChartContainer config={cashChartConfig} className="h-[280px]">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} width={54} tickFormatter={(value) => compactAmount(Number(value))} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="penerimaan_invoice" fill="var(--color-penerimaan_invoice)" radius={[4, 4, 0, 0]} maxBarSize={30} />
          <Bar dataKey="pengeluaran_ledger" fill="var(--color-pengeluaran_ledger)" radius={[4, 4, 0, 0]} maxBarSize={30} />
        </BarChart>
      </ChartContainer>
    </ChartSection>
  );
}

function ReceivableChart({ projectAmount, retailAmount }: { projectAmount: number; retailAmount: number }) {
  const rows = [
    { jenis: "Proyek", piutang: projectAmount },
    { jenis: "Retail", piutang: retailAmount },
  ];
  return (
    <ChartSection title="Komposisi piutang" description="Sisa invoice yang belum lunas saat ini.">
      <ChartContainer config={receivableChartConfig} className="h-[280px]">
        <BarChart data={rows} layout="vertical" margin={{ top: 10, right: 18, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactAmount(Number(value))} />
          <YAxis type="category" dataKey="jenis" tickLine={false} axisLine={false} width={56} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <Bar dataKey="piutang" fill="var(--color-piutang)" radius={[0, 5, 5, 0]} maxBarSize={34} />
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
        <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactAmount(Number(value))} />
          <YAxis type="category" dataKey="nama_unit" tickLine={false} axisLine={false} width={170} tick={{ fontSize: 11 }} tickFormatter={(value) => compactLabel(value, 24)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="pagu_ro_disetujui_saat_ini" fill="var(--color-pagu_ro_disetujui_saat_ini)" radius={[0, 4, 4, 0]} maxBarSize={18} />
          <Bar dataKey="realisasi_ro_saat_ini" fill="var(--color-realisasi_ro_saat_ini)" radius={[0, 4, 4, 0]} maxBarSize={18} />
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
        <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => compactAmount(Number(value))} />
          <YAxis type="category" dataKey="nama_proyek" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 11 }} tickFormatter={(value) => compactLabel(value, 21)} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={amount} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="nilai_kontrak" fill="var(--color-nilai_kontrak)" radius={[0, 4, 4, 0]} maxBarSize={16} />
          <Bar dataKey="direct_cost_rencana" fill="var(--color-direct_cost_rencana)" radius={[0, 4, 4, 0]} maxBarSize={16} />
          <Bar dataKey="margin_rencana" fill="var(--color-margin_rencana)" radius={[0, 4, 4, 0]} maxBarSize={16} />
        </BarChart>
      </ChartContainer>
    </ChartSection>
  );
}

export default function MonevClientPage() {
  const pathname = usePathname() ?? "/dashboard/karwas";
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const report = use_query<any, Error, { tahun: number }>({
    tag: "dashboard-monev",
    method: "dashboardControllerGetMonev",
    params: { tahun },
    queryFn: async ({ tahun: selectedYear }) => {
      setBrowserToken();
      return unwrap(await apiData(browserApi.dashboard.dashboardControllerGetMonev({ tahun: selectedYear }, { format: "json" })));
    },
  });
  const data = (report.data ?? {}) as MonevPayload;
  const totals = data.ringkasan ?? {};
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

      <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5" aria-label="Halaman Monev">
        {sections.map(({ href, label, icon: Icon }) => {
          const selected = href === activePath;
          return <Link key={href} href={href} aria-current={selected ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${selected ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Icon size={16} />{label}</Link>;
        })}
      </nav>

      {report.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Memuat laporan Monev TA {tahun}…</CardContent></Card>}
      {report.error && <Card className="border-rose-200"><CardContent className="p-5 text-sm text-rose-800">{report.error.message || "Data Monev gagal dimuat."}</CardContent></Card>}
      {!report.isLoading && !report.error && hasData && <>
        {isUnit && <Card className="border-sky-200 bg-sky-50/60 shadow-none"><CardContent className="p-4 text-sm leading-6 text-sky-950">Pendapatan proyek belum dibagi ke unit pemilik atau kolaborator. Karena itu halaman ini menampilkan pagu, realisasi, komitmen dan sisa hak RO; angka ini tidak dipakai untuk memberi label unit untung atau rugi.</CardContent></Card>}
        {isProject && <Card className="border-amber-200 bg-amber-50/60 shadow-none"><CardContent className="p-4 text-sm leading-6 text-amber-950">Margin rencana mengikuti nilai kontrak dan direct cost pada proyek. Margin ini bukan laba aktual. Kas bersih tercatat memakai penerimaan tervalidasi dikurangi pengeluaran ledger pada TA {tahun}.</CardContent></Card>}

        {!isUnit && !isProject && !isCash && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Metric label="Nilai kontrak disetujui" value={amount(totals.nilai_kontrak)} hint={`${totals.jumlah_proyek ?? 0} proyek - ${totals.jumlah_ro ?? 0} RO pada TA ${tahun}`} icon={BriefcaseBusiness} />
            <Metric label="Margin rencana" value={amount(totals.margin_rencana)} hint={`Direct cost rencana ${amount(totals.direct_cost_rencana)} - bukan laba aktual`} icon={Activity} />
            <Metric label="Tagihan terbit tahun ini" value={amount(totals.tagihan_terbit_tahun_ini)} hint="Invoice proyek dan retail yang diterbitkan pada TA terpilih" icon={FileText} />
            <Metric label="Penerimaan invoice" value={amount(totals.penerimaan_invoice_tahun_ini)} hint={`Proyek ${amount(totals.penerimaan_proyek_tahun_ini)} - Retail ${amount(totals.penerimaan_retail_tahun_ini)}`} icon={ArrowDownRight} />
            <Metric label="Piutang berjalan" value={amount(totals.piutang_saat_ini)} hint={`Proyek ${amount(totals.piutang_proyek_saat_ini)} - Retail ${amount(totals.piutang_retail_saat_ini)}`} icon={ReceiptText} />
            <Metric label="Arus bersih tercatat" value={amount(totals.arus_bersih_tercatat_tahun_ini)} hint={`Penerimaan invoice dikurangi pengeluaran ledger - TA ${tahun}`} icon={Banknote} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
            <MonthlyCashChart rows={data.arus_kas_bulanan ?? []} />
            <ReceivableChart projectAmount={Number(totals.piutang_proyek_saat_ini) || 0} retailAmount={Number(totals.piutang_retail_saat_ini) || 0} />
          </div>
        </>}

        {isUnit && <>
          <UnitBudgetChart rows={data.unit ?? []} />
          <TableSection title={`Kinerja anggaran per unit - ${tahun}`} description="Unit mengikuti unit pemilik RO; pendapatan proyek tidak dialokasikan antar unit.">
            <DataTable columns={unitColumns} rows={data.unit ?? []} rowKey={(row) => row.id} searchPlaceholder="Cari unit..." emptyMessage="Belum ada data unit." />
          </TableSection>
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
            <MonthlyCashChart rows={data.arus_kas_bulanan ?? []} />
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
