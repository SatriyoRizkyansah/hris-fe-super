"use client";

import { useState } from "react";
import { Check, LoaderCircle, Save, WalletCards } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken } from "@/lib/api/hooks";
import { use_mutation } from "@/lib/api/use_mutation";
import { use_query } from "@/lib/api/use_query";
import { apiErrorMessage } from "@/lib/hris/api";

type MarginRow = { id: string; kategori_kamar?: string; nama_kamar?: string; persentase?: number; unit_kerja_id?: string; rekening_id?: string; [key: string]: unknown };
type ApiRow = { id: string; [key: string]: unknown };

function responseRows<T extends ApiRow>(response: unknown): T[] {
  let value: unknown = response;
  for (let depth = 0; depth < 5 && value && typeof value === "object"; depth += 1) {
    if (Array.isArray(value)) return value as T[];
    const record = value as Record<string, unknown>;
    const list = record.list ?? record.items ?? record.results;
    if (Array.isArray(list)) return list as T[];
    value = record.data;
  }
  return Array.isArray(value) ? (value as T[]) : [];
}
type OptionRow = { id: string; nama_bank?: string; nama_rekening?: string; nomor_rekening?: string; status_aktif?: string };
const FIXED_PERCENTAGES: Record<string, number> = {
  P1_PNS_NON_PNS: 48,
  P2_KP3: 30,
  OPS_KANTOR: 17,
  OPS_KP3: 2.5,
  MULOS_SPI: 2.5,
};
const formatPct = (value: number) => `${value.toFixed(2).replace(/\.00$/, "")}%`;
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const accountLabel = (account?: OptionRow) => (account ? [account.nama_bank, account.nama_rekening, account.nomor_rekening ? `(${account.nomor_rekening})` : ""].filter(Boolean).join(" — ") : "Rekening belum dipilih");

export default function PengaturanMarginClientPage() {
  const [drafts, setDrafts] = useState<Record<string, MarginRow>>({});
  const [savingId, setSavingId] = useState("");
  const [savedId, setSavedId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const settings = use_query({
    tag: "masterPengaturanMargin",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterPengaturanMargin.pengaturanMarginControllerGetData({ format: "json" }));
    },
  });
  const accounts = use_query({
    tag: "masterRekeningBank",
    method: "list",
    params: undefined,
    queryFn: async () => {
      setBrowserToken();
      return apiData(browserApi.masterRekeningBank.masterRekeningControllerFindAll({ format: "json" }));
    },
  });
  const rows = responseRows<MarginRow>(settings.data).map((row) => drafts[row.id] ?? row);
  const accountRows = responseRows<OptionRow>(accounts.data).filter((row) => row.status_aktif === "AKTIF");
  const total = Object.values(FIXED_PERCENTAGES).reduce((sum, percentage) => sum + percentage, 0);
  const totalOk = Math.abs(total - 100) < 0.01;
  const update = use_mutation({
    tag: "masterPengaturanMargin",
    method: "update",
    mutationFn: async ({ id, row }: { id: string; row: MarginRow }) => {
      setBrowserToken();
      return browserApi.masterPengaturanMargin.pengaturanMarginControllerUpdate(id, {
        nama_kamar: String(row.nama_kamar ?? ""),
        rekening_id: String(row.rekening_id ?? "") || undefined,
      });
    },
    invalidateKeys: [["api", "masterPengaturanMargin"]],
  });
  function patch(row: MarginRow, key: keyof MarginRow, value: string | number) {
    setDrafts((current) => ({ ...current, [row.id]: { ...row, [key]: value } }));
    setSavedId("");
  }
  async function save(row: MarginRow) {
    setSavingId(row.id);
    setErrorMessage("");
    setSavedId("");
    try {
      await update.mutateAsync({ id: row.id, row });
      setDrafts((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setSavedId(row.id);
    } catch (error) {
      setErrorMessage(apiErrorMessage(error, "Gagal menyimpan pengaturan margin."));
    } finally {
      setSavingId("");
    }
  }
  return (
    <section className="hris-page space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Pengaturan Margin</h1>
        <p className="mt-1 text-sm text-muted-foreground">Persentase pembagian dan pemilik wallet mengikuti ketentuan tetap. Rekening tujuan dapat disesuaikan.</p>
      </header>
      <Alert className="border-sky-200 bg-sky-50/70 text-sky-950">
        <AlertTitle>Dasar peraturan</AlertTitle>
        <AlertDescription>Pengaturan ini mengacu pada Surat Keputusan Pemimpin BLU No. 40.K/KAU.01/DPM/2026 tanggal 2 Juni 2026 tentang Penggunaan Saldo Awal dan Alokasi Margin.</AlertDescription>
      </Alert>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>Gagal menyimpan</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      <Card className={`rounded-xl shadow-sm ${totalOk ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"}`}>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${totalOk ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              <WalletCards size={21} />
            </span>
            <div>
              <p className="text-sm font-semibold">Total pembagian persentase kamar</p>
              <p className="mt-1 text-xs text-muted-foreground">Pembagian baku: 48% + 30% + 17% + 2,5% + 2,5%.</p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <strong className={`text-3xl ${totalOk ? "text-emerald-700" : "text-rose-700"}`}>{formatPct(total)}</strong>
            <span className="text-sm text-muted-foreground">/ 100%</span>
            {totalOk && <Check className="text-emerald-600" size={18} />}
          </div>
          <div className="col-span-full h-2 w-full overflow-hidden rounded-full bg-background">
            <div className={`h-full rounded-full transition-all ${totalOk ? "bg-emerald-500" : "bg-rose-500"}`} style={{ width: `${Math.min(100, total)}%` }} />
          </div>
          {!totalOk && <p className="col-span-full -mt-2 text-xs font-medium text-rose-700">{total > 100 ? `Melebihi batas sebesar ${formatPct(total - 100)}.` : `Masih kurang ${formatPct(100 - total)}.`}</p>}
        </CardContent>
      </Card>
      {settings.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat pengaturan</AlertTitle>
          <AlertDescription>{apiErrorMessage(settings.error)}</AlertDescription>
        </Alert>
      )}
      {accounts.error && (
        <Alert variant="destructive">
          <AlertTitle>Gagal memuat rekening bank</AlertTitle>
          <AlertDescription>{apiErrorMessage(accounts.error)}</AlertDescription>
        </Alert>
      )}
      {settings.isLoading ? (
        <p className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">Memuat pembagian kamar…</p>
      ) : (
        <div className="margin-settings-grid grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row, index) => (
            <Card key={row.id} className="margin-setting-card min-w-0 rounded-xl shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-4">
                <div className="flex min-h-12 items-center justify-between gap-3 pt-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-foreground">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pembagian kamar</p>
                      <h2 className="truncate text-base font-semibold leading-5">{String(row.kategori_kamar ?? "Kamar").replaceAll("_", " ")}</h2>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">{formatPct(FIXED_PERCENTAGES[String(row.kategori_kamar)] ?? 0)}</span>
                </div>
                <label className="grid gap-2 text-sm font-medium">
                  <span>Nama kamar</span>
                  <Input value={String(row.nama_kamar ?? "")} onChange={(event) => patch(row, "nama_kamar", event.target.value)} />
                </label>
                <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                  <label className="grid gap-2 text-sm font-medium">
                    <span>Persentase</span>
                    <div className="relative">
                      <Input type="number" value={String(FIXED_PERCENTAGES[String(row.kategori_kamar)] ?? 0)} disabled className="pr-7" />
                      <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
                    </div>
                  </label>
                  <label className="grid min-w-0 gap-2 text-sm font-medium">
                    <span>Unit pemilik wallet</span>
                    <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-normal">
                      ORG-UMUM — Bagian Umum
                    </div>
                  </label>
                </div>
                <label className="grid min-w-0 gap-2 text-sm font-medium">
                  <span>Rekening tujuan distribusi</span>
                  <select
                    value={String(row.rekening_id ?? "")}
                    onChange={(event) => patch(row, "rekening_id", event.target.value)}
                    className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm font-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <option value="">Pilih rekening tujuan…</option>
                    {accountRows.map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountLabel(account)}
                      </option>
                    ))}
                  </select>
                </label>
                {!row.rekening_id && <p className="text-xs text-amber-700">Rekening tujuan perlu dipilih sebelum distribusi margin.</p>}
                <div className="mt-auto flex justify-end pt-1">
                  <Button size="sm" className="rounded-md" onClick={() => void save(row)} disabled={savingId === row.id || update.isPending}>
                    {savingId === row.id ? <LoaderCircle className="animate-spin" size={15} /> : savedId === row.id ? <Check size={15} /> : <Save size={15} />}{" "}
                    {savingId === row.id ? "Menyimpan…" : savedId === row.id ? "Tersimpan" : "Simpan perubahan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
