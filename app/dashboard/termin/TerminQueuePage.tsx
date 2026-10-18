"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Banknote, CircleAlert, Clock3, LoaderCircle, Search, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { browserApi } from "@/lib/api/browser-client";
import { setBrowserToken } from "@/lib/api/hooks";
import { use_query } from "@/lib/api/use_query";
import { envelopeRows } from "@/lib/hris/api";
import { formatRupiah, humanizeStatus } from "@/lib/hris/format";

const STATUS = ["MENUNGGU_VALIDASI_KEUANGAN", "DISETUJUI_KEUANGAN", "DITOLAK_KEUANGAN", "CAIR"] as const;
type TerminStatus = (typeof STATUS)[number];
type QueueRow = {
  id: string;
  proyek_id: string;
  nomor_termin: number;
  persentase: number;
  nilai_termin: number;
  status: TerminStatus;
  catatan_keuangan?: string | null;
  created_at: string;
  proyek: { id: string; kode_proyek: string; nama_proyek: string; tahun_fiscal: number; status_proyek: string; termin_list?: { nomor_termin: number; status: TerminStatus }[] };
};
type DialogAction = { row: QueueRow; type: "validate" | "payout" } | null;
const money = (value: number) => formatRupiah(Number(value) || 0);
const date = (value?: string | null) => (value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(value)) : "—");
const tone: Record<TerminStatus, string> = {
  MENUNGGU_VALIDASI_KEUANGAN: "border-amber-200 bg-amber-50 text-amber-800",
  DISETUJUI_KEUANGAN: "border-sky-200 bg-sky-50 text-sky-800",
  DITOLAK_KEUANGAN: "border-rose-200 bg-rose-50 text-rose-800",
  CAIR: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export default function TerminQueuePage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [year, setYear] = useState("ALL");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogAction>(null);
  const [approved, setApproved] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const queue = use_query({
    tag: "masterProyek",
    method: "termin-queue",
    params: { search, status, year, page },
    queryFn: async () => {
      setBrowserToken();
      return browserApi.masterProyek.proyekControllerGetTerminQueue({
        query: search || undefined,
        status: status === "ALL" ? undefined : status,
        tahun_fiscal: year === "ALL" ? undefined : Number(year),
        page,
        limit: 20,
      });
    },
  });
  const response = (queue.data ?? {}) as { data?: unknown; pagination?: { total_pages?: number; total_datas?: number }; summary?: Partial<Record<TerminStatus, number>> };
  const rows = envelopeRows<QueueRow>(queue.data);
  const summary = response.summary ?? {};
  const pagination = response.pagination;
  const years = Array.from(new Set(rows.map((row) => row.proyek.tahun_fiscal))).sort((a, b) => b - a);
  const previousUnpaid = (row: QueueRow) => row.proyek.termin_list?.find((item) => item.nomor_termin < row.nomor_termin && item.status !== "CAIR");

  async function submitAction() {
    if (!dialog) return;
    if (dialog.type === "validate" && !approved && !note.trim()) {
      setError("Catatan penolakan wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      setBrowserToken();
      if (dialog.type === "validate") {
        await browserApi.masterProyek.proyekControllerValidasiTerminKeuangan(dialog.row.proyek_id, dialog.row.id, { disetujui: approved, catatan: note.trim() || undefined });
      } else {
        await browserApi.masterProyek.proyekControllerCairkanTermin(dialog.row.proyek_id, dialog.row.id);
      }
      setDialog(null);
      setNote("");
      await queue.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memproses termin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 p-4 md:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-sky-700">Keuangan / Proyek</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Termin Proyek</h1>
          <p className="mt-2 text-sm text-muted-foreground">Validasi pengajuan dan proses pencairan termin proyek.</p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 text-sm">
          <span className="text-muted-foreground">Perlu ditindaklanjuti</span>
          <strong className="ml-3 text-lg">{(summary.MENUNGGU_VALIDASI_KEUANGAN ?? 0) + (summary.DISETUJUI_KEUANGAN ?? 0)}</strong>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATUS.map((key) => (
          <Card key={key} className="border-0 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">{humanizeStatus(key)}</p>
                <p className="mt-1 text-2xl font-bold">{summary[key] ?? 0}</p>
              </div>
              <span className={`rounded-xl p-3 ${tone[key]}`}>
                <Clock3 size={20} />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative w-full lg:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
            <Input
              className="pl-9"
              placeholder="Cari nama atau kode proyek"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="flex gap-2">
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Semua status</option>
              {STATUS.map((key) => (
                <option key={key} value={key}>
                  {humanizeStatus(key)}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-white px-3 text-sm"
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Semua tahun</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
        {queue.isLoading ? (
          <div className="flex justify-center p-12">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : queue.isError ? (
          <div className="p-8 text-center text-sm text-rose-700">Gagal memuat antrean termin.</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Banknote className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-medium">Tidak ada termin pada filter ini</p>
            <p className="mt-1 text-sm text-muted-foreground">Ubah filter atau pencarian.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Proyek</th>
                    <th className="px-5 py-3">Termin</th>
                    <th className="px-5 py-3">Nilai</th>
                    <th className="px-5 py-3">Status proyek</th>
                    <th className="px-5 py-3">Status termin</th>
                    <th className="px-5 py-3">Diajukan</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/proyek/${row.proyek_id}`} className="font-semibold hover:text-sky-700">
                          {row.proyek.nama_proyek}
                          <ArrowUpRight className="ml-1 inline" size={14} />
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.proyek.kode_proyek} · {row.proyek.tahun_fiscal}
                        </p>
                      </td>
                      <td className="px-5 py-4 font-medium">
                        Termin {row.nomor_termin}
                        <p className="text-xs text-muted-foreground">{row.persentase}%</p>
                      </td>
                      <td className="px-5 py-4 font-semibold">{money(row.nilai_termin)}</td>
                      <td className="px-5 py-4">{humanizeStatus(row.proyek.status_proyek)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone[row.status]}`}>{humanizeStatus(row.status)}</span>
                        {row.status === "DITOLAK_KEUANGAN" && row.catatan_keuangan && (
                          <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground" title={row.catatan_keuangan}>
                            {row.catatan_keuangan}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">{date(row.created_at)}</td>
                      <td className="px-5 py-4">
                        {row.status === "MENUNGGU_VALIDASI_KEUANGAN" ? (
                          previousUnpaid(row) ? (
                            <span className="text-xs text-amber-700">Menunggu Termin {previousUnpaid(row)?.nomor_termin} cair</span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                setApproved(true);
                                setError("");
                                setNote("");
                                setDialog({ row, type: "validate" });
                              }}
                            >
                              Validasi
                            </Button>
                          )
                        ) : row.status === "DISETUJUI_KEUANGAN" && row.proyek.status_proyek === "DISETUJUI_PIMPINAN" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setError("");
                              setDialog({ row, type: "payout" });
                            }}
                          >
                            <Wallet className="mr-1" size={15} />
                            Cairkan
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{row.status === "DISETUJUI_KEUANGAN" ? "Menunggu persetujuan Pimpinan" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-3 md:hidden">
              {rows.map((row) => (
                <article key={row.id} className="rounded-xl border p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">{row.proyek.nama_proyek}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.proyek.kode_proyek} · {row.proyek.tahun_fiscal}
                      </p>
                    </div>
                    <span className={`h-fit rounded-full border px-2 py-1 text-[11px] ${tone[row.status]}`}>{humanizeStatus(row.status)}</span>
                  </div>
                  <div className="mt-4 flex justify-between border-t pt-3">
                    <div>
                      <p className="text-sm font-medium">
                        Termin {row.nomor_termin} · {row.persentase}%
                      </p>
                      <p className="text-sm font-bold">{money(row.nilai_termin)}</p>
                    </div>
                    {row.status === "MENUNGGU_VALIDASI_KEUANGAN" ? (
                      previousUnpaid(row) ? (
                        <span className="self-center text-xs text-amber-700">Menunggu Termin {previousUnpaid(row)?.nomor_termin} cair</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => {
                            setApproved(true);
                            setError("");
                            setNote("");
                            setDialog({ row, type: "validate" });
                          }}
                        >
                          Validasi
                        </Button>
                      )
                    ) : row.status === "DISETUJUI_KEUANGAN" && row.proyek.status_proyek === "DISETUJUI_PIMPINAN" ? (
                      <Button size="sm" onClick={() => setDialog({ row, type: "payout" })}>
                        Cairkan
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
            <footer className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {pagination?.total_datas ?? rows.length} termin · halaman {page} dari {Math.max(1, pagination?.total_pages ?? 1)}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Sebelumnya
                </Button>
                <Button variant="outline" size="sm" disabled={page >= (pagination?.total_pages ?? 1)} onClick={() => setPage((current) => current + 1)}>
                  Berikutnya
                </Button>
              </div>
            </footer>
          </>
        )}
      </section>
      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setDialog(null);
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="termin-action-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-sky-700">{dialog.type === "validate" ? "Validasi Keuangan" : "Konfirmasi pencairan"}</p>
                <h2 id="termin-action-title" className="mt-1 text-xl font-bold">
                  {dialog.type === "validate" ? `Termin ${dialog.row.nomor_termin}` : "Cairkan termin ini?"}
                </h2>
              </div>
              <button aria-label="Tutup" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setDialog(null)}>
                <X size={18} />
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {dialog.row.proyek.nama_proyek} · {dialog.row.proyek.kode_proyek}
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-muted-foreground">Nilai termin</p>
              <p className="text-xl font-bold">{money(dialog.row.nilai_termin)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{dialog.row.persentase}% dari kontrak</p>
            </div>
            {dialog.type === "validate" ? (
              <>
                <fieldset className="mt-4 flex gap-4">
                  <legend className="mb-2 text-sm font-medium">Keputusan</legend>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="termin-decision" checked={approved} onChange={() => setApproved(true)} />
                    Setujui
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" name="termin-decision" checked={!approved} onChange={() => setApproved(false)} />
                    Tolak
                  </label>
                </fieldset>
                {!approved && (
                  <label className="mt-4 grid gap-1.5 text-sm font-medium">
                    Catatan penolakan
                    <Input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Jelaskan alasan penolakan" />
                  </label>
                )}
              </>
            ) : (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <CircleAlert className="shrink-0" size={18} />
                <p>Dana akan dialokasikan ke RO terlebih dahulu. Sisa dana masuk ke dana operasional proyek.</p>
              </div>
            )}
            {error && (
              <p role="alert" className="mt-3 text-sm text-rose-700">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setDialog(null)}>
                Batal
              </Button>
              <Button disabled={saving} variant={dialog.type === "validate" && !approved ? "destructive" : "default"} onClick={submitAction}>
                {saving ? <LoaderCircle className="mr-2 animate-spin" size={16} /> : null}
                {dialog.type === "payout" ? "Konfirmasi pencairan" : approved ? "Kirim keputusan" : "Tolak termin"}
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
