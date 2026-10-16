# Weather Ultra dashboard

Next.js dashboard for desktop, phone/PWA and a Raspberry Pi 5 touchscreen. Existing Supabase reads and Realtime channels for `device_latest`, `weather_readings`, and `device_runtime` are retained. Camera remains an MJPEG stream at the runtime URL + `/stream`. `lib/api.ts` HTTP/WebSocket URL helpers are unchanged. Companion FastAPI alert integration is in `nguyenhuybach2001/weather-ultra-cloud`; firmware/Serial ingestion is not present here.

## Run

Requires a Node.js release supported by Next.js 16 (20.9+; use a maintained LTS).

```sh
npm ci
cp .env.example .env.local
# Fill in the existing public Supabase URL and publishable key.
npm run dev
npm run lint
npm run build
npm start
```

Never put a Supabase service-role key in a `NEXT_PUBLIC_` variable. Existing Supabase RLS and Realtime publication settings still apply. Build verification can use dummy public Supabase values; live data verification requires your real project.

## UI and kiosk

- Shared navigation: overview, history, camera, device status, settings.
- Desktop sidebar; phone bottom navigation with safe-area padding.
- Compact landscape layout at 600px+ width and up to 600px height, including 800×480 and 720×480.
- `/?kiosk=1` enables a compact shell that persists across in-app navigation. The toolbar can exit kiosk mode. Browser fullscreen is configured separately on the Pi.
- All existing measurements remain visible. The overview labels readings older than 7 seconds as stale. This matches the existing system status timing; adjust together if your ingestion cadence differs.
- Morning sensor bulletins use archived station readings and a separately installed Pi scheduler. Apply the morning SQL migration and update the Pi worker before enabling a schedule.

## Install / PWA

Serve over HTTPS (localhost is an exception for development). `http://192.168...` on a phone is **not** a secure context. Keep camera tunnels HTTPS when the dashboard uses HTTPS to avoid mixed content. The existing backend URL helpers still target port 8000; those endpoints need their existing network/TLS configuration if used.

- Android/Chromium: when `beforeinstallprompt` is available, Settings shows an install button. Otherwise use the browser's install/add-to-home-screen menu. An automatic browser prompt is not guaranteed.
- iOS/iPadOS: Safari → Share → Add to Home Screen, then launch from the icon. Web Push requires iOS/iPadOS 16.4+ and a Home Screen web app.
- Permission is requested **only** from the user's Enable Notifications click. Rejected permission is explained, never repeatedly prompted.
- The service worker caches only `/offline.html`, not API, camera, HTML dashboards, Supabase responses, or RSC payloads. This intentionally avoids presenting stale telemetry as current. It handles push and same-origin notification clicks.
- Service worker updates follow the browser lifecycle; close existing app tabs and reopen to activate an update. No forced reload interrupts camera or live readings.

## Real push setup

Push is optional. The dashboard works without it and Settings reports that the server is not configured.

1. Apply `supabase/migrations/202610150001_push_subscriptions.sql` in your existing Supabase project's SQL editor. This only adds a separate table, enables RLS, and denies browser access.
2. Generate VAPID keys: `npx web-push generate-vapid-keys`. Keep the private key stable and server-only. Changing VAPID keys requires resubscribing browsers.
3. Configure all variables in `.env.example` in your hosting environment. `APP_ORIGIN` must exactly match the dashboard origin (e.g. `https://weather-ultra-dashboard.vercel.app`, no trailing slash). Use a real contact email for `VAPID_SUBJECT`.
4. Generate different random secrets for `PUSH_PAIRING_CODE` (at least 16 characters) and `PUSH_SEND_SECRET` (at least 32). For example run `openssl rand -hex 24` separately for each. Share the pairing code privately with station users; the send secret belongs only on the server/Pi.
5. Deploy the dashboard with HTTPS, visit Settings, enter the pairing code, and click Enable Notifications. The browser subscription is saved in Supabase, not in process memory. Only its random management token is retained locally; the database stores a hash. Retry is available if database saving fails after browser permission is granted.
6. Wire the existing FastAPI alert logic to the server-to-server endpoint below. The companion cloud repository now includes an optional persistent alert hook for `/api/device/readings`. It must actually receive Pi readings to generate alerts.

### FastAPI / Pi integration

When an alert transitions into its active state, send a POST from the backend. Keep thresholds, hysteresis, cooldown and deduplication in that backend; do not emit an alert for every sensor sample. `tag` groups/replaces matching displayed notifications, but is not server-side deduplication. Monitor device-offline events from an independent server because an offline Pi cannot report its own outage.

```python
import os
import requests

response = requests.post(
    os.environ['DASHBOARD_ORIGIN'] + '/api/push/send',
    headers={'Authorization': 'Bearer ' + os.environ['PUSH_SEND_SECRET']},
    json={
        'title': 'Weather Ultra · Cảnh báo từ trạm',
        'body': 'Có thông số vượt ngưỡng bạn đã cấu hình. Mở ứng dụng để xem.',
        'tag': 'environment-alert',
        'url': '/',
    },
    timeout=55,
)
response.raise_for_status()
print(response.json())  # {sent, expired, failed}; sent means accepted by push service, not viewed.
```

The same request can send a first test notification after registering a browser. A send with zero subscriptions returns `sent: 0`, which does not prove phone delivery. There is intentionally no unauthenticated broadcast/test button.

### Server behavior and boundaries

- `/api/push/config` reports readiness and the public VAPID key; it verifies table access.
- `/api/push/subscriptions` POST requires same-origin and the pairing code; DELETE requires same-origin and the unguessable browser management token.
- `/api/push/send` requires a separate server bearer secret. Payloads are bounded, notification routes are allowlisted, and endpoint hosts are restricted to known browser push providers to prevent arbitrary server-side requests.
- 404/410 endpoints are removed; transient failures are counted and reported with HTTP 502. Retry at the backend with backoff, accounting for possible partial delivery. No automatic retry loop floods phones.
- Designed for a personal station, up to 100 browser subscriptions per send. Above that limit the sender explicitly refuses and needs a queued delivery service. It sends in batches of 20 with 8-second request timeouts and a 5-minute TTL.
- Put hosting/WAF rate limits on subscription and config routes before opening registration widely. For a multi-user product replace the shared station pairing code with authenticated membership and per-user authorization.
- Clearing browser storage can lose its management token; remove stale rows using the Supabase console or wait for provider expiry cleanup. A browser subscription alone is not proof that the server still has its row; re-pair after restoring the database.

## Verification

```sh
npm run lint
npm run build
npx playwright install chromium
npm test
# Or use an already-installed Chrome: PLAYWRIGHT_CHANNEL=chrome npm test
```

The browser suite uses a production server built with placeholder public Supabase values and mocked Supabase HTTP/WebSocket traffic, so it never reads or writes real station data. It covers responsive navigation, stale readings, camera URL usage, history, PWA assets/offline handling, install prompts and notification permission behavior. Separate request tests cover input validation and disabled push configuration.

Real iOS/Android installation, background push delivery, production RLS, live sensor updates and the Raspberry Pi camera must still be checked on your devices with the actual environment and backend configured.

References: [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), [WebKit Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Dependency maintenance: Next.js and eslint-config-next updated to 16.4.1. Production dependency audit is clean; five high-severity development-only findings remain through the ESLint/fast-glob/braces chain. The suggested forced fix would downgrade framework tooling, so it was not applied.

## Morning sensor bulletin

Apply `supabase/migrations/202610160002_morning.sql` and install the updated Pi backend. No new Vercel secrets are needed. Schedule control is public by the owner's choice, like speaker volume.

The Pi archives every parsed sample locally, preserving original values, validated values, per-field quality, source, sensor timestamp and UTC receipt time. Existing 60-second history is unchanged. Simulator samples are excluded from spoken analysis. There is no automatic deletion policy; monitor disk space and back up the archive. These records are a foundation for later modeling, not a trained forecast model.

The morning bulletin describes measured temperature/humidity/pressure and a conservative three-hour pressure trend. It does not predict rain or claim to know conditions outside the sensor location. No weather provider or location is needed. Speech generation uses edge-tts online.

Schedules default to 07:00 Vietnam time, disabled until enabled/saved. Pi persists one attempt per day, starting only within five minutes after the scheduled time. A muted or busy speaker skips the reading; failed readings do not retry automatically. Read now commands expire after 60 seconds. All speech uses the existing volume setting and output. The Pi may keep using the last received schedule while Supabase is offline; schedule changes take effect only after acknowledgment.
