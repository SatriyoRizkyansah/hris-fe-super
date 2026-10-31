"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Edit, LoaderCircle, Plus, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { MoneyFlow } from "@/components/common/MoneyFlow";
import { MoneyInput } from "@/components/ui/money-input";
import { DataTable } from "@/components/table";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage, envelopeData, envelopeRows, unwrapEnvelope, uploadHrisFile } from "@/lib/hris/api";
import { formatDate, formatRupiah, roStatusTone } from "@/lib/hris/format";
import { browserIdentity } from "@/lib/hris/identity";
import type { CreatePengajuanBelanjaDto, RoItemDto, UpdateRoDto } from "@/lib/api/generated/api-generated";

type AnyRow = Record<string, unknown>;
type EditForm = { nama_ro: string; total_plafon: string; no_kontrak: string; nomor_job: string; unit_kolaborasi_ids: string[]; pj: string; no_sk: string; status_ro: "AKTIF" | "NONAKTIF" | "SELESAI" };
type TransactionForm = { nama_kegiatan: string; no_kuitansi: string; tanggal: string; debit: string; kredit: string; keterangan: string };
type SpendRequestForm = { nama_kegiatan: string; no_kuitansi: string; tanggal: string; jumlah: string; keterangan: string };
type TransactionDirection = "debit" | "kredit";
const emptyEdit = (): EditForm => ({ nama_ro: "", total_plafon: "", no_kontrak: "", nomor_job: "", unit_kolaborasi_ids: [], pj: "", no_sk: "", status_ro: "AKTIF" });
const emptyTransaction = (): TransactionForm => ({ nama_kegiatan: "", no_kuitansi: "", tanggal: new Date().toISOString().slice(0, 10), debit: "", kredit: "", keterangan: "" });
const emptySpendRequest = (): SpendRequestForm => ({ nama_kegiatan: "", no_kuitansi: "", tanggal: new Date().toISOString().slice(0, 10), jumlah: "", keterangan: "" });
function missing(row: RoItemDto) {
  return [!row.no_kontrak && "No Kontrak", !row.pj && "PJ", (row.id_proyek ? !row.nomor_job && !row.no_sk : !row.no_sk) && (row.id_proyek ? "Nomor Job" : "No SK"), !row.mulai_sk && "Mulai SK", !row.berakhir_sk && "Berakhir SK"].filter(Boolean);
}

export default function RoDetailClientPage({ id }: { id: string }) {
  const identity = useMemo(browserIdentity, []);
  const canManage = identity.role === "superadmin" || identity.role === "koordinator";
  const canCreateRequest = ["superadmin", "koordinator", "subkoor"].includes(identity.role ?? "");
  const [tab, setTab] = useState<"ledger" | "alokasi">("ledger");
  const [spendRequestOpen, setSpendRequestOpen] = useState(false);
  const [spendRequest, setSpendRequest] = useState<SpendRequestForm>(emptySpendRequest);
  const [spendRequestError, setSpendRequestError] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<EditForm>(emptyEdit);
  const [collaboratorCandidate, setCollaboratorCandidate] = useState("");
  const [rabFile, setRabFile] = useState<File | null>(null);
  const [rabUploading, setRabUploading] = useState(false);
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
  const unitLookup = use_query({
    tag: "masterUnitKerja",
    method: "coordinator-options",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterUnitKerja.unitKerjaGetControllerGetData({ tipe_unit: "KOORDINATOR", limit: 200 });
    },
  });
  const ro = envelopeData<RoItemDto>(detail.data);
  const collaborationUnitOptions = envelopeRows<AnyRow>(unitLookup.data)
    .filter((unit) => (!unit.status_aktif || unit.status_aktif === "AKTIF") && String(unit.id) !== String(ro?.id_unit_koordinator ?? "") && !edit.unit_kolaborasi_ids.includes(String(unit.id)))
    .map((unit) => ({ value: String(unit.id), label: `${String(unit.kode_unit ?? "")} — ${String(unit.nama_unit ?? "")}` }));
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
  const createSpendRequest = use_mutation<unknown, Error, CreatePengajuanBelanjaDto>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerCreate",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async (data) => {
      setBrowserToken();
      return (await browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerCreate(data, { format: "json" })).data;
    },
    onSuccess: (response) => {
      setSpendRequestOpen(false);
      setSpendRequest(emptySpendRequest());
      setSpendRequestError("");
      const payload = response as AnyRow;
      const message = typeof payload?.message === "string" ? payload.message : "Pengajuan belanja berhasil dikirim.";
      window.dispatchEvent(new CustomEvent("api:success", { detail: { message } }));
    },
    onError: (error) => setSpendRequestError(apiErrorMessage(error, "Pengajuan belanja gagal disimpan.")),
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
      nomor_job: String(ro.nomor_job ?? ""),
      unit_kolaborasi_ids: (ro.unit_kolaborasi ?? []).map((unit) => unit.id),
      pj: String(ro.pj ?? ""),
      no_sk: String(ro.no_sk ?? ""),
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
    try {
      const { total_plafon: _lockedPlan, ...metadata } = edit;
      await update.mutateAsync({
        ...metadata,
        no_kontrak: edit.no_kontrak || undefined,
        nomor_job: edit.nomor_job || undefined,
        unit_kolaborasi_ids: edit.unit_kolaborasi_ids,
        pj: edit.pj || undefined,
        no_sk: edit.no_sk || undefined,
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
  async function submitSpendRequest() {
    if (!ro?.id_proyek || !spendRequest.nama_kegiatan.trim() || !spendRequest.tanggal || Number(spendRequest.jumlah) <= 0) {
      setSpendRequestError("Nama kegiatan, tanggal, dan jumlah lebih dari nol wajib diisi.");
      return;
    }
    try {
      setSpendRequestError("");
      await createSpendRequest.mutateAsync({
        ro_id: ro.id,
        nama_kegiatan: spendRequest.nama_kegiatan.trim(),
        no_kuitansi: spendRequest.no_kuitansi.trim() || undefined,
        tanggal: spendRequest.tanggal,
        jumlah: Number(spendRequest.jumlah),
        keterangan: spendRequest.keterangan.trim() || undefined,
      });
    } catch (error) {
      setSpendRequestError(apiErrorMessage(error, "Pengajuan belanja gagal disimpan."));
    }
  }
  function openSpendRequest() {
    setSpendRequest(emptySpendRequest());
    setSpendRequestError("");
    setSpendRequestOpen(true);
  }
  async function uploadRab() {
    if (!rabFile) {
      setNotice("Pilih dokumen lebih dulu.");
      return;
    }
    try {
      setRabUploading(true);
      await uploadHrisFile(`/api/ro/${id}/rab`, rabFile);
      setRabFile(null);
      setNotice("");
      await refresh();
    } catch (error) {
      setNotice(apiErrorMessage(error, "Unggah dokumen gagal."));
    } finally {
      setRabUploading(false);
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
  const finance = ((ro as unknown as AnyRow).balance as AnyRow | undefined) ?? {};
  const approvedBudget = Number(finance.pagu_disetujui ?? plannedPlafon) || 0;
  const totalUsed = Number(finance.realisasi ?? ro.total_terpakai) || 0;
  const commitments = Number(finance.komitmen_aktif) || 0;
  const remainingRight = Number(finance.sisa_dapat_direservasi ?? (approvedBudget - totalUsed - commitments)) || 0;
  const cashIn = Number(finance.penerimaan_kas ?? (ro as unknown as AnyRow).total_debit) || 0;
  const cashPosition = Number(finance.posisi_kas ?? (cashIn - totalUsed)) || 0;
  const outstandingAdvance = Number(finance.saldo_talangan) || 0;
  const percent = Number(finance.persentase_pagu ?? (approvedBudget ? ((totalUsed + commitments) / approvedBudget) * 100 : 0));
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
      <section className="space-y-4 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <header>
          <h2 className="text-base font-semibold">Pagu dan arus kas RO</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hak belanja dihitung dari pagu disetujui dikurangi realisasi dan komitmen aktif. Posisi kas dihitung terpisah dari penerimaan kas dikurangi realisasi.</p>
        </header>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hak belanja</p>
          <MoneyFlow items={[
            { label: "Pagu disetujui", amount: approvedBudget },
            { label: "Realisasi", amount: totalUsed, operator: "−", tone: "text-rose-700" },
            { label: "Komitmen aktif", amount: commitments, operator: "−", tone: "text-amber-700" },
            { label: "Sisa hak belanja", amount: remainingRight, operator: "=", tone: remainingRight < 0 ? "text-rose-700" : "text-emerald-700" },
          ]} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arus kas</p>
          <MoneyFlow items={[
            { label: "Penerimaan kas", amount: cashIn, tone: "text-sky-700" },
            { label: "Realisasi", amount: totalUsed, operator: "−", tone: "text-rose-700" },
            { label: "Posisi kas", amount: cashPosition, operator: "=", tone: cashPosition < 0 ? "text-rose-700" : "text-foreground" },
          ]} />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Talangan belum lunas</span>
            <strong className="tabular-nums text-orange-700">{formatRupiah(outstandingAdvance)}</strong>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">{Math.max(0, percent).toFixed(1)}% pagu telah digunakan atau dikomitmenkan.</p>
        </div>
      </section>
      <section className="grid gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
        <p>
          <span className="block text-xs text-muted-foreground">Unit Koordinator</span>
          {String(ro.nama_unit_koordinator ?? "—")}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">No Kontrak / PJ</span>
          {String(ro.no_kontrak ?? "—")} / {String(ro.pj ?? "—")}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Nomor Job</span>
          {String(ro.nomor_job ?? "—")}
          {Number(ro.jumlah_ro_split_nomor_job ?? 0) > 1 ? <span className="mt-1 block text-xs text-violet-700">RO split · {ro.jumlah_ro_split_nomor_job} bagian dengan nomor Job yang sama</span> : null}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">Unit kolaborasi RO</span>
          {ro.unit_kolaborasi?.length ? ro.unit_kolaborasi.map((unit) => unit.nama_unit).join(", ") : "Tidak ada"}
        </p>
        <p>
          <span className="block text-xs text-muted-foreground">SK</span>
          {String(ro.no_sk ?? "—")} · Periode SK proyek {formatDate(ro.mulai_sk)} – {formatDate(ro.berakhir_sk)}
        </p>
      </section>
      {canManage && (
        <section className="rounded-2xl border border-border bg-background p-5 shadow-sm">
          <DocumentUploadField
            label="Dokumen RAB"
            accept=".pdf,.xls,.xlsx"
            value={rabFile}
            onChange={setRabFile}
            onUpload={uploadRab}
            currentFile={typeof ro.file_rab === "string" ? ro.file_rab : null}
            pending={rabUploading}
            disabled={rabUploading}
          />
        </section>
      )}
      <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 pr-3">
          <div className="flex">
            <button className={`px-4 py-3 text-sm font-medium ${tab === "ledger" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("ledger")}>
              Ledger ({ledgerRows.length})
            </button>
            <button className={`px-4 py-3 text-sm font-medium ${tab === "alokasi" ? "border-b-2 border-primary" : "text-muted-foreground"}`} onClick={() => setTab("alokasi")}>
              Alokasi Gaji ({allocations.length})
            </button>
          </div>
          {tab === "ledger" && canCreateRequest && ro.id_proyek && (
            <Button size="sm" onClick={openSpendRequest}>
              <Plus size={16} /> Ajukan Belanja
            </Button>
          )}
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
            Nomor Job
            <Input value={edit.nomor_job} onChange={(event) => setEdit((state) => ({ ...state, nomor_job: event.target.value }))} />
          </label>
          <div className="grid gap-1.5 text-sm">
            <span className="font-medium">Unit kolaborasi RO</span>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <FilterCombobox options={collaborationUnitOptions} value={collaboratorCandidate} onValueChange={setCollaboratorCandidate} label="Pilih unit kolaborasi" />
              </div>
              <Button type="button" variant="outline" disabled={!collaboratorCandidate} onClick={() => {
                if (collaboratorCandidate) setEdit((state) => ({ ...state, unit_kolaborasi_ids: [...new Set([...state.unit_kolaborasi_ids, collaboratorCandidate])] }));
                setCollaboratorCandidate("");
              }}><Plus size={14} /> Tambah</Button>
            </div>
            {edit.unit_kolaborasi_ids.length ? <div className="flex flex-wrap gap-1.5">{edit.unit_kolaborasi_ids.map((unitId) => {
              const unitName = envelopeRows<AnyRow>(unitLookup.data).find((unit) => String(unit.id) === unitId)?.nama_unit;
              return <span key={unitId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{String(unitName ?? "Unit")}
                <button type="button" aria-label="Hapus unit kolaborasi" className="rounded-full px-1 hover:bg-background" onClick={() => setEdit((state) => ({ ...state, unit_kolaborasi_ids: state.unit_kolaborasi_ids.filter((id) => id !== unitId) }))}>×</button>
              </span>;
            })}</div> : <span className="text-xs text-muted-foreground">Opsional. RO split menggunakan nomor Job yang sama.</span>}
          </div>
          <label className="grid gap-1 text-sm">
            PJ
            <Input value={edit.pj} onChange={(event) => setEdit((state) => ({ ...state, pj: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            No SK
            <Input value={edit.no_sk} onChange={(event) => setEdit((state) => ({ ...state, no_sk: event.target.value }))} />
          </label>
          {ro.id_proyek && <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground sm:col-span-2">Periode SK mengikuti proyek: {formatDate(ro.mulai_sk)} – {formatDate(ro.berakhir_sk)}. Ubah periode dari detail proyek.</p>}
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
      <Modal
        open={spendRequestOpen}
        onClose={() => setSpendRequestOpen(false)}
        title="Ajukan Belanja"
        description="Pengajuan ini otomatis menggunakan proyek dan RO yang sedang dibuka."
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setSpendRequestOpen(false)}>
              Batal
            </Button>
            <Button disabled={createSpendRequest.isPending} onClick={submitSpendRequest}>
              {createSpendRequest.isPending && <LoaderCircle className="animate-spin" size={16} />} Kirim Pengajuan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <section className="space-y-2 rounded-xl border border-primary/15 bg-primary/[0.02] p-3 sm:col-span-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Proyek terkunci</p>
              <p className="font-semibold">{String(ro.nama_proyek ?? "Proyek")}</p>
              <p className="text-xs text-muted-foreground">Tahun fiskal {ro.tahun_fiscal}</p>
            </div>
            <div className="border-t border-border/70 pt-2">
              <p className="text-xs font-medium text-muted-foreground">RO sumber dana terkunci</p>
              <p className="font-semibold">{ro.nama_ro}</p>
              <p className="text-xs text-muted-foreground">
                {[ro.kode_mak ? `MAK ${String(ro.kode_mak)}` : null, `Sisa hak belanja ${formatRupiah(remainingRight)}`].filter(Boolean).join(" · ")}
              </p>
            </div>
          </section>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nama kegiatan *
            <Input maxLength={200} value={spendRequest.nama_kegiatan} onChange={(event) => setSpendRequest((current) => ({ ...current, nama_kegiatan: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal *
            <Input type="date" value={spendRequest.tanggal} onChange={(event) => setSpendRequest((current) => ({ ...current, tanggal: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Nomor kuitansi
            <Input maxLength={100} value={spendRequest.no_kuitansi} onChange={(event) => setSpendRequest((current) => ({ ...current, no_kuitansi: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Jumlah *
            <MoneyInput value={spendRequest.jumlah} onValueChange={(value) => setSpendRequest((current) => ({ ...current, jumlah: value }))} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Keterangan
            <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={1000} value={spendRequest.keterangan} onChange={(event) => setSpendRequest((current) => ({ ...current, keterangan: event.target.value }))} placeholder="Rincian kebutuhan belanja (opsional)" />
          </label>
          {spendRequestError && <Alert variant="destructive" className="sm:col-span-2"><AlertDescription>{spendRequestError}</AlertDescription></Alert>}
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
