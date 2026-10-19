"use client";
import MicrophoneStatus from "@/components/MicrophoneStatus";
import { useEffect, useState } from "react";
import MorningSettings from "@/components/MorningSettings";
import PlacementSettings from "@/components/PlacementSettings";
import AudioSettings from "@/components/AudioSettings";
import { usePwa } from "@/components/PwaProvider";
export default function SettingsPage() {
  const pwa = usePwa();
  const [config, setConfig] = useState<{ ready: boolean; publicKey?: string }>({
    ready: false,
  });
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  );
  const [paired, setPaired] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/push/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setMessage("Không thể kiểm tra máy chủ thông báo."));
    // Synchronize browser permission/storage on initial hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if ("Notification" in window) setPermission(Notification.permission);
    try {
      setPaired(localStorage.getItem("push-saved") === "1");
    } catch {}
  }, []);
  useEffect(() => {
    let active = true;
    pwa.registration?.pushManager
      ?.getSubscription()
      .then((s) => {
        if (active) setSubscription(s);
      })
      .catch(() => setMessage("Không thể đọc đăng ký thông báo."));
    return () => {
      active = false;
    };
  }, [pwa.registration]);
  async function enable() {
    if (!pwa.registration || !config.publicKey) return;
    setBusy(true);
    setMessage("");
    try {
      // Must be the first asynchronous operation after the user's click, especially on iOS.
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage(
          result === "denied"
            ? "Bạn đã chặn thông báo. Có thể đổi trong cài đặt trình duyệt hoặc hệ thống."
            : "Chưa cấp quyền. Bạn có thể thử lại khi sẵn sàng.",
        );
        return;
      }
      let token = localStorage.getItem("push-token");
      if (!token) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
        localStorage.setItem("push-token", token);
      }
      const key = Uint8Array.from(
        atob(config.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
        (c) => c.charCodeAt(0),
      );
      const sub =
        (await pwa.registration.pushManager.getSubscription()) ??
        (await pwa.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        }));
      setSubscription(sub);
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), token }),
      });
      if (!response.ok)
        throw new Error(
          "Chưa lưu được đăng ký trên máy chủ. Hãy thử lại; quyền trình duyệt chưa đồng nghĩa với đăng ký thành công.",
        );
      localStorage.setItem("push-saved", "1");
      setPaired(true);
      setMessage(
        "Đã đăng ký nhận thông báo trên thiết bị này. Cảnh báo được gửi khi backend của trạm phát sự kiện.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không thể bật thông báo.");
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const token = localStorage.getItem("push-token");
      if (token) {
        const response = await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!response.ok)
          throw new Error(
            "Chưa xóa được đăng ký trên máy chủ. Vui lòng thử lại.",
          );
      }
      if (subscription && !(await subscription.unsubscribe()))
        throw new Error("Trình duyệt chưa hủy đăng ký. Vui lòng thử lại.");
      localStorage.removeItem("push-saved");
      setSubscription(null);
      setPaired(false);
      setMessage("Đã tắt thông báo trên thiết bị này.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không thể tắt thông báo.");
    } finally {
      setBusy(false);
    }
  }
  const available = pwa.secure && pwa.supported && (!pwa.ios || pwa.installed);
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <div className="eyebrow">THEO CÁCH CỦA BẠN</div>
          <h1>Ứng dụng & thông báo</h1>
          <p>Cài một lần. Theo dõi môi trường mỗi ngày.</p>
        </div>
      </header>
      <div className="settings-grid">
        <PlacementSettings />
        <AudioSettings />
        <MicrophoneStatus />
        <MorningSettings />
        <section className="panel">
          <h2>Cài Weather Ultra</h2>
          {pwa.installed ? (
            <p>✓ Ứng dụng đang mở từ màn hình chính.</p>
          ) : (
            <>
              <p>Truy cập nhanh như một ứng dụng, không cần tải từ cửa hàng.</p>
              {pwa.ios ? (
                <p>
                  Trên iPhone/iPad: mở bằng Safari → Chia sẻ → Thêm vào Màn hình
                  chính → Thêm. Sau đó mở ứng dụng từ biểu tượng vừa tạo.
                </p>
              ) : (
                <p>
                  Trên Android: mở menu trình duyệt → Cài đặt ứng dụng hoặc Thêm
                  vào màn hình chính. Trên máy tính: tìm biểu tượng cài đặt trên
                  thanh địa chỉ.
                </p>
              )}
              {pwa.install && (
                <button
                  className="primary-button"
                  onClick={() =>
                    pwa
                      .install?.()
                      .catch(() =>
                        setMessage(
                          "Chưa thể mở hộp thoại cài đặt. Hãy dùng menu trình duyệt.",
                        ),
                      )
                  }
                >
                  Cài ứng dụng
                </button>
              )}
              <p>
                Hộp thoại cài đặt phụ thuộc trình duyệt; không phải thiết bị nào
                cũng tự hiển thị.
              </p>
            </>
          )}
          {pwa.ready && !pwa.secure && (
            <div className="notice">
              Mở địa chỉ HTTPS để cài ứng dụng và dùng thông báo. HTTP qua địa
              chỉ IP nội bộ không hỗ trợ các tính năng này.
            </div>
          )}
        </section>
        <section className="panel">
          <h2>Thông báo trên thiết bị này</h2>
          <p>Nhận cảnh báo do trạm gửi kể cả khi không mở dashboard.</p>
          {!config.ready && (
            <div className="notice">
              Máy chủ chưa sẵn sàng gửi push. Chủ trạm cần cấu hình khóa VAPID,
              bảng lưu đăng ký và khóa gửi cảnh báo trên máy chủ.
            </div>
          )}
          {pwa.ios && !pwa.installed && (
            <p>
              iPhone/iPad cần iOS/iPadOS 16.4 trở lên và mở ứng dụng đã thêm vào
              Màn hình chính để bật thông báo.
            </p>
          )}
          {pwa.ready && !pwa.supported && (
            <p>
              Trình duyệt hiện tại chưa hỗ trợ thông báo đẩy trong chế độ này.
            </p>
          )}
          {permission === "denied" && (
            <div className="notice">
              Thông báo đang bị chặn. Mở cài đặt quyền của ứng dụng/trình duyệt
              để cho phép lại.
            </div>
          )}
          {subscription && paired ? (
            <>
              <p>✓ Thiết bị đã được đăng ký.</p>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={disable}
              >
                Tắt thông báo
              </button>
            </>
          ) : (
            <>
              <div className="button-row">
                <button
                  className="primary-button"
                  disabled={
                    busy ||
                    !available ||
                    !pwa.registration ||
                    !config.ready ||
                    permission === "denied"
                  }
                  onClick={enable}
                >
                  {busy ? "Đang xử lý…" : "Bật thông báo"}
                </button>
                {subscription && (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={disable}
                  >
                    Hủy đăng ký chưa hoàn tất
                  </button>
                )}
              </div>
            </>
          )}
          <p>Chỉ khi bạn nhấn “Bật thông báo”, ứng dụng mới xin quyền.</p>
        </section>
        <section className="panel">
          <h2>Màn hình tại trạm</h2>
          <p>
            Mở đường dẫn <code>/?kiosk=1</code> trên Pi để dùng chế độ kiosk.
            Giao diện tự thu gọn trên màn hình ngang 5 inch; các mục khác vẫn
            cuộn và thao tác cảm ứng được.
          </p>
          {/* A full navigation initializes the URL-controlled kiosk shell. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="secondary-button" href="/?kiosk=1">
            Mở giao diện kiosk ↗
          </a>
        </section>
        <section className="panel">
          <h2>Khi mất kết nối</h2>
          <p>
            Dữ liệu cảm biến và camera cần mạng. Ứng dụng không lưu bản cũ để
            giả làm dữ liệu trực tiếp. Nếu mở trang khi mất mạng, màn hình hướng
            dẫn kết nối lại sẽ xuất hiện.
          </p>
        </section>
      </div>
      {(message || pwa.error) && (
        <div role="status" className="notice" style={{ marginTop: 20 }}>
          {message || pwa.error}
        </div>
      )}
    </main>
  );
}
