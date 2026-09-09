"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { supabase } from "@/lib/supabase";


type WeatherData = {
  device_id?: string;
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


function formatValue(
  value: number | null | undefined,
  digits = 1,
  unit = "",
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "--";
  }

  return `${value.toFixed(digits)}${unit}`;
}


export default function Home() {
  const [weather, setWeather] =
    useState<WeatherData | null>(null);

  const [error, setError] =
    useState(false);

  const [realtimeConnected, setRealtimeConnected] =
    useState(false);


  useEffect(() => {
    let active = true;


    async function loadInitialData() {
      const {
        data,
        error: loadError,
      } = await supabase
        .from("device_latest")
        .select("*")
        .eq(
          "device_id",
          "weather-ultra-01",
        )
        .maybeSingle();


      if (!active) {
        return;
      }


      if (loadError) {
        console.error(
          "Supabase initial data error:",
          loadError,
        );

        setError(true);

        return;
      }


      if (!data) {
        console.warn(
          "No device_latest data found",
        );

        setError(true);

        return;
      }


      setWeather(
        data as WeatherData,
      );

      setError(false);
    }


    void loadInitialData();


    const channel = supabase
      .channel(
        "weather-ultra-live",
      )
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
          if (!active) {
            return;
          }


          console.log(
            "Supabase realtime:",
            payload.new,
          );


          if (
            payload.new &&
            Object.keys(
              payload.new,
            ).length > 0
          ) {
            setWeather(
              payload.new as WeatherData,
            );

            setError(false);
          }
        },
      )
      .subscribe(
        (status) => {
          console.log(
            "Realtime status:",
            status,
          );


          if (!active) {
            return;
          }


          if (
            status ===
            "SUBSCRIBED"
          ) {
            setRealtimeConnected(
              true,
            );

            setError(false);
          }


          if (
            status ===
              "CHANNEL_ERROR" ||
            status ===
              "TIMED_OUT" ||
            status ===
              "CLOSED"
          ) {
            setRealtimeConnected(
              false,
            );

            setError(true);
          }
        },
      );


    return () => {
      active = false;

      void supabase.removeChannel(
        channel,
      );
    };
  }, []);


  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl p-5">

        <header className="mb-8 flex items-center justify-between">

          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              WEATHER ULTRA
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Intelligent Environmental Monitoring Station
            </p>
          </div>


          <div className="flex items-center gap-4">

            <Link
              href="/system"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
            >
              System
            </Link>

            <Link
              href="/history"
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
            >
              History
            </Link>


            <div
              className={
                error
                  ? "text-red-400"
                  : "text-emerald-400"
              }
            >
              ●{" "}
              {error
                ? "OFFLINE"
                : realtimeConnected
                  ? "LIVE"
                  : "ONLINE"}
            </div>

          </div>
        </header>


        {!weather ? (

          <div className="py-20 text-center text-slate-400">
            Đang kết nối Weather Ultra...
          </div>

        ) : (

          <>

            <section className="mb-8 text-center">

              <div className="text-7xl font-bold">
                {formatValue(
                  weather.temperature,
                  1,
                  "°C",
                )}
              </div>

              <div className="mt-2 text-lg text-slate-400">
                Current Temperature
              </div>

            </section>


            <section className="grid grid-cols-2 gap-4 md:grid-cols-3">

              <SensorCard
                title="Humidity"
                value={formatValue(
                  weather.humidity,
                  1,
                  " %",
                )}
              />

              <SensorCard
                title="Pressure"
                value={formatValue(
                  weather.pressure,
                  1,
                  " hPa",
                )}
              />

              <SensorCard
                title="CO₂"
                value={formatValue(
                  weather.co2,
                  0,
                  " ppm",
                )}
              />

              <SensorCard
                title="PM2.5"
                value={formatValue(
                  weather.pm25,
                  1,
                  " µg/m³",
                )}
              />

              <SensorCard
                title="Light"
                value={formatValue(
                  weather.lux,
                  1,
                  " lux",
                )}
              />

              <SensorCard
                title="UV"
                value={formatValue(
                  weather.uv,
                  1,
                )}
              />

            </section>


            <section className="mt-6">

              <h2 className="mb-3 text-lg font-semibold">
                Particulate Matter
              </h2>


              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <SmallCard
                  title="PM1.0"
                  value={weather.pm1}
                />

                <SmallCard
                  title="PM2.5"
                  value={weather.pm25}
                />

                <SmallCard
                  title="PM4"
                  value={weather.pm4}
                />

                <SmallCard
                  title="PM10"
                  value={weather.pm10}
                />

              </div>
            </section>


            <footer className="mt-8 text-center text-xs text-slate-500">

              Last update:{" "}

              {new Date(
                weather.timestamp,
              ).toLocaleString()}

            </footer>

          </>
        )}

      </div>
    </main>
  );
}


function SensorCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

      <div className="text-sm text-slate-400">
        {title}
      </div>

      <div className="mt-2 text-2xl font-semibold">
        {value}
      </div>

    </div>
  );
}


function SmallCard({
  title,
  value,
}: {
  title: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">

      <div className="text-xs text-slate-400">
        {title}
      </div>

      <div className="mt-1 text-xl font-semibold">
        {formatValue(
          value,
          1,
        )}
      </div>

      <div className="text-xs text-slate-500">
        µg/m³
      </div>

    </div>
  );
}
