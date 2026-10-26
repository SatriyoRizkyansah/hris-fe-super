"use client";

import { useMemo, useState } from "react";
import { Check, CircleDollarSign, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Modal } from "@/components/modal/Modal";
import { DataTable } from "@/components/table";
import { StatusBadge } from "@/components/common/StatusBadge";
import { browserApi } from "@/lib/api/browser-client";
import { apiData, setBrowserToken, useCurrentUser } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { use_mutation } from "@/lib/api/use_mutation";
import { apiQueryKeys } from "@/lib/api/query-keys";
import { apiErrorMessage } from "@/lib/hris/api";
import { formatRupiah } from "@/lib/hris/format";
import type { BayarPengajuanBelanjaDto, CreatePengajuanBelanjaDto, ReviewPengajuanBelanjaDto } from "@/lib/api/generated/api-generated";

type Row = Record<string, any>;
type Form = { ro_id: string; nama_kegiatan: string; no_kuitansi: string; tanggal: string; jumlah: string; keterangan: string };
type PaymentForm = { nomor_pembayaran: string; tanggal_bayar: string; catatan: string; alokasi: { dana_operasional_id: string; nominal: string }[] };
const today = () => new Date().toISOString().slice(0, 10);
const blankForm = (): Form => ({ ro_id: "", nama_kegiatan: "", no_kuitansi: "", tanggal: today(), jumlah: "", keterangan: "" });
const blankPayment = (): PaymentForm => ({ nomor_pembayaran: "", tanggal_bayar: today(), catatan: "", alokasi: [{ dana_operasional_id: "", nominal: "" }] });
function listRows(value: unknown): Row[] {
  let current: any = value;
  for (let index = 0; index < 4 && current && typeof current === "object"; index += 1) {
    if (Array.isArray(current)) return current;
    if (Array.isArray(current.list)) return current.list;
    current = current.data;
  }
  return [];
}
const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  DIAJUKAN: "Diajukan",
  DISETUJUI_KARWAS: "Direservasi KARWAS",
  DITOLAK_KARWAS: "Ditolak KARWAS",
  DIBAYAR: "Dibayar Bendahara",
  DIBATALKAN: "Dibatalkan",
};
const statusTone = (status?: string): "ok" | "warn" | "danger" | "neutral" => {
  if (status === "DIBAYAR" || status === "DISETUJUI_KARWAS") return "ok";
  if (status === "DIAJUKAN") return "warn";
  if (status === "DITOLAK_KARWAS" || status === "DIBATALKAN") return "danger";
  return "neutral";
};

export default function PengajuanBelanjaPageClient() {
  const [open, setOpen] = useState(false);
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [paying, setPaying] = useState<Row | null>(null);
  const [form, setForm] = useState<Form>(blankForm);
  const [payment, setPayment] = useState<PaymentForm>(blankPayment);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("__all");
  const user = useCurrentUser();
  const role = user.data?.role?.toLowerCase() ?? "";
  const canCreate = ["superadmin", "koordinator", "subkoor"].includes(role);
  const canReview = ["superadmin", "keu_karwas"].includes(role);
  const canPay = ["superadmin", "keu_bendahara"].includes(role);
  const listQuery = use_query({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerList",
    params: { query: search || undefined, status: status === "__all" ? undefined : status, limit: 100, page: 1 },
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerList(params, { format: "json" }));
    },
  });
  const rows = useMemo(() => listRows(listQuery.data), [listQuery.data]);
  const rosQuery = use_query({
    tag: "masterRo",
    method: "roControllerGetData",
    params: { limit: 100, page: 1 },
    enabled: open && canCreate,
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.masterRo.roControllerGetData(params, { format: "json" }));
    },
  });
  const ros = listRows(rosQuery.data);
  const fundsQuery = use_query({
    tag: "masterDanaOperasional",
    method: "danaOperasionalControllerGetData",
    params: { limit: 500, page: 1 },
    enabled: Boolean(paying) && canPay,
    queryFn: async (params) => {
      setBrowserToken();
      return apiData(browserApi.masterDanaOperasional.danaOperasionalControllerGetData(params, { format: "json" }));
    },
  });
  const funds = listRows(fundsQuery.data);
  const createMutation = use_mutation<unknown, Error, CreatePengajuanBelanjaDto>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerCreate",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async (data) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerCreate(data, { format: "json" }));
    },
    onSuccess: () => {
      setOpen(false);
      setForm(blankForm());
      setError("");
    },
  });
  const reviewMutation = use_mutation<unknown, Error, { id: string; data: ReviewPengajuanBelanjaDto }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerReview",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja")],
    mutationFn: async ({ id, data }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerReview(id, data, { format: "json" }));
    },
    onSuccess: () => {
      setReviewing(null);
      setNote("");
      setError("");
    },
  });
  const payMutation = use_mutation<unknown, Error, { id: string; data: BayarPengajuanBelanjaDto }>({
    tag: "keuanganPengajuanBelanja",
    method: "pengajuanBelanjaControllerBayar",
    invalidateKeys: [apiQueryKeys.resource("keuanganPengajuanBelanja"), apiQueryKeys.resource("masterDanaOperasional")],
    mutationFn: async ({ id, data }) => {
      setBrowserToken();
      return apiData(browserApi.keuanganPengajuanBelanja.pengajuanBelanjaControllerBayar(id, data, { format: "json" }));
    },
    onSuccess: () => {
      setPaying(null);
      setPayment(blankPayment());
      setError("");
    },
  });
  const field = (key: keyof Form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const allocationTotal = payment.alokasi.reduce((sum, item) => sum + Number(item.nominal || 0), 0);
  const paymentAmount = Number(paying?.jumlah ?? 0);
  async function submit() {
    if (!form.ro_id || !form.nama_kegiatan.trim() || !form.tanggal || Number(form.jumlah) <= 0) {
      setError("RO, nama kegiatan, tanggal, dan jumlah lebih dari nol wajib diisi.");
      return;
    }
    try {
      setError("");
      await createMutation.mutateAsync({
        ro_id: form.ro_id,
        nama_kegiatan: form.nama_kegiatan.trim(),
        no_kuitansi: form.no_kuitansi.trim() || undefined,
        tanggal: form.tanggal,
        jumlah: Number(form.jumlah),
        keterangan: form.keterangan.trim() || undefined,
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pengajuan belanja gagal disimpan."));
    }
  }
  async function review(disetujui: boolean) {
    if (!reviewing) return;
    try {
      setError("");
      await reviewMutation.mutateAsync({ id: String(reviewing.id), data: { disetujui, catatan: note.trim() || undefined } });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Review pengajuan gagal disimpan."));
    }
  }
  async function pay() {
    if (!paying) return;
    const allocations = payment.alokasi.filter((item) => item.dana_operasional_id || Number(item.nominal) > 0);
    if (!payment.nomor_pembayaran.trim() || !payment.tanggal_bayar || !allocations.length || allocations.some((item) => !item.dana_operasional_id || Number(item.nominal) <= 0)) {
      setError("Nomor pembayaran, tanggal, kamar dana, dan nominal positif wajib diisi.");
      return;
    }
    if (new Set(allocations.map((item) => item.dana_operasional_id)).size !== allocations.length) {
      setError("Kamar dana operasional tidak boleh dipilih lebih dari sekali.");
      return;
    }
    if (allocationTotal !== paymentAmount) {
      setError(`Total alokasi harus sama dengan ${formatRupiah(paymentAmount)}.`);
      return;
    }
    try {
      setError("");
      await payMutation.mutateAsync({
        id: String(paying.id),
        data: {
          nomor_pembayaran: payment.nomor_pembayaran.trim(),
          tanggal_bayar: payment.tanggal_bayar,
          catatan: payment.catatan.trim() || undefined,
          alokasi: allocations.map((item) => ({ dana_operasional_id: item.dana_operasional_id, nominal: Number(item.nominal) })),
        },
      });
    } catch (cause) {
      setError(apiErrorMessage(cause, "Pembayaran pengajuan gagal disimpan."));
    }
  }

  return (
    <section className="hris-page space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pengajuan Belanja</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pengajuan berbasis RO, reservasi pagu oleh KARWAS, dan pembayaran multi-kamar oleh Bendahara.</p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setForm(blankForm());
              setError("");
              setOpen(true);
            }}
          >
            <Plus size={18} /> Ajukan Belanja
          </Button>
        )}
      </header>
      <Card>
        <CardContent className="pt-4">
          {listQuery.isLoading && (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Memuat pengajuan belanja…
            </p>
          )}
          {listQuery.isError && (
            <p role="alert" className="py-8 text-center text-sm text-destructive">
              {apiErrorMessage(listQuery.error, "Gagal memuat pengajuan belanja.")}
            </p>
          )}
          {!listQuery.isLoading && !listQuery.isError && (
            <DataTable
              rows={rows}
              rowKey={(row, index) => String(row.id ?? index)}
              remoteSearch
              searchValue={search}
              searchPlaceholder="Cari kegiatan / kuitansi…"
              onSearchChange={setSearch}
              filters={[{ field: "status", label: "Status", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) }]}
              filterValues={{ status }}
              onFilterChange={(_field, value) => setStatus(value)}
              columns={[
                { key: "nomor_pengajuan", header: "Nomor", render: (row) => row.nomor_pengajuan ?? "—" },
                { key: "nama_kegiatan", header: "Kegiatan", render: (row) => row.nama_kegiatan ?? "—" },
                { key: "ro", header: "RO", render: (row) => (row.ro ? `${row.ro.kode_ro} · ${row.ro.nama_ro}` : "—") },
                { key: "tanggal", header: "Tanggal", render: (row) => (row.tanggal ? new Date(row.tanggal).toLocaleDateString("id-ID") : "—") },
                { key: "jumlah", header: "Jumlah", render: (row) => formatRupiah(row.jumlah) },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={statusTone(row.status)}>{statusLabels[row.status] ?? row.status ?? "—"}</StatusBadge> },
                ...(canReview || canPay
                  ? [
                      {
                        key: "aksi",
                        header: "Aksi",
                        render: (row: Row) => (
                          <div className="flex gap-2">
                            {canReview && row.status === "DIAJUKAN" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReviewing(row);
                                  setNote("");
                                  setError("");
                                }}
                              >
                                Review
                              </Button>
                            )}
                            {canPay && row.status === "DISETUJUI_KARWAS" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPaying(row);
                                  setPayment(blankPayment());
                                  setError("");
                                }}
                              >
                                <CircleDollarSign size={15} /> Bayar
                              </Button>
                            )}
                            {(!canReview || row.status !== "DIAJUKAN") && (!canPay || row.status !== "DISETUJUI_KARWAS") && "—"}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </CardContent>
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Ajukan Belanja"
        description="Pengajuan akan menunggu pemeriksaan KARWAS."
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={createMutation.isPending} onClick={submit}>
              {createMutation.isPending && <LoaderCircle className="animate-spin" size={16} />} Kirim Pengajuan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            RO *
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.ro_id} onChange={(event) => field("ro_id", event.target.value)} disabled={rosQuery.isLoading}>
              <option value="">Pilih RO</option>
              {ros.map((ro) => (
                <option key={String(ro.id)} value={String(ro.id)}>
                  {String(ro.kode_ro ?? "")} · {String(ro.nama_ro ?? "")}
                </option>
              ))}
            </select>
            {rosQuery.isError && <span className="text-xs text-destructive">{apiErrorMessage(rosQuery.error, "Gagal memuat RO.")}</span>}
            {!rosQuery.isLoading && !rosQuery.isError && !ros.length && <span className="text-xs text-amber-700">Tidak ada RO yang dapat dipilih untuk role ini.</span>}
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nama kegiatan *<Input maxLength={200} value={form.nama_kegiatan} onChange={(event) => field("nama_kegiatan", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal *<Input type="date" value={form.tanggal} onChange={(event) => field("tanggal", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            Jumlah *<MoneyInput value={form.jumlah} onValueChange={(value) => field("jumlah", value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Nomor kuitansi
            <Input maxLength={100} value={form.no_kuitansi} onChange={(event) => field("no_kuitansi", event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Keterangan
            <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={form.keterangan} onChange={(event) => field("keterangan", event.target.value)} />
          </label>
          {error && (
            <Alert variant="destructive" className="sm:col-span-2">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </Modal>
      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Review Pengajuan"
        description={reviewing ? `${String(reviewing.nama_kegiatan)} · ${formatRupiah(reviewing.jumlah)}` : "Review pengajuan belanja."}
        size="md"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Batal
            </Button>
            <Button variant="outline" disabled={reviewMutation.isPending} onClick={() => review(false)}>
              <X size={16} /> Tolak
            </Button>
            <Button disabled={reviewMutation.isPending} onClick={() => review(true)}>
              {reviewMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />} Reservasi Pagu
            </Button>
          </>
        }
      >
        <label className="grid gap-1 text-sm">
          Catatan pemeriksa
          <textarea className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan (opsional)" />
        </label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
      <Modal
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        title="Bayar Pengajuan"
        description={paying ? `${String(paying.nama_kegiatan)} · ${formatRupiah(paying.jumlah)}` : "Pembayaran pengajuan belanja."}
        size="lg"
        bodyClassName="space-y-4"
        footer={
          <>
            <Button variant="outline" onClick={() => setPaying(null)}>
              Batal
            </Button>
            <Button disabled={payMutation.isPending || fundsQuery.isLoading} onClick={pay}>
              {payMutation.isPending ? <LoaderCircle className="animate-spin" size={16} /> : <CircleDollarSign size={16} />} Simpan Pembayaran
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Nomor pembayaran *
            <Input maxLength={100} value={payment.nomor_pembayaran} onChange={(event) => setPayment((current) => ({ ...current, nomor_pembayaran: event.target.value }))} />
          </label>
          <label className="grid gap-1 text-sm">
            Tanggal bayar *
            <Input type="date" value={payment.tanggal_bayar} onChange={(event) => setPayment((current) => ({ ...current, tanggal_bayar: event.target.value }))} />
          </label>
        </div>
        <section className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Alokasi kamar dana operasional</h3>
              <p className="text-xs text-muted-foreground">Total alokasi wajib tepat sama dengan nilai pengajuan.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPayment((current) => ({ ...current, alokasi: [...current.alokasi, { dana_operasional_id: "", nominal: "" }] }))}>
              <Plus size={15} /> Tambah Kamar
            </Button>
          </div>
          {payment.alokasi.map((allocation, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_13rem_auto]">
              <select
                aria-label={`Kamar dana ${index + 1}`}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={allocation.dana_operasional_id}
                onChange={(event) => setPayment((current) => ({ ...current, alokasi: current.alokasi.map((item, itemIndex) => (itemIndex === index ? { ...item, dana_operasional_id: event.target.value } : item)) }))}
                disabled={fundsQuery.isLoading}
              >
                <option value="">Pilih kamar dana</option>
                {funds.map((fund) => (
                  <option key={String(fund.id)} value={String(fund.id)}>
                    {String(fund.nama_unit_koordinator ?? "Unit")} · {String(fund.kategori_kamar ?? "Dana").replaceAll("_", " ")} · sisa {formatRupiah(fund.sisa_saldo ?? fund.total_plafon)}
                  </option>
                ))}
              </select>
              <MoneyInput value={allocation.nominal} onValueChange={(value) => setPayment((current) => ({ ...current, alokasi: current.alokasi.map((item, itemIndex) => (itemIndex === index ? { ...item, nominal: value } : item)) }))} />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={`Hapus alokasi ${index + 1}`}
                disabled={payment.alokasi.length === 1}
                onClick={() => setPayment((current) => ({ ...current, alokasi: current.alokasi.filter((_, itemIndex) => itemIndex !== index) }))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
          {fundsQuery.isError && <p className="text-sm text-destructive">{apiErrorMessage(fundsQuery.error, "Gagal memuat dana operasional.")}</p>}
          <div className="flex flex-wrap justify-between gap-2 rounded-md bg-muted p-3 text-sm">
            <span>
              Dialokasikan: <strong>{formatRupiah(allocationTotal)}</strong>
            </span>
            <span>
              Harus dibayar: <strong>{formatRupiah(paymentAmount)}</strong>
            </span>
            <span className={allocationTotal === paymentAmount ? "text-emerald-700" : "text-destructive"}>
              Selisih: <strong>{formatRupiah(paymentAmount - allocationTotal)}</strong>
            </span>
          </div>
        </section>
        <label className="grid gap-1 text-sm">
          Catatan
          <textarea className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={500} value={payment.catatan} onChange={(event) => setPayment((current) => ({ ...current, catatan: event.target.value }))} />
        </label>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Modal>
    </section>
  );
}
