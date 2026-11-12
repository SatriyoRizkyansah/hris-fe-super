"use client";

import type { Dispatch, SetStateAction } from "react";
import { Banknote, Check, CircleAlert, CircleDollarSign, FileText, LoaderCircle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { EmptyData } from "@/components/loading/EmptyData";
import { Card, CardContent } from "@/components/ui/card";
import { Modal, ModalDetailGrid, ModalDetailItem, ModalSection } from "@/components/modal/Modal";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { MoneyFlow } from "@/components/common/MoneyFlow";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
type Props = {
  reviewing: Row | null;
  setReviewing: Dispatch<SetStateAction<Row | null>>;
  reviewRequest: Row;
  reviewProject: Row;
  reviewRoBalance: Row;
  reviewCashFlow: Row;
  reviewChecks: Row;
  reviewProjectRos: Row[];
  reviewTerms: Row[];
  reviewLedger: Row[];
  reviewContextQuery: { isLoading: boolean; isError: boolean; refetch: () => unknown };
  reviewMutation: { isPending: boolean };
  reviewStage: "karwas" | "keuangan" | "kabag";
  review: (approved: boolean) => void;
  note: string;
  setNote: Dispatch<SetStateAction<string>>;
  error: string;
};

export function PurchaseRequestReviewModal({
  reviewing,
  setReviewing,
  reviewRequest,
  reviewProject,
  reviewRoBalance,
  reviewCashFlow,
  reviewChecks,
  reviewProjectRos,
  reviewTerms,
  reviewLedger,
  reviewContextQuery,
  reviewMutation,
  reviewStage,
  review,
  note,
  setNote,
  error,
}: Props) {
  return (
    <Modal
      open={Boolean(reviewing)}
      onClose={() => setReviewing(null)}
      title={reviewStage === "karwas" ? "Validasi KARWAS" : reviewStage === "keuangan" ? "Validasi Keuangan" : "Persetujuan Kabag"}
      description={reviewing ? `${String(reviewRequest.nomor_pengajuan ?? reviewing.nomor_pengajuan ?? "")} · ${String(reviewRequest.nama_kegiatan ?? reviewing.nama_kegiatan)} · Tinjau rincian dan posisi anggaran sebelum memberi keputusan.` : "Review pengajuan belanja."}
      size="xl"
      bodyClassName="space-y-4 bg-slate-50/60"
      footer={
        <>
          <Button variant="outline" onClick={() => setReviewing(null)}>
            Batal
          </Button>
          <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => review(false)}>
            <X size={16} /> Tolak
          </Button>
          <Button
            disabled={reviewMutation.isPending || reviewContextQuery.isLoading || reviewContextQuery.isError || (reviewStage === "karwas" && (!reviewChecks.ro_reguler || !reviewChecks.proyek_disetujui || !reviewChecks.pagu_mencukupi))}
            onClick={() => review(true)}
          >
            {reviewMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}{" "}
            {reviewStage === "karwas" ? "Setujui & Reservasi Pagu" : reviewStage === "keuangan" ? "Setujui Validasi Keuangan" : "Setujui sebagai Kabag"}
          </Button>
        </>
      }
    >
      {reviewContextQuery.isLoading && (
        <Card>
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin" /> Memuat data RO, proyek, dan arus kas…
          </CardContent>
        </Card>
      )}
      {reviewContextQuery.isError && (
        <EmptyData
          label="Konteks keuangan untuk review belum dapat dimuat."
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void reviewContextQuery.refetch()}>
              Coba lagi
            </Button>
          }
        />
      )}
      {(!reviewContextQuery.isLoading && !reviewContextQuery.isError) && (
        <>
          <ModalSection title="Rincian pengajuan" description="Informasi yang sama ditampilkan pada setiap tahap agar pemeriksa dapat meninjau dasar pengajuan secara lengkap.">
            <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
              {[
                ["Nomor pengajuan", reviewRequest.nomor_pengajuan ?? "—"],
                ["Diajukan oleh", reviewRequest.pembuat?.nama ?? "—"],
                ["Kegiatan", reviewRequest.nama_kegiatan ?? "—"],
                ["Nilai pengajuan", formatRupiah(reviewRequest.jumlah)],
                ["Tanggal transaksi", reviewRequest.tanggal ? new Date(reviewRequest.tanggal).toLocaleDateString("id-ID") : "—"],
                ["No. kuitansi", reviewRequest.no_kuitansi || "Belum dicantumkan"],
                ["Status reservasi", reviewRequest.reservasi?.status ?? "Belum direservasi"],
                ["Unit koordinator", reviewRequest.ro?.unit_koordinator?.nama_unit ?? "—"],
                ["MAK", `${reviewRequest.ro?.mak?.kode_mak ?? "—"} · ${reviewRequest.ro?.mak?.nama_mak ?? "Belum terhubung"}`],
                ["Keterangan pemohon", reviewRequest.keterangan || "Tidak ada keterangan tambahan.", "sm:col-span-2"],
              ].map(([label, value, className]) => (
                <div key={String(label)} className={`min-w-0 py-3 sm:border-b ${className ?? ""}`}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className={`mt-1 break-words text-sm ${label === "Nilai pengajuan" ? "font-semibold tabular-nums" : ""}`}>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3">
              <DocumentLinks
                documents={[
                  { label: "Bukti kuitansi", path: reviewRequest.file_bukti },
                  { label: "RAB RO", path: reviewRequest.ro?.file_rab },
                  { label: "RAB proyek", path: reviewProject.file_rab },
                  { label: "Kontrak Proyek", path: reviewProject.file_sk },
                ]}
              />
            </div>
          </ModalSection>

          <ModalSection title="Riwayat pemeriksaan" description="Tahap persetujuan, pemeriksa, tanggal keputusan, dan catatan tampil bersama di setiap tahap review.">
            <div className="divide-y rounded-lg border bg-white px-3">
              {[
                { title: "Validasi KARWAS", user: reviewRequest.pemeriksa?.nama, date: reviewRequest.diperiksa_pada, note: reviewRequest.catatan_pemeriksa, complete: ["DISETUJUI_KARWAS", "DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(String(reviewRequest.status)), rejected: reviewRequest.status === "DITOLAK_KARWAS" },
                { title: "Validasi Keuangan", user: reviewRequest.validator_keuangan?.nama, date: reviewRequest.divalidasi_keuangan_pada, note: reviewRequest.catatan_keuangan, complete: ["DISETUJUI_KEUANGAN", "DISETUJUI_KABAG", "DIBAYAR"].includes(String(reviewRequest.status)), rejected: reviewRequest.status === "DITOLAK_KEUANGAN" },
                { title: "Persetujuan Kabag", user: reviewRequest.validator_kabag?.nama, date: reviewRequest.divalidasi_kabag_pada, note: reviewRequest.catatan_kabag, complete: ["DISETUJUI_KABAG", "DIBAYAR"].includes(String(reviewRequest.status)), rejected: reviewRequest.status === "DITOLAK_KABAG" },
              ].map((item) => (
                <div key={item.title} className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 py-3 text-sm">
                  <div className="min-w-36 font-medium">{item.title}</div>
                  <div className="min-w-0 flex-1 text-muted-foreground">
                    {item.complete || item.rejected ? <>{item.rejected ? "Ditolak" : "Disetujui"}{item.user ? ` oleh ${item.user}` : ""} · {item.date ? new Date(item.date).toLocaleString("id-ID") : "waktu tidak tercatat"}{item.note ? <p className="mt-1 break-words text-foreground">Catatan: {item.note}</p> : null}</> : "Belum diproses"}
                  </div>
                </div>
              ))}
            </div>
          </ModalSection>

          <ModalSection title="Kondisi RO yang diajukan" description="Pagu menunjukkan hak belanja. Posisi kas menunjukkan penerimaan kas dikurangi realisasi; keduanya bukan angka yang sama.">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hak belanja RO</p>
              <MoneyFlow
                items={[
                  { label: "Pagu disetujui", amount: reviewRoBalance.pagu_disetujui },
                  { label: "Realisasi", amount: reviewRoBalance.realisasi, operator: "−", tone: "text-rose-700" },
                  { label: "Sisa hak belanja", amount: reviewRoBalance.sisa_dapat_direservasi, operator: "=", tone: "text-emerald-700" },
                ]}
              />
              <MoneyFlow
                items={[
                  { label: "Sisa hak belanja", amount: reviewRoBalance.sisa_dapat_direservasi },
                  { label: "Pengajuan ini", amount: reviewRequest.jumlah, operator: "−", tone: "text-amber-700" },
                  { label: "Sisa setelah pengajuan", amount: reviewChecks.sisa_setelah_reservasi, operator: "=", tone: Number(reviewChecks.sisa_setelah_reservasi) < 0 ? "text-rose-700" : "text-emerald-700" },
                ]}
              />
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arus kas RO</p>
              <MoneyFlow
                items={[
                  { label: "Penerimaan kas", amount: reviewRoBalance.penerimaan_kas, tone: "text-sky-700" },
                  { label: "Realisasi", amount: reviewRoBalance.realisasi, operator: "−", tone: "text-rose-700" },
                  { label: "Posisi kas", amount: reviewRoBalance.posisi_kas, operator: "=", tone: Number(reviewRoBalance.posisi_kas) < 0 ? "text-rose-700" : "text-foreground" },
                ]}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
                <span className="text-muted-foreground">Talangan belum lunas</span>
                <strong className="tabular-nums text-orange-700">{formatRupiah(reviewRoBalance.saldo_talangan)}</strong>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={`rounded-full px-2.5 py-1 font-medium ${reviewChecks.ro_reguler ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{reviewChecks.ro_reguler ? "RO reguler" : "Bukan RO reguler"}</span>
              <span className={`rounded-full px-2.5 py-1 font-medium ${reviewChecks.proyek_disetujui ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {reviewChecks.proyek_disetujui ? "Proyek disetujui Pimpinan" : "Proyek belum disetujui Pimpinan"}
              </span>
              <span className={`rounded-full px-2.5 py-1 font-medium ${reviewChecks.pagu_mencukupi ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {reviewChecks.pagu_mencukupi ? "Pagu cukup" : "Pagu tidak mencukupi"}
              </span>
            </div>
            {(!reviewChecks.ro_reguler || !reviewChecks.proyek_disetujui || !reviewChecks.pagu_mencukupi) && (
              <Alert variant="destructive" className="mt-3">
                <CircleAlert size={16} />
                <AlertDescription>Pengajuan belum memenuhi syarat reservasi pagu. Tombol persetujuan dinonaktifkan; KARWAS tetap dapat menolak dengan menyertakan catatan.</AlertDescription>
              </Alert>
            )}
          </ModalSection>

          {reviewProject.id && (
            <ModalSection
              title={`Ringkasan proyek · ${String(reviewProject.kode_proyek ?? "")}`}
              description={`${String(reviewProject.nama_proyek ?? "Proyek")}${reviewProject.nama_client ? ` · ${String(reviewProject.nama_client)}` : ""} · TA ${String(reviewProject.tahun_fiscal ?? "—")} · Status ${String(reviewProject.status_proyek ?? "—").replaceAll("_", " ")}`}
            >
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Nilai kontrak", reviewProject.nilai_kontrak],
                  ["Direct Cost", reviewProject.total_direct_cost],
                ].map(([label, amount]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-4 py-3 sm:border-b">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{formatRupiah(amount)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penagihan proyek</p>
                <MoneyFlow
                  items={[
                    { label: "Tagihan terbit", amount: reviewCashFlow.nilai_tagihan_terbit },
                    { label: "Penerimaan terverifikasi", amount: reviewCashFlow.penerimaan_terverifikasi, operator: "−", tone: "text-sky-700" },
                    { label: "Sisa tagihan", amount: reviewCashFlow.sisa_tagihan, operator: "=", tone: "text-amber-700" },
                  ]}
                />
              </div>
              <dl className="mt-3 grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Belanja terealisasi", reviewCashFlow.realisasi, "text-rose-700"],
                  ["Pengajuan menunggu review", reviewCashFlow.pengajuan_menunggu, "text-slate-700"],
                  ["Sisa hak belanja seluruh RO", reviewCashFlow.sisa_hak_belanja, "text-emerald-700"],
                  ["Talangan proyek belum lunas", reviewCashFlow.saldo_talangan, "text-orange-700"],
                ].map(([label, amount, tone]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-4 py-3 sm:border-b">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className={`text-sm font-semibold tabular-nums ${tone}`}>{formatRupiah(amount)}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 overflow-hidden rounded-lg border bg-white">
                <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
                  <Banknote size={16} className="text-primary" /> Posisi pagu per RO
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[52rem] text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="p-2.5">RO / Unit</th>
                        <th className="p-2.5">MAK</th>
                        <th className="p-2.5 text-right">Pagu</th>
                        <th className="p-2.5 text-right">Realisasi</th>
                        <th className="p-2.5 text-right">Sisa hak</th>
                        <th className="p-2.5 text-right">Pengajuan menunggu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewProjectRos.map((ro) => {
                        const isCurrent = String(ro.id) === String(reviewRequest.ro_id);
                        return (
                          <tr key={String(ro.id)} className={`border-t ${isCurrent ? "bg-amber-50/70" : ""}`}>
                            <td className="p-2.5">
                              <span className="font-semibold">
                                {String(ro.kode_ro)} · {String(ro.nama_ro)}
                              </span>
                              <span className="mt-0.5 block text-muted-foreground">
                                {String(ro.nama_unit_koordinator ?? "Unit tidak diketahui")}
                                {isCurrent ? " · RO pengajuan ini" : ""}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {String(ro.mak?.kode_mak ?? "—")} · {String(ro.mak?.nama_mak ?? "—")}
                            </td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.balance?.pagu_disetujui)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.balance?.realisasi)}</td>
                            <td className="p-2.5 text-right font-semibold tabular-nums">{formatRupiah(ro.balance?.sisa_dapat_direservasi)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(ro.pengajuan_menunggu?.reduce((sum: number, item: Row) => sum + Number(item.jumlah ?? 0), 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border bg-white">
                <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
                  <FileText size={16} className="text-primary" /> Status termin dan penerimaan invoice
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="p-2.5">Termin</th>
                        <th className="p-2.5">Invoice / status</th>
                        <th className="p-2.5 text-right">Nilai termin</th>
                        <th className="p-2.5 text-right">Dibayar</th>
                        <th className="p-2.5 text-right">Sisa invoice</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewTerms.map((term) => {
                        const invoice = term.invoice as Row | null;
                        const paid = Number(invoice?.nominal_dibayar ?? 0);
                        return (
                          <tr key={String(term.id)} className="border-t">
                            <td className="p-2.5">
                              Termin {String(term.nomor_termin)} · {String(term.status).replaceAll("_", " ")}
                            </td>
                            <td className="p-2.5">
                              {invoice ? (
                                <>
                                  {String(invoice.nomor_invoice)}
                                  <span className="mt-0.5 block text-muted-foreground">{String(invoice.status).replaceAll("_", " ")}</span>
                                </>
                              ) : (
                                "Belum ada invoice"
                              )}
                            </td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(term.nilai_termin)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(paid)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatRupiah(invoice ? Math.max(0, Number(invoice.nominal ?? 0) - paid) : 0)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </ModalSection>
          )}

          <ModalSection title="Riwayat arus kas RO" description="Mutasi terbaru pada ledger RO ini; debit adalah dana masuk dan kredit adalah realisasi/pengeluaran.">
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full min-w-[38rem] text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-2.5">Tanggal</th>
                    <th className="p-2.5">Transaksi</th>
                    <th className="p-2.5 text-right">Dana masuk</th>
                    <th className="p-2.5 text-right">Realisasi</th>
                    <th className="p-2.5 text-right">Saldo ledger</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewLedger
                    .slice(-10)
                    .reverse()
                    .map((transaction, index) => (
                      <tr key={String(transaction.id ?? index)} className="border-t">
                        <td className="whitespace-nowrap p-2.5">{transaction.tanggal ? new Date(transaction.tanggal).toLocaleDateString("id-ID") : "—"}</td>
                        <td className="p-2.5">
                          <span className="font-medium">{String(transaction.nama_kegiatan ?? "Mutasi RO")}</span>
                          <span className="mt-0.5 block text-muted-foreground">
                            {String(transaction.jenis_transaksi ?? "").replaceAll("_", " ")}
                            {transaction.keterangan ? ` · ${String(transaction.keterangan)}` : ""}
                          </span>
                        </td>
                        <td className="p-2.5 text-right tabular-nums">{Number(transaction.debit) ? formatRupiah(transaction.debit) : "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">{Number(transaction.kredit) ? formatRupiah(transaction.kredit) : "—"}</td>
                        <td className="p-2.5 text-right tabular-nums">{formatRupiah(transaction.saldo)}</td>
                      </tr>
                    ))}
                  {!reviewLedger.length && (
                    <tr>
                      <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                        Belum ada transaksi kas pada ledger RO.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ModalSection>
        </>
      )}
      <label className="grid gap-1 text-sm">
        {reviewStage === "karwas" ? "Catatan KARWAS" : reviewStage === "keuangan" ? "Catatan validasi Keuangan" : "Catatan persetujuan Kabag"}
        <textarea
          className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Tuliskan alasan penolakan atau catatan pemeriksaan (opsional saat menyetujui)"
        />
      </label>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Modal>
  );
}
