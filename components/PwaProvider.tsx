"use client";
import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
type PwaState = {
  ready: boolean;
  ios: boolean;
  installed: boolean;
  secure: boolean;
  supported: boolean;
  registration: ServiceWorkerRegistration | null;
  install: (() => Promise<void>) | null;
  error: string;
};
const Context = createContext<PwaState>({
  ready: false,
  ios: false,
  installed: false,
  secure: false,
  supported: false,
  registration: null,
  install: null,
  error: "",
});
export const usePwa = () => useContext(Context);
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PwaState>({
    ready: false,
    ios: false,
    installed: false,
    secure: false,
    supported: false,
    registration: null,
    install: null,
    error: "",
  });
  useEffect(() => {
    let active = true;
    const display = matchMedia("(display-mode: standalone)");
    const installed = () =>
      display.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    // Browser capability detection is unavailable during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({
      ...s,
      ready: true,
      installed: installed(),
      ios:
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
      secure: isSecureContext,
      supported:
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    }));
    const onInstall = (event: Event) => {
      event.preventDefault();
      const e = event as InstallEvent;
      setState((s) => ({
        ...s,
        install: async () => {
          await e.prompt();
          await e.userChoice;
          setState((s) => ({ ...s, install: null }));
        },
      }));
    };
    const onInstalled = () =>
      setState((s) => ({ ...s, installed: installed(), install: null }));
    const appInstalled = () =>
      setState((s) => ({ ...s, installed: true, install: null }));
    addEventListener("beforeinstallprompt", onInstall);
    addEventListener("appinstalled", appInstalled);
    display.addEventListener("change", onInstalled);
    if (isSecureContext && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (active) setState((s) => ({ ...s, registration }));
        })
        .catch(() => {
          if (active)
            setState((s) => ({
              ...s,
              error: "Chưa khởi tạo được dịch vụ thông báo. Hãy tải lại trang.",
            }));
        });
    }
    return () => {
      active = false;
      removeEventListener("beforeinstallprompt", onInstall);
      removeEventListener("appinstalled", appInstalled);
      display.removeEventListener("change", onInstalled);
    };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function InstallBanner() {
  const pwa = usePwa();
  const [dismissed, setDismissed] = useState(false);
  // Read the browser-only persisted preference after hydration.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(sessionStorage.getItem("install-dismissed") === "1");
    } catch {}
  }, []);
  if (!pwa.ready || pwa.installed || dismissed) return null;
  return (
    <div className="install-banner">
      <span>Mang Weather Ultra lên màn hình chính của bạn.</span>
      <Link href="/settings">Cài ứng dụng ↗</Link>
      <button
        aria-label="Ẩn gợi ý cài ứng dụng"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem("install-dismissed", "1");
          } catch {}
        }}
      >
        ×
      </button>
    </div>
  );
}
