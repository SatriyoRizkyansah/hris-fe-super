"use client";

import { MoneyFlow } from "@/components/common/MoneyFlow";
import { formatDate, formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
type FinanceSummary = {
  contract: number;
  directCost: number;
  margin: number;
  marginDistributed: number;
  roPlan: number;
  approvedRoBudget: number;
  roUsed: number;
  roCommitments: number;
  roCashReceived: number;
  roCashPosition: number;
  roRemainingRight: number;
  usedPercent: number;
  marginPercent: number;
};
type Props = {
  summary: FinanceSummary;
  termRows: Row[];
  termTotal: number;
  termPaid: number;
  termRemaining: number;
  roCount: number;
  hasRestrictedRos: boolean;
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProjectFinancialSections({ summary, termRows, termTotal, termPaid, termRemaining, roCount, hasRestrictedRos }: Props) {
  const {
    contract, directCost, margin, marginDistributed, roPlan, approvedRoBudget,
    roUsed, roCommitments, roCashReceived, roCashPosition, roRemainingRight,
    usedPercent, marginPercent,
  } = summary;
  return (
    <>
      <section className="rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Ringkasan keuangan</h2>
            <p className="mt-1 text-sm text-muted-foreground">Validasi nilai kontrak, penggunaan plafon RO, dan distribusi margin.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${contract === directCost + margin ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {contract === directCost + margin ? "Kontrak seimbang" : "Kontrak tidak seimbang"}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Nilai Kontrak" value={formatRupiah(contract)} />
          <Card label="Direct Cost" value={formatRupiah(directCost)} hint={`${roCount} RO · alokasi rencana ${formatRupiah(roPlan)}`} />
          <Card label="Total Margin" value={formatRupiah(margin)} hint={`Distribusi ${formatRupiah(marginDistributed)}`} />
          <Card label={hasRestrictedRos ? "Posisi kas RO unit Anda" : "Posisi kas seluruh RO"} value={formatRupiah(roCashPosition)} hint={`Kas masuk ${formatRupiah(roCashReceived)} · realisasi ${formatRupiah(roUsed)}`} />
        </div>
        <div className="mt-5 grid gap-4 border-t pt-5 xl:grid-cols-2">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">{hasRestrictedRos ? "Hak belanja RO unit Anda" : "Hak belanja seluruh RO"}</p>
              <p className="text-xs text-muted-foreground">{hasRestrictedRos ? "Ringkasan ini hanya mencakup RO yang dapat diakses unit Anda." : "Pagu yang disetujui dikurangi realisasi dan komitmen aktif."}</p>
            </div>
            <MoneyFlow items={[
              { label: "Pagu disetujui", amount: approvedRoBudget },
              { label: "Realisasi", amount: roUsed, operator: "−", tone: "text-rose-700" },
              { label: "Komitmen aktif", amount: roCommitments, operator: "−", tone: "text-amber-700" },
              { label: "Sisa hak belanja", amount: roRemainingRight, operator: "=", tone: roRemainingRight < 0 ? "text-rose-700" : "text-emerald-700" },
            ]} />
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">{hasRestrictedRos ? "Arus kas RO unit Anda" : "Arus kas seluruh RO"}</p>
              <p className="text-xs text-muted-foreground">{hasRestrictedRos ? "Ringkasan ini hanya mencakup RO yang dapat diakses unit Anda." : "Penerimaan dari invoice dikurangi realisasi belanja."}</p>
            </div>
            <MoneyFlow items={[
              { label: "Penerimaan kas", amount: roCashReceived, tone: "text-sky-700" },
              { label: "Realisasi", amount: roUsed, operator: "−", tone: "text-rose-700" },
              { label: "Posisi kas", amount: roCashPosition, operator: "=", tone: roCashPosition < 0 ? "text-rose-700" : "text-foreground" },
            ]} />
          </div>
        </div>
        <div className="mt-5 grid gap-5 border-t pt-4 md:grid-cols-2">
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{hasRestrictedRos ? "Pemakaian pagu RO unit Anda" : "Pemakaian pagu RO"}</span>
              <strong>{usedPercent.toFixed(1)}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${usedPercent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRupiah(roUsed + roCommitments)} dari {formatRupiah(approvedRoBudget)}
            </p>
          </div>
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Margin terdistribusi</span>
              <strong>{marginPercent.toFixed(1)}%</strong>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, marginPercent)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatRupiah(marginDistributed)} dari {formatRupiah(margin)}
            </p>
          </div>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">
            Jadwal termin invoice <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs">{termRows.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Termin menjadi jadwal tagihan. Status cair hanya berubah setelah Bendahara mencatat pembayaran invoice hingga lunas.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Total nilai termin" value={formatRupiah(termTotal)} hint={`${termRows.length} termin`} />
            <Card label="Sudah cair" value={formatRupiah(termPaid)} hint={`${termRows.filter((term) => String(term.status) === "CAIR").length} termin dicairkan`} />
            <Card label="Belum cair" value={formatRupiah(termRemaining)} hint={`${termRows.filter((term) => String(term.status) !== "CAIR").length} termin tersisa`} />
            <Card label="Progres pencairan" value={`${termTotal ? ((termPaid / termTotal) * 100).toFixed(1) : "0.0"}%`} hint="Berdasarkan nilai termin" />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${termTotal ? Math.min(100, (termPaid / termTotal) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="grid gap-3 p-5">
          {termRows.length ? (
            termRows.map((term) => {
              const termStatus = String(term.status ?? "—");
              const invoice = term.invoice && typeof term.invoice === "object" ? (term.invoice as Row) : undefined;
              const invoiceStatus = String(invoice?.status ?? "");
              const stage = termStatus === "CAIR" || invoiceStatus === "LUNAS"
                ? "Cair · invoice lunas"
                : invoiceStatus === "DITOLAK_KEUANGAN"
                    ? "Invoice ditolak Keuangan"
                    : invoiceStatus === "SEBAGIAN_DIBAYAR"
                      ? "Invoice dibayar sebagian"
                      : invoiceStatus === "DITERBITKAN"
                        ? "Menunggu pembayaran invoice"
                        : "Menunggu pengajuan invoice oleh Billing";
              return (
                <div key={String(term.id)} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      Termin {String(term.nomor_termin ?? "—")} · {String(term.persentase ?? 0)}%
                    </p>
                    <p className="text-sm font-semibold">{formatRupiah(term.nilai_termin ?? term.nilai ?? term.nominal)}</p>
                    <p className="text-xs text-muted-foreground">
                      Tahap: {stage}
                      {term.dicairkan_pada ? ` · Dicairkan ${formatDate(String(term.dicairkan_pada))}` : ""}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada termin.</p>
          )}
        </div>
      </section>
    </>
  );
}
