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

  const [loading, setLoading] =
    useState(true);

  const [cloudError, setCloudError] =
    useState(false);

  const [
    realtimeConnected,
    setRealtimeConnected,
  ] = useState(false);

  const [
    runtimeRealtimeConnected,
    setRuntimeRealtimeConnected,
  ] = useState(false);

  const [now, setNow] =
    useState(Date.now());

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const { data, error } =
          await supabase
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
        const { data, error } =
          await supabase
            .from("device_runtime")
            .select(
              "camera_url,camera_online",
            )
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
            Object.keys(
              payload.new,
            ).length > 0
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
      .channel(
        "weather-ultra-runtime",
      )
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
            Object.keys(
              payload.new,
            ).length > 0
          ) {
            setRuntime(
              payload.new as RuntimeStatus,
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRuntimeRealtimeConnected(
            true,
          );
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRuntimeRealtimeConnected(
            false,
          );
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

  /*
   * Tuổi của bản ghi ESP32 mới nhất.
   *
   * ESP32 gửi dữ liệu khoảng
   * mỗi 10 giây.
   */
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

  /*
   * ESP32 STATUS
   *
   * < 30s  = online
   * 30-60s = delayed
   * > 60s  = offline
   */
  let esp32Status:
    | "online"
    | "delayed"
    | "offline" = "offline";

  if (ageSeconds !== null) {
    if (ageSeconds < 4) {
      esp32Status = "online";
    } else if (ageSeconds < 7) {
      esp32Status = "delayed";
    }
  }

  /*
   * CAMERA STATUS
   */
  const cameraStatus =
    runtime?.camera_online &&
    runtime?.camera_url
      ? "online"
      : "offline";

  /*
   * RASPBERRY PI STATUS
   *
   * Camera tunnel chạy trên Pi.
   * Nếu camera online thì chắc chắn
   * Pi đang hoạt động.
   *
   * Nếu camera chưa sẵn sàng nhưng
   * ESP32 vẫn đang gửi dữ liệu,
   * Pi cũng vẫn được xem là online.
   */
  const raspberryPiStatus =
    cameraStatus === "online" ||
    esp32Status === "online" ||
    esp32Status === "delayed"
      ? "online"
      : "offline";

  /*
   * SYSTEM STATUS
   */
  let systemStatus:
    | "online"
    | "delayed"
    | "offline"
    | "error" = "offline";

  if (cloudError) {
    systemStatus = "error";
  } else if (
    raspberryPiStatus === "offline"
  ) {
    systemStatus = "offline";
  } else if (
    esp32Status === "online"
  ) {
    systemStatus = "online";
  } else {
    /*
     * Pi vẫn online nhưng ESP32
     * delayed/offline.
     *
     * Hệ thống vẫn chạy nhưng
     * phần đo cảm biến có vấn đề.
     */
    systemStatus = "delayed";
  }

  /*
   * STATUS CHO SENSOR ĐƠN
   */
  const sensorStatus = (
    value: number | null | undefined,
  ) => {
    if (esp32Status === "offline") {
      return "offline";
    }

    if (esp32Status === "delayed") {
      return "delayed";
    }

    if (
      value === null ||
      value === undefined
    ) {
      return "waiting";
    }

    return "online";
  };

  /*
   * SHT45 có 2 giá trị:
   * temperature + humidity
   */
  const sht45Status = (() => {
    if (esp32Status === "offline") {
      return "offline";
    }

    if (esp32Status === "delayed") {
      return "delayed";
    }

    const hasTemperature =
      reading?.temperature !== null &&
      reading?.temperature !==
        undefined;

    const hasHumidity =
      reading?.humidity !== null &&
      reading?.humidity !==
        undefined;

    return hasTemperature &&
      hasHumidity
      ? "online"
      : "waiting";
  })();

  /*
   * SPS30 có nhiều giá trị PM.
   */
  const sps30HasData =
    (reading?.pm1 !== null &&
      reading?.pm1 !== undefined) ||
    (reading?.pm25 !== null &&
      reading?.pm25 !== undefined) ||
    (reading?.pm4 !== null &&
      reading?.pm4 !== undefined) ||
    (reading?.pm10 !== null &&
      reading?.pm10 !== undefined);

  const sps30Status = (() => {
    if (esp32Status === "offline") {
      return "offline";
    }

    if (esp32Status === "delayed") {
      return "delayed";
    }

    return sps30HasData
      ? "online"
      : "waiting";
  })();

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
                status={
                  raspberryPiStatus
                }
              />

              <StatusCard
                name="ESP32-S3"
                status={esp32Status}
              />
            </section>

            <h2 className="mb-3 text-lg font-semibold">
              Sensors
            </h2>

            <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatusCard
                name="SHT45"
                status={sht45Status}
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
                status={sps30Status}
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
                  Last sensor update:{" "}
                  <span className="text-white">
                    {reading
                      ? new Date(
                          reading.timestamp,
                        ).toLocaleString()
                      : "--"}
                  </span>
                </div>

                <div>
                  Sensor update age:{" "}
                  <span className="text-white">
                    {ageSeconds !== null
                      ? `${ageSeconds}s`
                      : "--"}
                  </span>
                </div>

                <div>
                  Raspberry Pi:{" "}
                  <span className="text-white">
                    {raspberryPiStatus.toUpperCase()}
                  </span>
                </div>

                <div>
                  ESP32-S3:{" "}
                  <span className="text-white">
                    {esp32Status.toUpperCase()}
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
