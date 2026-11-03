"use client";

import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ArrowUpRight, Circle, CircleCheck, CircleDollarSign, CircleX, Clock3, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalDetailGrid, ModalDetailItem, ModalSection } from "@/components/modal/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
type Step = { title: string; state: string; description: string };
type Props = {
  detailRequest: Row | null;
  setDetailRequest: Dispatch<SetStateAction<Row | null>>;
  detailStatus: string;
  detailSteps: Step[];
  retailDetailRequest: Row | null;
  setRetailDetailRequest: Dispatch<SetStateAction<Row | null>>;
  retailDetailStatus: string;
  retailDetailRejected: boolean;
  retailDetailCanceled: boolean;
  retailDetailPaid: boolean;
  retailDetailApproved: boolean;
  retailDetailSteps: Step[];
  retailDetailJob: Row;
  retailDetailDocuments: Array<{ label: string; path?: any }>;
  hasRetailDetailDocuments: boolean;
  canReview: boolean;
  canPay: boolean;
  retailReviewPending: boolean;
  reviewRetail: (approved: boolean) => void;
  retailReviewNote: string;
  setRetailReviewNote: Dispatch<SetStateAction<string>>;
  retailReviewError: string;
  onStartRetailPayment: (request: Row) => void;
  formatDateTime: (value: unknown) => string;
  statusLabels: Record<string, string>;
  statusTone: (status?: string) => "ok" | "warn" | "danger" | "neutral";
};

export function PurchaseRequestDetailModals(props: Props) {
  const {
    detailRequest, setDetailRequest, detailStatus, detailSteps, retailDetailRequest,
    setRetailDetailRequest, retailDetailStatus, retailDetailRejected, retailDetailCanceled,
    retailDetailPaid, retailDetailApproved, retailDetailSteps, retailDetailJob,
    retailDetailDocuments, hasRetailDetailDocuments, canReview, canPay,
    retailReviewPending, reviewRetail, retailReviewNote, setRetailReviewNote,
    retailReviewError, onStartRetailPayment, formatDateTime, statusLabels, statusTone,
  } = props;
  return (
    <>
      <Modal
        open={Boolean(detailRequest)}
        onClose={() => setDetailRequest(null)}
        title="Detail Pengajuan Belanja"
        description={detailRequest ? `${String(detailRequest.nomor_pengajuan ?? "")} · ${String(detailRequest.nama_kegiatan ?? "")}` : undefined}
        size="lg"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={
          <Button variant="outline" onClick={() => setDetailRequest(null)}>
            Tutup
          </Button>
        }
      >
        {detailRequest && (
          <>
            <ModalSection title="Rincian pengajuan">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <p className="text-sm text-muted-foreground">Status saat ini</p>
                <StatusBadge status={statusTone(detailStatus)}>{statusLabels[detailStatus] ?? detailStatus}</StatusBadge>
              </div>
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Pemohon", detailRequest.pembuat?.nama ?? "—"],
                  ["Tanggal pengajuan", formatDateTime(detailRequest.diajukan_pada ?? detailRequest.created_at)],
                  ["Nama kegiatan", detailRequest.nama_kegiatan ?? "—"],
                  ["Nominal", formatRupiah(detailRequest.jumlah)],
                  ["Proyek", `${detailRequest.ro?.proyek?.kode_proyek ?? "—"} · ${detailRequest.ro?.proyek?.nama_proyek ?? "—"}`],
                  ["RO", `${detailRequest.ro?.kode_ro ?? "—"} · ${detailRequest.ro?.nama_ro ?? "—"}`],
                  ["Koordinator", detailRequest.ro?.unit_koordinator?.nama_unit ?? "—"],
                  ["MAK", `${detailRequest.ro?.mak?.kode_mak ?? "—"} · ${detailRequest.ro?.mak?.nama_mak ?? "—"}`],
                  ["Nomor kuitansi", detailRequest.no_kuitansi || "Belum dicantumkan"],
                  ["Keterangan", detailRequest.keterangan || "Tidak ada keterangan tambahan.", "sm:col-span-2"],
                ].map(([label, value, className]) => (
                  <div key={String(label)} className={`min-w-0 py-3 sm:border-b ${className ?? ""}`}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className={`mt-1 break-words text-sm ${label === "Nominal" ? "font-semibold tabular-nums text-foreground" : "text-foreground"}`}>
                      {value}
                      {label === "RO" && detailRequest.ro?.id && (
                        <Link
                          href={`/dashboard/ro/${encodeURIComponent(String(detailRequest.ro.id))}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          Lihat detail RO <ArrowUpRight size={13} />
                        </Link>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <DocumentLinks
                  documents={[
                    { label: "Bukti kuitansi", path: detailRequest.file_bukti },
                    { label: "Bukti pembayaran", path: detailRequest.pembayaran?.file_bukti },
                    { label: "RAB RO", path: detailRequest.ro?.file_rab },
                  ]}
                />
              </div>
            </ModalSection>

            <ModalSection title="Progress pengajuan" description="Checklist tahapan dari pengajuan sampai pembayaran oleh Bendahara.">
              <ol className="space-y-0">
                {detailSteps.map((step, index) => {
                  const StepIcon = step.state === "done" ? CircleCheck : step.state === "rejected" ? CircleX : step.state === "active" ? Clock3 : Circle;
                  const iconClass =
                    step.state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : step.state === "rejected"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : step.state === "active"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-400";
                  const stateLabel = step.state === "done" ? "Selesai" : step.state === "rejected" ? "Ditolak" : step.state === "active" ? "Sedang diproses" : step.state === "skipped" ? "Tidak dilanjutkan" : "Menunggu";
                  return (
                    <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < detailSteps.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-border" aria-hidden="true" />}
                      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${iconClass}`}>
                        <StepIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{step.title}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${step.state === "done" ? "bg-emerald-50 text-emerald-700" : step.state === "rejected" ? "bg-red-50 text-red-700" : step.state === "active" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {stateLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                        {index === 1 && detailRequest.catatan_pemeriksa && (
                          <p className="mt-2 rounded-md bg-muted/50 px-2.5 py-2 text-xs">
                            <strong>Catatan KARWAS:</strong> {String(detailRequest.catatan_pemeriksa)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ModalSection>

            {detailRequest.pembayaran && (
              <ModalSection title="Rincian pembayaran" description="Alokasi dana operasional yang dicatat Bendahara.">
                <ModalDetailGrid>
                  <ModalDetailItem label="Nomor pembayaran" value={detailRequest.pembayaran.nomor_pembayaran} />
                  <ModalDetailItem label="Dibayar oleh" value={detailRequest.pembayaran.pembayar?.nama ?? "Bendahara"} />
                  <ModalDetailItem label="Tanggal bayar" value={formatDateTime(detailRequest.pembayaran.tanggal_bayar)} />
                  <ModalDetailItem label="Total dibayar" value={formatRupiah(detailRequest.pembayaran.nominal)} />
                </ModalDetailGrid>
                {Array.isArray(detailRequest.pembayaran.alokasi_list) && detailRequest.pembayaran.alokasi_list.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {detailRequest.pembayaran.alokasi_list.map((allocation: Row) => (
                      <div key={String(allocation.id)} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm">
                        <span>
                          {String(allocation.dana_operasional?.kategori_kamar ?? "Dana operasional").replaceAll("_", " ")} · {String(allocation.dana_operasional?.unit_koordinator?.nama_unit ?? "Unit")}
                        </span>
                        <strong className="tabular-nums">{formatRupiah(allocation.nominal)}</strong>
                      </div>
                    ))}
                  </div>
                )}
                {detailRequest.pembayaran.catatan && <p className="mt-3 text-xs text-muted-foreground">Catatan Bendahara: {String(detailRequest.pembayaran.catatan)}</p>}
              </ModalSection>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={Boolean(retailDetailRequest)}
        onClose={() => setRetailDetailRequest(null)}
        title="Detail Pengajuan Belanja Retail"
        description={retailDetailRequest ? `${String(retailDetailRequest.nomor_pengajuan ?? "")} · ${String(retailDetailRequest.nama_kegiatan ?? "")}` : undefined}
        size="lg"
        bodyClassName="space-y-4 bg-slate-50/60"
        footer={
          <>
            {canReview && retailDetailStatus === "DIAJUKAN" && (
              <>
                <Button variant="destructive" disabled={retailReviewPending} onClick={() => reviewRetail(false)}>
                  {retailReviewPending && <LoaderCircle className="animate-spin" size={15} />} Tolak
                </Button>
                <Button disabled={retailReviewPending} onClick={() => reviewRetail(true)}>
                  {retailReviewPending && <LoaderCircle className="animate-spin" size={15} />} Setujui &amp; Reservasi OPS_KANTOR
                </Button>
              </>
            )}
            {canPay && retailDetailStatus === "DISETUJUI_KARWAS" && retailDetailRequest && (
              <Button
                onClick={() => onStartRetailPayment(retailDetailRequest)}
              >
                <CircleDollarSign size={15} /> Catat Pembayaran
              </Button>
            )}
            <Button variant="outline" onClick={() => setRetailDetailRequest(null)}>
              Tutup
            </Button>
          </>
        }
      >
        {retailDetailRequest && (
          <>
            <ModalSection title="Rincian pengajuan">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <p className="text-sm text-muted-foreground">Status saat ini</p>
                <StatusBadge status={statusTone(retailDetailStatus)}>{statusLabels[retailDetailStatus] ?? retailDetailStatus}</StatusBadge>
              </div>
              <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 sm:gap-x-8">
                {[
                  ["Nomor pengajuan", retailDetailRequest.nomor_pengajuan ?? "—"],
                  ["Diajukan oleh", retailDetailRequest.pembuat?.nama ?? "—"],
                  ["Tanggal pengajuan", formatDateTime(retailDetailRequest.diajukan_pada ?? retailDetailRequest.created_at)],
                  ["Tanggal kebutuhan", formatDateTime(retailDetailRequest.tanggal)],
                  ["Barang / kebutuhan", retailDetailRequest.nama_kegiatan ?? "—"],
                  ["Nominal pengajuan", formatRupiah(retailDetailRequest.jumlah)],
                  ["Order retail", `${retailDetailJob.nomor_job ?? "—"} · ${retailDetailJob.nama_pelanggan ?? "Klien belum tercatat"}`],
                  ["Unit pelaksana", retailDetailJob.unit_pelaksana?.nama_unit ?? "—"],
                  ["Tanda terima perconto", retailDetailJob.nomor_tanda_terima_perconto ?? "Belum dicatat"],
                  ["Nomor LHU", retailDetailJob.nomor_lhu ?? "Belum dicatat"],
                  ["Sumber dana", `${retailDetailRequest.dana?.kategori_kamar ?? "OPS_KANTOR"} · TA ${retailDetailRequest.dana?.tahun_fiscal ?? retailDetailJob.tahun_fiscal ?? "—"}`],
                  ["Saldo OPS_KANTOR tersedia", formatRupiah(retailDetailRequest.saldo_ops_tersedia)],
                  ["Nomor kuitansi", retailDetailRequest.no_kuitansi || "Belum dicantumkan"],
                  ["Keterangan", retailDetailRequest.keterangan || "Tidak ada keterangan tambahan.", "sm:col-span-2"],
                ].map(([label, value, className]) => (
                  <div key={String(label)} className={`min-w-0 py-3 sm:border-b ${className ?? ""}`}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className={`mt-1 break-words text-sm ${label === "Nominal pengajuan" || label === "Saldo OPS_KANTOR tersedia" ? "font-semibold tabular-nums text-foreground" : "text-foreground"}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              {retailDetailRequest.catatan_pemeriksa && (
                <p className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed">
                  <strong>Catatan KARWAS:</strong> {String(retailDetailRequest.catatan_pemeriksa)}
                </p>
              )}
            </ModalSection>

            <ModalSection title="Validasi KARWAS" description="Status pemeriksaan kebutuhan belanja dan reservasi saldo OPS_KANTOR.">
              <div
                className={`rounded-lg border px-3.5 py-3 text-sm ${retailDetailRejected ? "border-red-200 bg-red-50 text-red-900" : retailDetailStatus === "DIAJUKAN" ? "border-amber-200 bg-amber-50 text-amber-950" : retailDetailCanceled ? "border-slate-200 bg-slate-50 text-slate-700" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}
              >
                <p className="font-semibold">
                  {retailDetailStatus === "DIAJUKAN"
                    ? "Menunggu pemeriksaan KARWAS"
                    : retailDetailRejected
                      ? "Pengajuan ditolak KARWAS"
                      : retailDetailCanceled
                        ? "Pengajuan dibatalkan"
                        : retailDetailPaid
                          ? "Validasi selesai · pembayaran tercatat"
                          : "Disetujui KARWAS · menunggu pembayaran Bendahara"}
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  {retailDetailStatus === "DIAJUKAN"
                    ? "Bendahara dapat memproses pembayaran setelah KARWAS menyetujui pengajuan dan mereservasi saldo OPS_KANTOR."
                    : retailDetailRejected
                      ? `Ditolak${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : ""} pada ${formatDateTime(retailDetailRequest.diperiksa_pada)}.`
                      : retailDetailCanceled
                        ? "Pengajuan ini tidak diteruskan ke proses pembayaran."
                        : retailDetailPaid
                          ? `Disetujui${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : " oleh KARWAS"} pada ${formatDateTime(retailDetailRequest.diperiksa_pada)}.`
                          : `Disetujui${retailDetailRequest.pemeriksa?.nama ? ` oleh ${retailDetailRequest.pemeriksa.nama}` : " oleh KARWAS"} pada ${formatDateTime(retailDetailRequest.diperiksa_pada)}. Bendahara dapat melanjutkan pencatatan pembayaran.`}
                </p>
              </div>
              {canReview && retailDetailStatus === "DIAJUKAN" && (
                <>
                  <label className="grid gap-1.5 text-sm">
                    Catatan pemeriksa
                    <span className="text-xs text-muted-foreground">Opsional saat menyetujui, wajib diisi jika menolak.</span>
                    <textarea
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      maxLength={500}
                      value={retailReviewNote}
                      onChange={(event) => setRetailReviewNote(event.target.value)}
                      placeholder="Catatan pemeriksaan atau alasan penolakan"
                    />
                  </label>
                  {retailReviewError && (
                    <p role="alert" className="text-sm text-destructive">
                      {retailReviewError}
                    </p>
                  )}
                </>
              )}
            </ModalSection>

            <ModalSection title="Progress pengajuan" description="Tahapan pemeriksaan dan pembayaran pengajuan belanja retail.">
              <ol className="space-y-0">
                {retailDetailSteps.map((step, index) => {
                  const StepIcon = step.state === "done" ? CircleCheck : step.state === "rejected" ? CircleX : step.state === "active" ? Clock3 : Circle;
                  const iconClass =
                    step.state === "done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : step.state === "rejected"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : step.state === "active"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-white text-slate-400";
                  const stateLabel = step.state === "done" ? "Selesai" : step.state === "rejected" ? "Ditolak" : step.state === "active" ? "Sedang diproses" : step.state === "skipped" ? "Tidak dilanjutkan" : "Menunggu";
                  return (
                    <li key={step.title} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < retailDetailSteps.length - 1 && <span className="absolute left-4 top-8 bottom-0 w-px bg-border" aria-hidden="true" />}
                      <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${iconClass}`}>
                        <StepIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1 rounded-lg border bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold">{step.title}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${step.state === "done" ? "bg-emerald-50 text-emerald-700" : step.state === "rejected" ? "bg-red-50 text-red-700" : step.state === "active" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {stateLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </ModalSection>

            {retailDetailPaid && (
              <ModalSection title="Rincian pembayaran" description="Pembayaran pengajuan dicatat sebagai pengeluaran OPS_KANTOR.">
                <ModalDetailGrid>
                  <ModalDetailItem label="Nomor pembayaran" value={retailDetailRequest.nomor_pembayaran ?? "—"} />
                  <ModalDetailItem label="Dibayar oleh" value={retailDetailRequest.pembayar?.nama ?? "Bendahara"} />
                  <ModalDetailItem label="Tanggal bayar" value={formatDateTime(retailDetailRequest.tanggal_bayar)} />
                  <ModalDetailItem label="Nominal dibayar" value={formatRupiah(retailDetailRequest.jumlah)} />
                </ModalDetailGrid>
                {retailDetailRequest.catatan_pembayaran && <p className="mt-3 text-xs text-muted-foreground">Catatan Bendahara: {String(retailDetailRequest.catatan_pembayaran)}</p>}
              </ModalSection>
            )}

            <ModalSection title="Dokumen pendukung">{hasRetailDetailDocuments ? <DocumentLinks documents={retailDetailDocuments} /> : <p className="text-sm text-muted-foreground">Belum ada dokumen pendukung.</p>}</ModalSection>
          </>
        )}
      </Modal>
    </>
  );
}
