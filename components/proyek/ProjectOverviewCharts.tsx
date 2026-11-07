"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;

const roConfig: ChartConfig = {
  pagu: { label: "Pagu RO", color: "#94a3b8" },
  belanja: { label: "Belanja tercatat", color: "#0284c7" },
};

const termConfig: ChartConfig = {
  cair: { label: "Sudah cair", color: "#059669" },
  menunggu: { label: "Belum cair", color: "#cbd5e1" },
};

const compactRupiah = (value: unknown) => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
}).format(Number(value) || 0);

function roDataFrom(rows: Row[]) {
  const allRows = rows.map((row, index) => {
    const balance = row.balance && typeof row.balance === "object" ? row.balance as Row : {};
    return {
      name: String(row.nama_mak ?? row.mak?.nama_mak ?? row.nama_ro ?? row.kode_ro ?? `RO ${index + 1}`),
      pagu: Number(balance.pagu_disetujui) || Number(row.nilai_rencana) || Number(row.total_plafon) || 0,
      belanja: Number(balance.realisasi ?? row.total_terpakai) || 0,
    };
  }).sort((left, right) => right.pagu - left.pagu);

  if (allRows.length <= 8) return allRows;
  const visible = allRows.slice(0, 8);
  const rest = allRows.slice(8);
  visible.push({
    name: `RO lainnya (${rest.length})`,
    pagu: rest.reduce((total, row) => total + row.pagu, 0),
    belanja: rest.reduce((total, row) => total + row.belanja, 0),
  });
  return visible;
}

function termDataFrom(rows: Row[]) {
  return rows.map((row, index) => {
    const invoice = row.invoice && typeof row.invoice === "object" ? row.invoice as Row : {};
    const nilai = Number(row.nilai_termin ?? row.nilai ?? row.nominal) || 0;
    const isPaid = String(row.status) === "CAIR" || String(invoice.status) === "LUNAS";
    return {
      label: `Termin ${String(row.nomor_termin ?? index + 1).padStart(2, "0")}`,
      cair: isPaid ? nilai : 0,
      menunggu: isPaid ? 0 : nilai,
    };
  });
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="border-slate-200 shadow-none">
      <CardHeader className="gap-1 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-1">{children}</CardContent>
    </Card>
  );
}

function NoChartData({ children }: { children: string }) {
  return <div className="flex h-56 items-center justify-center rounded-lg bg-slate-50 px-4 text-center text-sm text-muted-foreground">{children}</div>;
}

export function ProjectOverviewCharts({ roRows, termRows }: { roRows: Row[]; termRows: Row[] }) {
  const roChartRows = roDataFrom(roRows);
  const termChartRows = termDataFrom(termRows);
  const roAxisMax = Math.max(1, ...roChartRows.map((row) => row.pagu)) * 1.28;
  const termAxisMax = Math.max(1, ...termChartRows.map((row) => row.cair + row.menunggu)) * 1.22;

  return (
    <div className="mt-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Gambaran proyek</h3>
        <p className="mt-1 text-xs text-muted-foreground">Pagu adalah batas belanja RO. Belanja menunjukkan pengeluaran yang tercatat; pencairan menunjukkan termin yang sudah dibayar.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Pagu dan belanja per RO" description={roRows.length > 8 ? "8 RO dengan pagu terbesar ditampilkan; RO lainnya digabung." : "Bandingkan batas dana dengan belanja tercatat di setiap RO."}>
          {roChartRows.length ? (
            <ChartContainer config={roConfig} className="h-[280px]">
              <BarChart data={roChartRows} layout="vertical" margin={{ top: 4, right: 52, left: 4, bottom: 0 }}>
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, roAxisMax]} tickLine={false} axisLine={false} tickMargin={6} tickFormatter={compactRupiah} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tickMargin={8} width={112} interval={0} tickFormatter={(value) => String(value).length > 18 ? `${String(value).slice(0, 17)}…` : String(value)} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={formatRupiah} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="pagu" fill="var(--color-pagu)" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="pagu" position="right" formatter={(value: unknown) => Number(value) > 0 ? compactRupiah(value) : ""} style={{ fill: "#475569", fontSize: 10 }} />
                </Bar>
                <Bar dataKey="belanja" fill="var(--color-belanja)" radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="belanja" position="right" formatter={(value: unknown) => Number(value) > 0 ? compactRupiah(value) : ""} style={{ fill: "#0369a1", fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : <NoChartData>Belum ada RO untuk ditampilkan.</NoChartData>}
        </ChartCard>

        <ChartCard title="Pencairan per termin" description="Lihat nilai termin yang sudah cair dan yang masih menunggu pembayaran.">
          {termChartRows.length ? (
            <ChartContainer config={termConfig} className="h-[280px]">
              <BarChart data={termChartRows} margin={{ top: 20, right: 38, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis domain={[0, termAxisMax]} tickLine={false} axisLine={false} tickMargin={6} width={58} tickFormatter={compactRupiah} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent valueFormatter={formatRupiah} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="cair" stackId="termin" fill="var(--color-cair)" radius={[4, 4, 0, 0]} maxBarSize={34}>
                  <LabelList dataKey="cair" position="top" formatter={(value: unknown) => Number(value) > 0 ? compactRupiah(value) : ""} style={{ fill: "#047857", fontSize: 10 }} />
                </Bar>
                <Bar dataKey="menunggu" stackId="termin" fill="var(--color-menunggu)" radius={[4, 4, 0, 0]} maxBarSize={34}>
                  <LabelList dataKey="menunggu" position="top" formatter={(value: unknown) => Number(value) > 0 ? compactRupiah(value) : ""} style={{ fill: "#475569", fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : <NoChartData>Rencana termin belum tersedia.</NoChartData>}
        </ChartCard>
      </div>
    </div>
  );
}
