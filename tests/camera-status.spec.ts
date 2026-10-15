import { test, expect } from "@playwright/test";
import { cameraUnavailable, type CameraRuntime } from "../lib/camera-status";
const now = Date.parse("2026-10-15T00:00:00Z");
const online: CameraRuntime = {
  camera_url: "https://camera.example",
  camera_online: true,
  pi_online: true,
  pi_last_seen: new Date(now).toISOString(),
};
test("Pi power loss overrides a stale camera_online flag without a new database event", () => {
  expect(cameraUnavailable(online, now)).toBeNull();
  expect(cameraUnavailable(online, now + 6999)).toBeNull();
  expect(cameraUnavailable(online, now + 7000)).toContain("Raspberry Pi 5");
  expect(
    cameraUnavailable(
      { ...online, pi_last_seen: new Date(now + 8000).toISOString() },
      now + 8000,
    ),
  ).toBeNull();
});
test("explicit offline, missing or invalid heartbeat never shows a stream", () => {
  for (const runtime of [
    null,
    { ...online, pi_online: false },
    { ...online, pi_last_seen: null },
    { ...online, pi_last_seen: "invalid" },
    { ...online, camera_online: false },
    { ...online, camera_url: null },
  ])
    expect(cameraUnavailable(runtime, now)).not.toBeNull();
});
