import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "lemigas_session";
const roleAccess: Record<string, string[]> = {
  "/dashboard/pegawai": ["superadmin", "koordinator"],
  "/dashboard/unit-kerja": ["superadmin", "koordinator"],
  "/dashboard/proyek": ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan"],
  "/dashboard/termin": ["superadmin", "keuangan"],
  "/dashboard/ro": ["superadmin", "koordinator", "subkoor", "keuangan"],
  "/dashboard/dana-operasional": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/rekening": ["superadmin", "keuangan"],
  "/dashboard/mak": ["superadmin", "keuangan"],
  "/dashboard/sk": ["superadmin", "koordinator"],
  "/dashboard/alokasi-gaji": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/rekonsiliasi-bank": ["superadmin", "keuangan"],
  "/dashboard/pengguna": ["superadmin"],
  "/dashboard/pengaturan-margin": ["superadmin"],
  "/dashboard/profil": ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan", "spi", "karyawan"],
};
const protectedPrefixes = ["/dashboard", ...Object.keys(roleAccess)];
const roleHome = (role: string) => (role === "pimpinan" ? "/dashboard/proyek" : role === "keuangan" ? "/dashboard/termin" : ["subkoor", "spi", "karyawan"].includes(role) ? "/dashboard/profil" : "/dashboard");

function readIdentity(cookie?: string): { role?: string } | null {
  if (!cookie) return null;
  try {
    const session = JSON.parse(decodeURIComponent(cookie));
    return typeof session?.token === "string" && typeof session?.user?.role === "string" ? session.user : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const identity = readIdentity(req.cookies.get(SESSION_COOKIE)?.value);
  const protectedPath = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  if (protectedPath && !identity) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  if (pathname === "/login" && identity) return NextResponse.redirect(new URL(roleHome(identity.role ?? ""), req.url));

  if (identity && protectedPath) {
    const match = Object.keys(roleAccess)
      .sort((a, b) => b.length - a.length)
      .find((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    const roles = match ? roleAccess[match] : undefined;
    if (roles && !roles.includes(identity.role ?? "")) return NextResponse.redirect(new URL(roleHome(identity.role ?? ""), req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
