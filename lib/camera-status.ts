export type CameraRuntime = {
  camera_url: string | null;
  camera_online: boolean;
  pi_online: boolean | null;
  pi_last_seen: string | null;
};

// Match the existing System page's seven-second offline threshold.
export function cameraUnavailable(
  runtime: CameraRuntime | null,
  now: number,
): string | null {
  if (!runtime) return "Chưa nhận được trạng thái camera từ trạm.";
  const lastSeen = runtime.pi_last_seen
    ? Date.parse(runtime.pi_last_seen)
    : NaN;
  if (
    runtime.pi_online === false ||
    !Number.isFinite(lastSeen) ||
    now - lastSeen >= 7000
  ) {
    return "Raspberry Pi 5 đang tắt hoặc mất kết nối. Camera sẽ hiển thị lại khi trạm kết nối trở lại.";
  }
  if (!runtime.camera_online || !runtime.camera_url) {
    return "Camera đang tắt hoặc chưa kết nối với Raspberry Pi 5.";
  }
  return null;
}
