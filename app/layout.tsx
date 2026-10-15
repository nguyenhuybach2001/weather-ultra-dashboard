import type { Metadata, Viewport } from "next";
import AppShell from "@/components/AppShell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Weather Ultra", template: "%s · Weather Ultra" },
  description:
    "Trạm quan trắc môi trường cá nhân: nhiệt độ, độ ẩm, CO₂, bụi mịn và camera trực tiếp.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Weather Ultra",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101e27",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
