"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type RuntimeData = {
  camera_url: string | null;
  camera_online: boolean;
};

export default function CameraPage() {
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);
  const [cameraOnline, setCameraOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadCamera() {
      const { data, error } = await supabase
        .from("device_runtime")
        .select("camera_url,camera_online")
        .eq("device_id", "weather-ultra-01")
        .single();

      if (!active) return;
      if (!error && data) {
        const runtime = data as RuntimeData;

        setCameraUrl(runtime.camera_url);
        setCameraOnline(runtime.camera_online);
      }

      setLoading(false);
    }

    loadCamera();

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
          const runtime = payload.new as RuntimeData;

          setCameraUrl(runtime.camera_url);
          setCameraOnline(runtime.camera_online);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="page">
      <div className="camera-page">
        <h1 className="text-2xl font-bold mb-4">Camera</h1>

        {loading && <div className="text-gray-400">Đang kết nối camera...</div>}

        {!loading && (!cameraOnline || !cameraUrl) && (
          <div className="empty-state">
            <div className="text-red-400 font-semibold">Camera offline</div>

            <div className="text-sm text-gray-400 mt-2">
              Đang chờ Raspberry Pi kết nối lại.
            </div>
          </div>
        )}

        {!loading && cameraOnline && cameraUrl && (
          <>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-green-400">Camera Online</span>
            </div>

            <div className="camera-frame">
              {/* MJPEG is a continuous stream, so Next Image optimization is unsuitable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${cameraUrl}/stream`}
                alt="Weather Ultra Camera"
                className="w-full h-auto"
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
