"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DocumentLinks } from "@/components/common/DocumentLinks";
import { DetailModal, type DetailSection } from "@/components/modal/DetailModal";
import { formatDate, formatRupiah } from "@/lib/hris/format";
import type { AnyRow } from "@/components/ro/ro-detail.types";

function display(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function formatDateTime(value: unknown) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function RoLedgerDetailModal({
  row,
  onClose,
  roName,
  projectName,
}: {
  row: AnyRow | null;
  onClose: () => void;
  roName: string;
  projectName: string;
}) {
  if (!row) return null;

  const isRequest = row.row_type === "PENGAJUAN_BELANJA";
  const requestId = String(row.pengajuan_belanja_id ?? "");
  const requestStatus = String(row.status ?? "DIAJUKAN");
  const sections: DetailSection[] = isRequest
    ? [
        {
          title: "Informasi pengajuan",
          items: [
            { label: "Nomor pengajuan", value: display(row.nomor_pengajuan) },
            { label: "Kegiatan / kebutuhan", value: display(row.nama_kegiatan) },
            { label: "RO", value: roName },
            { label: "Proyek", value: projectName },
            { label: "Nomor kuitansi", value: display(row.no_kuitansi) },
            { label: "Tanggal kebutuhan", value: formatDate(row.tanggal) },
            { label: "Nominal diajukan", value: formatRupiah(row.jumlah) },
            { label: "Status saat ini", value: requestStatus === "DISETUJUI_KARWAS" ? "Disetujui KARWAS - menunggu pembayaran" : "Menunggu pemeriksaan KARWAS" },
          ],
        },
        {
          title: "Riwayat pemeriksaan",
          items: [
            { label: "Dikirim pada", value: formatDateTime(row.diajukan_pada) },
            { label: "Ditinjau pada", value: formatDateTime(row.diperiksa_pada) },
            { label: "Catatan pemeriksa", value: display(row.catatan_pemeriksa) },
          ],
        },
      ]
    : [
        {
          title: "Informasi transaksi",
          items: [
            { label: "Kegiatan", value: display(row.nama_kegiatan) },
            { label: "Jenis transaksi", value: Number(row.debit) > 0 ? "Dana masuk - debit" : "Pengeluaran - kredit" },
            { label: "Tanggal transaksi", value: formatDate(row.tanggal) },
            { label: "Nomor kuitansi", value: display(row.no_kuitansi) },
            { label: "Dana masuk (debit)", value: Number(row.debit) > 0 ? formatRupiah(row.debit) : "-" },
            { label: "Pengeluaran (kredit)", value: Number(row.kredit) > 0 ? formatRupiah(row.kredit) : "-" },
            { label: "Saldo setelah transaksi", value: formatRupiah(row.saldo) },
            { label: "Dicatat pada", value: formatDateTime(row.created_at) },
          ],
        },
        {
          title: "Keterangan / rincian belanja",
          description: "Laporan membaca jumlah dan satuan dari keterangan transaksi ini bila formatnya tersedia.",
          columns: 1,
          items: [{ label: "Keterangan transaksi", value: <span className="whitespace-pre-wrap">{display(row.keterangan)}</span> }],
        },
      ];

  if (!isRequest && row.file_bukti) {
    sections.push({
      title: "Dokumen transaksi",
      columns: 1,
      items: [{ label: "Bukti transaksi", value: <DocumentLinks documents={[{ label: "Bukti transaksi", path: row.file_bukti }]} columns={1} /> }],
    });
  }

  return (
    <DetailModal
      open
      onClose={onClose}
      title={isRequest ? "Detail Pengajuan Belanja" : "Detail Transaksi RO"}
      description={isRequest ? `${display(row.nomor_pengajuan)} - ${display(row.nama_kegiatan)}` : `${display(row.nama_kegiatan)} - ${formatDate(row.tanggal)}`}
      sections={sections}
      size="lg"
      footer={
        <>
          {isRequest && requestId && (
            <Link className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted" href={`/dashboard/pengajuan-belanja?pengajuan_id=${encodeURIComponent(requestId)}`}>
              Buka detail pengajuan
            </Link>
          )}
          <Button variant="outline" onClick={onClose}>Tutup</Button>
        </>
      }
    />
  );
}
