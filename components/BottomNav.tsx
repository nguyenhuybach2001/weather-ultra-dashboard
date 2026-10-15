"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [
  { href: "/", label: "Tổng quan", icon: "◉" },
  { href: "/history", label: "Lịch sử", icon: "⌁" },
  { href: "/camera", label: "Camera", icon: "▣" },
  { href: "/system", label: "Thiết bị", icon: "▤" },
  { href: "/settings", label: "Cài đặt", icon: "⚙" },
];
export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="main-nav" aria-label="Điều hướng chính">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
