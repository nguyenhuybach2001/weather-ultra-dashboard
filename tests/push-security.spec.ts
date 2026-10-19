import {
  validPushEndpoint,
  validSubscription,
  validNotification,
} from "../lib/push-validation";
import { test, expect } from "@playwright/test";
import {
  POST as subscribe,
  DELETE as unsubscribe,
} from "../app/api/push/subscriptions/route";
import { POST as send } from "../app/api/push/send/route";
import { readBody } from "../lib/push-server";
test.beforeEach(() => {
  Object.assign(process.env, {
    APP_ORIGIN: "https://dashboard.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test",
    VAPID_PRIVATE_KEY: "test",
    VAPID_SUBJECT: "mailto:test@example.com",
    PUSH_SEND_SECRET: "test-send-secret-12345678901234567890",
  });
});
function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
) {
  return new Request(`https://dashboard.example${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://dashboard.example",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
test("cross-origin writes and invalid tokens never reach database", async () => {
  expect(
    (
      await subscribe(
        request(
          "/api/push/subscriptions",
          {},
          { Origin: "https://evil.example" },
        ),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await subscribe(
        request("/api/push/subscriptions", {
          token: "bad",
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await unsubscribe(
        request("/api/push/subscriptions", { token: "bad" }, {}, "DELETE"),
      )
    ).status,
  ).toBe(400);
});
test("visitors can register without a pairing code", async () => {
  delete process.env.PUSH_PAIRING_CODE;
  const originalFetch = globalThis.fetch;
  let saved = false;
  globalThis.fetch = async (input, init) => {
    expect(String(input)).toContain("/rest/v1/push_subscriptions");
    const row = JSON.parse(String(init?.body));
    expect(row.endpoint).toBe("https://fcm.googleapis.com/a");
    expect(row.token_hash).toMatch(/^[a-f0-9]{64}$/);
    saved = true;
    return new Response(null, { status: 201 });
  };
  try {
    const response = await subscribe(request("/api/push/subscriptions", {
      token: "a".repeat(64),
      subscription: {
        endpoint: "https://fcm.googleapis.com/a",
        keys: { p256dh: "a".repeat(87), auth: "a".repeat(22) },
      },
    }));
    expect(response.status).toBe(200);
    expect(saved).toBe(true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("broadcast needs a separate secret and validates payload", async () => {
  expect(
    (await send(request("/api/push/send", { title: "x", body: "x" }))).status,
  ).toBe(401);
  expect(
    (
      await send(
        request(
          "/api/push/send",
          { title: "x", body: "x" },
          { Authorization: `Bearer not-the-send-secret` },
        ),
      )
    ).status,
  ).toBe(401);
  expect(
    (
      await send(
        request(
          "/api/push/send",
          { title: "x", body: "x", url: "https://evil.example" },
          { Authorization: `Bearer ${process.env.PUSH_SEND_SECRET}` },
        ),
      )
    ).status,
  ).toBe(400);
});
test("request bodies are bounded even without Content-Length", async () => {
  await expect(
    readBody(request("/", { large: "x".repeat(9000) })),
  ).rejects.toThrow("Body too large");
});

test("push remains disabled until configured", async ({ request }) => {
  expect(await (await request.get("/api/push/config")).json()).toEqual({
    ready: false,
  });
  expect(
    (
      await request.post("/api/push/send", { data: { title: "x", body: "x" } })
    ).status(),
  ).toBe(503);
});
test("push validation rejects untrusted destinations and oversized payloads", () => {
  expect(validPushEndpoint("https://fcm.googleapis.com/fcm/send/example")).toBe(
    true,
  );
  for (const endpoint of [
    "http://127.0.0.1",
    "https://localhost",
    "https://fcm.googleapis.com.evil.test/a",
    "https://user@fcm.googleapis.com/a",
    "https://fcm.googleapis.com:8000/a",
  ])
    expect(validPushEndpoint(endpoint)).toBe(false);
  expect(
    validSubscription({
      endpoint: "https://fcm.googleapis.com/a",
      keys: { p256dh: "a".repeat(87), auth: "a".repeat(22) },
    }),
  ).toBe(true);
  expect(
    validSubscription({ endpoint: "https://fcm.googleapis.com/a", keys: {} }),
  ).toBe(false);
  expect(
    validNotification({ title: "Alert", body: "Sample", url: "/system" }),
  ).toBe(true);
  expect(
    validNotification({
      title: "Alert",
      body: "Sample",
      url: "https://evil.test",
    }),
  ).toBe(false);
  expect(validNotification({ title: "Alert", body: "x".repeat(501) })).toBe(
    false,
  );
});
