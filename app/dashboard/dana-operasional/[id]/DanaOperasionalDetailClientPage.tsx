"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/table/DataTable";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData } from "@/lib/hris/api";
import { formatDate, formatRupiah } from "@/lib/hris/format";
import type { DanaOperasionalItemDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, unknown>;
type Detail = DanaOperasionalItemDto &
  Row & {
    unit_koordinator?: { id?: string; nama_unit?: string } | null;
    rekening?: { id?: string; nama_bank?: string; nomor_rekening?: string; nama_rekening?: string } | null;
    transaksi_list?: Row[];
    alokasi_list?: Row[];
    total_debit?: number;
    total_kredit?: number;
    saldo_ledger?: number;
  };
const categoryLabels: Record<string, string> = {
  P1_PNS_NON_PNS: "P1 PNS / Non-PNS",
  P2_KP3: "P2 KP3",
  OPS_KANTOR: "OPS Kantor",
  OPS_KP3: "OPS KP3",
  MULOS_SPI: "Mulos / SPI",
  LAINNYA: "Lainnya",
};
const text = (value: unknown) => (value == null || value === "" ? "—" : String(value));

export default function DanaOperasionalDetailClientPage({ id }: { id: string }) {
  const detailQuery = use_query({
    tag: "masterDanaOperasional",
    method: "detail",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterDanaOperasional.danaOperasionalControllerGetDetail(id);
    },
  });
  const ledgerQuery = use_query({
    tag: "masterDanaOperasional",
    method: "ledger",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterDanaOperasional.danaOperasionalControllerGetLedger(id);
    },
  });
  const detail = envelopeData<Detail>(detailQuery.data);
  const ledger = envelopeData<Row>(ledgerQuery.data) ?? {};
  const transactions = (Array.isArray(ledger.list) ? ledger.list : (detail?.transaksi_list ?? [])) as Row[];
  const allocations = detail?.alokasi_list ?? [];
  const totalPlafon = Number(detail?.total_plafon ?? 0);
  const totalDebit = Number(ledger.total_debit ?? detail?.total_debit ?? 0);
  const totalKredit = Number(ledger.total_kredit ?? detail?.total_kredit ?? 0);
  const balance = Number(detail?.sisa_saldo ?? detail?.saldo_ledger ?? ledger.saldo_ledger ?? totalPlafon);
  const spent = Number(detail?.total_terpakai ?? totalKredit);
  const spentPercent = totalPlafon > 0 ? Math.min(100, (spent / totalPlafon) * 100) : 0;
  const ledgerColumns = useMemo(
    () => [
      { key: "tanggal", header: "Tanggal", render: (row: Row) => formatDate(text(row.tanggal)) },
      {
        key: "nama_kegiatan",
        header: "Uraian Transaksi",
        render: (row: Row) => (
          <div>
            <p className="font-medium">{text(row.nama_kegiatan)}</p>
            <p className="text-xs text-muted-foreground">{text(row.no_kuitansi)}</p>
          </div>
        ),
      },
      {
        key: "proyek",
        header: "Referensi Proyek",
        render: (row: Row) => {
          const project = row.proyek as Row | null;
          return project ? `${text(project.kode_proyek)} · ${text(project.nama_proyek)}` : "—";
        },
      },
      { key: "debit", header: "Debit", className: "text-right", render: (row: Row) => formatRupiah(row.debit) },
      { key: "kredit", header: "Kredit", className: "text-right", render: (row: Row) => formatRupiah(row.kredit) },
      { key: "saldo", header: "Saldo Berjalan", className: "text-right font-semibold", render: (row: Row) => formatRupiah(row.saldo) },
      { key: "keterangan", header: "Keterangan", render: (row: Row) => text(row.keterangan) },
    ],
    [],
  );
  const allocationColumns = useMemo(
    () => [
      {
        key: "pegawai",
        header: "Pegawai",
        render: (row: Row) => {
          const pegawai = row.pegawai as Row | null;
          return text(pegawai?.nama);
        },
      },
      {
        key: "nip",
        header: "NIP / NIK",
        render: (row: Row) => {
          const pegawai = row.pegawai as Row | null;
          return text(pegawai?.nip_nik);
        },
      },
      { key: "jumlah", header: "Jumlah Alokasi", className: "text-right", render: (row: Row) => formatRupiah(row.jumlah ?? row.nominal) },
      { key: "status", header: "Status", render: (row: Row) => text(row.status) },
      { key: "tanggal", header: "Tanggal", render: (row: Row) => formatDate(text(row.created_at)) },
    ],
    [],
  );

  if (detailQuery.isLoading) return <div className="p-6 text-sm text-muted-foreground">Memuat detail dana operasional…</div>;
  if (!detail)
    return (
      <section className="hris-page space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Dana operasional tidak ditemukan</AlertTitle>
          <AlertDescription>{detailQuery.error ? apiErrorMessage(detailQuery.error) : "Data detail tidak tersedia."}</AlertDescription>
        </Alert>
        <Button variant="outline" render={<Link href="/dashboard/dana-operasional" />}>
          <ArrowLeft size={16} /> Kembali
        </Button>
      </section>
    );

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/dana-operasional" />}>
            <ArrowLeft size={16} /> Semua Dana Operasional
          </Button>
          <h1 className="text-2xl font-bold">{categoryLabels[String(detail.kategori_kamar)] ?? "Dana Operasional"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(detail.nama_unit_koordinator ?? detail.unit_koordinator?.nama_unit)} · Tahun fiskal {detail.tahun_fiscal}
          </p>
        </div>
        <div className="rounded-full border px-3 py-1 text-sm font-semibold">{categoryLabels[String(detail.kategori_kamar)] ?? text(detail.kategori_kamar)}</div>
      </header>
      {detailQuery.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat detail</AlertTitle>
          <AlertDescription>{apiErrorMessage(detailQuery.error)}</AlertDescription>
        </Alert>
      )}
      {ledgerQuery.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat ledger</AlertTitle>
          <AlertDescription>{apiErrorMessage(ledgerQuery.error)}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5" style={{ padding: 20 }}>
            <p className="mb-2 text-sm text-muted-foreground">Total Plafon</p>
            <p className="mt-2 text-xl font-bold">{formatRupiah(totalPlafon)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tahun fiskal {detail.tahun_fiscal}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5" style={{ padding: 20 }}>
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownLeft size={15} /> Total Debit
            </p>
            <p className="mt-2 text-xl font-bold">{formatRupiah(totalDebit)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dana masuk ke saldo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5" style={{ padding: 20 }}>
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight size={15} /> Total Kredit / Terpakai
            </p>
            <p className="mt-2 text-xl font-bold">{formatRupiah(spent)}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${spentPercent}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{spentPercent.toFixed(1)}% dari plafond</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5" style={{ padding: 20 }}>
            <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet size={15} /> Sisa Saldo
            </p>
            <p className="mt-2 text-xl font-bold">{formatRupiah(balance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Saldo tersedia saat ini</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5" style={{ padding: 20 }}>
          <h2 className="mb-4 text-lg font-semibold">Informasi Dana</h2>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Unit Koordinator</dt>
              <dd className="mt-1 font-medium">{text(detail.nama_unit_koordinator ?? detail.unit_koordinator?.nama_unit)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Kategori Kamar</dt>
              <dd className="mt-1 font-medium">{categoryLabels[String(detail.kategori_kamar)] ?? text(detail.kategori_kamar)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tahun Fiskal</dt>
              <dd className="mt-1 font-medium">{detail.tahun_fiscal}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Rekening Sumber</dt>
              <dd className="mt-1 font-medium">
                {text(detail.nama_rekening ?? detail.rekening?.nama_rekening)}
                {(detail.nomor_rekening ?? detail.rekening?.nomor_rekening) ? ` · ${text(detail.nomor_rekening ?? detail.rekening?.nomor_rekening)}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Dibuat</dt>
              <dd className="mt-1 font-medium">{formatDate(text(detail.created_at))}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Terakhir Diperbarui</dt>
              <dd className="mt-1 font-medium">{formatDate(text(detail.updated_at))}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5" style={{ padding: 20 }}>
          <DataTable
            title="Ledger Transaksi"
            columns={ledgerColumns}
            rows={transactions}
            rowKey={(row, index) => String(row.id ?? index)}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            emptyMessage="Belum ada transaksi pada dana ini."
            searchPlaceholder="Cari transaksi…"
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5" style={{ padding: 20 }}>
          <DataTable
            title="Alokasi Gaji Aktif"
            columns={allocationColumns}
            rows={allocations}
            rowKey={(row, index) => String(row.id ?? index)}
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            emptyMessage="Belum ada alokasi gaji aktif."
            searchPlaceholder="Cari pegawai…"
          />
        </CardContent>
      </Card>
    </section>
  );
}
