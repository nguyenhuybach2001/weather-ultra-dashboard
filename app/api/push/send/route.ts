import webpush from "web-push";
import {
  configured,
  database,
  json,
  readBody,
  secretMatches,
} from "@/lib/push-server";
import { validNotification, validPushEndpoint } from "@/lib/push-validation";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!configured()) return json({ error: "Push is not configured" }, 503);
  if (
    !secretMatches(
      request.headers.get("authorization"),
      `Bearer ${process.env.PUSH_SEND_SECRET}`,
    )
  )
    return json({ error: "Unauthorized" }, 401);
  let body;
  try {
    body = await readBody(request);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!validNotification(body))
    return json({ error: "Invalid notification" }, 400);
  const db = database();
  // Personal station scope. Refuse excess recipients rather than silently dropping them.
  const { data, error } = await db
    .from("push_subscriptions")
    .select("token_hash,endpoint,p256dh,auth")
    .eq("device_id", "weather-ultra-01")
    .limit(101);
  if (error) return json({ error: "Could not load subscriptions" }, 500);
  if (data.length > 100)
    return json(
      { error: "More than 100 subscriptions: configure a queued sender" },
      503,
    );
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  let sent = 0,
    expired = 0,
    failed = 0;
  for (let start = 0; start < data.length; start += 20) {
    await Promise.all(
      data.slice(start, start + 20).map(async (row) => {
        if (!validPushEndpoint(row.endpoint)) {
          failed++;
          return;
        }
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            JSON.stringify(body),
            { TTL: 300, urgency: "normal", timeout: 8000 },
          );
          sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            const { error: deleteError } = await db
              .from("push_subscriptions")
              .delete()
              .eq("token_hash", row.token_hash)
              .eq("endpoint", row.endpoint);
            if (deleteError) failed++;
            else expired++;
          } else failed++;
        }
      }),
    );
  }
  return json({ sent, expired, failed }, failed ? 502 : 200);
}
