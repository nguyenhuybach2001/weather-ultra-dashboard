"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cameraUnavailable, type CameraRuntime } from "@/lib/camera-status";

function CameraMessage({
  title,
  children,
  retry,
}: {
  title: string;
  children: React.ReactNode;
  retry?: () => void;
}) {
  return (
    <section className="empty-state" role="status">
      <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>
        ▧
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>
        {title}
      </h2>
      <p style={{ margin: "12px auto 20px", maxWidth: 480 }}>{children}</p>
      {retry && (
        <button className="secondary-button" onClick={retry}>
          Thử kết nối lại
        </button>
      )}
    </section>
  );
}

function CameraStream({ url }: { url: string }) {
  const img = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<"connecting" | "ready" | "failed">(
    "connecting",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    // MJPEG may not fire load until its response ends. Check for a decoded frame
    // instead of relying only on onLoad for an indefinitely streaming response.
    const started = Date.now();
    const timer = setInterval(() => {
      if (img.current && img.current.naturalWidth > 0) setStatus("ready");
      else if (Date.now() - started >= 10000) setStatus("failed");
    }, 250);
    return () => clearInterval(timer);
  }, [attempt]);
  const retry = () => {
    setStatus("connecting");
    setAttempt((a) => a + 1);
  };
  return (
    <>
      {status === "failed" && (
        <CameraMessage title="Không nhận được hình ảnh camera" retry={retry}>
          Luồng camera đang mất kết nối hoặc không truy cập được. Kiểm tra
          camera, nguồn Pi 5 và kết nối mạng.
        </CameraMessage>
      )}
      {status === "connecting" && (
        <CameraMessage title="Đang kết nối camera…">
          Đang chờ hình ảnh từ trạm. Nếu không nhận được hình, thông báo lỗi sẽ
          xuất hiện sau tối đa 10 giây.
        </CameraMessage>
      )}
      {status !== "failed" && (
        <div
          className="camera-frame"
          style={
            status === "ready"
              ? undefined
              : { height: 0, minHeight: 0, overflow: "hidden" }
          }
        >
          {/* MJPEG must remain a native image rather than an optimized Next image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={attempt}
            ref={img}
            src={`${url.replace(/\/$/, "")}/stream`}
            alt="Weather Ultra Camera"
            className="w-full h-auto"
            onError={() => setStatus("failed")}
          />
        </div>
      )}
      {status === "ready" && (
        <p className="mt-3 text-sm" style={{ color: "var(--green)" }}>
          ● Đã kết nối luồng camera
        </p>
      )}
    </>
  );
}

export default function CameraPage() {
  const [runtime, setRuntime] = useState<CameraRuntime | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let sequence = 0;
    let controller: AbortController | undefined;
    async function loadCamera() {
      if (inFlight) return;
      inFlight = true;
      const requestSequence = ++sequence;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 6000);
      try {
        const { data, error } = await supabase
          .from("device_runtime")
          .select("camera_url,camera_online,pi_online,pi_last_seen")
          .eq("device_id", "weather-ultra-01")
          .abortSignal(controller.signal)
          .maybeSingle();
        if (!active || requestSequence !== sequence) return;
        if (error) throw error;
        setRuntime(data as CameraRuntime | null);
        setError(false);
      } catch {
        if (active && requestSequence === sequence) setError(true);
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (active) {
          setNow(Date.now());
          setLoading(false);
        }
      }
    }
    void loadCamera();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const polling = setInterval(() => void loadCamera(), 2000);
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void loadCamera();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    const channel = supabase
      .channel("device-runtime-camera")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_runtime",
          filter: "device_id=eq.weather-ultra-01",
        },
        (payload) => {
          if (!active) return;
          ++sequence; // Do not let an older HTTP response overwrite a Realtime update.
          setRuntime(
            payload.eventType === "DELETE"
              ? null
              : (payload.new as CameraRuntime),
          );
          setNow(Date.now());
          setError(false);
          setLoading(false);
        },
      )
      .subscribe();
    return () => {
      active = false;
      controller?.abort();
      clearInterval(clock);
      clearInterval(polling);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [retry]);
  const unavailable = cameraUnavailable(runtime, now);
  const reload = () => {
    setLoading(true);
    setRetry((r) => r + 1);
  };
  return (
    <main className="page">
      <div className="camera-page">
        <header className="page-heading">
          <div>
            <div className="eyebrow">QUAN SÁT TẠI TRẠM</div>
            <h1>Camera</h1>
            <p>Hình ảnh từ Raspberry Pi 5</p>
          </div>
        </header>
        {loading ? (
          <CameraMessage title="Đang kiểm tra camera…">
            Đang lấy trạng thái kết nối của trạm.
          </CameraMessage>
        ) : error ? (
          <CameraMessage
            title="Chưa xác định được trạng thái camera"
            retry={reload}
          >
            Không thể kiểm tra trạng thái trạm. Hãy kiểm tra kết nối mạng; ứng
            dụng đang tự thử lại.
          </CameraMessage>
        ) : unavailable ? (
          <CameraMessage title="Camera đang offline" retry={reload}>
            {unavailable}
          </CameraMessage>
        ) : (
          <CameraStream key={runtime!.camera_url!} url={runtime!.camera_url!} />
        )}
      </div>
    </main>
  );
}
