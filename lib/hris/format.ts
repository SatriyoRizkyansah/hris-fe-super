export function formatRupiah(value: unknown) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value) || 0);
}

export function formatDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function projectStatusTone(status?: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "DISETUJUI_PIMPINAN" || status === "SELESAI") return "ok";
  if (status?.startsWith("DITOLAK")) return "danger";
  if (status?.startsWith("MENUNGGU") || status?.startsWith("PERLU_REVISI_")) return "warn";
  return "neutral";
}

export function roStatusTone(status?: string): "ok" | "warn" | "danger" | "neutral" {
  if (status === "AKTIF") return "ok";
  if (status === "NONAKTIF") return "warn";
  if (status === "SELESAI") return "neutral";
  return "neutral";
}

export function humanizeStatus(status?: string) {
  return status ? status.replaceAll("_", " ") : "—";
}

export function projectStatusLabel(status?: string) {
  if (status === "MENUNGGU_VALIDASI_LAYANAN") return "Menunggu pemeriksaan Koordinator Layanan";
  if (status === "MENUNGGU_NOTULEN") return "Menunggu notulen";
  if (status === "MENUNGGU_VALIDASI_UMUM") return "Menunggu validasi Bagian Umum";
  if (status === "MENUNGGU_VALIDASI_PIMPINAN") return "Menunggu persetujuan Pimpinan";
  if (status === "PERLU_REVISI_LAYANAN") return "Perlu revisi · Koordinator Layanan";
  if (status === "PERLU_REVISI_UMUM") return "Perlu revisi · Bagian Umum";
  if (status === "PERLU_REVISI_PIMPINAN") return "Perlu revisi · Pimpinan";
  if (status === "DITOLAK_LAYANAN") return "Ditolak Koordinator Layanan";
  if (status === "DITOLAK_UMUM") return "Ditolak Bagian Umum";
  if (status === "DITOLAK_PIMPINAN") return "Ditolak Pimpinan";
  if (status === "DISETUJUI_PIMPINAN") return "Berjalan · Disetujui Pimpinan";
  if (status === "SELESAI") return "Selesai · BAST diunggah";
  return humanizeStatus(status);
}
