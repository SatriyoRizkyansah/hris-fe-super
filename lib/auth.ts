export const SESSION_COOKIE = "lemigas_session";

export const HRIS_ROLES = ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan", "spi", "karyawan"] as const;
export type HrisRole = (typeof HRIS_ROLES)[number];
export function normalizeRole(value: string): HrisRole | null {
  const role = value
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/[\s_-]+/g, "");
  const aliases: Record<string, HrisRole> = { superadmin: "superadmin", koordinator: "koordinator", subkoor: "subkoor", subkoordinator: "subkoor", keuangan: "keuangan", pimpinan: "pimpinan", spi: "spi", karyawan: "karyawan" };
  return aliases[role] ?? null;
}
export function roleHome(role: string): string {
  if (["subkoor", "spi", "karyawan"].includes(role)) return "/dashboard/profil";
  return "/dashboard";
}

export type User = { name: string; role: string; email: string; initials: string };
export type Session = { token: string; user: User };

export function setSession(token: string, user: Omit<User, "initials">, remember: boolean) {
  const maxAge = remember ? `; max-age=${60 * 60 * 24 * 30}` : "";
  const session: Session = { token, user: { ...user, initials: makeInitials(user.name) } };
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}; path=/; samesite=lax${maxAge}`;
}

export function clearSession() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function makeInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "")).toUpperCase();
}

export function readSession(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<Session>;
    if (typeof parsed.token !== "string" || !parsed.user || typeof parsed.user.name !== "string") return null;
    return { token: parsed.token, user: { ...parsed.user, initials: makeInitials(parsed.user.name), role: parsed.user.role || "staff", email: parsed.user.email || "" } };
  } catch {
    return null;
  }
}

export function userFromIdentity(value: string | undefined): User {
  const session = readSession(value);
  return session?.user ?? { name: "Pengguna", role: "staff", email: "", initials: "P" };
}
