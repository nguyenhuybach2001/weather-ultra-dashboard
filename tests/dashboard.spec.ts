import { expect, test } from "@playwright/test";
const reading = {
  device_id: "weather-ultra-01",
  timestamp: new Date().toISOString(),
  temperature: 26.5,
  humidity: 65.2,
  pressure: 1013.4,
  co2: 650,
  pm1: 4,
  pm25: 8,
  pm4: 9,
  pm10: 12,
  lux: 320,
  uv: 0.8,
  device_status: "online",
};
test.beforeEach(async ({ page }) => {
  await page.route("https://example.supabase.co/rest/v1/**", async (route) => {
    const url = route.request().url();
    const item = { ...reading, timestamp: new Date().toISOString() };
    const data = url.includes("weather_readings")
      ? [item]
      : url.includes("device_runtime")
        ? {
            camera_url: "https://camera.example.test",
            camera_online: true,
            pi_online: true,
            pi_last_seen: item.timestamp,
          }
        : item;
    await route.fulfill({ json: data });
  });
  await page.routeWebSocket(/example.supabase.co/, (ws) => {
    ws.onMessage((message) => {
      if (typeof message !== "string") return;
      const p = JSON.parse(message);
      if (p.event === "phx_join")
        ws.send(
          JSON.stringify({
            topic: p.topic,
            event: "phx_reply",
            ref: p.ref,
            payload: { status: "ok", response: { postgres_changes: [] } },
          }),
        );
    });
  });
});
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 800, height: 480 },
  { width: 720, height: 480 },
  { width: 320, height: 640 },
]) {
  test(`overview and navigation at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Tổng quan hôm nay" }),
    ).toBeVisible();
    await expect(page.locator(".temperature")).toContainText("26.5");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Camera" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/overview-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Lịch sử" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Lịch sử môi trường" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "CO₂", exact: true }).click();
    await expect(page.getByText("650", { exact: false }).first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("stale readings remain explicitly marked", async ({ page }) => {
  await page.route(
    "https://example.supabase.co/rest/v1/device_latest**",
    (route) =>
      route.fulfill({
        json: { ...reading, timestamp: "2020-01-01T00:00:00Z" },
      }),
  );
  await page.goto("/");
  await expect(page.getByText("Dữ liệu đã cũ", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Số đo dưới đây", { exact: false }),
  ).toBeVisible();
});
test("camera still uses runtime stream endpoint", async ({ page }) => {
  let streamRequested = false;
  await page.route("https://camera.example.test/stream", (route) => {
    streamRequested = true;
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="#183b3b"/></svg>',
    });
  });
  await page.goto("/camera");
  await expect(page.getByAltText("Weather Ultra Camera")).toHaveAttribute(
    "src",
    "https://camera.example.test/stream",
  );
  await expect.poll(() => streamRequested).toBe(true);
});
test("installation event is only prompted on click and consumed once", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(e, {
      prompt: async () => {
        document.documentElement.dataset.prompted = "yes";
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(e);
  });
  await expect(
    page.getByRole("button", { name: "Cài ứng dụng", exact: true }),
  ).toBeVisible();
  expect(await page.locator("html").getAttribute("data-prompted")).toBeNull();
  await page.getByRole("button", { name: "Cài ứng dụng", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-prompted", "yes");
  await expect(
    page.getByRole("button", { name: "Cài ứng dụng", exact: true }),
  ).toHaveCount(0);
});
test("permission is never requested on load, denial is explained after user click", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "requestPermission", {
      value: async () => {
        document.documentElement.dataset.permissionAsked = "yes";
        return "denied";
      },
    });
  });
  await page.route("**/api/push/config", (route) =>
    route.fulfill({ json: { ready: true, publicKey: "dummy" } }),
  );
  await page.goto("/settings");
  await page.evaluate(() => navigator.serviceWorker.ready);
  expect(
    await page.locator("html").getAttribute("data-permission-asked"),
  ).toBeNull();
  await page.getByLabel("Mã ghép nối của trạm").fill("test-pairing-code");
  await page
    .getByRole("button", { name: "Bật thông báo", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-permission-asked",
    "yes",
  );
  await expect(
    page.getByText("Thông báo đang bị chặn.", { exact: false }),
  ).toBeVisible();
});
test("manifest, icon and offline fallback", async ({
  page,
  context,
  request,
}) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBe(3);
  for (const icon of manifest.icons)
    expect((await request.get(icon.src)).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "Chờ kết nối trở lại" }),
  ).toBeVisible();
});
test("iPhone explains Home Screen installation before push", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/settings");
  await expect(
    page.getByText("Trên iPhone/iPad:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bật thông báo", exact: true }),
  ).toBeDisabled();
  await context.close();
});
test("kiosk preference survives client navigation and has an exit", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 480 });
  await page.goto("/?kiosk=1");
  await expect(page.locator(".app-shell")).toHaveClass(/kiosk/);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Thiết bị" })
    .click();
  await expect(page.locator(".app-shell")).toHaveClass(/kiosk/);
  await expect(page.getByText("Raspberry Pi", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Thoát kiosk" }).click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/kiosk/);
});
test("registration failures can retry and unsubscribe clears server registration", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const sub = {
      endpoint: "https://fcm.googleapis.com/test",
      toJSON: () => ({
        endpoint: "https://fcm.googleapis.com/test",
        keys: { p256dh: "a".repeat(87), auth: "a".repeat(22) },
      }),
      unsubscribe: async () => true,
    };
    Object.defineProperty(Notification, "requestPermission", {
      value: async () => "granted",
    });
    Object.defineProperty(PushManager.prototype, "getSubscription", {
      value: async () => null,
    });
    Object.defineProperty(PushManager.prototype, "subscribe", {
      value: async () => sub,
    });
  });
  await page.route("**/api/push/config", (route) =>
    route.fulfill({
      json: {
        ready: true,
        publicKey: Buffer.alloc(65, 4).toString("base64url"),
      },
    }),
  );
  let saved = false;
  let deleted = false;
  let attempts = 0;
  await page.route("**/api/push/subscriptions", (route) => {
    if (route.request().method() === "DELETE") {
      deleted = true;
      return route.fulfill({ json: { ok: true } });
    }
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 500,
        json: { error: "Database unavailable" },
      });
    saved = true;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/settings");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByLabel("Mã ghép nối của trạm").fill("test-pairing-code");
  await page
    .getByRole("button", { name: "Bật thông báo", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Chưa lưu được đăng ký");
  expect(saved).toBe(false);
  await page
    .getByRole("button", { name: "Bật thông báo", exact: true })
    .click();
  await expect(page.getByText("✓ Thiết bị đã được đăng ký.")).toBeVisible();
  expect(saved).toBe(true);
  await page
    .getByRole("button", { name: "Tắt thông báo", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Đã tắt thông báo");
  expect(deleted).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("push-saved")),
  ).toBeNull();
});
