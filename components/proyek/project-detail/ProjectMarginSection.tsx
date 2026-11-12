import { formatRupiah } from "@/lib/hris/format";
import type { ProjectDetailRow } from "./types";

const value = (item: unknown) => item == null || item === "" ? "—" : String(item);

function Summary({ label, amount, hint }: { label: string; amount: number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatRupiah(amount)}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProjectMarginSection({ settings, distributions, margin, distributed, percentage, remaining }: {
  settings: ProjectDetailRow[];
  distributions: ProjectDetailRow[];
  margin: number;
  distributed: number;
  percentage: number;
  remaining: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="border-b bg-muted/40 px-5 py-4">
        <h2 className="font-semibold">Realisasi margin per kategori dan unit</h2>
        <p className="mt-1 text-sm text-muted-foreground">Acuan, nilai yang sudah disalurkan, dan sisa per kategori dalam satu tabel.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Summary label="Target margin" amount={margin} />
          <Summary label="Sudah didistribusikan" amount={distributed} hint={`${percentage.toFixed(1)}% dari target`} />
          <Summary label="Sisa belum didistribusikan" amount={remaining} hint="Target dikurangi realisasi" />
        </div>
      </div>
      <div className="overflow-x-auto p-5">
        {settings.length ? (
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Kategori</th><th className="p-3">Unit penerima</th>
                <th className="p-3 text-right">Persentase acuan</th><th className="p-3 text-right">Nilai acuan</th>
                <th className="p-3 text-right">Transaksi</th><th className="p-3 text-right">Sudah disalurkan</th>
                <th className="p-3 text-right">Sisa acuan</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((setting, index) => {
                const category = value(setting.kategori_kamar);
                const unit = value(setting.nama_unit ?? (setting.unit as ProjectDetailRow | undefined)?.nama_unit);
                const rows = distributions.filter((row) =>
                  value(row.dana_kategori ?? (row.dana as ProjectDetailRow | undefined)?.kategori_kamar) === category &&
                  value((row.unit as ProjectDetailRow | undefined)?.nama_unit ?? (row.dana as ProjectDetailRow | undefined)?.nama_unit) === unit,
                );
                const actual = rows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
                const pct = Number(setting.persentase) || 0;
                const target = (margin * pct) / 100;
                return (
                  <tr key={String(setting.id ?? index)} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium">{value(setting.nama_kamar ?? category)}</td><td className="p-3">{unit}</td>
                    <td className="p-3 text-right">{pct}%</td><td className="p-3 text-right">{formatRupiah(target)}</td>
                    <td className="p-3 text-right">{rows.length}</td><td className="p-3 text-right font-semibold">{formatRupiah(actual)}</td>
                    <td className="p-3 text-right">{formatRupiah(Math.max(0, target - actual))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="text-sm text-muted-foreground">Pengaturan margin tidak tersedia.</p>}
      </div>
    </section>
  );
}
