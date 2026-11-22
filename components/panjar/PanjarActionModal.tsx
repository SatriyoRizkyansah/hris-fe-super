"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/modal/Modal";
import { FilterCombobox } from "@/components/ui/filter-combobox";
import { DocumentUploadField } from "@/components/common/DocumentUploadField";
import { NomorPembayaranPreview, useNomorPembayaranPreview } from "@/components/common/NomorPembayaranPreview";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { setBrowserToken } from "@/lib/api/hooks";
import { apiErrorMessage, requestHrisApi, uploadHrisFile } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";

type Row = Record<string, any>;
const today = () => new Date().toISOString().slice(0, 10);

function listRows(value: unknown): Row[] {
  let current: any = value;
  for (let index = 0; index < 4 && current && typeof current === "object"; index += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.list)) return current.list;
    current = current.data;
  }
  return [];
}

export type PanjarMode = "accountability" | "review" | "topup" | "refund";

export function panjarModeOf(request: Row | null): PanjarMode {
  const status = String(request?.panjar?.status ?? "");
  if (status === "DIAJUKAN_PERTANGGUNGJAWABAN") return "review";
  if (status === "MENUNGGU_DANA_TAMBAHAN") return "topup";
  if (status === "MENUNGGU_PENGEMBALIAN") return "refund";
  return "accountability";
}

export const PANJAR_STATUS_LABELS: Record<string, string> = {
  DIBAYARKAN: "Menunggu pertanggungjawaban",
  DIAJUKAN_PERTANGGUNGJAWAN: "Menunggu tinjauan KARWAS",
  DIAJUKAN_PERTANGGUNGJAWABAN: "Menunggu tinjauan KARWAS",
  DITOLAK_KARWAS: "Ditolak KARWAS",
  MENUNGGU_VALIDASI_KEUANGAN: "Menunggu validasi Keuangan",
  DITOLAK_KEUANGAN: "Ditolak Keuangan",
  MENUNGGU_DANA_TAMBAHAN: "Menunggu dana tambahan",
  MENUNGGU_PENGEMBALIAN: "Menunggu pengembalian",
  SELESAI: "Selesai",
};

type Props = {
  request: Row | null;
  onClose: () => void;
  onCompleted?: () => void | Promise<void>;
};

/** Modal for every panjar step: pemohon accountability, KARWAS review, Bendahara disbursement dana tambahan/refund. */
export function PanjarActionModal({ request, onClose, onCompleted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ jumlah_realisasi: "", jumlah_pengembalian: "", nomor_penerimaan: "", tanggal_diterima: today(), dana_tujuan_id: "", catatan: "" });
  const [funding, setFunding] = useState({ nomor_pembayaran: "", tanggal_bayar: today(), dana_sumber_id: "", catatan: "" });
  const [wallets, setWallets] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const mode = panjarModeOf(request);
  const panjarNominal = Number(request?.panjar?.nominal ?? 0);
  const actualInput = Number(form.jumlah_realisasi || 0);
  const autoRefund = Math.max(0, panjarNominal - actualInput);
  const autoShortfall = Math.max(0, actualInput - panjarNominal);
  const panjarShortfall = Number(request?.panjar?.jumlah_kekurangan ?? 0);
  const needsWallet = mode === "refund" || mode === "topup";
  // Pratinjau nomor pembayaran otomatis untuk pencairan dana tambahan (topup).
  const fundingNomor = useNomorPembayaranPreview({ enabled: mode === "topup" && !funding.nomor_pembayaran.trim(), tanggal: funding.tanggal_bayar });

  useEffect(() => {
    if (!request) return;
    setFile(null);
    setError("");
    setForm({
      jumlah_realisasi: String(request.panjar?.jumlah_realisasi ?? ""),
      jumlah_pengembalian: String(request.panjar?.jumlah_pengembalian ?? ""),
      nomor_penerimaan: "",
      tanggal_diterima: today(),
      dana_tujuan_id: "",
      catatan: "",
    });
    setFunding({ nomor_pembayaran: "", tanggal_bayar: today(), dana_sumber_id: "", catatan: "" });
  }, [request]);

  useEffect(() => {
    if (!needsWallet || !request?.id) {
      setWallets([]);
      return;
    }
    let active = true;
    requestHrisApi(`/api/pengajuan-belanja/${encodeURIComponent(String(request.id))}/sumber-dana`)
      .then((response) => {
        if (active) setWallets(listRows(response));
      })
      .catch((cause) => {
        if (active) setError(apiErrorMessage(cause, "Daftar kamar dana belum dapat dimuat."));
      });
    return () => {
      active = false;
    };
  }, [needsWallet, request?.id]);

  const submitMutation = use_mutation<unknown, Error, { id: string; jumlah_realisasi: number; catatan: string; file: File }>({
    tag: "keuanganPengajuanBelanja",
    method: "submitTravelAdvanceAccountability",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, file: uploadFile, jumlah_realisasi, catatan }) => uploadHrisFile(`/api/pengajuan-belanja/${id}/panjar/pertanggungjawaban`, uploadFile, { jumlah_realisasi: String(jumlah_realisasi), catatan }),
    successMessage: "Pertanggungjawaban panjar berhasil diajukan ke KARWAS.",
    onSuccess: async () => {
      await onCompleted?.();
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, "Pertanggungjawaban panjar gagal diajukan.")),
  });

  const reviewMutation = use_mutation<unknown, Error, { id: string; disetujui: boolean; catatan: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "reviewTravelAdvanceAccountability",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, ...data }) => {
      setBrowserToken();
      return requestHrisApi(`/api/pengajuan-belanja/${id}/panjar/review`, { method: "POST", body: JSON.stringify(data) });
    },
    successMessage: "Keputusan KARWAS atas panjar berhasil disimpan.",
    onSuccess: async () => {
      await onCompleted?.();
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, "Review pertanggungjawaban gagal disimpan.")),
  });

  const topupMutation = use_mutation<unknown, Error, { id: string; file: File; nomor_pembayaran?: string; tanggal_bayar: string; dana_sumber_id: string; catatan: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "payTravelAdvanceShortfall",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, file: uploadFile, ...data }) =>
      uploadHrisFile(`/api/pengajuan-belanja/${id}/panjar/dana-tambahan`, uploadFile, {
        ...(data.nomor_pembayaran ? { nomor_pembayaran: data.nomor_pembayaran } : {}),
        tanggal_bayar: data.tanggal_bayar,
        dana_sumber_id: data.dana_sumber_id,
        ...(data.catatan ? { catatan: data.catatan } : {}),
      }),
    successMessage: "Pencairan dana tambahan panjar berhasil dicatat.",
    onSuccess: async () => {
      await onCompleted?.();
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, "Pencairan dana tambahan gagal dicatat.")),
  });

  const refundMutation = use_mutation<unknown, Error, { id: string; file: File; nomor_penerimaan: string; tanggal_diterima: string; dana_tujuan_id: string; catatan: string }>({
    tag: "keuanganPengajuanBelanja",
    method: "receiveTravelAdvanceRefund",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: ({ id, file: uploadFile, ...data }) => uploadHrisFile(`/api/pengajuan-belanja/${id}/panjar/pengembalian`, uploadFile, data),
    successMessage: "Penerimaan pengembalian panjar berhasil dicatat.",
    onSuccess: async () => {
      await onCompleted?.();
      onClose();
    },
    onError: (cause) => setError(apiErrorMessage(cause, "Penerimaan pengembalian panjar gagal dicatat.")),
  });

  const pending = submitMutation.isPending || reviewMutation.isPending || topupMutation.isPending || refundMutation.isPending;

  function assertPdf(label: string): File | null {
    if (!file || file.size > 10 * 1024 * 1024 || !file.name.toLowerCase().endsWith(".pdf")) {
      setError(`${label} wajib berupa PDF maksimal 10 MB.`);
      return null;
    }
    return file;
  }

  async function submit(approved?: boolean) {
    if (!request) return;
    setError("");
    try {
      if (mode === "accountability") {
        const proof = assertPdf("Dokumen pertanggungjawaban");
        if (!proof) return;
        const actual = Number(form.jumlah_realisasi);
        if (!form.jumlah_realisasi.trim() || actual < 0) {
          setError("Realisasi biaya wajib diisi dan tidak boleh negatif.");
          return;
        }
        await submitMutation.mutateAsync({ id: String(request.id), jumlah_realisasi: actual, catatan: form.catatan.trim(), file: proof });
      } else if (mode === "review") {
        if (approved === false && !form.catatan.trim()) {
          setError("Alasan penolakan wajib diisi.");
          return;
        }
        await reviewMutation.mutateAsync({ id: String(request.id), disetujui: approved === true, catatan: form.catatan.trim() });
      } else if (mode === "topup") {
        if (!funding.tanggal_bayar || !funding.dana_sumber_id) {
          setError("Tanggal dan kamar sumber dana wajib diisi.");
          return;
        }
        const proof = assertPdf("Bukti pembayaran dana tambahan");
        if (!proof) return;
        await topupMutation.mutateAsync({
          id: String(request.id),
          nomor_pembayaran: funding.nomor_pembayaran.trim() || undefined,
          tanggal_bayar: funding.tanggal_bayar,
          dana_sumber_id: funding.dana_sumber_id,
          catatan: funding.catatan.trim(),
          file: proof,
        });
      } else {
        if (!form.nomor_penerimaan.trim() || !form.tanggal_diterima || !form.dana_tujuan_id) {
          setError("Nomor, tanggal, dan kamar tujuan wajib diisi.");
          return;
        }
        const proof = assertPdf("Bukti penerimaan pengembalian");
        if (!proof) return;
        await refundMutation.mutateAsync({ id: String(request.id), nomor_penerimaan: form.nomor_penerimaan.trim(), tanggal_diterima: form.tanggal_diterima, dana_tujuan_id: form.dana_tujuan_id, catatan: form.catatan.trim(), file: proof });
      }
    } catch (cause) {
      setError(apiErrorMessage(cause, "Proses panjar gagal disimpan."));
    }
  }

  const title = mode === "review" ? "Tinjau Pertanggungjawaban Panjar" : mode === "topup" ? "Cairkan Dana Tambahan Panjar" : mode === "refund" ? "Catat Pengembalian Panjar" : "Ajukan Pertanggungjawaban Panjar";

  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      title={title}
      description={request ? `${String(request.nomor_pengajuan)} · ${String(request.nama_kegiatan)} · Panjar ${formatRupiah(request.panjar?.nominal)}` : undefined}
      size="lg"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          {mode === "review" ? (
            <>
              <Button variant="destructive" disabled={pending} onClick={() => void submit(false)}>
                {reviewMutation.isPending && <LoaderCircle className="animate-spin" size={15} />} Tolak
              </Button>
              <Button disabled={pending} onClick={() => void submit(true)}>
                {reviewMutation.isPending && <LoaderCircle className="animate-spin" size={15} />} Setujui
              </Button>
            </>
          ) : (
            <Button disabled={pending} onClick={() => void submit()}>
              {(submitMutation.isPending || topupMutation.isPending || refundMutation.isPending) && <LoaderCircle className="animate-spin" size={15} />}
              {mode === "refund" ? "Simpan Penerimaan" : mode === "topup" ? "Catat Pencairan" : "Kirim ke KARWAS"}
            </Button>
          )}
        </>
      }
    >
      {request && mode === "accountability" && (
        <>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            Jumlah panjar yang sudah diterima <strong className="tabular-nums">{formatRupiah(panjarNominal)}</strong>. Isi total realisasi biaya perjalanan; sisa atau kekurangan dihitung otomatis.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Realisasi biaya perjalanan *
              <MoneyInput value={form.jumlah_realisasi} onValueChange={(value) => setForm((current) => ({ ...current, jumlah_realisasi: value }))} disabled={pending} />
            </label>
            {autoShortfall > 0 ? (
              <label className="grid gap-1 text-sm">
                Kekurangan biaya (otomatis)
                <span className="flex h-9 min-w-0 items-center rounded-md border border-amber-200 bg-amber-50 px-3 text-sm font-medium tabular-nums text-amber-800">{formatRupiah(autoShortfall)}</span>
              </label>
            ) : (
              <label className="grid gap-1 text-sm">
                Pengembalian (otomatis)
                <span className="flex h-9 min-w-0 items-center rounded-md border border-input bg-muted px-3 text-sm tabular-nums text-muted-foreground">{formatRupiah(autoRefund)}</span>
              </label>
            )}
          </div>
          {autoShortfall > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
              Realisasi melebihi panjar. Setelah KARWAS menyetujui, kekurangan ini langsung dicairkan Bendahara Pengeluaran sebagai <strong>dana tambahan (reimburse)</strong>.
            </div>
          )}
          <DocumentUploadField label="Bukti pertanggungjawaban (PDF) *" accept=".pdf" value={file} onChange={setFile} disabled={pending} className="p-3 sm:p-3" />
          <label className="grid gap-1 text-sm">
            Catatan untuk KARWAS
            <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={form.catatan} onChange={(event) => setForm((current) => ({ ...current, catatan: event.target.value }))} />
          </label>
        </>
      )}
      {request && mode === "review" && (
        <>
          <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
            <p>
              Realisasi dilaporkan <strong>{formatRupiah(request.panjar?.jumlah_realisasi)}</strong>
            </p>
            <p>
              {panjarShortfall > 0 ? "Kekurangan biaya" : "Sisa untuk dikembalikan"} <strong>{formatRupiah(panjarShortfall > 0 ? panjarShortfall : request.panjar?.jumlah_pengembalian)}</strong>
            </p>
            <p className="sm:col-span-2">
              Bukti:{" "}
              {request.panjar?.file_pertanggungjawaban ? (
                <a className="text-primary underline" href={String(request.panjar.file_pertanggungjawaban)} target="_blank" rel="noreferrer">
                  Buka dokumen
                </a>
              ) : (
                "—"
              )}
            </p>
            {panjarShortfall > 0 && <p className="text-xs text-amber-800 sm:col-span-2">Realisasi melebihi panjar. Setujui untuk melanjutkan ke pencairan dana tambahan oleh Bendahara Pengeluaran.</p>}
          </div>
          <label className="grid gap-1 text-sm">
            Catatan pemeriksa
            <textarea
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={500}
              value={form.catatan}
              onChange={(event) => setForm((current) => ({ ...current, catatan: event.target.value }))}
              placeholder="Wajib jika menolak"
            />
          </label>
        </>
      )}
      {request && mode === "topup" && (
        <>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-950">
            KARWAS menyetujui realisasi <strong>{formatRupiah(request.panjar?.jumlah_realisasi)}</strong>. Kekurangan biaya yang perlu dicairkan sebesar <strong>{formatRupiah(panjarShortfall)}</strong>. Catat pencairannya melalui kamar dana
            yang dipilih.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Nomor pembayaran
              <Input maxLength={100} placeholder={fundingNomor.placeholder} value={funding.nomor_pembayaran} onChange={(event) => setFunding((current) => ({ ...current, nomor_pembayaran: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Tanggal bayar *
              <Input type="date" value={funding.tanggal_bayar} onChange={(event) => setFunding((current) => ({ ...current, tanggal_bayar: event.target.value }))} />
            </label>
          </div>
          {!funding.nomor_pembayaran.trim() && <NomorPembayaranPreview nomor={fundingNomor.nomorOtomatis} />}
          <FilterCombobox
            label="Kamar sumber dana"
            value={funding.dana_sumber_id}
            onValueChange={(value) => setFunding((current) => ({ ...current, dana_sumber_id: value }))}
            options={wallets.map((wallet) => ({
              value: String(wallet.id),
              label: `${String(wallet.kategori_kamar ?? "Kamar").replaceAll("_", " ")} · ${String(wallet.unit_koordinator?.nama_unit ?? "Unit")} · tersedia ${formatRupiah(wallet.saldo_tersedia)}`,
            }))}
          />
          <DocumentUploadField label="Bukti pembayaran dana tambahan (PDF) *" accept=".pdf" value={file} onChange={setFile} disabled={pending} className="p-3 sm:p-3" />
          <label className="grid gap-1 text-sm">
            Catatan
            <textarea
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={500}
              value={funding.catatan}
              onChange={(event) => setFunding((current) => ({ ...current, catatan: event.target.value }))}
            />
          </label>
        </>
      )}
      {request && mode === "refund" && (
        <>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-950">
            KARWAS menyetujui pengembalian sebesar <strong>{formatRupiah(request.panjar?.jumlah_pengembalian)}</strong>. Pilih kamar tujuan sesuai bukti penerimaan aktual.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Nomor penerimaan *<Input maxLength={100} value={form.nomor_penerimaan} onChange={(event) => setForm((current) => ({ ...current, nomor_penerimaan: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">
              Tanggal diterima *<Input type="date" value={form.tanggal_diterima} onChange={(event) => setForm((current) => ({ ...current, tanggal_diterima: event.target.value }))} />
            </label>
          </div>
          <FilterCombobox
            label="Kamar tujuan penerimaan"
            value={form.dana_tujuan_id}
            onValueChange={(value) => setForm((current) => ({ ...current, dana_tujuan_id: value }))}
            options={wallets.map((wallet) => ({ value: String(wallet.id), label: `${String(wallet.kategori_kamar ?? "Kamar").replaceAll("_", " ")} · ${String(wallet.unit_koordinator?.nama_unit ?? "Unit")}` }))}
          />
          <DocumentUploadField label="Bukti penerimaan pengembalian (PDF) *" accept=".pdf" value={file} onChange={setFile} disabled={pending} className="p-3 sm:p-3" />
          <label className="grid gap-1 text-sm">
            Catatan
            <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={form.catatan} onChange={(event) => setForm((current) => ({ ...current, catatan: event.target.value }))} />
          </label>
        </>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Modal>
  );
}
