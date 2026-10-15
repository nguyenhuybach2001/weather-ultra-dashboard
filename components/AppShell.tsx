"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "./BottomNav";
import { PwaProvider, InstallBanner } from "./PwaProvider";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [kiosk, setKiosk] = useState(false);
  useEffect(() => {
    const enabled = new URLSearchParams(location.search).get("kiosk") === "1";
    // Hydrate a browser-only URL preference after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKiosk(enabled);
  }, []);
  return (
    <PwaProvider>
      <div className={`app-shell ${kiosk ? "kiosk" : ""}`}>
        <a href="#content" className="skip-link">
          Đến nội dung
        </a>
        <aside className="sidebar">
          <Link href="/" className="brand">
            <span className="brand-mark">
              W<span>°</span>
            </span>
            <span>
              weather<span className="brand-sub">ULTRA / ENVIRONMENT</span>
            </span>
          </Link>
          <p className="nav-caption">KHÔNG GIAN CỦA BẠN</p>
          <BottomNav />
          <div className="sidebar-note">
            <span className="status-dot" />
            Trạm quan trắc cá nhân
            <p>
              Hiểu môi trường.
              <br />
              Chủ động mỗi ngày.
            </p>
          </div>
        </aside>
        <div className="workspace" id="content">
          <div className="topbar">
            <span>
              WEATHER ULTRA <span className="topbar-divider">/</span> STATION 01
            </span>
            <button className="quiet-button" onClick={() => setKiosk(!kiosk)}>
              {kiosk ? "Thoát kiosk" : "Chế độ kiosk"}
            </button>
          </div>
          <InstallBanner />
          {children}
          <footer className="app-footer">
            WEATHER ULTRA{" "}
            <span>
              Dữ liệu môi trường tại thiết bị · ESP32-S3 + Raspberry Pi 5
            </span>
          </footer>
        </div>
      </div>
    </PwaProvider>
  );
}
