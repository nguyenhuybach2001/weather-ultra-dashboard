"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  {
    href: "/",
    label: "Home",
  },
  {
    href: "/history",
    label: "History",
  },
  {
    href: "/camera",
    label: "Camera",
  },
  {
    href: "/system",
    label: "System",
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-4 gap-2">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-xl bg-white px-3 py-3 text-center text-sm font-semibold text-slate-950"
                : "rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-center text-sm text-slate-300"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
