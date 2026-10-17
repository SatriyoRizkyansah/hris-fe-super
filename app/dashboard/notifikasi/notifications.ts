"use client";

import { useQuery } from "@tanstack/react-query";

export type Notification = {
  id: string;
  pesan: string;
  tanggalKirim: string;
  sudahDibaca: boolean;
  pengadaan: { id: string; nomorSurat: string | null; judul: string } | null;
};

/** Backend schema does not expose notification endpoints; keep this template-only view inert. */
export function useNotifications() {
  return useQuery<never[], Error>({ queryKey: ["notifications", "unsupported"], queryFn: async () => [] });
}

export function useMarkNotificationRead() {
  return { mutate: () => undefined, isPending: false };
}

export function useMarkAllNotificationsRead() {
  return { mutate: () => undefined, isPending: false };
}
