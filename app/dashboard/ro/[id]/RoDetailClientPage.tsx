"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Edit, LoaderCircle, Plus, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { MoneyInput } from "@/components/ui/money-input";
import { DataTable } from "@/components/table";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, unwrapEnvelope, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, roStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { RoItemDto, UpdateRoDto } from "@/lib/api/generated/api-generated";

type AnyRow = Record<string, unknown>;
type EditForm = { nama_ro: string; total_plafon: string; no_kontrak: string; pj: string; no_sk: string; mulai_sk: string; berakhir_sk: string; status_ro: "AKTIF" | "NONAKTIF" | "SELESAI" };
type TransactionForm = { nama_kegiatan: string; no_kuitansi: string; tanggal: string; debit: string; kredit: string; keterangan: string };
type TransactionDirection = "debit" | "kredit";
const emptyEdit = (): EditForm => ({ nama_ro: "", total_plafon: "", no_kontrak: "", pj: "", no_sk: "", mulai_sk: "", berakhir_sk: "", status_ro: "AKTIF" });
const emptyTransaction = (): TransactionForm => ({ nama_kegiatan: "", no_kuitansi: "", tanggal: new Date().toISOString().slice(0, 10), debit: "", kredit: "", keterangan: "" });
function missing(row: RoItemDto) {
  return [!row.no_kontrak && "No Kontrak", !row.pj && "PJ", !row.no_sk && "No SK", !row.mulai_sk && "Mulai SK", !row.berakhir_sk && "Berakhir SK"].filter(Boolean);
}

export default function RoDetailClientPage({ id }: { id: string }) {
  const identity = useMemo(browserIdentity, []);
  const canManage = identity.role === "superadmin" || identity.role === "koordinator";
  const [tab, setTab] = useState<"ledger" | "alokasi">("ledger");
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<EditForm>(emptyEdit);
  const [rabFile, setRabFile] = useState<File | null>(null);
  const [skFile, setSkFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState<"rab" | "sk" | null>(null);
  const [notice, setNotice] = useState("");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transaction, setTransaction] = useState<TransactionForm>(emptyTransaction);
  const [transactionDirection, setTransactionDirection] = useState<TransactionDirection>("kredit");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [deleteTransaction, setDeleteTransaction] = useState<AnyRow | null>(null);
  const [confirmSilpa, setConfirmSilpa] = useState(false);
  const detail = use_query({
    tag: "masterRo",
    method: "detail",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRo.roControllerGetDetail(id);
    },
  });
  const ledger = use_query({
    tag: "masterRo",
    method: "ledger",
    params: { id },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRo.roControllerGetLedger(id);
    },
  });
  const ro = envelopeData<RoItemDto>(detail.data);
  const ledgerBody = envelopeData<AnyRow>(ledger.data) ?? {};
  const ledgerRows = Array.isArray(ledgerBody.list) ? (ledgerBody.list as AnyRow[]) : [];
  const allocations = Array.isArray((ro as unknown as AnyRow)?.alokasi_list) ? ((ro as unknown as AnyRow).alokasi_list as AnyRow[]) : [];
  const refresh = async () => Promise.all([detail.refetch(), ledger.refetch()]);
  const update = use_mutation({
    tag: "masterRo",
    method: "update",
    mutationFn: async (data: UpdateRoDto) => {
      setBrowserToken();
      return browserApi.masterRo.roControllerUpdate(id, data);
    },
    onSuccess: async () => {
      await refresh();
      setEditOpen(false);
      setNotice("");
    },
  });
  const silpa = use_mutation({
    tag: "masterRo",
    method: "silpa",
    mutationFn: async () => {
      setBrowserToken();
      return browserApi.masterRo.roControllerCarryoverSilpa(id);
    },
    onSuccess: async () => {
      setConfirmSilpa(false);
      await refresh();
    },
  });
  const saveTransaction = use_mutation({
    tag: "masterRoTransaksi",
    method: "save",
    mutationFn: async () => {
      setBrowserToken();
      const amount = transactionDirection === "debit" ? transaction.debit : transaction.kredit;
      const payload = {
        nama_kegiatan: transaction.nama_kegiatan,
        no_kuitansi: transaction.no_kuitansi || undefined,
        tanggal: transaction.tanggal,
        debit: transactionDirection === "debit" && amount ? Number(amount) : 0,
        kredit: transactionDirection === "kredit" && amount ? Number(amount) : 0,
        keterangan: transaction.keterangan || undefined,
      };
      return transactionId ? browserApi.masterRoTransaksi.roTransaksiControllerUpdate(id, transactionId, payload) : browserApi.masterRoTransaksi.roTransaksiControllerCreate(id, payload);
    },
    onSuccess: async () => {
      setTransactionOpen(false);
      setTransactionId(null);
      await refresh();
    },
  });
  const removeTransaction = use_mutation({
    tag: "masterRoTransaksi",
    method: "remove",
    mutationFn: async () => {
      if (!deleteTransaction?.id) throw new Error("ID transaksi tidak tersedia.");
      setBrowserToken();
      return browserApi.masterRoTransaksi.roTransaksiControllerRemove(String(deleteTransaction.id), id);
    },
    onSuccess: async () => {
      setDeleteTransaction(null);
      await refresh();
    },
  });
  function openEdit() {
    if (!ro) return;
    setEdit({
      nama_ro: ro.nama_ro ?? "",
      total_plafon: String((ro as RoItemDto & { nilai_rencana?: number }).nilai_rencana ?? ro.total_plafon ?? ""),
      no_kontrak: String(ro.no_kontrak ?? ""),
      pj: String(ro.pj ?? ""),
      no_sk: String(ro.no_sk ?? ""),
      mulai_sk: String(ro.mulai_sk ?? "").slice(0, 10),
      berakhir_sk: String(ro.berakhir_sk ?? "").slice(0, 10),
      status_ro: (ro.status_ro as EditForm["status_ro"]) ?? "AKTIF",
    });
    setNotice("");
    setEditOpen(true);
  }
  async function saveEdit() {
    const plannedAmount = Number((ro as (RoItemDto & { nilai_rencana?: number }) | undefined)?.nilai_rencana ?? ro?.total_plafon ?? 0);
    if (!edit.nama_ro.trim() || plannedAmount <= 0) {
      setNotice("Nama RO wajib diisi dan plafon awal proyek harus lebih dari Rp0.");
      return;
    }
    if (edit.mulai_sk && edit.berakhir_sk && edit.berakhir_sk < edit.mulai_sk) {
      setNotice("Berakhir SK tidak boleh sebelum Mulai SK.");
      return;
    }
    try {
      const { total_plafon: _lockedPlan, ...metadata } = edit;
      await update.mutateAsync({
        ...metadata,
        no_kontrak: edit.no_kontrak || undefined,
        pj: edit.pj || undefined,
        no_sk: edit.no_sk || undefined,
        mulai_sk: edit.mulai_sk || undefined,
        berakhir_sk: edit.berakhir_sk || undefined,
      });
    } catch (error) {
      setNotice(apiErrorMessage(error, "Gagal memperbarui RO. RO dari proyek dapat ditolak backend; periksa pesan ini."));
    }
  }
  function openTransaction(row?: AnyRow) {
    setTransactionId(row?.id ? String(row.id) : null);
    setTransactionDirection(Number(row?.debit) > 0 ? "debit" : "kredit");
    setTransaction({
      nama_kegiatan: String(row?.nama_kegiatan ?? ""),
      no_kuitansi: String(row?.no_kuitansi ?? ""),
      tanggal: String(row?.tanggal ?? new Date().toISOString()).slice(0, 10),
      debit: row?.debit ? String(row.debit) : "",
      kredit: row?.kredit ? String(row.kredit) : "",
      keterangan: String(row?.keterangan ?? ""),
    });
    setNotice("");
    setTransactionOpen(true);
  }
  async function submitTransaction() {
    if (!transaction.nama_kegiatan || !transaction.tanggal) {
      setNotice("Nama kegiatan dan tanggal transaksi wajib diisi.");
      return;
    }
    const amount = transactionDirection === "debit" ? transaction.debit : transaction.kredit;
    if (!amount || Number(amount) <= 0) {
      setNotice("Nominal transaksi harus lebih dari Rp0.");
      return;
    }
    if (Number(amount) < 0) {
      setNotice("Nominal transaksi tidak boleh negatif.");
      return;
    }
    try {
      const result = await saveTransaction.mutateAsync();
      if (receiptFile) {
        const response = result as unknown as AnyRow;
        const body = (response.data ?? response) as AnyRow;
        const savedId = String(body.id ?? transactionId ?? "");
        if (!savedId) throw new Error("ID transaksi tidak ditemukan untuk menyimpan bukti.");
        setReceiptUploading(true);
        await uploadHrisFile(`/api/ro/${id}/transaksi/${savedId}/dokumen`, receiptFile);
      }
      setTransactionOpen(false);
      setTransactionId(null);
      setReceiptFile(null);
      await refresh();
    } catch (error) {
      setNotice(apiErrorMessage(error, "Gagal menyimpan transaksi atau bukti."));
    } finally {
      setReceiptUploading(false);
    }
  }
  async function upload(kind: "rab" | "sk") {
    const selectedFile = kind === "rab" ? rabFile : skFile;
    if (!selectedFile) {
      setNotice("Pilih dokumen lebih dulu.");
      return;
    }
    try {
      setUploadKind(kind);
      await uploadHrisFile(`/api/ro/${id}/${kind}`, selectedFile);
      if (kind === "rab") setRabFile(null);
      else setSkFile(null);
      setNotice("");
      await refresh();
    } catch (error) {
      setNotice(apiErrorMessage(error, "Unggah dokumen gagal."));
    } finally {
      setUploadKind(null);
    }
  }
  if (detail.isLoading) return <div className="p-6 text-sm text-muted-foreground">Memuat RO...</div>;
  if (!ro)
    return (
      <div className="space-y-4 p-6">
        <Alert variant="destructive">
          <AlertTitle>RO tidak ditemukan</AlertTitle>
          <AlertDescription>{detail.error ? apiErrorMessage(detail.error) : "Data RO tidak tersedia."}</AlertDescription>
        </Alert>
        <Button variant="outline" render={<Link href="/dashboard/ro" />}>
          <ArrowLeft size={16} /> Kembali
        </Button>
      </div>
    );
  const incomplete = missing(ro);
  const plannedPlafon = Number((ro as RoItemDto & { nilai_rencana?: number }).nilai_rencana) || Number(ro.total_plafon) || 0;
  const totalPlafon = Number(ro.total_plafon) || 0;
  const totalUsed = Number(ro.total_terpakai) || 0;
  const balance = Number(ro.sisa_saldo ?? totalPlafon - totalUsed);
  const percent = totalPlafon ? Math.min(100, (totalUsed / totalPlafon) * 100) : 0;
  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/ro" />}>
            <ArrowLeft size={16} /> Semua RO
          </Button>
          <h1 className="text-2xl font-bold">{ro.nama_ro}</h1>
          <p className="text-sm text-muted-foreground">
            {String(ro.kode_mak ?? ro.kode_ro)} · Tahun {ro.tahun_fiscal} · {String(ro.nama_proyek ?? "—")}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={roStatusTone(ro.status_ro)}>{ro.status_ro ?? "—"}</StatusBadge>
          {canManage && (
            <Button variant="outline" onClick={openEdit}>
              <Edit size={16} /> {incomplete.length ? "Lengkapi RO" : "Ubah RO"}
            </Button>
          )}
        </div>
      </header>
      {incomplete.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTitle>Data RO belum lengkap</AlertTitle>
          <AlertDescription className="text-amber-800">
            {incomplete.join(", ")}. Lengkapi melalui tombol <strong>Lengkapi RO</strong> sebelum RO dipakai.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">Alokasi Rencana</p>
          <p className="mt-1 text-lg font-semibold">{formatRupiah(plannedPlafon)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Anggaran awal proyek untuk RO ini</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dana Tersedia</p>
          <p className="mt-1 text-lg font-semibold">{formatRupiah(balance)}</p>
          <p className={`mt-1 text-xs ${totalPlafon > 0 ? "text-emerald-700" : "text-amber-700"}`}>{totalPlafon > 0 ? "Saldo setelah memperhitungkan pengeluaran" : "Belum ada termin dicairkan"}</p>
          <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Pengeluaran</p>
          <p className="mt-1 text-lg font-semibold text-destructive">{formatRupiah(totalUsed)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Sisa tersedia {formatRupiah(balance)}</p>
        </div>
      </div>
      <section className="grid gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:grid-cols-3">
        <p>
          <span className="block text-xs text-muted-foreground">Unit Koordinator</span>
          {String(ro.nama_unit_koordinator ?? "—")}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">No Kontrak / PJ</span>
          {String(ro.no_kontrak ?? "—")} / {String(ro.pj ?? "—")}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">SK</span>
          {String(ro.no_sk ?? "—")} · {formatDate(ro.mulai_sk)} – {formatDate(ro.berakhir_sk)}
        </p>
      </section>
      {canManage && (
        <section className="grid gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:grid-cols-2">
          <DocumentUploadField
            label="Dokumen RAB"
            accept=".pdf,.xls,.xlsx"
            value={rabFile}
            onChange={setRabFile}
            onUpload={() => upload("rab")}
            currentFile={typeof ro.file_rab === "string" ? ro.file_rab : null}
            pending={uploadKind === "rab"}
            disabled={uploadKind !== null && uploadKind !== "rab"}
          />
          <DocumentUploadField
            label="Dokumen SK"
            accept=".pdf"
            value={skFile}
            onChange={setSkFile}
            onUpload={() => upload("sk")}
            currentFile={typeof ro.file_sk === "string" ? ro.file_sk : null}
            pending={uploadKind === "sk"}
            disabled={uploadKind !== null && uploadKind !== "sk"}
          />
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b bg-muted/40">
          <div className="flex">
            <button className={`px-4 py-3 text-sm font-medium ${tab === "ledger" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("ledger")}>
              Ledger ({ledgerRows.length})
            </button>
            <button className={`px-4 py-3 text-sm font-medium ${tab === "alokasi" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("alokasi")}>
              Alokasi Gaji ({allocations.length})
            </button>
          </div>
        </div>
        <div className="p-5">
          {tab === "ledger" ? (
            <DataTable
              title="Riwayat Arus Kas RO"
              rows={ledgerRows}
              rowKey={(row, index) => String(row.id ?? index)}
              emptyMessage="Belum ada transaksi ledger."
              searchPlaceholder="Cari tanggal, kegiatan, atau kuitansi..."
              columns={[
                { key: "tanggal", header: "Tanggal", render: (row) => formatDate(row.tanggal) },
                { key: "nama_kegiatan", header: "Kegiatan", render: (row) => String(row.nama_kegiatan ?? "—") },
                { key: "no_kuitansi", header: "Kuitansi", render: (row) => String(row.no_kuitansi ?? "—") },
                { key: "debit", header: "Debit", className: "text-right tabular-nums", render: (row) => Number(row.debit) ? formatRupiah(row.debit) : "—" },
                { key: "kredit", header: "Kredit", className: "text-right tabular-nums", render: (row) => Number(row.kredit) ? formatRupiah(row.kredit) : "—" },
                { key: "saldo", header: "Saldo", className: "text-right tabular-nums", render: (row) => formatRupiah(row.saldo) },
                ...(canManage ? [{ key: "aksi", header: "Aksi", render: (row: AnyRow) => (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openTransaction(row)}>Ubah</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTransaction(row)}>Hapus</Button>
                  </div>
                ) }] : []),
              ]}
            />
          ) : (
            <DataTable
              title="Daftar Alokasi Gaji"
              rows={allocations}
              rowKey={(row, index) => String(row.id ?? index)}
              emptyMessage="Belum ada alokasi gaji."
              searchPlaceholder="Cari pegawai atau status..."
              columns={[
                { key: "pegawai", header: "Pegawai", render: (row) => String(row.nama_pegawai ?? (row.pegawai as AnyRow | undefined)?.nama ?? "—") },
                { key: "status", header: "Status", render: (row) => String(row.status ?? "—") },
                { key: "nominal", header: "Nilai", className: "text-right tabular-nums", render: (row) => formatRupiah(row.nominal ?? row.nilai) },
              ]}
            />
          )}
        </div>
      </section>
      {identity.role === "superadmin" && ro.status_ro === "AKTIF" && !ro.parent_ro_id && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <p className="font-medium">SILPA</p>
          <p className="mt-1 text-sm text-muted-foreground">Tutup RO aktif dan buat RO tahun fiskal berikutnya pada proyek sama. Jumlah mengikuti aturan backend.</p>
          <Button className="mt-3" variant="outline" disabled={silpa.isPending} onClick={() => setConfirmSilpa(true)}>
            {silpa.isPending && <LoaderCircle className="animate-spin" size={16} />} Tutup & Bawa SILPA
          </Button>
          {silpa.error && <p className="mt-2 text-sm text-destructive">{apiErrorMessage(silpa.error)}</p>}
        </section>
      )}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Ubah RO"
        description="Aksi tetap tersedia untuk koordinator. Backend menentukan perubahan RO dari proyek boleh atau tidak."
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button disabled={update.isPending} onClick={saveEdit}>
              {update.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          {notice && (
            <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
              <AlertTitle>Periksa data RO</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <label className="grid gap-1 text-sm">
            Nama RO
            <Input value={edit.nama_ro} onChange={(event) => setEdit((state) => ({ ...state, nama_ro: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Plafon awal proyek (terkunci)
            <Input type="number" value={String((ro as RoItemDto & { nilai_rencana?: number }).nilai_rencana ?? ro?.total_plafon ?? edit.total_plafon)} readOnly aria-readonly="true" />
            <span className="text-xs text-muted-foreground">Pencairan termin dapat menambah saldo; nilai awal tidak dapat diubah.</span>
          </label>
          <label className="grid gap-1 text-sm">
            No Kontrak
            <Input value={edit.no_kontrak} onChange={(event) => setEdit((state) => ({ ...state, no_kontrak: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            PJ
            <Input value={edit.pj} onChange={(event) => setEdit((state) => ({ ...state, pj: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            No SK
            <Input value={edit.no_sk} onChange={(event) => setEdit((state) => ({ ...state, no_sk: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Mulai SK
            <Input type="date" value={edit.mulai_sk} onChange={(event) => setEdit((state) => ({ ...state, mulai_sk: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Berakhir SK
            <Input type="date" value={edit.berakhir_sk} onChange={(event) => setEdit((state) => ({ ...state, berakhir_sk: event.target.value }))} />
          </label>
        </div>
      </Modal>
      <Modal
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        title={transactionId ? "Ubah Transaksi" : "Tambah Transaksi"}
        description={transactionId ? "Ubah detail mutasi saldo RO." : "Pilih jenis transaksi. Pengeluaran mengurangi saldo; dana masuk menambah saldo."}
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setTransactionOpen(false)}>
              Batal
            </Button>
            <Button disabled={saveTransaction.isPending} onClick={submitTransaction}>
              {saveTransaction.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {notice && (
            <Alert variant="destructive" className="sm:col-span-2 border-destructive/40 bg-destructive/5">
              <AlertTitle>Transaksi belum tersimpan</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nama kegiatan
            <Input value={transaction.nama_kegiatan} onChange={(event) => setTransaction((state) => ({ ...state, nama_kegiatan: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal
            <Input type="date" value={transaction.tanggal} onChange={(event) => setTransaction((state) => ({ ...state, tanggal: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            No kuitansi
            <Input value={transaction.no_kuitansi} onChange={(event) => setTransaction((state) => ({ ...state, no_kuitansi: event.target.value }))} />
          </label>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">Jenis transaksi</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={transactionDirection === "kredit"}
                onClick={() => {
                  setTransactionDirection("kredit");
                  setTransaction((state) => ({ ...state, debit: "" }));
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${transactionDirection === "kredit" ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20" : "hover:bg-muted/50"}`}
              >
                <span className="block font-semibold">Pengeluaran · Kurangi saldo</span>
                <span className="mt-1 block text-xs text-muted-foreground">Pembelian, pembayaran, atau biaya kegiatan</span>
              </button>
              <button
                type="button"
                aria-pressed={transactionDirection === "debit"}
                onClick={() => {
                  setTransactionDirection("debit");
                  setTransaction((state) => ({ ...state, kredit: "" }));
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${transactionDirection === "debit" ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "hover:bg-muted/50"}`}
              >
                <span className="block font-semibold">Dana masuk · Tambah saldo</span>
                <span className="mt-1 block text-xs text-muted-foreground">Pencairan atau pengembalian dana</span>
              </button>
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm sm:col-span-2">
            {transactionDirection === "kredit" ? "Nominal pengeluaran (mengurangi saldo)" : "Nominal dana masuk (menambah saldo)"}
            <MoneyInput
              value={transactionDirection === "kredit" ? transaction.kredit : transaction.debit}
              onValueChange={(value) => setTransaction((state) => (transactionDirection === "kredit" ? { ...state, kredit: value, debit: "" } : { ...state, debit: value, kredit: "" }))}
            />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Keterangan
            <Input value={transaction.keterangan} onChange={(event) => setTransaction((state) => ({ ...state, keterangan: event.target.value }))} />
          </label>
          <DocumentUploadField
            className="sm:col-span-2"
            label="Unggah bukti transaksi (PDF/JPG/PNG, maks. 10 MB)"
            accept=".pdf,.jpg,.jpeg,.png"
            value={receiptFile}
            onChange={setReceiptFile}
            currentFile={String(ledgerRows.find((row) => String(row.id) === transactionId)?.file_bukti ?? "") || null}
            disabled={saveTransaction.isPending || receiptUploading}
          />
        </div>
      </Modal>
      <AlertDialog open={Boolean(deleteTransaction)} onOpenChange={(open) => !open && setDeleteTransaction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Transaksi “{String(deleteTransaction?.nama_kegiatan ?? "")}” akan dihapus permanen dari ledger RO.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={removeTransaction.isPending} onClick={() => removeTransaction.mutate()}>
              {removeTransaction.isPending && <LoaderCircle className="animate-spin" size={16} />} Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmSilpa} onOpenChange={setConfirmSilpa}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tutup RO dan bawa SILPA?</AlertDialogTitle>
            <AlertDialogDescription>Backend akan menentukan nilai SILPA dan membuat RO lanjutan sesuai aturan aktif. Aksi ini dapat mengubah status RO sekarang.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={silpa.isPending} onClick={() => silpa.mutate()}>
              {silpa.isPending && <LoaderCircle className="animate-spin" size={16} />} Lanjutkan SILPA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
