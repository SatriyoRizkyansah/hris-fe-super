"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeftRight, Check, Gauge, PanelLeftClose, PanelLeftOpen, UsersRound, Building2, UserCircle, BriefcaseBusiness, Wallet, Landmark, FileText, Banknote, ChartNoAxesCombined, Settings, UserCog, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/legacy-button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LoadingCard } from "@/components/loading";
import { selectSessionRole, type RoleAccess } from "@/lib/auth";
import { browserApi } from "@/lib/api/browser-client";

const all = ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan", "spi", "karyawan"];
const finance = ["superadmin", "keuangan"];
const coordinators = ["superadmin", "koordinator"];
const sections = [
  { title: "Ringkasan", items: [{ href: "/dashboard", label: "Dashboard", icon: Gauge, roles: all }] },
  {
    title: "Kepegawaian",
    items: [
      { href: "/dashboard/pegawai", label: "Pegawai", icon: UsersRound, roles: coordinators },
      { href: "/dashboard/unit-kerja", label: "Unit Kerja", icon: Building2, roles: coordinators },
      { href: "/dashboard/sk", label: "Surat Keputusan", icon: FileText, roles: ["superadmin", "koordinator", "keuangan"] },
      { href: "/dashboard/alokasi-gaji", label: "Alokasi Gaji", icon: Banknote, roles: ["superadmin", "koordinator", "keuangan"] },
      { href: "/dashboard/alokasi-gaji/rekap", label: "Rekap Alokasi", icon: ChartNoAxesCombined, roles: ["superadmin", "koordinator", "keuangan"] },
      { href: "/dashboard/pengguna", label: "Pengguna", icon: UserCog, roles: ["superadmin"] },
    ],
  },
  {
    title: "Keuangan",
    items: [
      { href: "/dashboard/proyek", label: "Proyek", icon: BriefcaseBusiness, roles: ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan"] },
      { href: "/dashboard/termin", label: "Termin Proyek", icon: ClipboardCheck, roles: finance },
      { href: "/dashboard/ro", label: "RO", icon: ClipboardCheck, roles: ["superadmin", "koordinator", "subkoor", "keuangan"] },
      { href: "/dashboard/dana-operasional", label: "Dana Operasional", icon: Wallet, roles: ["superadmin", "koordinator", "keuangan"] },
      { href: "/dashboard/rekening", label: "Rekening Bank", icon: Landmark, roles: finance },
      { href: "/dashboard/mak", label: "MAK", icon: FileText, roles: finance },
      { href: "/dashboard/rekonsiliasi-bank", label: "Rekonsiliasi Bank", icon: ClipboardCheck, roles: finance },
      { href: "/dashboard/pengaturan-margin", label: "Pengaturan Margin", icon: Settings, roles: ["superadmin"] },
    ],
  },
  { title: "Akun", items: [{ href: "/dashboard/profil", label: "Profil Saya", icon: UserCircle, roles: all }] },
];

type Props = { collapsed: boolean; open: boolean; onToggle: () => void; role?: string; accesses?: RoleAccess[]; activeToken?: string };
const roleLabels: Record<string, string> = { superadmin: "Superadmin", koordinator: "Koordinator", subkoor: "Subkoordinator", keuangan: "Keuangan", pimpinan: "Pimpinan", spi: "SPI", karyawan: "Karyawan" };
const allowedPath: Record<string, string[]> = {
  "/dashboard/pegawai": ["superadmin", "koordinator"],
  "/dashboard/unit-kerja": ["superadmin", "koordinator"],
  "/dashboard/proyek": ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan"],
  "/dashboard/ro": ["superadmin", "koordinator", "subkoor", "keuangan"],
  "/dashboard/dana-operasional": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/rekening": ["superadmin", "keuangan"],
  "/dashboard/mak": ["superadmin", "keuangan"],
  "/dashboard/sk": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/alokasi-gaji": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/rekonsiliasi-bank": ["superadmin", "keuangan"],
  "/dashboard/pengguna": ["superadmin"],
  "/dashboard/pengaturan-margin": ["superadmin"],
  "/dashboard/profil": ["superadmin", "koordinator", "subkoor", "keuangan", "pimpinan", "spi", "karyawan"],
};
const homeForRole = (value: string) => (value === "pimpinan" ? "/dashboard/proyek" : value === "keuangan" ? "/dashboard/termin" : ["subkoor", "spi", "karyawan"].includes(value) ? "/dashboard/profil" : "/dashboard");

export default function Sidebar({ collapsed, open, onToggle, role = "", accesses = [], activeToken = "" }: Props) {
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const [switching, setSwitching] = useState(false);
  const roleOptions = accesses.filter((access, index, list) => list.findIndex((item) => item.token === access.token) === index);
  const currentAccess = roleOptions.find((access) => access.token === activeToken) ?? roleOptions.find((access) => access.role === role);
  const canStayHere = (nextRole: string) => {
    const match = Object.keys(allowedPath)
      .sort((a, b) => b.length - a.length)
      .find((path) => pathname === path || pathname.startsWith(`${path}/`));
    return !match || allowedPath[match].includes(nextRole);
  };
  function switchRole(nextToken: string | null) {
    if (!nextToken || switching) return;
    const access = roleOptions.find((item) => item.token === nextToken);
    if (!access || access.token === currentAccess?.token || !selectSessionRole(access)) return;
    setSwitching(true);
    queryClient.clear();
    browserApi.setSecurityData(access.token);
    window.location.assign(canStayHere(access.role) ? pathname : homeForRole(access.role));
  }

  return (
    <aside className="sidebar-slot" data-open={open} data-collapsed={collapsed}>
      <nav className="sidebar" aria-label="Navigasi template">
        <div className="sidebar-menu">
          {sections.map((section) => {
            const visibleItems = section.items.filter((item) => item.roles.includes(role));
            if (!visibleItems.length) return null;
            return (
              <section key={section.title}>
                <p className="sidebar-title">{section.title}</p>
                <ul className="nav">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = href === "/dashboard" ? pathname === href : href === "/dashboard/alokasi-gaji" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={href}>
                        <Link href={href} className="nav-link" aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
                          <Icon size={20} aria-hidden="true" />
                          <span className="nav-label">{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <div className="sidebar-foot">
          {roleOptions.length > 0 && (
            <div className="mb-3 px-1" aria-label="Ganti role">
              {!collapsed && <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/55">Akses aktif</p>}
              <Select value={currentAccess?.token ?? ""} onValueChange={switchRole}>
                <SelectTrigger
                  className="h-auto min-h-12 w-full rounded-2xl border border-black/10 bg-black/[0.06] px-2.5 py-2 text-left shadow-sm hover:bg-black/[0.1] focus-visible:ring-black/20 [&>svg:last-child]:hidden"
                  aria-label="Pilih role"
                  disabled={switching}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-black text-[#ffe466] shadow-sm">
                      <ArrowLeftRight size={16} />
                    </span>
                    {!collapsed && (
                      <span className="min-w-0 flex-1 py-0.5">
                        <span className="block truncate text-left text-sm font-bold leading-5 text-black">{roleLabels[currentAccess?.role ?? role] ?? currentAccess?.role ?? role}</span>
                        <span className="block truncate text-left text-[11px] font-medium leading-4 text-black/60">{roleOptions.length > 1 ? "Ganti akses" : "Satu akses tersedia"}</span>
                      </span>
                    )}
                  </span>
                </SelectTrigger>
                <SelectContent align="end" side="top" sideOffset={8} className="w-[var(--anchor-width)] rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl">
                  <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Pilih akses</div>
                  {roleOptions.map((access, index) => {
                    const duplicateRole = roleOptions.filter((item) => item.role === access.role).length > 1;
                    return (
                      <SelectItem key={access.token} value={access.token} disabled={switching} className="min-h-12 rounded-xl px-3 py-2 focus:bg-amber-100 focus:text-black data-[selected]:bg-amber-50">
                        <span className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
                            <ArrowLeftRight size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{roleLabels[access.role] ?? access.role}</span>
                            {duplicateRole && <span className="block truncate text-[11px] text-muted-foreground">{access.akses || `Akses ${index + 1}`}</span>}
                          </span>
                          {access.token === currentAccess?.token && <Check size={16} className="text-amber-700" />}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
          {switching && <LoadingCard label="Mengganti role…" />}
          {/* <Skyline className="sidebar-skyline" /> */}
          {/* <p className="sidebar-tagline">
            Energi untuk
            <br />
            Ketahanan Negeri
          </p> */}
          <Button type="button" variant="dark" size="sm" className="collapse-btn" onClick={onToggle}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            <span className="nav-label only-desktop">{collapsed ? "Perbesar" : "Perkecil"}</span>
            <span className="only-mobile">Tutup</span>
          </Button>
        </div>
      </nav>
    </aside>
  );
}
