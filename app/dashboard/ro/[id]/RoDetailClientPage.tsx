"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Edit, LoaderCircle, Plus, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
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
  const [transactionId, setTransactionId] = useState<string | null>(null);
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
      const payload = {
        nama_kegiatan: transaction.nama_kegiatan,
        no_kuitansi: transaction.no_kuitansi || undefined,
        tanggal: transaction.tanggal,
        debit: transaction.debit ? Number(transaction.debit) : undefined,
        kredit: transaction.kredit ? Number(transaction.kredit) : undefined,
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
      total_plafon: String(ro.total_plafon ?? ""),
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
    if (!edit.nama_ro || Number(edit.total_plafon) <= 0) {
      setNotice("Nama RO dan plafon lebih dari Rp0 wajib diisi.");
      return;
    }
    if (edit.mulai_sk && edit.berakhir_sk && edit.berakhir_sk < edit.mulai_sk) {
      setNotice("Berakhir SK tidak boleh sebelum Mulai SK.");
      return;
    }
    try {
      await update.mutateAsync({
        ...edit,
        total_plafon: Number(edit.total_plafon),
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
      setNotice("Kegiatan dan tanggal transaksi wajib diisi.");
      return;
    }
    if (Number(transaction.debit || 0) < 0 || Number(transaction.kredit || 0) < 0) {
      setNotice("Debit dan kredit tidak boleh negatif.");
      return;
    }
    try {
      await saveTransaction.mutateAsync();
    } catch (error) {
      setNotice(apiErrorMessage(error, "Gagal menyimpan transaksi."));
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
  const totalPlafon = Number(ro.total_plafon) || 0;
  const totalUsed = Number(ro.total_terpakai) || 0;
  const balance = Number(ro.sisa_saldo ?? totalPlafon - totalUsed);
  const percent = totalPlafon ? Math.min(100, (totalUsed / totalPlafon) * 100) : 0;
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2" render={<Link href="/dashboard/ro" />}>
            <ArrowLeft size={16} /> Semua RO
          </Button>
          <h1 className="text-2xl font-semibold">{ro.nama_ro}</h1>
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
      </div>
      {incomplete.length > 0 && (
        <Alert>
          <AlertTitle>Data RO belum lengkap</AlertTitle>
          <AlertDescription>{incomplete.join(", ")}. Lengkapi sebelum RO dipakai.</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant="destructive">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Plafon Awal</p>
          <p className="mt-1 text-lg font-semibold">{formatRupiah(totalPlafon)}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
          <p className="mt-1 text-lg font-semibold text-destructive">{formatRupiah(totalUsed)}</p>
          <div className="mt-2 h-2 overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-xs text-muted-foreground">Sisa Saldo</p>
          <p className="mt-1 text-lg font-semibold">{formatRupiah(balance)}</p>
        </div>
      </div>
      <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3">
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
        <section className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            Dokumen RAB (PDF/XLS/XLSX)
            <Input type="file" accept=".pdf,.xls,.xlsx" onChange={(event) => setRabFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="flex items-end">
            <Button disabled={!rabFile || uploadKind !== null} onClick={() => upload("rab")}>
              {uploadKind === "rab" && <LoaderCircle size={16} className="animate-spin" />} <Upload size={16} /> Upload RAB
            </Button>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Dokumen SK (PDF)
            <Input type="file" accept=".pdf" onChange={(event) => setSkFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="flex items-end">
            <Button disabled={!skFile || uploadKind !== null} onClick={() => upload("sk")}>
              {uploadKind === "sk" && <LoaderCircle size={16} className="animate-spin" />} <Upload size={16} /> Upload SK
            </Button>
          </div>
        </section>
      )}
      <section className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b">
          <div className="flex">
            <button className={`px-4 py-3 text-sm font-medium ${tab === "ledger" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("ledger")}>
              Ledger ({ledgerRows.length})
            </button>
            <button className={`px-4 py-3 text-sm font-medium ${tab === "alokasi" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("alokasi")}>
              Alokasi Gaji ({allocations.length})
            </button>
          </div>
          {canManage && tab === "ledger" && (
            <Button size="sm" className="mr-3" onClick={() => openTransaction()}>
              <Plus size={16} /> Transaksi
            </Button>
          )}
        </div>
        <div className="overflow-x-auto p-4">
          {tab === "ledger" ? (
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Kegiatan</th>
                  <th className="p-2">Kuitansi</th>
                  <th className="p-2 text-right">Debit</th>
                  <th className="p-2 text-right">Kredit</th>
                  <th className="p-2 text-right">Saldo</th>
                  {canManage && <th className="p-2" />}
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row, index) => (
                  <tr key={String(row.id ?? index)} className="border-b">
                    <td className="p-2">{formatDate(row.tanggal)}</td>
                    <td className="p-2">{String(row.nama_kegiatan ?? "—")}</td>
                    <td className="p-2">{String(row.no_kuitansi ?? "—")}</td>
                    <td className="p-2 text-right">{Number(row.debit) ? formatRupiah(row.debit) : "—"}</td>
                    <td className="p-2 text-right">{Number(row.kredit) ? formatRupiah(row.kredit) : "—"}</td>
                    <td className="p-2 text-right">{formatRupiah(row.saldo)}</td>
                    {canManage && (
                      <td className="p-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => openTransaction(row)}>
                          Ubah
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTransaction(row)}>
                          Hapus
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {!ledgerRows.length && (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={canManage ? 7 : 6}>
                      Belum ada transaksi ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Pegawai</th>
                  <th className="p-2">Status</th>
                  <th className="p-2 text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((row, index) => (
                  <tr key={String(row.id ?? index)} className="border-b">
                    <td className="p-2">{String(row.nama_pegawai ?? (row.pegawai as AnyRow | undefined)?.nama ?? "—")}</td>
                    <td className="p-2">{String(row.status ?? "—")}</td>
                    <td className="p-2 text-right">{formatRupiah(row.nominal ?? row.nilai)}</td>
                  </tr>
                ))}
                {!allocations.length && (
                  <tr>
                    <td className="p-3 text-muted-foreground" colSpan={3}>
                      Belum ada alokasi gaji.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
      {identity.role === "superadmin" && ro.status_ro === "AKTIF" && !ro.parent_ro_id && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium">SILPA</p>
          <p className="mt-1 text-sm text-muted-foreground">Tutup RO aktif dan buat RO tahun fiskal berikutnya pada proyek sama. Jumlah mengikuti aturan backend.</p>
          <Button className="mt-3" variant="outline" disabled={silpa.isPending} onClick={() => setConfirmSilpa(true)}>
            {silpa.isPending && <LoaderCircle className="animate-spin" size={16} />} Tutup & Bawa SILPA
          </Button>
          {silpa.error && <p className="mt-2 text-sm text-destructive">{apiErrorMessage(silpa.error)}</p>}
        </section>
      )}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah RO</DialogTitle>
            <DialogDescription>Aksi tetap tersedia untuk koordinator. Backend menentukan perubahan RO dari proyek boleh atau tidak.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              Nama RO
              <Input value={edit.nama_ro} onChange={(event) => setEdit((state) => ({ ...state, nama_ro: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Plafon
              <Input type="number" value={edit.total_plafon} onChange={(event) => setEdit((state) => ({ ...state, total_plafon: event.target.value }))} />
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button disabled={update.isPending} onClick={saveEdit}>
              {update.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{transactionId ? "Ubah Transaksi" : "Tambah Transaksi"}</DialogTitle>
            <DialogDescription>Debit dan kredit dalam Rupiah. Isi salah satu nilai bila transaksi hanya satu arah.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
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
            <label className="grid gap-1 text-sm">
              Debit
              <Input type="number" min="0" value={transaction.debit} onChange={(event) => setTransaction((state) => ({ ...state, debit: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Kredit
              <Input type="number" min="0" value={transaction.kredit} onChange={(event) => setTransaction((state) => ({ ...state, kredit: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Keterangan
              <Input value={transaction.keterangan} onChange={(event) => setTransaction((state) => ({ ...state, keterangan: event.target.value }))} />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionOpen(false)}>
              Batal
            </Button>
            <Button disabled={saveTransaction.isPending} onClick={submitTransaction}>
              {saveTransaction.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    </div>
  );
}
