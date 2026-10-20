"use client";

import { useMemo, useState } from "react";
import { Plus, LoaderCircle } from "lucide-react";
import { HrisResourcePage } from "@/components/hris/HrisResourcePage";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { apiErrorMessage, envelopeData, envelopeRows } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { CreateRekonsiliasiBankDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, unknown>;
type Form = { rekening_id: string; saldo_bank: string; tanggal_rekonsiliasi: string; tahun_fiscal: string; keterangan: string };
const currentDate = () => new Date().toISOString().slice(0, 10);
const blankForm = (): Form => ({ rekening_id: "", saldo_bank: "", tanggal_rekonsiliasi: currentDate(), tahun_fiscal: String(new Date().getFullYear()), keterangan: "" });

export default function RekonsiliasiBankPageClient() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blankForm);
  const [error, setError] = useState("");
  const accountsQuery = use_query({
    tag: "masterRekeningBank",
    method: "findAll",
    params: {},
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterRekeningBank.masterRekeningControllerFindAll({ format: "json" });
    },
  });
  const accounts = envelopeRows<Row>(accountsQuery.data).filter((row) => row.status_aktif === "AKTIF" || row.status_aktif === true);
  const selectedAccount = accounts.find((row) => String(row.id) === form.rekening_id);
  const saldoQuery = use_query({
    tag: "rekonsiliasiBank",
    method: "saldoSistem",
    params: { rekening_id: form.rekening_id, tahun_fiscal: form.tahun_fiscal },
    enabled: open && Boolean(form.rekening_id) && Number(form.tahun_fiscal) >= 2000,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.rekonsiliasiBank.rekonsiliasiBankControllerGetSaldoSistem({ rekening_id: form.rekening_id, tahun_fiscal: Number(form.tahun_fiscal) }, { format: "json" });
    },
  });
  const saldo = envelopeData<Row>(saldoQuery.data);
  const saldoSistem = Number(saldo?.total_saldo_sistem ?? 0);
  const saldoBank = Number(form.saldo_bank || 0);
  const keteranganRequired = Boolean(form.saldo_bank) && saldoBank !== saldoSistem;
  const create = use_mutation<unknown, Error, CreateRekonsiliasiBankDto>({
    tag: "rekonsiliasiBank",
    method: "create",
    invalidateKeys: [apiQueryKeys.resource("rekonsiliasiBank")],
    mutationFn: async (data) => {
      setBrowserToken();
      return browserApi.rekonsiliasiBank.rekonsiliasiBankControllerCreate(data, { format: "json" });
    },
    onSuccess: () => {
      setOpen(false);
      setForm(blankForm());
      setError("");
    },
  });
  const field = (key: keyof Form, value: string) => setForm((state) => ({ ...state, [key]: value }));
  async function submit() {
    if (!form.rekening_id || !form.tanggal_rekonsiliasi || Number(form.tahun_fiscal) < 2000 || !form.saldo_bank) {
      setError("Rekening, tanggal, tahun fiskal, dan saldo bank wajib diisi.");
      return;
    }
    if (keteranganRequired && !form.keterangan.trim()) {
      setError("Keterangan wajib diisi saat saldo bank berbeda dari saldo sistem.");
      return;
    }
    try {
      setError("");
      await create.mutateAsync({
        rekening_id: form.rekening_id,
        saldo_bank: Number(form.saldo_bank),
        tanggal_rekonsiliasi: form.tanggal_rekonsiliasi,
        tahun_fiscal: Number(form.tahun_fiscal),
        keterangan: form.keterangan.trim() || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Gagal menyimpan rekonsiliasi bank."));
    }
  }

  return (
    <>
      <HrisResourcePage
        title="Rekonsiliasi Bank"
        description="Riwayat rekonsiliasi bank."
        group="rekonsiliasiBank"
        method="rekonsiliasiBankControllerFindAll"
        requestStyle="none"
        columns={[
          { key: "tanggal_rekonsiliasi", header: "Tanggal" },
          {
            key: "rekening",
            header: "Rekening",
            render: (_value, row) => {
              const rekening = row.rekening as Row | undefined;
              return rekening ? `${String(rekening.nama_bank ?? "")} · ${String(rekening.nomor_rekening ?? "")}` : "—";
            },
          },
          { key: "tahun_fiscal", header: "Tahun Fiskal" },
          { key: "saldo_sistem", header: "Saldo Sistem", render: (value) => formatRupiah(value) },
          { key: "saldo_bank", header: "Saldo Bank", render: (value) => formatRupiah(value) },
          { key: "selisih", header: "Selisih", render: (value) => formatRupiah(value) },
          { key: "status", header: "Status" },
          { key: "pemeriksa", header: "Diperiksa Oleh", render: (_value, row) => String((row.pemeriksa as Row | undefined)?.nama ?? "—") },
        ]}
        headerAction={
          <Button
            onClick={() => {
              setForm(blankForm());
              setError("");
              setOpen(true);
            }}
          >
            <Plus size={18} /> Buat Rekonsiliasi
          </Button>
        }
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Buat Rekonsiliasi Bank"
        description="Bandingkan saldo rekening bank dengan saldo sistem pada tahun fiskal terpilih."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={create.isPending || saldoQuery.isLoading} onClick={submit}>
              {create.isPending && <LoaderCircle className="animate-spin" size={16} />} Simpan Rekonsiliasi
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            Rekening bank *
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.rekening_id} onChange={(event) => field("rekening_id", event.target.value)} disabled={accountsQuery.isLoading}>
              <option value="">Pilih rekening aktif</option>
              {accounts.map((row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.nama_bank)} · {String(row.nomor_rekening)} — {String(row.nama_rekening)}
                </option>
              ))}
            </select>
            {accountsQuery.isError && <span className="text-xs text-destructive">{apiErrorMessage(accountsQuery.error, "Gagal memuat rekening bank.")}</span>}
            {!accountsQuery.isLoading && !accountsQuery.isError && accounts.length === 0 && <span className="text-xs text-amber-700">Belum ada rekening aktif. Tambahkan rekening lebih dulu.</span>}
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal rekonsiliasi *
            <Input
              type="date"
              value={form.tanggal_rekonsiliasi}
              onChange={(event) => {
                field("tanggal_rekonsiliasi", event.target.value);
                field("tahun_fiscal", event.target.value.slice(0, 4));
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Tahun fiskal *
            <Input type="number" min={2000} value={form.tahun_fiscal} onChange={(event) => field("tahun_fiscal", event.target.value)} />
          </label>
          <div className="rounded-lg border bg-muted/30 p-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">Saldo sistem · {selectedAccount ? `${String(selectedAccount.nama_bank)} ${String(selectedAccount.nomor_rekening)}` : "Pilih rekening"}</p>
            {saldoQuery.isFetching ? <p className="mt-1 text-sm">Menghitung saldo sistem…</p> : <p className="mt-1 font-semibold">{formatRupiah(saldoSistem)}</p>}
            {saldoQuery.isError && <p className="mt-1 text-xs text-destructive">{apiErrorMessage(saldoQuery.error, "Gagal menghitung saldo sistem.")}</p>}
          </div>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Saldo bank *
            <MoneyInput value={form.saldo_bank} onValueChange={(value) => field("saldo_bank", value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Keterangan {keteranganRequired ? "*" : "(opsional)"}
            <textarea
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
              maxLength={500}
              value={form.keterangan}
              onChange={(event) => field("keterangan", event.target.value)}
              placeholder={keteranganRequired ? "Jelaskan penyebab selisih" : "Catatan (jika ada)"}
            />
          </label>
          {form.saldo_bank && (
            <p className={`text-sm font-medium sm:col-span-2 ${saldoBank === saldoSistem ? "text-emerald-700" : "text-amber-700"}`}>
              {saldoBank === saldoSistem ? "Saldo cocok" : `Selisih ${formatRupiah(saldoBank - saldoSistem)} — keterangan wajib diisi`}
            </p>
          )}
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </Modal>
    </>
  );
}
