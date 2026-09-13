"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import BottomNav from "@/components/BottomNav";

type RuntimeData = {
  camera_url: string | null;
  camera_online: boolean;
};

export default function CameraPage() {
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);
  const [cameraOnline, setCameraOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadCamera() {
    const { data, error } = await supabase
      .from("device_runtime")
      .select("camera_url,camera_online")
      .eq("device_id", "weather-ultra-01")
      .single();

    if (!error && data) {
      const runtime = data as RuntimeData;

      setCameraUrl(runtime.camera_url);
      setCameraOnline(runtime.camera_online);
    }

    setLoading(false);
  }

  useEffect(() => {
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">
          Camera
        </h1>

        {loading && (
          <div className="text-gray-400">
            Đang kết nối camera...
          </div>
        )}

        {!loading && (!cameraOnline || !cameraUrl) && (
          <div className="rounded-xl bg-zinc-900 p-6 text-center">
            <div className="text-red-400 font-semibold">
              Camera offline
            </div>

            <div className="text-sm text-gray-400 mt-2">
              Đang chờ Raspberry Pi kết nối lại.
            </div>
          </div>
        )}

        {!loading && cameraOnline && cameraUrl && (
          <>
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-green-400">
                Camera Online
              </span>
            </div>

            <div className="rounded-xl overflow-hidden bg-zinc-900">
              <img
                src={`${cameraUrl}/stream`}
                alt="Weather Ultra Camera"
                className="w-full h-auto"
              />
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
