import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
export function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY &&
    process.env.VAPID_SUBJECT &&
    process.env.PUSH_PAIRING_CODE &&
    process.env.PUSH_PAIRING_CODE.length >= 16 &&
    process.env.PUSH_SEND_SECRET &&
    process.env.PUSH_SEND_SECRET.length >= 32 &&
    process.env.APP_ORIGIN,
  );
}
export function database() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function secretMatches(value: unknown, expected: string | undefined) {
  return (
    typeof value === "string" &&
    !!expected &&
    timingSafeEqual(
      createHash("sha256").update(value).digest(),
      createHash("sha256").update(expected).digest(),
    )
  );
}
export function sameOrigin(request: Request) {
  return request.headers.get("origin") === process.env.APP_ORIGIN;
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Content type");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Body required");
  let total = 0;
  let text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 8192) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text + decoder.decode());
}
