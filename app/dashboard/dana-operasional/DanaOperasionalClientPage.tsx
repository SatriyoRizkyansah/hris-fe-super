"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowUpRight, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeRows } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { DanaOperasionalItemDto } from "@/lib/api/generated/api-generated";

const kamar = [
  { key: "P1_PNS_NON_PNS", label: "P1 PNS / Non-PNS", share: "48%", style: "border-blue-200 bg-blue-50/60" },
  { key: "P2_KP3", label: "P2 KP3", share: "30%", style: "border-violet-200 bg-violet-50/60" },
  { key: "OPS_KANTOR", label: "OPS Kantor", share: "17%", style: "border-amber-200 bg-amber-50/60" },
  { key: "OPS_KP3", label: "OPS KP3", share: "2.5%", style: "border-emerald-200 bg-emerald-50/60" },
  { key: "MULOS_SPI", label: "Mulos / SPI", share: "2.5%", style: "border-teal-200 bg-teal-50/60" },
];
const currentYear = new Date().getFullYear();

export default function DanaOperasionalClientPage() {
  const query = use_query({
    tag: "masterDanaOperasional",
    method: "danaOperasionalControllerGetData",
    params: { page: 1, limit: 500, tahun_fiscal: currentYear },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterDanaOperasional.danaOperasionalControllerGetData({ page: 1, limit: 500, tahun_fiscal: currentYear });
    },
  });
  const rows = envelopeRows<DanaOperasionalItemDto & Record<string, unknown>>(query.data);
  const summary = useMemo(
    () =>
      kamar.map((item) => {
        const filtered = rows.filter((row) => row.kategori_kamar === item.key);
        return {
          ...item,
          plafond: filtered.reduce((sum, row) => sum + Number(row.total_plafon || 0), 0),
          spent: filtered.reduce((sum, row) => sum + Number(row.total_terpakai || 0), 0),
          balance: filtered.reduce((sum, row) => sum + Number(row.sisa_saldo ?? row.total_plafon ?? 0), 0),
          count: filtered.length,
        };
      }),
    [rows],
  );
  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Dana Operasional</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pembagian plafond dan saldo dana operasional per kamar · Tahun fiskal {currentYear}.</p>
      </header>
      {query.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat dana operasional</AlertTitle>
          <AlertDescription>{apiErrorMessage(query.error)}</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((item) => (
          <Card key={item.key} className={item.style}>
            <CardContent className="px-30 pb-3 sm:px-4 sm:pb-4">
              <div className="flex min-h-10 items-start justify-between gap-1 pt-4 sm:pt-4">
                <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">{item.label}</p>
                <span className="shrink-0 rounded-full border bg-background/80 px-1.5 py-0.5 text-[10px] font-bold">{item.share}</span>
              </div>
              <p className="mt-2 break-words text-base font-bold leading-tight">{query.isLoading ? "Memuat…" : formatRupiah(item.plafond)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Plafond · {item.count} wallet</p>
              <div className="mt-2 flex items-center justify-between border-t border-current/10 pt-2 text-[10px]">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Wallet size={13} /> Terpakai
                </span>
                <strong>{formatRupiah(item.spent)}</strong>
              </div>
              <div className="mt-1 flex justify-between gap-1 text-[10px] text-muted-foreground">
                <span>Sisa saldo</span>
                <strong className="text-right text-foreground">{formatRupiah(item.balance)}</strong>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-4">
          <DataTable
            title="Daftar Dana Operasional"
            columns={[
              { key: "unit", header: "Unit Koordinator", render: (row) => String(row.nama_unit_koordinator ?? "—") },
              { key: "kamar", header: "Kamar", render: (row) => String(row.kategori_kamar ?? "—").replaceAll("_", " ") },
              { key: "tahun", header: "Tahun Fiscal", render: (row) => row.tahun_fiscal },
              { key: "plafon", header: "Plafond", className: "text-right", render: (row) => formatRupiah(row.total_plafon) },
              { key: "sisa", header: "Sisa Saldo", className: "text-right", render: (row) => formatRupiah(row.sisa_saldo ?? row.total_plafon) },
              { key: "terpakai", header: "Terpakai", className: "text-right", render: (row) => formatRupiah(row.total_terpakai) },
              {
                key: "aksi",
                header: "Detail",
                className: "text-right",
                render: (row) => (
                  <Button variant="outline" size="sm" render={<Link href={`/dashboard/dana-operasional/${row.id}`} />}>
                    <ArrowUpRight size={14} /> Detail
                  </Button>
                ),
              },
            ]}
            rows={rows}
            rowKey={(row) => row.id}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            emptyMessage="Belum ada data dana operasional."
            searchPlaceholder="Cari unit atau kamar…"
          />
        </CardContent>
      </Card>
    </section>
  );
}
