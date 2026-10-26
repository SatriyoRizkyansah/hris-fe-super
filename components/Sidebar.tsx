"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Check, Gauge, PanelLeftClose, PanelLeftOpen, UsersRound, Building2, UserCircle, BriefcaseBusiness, Wallet, Landmark, FileText, Banknote, ChartNoAxesCombined, Settings, UserCog, ClipboardCheck, X } from "lucide-react";
import { Button } from "@/components/ui/legacy-button";
import { LoadingCard } from "@/components/loading";
import { selectSessionRole, type RoleAccess } from "@/lib/auth";
import { browserApi } from "@/lib/api/browser-client";
import { useCurrentUser } from "@/lib/api/hooks";

const all = ["superadmin", "koordinator", "subkoor", "keuangan", "keu_billing", "keu_bendahara", "keu_karwas", "pimpinan", "spi", "karyawan"];
const finance = ["superadmin", "keuangan"];
const billing = [...finance, "keu_billing"];
const treasury = [...finance, "keu_bendahara"];
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
      { href: "/dashboard/proyek", label: "Proyek", icon: BriefcaseBusiness, roles: ["superadmin", "koordinator", "subkoor", "keuangan", "keu_billing", "keu_karwas", "pimpinan"] },
      { href: "/dashboard/termin", label: "Termin Proyek", icon: ClipboardCheck, roles: billing },
      { href: "/dashboard/invoice", label: "Invoice", icon: FileText, roles: ["superadmin", "keuangan", "keu_billing", "keu_bendahara", "pimpinan", "spi"] },
      { href: "/dashboard/pengajuan-belanja", label: "Pengajuan Belanja", icon: Wallet, roles: ["superadmin", "koordinator", "subkoor", "keu_bendahara", "keu_karwas", "pimpinan", "spi"] },
      { href: "/dashboard/ro", label: "RO", icon: ClipboardCheck, roles: ["superadmin", "koordinator", "subkoor", "keuangan", "keu_karwas"] },
      { href: "/dashboard/dana-operasional", label: "Dana Operasional", icon: Wallet, roles: ["superadmin", "keuangan", "keu_bendahara", "keu_karwas"] },
      { href: "/dashboard/rekening", label: "Rekening Bank", icon: Landmark, roles: treasury },
      { href: "/dashboard/mak", label: "MAK", icon: FileText, roles: finance },
      { href: "/dashboard/rekonsiliasi-bank", label: "Rekonsiliasi Bank", icon: ClipboardCheck, roles: treasury },
      { href: "/dashboard/pengaturan-margin", label: "Pengaturan Margin", icon: Settings, roles: ["superadmin"] },
    ],
  },
  { title: "Akun", items: [{ href: "/dashboard/profil", label: "Profil Saya", icon: UserCircle, roles: all }] },
];

type Props = { collapsed: boolean; open: boolean; onToggle: () => void; role?: string; accesses?: RoleAccess[]; activeToken?: string };
const roleLabels: Record<string, string> = {
  superadmin: "Superadmin",
  koordinator: "Koordinator",
  subkoor: "Subkoordinator",
  keuangan: "Keuangan",
  keu_billing: "Keuangan Billing",
  keu_bendahara: "Keuangan Bendahara",
  keu_karwas: "Keuangan KARWAS",
  pimpinan: "Pimpinan",
  spi: "SPI",
  karyawan: "Karyawan",
};
const allowedPath: Record<string, string[]> = {
  "/dashboard/pegawai": ["superadmin", "koordinator"],
  "/dashboard/unit-kerja": ["superadmin", "koordinator"],
  "/dashboard/proyek": ["superadmin", "koordinator", "subkoor", "keuangan", "keu_billing", "keu_karwas", "pimpinan"],
  "/dashboard/termin": ["superadmin", "keuangan", "keu_billing"],
  "/dashboard/invoice": ["superadmin", "keuangan", "keu_billing", "keu_bendahara", "pimpinan", "spi"],
  "/dashboard/pengajuan-belanja": ["superadmin", "koordinator", "subkoor", "keu_bendahara", "keu_karwas", "pimpinan", "spi"],
  "/dashboard/ro": ["superadmin", "koordinator", "subkoor", "keuangan", "keu_karwas"],
  "/dashboard/karwas": ["superadmin", "keu_karwas"],
  "/dashboard/dana-operasional": ["superadmin", "keuangan", "keu_bendahara", "keu_karwas"],
  "/dashboard/rekening": ["superadmin", "keuangan", "keu_bendahara"],
  "/dashboard/mak": ["superadmin", "keuangan"],
  "/dashboard/sk": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/alokasi-gaji": ["superadmin", "koordinator", "keuangan"],
  "/dashboard/rekonsiliasi-bank": ["superadmin", "keuangan", "keu_bendahara"],
  "/dashboard/pengguna": ["superadmin"],
  "/dashboard/pengaturan-margin": ["superadmin"],
  "/dashboard/profil": all,
};
const homeForRole = (value: string) =>
  value === "pimpinan" || value === "keu_karwas"
    ? "/dashboard/proyek"
    : value === "keu_billing"
      ? "/dashboard/termin"
      : value === "keuangan"
        ? "/dashboard/invoice"
        : value === "keu_bendahara"
          ? "/dashboard/pengajuan-belanja"
          : ["subkoor", "spi", "karyawan"].includes(value)
            ? "/dashboard/profil"
            : "/dashboard";

export default function Sidebar({ collapsed, open, onToggle, role = "", accesses = [], activeToken = "" }: Props) {
  const pathname = usePathname() ?? "";
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser({}, role === "koordinator");
  const isGeneralCoordinator = role === "koordinator" && currentUser.data?.unitKerjaKode === "ORG-UMUM";
  const canSeeOperationalFunds = isGeneralCoordinator || ["superadmin", "keuangan", "keu_bendahara", "keu_karwas"].includes(role);
  const [switching, setSwitching] = useState(false);
  const [accessPanelOpen, setAccessPanelOpen] = useState(false);
  const [accessPanelPosition, setAccessPanelPosition] = useState({ left: 12, mobile: false });
  const accessPanelRef = useRef<HTMLDivElement>(null);
  const accessCardRef = useRef<HTMLElement>(null);
  const accessButtonRef = useRef<HTMLButtonElement>(null);
  const roleOptions = accesses.filter((access, index, list) => list.findIndex((item) => item.token === access.token) === index);
  const currentAccess = roleOptions.find((access) => access.token === activeToken) ?? roleOptions.find((access) => access.role === role);
  useEffect(() => {
    if (!accessPanelOpen) return;
    const updatePanelPosition = () => {
      const mobile = window.matchMedia("(max-width: 1023.98px)").matches;
      const anchor = accessButtonRef.current?.getBoundingClientRect();
      const panelWidth = Math.min(320, window.innerWidth - 24);
      const left = mobile || !anchor
        ? 12
        : Math.max(12, Math.min(anchor.right + 12, window.innerWidth - panelWidth - 12));
      setAccessPanelPosition({ left, mobile });
    };
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [accessPanelOpen]);
  useEffect(() => {
    if (!accessPanelOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accessPanelRef.current?.contains(event.target) && !accessCardRef.current?.contains(event.target)) setAccessPanelOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccessPanelOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accessPanelOpen]);
  const canStayHere = (nextRole: string) => {
    const match = Object.keys(allowedPath)
      .sort((a, b) => b.length - a.length)
      .find((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (match === "/dashboard/dana-operasional" && nextRole === "koordinator") return isGeneralCoordinator;
    return !match || allowedPath[match].includes(nextRole);
  };
  function switchRole(nextToken: string | null) {
    if (!nextToken || switching) return;
    const access = roleOptions.find((item) => item.token === nextToken);
    if (!access || access.token === currentAccess?.token || !selectSessionRole(access)) return;
    setAccessPanelOpen(false);
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
            const visibleItems = section.items.filter((item) =>
              item.href === "/dashboard/dana-operasional" ? canSeeOperationalFunds : item.roles.includes(role),
            );
            if (!visibleItems.length) return null;
            return (
              <section key={section.title}>
                <p className="sidebar-title">{section.title}</p>
                <ul className="nav">
                  {visibleItems.map(({ href, label, icon: Icon }) => {
                    const active = href === "/dashboard" ? pathname === href : href === "/dashboard/alokasi-gaji" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className="nav-link"
                          aria-current={active ? "page" : undefined}
                          title={collapsed ? label : undefined}
                          onClick={href === "/dashboard/dana-operasional" ? (event) => {
                            event.preventDefault();
                            window.location.assign(href);
                          } : undefined}
                        >
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
            <div ref={accessPanelRef} className="relative mb-3 px-1" aria-label="Ganti role">
              {!collapsed && <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/55">Akses aktif</p>}
              <button
                type="button"
                ref={accessButtonRef}
                className="flex h-auto min-h-12 w-full items-center gap-2.5 rounded-2xl border border-black/10 bg-black/[0.06] px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-black/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:opacity-60"
                aria-label="Buka pilihan akses"
                aria-expanded={accessPanelOpen}
                aria-controls="sidebar-access-panel"
                onClick={() => setAccessPanelOpen((isOpen) => !isOpen)}
                disabled={switching}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-black text-[#ffe466] shadow-sm"><ArrowLeftRight size={16} /></span>
                {!collapsed && (
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-sm font-bold leading-5 text-black">{roleLabels[currentAccess?.role ?? role] ?? currentAccess?.role ?? role}</span>
                    <span className="block truncate text-[11px] font-medium leading-4 text-black/60">{roleOptions.length > 1 ? "Ganti akses" : "Satu akses tersedia"}</span>
                  </span>
                )}
              </button>
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
      {accessPanelOpen && typeof document !== "undefined" && createPortal(
        <section
          ref={accessCardRef}
          id="sidebar-access-panel"
          className={`fixed ${accessPanelPosition.mobile ? "right-3 w-auto" : "w-72 sm:w-80"} max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
          style={{ left: accessPanelPosition.left, bottom: 12, zIndex: 2147483000 }}
          aria-label="Semua hak akses"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Pilih akses</p>
              <p className="mt-0.5 text-xs text-slate-500">Pilih role untuk mengganti hak akses aktif.</p>
            </div>
            <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Tutup pilihan akses" onClick={() => setAccessPanelOpen(false)}><X size={16} /></button>
          </header>
          <div className="max-h-[min(65vh,28rem)] space-y-1 overflow-y-auto p-2">
            {roleOptions.map((access, index) => {
              const duplicateRole = roleOptions.filter((item) => item.role === access.role).length > 1;
              const active = access.token === currentAccess?.token;
              return (
                <button
                  key={access.token}
                  type="button"
                  disabled={switching}
                  aria-current={active ? "true" : undefined}
                  onClick={() => switchRole(access.token)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors disabled:opacity-60 ${active ? "bg-amber-50 text-slate-950" : "hover:bg-slate-50"}`}
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}><ArrowLeftRight size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{roleLabels[access.role] ?? access.role}</span>
                    {duplicateRole && <span className="block truncate text-xs text-slate-500">{access.akses || `Akses ${index + 1}`}</span>}
                  </span>
                  {active && <Check size={17} className="shrink-0 text-amber-700" />}
                </button>
              );
            })}
          </div>
        </section>,
        document.body,
      )}
    </aside>
  );
}
