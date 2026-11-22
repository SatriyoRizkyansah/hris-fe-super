"use client";

import { use_query } from "@/lib/api/use_query";
import { bodyData, requestHrisApi } from "@/lib/hris/api";

type PreviewEnvelope = { nomor_pembayaran: string };

/**
 * Mengambil pratinjau nomor pembayaran otomatis (`<tahun><urut 6 digit>`).
 *
 * Endpoint pratinjau bersifat read-only, jadi nomor boleh dibaca berulang kali
 * tanpa menghabiskan urutan. Nomor hanya mengikat setelah pembayaran disimpan.
 */
export function useNomorPembayaranPreview({ enabled, tanggal }: { enabled: boolean; tanggal: string }) {
  const previewQuery = use_query({
    tag: "keuanganPembayaran",
    method: "nomorPembayaranPreview",
    params: { tanggal },
    enabled: enabled && Boolean(tanggal),
    queryFn: async ({ tanggal: value }) => requestHrisApi(`/api/keuangan/pembayaran/nomor-preview?tanggal=${encodeURIComponent(value)}`),
  });
  // `requestHrisApi` mengembalikan envelope mentah, jadi cukup buka satu lapis `data`.
  const preview = bodyData<PreviewEnvelope>(previewQuery.data);
  const nomorOtomatis = preview?.nomor_pembayaran ?? "";
  return {
    nomorOtomatis,
    isLoading: previewQuery.isLoading,
    /** Placeholder siap pakai: nomor otomatis, atau status pemuatannya. */
    placeholder: nomorOtomatis || (previewQuery.isLoading ? "Menyiapkan nomor otomatis…" : "Nomor otomatis belum tersedia"),
  };
}

/** Panel pratinjau nomor pembayaran. Tidak menampilkan apa pun bila nomor belum tersedia. */
export function NomorPembayaranPreview({ nomor, className }: { nomor: string; className?: string }) {
  if (!nomor) return null;
  return (
    <div className={className ?? "rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs"}>
      <p className="font-semibold">Nomor yang akan dibuat sistem</p>
      <p className="mt-1 font-mono text-sm font-medium">{nomor}</p>
      <p className="mt-1 text-muted-foreground">Nomor ini baru terpakai setelah pembayaran disimpan.</p>
    </div>
  );
}
