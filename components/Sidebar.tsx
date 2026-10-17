"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/legacy-button";

const sections = [
  {
    title: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: Gauge, exact: true }],
  },
];

type Props = { collapsed: boolean; open: boolean; onToggle: () => void };

export default function Sidebar({ collapsed, open, onToggle }: Props) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="sidebar-slot" data-open={open} data-collapsed={collapsed}>
      <nav className="sidebar" aria-label="Navigasi template">
        <div className="sidebar-menu">
          {sections.map((section) => (
            <section key={section.title}>
              <p className="sidebar-title">{section.title}</p>
              <ul className="nav">
                {section.items.map(({ href, label, icon: Icon, ...item }) => {
                  const active = "exact" in item && item.exact ? pathname === href : pathname.startsWith(href);
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
          ))}
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
