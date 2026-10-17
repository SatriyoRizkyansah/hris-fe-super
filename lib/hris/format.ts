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
  if (status === "DISETUJUI_PIMPINAN") return "ok";
  if (status?.startsWith("DITOLAK")) return "danger";
  if (status?.startsWith("MENUNGGU")) return "warn";
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
