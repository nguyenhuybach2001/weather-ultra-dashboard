import { randomUUID } from "node:crypto";
import { database, json, readBody, sameOrigin } from "@/lib/push-server";
import { validMorning } from "@/lib/morning-validation";
export const runtime = "nodejs";
const device = () => process.env.WEATHER_DEVICE_ID || "weather-ultra-01";
export async function GET() {
  try {
    const db = database();
    const [desired, status] = await Promise.all([
      db.from("device_morning").select("*").eq("device_id", device()).maybeSingle(),
      db.from("device_morning_status").select("*").eq("device_id", device()).maybeSingle(),
    ]);
    if (desired.error || status.error) throw new Error();
    const age = Date.now() - Date.parse(status.data?.last_seen || "");
    return json({ desired: desired.data, status: status.data, online: age >= -5000 && age < 60000 });
  } catch { return json({ error: "Chưa kết nối được lịch đọc. Cần tạo bảng Supabase và cập nhật Pi." }, 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin không hợp lệ." }, 403);
  try {
    const body = await readBody(request) as Record<string, unknown>;
    if (!body || !validMorning(body)) return json({ error: "Chọn địa điểm và giờ đọc hợp lệ." }, 400);
    const db = database();
    if (body.play) {
      const { data, error } = await db.from("device_morning_status").select("last_seen").eq("device_id", device()).maybeSingle();
      const age = Date.now() - Date.parse(data?.last_seen || "");
      if (error || !(age >= -5000 && age < 60000)) return json({ error: "Pi chưa kết nối dịch vụ đọc dự báo." }, 409);
    }
    const revision = randomUUID();
    const { error } = await db.from("device_morning").upsert({ device_id: device(), enabled: body.enabled, time_local: body.time_local, revision, ...(body.play ? { request_id: randomUUID(), request_expires_at: new Date(Date.now() + 60000).toISOString() } : {}) });
    if (error) throw new Error();
    return json({ revision });
  } catch { return json({ error: "Không lưu được lịch đọc." }, 503); }
}
