"use client";

import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MoneyFlow } from "@/components/common/MoneyFlow";
import { EmptyData } from "@/components/loading/EmptyData";
import { formatDate, formatRupiah, roStatusTone } from "@/lib/hris/format";
import type { ProyekItemDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type RoGroup = { id: string; name: string; rows: Row[] };
type Props = {
  roGroups: RoGroup[];
  roRows: Row[];
  project: ProyekItemDto;
  roDetails: Record<string, Row>;
  roLoading: Record<string, boolean>;
  expandedRos: Record<string, boolean>;
  toggleRo: (roId: string) => void;
};

const text = (value: unknown, fallback = "—") => (value === null || value === undefined || value === "" ? fallback : String(value));
const financeOf = (row: Row): Row => (row.balance && typeof row.balance === "object" ? (row.balance as Row) : {});

export function ProjectRoSection({ roGroups, roRows, project, roDetails, roLoading, expandedRos, toggleRo }: Props) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-4">
          <h2 className="font-semibold">
            Rencana Operasional (RO) <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-xs">{roRows.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Plafon, unit koordinator, realisasi, kelengkapan administrasi, dan alokasi per RO.</p>
        </div>
        <div className="grid gap-3 p-5">
          {roGroups.length ? (
            roGroups.map((group) => (
              <div key={group.id} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <h3 className="text-sm font-semibold">{group.name}</h3>
                  <span className="text-xs text-muted-foreground">{group.rows.length} RO · rencana {formatRupiah(group.rows.reduce((sum, row) => sum + (Number(row.nilai_rencana) || Number(row.total_plafon) || 0), 0))}</span>
                </div>
                {group.rows.map((row) => {
              const roId = String(row.id);
              const detailRow = roDetails[roId];
              const canViewFinance = row.can_access_detail !== false;
              const planned = Number(row.nilai_rencana) || Number(row.total_plafon) || 0;
              const roFinance = canViewFinance ? { ...financeOf(row), ...financeOf(detailRow ?? {}) } : {};
              const approved = Number(roFinance.pagu_disetujui) || 0;
              const realized = Number(roFinance.realisasi ?? row.total_terpakai) || 0;
              const commitments = Number(roFinance.komitmen_aktif) || 0;
              const remainingRight = Number(roFinance.sisa_hak_belanja ?? row.sisa_saldo) || 0;
              const cashReceived = Number(roFinance.penerimaan_kas ?? row.trx_debit) || 0;
              const cashPosition = Number(roFinance.posisi_kas) || 0;
              const usage = approved > 0 ? Math.min(100, ((realized + commitments) / approved) * 100) : 0;
              const jobNumber = String(row.nomor_job ?? "").trim();
              const splitParts = jobNumber ? roRows.filter((item) => String(item.nomor_job ?? "").trim() === jobNumber).length : 0;
              const collaborationUnits = Array.isArray(row.unit_kolaborasi) ? (row.unit_kolaborasi as Row[]).map((unit) => String(unit.nama_unit ?? "")).filter(Boolean) : [];
              const missing = [!(row.no_kontrak ?? project.no_kontrak) && "No Kontrak", !row.pj && "PJ", !row.nomor_job && !row.no_sk && "Nomor Job", !project.mulai_sk && "Mulai SK proyek", !project.berakhir_sk && "Berakhir SK proyek"].filter(Boolean) as string[];
              const allocations = Array.isArray(detailRow?.alokasi_list) ? (detailRow.alokasi_list as Row[]) : [];
              const ledger = Array.isArray(detailRow?.transaksi_list) ? (detailRow.transaksi_list as Row[]) : [];
              return (
                <article key={roId} className="overflow-hidden rounded-xl border border-border">
                  <button
                    type="button"
                    aria-expanded={canViewFinance && Boolean(expandedRos[roId])}
                    aria-disabled={!canViewFinance}
                    disabled={!canViewFinance}
                    onClick={() => { if (canViewFinance) void toggleRo(roId); }}
                    className="flex w-full flex-col gap-3 p-4 text-left transition-colors enabled:hover:bg-muted/30 disabled:cursor-default sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{text(row.nama_ro, "RO")}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {text(row.nama_unit_koordinator)} · Tahun fiskal {text(row.tahun_fiscal)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">Nomor Job: {text(row.nomor_job)}</span>
                      {splitParts > 1 ? <span className="mt-1 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">RO split · {splitParts} bagian</span> : null}
                      {collaborationUnits.length ? <span className="mt-1 block text-xs text-violet-700">Kolaborasi dengan: {collaborationUnits.join(", ")}</span> : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={roStatusTone(String(row.status_ro ?? ""))}>{text(row.status_ro)}</StatusBadge>
                      <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">Pagu {formatRupiah(approved || planned)}</span>
                      {canViewFinance ? (
                        <>
                          <span className={`rounded-lg px-2.5 py-1 text-xs ${remainingRight < 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>Sisa hak {formatRupiah(remainingRight)}</span>
                          <span className={`rounded-lg px-2.5 py-1 text-xs ${cashPosition < 0 ? "bg-rose-100 text-rose-800" : "bg-muted text-foreground"}`}>Posisi kas {formatRupiah(cashPosition)}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${usage >= 90 ? "bg-rose-100 text-rose-800" : usage >= 70 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {usage.toFixed(0)}% terpakai
                          </span>
                          <ChevronDown className={`size-4 transition-transform ${expandedRos[roId] ? "rotate-180" : ""}`} />
                        </>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Rincian keuangan mengikuti akses unit</span>
                      )}
                    </span>
                  </button>
                  {expandedRos[roId] && (
                    <div className="space-y-4 border-t bg-muted/10 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm">{missing.length ? <span className="text-amber-700">Data belum lengkap: {missing.join(", ")}</span> : <span className="text-emerald-700">Data administrasi lengkap</span>}</p>
                        {canViewFinance ? (
                          <Link href={`/dashboard/ro/${roId}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                            Buka detail RO <ExternalLink size={14} />
                          </Link>
                        ) : <span className="text-xs text-muted-foreground">Detail ledger hanya tersedia untuk unit pemilik RO.</span>}
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${usage >= 90 ? "bg-rose-500" : usage >= 70 ? "bg-amber-500" : "bg-primary"}`} style={{ width: `${usage}%` }} />
                      </div>
                      {roLoading[roId] ? (
                        <p className="text-sm text-muted-foreground">Memuat detail RO...</p>
                      ) : detailRow?.error ? (
                        <EmptyData className="min-h-0 border-0 p-3 [&_.empty-pyramid]:hidden" label="Rincian RO belum dapat dimuat." />
                      ) : (
                        <>
                          <div className="grid gap-4 xl:grid-cols-2">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hak belanja</p>
                              <MoneyFlow items={[
                                { label: "Pagu disetujui", amount: approved },
                                { label: "Realisasi", amount: realized, operator: "−", tone: "text-rose-700" },
                                { label: "Komitmen aktif", amount: commitments, operator: "−", tone: "text-amber-700" },
                                { label: "Sisa hak belanja", amount: remainingRight, operator: "=", tone: remainingRight < 0 ? "text-rose-700" : "text-emerald-700" },
                              ]} />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arus kas</p>
                              <MoneyFlow items={[
                                { label: "Penerimaan kas", amount: cashReceived, tone: "text-sky-700" },
                                { label: "Realisasi", amount: realized, operator: "−", tone: "text-rose-700" },
                                { label: "Posisi kas", amount: cashPosition, operator: "=", tone: cashPosition < 0 ? "text-rose-700" : "text-foreground" },
                              ]} />
                            </div>
                          </div>
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <p><span className="text-muted-foreground">Penanggung jawab:</span> {text(row.pj)}</p>
                            <p><span className="text-muted-foreground">Periode SK:</span> mengikuti periode SK proyek.</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            No. kontrak proyek: {text(row.no_kontrak ?? project.no_kontrak)} · No. Job RO: {text(row.nomor_job)} · No. SK: {text(row.no_sk)}
                          </p>
                          {collaborationUnits.length ? <p className="text-xs text-violet-700">Unit kolaborasi RO: {collaborationUnits.join(", ")}</p> : <p className="text-xs text-muted-foreground">RO ini tidak mencatat unit kolaborasi.</p>}
                          <div className="grid gap-4 xl:grid-cols-2">
                            {[
                              ["Alokasi pegawai", allocations, "Belum ada alokasi pegawai."],
                              ["Transaksi ledger", ledger, "Belum ada transaksi ledger."],
                            ].map(([title, rows, empty]) => {
                              const list = rows as Row[];
                              return (
                                <div key={title as string} className="overflow-hidden rounded-lg border bg-background">
                                  <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">
                                    {title as string} <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
                                  </div>
                                  {list.length ? (
                                    <div className="max-h-72 overflow-auto">
                                      <table className="w-full text-left text-xs">
                                        <thead className="sticky top-0 bg-muted text-muted-foreground">
                                          <tr>
                                            {title === "Alokasi pegawai" ? (
                                              <>
                                                <th className="p-2">Pegawai / periode</th>
                                                <th className="p-2">Status</th>
                                                <th className="p-2 text-right">Nilai</th>
                                              </>
                                            ) : (
                                              <>
                                                <th className="p-2">Tanggal / kegiatan</th>
                                                <th className="p-2 text-right">Debit</th>
                                                <th className="p-2 text-right">Kredit</th>
                                                <th className="p-2 text-right">Saldo</th>
                                              </>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {list.map((item, index) => (
                                            <tr key={String(item.id ?? index)} className="border-t">
                                              {title === "Alokasi pegawai" ? (
                                                <>
                                                  <td className="p-2">
                                                    {text(item.nama_pegawai ?? (item.pegawai as Row | undefined)?.nama)}
                                                    <span className="block text-muted-foreground">
                                                      {String(item.periode_bulan ?? "")}/{text(item.periode_tahun, "")}
                                                    </span>
                                                  </td>
                                                  <td className="p-2">{text(item.status)}</td>
                                                  <td className="p-2 text-right">{formatRupiah(item.jumlah ?? item.nominal ?? item.nilai)}</td>
                                                </>
                                              ) : (
                                                <>
                                                  <td className="p-2">
                                                    {formatDate(String(item.tanggal ?? ""))}
                                                    <span className="block text-muted-foreground">{text(item.nama_kegiatan)}</span>
                                                  </td>
                                                  <td className="p-2 text-right">{formatRupiah(item.debit)}</td>
                                                  <td className="p-2 text-right">{formatRupiah(item.kredit)}</td>
                                                  <td className="p-2 text-right">{formatRupiah(item.saldo)}</td>
                                                </>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="p-3 text-xs text-muted-foreground">{empty as string}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
                })}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada RO terkait.</p>
          )}
        </div>
    </section>
  );
}
