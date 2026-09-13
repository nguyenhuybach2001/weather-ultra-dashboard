"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type LatestReading = {
  device_id: string;
  timestamp: string;

  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  co2: number | null;

  pm1: number | null;
  pm25: number | null;
  pm4: number | null;
  pm10: number | null;

  lux: number | null;
  uv: number | null;

  device_status: string;
};

type RuntimeStatus = {
  camera_url: string | null;
  camera_online: boolean;
};

export default function SystemPage() {
  const [reading, setReading] =
    useState<LatestReading | null>(null);

  const [runtime, setRuntime] =
    useState<RuntimeStatus | null>(null);

  const [loading, setLoading] = useState(true);
  const [cloudError, setCloudError] = useState(false);

  const [realtimeConnected, setRealtimeConnected] =
    useState(false);

  const [runtimeRealtimeConnected, setRuntimeRealtimeConnected] =
    useState(false);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("device_latest")
          .select("*")
          .eq(
            "device_id",
            "weather-ultra-01",
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (active) {
          setReading(
            data as LatestReading | null,
          );

          setCloudError(false);
        }
      } catch (err) {
        console.error(
          "Cannot load system status:",
          err,
        );

        if (active) {
          setCloudError(true);
        }
      }
    };

    const loadRuntime = async () => {
      try {
        const { data, error } = await supabase
          .from("device_runtime")
          .select("camera_url,camera_online")
          .eq(
            "device_id",
            "weather-ultra-01",
          )
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (active) {
          setRuntime(
            data as RuntimeStatus | null,
          );
        }
      } catch (err) {
        console.error(
          "Cannot load runtime status:",
          err,
        );
      }
    };

    const loadAll = async () => {
      await Promise.all([
        loadStatus(),
        loadRuntime(),
      ]);

      if (active) {
        setLoading(false);
      }
    };

    void loadAll();

    const channel = supabase
      .channel("weather-ultra-system")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_latest",
          filter:
            "device_id=eq.weather-ultra-01",
        },
        (payload) => {
          if (
            payload.new &&
            Object.keys(payload.new).length > 0
          ) {
            setReading(
              payload.new as LatestReading,
            );

            setCloudError(false);
            setNow(Date.now());
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeConnected(false);
        }
      });

    const runtimeChannel = supabase
      .channel("weather-ultra-runtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_runtime",
          filter:
            "device_id=eq.weather-ultra-01",
        },
        (payload) => {
          if (
            payload.new &&
            Object.keys(payload.new).length > 0
          ) {
            setRuntime(
              payload.new as RuntimeStatus,
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRuntimeRealtimeConnected(true);
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRuntimeRealtimeConnected(false);
        }
      });

    const clock = setInterval(() => {
      setNow(Date.now());
    }, 5000);

    return () => {
      active = false;

      clearInterval(clock);

      void supabase.removeChannel(
        channel,
      );

      void supabase.removeChannel(
        runtimeChannel,
      );
    };
  }, []);

  const ageSeconds = reading
    ? Math.max(
        0,
        Math.floor(
          (now -
            new Date(
              reading.timestamp,
            ).getTime()) /
            1000,
        ),
      )
    : null;

  let deviceStatus = "offline";

  if (ageSeconds !== null) {
    if (ageSeconds < 30) {
      deviceStatus = "online";
    } else if (ageSeconds < 60) {
      deviceStatus = "delayed";
    }
  }

  const systemStatus =
    !cloudError &&
    deviceStatus === "online"
      ? "online"
      : deviceStatus === "delayed"
        ? "delayed"
        : "offline";

  const sensorStatus = (
    value: number | null | undefined,
  ) => {
    return value === null ||
      value === undefined
      ? "waiting"
      : "online";
  };

  const sps30Online =
    reading?.pm1 !== null &&
    reading?.pm1 !== undefined
      ? true
      : reading?.pm25 !== null &&
          reading?.pm25 !== undefined
        ? true
        : reading?.pm4 !== null &&
            reading?.pm4 !== undefined
          ? true
          : reading?.pm10 !== null &&
            reading?.pm10 !== undefined;

  const cameraStatus =
    runtime?.camera_online &&
    runtime?.camera_url
      ? "online"
      : "offline";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-5">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              SYSTEM
            </h1>

            <p className="text-sm text-slate-400">
              Weather Ultra system status
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            ← Home
          </Link>
        </header>

        {loading ? (
          <div className="text-slate-400">
            Loading system status...
          </div>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatusCard
                name="System"
                status={systemStatus}
              />

              <StatusCard
                name="Cloud Database"
                status={
                  cloudError
                    ? "error"
                    : "online"
                }
              />

              <StatusCard
                name="Realtime"
                status={
                  realtimeConnected
                    ? "online"
                    : "offline"
                }
              />

              <StatusCard
                name="Data Source"
                status="serial"
              />
            </section>

            <h2 className="mb-3 text-lg font-semibold">
              Controllers
            </h2>

            <section className="mb-6 grid grid-cols-2 gap-3">
              <StatusCard
                name="Raspberry Pi"
                status={deviceStatus}
              />

              <StatusCard
                name="ESP32-S3"
                status={deviceStatus}
              />
            </section>

            <h2 className="mb-3 text-lg font-semibold">
              Sensors
            </h2>

            <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatusCard
                name="SHT45"
                status={
                  reading?.temperature !==
                    null &&
                  reading?.temperature !==
                    undefined &&
                  reading?.humidity !==
                    null &&
                  reading?.humidity !==
                    undefined
                    ? "online"
                    : "waiting"
                }
              />

              <StatusCard
                name="BMP390"
                status={sensorStatus(
                  reading?.pressure,
                )}
              />

              <StatusCard
                name="SCD41"
                status={sensorStatus(
                  reading?.co2,
                )}
              />

              <StatusCard
                name="SPS30"
                status={
                  sps30Online
                    ? "online"
                    : "waiting"
                }
              />

              <StatusCard
                name="VEML7700"
                status={sensorStatus(
                  reading?.lux,
                )}
              />

              <StatusCard
                name="GUVA-S12SD"
                status={sensorStatus(
                  reading?.uv,
                )}
              />
            </section>

            <h2 className="mb-3 text-lg font-semibold">
              Extra Modules
            </h2>

            <section className="mb-6 grid grid-cols-2 gap-3">
              <StatusCard
                name="Camera"
                status={cameraStatus}
              />

              <StatusCard
                name="Voice"
                status="waiting"
              />
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 text-sm font-semibold">
                Device information
              </div>

              <div className="grid gap-2 text-sm text-slate-400">
                <div>
                  Device ID:{" "}
                  <span className="text-white">
                    {reading?.device_id ??
                      "--"}
                  </span>
                </div>

                <div>
                  Last update:{" "}
                  <span className="text-white">
                    {reading
                      ? new Date(
                          reading.timestamp,
                        ).toLocaleString()
                      : "--"}
                  </span>
                </div>

                <div>
                  Update age:{" "}
                  <span className="text-white">
                    {ageSeconds !== null
                      ? `${ageSeconds}s`
                      : "--"}
                  </span>
                </div>

                <div>
                  Cloud realtime:{" "}
                  <span className="text-white">
                    {realtimeConnected
                      ? "Connected"
                      : "Disconnected"}
                  </span>
                </div>

                <div>
                  Camera realtime:{" "}
                  <span className="text-white">
                    {runtimeRealtimeConnected
                      ? "Connected"
                      : "Disconnected"}
                  </span>
                </div>

                <div>
                  Camera tunnel:{" "}
                  <span className="text-white">
                    {runtime?.camera_url
                      ? "Available"
                      : "Unavailable"}
                  </span>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatusCard({
  name,
  status,
}: {
  name: string;
  status: string;
}) {
  const normalized =
    status.toLowerCase();

  const indicator = "●";

  let textClass =
    "text-slate-400";

  if (
    normalized === "online" ||
    normalized === "ready" ||
    normalized === "serial"
  ) {
    textClass =
      "text-emerald-400";
  }

  if (
    normalized === "waiting" ||
    normalized === "simulated" ||
    normalized === "simulator" ||
    normalized === "delayed"
  ) {
    textClass =
      "text-amber-400";
  }

  if (
    normalized === "offline" ||
    normalized === "error"
  ) {
    textClass =
      "text-red-400";
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="text-sm text-slate-400">
        {name}
      </div>

      <div
        className={`mt-2 font-semibold ${textClass}`}
      >
        {indicator}{" "}
        {status.toUpperCase()}
      </div>
    </div>
  );
}
