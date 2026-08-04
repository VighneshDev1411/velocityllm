# 🎬 VelocityLLM — LinkedIn Demo Video Script

A step-by-step plan to record a **60–90 second** demo that makes recruiters and hiring managers stop scrolling. Optimized for LinkedIn (autoplays **muted**, mobile-first, rewards the first 3 seconds).

> **Positioning line (memorize this):** *"VelocityLLM is a production-grade LLM inference platform — not a ChatGPT wrapper. Go backend, real-time streaming, multi-level caching, and full observability, deployed and live."*

---

## 0. The one rule

**Show, don't tour.** You have 40+ pages — resist showing them all. Pick the **7 strongest, fully-working screens** and move fast. A tight 75s video beats a rambling 4-minute one every time. Empty/stub pages *hurt* you — only record screens with real, populated data.

---

## 1. Before you record (prep checklist)

- [ ] **Seed real-looking data.** Log in and make sure Dashboard, Analytics, Monitoring, and Chat all show populated numbers/messages — not zeros or empty states. Run a few chats and a load test beforehand so charts have data.
- [ ] **Warm the backend.** Hit the app once right before recording so Railway is fully warm (it's always-on now, but avoid the very first request of the session).
- [ ] **Clean browser.** Use a fresh Chrome profile or Incognito: no bookmarks bar, no extensions, no personal tabs. Zoom to 100% (or 110% for readability on mobile).
- [ ] **Prepare two prompts** for the chat/caching demo:
  - Prompt A (streaming showcase): *"Explain how an LLM inference server handles concurrent requests, in 3 bullet points."*
  - Prompt B (same as A, to demo the cache HIT on repeat).
- [ ] **Have DevTools ready** (optional but powerful): Network tab open to show the `x-cache: HIT` header live — this is your "I understand systems" flex.
- [ ] **Credentials ready** so login is instant (you already know it's fast).
- [ ] **Close Slack/Notifications** — no popups mid-record.

---

## 2. Recording setup

| Setting | Recommendation |
|---|---|
| **Tool** | Screen Studio (Mac, best cursor zoom/animations), or Loom, or QuickTime + CapCut |
| **Resolution** | Record at 1920×1080 minimum; export 1080p |
| **Frame rate** | 60fps (streaming text looks smooth) |
| **Orientation** | **Landscape 16:9** or **Square 1:1**. Square takes more mobile feed space — great for LinkedIn. |
| **Cursor** | Enable cursor highlight + smooth zoom-on-click (Screen Studio does this automatically) |
| **Length** | **75s target**, 90s hard max |
| **Audio** | Optional voiceover, but **captions are mandatory** (85% watch muted) |

---

## 3. The narrative arc (why this order works)

1. **Hook** — polished product + a fast, real result (0–5s)
2. **Core value** — real-time LLM streaming (the "it works" moment)
3. **The engineering flex** — caching makes a repeat query instant (this separates you from wrapper projects)
4. **Production credibility** — monitoring / analytics / load test (proves it's not a toy)
5. **The close** — architecture + tech stack + "it's live" + CTA

---

## 4. Shot-by-shot script

> Times are cumulative. Keep each screen on-screen just long enough to register — don't linger.

| # | Time | Screen / Action | On-screen caption (or voiceover) |
|---|------|-----------------|----------------------------------|
| 1 | 0:00–0:04 | **Landing → Login.** Show the polished login page, type email/pw, hit Sign in — it snaps in instantly. | *"Meet VelocityLLM — a production LLM inference platform I built."* |
| 2 | 0:04–0:12 | **Dashboard.** Land on `/dashboard`. Slow pan across the KPI cards / charts. | *"Real-time metrics: requests, latency, tokens, cache hit-rate."* |
| 3 | 0:12–0:30 | **Chat / Playground** (`/chat` or `/playground`). Send **Prompt A**. Let the response **stream token-by-token**. | *"Responses stream in real time over Server-Sent Events / WebSockets."* |
| 4 | 0:30–0:44 | **Caching demo.** Send **Prompt B** (identical). It returns **instantly**. If you have DevTools open, point to `x-cache: HIT`. | *"Repeat queries are served from a Redis-backed cache — instant, near-zero cost."* |
| 5 | 0:44–0:56 | **Monitoring / Observability** (`/monitoring` or `/analytics`). Show live charts, latency percentiles, throughput. | *"Full observability — latency, throughput, error rates, per-model stats."* |
| 6 | 0:56–1:06 | **Load Test** (`/loadtest`). Show a run with RPS / p95 / success-rate results. | *"Built-in load testing — it holds up under concurrent traffic."* |
| 7 | 1:06–1:14 | **Status / Architecture** (`/status`). Show all-green system health. | *"Worker pools, rate limiting, clustering — engineered like a real platform."* |
| 8 | 1:14–1:20 | **Closing card** (edit in): logo + tech stack + URLs. | *"Go · Next.js · Redis · Postgres. Live on Vercel + Railway. Link below 👇"* |

**If you only have 30 seconds:** shots 1 → 3 → 4 → 8. Streaming + cache HIT is the whole story.

---

## 5. Technical talking points to name-drop

Sprinkle 3–4 of these as captions or in your post — they're recruiter/engineer catnip and they're all **true** of your build:

- **Go backend** on a custom worker pool with backpressure & graceful shutdown
- **Real-time streaming** via SSE + WebSocket hub
- **Multi-level caching** (in-memory L1 + Redis L2) *and* a semantic cache for similar prompts
- **HTTP response cache** with `X-Cache: HIT/MISS` headers (verified working)
- **Horizontal scaling primitives** — node registry, leader election, distributed rate limiting
- **Observability** — metrics collection, health/readiness/liveness probes
- **Deployed for real** — frontend on **Vercel** (edge CDN), backend + Postgres + Redis on **Railway**, always-on
- **JWT auth** with bcrypt, OAuth2 scaffolding

---

## 6. Editing & post-production

- [ ] **Hook in frame 1.** Open on the product mid-action or a bold title card: *"I built a production LLM platform."* Never open on a blank desktop.
- [ ] **Burn in captions** (CapCut auto-captions, then fix terms like "VelocityLLM", "Redis").
- [ ] **Speed-ramp the boring bits** — 1.5–2× through navigation, real-time during the streaming + cache moments (those need to feel real).
- [ ] **Zoom punch-ins** on the streaming text and the `x-cache: HIT` header.
- [ ] **Subtle background music**, ducked low. Keep it professional, not clubby.
- [ ] **End card (3s):** name, role you're targeting, GitHub + live URL, "Open to opportunities" if that's true.
- [ ] **Export** 1080p, then **watch it once on your phone, muted** — that's how recruiters will see it.

---

## 7. LinkedIn post copy (ready to paste)

> **🚀 I built VelocityLLM — a production-grade LLM inference platform.**
>
> Not a ChatGPT wrapper. A real backend engineering project:
>
> ⚡ Go backend with a concurrent worker pool + backpressure
> 🔁 Real-time token streaming (SSE + WebSockets)
> 🧠 Multi-level + semantic caching on Redis → repeat queries served instantly
> 📊 Full observability: latency, throughput, error rates, load testing
> ☁️ Deployed live: Next.js on Vercel (edge CDN) + Go/Postgres/Redis on Railway
>
> The demo shows a query streaming in real time, then the *same* query returning instantly from cache — the difference between a toy and a system.
>
> 🔗 Live demo + code in the comments.
>
> Open to backend / platform / infra roles. If your team is hiring, I'd love to chat.
>
> #golang #softwareengineering #backend #llm #ai #systemdesign #nextjs #redis #hiring #webdevelopment

**Pro tips for the post:**
- Put the **live URL and GitHub link in the first comment**, not the body (LinkedIn suppresses reach on posts with external links in the body).
- Post **Tue–Thu, 8–10am** your audience's time.
- Reply to every comment in the first hour — it fuels the algorithm.
- Tag 1–2 relevant communities/people *only if genuinely relevant*.

---

## 8. Do's & Don'ts

**✅ Do**
- Keep it under 90 seconds
- Show real streaming and a real cache HIT (your unique flex)
- Use captions
- Lead with the strongest visual

**❌ Don't**
- Tour all 40 pages
- Record empty/stub screens with zeros
- Narrate every click ("now I'm clicking here…")
- Use shaky full-uncut screen capture — edit it tight
- Forget the CTA ("open to roles / link below")

---

### TL;DR
Log in fast → stream a chat response → send it again and show the **instant cache HIT** → flash monitoring + load test → end card with stack + live link. 75 seconds, captions on, link in the first comment. That's the video. 🎯
