"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Banknote, Landmark, Pencil, Plus, RefreshCw, Scale, Trash2, Wallet } from "lucide-react";
import { DataTable } from "@/components/table";
import { Modal } from "@/components/modal/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MoneyInput } from "@/components/ui/money-input";
import { EmptyData } from "@/components/loading/EmptyData";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { apiErrorMessage, envelopeData } from "@/lib/hris/api";
import { formatDate, formatRupiah } from "@/lib/hris/format";
import type { CreateBukuKasDto } from "@/lib/api/generated/api-generated";

const GROUP = "pembukuanBukuKas";

type JenisBuku = "KAS_UMUM" | "BANK" | "PANJAR" | "PAJAK";

const BUKU: { value: JenisBuku; label: string; hint: string }[] = [
  { value: "KAS_UMUM", label: "Buku Kas Umum", hint: "Semua uang yang masuk dan keluar dari kas." },
  { value: "BANK", label: "Buku Bank", hint: "Pergerakan uang melalui rekening bank." },
  { value: "PANJAR", label: "Buku Panjar", hint: "Uang muka perjalanan yang diberikan dan dipertanggungjawabkan." },
  { value: "PAJAK", label: "Buku Pajak", hint: "Pungutan dan setoran pajak (PPN, PPh 21/22/23/4)." },
];

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type BukuKasRow = {
  id: string;
  nomor_bku: string;
  urutan: number;
  tanggal: string;
  no_slip?: string | null;
  penerima?: string | null;
  uraian: string;
  keterangan?: string | null;
  debit: number;
  kredit: number;
  saldo: number;
  buku: JenisBuku[];
  buku_label: string;
  sumber: string;
  jenis_transaksi?: string | null;
  jenis_transaksi_label?: string | null;
  pajak_ppn?: number | null;
  pajak_pph_21?: number | null;
  pajak_pph_22?: number | null;
  pajak_pph_23?: number | null;
  pajak_pph_4?: number | null;
};

type BukuKasPayload = {
  buku: JenisBuku | null;
  buku_label: string;
  tahun_fiscal: number;
  bulan: number | null;
  saldo_awal: number;
  total_debit: number;
  total_kredit: number;
  saldo_akhir: number;
  list: BukuKasRow[];
  meta: { page: number; limit: number; total_datas: number; total_pages: number };
};

type RekapBulan = { bulan: number; saldo_awal: number; debit: number; kredit: number; saldo_akhir: number };
type RekapBuku = { buku: JenisBuku; buku_label: string; saldo_awal: number; total_debit: number; total_kredit: number; saldo_akhir: number; bulanan: RekapBulan[] };
type RekapPayload = {
  tahun_fiscal: number;
  buku: RekapBuku[];
  rincian_pajak: { ppn: number; pph_21: number; pph_22: number; pph_23: number; pph_4: number; setoran: number; total_penerimaan: number };
};

type Form = {
  id: string;
  tanggal: string;
  no_slip: string;
  penerima: string;
  uraian: string;
  keterangan: string;
  debit: string;
  kredit: string;
  buku: JenisBuku[];
  pajak_ppn: string;
  pajak_pph_21: string;
  pajak_pph_22: string;
  pajak_pph_23: string;
  pajak_pph_4: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (buku: JenisBuku): Form => ({
  id: "",
  tanggal: today(),
  no_slip: "",
  penerima: "",
  uraian: "",
  keterangan: "",
  debit: "",
  kredit: "",
  buku: [buku],
  pajak_ppn: "",
  pajak_pph_21: "",
  pajak_pph_22: "",
  pajak_pph_23: "",
  pajak_pph_4: "",
});

const num = (value: unknown) => Number(value ?? 0) || 0;
const sumberLabel = (sumber: string) => (sumber === "MANUAL" ? "Diisi manual" : sumber === "DANA_TRANSAKSI" ? "Tarik arus kas" : "Dari transaksi RO");

export default function BukuKasPageClient() {
  const currentUser = useCurrentUser();
  const [mounted, setMounted] = useState(false);
  const [buku, setBuku] = useState<JenisBuku>("KAS_UMUM");
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [bulan, setBulan] = useState("");
  const [cari, setCari] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Form>(() => blankForm("KAS_UMUM"));
  const [formError, setFormError] = useState("");
  const [hapusRow, setHapusRow] = useState<BukuKasRow | null>(null);
  const [saldoOpen, setSaldoOpen] = useState(false);
  const [saldo, setSaldo] = useState<Record<JenisBuku, string>>({ KAS_UMUM: "", BANK: "", PANJAR: "", PAJAK: "" });
  const [saldoError, setSaldoError] = useState("");
  const [tarikOpen, setTarikOpen] = useState(false);
  const [tarikError, setTarikError] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => setMounted(true), []);
  const role = currentUser.data?.role?.toLowerCase() ?? "";
  const canManage = mounted && ["superadmin", "keu_bendahara_pengeluaran"].includes(role);
  const bukuAktif = BUKU.find((item) => item.value === buku) ?? BUKU[0];

  const params = useMemo(
    () => ({
      buku,
      tahun_fiscal: Number(tahun) || undefined,
      bulan: bulan ? Number(bulan) : undefined,
      cari: cari || undefined,
      page,
      limit,
    }),
    [buku, tahun, bulan, cari, page, limit],
  );

  const listQuery = use_query<unknown, Error, typeof params>({
    tag: GROUP,
    method: "bukuKasListControllerList",
    params,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.pembukuanBukuKas.bukuKasListControllerList(params, { format: "json" });
    },
  });
  const data = envelopeData<BukuKasPayload>(listQuery.data);
  const rows = data?.list ?? [];
  const meta = data?.meta;

  const rekapParams = useMemo(() => ({ tahun_fiscal: Number(tahun) || undefined }), [tahun]);
  const rekapQuery = use_query<unknown, Error, typeof rekapParams>({
    tag: GROUP,
    method: "bukuKasRekapControllerRekap",
    params: rekapParams,
    queryFn: async () => {
      setBrowserToken();
      return browserApi.pembukuanBukuKas.bukuKasRekapControllerRekap(rekapParams, { format: "json" });
    },
  });
  const rekap = envelopeData<RekapPayload>(rekapQuery.data);
  const rekapBuku = rekap?.buku.find((item) => item.buku === buku);
  const semuaBuku = useMemo(() => {
    const map = new Map<JenisBuku, RekapBuku>();
    rekap?.buku.forEach((item) => map.set(item.buku, item));
    return map;
  }, [rekap]);

  const invalidateKeys = [apiQueryKeys.resource(GROUP)];

  const simpanMutation = use_mutation<unknown, Error, { id: string; body: CreateBukuKasDto }>({
    tag: GROUP,
    method: "simpanBukuKas",
    invalidateKeys,
    mutationFn: async ({ id, body }) => {
      setBrowserToken();
      return id ? browserApi.pembukuanBukuKas.bukuKasUpdateControllerUpdate(id, body, { format: "json" }) : browserApi.pembukuanBukuKas.bukuKasCreateControllerCreate(body, { format: "json" });
    },
    onSuccess: () => {
      setFormOpen(false);
      setForm(blankForm(buku));
      setFormError("");
    },
  });

  const hapusMutation = use_mutation<unknown, Error, string>({
    tag: GROUP,
    method: "hapusBukuKas",
    invalidateKeys,
    mutationFn: async (id) => {
      setBrowserToken();
      return browserApi.pembukuanBukuKas.bukuKasRemoveControllerRemove(id, { format: "json" });
    },
    onSuccess: () => setHapusRow(null),
  });

  const saldoMutation = use_mutation<unknown, Error, { tahun_fiscal: number; items: { buku: JenisBuku; nominal: number }[] }>({
    tag: GROUP,
    method: "setSaldoAwal",
    invalidateKeys,
    mutationFn: async (body) => {
      setBrowserToken();
      return browserApi.pembukuanBukuKas.bukuKasSaldoTarikControllerSetSaldoAwal(body, { format: "json" });
    },
    onSuccess: () => {
      setSaldoOpen(false);
      setSaldoError("");
    },
  });

  const tarikMutation = use_mutation<unknown, Error, { tahun_fiscal: number; bulan?: number }>({
    tag: GROUP,
    method: "tarikArusKas",
    invalidateKeys,
    mutationFn: async (body) => {
      setBrowserToken();
      return browserApi.pembukuanBukuKas.bukuKasSaldoTarikControllerTarik(body, { format: "json" });
    },
    onSuccess: (result) => {
      const payload = envelopeData<{ ditambahkan: number; dilewati: number }>(result);
      setNota(payload ? `${payload.ditambahkan} baris baru ditambahkan, ${payload.dilewati} baris dilewati karena sudah pernah ditarik.` : "Penarikan arus kas selesai.");
      setTarikOpen(false);
      setTarikError("");
    },
  });

  const field = (key: keyof Form, value: string | JenisBuku[]) => setForm((state) => ({ ...state, [key]: value }) as Form);
  const toggleBuku = (value: JenisBuku) => setForm((state) => ({ ...state, buku: state.buku.includes(value) ? state.buku.filter((item) => item !== value) : [...state.buku, value] }));
  const jumlah = (value: string) => Number(value || 0);

  function bukaTambah() {
    setForm(blankForm(buku));
    setFormError("");
    setFormOpen(true);
  }

  function bukaUbah(row: BukuKasRow) {
    setForm({
      id: row.id,
      tanggal: String(row.tanggal ?? "").slice(0, 10),
      no_slip: String(row.no_slip ?? ""),
      penerima: String(row.penerima ?? ""),
      uraian: String(row.uraian ?? ""),
      keterangan: String(row.keterangan ?? ""),
      debit: row.debit ? String(row.debit) : "",
      kredit: row.kredit ? String(row.kredit) : "",
      buku: row.buku,
      pajak_ppn: row.pajak_ppn ? String(row.pajak_ppn) : "",
      pajak_pph_21: row.pajak_pph_21 ? String(row.pajak_pph_21) : "",
      pajak_pph_22: row.pajak_pph_22 ? String(row.pajak_pph_22) : "",
      pajak_pph_23: row.pajak_pph_23 ? String(row.pajak_pph_23) : "",
      pajak_pph_4: row.pajak_pph_4 ? String(row.pajak_pph_4) : "",
    });
    setFormError("");
    setFormOpen(true);
  }

  function bukaSaldo() {
    const isi = { KAS_UMUM: "", BANK: "", PANJAR: "", PAJAK: "" } as Record<JenisBuku, string>;
    BUKU.forEach((item) => {
      const nilai = semuaBuku.get(item.value)?.saldo_awal ?? 0;
      isi[item.value] = nilai ? String(nilai) : "";
    });
    setSaldo(isi);
    setSaldoError("");
    setSaldoOpen(true);
  }

  async function submitForm() {
    if (!form.uraian.trim()) return setFormError("Uraian wajib diisi.");
    if (!form.tanggal) return setFormError("Tanggal wajib diisi.");
    if (!form.buku.length) return setFormError("Pilih minimal satu buku tempat baris ini dicatat.");
    if (jumlah(form.debit) <= 0 && jumlah(form.kredit) <= 0) return setFormError("Isi nominal penerimaan atau pengeluaran.");
    const body: CreateBukuKasDto = {
      tanggal: form.tanggal,
      no_slip: form.no_slip.trim() || undefined,
      penerima: form.penerima.trim() || undefined,
      uraian: form.uraian.trim(),
      keterangan: form.keterangan.trim() || undefined,
      debit: jumlah(form.debit),
      kredit: jumlah(form.kredit),
      buku: form.buku,
      pajak_ppn: jumlah(form.pajak_ppn),
      pajak_pph_21: jumlah(form.pajak_pph_21),
      pajak_pph_22: jumlah(form.pajak_pph_22),
      pajak_pph_23: jumlah(form.pajak_pph_23),
      pajak_pph_4: jumlah(form.pajak_pph_4),
    };
    try {
      setFormError("");
      await simpanMutation.mutateAsync({ id: form.id, body });
    } catch (cause) {
      setFormError(apiErrorMessage(cause, "Gagal menyimpan baris buku kas."));
    }
  }

  async function submitHapus() {
    if (!hapusRow) return;
    try {
      await hapusMutation.mutateAsync(hapusRow.id);
    } catch (cause) {
      setNota(apiErrorMessage(cause, "Gagal menghapus baris buku kas."));
      setHapusRow(null);
    }
  }

  async function submitSaldo() {
    if (Number(tahun) < 2000) return setSaldoError("Tahun fiskal tidak valid.");
    try {
      setSaldoError("");
      await saldoMutation.mutateAsync({
        tahun_fiscal: Number(tahun),
        items: BUKU.map((item) => ({ buku: item.value, nominal: jumlah(saldo[item.value]) })),
      });
    } catch (cause) {
      setSaldoError(apiErrorMessage(cause, "Gagal menyimpan saldo awal."));
    }
  }

  async function submitTarik() {
    try {
      setTarikError("");
      setNota("");
      await tarikMutation.mutateAsync({ tahun_fiscal: Number(tahun), bulan: bulan ? Number(bulan) : undefined });
    } catch (cause) {
      setTarikError(apiErrorMessage(cause, "Gagal menarik transaksi arus kas."));
    }
  }

  const kartu = [
    { label: "Saldo Awal", value: data?.saldo_awal ?? 0, icon: Wallet, tone: "text-slate-700" },
    { label: "Penerimaan (Debet)", value: data?.total_debit ?? 0, icon: Landmark, tone: "text-emerald-700" },
    { label: "Pengeluaran (Kredit)", value: data?.total_kredit ?? 0, icon: Banknote, tone: "text-rose-700" },
    { label: "Saldo Akhir", value: data?.saldo_akhir ?? 0, icon: Scale, tone: "text-sky-800" },
  ];

  const tahunOpsi = useMemo(() => {
    const dasar = new Date().getFullYear();
    return [dasar - 2, dasar - 1, dasar, dasar + 1].map(String);
  }, []);

  const kolom: { key: string; header: string; render: (row: BukuKasRow) => ReactNode; className?: string }[] = [
    { key: "nomor_bku", header: "No. BKU", render: (row) => row.nomor_bku || "—" },
    { key: "tanggal", header: "Tanggal", render: (row) => formatDate(row.tanggal) },
    { key: "no_slip", header: "No. Slip", render: (row) => row.no_slip || "—" },
    { key: "penerima", header: "Penerima", render: (row) => row.penerima || "—" },
    {
      key: "uraian",
      header: "Uraian",
      className: "min-w-[16rem]",
      render: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.uraian}</p>
          {row.keterangan ? <p className="mt-0.5 text-xs text-muted-foreground">{row.keterangan}</p> : null}
        </div>
      ),
    },
    {
      key: "jenis_transaksi",
      header: "Jenis Transaksi",
      render: (row) => row.jenis_transaksi_label || <span className="text-xs text-muted-foreground">—</span>,
    },
    { key: "debit", header: "Debet", className: "text-right", render: (row) => (num(row.debit) ? formatRupiah(row.debit) : "—") },
    { key: "kredit", header: "Kredit", className: "text-right", render: (row) => (num(row.kredit) ? formatRupiah(row.kredit) : "—") },
    { key: "saldo", header: "Saldo", className: "text-right font-semibold", render: (row) => formatRupiah(row.saldo) },
    { key: "sumber", header: "Sumber", render: (row) => sumberLabel(row.sumber) },
  ];

  if (buku === "PAJAK") {
    kolom.splice(
      7,
      0,
      { key: "pajak_ppn", header: "PPN", className: "text-right", render: (row) => (num(row.pajak_ppn) ? formatRupiah(row.pajak_ppn) : "—") },
      { key: "pajak_pph_21", header: "PPh 21", className: "text-right", render: (row) => (num(row.pajak_pph_21) ? formatRupiah(row.pajak_pph_21) : "—") },
      { key: "pajak_pph_22", header: "PPh 22", className: "text-right", render: (row) => (num(row.pajak_pph_22) ? formatRupiah(row.pajak_pph_22) : "—") },
      { key: "pajak_pph_23", header: "PPh 23", className: "text-right", render: (row) => (num(row.pajak_pph_23) ? formatRupiah(row.pajak_pph_23) : "—") },
      { key: "pajak_pph_4", header: "PPh 4(2)", className: "text-right", render: (row) => (num(row.pajak_pph_4) ? formatRupiah(row.pajak_pph_4) : "—") },
    );
  }

  if (canManage) {
    kolom.push({
      key: "aksi",
      header: "Aksi",
      render: (row) =>
        row.sumber === "MANUAL" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bukaUbah(row)}>
              <Pencil size={14} /> Ubah
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setHapusRow(row)}>
              <Trash2 size={14} /> Hapus
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Otomatis dari arus kas</span>
        ),
    });
  }

  const barisRekap = (rekapBuku?.bulanan ?? []).map((item) => ({ ...item, label: BULAN[item.bulan - 1] ?? `Bulan ${item.bulan}` }));

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pembukuan Bendahara Pengeluaran</h1>
          <p className="mt-1 text-sm text-muted-foreground">Empat buku resmi Bendahara Pengeluaran dalam satu tempat, terhubung dengan arus kas keuangan.</p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={bukaSaldo}>
              <Wallet size={17} /> Atur Saldo Awal
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTarikError("");
                setTarikOpen(true);
              }}
            >
              <RefreshCw size={17} /> Tarik dari Arus Kas
            </Button>
            <Button onClick={bukaTambah}>
              <Plus size={18} /> Tambah Baris
            </Button>
          </div>
        ) : null}
      </header>

      {nota ? (
        <Alert>
          <AlertDescription>{nota}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {BUKU.map((item) => {
          const aktif = item.value === buku;
          const total = semuaBuku.get(item.value);
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setBuku(item.value);
                setPage(1);
              }}
              className={`rounded-lg border px-3.5 py-2 text-left transition-colors ${aktif ? "border-primary bg-primary/5 text-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:bg-muted"}`}
              aria-pressed={aktif}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span className="mt-0.5 block text-xs">{formatRupiah(total?.saldo_akhir ?? 0)}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{bukuAktif.label}</CardTitle>
          <CardDescription>{bukuAktif.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kartu.map((item) => (
              <div key={item.label} className="rounded-lg border bg-card px-3.5 py-3" role="group" aria-label={item.label}>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <item.icon size={14} aria-hidden="true" />
                  {item.label}
                </div>
                <p className={`mt-1.5 text-lg font-semibold ${item.tone}`}>{formatRupiah(item.value)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="buku-tahun">Tahun fiskal</Label>
              <select
                id="buku-tahun"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={tahun}
                onChange={(event) => {
                  setTahun(event.target.value);
                  setPage(1);
                }}
              >
                {tahunOpsi.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buku-bulan">Bulan</Label>
              <select
                id="buku-bulan"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={bulan}
                onChange={(event) => {
                  setBulan(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Sepanjang tahun</option>
                {BULAN.map((item, index) => (
                  <option key={item} value={String(index + 1)}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buku-cari">Cari uraian / slip</Label>
              <Input
                id="buku-cari"
                value={cari}
                placeholder="Contoh: bayar listrik"
                onChange={(event) => {
                  setCari(event.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          {listQuery.isLoading ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Memuat pembukuan…
            </p>
          ) : null}
          {listQuery.isError ? (
            <EmptyData
              label="Pembukuan belum dapat dimuat."
              action={
                <Button variant="outline" size="sm" onClick={() => void listQuery.refetch()}>
                  Coba lagi
                </Button>
              }
            />
          ) : null}
          {!listQuery.isLoading && !listQuery.isError ? (
            <DataTable
              rows={rows}
              rowKey={(row, index) => String(row.id ?? index)}
              remoteSearch
              searchValue={cari}
              searchPlaceholder="Cari uraian, nomor slip, atau penerima…"
              onSearchChange={(value) => {
                setCari(value);
                setPage(1);
              }}
              columns={kolom}
              pagination={{
                page,
                pageSize: limit,
                total: meta?.total_datas ?? rows.length,
                totalPages: meta?.total_pages ?? 1,
                onPageChange: setPage,
                onPageSizeChange: (size) => {
                  setLimit(size);
                  setPage(1);
                },
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      {buku === "PAJAK" && rekap?.rincian_pajak ? (
        <Card>
          <CardHeader>
            <CardTitle>Rincian Penerimaan Pajak {tahun}</CardTitle>
            <CardDescription>Jumlah pungutan yang tercatat pada Buku Pajak beserta setorannya.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "PPN", value: rekap.rincian_pajak.ppn },
                { label: "PPh 21", value: rekap.rincian_pajak.pph_21 },
                { label: "PPh 22", value: rekap.rincian_pajak.pph_22 },
                { label: "PPh 23", value: rekap.rincian_pajak.pph_23 },
                { label: "PPh 4(2)", value: rekap.rincian_pajak.pph_4 },
                { label: "Total Penerimaan", value: rekap.rincian_pajak.total_penerimaan },
                { label: "Setoran Pajak", value: rekap.rincian_pajak.setoran },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border bg-card px-3.5 py-3">
                  <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-base font-semibold">{formatRupiah(item.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Rekap Bulanan {bukuAktif.label} {tahun}
          </CardTitle>
          <CardDescription>Saldo berjalan setiap bulan: saldo awal, penerimaan, pengeluaran, dan saldo akhir.</CardDescription>
        </CardHeader>
        <CardContent>
          {rekapQuery.isLoading ? (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">
              Menghitung rekap…
            </p>
          ) : rekapBuku ? (
            <DataTable
              rows={barisRekap}
              rowKey={(row) => String(row.bulan)}
              hideSearch
              hidePagination
              emptyMessage="Belum ada pergerakan pada tahun ini."
              columns={[
                { key: "label", header: "Bulan", render: (row) => row.label },
                { key: "saldo_awal", header: "Saldo Awal", className: "text-right", render: (row) => formatRupiah(row.saldo_awal) },
                { key: "debit", header: "Penerimaan", className: "text-right", render: (row) => formatRupiah(row.debit) },
                { key: "kredit", header: "Pengeluaran", className: "text-right", render: (row) => formatRupiah(row.kredit) },
                { key: "saldo_akhir", header: "Saldo Akhir", className: "text-right font-semibold", render: (row) => formatRupiah(row.saldo_akhir) },
              ]}
            />
          ) : (
            <EmptyData label="Rekap belum tersedia untuk tahun ini." compact />
          )}
        </CardContent>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Ubah Baris Buku Kas" : "Tambah Baris Buku Kas"}
        description="Nomor BKU dibuat otomatis berurutan. Isi nominal penerimaan (debet) atau pengeluaran (kredit)."
        size="lg"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitForm()} disabled={simpanMutation.isPending}>
              {simpanMutation.isPending ? "Menyimpan…" : "Simpan"}
            </Button>
          </>
        }
      >
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bku-tanggal">Tanggal</Label>
            <Input id="bku-tanggal" type="date" value={form.tanggal} onChange={(event) => field("tanggal", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bku-slip">Nomor slip</Label>
            <Input id="bku-slip" value={form.no_slip} placeholder="P 2025000368" onChange={(event) => field("no_slip", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bku-penerima">Penerima</Label>
            <Input id="bku-penerima" value={form.penerima} placeholder="Nama penerima / vendor" onChange={(event) => field("penerima", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bku-uraian">Uraian</Label>
            <Input id="bku-uraian" value={form.uraian} placeholder="Contoh: Pembayaran tagihan listrik" onChange={(event) => field("uraian", event.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bku-keterangan">Keterangan tambahan</Label>
            <Input id="bku-keterangan" value={form.keterangan} placeholder="Opsional, mis. Bulan Februari 2025" onChange={(event) => field("keterangan", event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bku-debit">Penerimaan (debet)</Label>
            <MoneyInput id="bku-debit" value={form.debit} onValueChange={(value) => field("debit", value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bku-kredit">Pengeluaran (kredit)</Label>
            <MoneyInput id="bku-kredit" value={form.kredit} onValueChange={(value) => field("kredit", value)} placeholder="0" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Buku tempat baris ini dicatat</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {BUKU.map((item) => (
              <label key={item.value} className="flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm">
                <input type="checkbox" className="mt-0.5" checked={form.buku.includes(item.value)} onChange={() => toggleBuku(item.value)} />
                <span>
                  <span className="block font-medium">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {form.buku.includes("PAJAK") ? (
          <div className="space-y-2">
            <Label>Rincian pajak (khusus Buku Pajak)</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["pajak_ppn", "PPN"],
                  ["pajak_pph_21", "PPh 21"],
                  ["pajak_pph_22", "PPh 22"],
                  ["pajak_pph_23", "PPh 23"],
                  ["pajak_pph_4", "PPh 4(2)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`bku-${key}`}>{label}</Label>
                  <MoneyInput id={`bku-${key}`} value={form[key]} onValueChange={(value) => field(key, value)} placeholder="0" />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(hapusRow)}
        onClose={() => setHapusRow(null)}
        title="Hapus Baris Buku Kas"
        description="Baris yang dihapus tidak dapat dikembalikan."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setHapusRow(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={() => void submitHapus()} disabled={hapusMutation.isPending}>
              {hapusMutation.isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Hapus <span className="font-semibold">{hapusRow?.nomor_bku}</span> — {hapusRow?.uraian}?
        </p>
      </Modal>

      <Modal
        open={saldoOpen}
        onClose={() => setSaldoOpen(false)}
        title={`Saldo Awal Tahun ${tahun}`}
        description="Masukkan saldo awal setiap buku per 1 Januari. Nilai ini menjadi titik mulai perhitungan saldo berjalan."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setSaldoOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitSaldo()} disabled={saldoMutation.isPending}>
              {saldoMutation.isPending ? "Menyimpan…" : "Simpan Saldo Awal"}
            </Button>
          </>
        }
      >
        {saldoError ? (
          <Alert variant="destructive">
            <AlertDescription>{saldoError}</AlertDescription>
          </Alert>
        ) : null}
        {BUKU.map((item) => (
          <div key={item.value} className="space-y-1.5">
            <Label htmlFor={`saldo-${item.value}`}>{item.label}</Label>
            <MoneyInput id={`saldo-${item.value}`} value={saldo[item.value]} onValueChange={(value) => setSaldo((state) => ({ ...state, [item.value]: value }))} placeholder="0" />
          </div>
        ))}
      </Modal>

      <Modal
        open={tarikOpen}
        onClose={() => setTarikOpen(false)}
        title="Tarik Transaksi Arus Kas"
        description="Semua transaksi dana operasional pada periode ini dicatat ke Buku Kas Umum, dan ke Buku Bank atau Buku Panjar bila relevan."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setTarikOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void submitTarik()} disabled={tarikMutation.isPending}>
              {tarikMutation.isPending ? "Menarik…" : "Tarik Sekarang"}
            </Button>
          </>
        }
      >
        {tarikError ? (
          <Alert variant="destructive">
            <AlertDescription>{tarikError}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="tarik-bulan">Periode yang ditarik</Label>
          <select id="tarik-bulan" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={bulan} onChange={(event) => setBulan(event.target.value)}>
            <option value="">Seluruh tahun {tahun}</option>
            {BULAN.map((item, index) => (
              <option key={item} value={String(index + 1)}>
                {item} {tahun}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">Transaksi yang sudah pernah ditarik akan dilewati otomatis, jadi penarikan aman diulang.</p>
      </Modal>
    </section>
  );
}
