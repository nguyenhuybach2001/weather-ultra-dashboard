import { randomUUID } from "node:crypto";
import { database, json, readBody, sameOrigin, secretMatches } from "@/lib/push-server";
export const runtime = "nodejs";
const device = () => process.env.WEATHER_DEVICE_ID || "weather-ultra-01";
function ready() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.APP_ORIGIN && (process.env.AUDIO_CONTROL_CODE?.length ?? 0) >= 16);
}
export async function GET() {
  if (!ready()) return json({ ready: false });
  try {
    const db = database();
    const [desired, status] = await Promise.all([
      db.from("device_audio").select("*").eq("device_id", device()).maybeSingle(),
      db.from("device_audio_status").select("*").eq("device_id", device()).maybeSingle(),
    ]);
    if (desired.error || status.error) throw new Error();
    const age = Date.now() - Date.parse(status.data?.last_seen || "");
    return json({ ready: true, online: age >= -5000 && age < 15000, desired: desired.data, status: status.data });
  } catch { return json({ error: "Không đọc được trạng thái loa. Kiểm tra cấu hình Supabase." }, 503); }
}
export async function POST(request: Request) {
  if (!ready()) return json({ error: "Chưa cấu hình điều khiển loa." }, 503);
  if (!sameOrigin(request)) return json({ error: "Origin không hợp lệ." }, 403);
  try {
    const body = await readBody(request) as Record<string, unknown>;
    if (!body || !secretMatches(body.code, process.env.AUDIO_CONTROL_CODE)) return json({ error: "Mã điều khiển không đúng." }, 401);
    if (!Number.isInteger(body.volume) || Number(body.volume) < 0 || Number(body.volume) > 100 || typeof body.muted !== "boolean" || typeof body.test !== "boolean") return json({ error: "Thiết lập không hợp lệ." }, 400);
    const db = database();
    const { data, error } = await db.from("device_audio_status").select("last_seen").eq("device_id", device()).maybeSingle();
    const age = Date.now() - Date.parse(data?.last_seen || "");
    if (error || !(age >= -5000 && age < 15000)) return json({ error: "Pi đang offline hoặc dịch vụ loa chưa sẵn sàng." }, 409);
    const revision = randomUUID();
    const result = await db.from("device_audio").upsert({ device_id: device(), volume: body.volume, muted: body.muted, revision, ...(body.test ? { test_id: randomUUID(), test_expires_at: new Date(Date.now() + 15000).toISOString() } : {}) });
    if (result.error) throw new Error();
    return json({ revision });
  } catch { return json({ error: "Không gửi được thiết lập loa." }, 400); }
}
