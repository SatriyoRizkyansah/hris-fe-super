"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, PanelLeftClose, PanelLeftOpen, UsersRound, Building2, UserCircle, BriefcaseBusiness, Wallet, Landmark, FileText, Banknote, ChartNoAxesCombined, Settings, UserCog, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/legacy-button";

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
      { href: "/dashboard/proyek", label: "Proyek", icon: BriefcaseBusiness, roles: ["superadmin", "koordinator", "keuangan", "pimpinan"] },
      { href: "/dashboard/ro", label: "RO", icon: ClipboardCheck, roles: ["superadmin", "koordinator", "keuangan"] },
      { href: "/dashboard/dana-operasional", label: "Dana Operasional", icon: Wallet, roles: ["superadmin", "koordinator", "keuangan"] },
      { href: "/dashboard/rekening", label: "Rekening Bank", icon: Landmark, roles: finance },
      { href: "/dashboard/mak", label: "MAK", icon: FileText, roles: ["superadmin", "keuangan", "koordinator"] },
      { href: "/dashboard/rekonsiliasi-bank", label: "Rekonsiliasi Bank", icon: ClipboardCheck, roles: finance },
      { href: "/dashboard/pengaturan-margin", label: "Pengaturan Margin", icon: Settings, roles: ["superadmin"] },
    ],
  },
  { title: "Akun", items: [{ href: "/dashboard/profil", label: "Profil Saya", icon: UserCircle, roles: all }] },
];

type Props = { collapsed: boolean; open: boolean; onToggle: () => void; role?: string };

export default function Sidebar({ collapsed, open, onToggle, role = "" }: Props) {
  const pathname = usePathname() ?? "";

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
                    const active = href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
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
