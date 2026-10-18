import { test, expect } from "@playwright/test";
const voice = { phase: "wake", capture_active: true, zero_signal: false, last_frame_at: new Date().toISOString(), model: "PhoWhisper-base", denoise: "off" };
test("mic moves from ready to offline and never retains ready on failed polling", async ({ page }) => {
  let online = true;
  await page.route("**/api/voice", route => route.fulfill({ json: { ready: true, online, voice: { ...voice, last_frame_at: new Date().toISOString() } } }));
  await page.goto("/settings");
  const panel = page.getByRole("region", { name: "Trạng thái mic" });
  await expect(panel.getByText("Sẵn sàng · Hey Weather")).toBeVisible();
  online = false;
  await expect(panel.getByText("Trạm mất kết nối")).toBeVisible({ timeout: 6000 });
  await expect(panel.getByText("Sẵn sàng · Hey Weather")).toHaveCount(0);
});
test("missing migration and capture frames are not marked connected", async ({ page }) => {
  let value: typeof voice | null = null;
  await page.route("**/api/voice", route => route.fulfill({ json: { ready: true, online: true, voice: value } }));
  await page.goto("/settings");
  await expect(page.getByText("Chưa có trạng thái mic", { exact: true })).toBeVisible();
  value = { ...voice, last_frame_at: "2000-01-01T00:00:00Z" };
  await expect(page.getByText("Đang mở mic", { exact: true })).toBeVisible({ timeout: 6000 });
});
test("listening, silence and error states fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let v = { ...voice, phase: "listening" };
  await page.route("**/api/voice", route => route.fulfill({ json: { ready: true, online: true, voice: { ...v, last_frame_at: new Date().toISOString() } } }));
  await page.goto("/settings");
  await expect(page.getByText("Đang nghe bạn nói", { exact: true })).toBeVisible();
  v = { ...v, zero_signal: true };
  await expect(page.getByText("Chưa có tín hiệu âm thanh", { exact: true })).toBeVisible({ timeout: 6000 });
  v = { ...v, phase: "error" };
  await expect(page.getByText("Mic hoặc dịch vụ giọng nói gặp lỗi", { exact: true })).toBeVisible({ timeout: 6000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
