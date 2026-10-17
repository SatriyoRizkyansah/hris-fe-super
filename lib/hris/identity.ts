"use client";

import { normalizeRole, readSession, SESSION_COOKIE, type HrisRole } from "@/lib/auth";

type TokenClaims = { sub?: string; unitKerjaId?: string; unit_kerja_id?: string; role?: string };

function readTokenClaims(token: string): TokenClaims {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return {};
    const json = atob(
      encoded
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(encoded.length / 4) * 4, "="),
    );
    return JSON.parse(json) as TokenClaims;
  } catch {
    return {};
  }
}

export function browserIdentity() {
  if (typeof document === "undefined") return { role: null as HrisRole | null, userId: "", unitKerjaId: "", token: "" };
  const value = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  const session = readSession(value);
  const claims = readTokenClaims(session?.token ?? "");
  return {
    role: normalizeRole(claims.role ?? session?.user.role ?? ""),
    userId: claims.sub ?? "",
    unitKerjaId: claims.unitKerjaId ?? claims.unit_kerja_id ?? "",
    token: session?.token ?? "",
  };
}
