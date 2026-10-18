"use client";
import MicrophoneStatus from "@/components/MicrophoneStatus";

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

function formatValue(value: number | null | undefined, digits = 1, unit = "") {
  if (value === null || value === undefined) {
    return "--";
  }

  return `${value.toFixed(digits)}${unit}`;
}

export default function Home() {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const [now, setNow] = useState(0);
  const [error, setError] = useState(false);

  const [realtimeConnected, setRealtimeConnected] = useState(false);

  useEffect(() => {
    let active = true;
    const clock = setInterval(() => setNow(Date.now()), 1000);

    async function loadInitialData() {
      const { data, error: loadError } = await supabase
        .from("device_latest")
        .select("*")
        .eq("device_id", "weather-ultra-01")
        .maybeSingle();

      if (!active) {
        return;
      }

      if (loadError) {
        console.error("Supabase initial data error:", loadError);

        setError(true);

        return;
      }

      if (!data) {
        console.warn("No device_latest data found");

        setError(true);

        return;
      }

      setWeather(data as WeatherData);

      setError(false);
    }

    void loadInitialData();

    const channel = supabase
      .channel("weather-ultra-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_latest",
          filter: "device_id=eq.weather-ultra-01",
        },
        (payload) => {
          if (!active) {
            return;
          }

          console.log("Supabase realtime:", payload.new);

          if (payload.new && Object.keys(payload.new).length > 0) {
            setWeather(payload.new as WeatherData);

            setError(false);
          }
        },
      )
      .subscribe((status) => {
        console.log("Realtime status:", status);

        if (!active) {
          return;
        }

        if (status === "SUBSCRIBED") {
          setRealtimeConnected(true);

          setError(false);
        }

        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeConnected(false);

          setError(true);
        }
      });

    return () => {
      active = false;
      clearInterval(clock);

      void supabase.removeChannel(channel);
    };
  }, []);

  const age = weather
    ? (now - new Date(weather.timestamp).getTime()) / 1000
    : Infinity;
  const stale = !Number.isFinite(age) || age > 7;
  const state = error
    ? "Lỗi kết nối"
    : !weather
      ? "Đang kết nối"
      : stale
        ? "Dữ liệu đã cũ"
        : realtimeConnected
          ? "Đang trực tiếp"
          : "Đang nối lại";
  const sensors = [
    { title: "Độ ẩm", value: weather?.humidity, unit: "% RH", icon: "◒" },
    { title: "Áp suất", value: weather?.pressure, unit: "hPa", icon: "◎" },
    {
      title: "Nồng độ CO₂",
      value: weather?.co2,
      unit: "ppm · CO₂",
      icon: "◌",
    },
    { title: "Bụi mịn PM2.5", value: weather?.pm25, unit: "µg/m³", icon: "⠿" },
    { title: "Ánh sáng", value: weather?.lux, unit: "lux", icon: "☼" },
    {
      title: "Chỉ số UV",
      value: weather?.uv,
      unit: "UV · giá trị thử nghiệm",
      icon: "↗",
    },
  ];
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">MÔI TRƯỜNG QUANH BẠN</div>
          <h1>Tổng quan hôm nay</h1>
          <p>Theo dõi không gian sống, từ những thay đổi nhỏ nhất.</p>
        </div>
        <span
          role="status"
          className={`connection ${!error && weather && !stale ? "live" : "waiting"}`}
        >
          ● {state}
        </span>
      </header>
      {error && (
        <div className="notice" role="alert">
          Không thể nhận dữ liệu mới. Kiểm tra mạng hoặc cấu hình Supabase trong
          phần Thiết bị.
        </div>
      )}
      {weather && stale && (
        <div className="notice">
          Số đo dưới đây là lần nhận gần nhất, không phải dữ liệu hiện tại.
        </div>
      )}
      <div className="dashboard-grid">
        <section className="hero-weather" aria-label="Nhiệt độ hiện tại">
          <div className="hero-top">
            <span>TRẠM WEATHER ULTRA</span>
            <span>01 / ☀</span>
          </div>
          <div>
            <div className="temperature">
              {formatValue(weather?.temperature)}
              <small>°C</small>
            </div>
            <p className="hero-caption">Nhiệt độ tại cảm biến SHT45</p>
          </div>
          <div className="hero-bottom">
            <span>
              {weather ? "Cập nhật gần nhất" : "Chờ dữ liệu từ thiết bị"}
            </span>
            <span>
              {weather
                ? new Date(weather.timestamp).toLocaleTimeString("vi-VN")
                : "—"}
            </span>
          </div>
        </section>
        <section className="sensor-grid" aria-label="Thông số môi trường">
          {sensors.map((s) => (
            <div className="sensor-card" key={s.title}>
              <div className="sensor-title">
                {s.title}
                <span className="sensor-symbol" aria-hidden="true">
                  {s.icon}
                </span>
              </div>
              <div className="sensor-value">
                {formatValue(s.value, s.unit.includes("ppm") ? 0 : 1)}
                <small>{s.unit}</small>
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="section-heading">
        <h2>Chi tiết bụi trong không khí</h2>
        <span>SPS30 · Nồng độ khối lượng</span>
      </div>
      <section className="dust-grid">
        {[
          ["PM1.0", weather?.pm1],
          ["PM2.5", weather?.pm25],
          ["PM4", weather?.pm4],
          ["PM10", weather?.pm10],
        ].map(([label, value]) => (
          <div className="dust-card" key={String(label)}>
            <span>{label}</span>
            <strong>{formatValue(value as number | undefined | null)}</strong>
            <small>µg/m³</small>
          </div>
        ))}
      </section>
      <div className="quick-links">
        <Link href="/history">
          Khám phá lịch sử 24 giờ <span>↗</span>
        </Link>
        <Link href="/camera">
          Quan sát camera <span>↗</span>
        </Link>
        <Link href="/system">
          Kiểm tra các thiết bị <span>↗</span>
        </Link>
      </div>
      <MicrophoneStatus />
    </main>
  );
}
