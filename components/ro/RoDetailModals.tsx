"use client";

import type { Dispatch, SetStateAction } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/modal/Modal";
import { Input } from "@/components/ui/input";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { MoneyInput } from "@/components/ui/money-input";
import { formatDate, formatRupiah } from "@/lib/hris/format";
import type { RoItemDto } from "@/lib/api/generated/api-generated";
import type { AnyRow, EditForm, SpendRequestForm, TransactionDirection, TransactionForm } from "@/components/ro/ro-detail.types";

type Option = { value: string; label: string };
type Props = {
  ro: RoItemDto;
  editOpen: boolean;
  setEditOpen: (open: boolean) => void;
  edit: EditForm;
  setEdit: Dispatch<SetStateAction<EditForm>>;
  collaboratorCandidate: string;
  setCollaboratorCandidate: (id: string) => void;
  collaborationUnitOptions: Option[];
  units: AnyRow[];
  notice: string;
  updatePending: boolean;
  saveEdit: () => void;
  transactionOpen: boolean;
  setTransactionOpen: (open: boolean) => void;
  transactionId: string | null;
  transaction: TransactionForm;
  setTransaction: Dispatch<SetStateAction<TransactionForm>>;
  transactionDirection: TransactionDirection;
  setTransactionDirection: (direction: TransactionDirection) => void;
  saveTransactionPending: boolean;
  submitTransaction: () => void;
  receiptFile: File | null;
  setReceiptFile: (file: File | null) => void;
  receiptUploading: boolean;
  ledgerRows: AnyRow[];
  spendRequestOpen: boolean;
  setSpendRequestOpen: (open: boolean) => void;
  spendRequest: SpendRequestForm;
  setSpendRequest: Dispatch<SetStateAction<SpendRequestForm>>;
  createSpendRequestPending: boolean;
  submitSpendRequest: () => void;
  spendRequestError: string;
  remainingRight: number;
};

export function RoDetailModals(props: Props) {
  const {
    ro, editOpen, setEditOpen, edit, setEdit, collaboratorCandidate,
    setCollaboratorCandidate, collaborationUnitOptions, units, notice,
    updatePending, saveEdit, transactionOpen, setTransactionOpen, transactionId,
    transaction, setTransaction, transactionDirection, setTransactionDirection,
    saveTransactionPending, submitTransaction, receiptFile, setReceiptFile,
    receiptUploading, ledgerRows, spendRequestOpen, setSpendRequestOpen,
    spendRequest, setSpendRequest, createSpendRequestPending, submitSpendRequest,
    spendRequestError, remainingRight,
  } = props;
  return (
    <>
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
            <Button disabled={updatePending} onClick={saveEdit}>
              {updatePending && <LoaderCircle className="animate-spin" size={16} />} Simpan
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
            Plafon awal proyek (terkunci)
            <Input type="number" value={String((ro as RoItemDto & { nilai_rencana?: number }).nilai_rencana ?? ro?.total_plafon ?? edit.total_plafon)} readOnly aria-readonly="true" />
            <span className="text-xs text-muted-foreground">Pencairan termin dapat menambah saldo; nilai awal tidak dapat diubah.</span>
          </label>
          <label className="grid gap-1 text-sm">
            No Kontrak
            <Input value={edit.no_kontrak} onChange={(event) => setEdit((state) => ({ ...state, no_kontrak: event.target.value }))} />
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
              const unitName = units.find((unit) => String(unit.id) === unitId)?.nama_unit;
              return <span key={unitId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{String(unitName ?? "Unit")}
                <button type="button" aria-label="Hapus unit kolaborasi" className="rounded-full px-1 hover:bg-background" onClick={() => setEdit((state) => ({ ...state, unit_kolaborasi_ids: state.unit_kolaborasi_ids.filter((id) => id !== unitId) }))}>×</button>
              </span>;
            })}</div> : <span className="text-xs text-muted-foreground">Opsional. RO split menggunakan nomor Job yang sama.</span>}
          </div>
          <label className="grid gap-1 text-sm">
            PJ
            <Input value={edit.pj} onChange={(event) => setEdit((state) => ({ ...state, pj: event.target.value }))} />
          </label>
          {ro.id_proyek && <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground sm:col-span-2">Periode kontrak mengikuti proyek: {formatDate(ro.mulai_kontrak)} – {formatDate(ro.berakhir_kontrak)}. Ubah periode dari detail proyek.</p>}
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
            <Button disabled={saveTransactionPending} onClick={submitTransaction}>
              {saveTransactionPending && <LoaderCircle className="animate-spin" size={16} />} Simpan
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
            disabled={saveTransactionPending || receiptUploading}
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
            <Button disabled={createSpendRequestPending} onClick={submitSpendRequest}>
              {createSpendRequestPending && <LoaderCircle className="animate-spin" size={16} />} Kirim Pengajuan
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
    </>
  );
}
