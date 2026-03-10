# ZeroGPU Browser Extension - Viability Analysis

---

## 1. CORS in Extensions — Are You Exempt?

**Yes, with important nuance.**

The **background service worker** in a Manifest V3 extension is fully exempt from CORS for any domain you declare in `host_permissions`. You can make fetch requests to `*.zerogpu.ai`, `*.cloudflare.com`, or literally `<all_urls>` and Chrome/Brave will bypass CORS entirely for the service worker context.

```json
// manifest.json
"host_permissions": ["https://*.zerogpu.ai/*", "wss://*.zerogpu.ai/*"]
```

**However — content scripts are different.** Content scripts (the JS you inject into web pages) are being progressively locked down. They are subject to the CORS rules of the page they are injected into. Since your SDK runs in the extension's own background context (not injected into third-party pages), **you're in the clear.**

Sources:
- [Chrome cross-origin network requests docs](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Chromium CORS extension content script changes](https://www.chromium.org/Home/chromium-security/extension-content-script-fetches/)

---

## 2. Can You Embed the JS SDK the Way You Described?

**Yes, but there is one hard constraint with MV3.**

The SDK must be **bundled locally** with the extension. Manifest V3 prohibits:
- `eval()`
- Dynamically fetching and executing remote JavaScript at runtime

This means you **cannot** do `fetch("https://cdn.zerogpu.ai/sdk.js")` and then `eval()` it in a service worker. The SDK JS files must ship inside the extension package itself.

What does work:
- Bundle your SDK with webpack/esbuild into the extension
- The SDK can still **fetch model weights from remote URLs** (ONNX, GGUF, etc.) at runtime — that's just a data fetch, not code execution
- WebSocket connections to your server work fine
- `wasm-unsafe-eval` can be added to CSP to allow WebAssembly

For WASM-based SLMs you add to `manifest.json`:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

---

## 3. WebSocket Connections in Extensions — The Critical Problem

**This is your biggest architectural challenge.**

In Manifest V3, the background script is a **service worker**, not a persistent page. Service workers are designed to be ephemeral and can be terminated after ~30 seconds of inactivity.

**Timeline of Chrome's handling of this:**
- Pre-Chrome 116: WebSocket connections did NOT extend service worker lifetime. Worker could die mid-connection.
- Chrome 116+ (current): Active WebSocket activity (send/receive) **resets the idle timer**. As long as messages are flowing, the worker stays alive.

**The problem:** If your server goes quiet for >30s (no task dispatched), the service worker can be killed and the WebSocket drops.

**The solution: Offscreen Documents** (Chrome 109+, Brave equivalent)

An Offscreen Document is a hidden, headless HTML page that runs persistently in the background. It has full DOM access (unlike a service worker) and a much more stable lifecycle. You put your WebSocket and SLM here.

```
manifest.json declares offscreen permission
→ Service worker creates offscreen document on startup
→ Offscreen document owns the WebSocket to zerogpu.ai
→ Offscreen document loads the SLM via WASM
→ Service worker ↔ Offscreen doc communicate via chrome.runtime.sendMessage
```

This is the architecture you want. The offscreen document is essentially a hidden tab that never shows UI — perfect for compute work.

Sources:
- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Offscreen Documents in MV3](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3)
- [Service worker 5-minute shutdown issue](https://issues.chromium.org/issues/40733525)

---

## 4. Memory Limitations

**More generous than you'd think, but model size matters.**

- No hard extension-specific memory cap — V8 and OS limits apply
- WebAssembly can access up to **4GB** of memory per instance in modern Chrome/Brave
- The SLM runs in the offscreen document, which is essentially a renderer process — same budget as a tab
- Typical practical limit: **1–2GB usable** before you risk OOM on lower-end devices

**For SLMs:**
- Phi-2 / Phi-3-mini class models (1–3B params) quantized to Q4: ~700MB–1.5GB — this works
- Anything 7B+ will be a problem on most consumer hardware
- Models load into memory once and persist as long as the offscreen document lives

---

## 5. Does the Connection Stay Alive When You Change Tabs?

**Yes — this is actually the key advantage of an extension over a webpage.**

The offscreen document is owned by the **extension process**, not by any tab. When you switch tabs, close tabs, navigate — none of that affects the offscreen document. It runs independently in its own renderer process.

| Context | Tab switch | Tab close | Browser minimize |
|---|---|---|---|
| Webpage WebSocket | Alive | Dead | Alive |
| Extension Offscreen Doc WebSocket | Alive | Alive | Alive |
| Extension Service Worker WebSocket | Alive* | Alive* | Alive* |

*Subject to idle termination without activity

This is a **massive advantage** for your use case. The compute worker persists across the entire browser session.

---

## 6. In-Depth Viability Analysis

**Overall verdict: Highly viable, with one architectural pivot needed.**

**Strengths:**
- Cloudflare Durable Objects + Workers is an excellent backend choice — reconnection after service worker restart is trivial since the DO maintains state
- CORS exemption means your SDK communicates freely with zerogpu.ai servers
- The extension context is actually MORE stable than a Telegram Mini App or webpage since it survives tab navigation
- Scraping is trivially solved — content scripts can extract DOM from any page and convert to markdown
- WebGPU is available in extensions (Brave/Chrome), so you could potentially use GPU acceleration for inference

**Risks and mitigations:**

| Risk | Severity | Mitigation |
|---|---|---|
| Service worker idle termination | High | Use Offscreen Document for WebSocket + SLM |
| MV3 bans remote code eval | Medium | Bundle SDK locally, model weights are just data |
| SLM memory on low-end devices | Medium | Server assigns appropriately sized model based on `navigator.deviceMemory` |
| Extension update disrupts active sessions | Low | Durable Objects reconnect gracefully |
| User revokes permissions | Low | Extension permissions UI is clear, users who install opt-in |

**This maps extremely cleanly to your existing architecture:**
```
Server (Cloudflare Worker)
  → assigns task + model URL to extension
  → Extension downloads model weights (data fetch, no eval)
  → Extension runs inference in Offscreen Document
  → Extension sends result back via WebSocket to Durable Object
  → If task = scrape URL → content script injects into that tab → extracts markdown → sends back
```

---

## 7. Device Fingerprint Data Available from Extension Context

Extensions can gather **significantly more** than a normal webpage:

**Available without special permissions:**
- `navigator.userAgent`, `navigator.platform`, `navigator.language`
- `navigator.hardwareConcurrency` — CPU thread count
- `navigator.deviceMemory` — RAM in GB (rounded: 0.25, 0.5, 1, 2, 4, 8)
- `screen.width/height`, `screen.colorDepth`, `screen.pixelDepth`
- `window.devicePixelRatio` — retina vs non-retina
- Timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- WebGL renderer + vendor strings — effectively identifies GPU model
- Canvas fingerprint
- `navigator.connection` — network type, bandwidth estimate
- Battery status (deprecated but still works in Brave/Chrome)
- Audio context fingerprint

**Available with extension permissions you can declare:**
- `tabs` permission — number of open tabs, which sites are open
- `storage` permission — persistent device ID you generate yourself
- `system.cpu` API (extension-only, not available to webpages) — full CPU model string, core count
- `system.memory` API (extension-only) — exact available RAM in bytes
- `system.display` API — exact monitor resolution, DPI

`chrome.system.cpu` and `chrome.system.memory` are **extension-exclusive APIs** that give you far more accurate hardware data than any webpage fingerprint. This is a significant advantage for your device assignment logic.

---

## 8. Does an Extension Work Like a Webpage?

**It depends on which part:**

| Component | Like a webpage? | Notes |
|---|---|---|
| Popup (popup.html) | Yes | Full DOM, JS, CSS — runs when popup is open |
| Options page | Yes | Full webpage in a tab |
| Offscreen Document | Yes | Full DOM, hidden, persistent |
| Content Script | Partially | Runs in page context but isolated world — limited access |
| Service Worker | No | No DOM, no localStorage, no canvas, no WebSockets reliably |

Your SDK should live in the **Offscreen Document** — it's the closest to a webpage environment while being persistent.

---

## 9. How Hard to Build and Deploy

**Building:** Moderate. The hard parts are:
- Understanding the service worker ↔ offscreen document message passing pattern
- Bundling your SDK correctly with webpack/esbuild for MV3
- CSP configuration for WASM

Everything else (scraping, markdown conversion, WebSocket) is straightforward.

**Deploying to Chrome Web Store:**
- One-time $5 developer registration fee
- Submit a ZIP of your extension
- Review takes **1–7 days** for first submission, usually 1–3 days for updates
- Must comply with their policies (no remote code execution — which MV3 already enforces)

**Brave specifically:** There is **no separate Brave extension store.** Brave uses the Chrome Web Store directly. Publishing once to Chrome Web Store makes your extension available on both. Users click "Add to Brave" on the Chrome Web Store page.

There was a [GitHub issue requesting a Brave-specific store](https://github.com/brave/brave-browser/issues/15187) but it was never built. Brave simply says: install from Chrome Web Store.

Sources:
- [Brave extensions FAQ](https://brave.com/learn/using-chrome-extensions-in-brave/)
- [Brave help center](https://support.brave.app/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave/)

---

## 10. Additional Ideas to Make This More Robust

**1. Persistent Device ID**
Generate a UUID on first install, store in `chrome.storage.local`. This survives service worker restarts and gives your server a stable device identity across sessions — much more reliable than fingerprint alone.

**2. Chrome Alarms API as Heartbeat**
`chrome.alarms` fires on a schedule even when the service worker is dead, waking it up. Use this as a reconnection watchdog — if the WebSocket in the offscreen document goes stale, the alarm fires and triggers a reconnect. Alarms fire even when the browser is minimized.

**3. WebGPU for Inference**
Brave and Chrome both expose `navigator.gpu`. Your server could assign WebGPU-accelerated models to devices that support it (most modern desktops/laptops). This would be dramatically faster than WASM CPU inference.

**4. Scraping Architecture**
For the scraping task type specifically:
- Service worker receives "scrape URL X" from WebSocket
- Extension programmatically opens URL in a new hidden tab (`chrome.tabs.create` with inactive flag)
- Content script injected into that tab extracts DOM, runs Turndown/markdown conversion
- Result sent back via `chrome.runtime.sendMessage` → service worker → WebSocket
- Tab is closed

This is cleaner than injecting into the active page and works for any URL.

**5. Offline Task Queue**
If the WebSocket drops while the extension has a pending result, store it in `chrome.storage.local` and flush on reconnect. Cloudflare DOs handle this well on the server side.

---

## Summary

Your existing architecture (Cloudflare Workers + Durable Objects) is actually ideal for this. The extension is a **better compute surface than a webpage or Telegram Mini App** for your use case — it's always running, always connected, CORS-exempt, and survives tab navigation. The one architectural change from your webpage implementation is replacing the browser tab context with an **Offscreen Document** for the WebSocket + SLM hosting. Everything else maps directly.
