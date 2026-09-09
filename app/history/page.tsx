"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type WeatherReading = {
  id: number;
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

type MetricKey =
  | "temperature"
  | "humidity"
  | "pressure"
  | "co2"
  | "pm25"
  | "lux"
  | "uv";

type MetricConfig = {
  key: MetricKey;
  name: string;
  unit: string;
};

const metrics: MetricConfig[] = [
  {
    key: "temperature",
    name: "Temperature",
    unit: "°C",
  },
  {
    key: "humidity",
    name: "Humidity",
    unit: "%",
  },
  {
    key: "pressure",
    name: "Pressure",
    unit: "hPa",
  },
  {
    key: "co2",
    name: "CO₂",
    unit: "ppm",
  },
  {
    key: "pm25",
    name: "PM2.5",
    unit: "µg/m³",
  },
  {
    key: "lux",
    name: "Light",
    unit: "lux",
  },
  {
    key: "uv",
    name: "UV",
    unit: "",
  },
];

export default function HistoryPage() {
  const [history, setHistory] = useState<WeatherReading[]>([]);
  const [metric, setMetric] = useState<MetricKey>("temperature");

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      try {
        const since = new Date(
          Date.now() - 24 * 60 * 60 * 1000,
        ).toISOString();

        const {
          data,
          error: supabaseError,
        } = await supabase
          .from("weather_readings")
          .select(
            `
            id,
            timestamp,
            temperature,
            humidity,
            pressure,
            co2,
            pm1,
            pm25,
            pm4,
            pm10,
            lux,
            uv,
            device_status
            `,
          )
          .eq("device_id", "weather-ultra-01")
          .gte("timestamp", since)
          .order("timestamp", {
            ascending: true,
          });

        if (supabaseError) {
          throw supabaseError;
        }

        if (active) {
          setHistory(
            (data ?? []) as WeatherReading[],
          );

          setError(false);
          setLoading(false);
        }
      } catch (err) {
        console.error(
          "Cannot load Supabase history:",
          err,
        );

        if (active) {
          setError(true);
          setLoading(false);
        }
      }
    };

    void loadHistory();

    const interval = setInterval(
      loadHistory,
      60_000,
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const currentMetric =
    metrics.find(
      (item) => item.key === metric,
    ) ?? metrics[0];

  const chartData = history.map((item) => ({
    ...item,

    time: new Date(
      item.timestamp,
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const latestValue =
    history.length > 0
      ? history[history.length - 1][metric]
      : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl p-5">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              HISTORY
            </h1>

            <p className="text-sm text-slate-400">
              Weather Ultra · Last 24 hours
            </p>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
          >
            ← Home
          </Link>
        </header>

        <section className="mb-5 flex flex-wrap gap-2">
          {metrics.map((item) => (
            <button
              key={item.key}
              onClick={() =>
                setMetric(item.key)
              }
              className={
                metric === item.key
                  ? "rounded-xl bg-white px-4 py-2 text-sm font-medium text-black"
                  : "rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300"
              }
            >
              {item.name}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-slate-400">
            Loading history...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-900 bg-red-950/30 p-5 text-red-300">
            Không thể tải dữ liệu lịch sử từ
            Supabase.
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="text-sm text-slate-400">
                  {currentMetric.name}
                </div>

                <div className="mt-1 text-3xl font-bold">
                  {latestValue ?? "--"}{" "}

                  <span className="text-base font-normal text-slate-400">
                    {currentMetric.unit}
                  </span>
                </div>
              </div>

              <div className="text-right text-xs text-slate-500">
                <div>
                  {history.length} readings
                </div>

                <div>
                  Last 24 hours
                </div>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="flex h-[360px] items-center justify-center text-slate-500">
                Chưa có dữ liệu lịch sử.
              </div>
            ) : (
              <div className="h-[360px] w-full">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={chartData}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      opacity={0.15}
                    />

                    <XAxis
                      dataKey="time"
                      tick={{
                        fontSize: 11,
                      }}
                      minTickGap={40}
                    />

                    <YAxis
                      tick={{
                        fontSize: 11,
                      }}
                      width={55}
                    />

                    <Tooltip
                      contentStyle={{
                        backgroundColor:
                          "#0f172a",
                        border:
                          "1px solid #334155",
                        borderRadius: "12px",
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey={metric}
                      stroke="currentColor"
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}