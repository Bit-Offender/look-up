"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "Today" },
  { href: "/journal", label: "Journal" },
];

export default function NavBar() {
  const path = usePathname();
  if (path.startsWith("/away")) return null; // phone-away screen stays clean

  return (
    <nav className="nav" aria-label="Main">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}