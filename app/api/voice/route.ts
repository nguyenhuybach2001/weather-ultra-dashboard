import { database, json } from "@/lib/push-server";
export const runtime = "nodejs";
export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return json({ ready: false, online: false, voice: null });
  try {
    const { data, error } = await database().from("device_audio_status").select("*")
      .eq("device_id", process.env.WEATHER_DEVICE_ID || "weather-ultra-01").maybeSingle();
    if (error) throw new Error();
    const age = Date.now() - Date.parse(data?.last_seen || "");
    const v = data?.voice;
    // Never return raw status rows or transcripts through this public endpoint.
    const voice = v && typeof v === "object" ? {
      phase: typeof v.phase === "string" ? v.phase : "starting",
      capture_active: v.capture_active === true, zero_signal: v.zero_signal === true,
      last_frame_at: typeof v.last_frame_at === "string" ? v.last_frame_at : null,
      model: v.model === "PhoWhisper-base" ? "PhoWhisper-base" : "Whisper",
      denoise: v.denoise === "fft" ? "fft" : "off",
    } : null;
    return json({ ready: true, online: age >= -5000 && age < 15000, voice });
  } catch { return json({ ready: true, online: false, voice: null }, 503); }
}
