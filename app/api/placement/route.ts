import { randomUUID } from "node:crypto";
import { database, json, readBody, sameOrigin } from "@/lib/push-server";
import { normalizePlacement } from "@/lib/placement";
export const runtime = "nodejs";
const device = () => process.env.WEATHER_DEVICE_ID || "weather-ultra-01";
export async function GET() {
  try {
    const db = database();
    const [desired, status] = await Promise.all([
      db.from("device_placement").select("*").eq("device_id", device()).maybeSingle(),
      db.from("device_placement_status").select("*").eq("device_id", device()).maybeSingle(),
    ]);
    if (desired.error || status.error) throw new Error();
    const age = Date.now() - Date.parse(status.data?.last_seen || "");
    return json({ desired: desired.data, status: status.data, online: age >= -5000 && age < 45000 });
  } catch { return json({ error: "Chưa kết nối cấu hình vị trí. Cần tạo bảng Supabase và cập nhật Pi." }, 503); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Origin không hợp lệ." }, 403);
  try {
    const config = normalizePlacement(await readBody(request));
    if (!config) return json({ error: "Chọn vị trí hợp lệ cho các cảm biến." }, 400);
    const revision = randomUUID();
    const { error } = await database().from("device_placement").upsert({ device_id: device(), config, revision, updated_at: new Date().toISOString() });
    if (error) throw new Error();
    return json({ revision });
  } catch { return json({ error: "Không lưu được cấu hình vị trí." }, 503); }
}
