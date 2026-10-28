"use client";

import { readSession, SESSION_COOKIE } from "@/lib/auth";

export type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T;
  pagination?: {
    page?: number;
    limit?: number;
    total_datas?: number;
    total_pages?: number;
  };
};

export class HrisApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "HrisApiError";
    this.status = status;
  }
}

export function unwrapEnvelope<T>(value: unknown): ApiEnvelope<T> {
  const response = value && typeof value === "object" && "data" in value ? (value as { data?: unknown }).data : value;
  return (response && typeof response === "object" ? response : {}) as ApiEnvelope<T>;
}

export function envelopeRows<T>(value: unknown): T[] {
  const envelope = unwrapEnvelope<T[]>(value);
  return Array.isArray(envelope.data) ? envelope.data : [];
}

export function envelopeData<T>(value: unknown): T | null {
  const envelope = unwrapEnvelope<T>(value);
  return envelope.data ?? null;
}

export function apiErrorMessage(error: unknown, fallback = "Permintaan gagal diproses.") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

function browserToken() {
  if (typeof document === "undefined") return "";
  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return readSession(cookie)?.token ?? "";
}

export async function uploadHrisFile(path: string, file: File, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  const token = browserToken();
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new HrisApiError(body?.message ?? "Unggah dokumen gagal.", response.status);
  return body;
}
