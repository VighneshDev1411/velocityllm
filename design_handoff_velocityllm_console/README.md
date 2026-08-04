# Handoff: VelocityLLM Operator Console — 5 Core Screens

## Overview
This package hands off five screens of the VelocityLLM operator console — a dark, developer-facing dashboard for an LLM inference platform (routing, caching, workers, billing). The screens are **Dashboard, Chat, Playground, API Keys, and Settings**. Use this to implement the same UI in a real frontend codebase (or scaffold a new one if none exists).

## About the Design Files
The bundled file `VelocityLLM Console.dc.html` is a **design reference built in a prototyping tool** — it renders correctly in a browser but its markup (custom `<x-import>`/templating tags, an internal component runtime) is NOT web-standard code and must not be copied verbatim. Treat it purely as a visual/behavioral spec. Your task is to **recreate this UI in the target codebase's real stack** (React/Next.js is a natural fit since the source product is already Next.js + MUI/shadcn-style primitives — but use whatever the target repo already has, or choose the most appropriate stack if this is a fresh project).

Also bundled: the full component source (`components/`) and design tokens (`tokens/`) from the VelocityLLM Design System this was built against — these ARE real, framework-agnostic reference implementations (plain React + inline/CSS-variable styling) and are safe to port logic/structure from directly.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, and component structure below are final — implement pixel-close, not "inspired by."

## Design tokens

### Colors (CSS variables — see `tokens/colors.css` for the full list)
Dark console base:
- `--surface-lowest #0e0e0e`, `--surface-base #131313` (page bg), `--surface-low #1c1b1b` (sidebar bg), `--surface #201f1f` (card bg), `--surface-high #2a2a2a` (card hover), `--surface-highest #353534`, `--surface-bright #393939`

Accents:
- Primary (periwinkle) `#adc6ff`, primary-container (deep blue) `#4b8eff`
- Secondary/success (signal green) `#53e16f`, secondary-container `#05b046`
- Tertiary/warning (warm peach) `#ffb595`, tertiary-container `#ef6719`
- Error `#ef4444` / error-light `#f87171`

Text: `--on-surface #e5e2e1` (primary), `--on-surface-variant #c1c6d7` (secondary), text-on-accent `#131313` (dark text on light-accent buttons).

Borders: `rgba(65,71,85,0.15)` default, `rgba(65,71,85,0.3)` strong, focus ring `rgba(173,198,255,0.4)`.

Status pill colors (10% alpha bg + solid fg): healthy/success green, degraded/warning peach, critical/error red, idle gray, busy periwinkle.

Sidebar tokens: bg `#1c1b1b`, active row bg `#201f1f`, inactive text `rgba(229,226,225,0.5)`, active text = primary periwinkle, width `260px` (72px collapsed).

Marketing (light, NOT used on these 5 screens but part of the same brand): white bg, gray-50 alt, blue-600→purple-600 gradient CTAs — only relevant if a logged-out marketing page is added later.

### Typography
- UI font: **Inter** (400/500/600/700/800). Data font: **JetBrains Mono** (400/500) — used ONLY for numbers, IDs, table headers, kicker labels. This split is a core signature of the brand — never put a stat value or request ID in Inter.
- Scale: page titles (PageHeader h5) `20px/1.2/-0.02em` weight 600; section headings `36px`; body/table `14px`; small/meta `12.8px`; caption `11px`; kicker/label `10px` uppercase + `0.2em` tracking, mono.
- Sentence case everywhere in UI copy and buttons ("Save changes", not "Save Changes"). Nav labels and kicker labels are the one exception: uppercase + wide tracking.

### Spacing & radius
- 8px base unit: 4/8/12/16/20/24/32/40/48/64.
- Radius: `2px` (badges/chips), `4px` (buttons/inputs), `8px` (cards/dialogs/dropdowns/panels). Note: this system's "full" radius token is **12px, not a pill** — don't round buttons into pills.
- Control heights: 32px (sm), 36px (default), 40px (lg).

### Effects
- Elevation is flat by default — cards use a 1px border (`--border-default`), **no drop shadow**. The only real shadows are on floating layers: menus/dialogs `0 20px 40px rgba(0,0,0,0.4)`.
- Signature decoration: **StatCard and the active sidebar row use a 3px INSET left border** (`box-shadow: inset 3px 0 0 <accent>`), not `border-left`. Keep this exact — it's the one distinctive "card" treatment in the whole system.
- Blur: topbar `blur(16px)` over `rgba(19,19,19,0.6)`; floating glass panels `blur(12px)` over `rgba(57,57,57,0.6)`; dialog backdrop `blur(8px)`.
- Motion: short and functional only — `150–200ms ease` transitions. Buttons scale to `0.95` on press (icon buttons `0.9`) — a tactile squash, no color-only feedback, no bounce/spring easing, no page-transition choreography.
- Hover: surfaces step one level lighter (e.g. card `#201f1f → #2a2a2a`); ghost/outline buttons gain a faint `rgba(229,226,225,0.05)` fill.

## Layout shell (shared by all 5 screens)
- Fixed left sidebar, 260px wide (72px collapsed toggle), full viewport height, bg `--surface-low`, grouped nav sections with small uppercase group titles and icon+label links (Lucide icons, 16–20px, stroke style). Active link: text turns primary periwinkle + 3px inset left accent border + slightly lighter row bg.
- Sticky top bar, 56px tall, spans the remaining width: current page title (left), user avatar initial-in-circle + name (right), blurred/translucent bg.
- Content area below the top bar scrolls independently; standard content padding is 24px.
- Page pattern: `PageHeader` (title + subtitle, optional right-aligned action like tabs or a primary button) → content grid of Cards / StatCards / tables.

## Screens

### 1. Dashboard
**Purpose:** At-a-glance system health — request volume, spend, latency, errors, plus a live-ish requests table and per-model traffic split.
**Layout:** PageHeader with a 4-tab segmented control (1h/6h/24h/7d) as its right-aligned action. Below: a 4-column grid of StatCards (16px gap), then a 2-column grid (2fr/1fr, 16px gap): a wide "Recent Requests" table card, and a narrower "Model Mix" card with per-model progress bars.
**Components:**
- StatCard ×4: icon (18px) + uppercase mono kicker label + large value + small mono subtext + colored 3px inset accent (blue/green/purple/orange). Content: "Total Requests 12.4K · 4.20 req/s", "Total Cost $18.20 · Avg $0.0021/req", "Avg Latency 184ms · P99: 640ms", "Error Rate 0.42% · 12 total errors".
- Requests table: columns Request / Model / Tokens / Latency / Cost / Status. Header row uppercase mono 10px, 0.15em tracking, secondary text color. Rows separated by 1px top border, request ID in mono. Status column uses a colored pill (StatusChip: success/warning/error).
- Model Mix card: 3 rows, each a label+percentage line above a thin (8px-tall) progress bar in the primary accent.

### 2. Chat
**Purpose:** Ad-hoc prompt testing against configured models, chat-style.
**Layout:** PageHeader, then a flex-column filling the remaining height: scrollable message list (grows), fixed input row pinned to the bottom.
**Components:**
- Message bubbles: user messages right-aligned, primary-accent background, dark text-on-accent; assistant messages left-aligned, surface-colored bg with a 1px border, primary text color. Max width 70%, 8px radius, 10×14px padding.
- Input row: text input (flex:1) + primary "Send" button with a send icon.

### 3. Playground
**Purpose:** Full parameter control for one-off completions — model, system prompt, sampling params, then run and inspect a response.
**Layout:** PageHeader, then a 320px/1fr grid. Left: a single "Configuration" card. Right: stacked "Prompt" card (input + run button) and "Response" card (output + metadata badges).
**Components:**
- Configuration card: Model select (GPT-4 / Claude 3 Opus / Llama 3 70B), multi-line system-prompt textarea, three labeled range sliders with live mono readouts (Temperature 0–2 step 0.05, Max tokens 1–4096, Top P 0–1 step 0.05), and an outline "Reset to defaults" button. Slider track uses the primary accent color.
- Prompt card: multi-line prompt textarea, right-aligned primary button "Send request" with a play icon.
- Response card: response text in a bordered/sunken text block (14px, 1.6 line-height), followed by a row of 3 outline badges showing token count / latency / cost for that run (e.g. "218 tokens", "312ms", "$0.0043").

### 4. API Keys
**Purpose:** Manage keys used to authenticate API requests; rotate/revoke.
**Layout:** PageHeader with a right-aligned primary "+ New key" button. A 3-column StatCard row (Total Keys, Requests Today, Stale Keys). Below, a single card containing a divided list of keys.
**Components:**
- Key row: label (14px semibold) + mono meta line (masked key id · created date · request count · last used) on the left; a StatusChip (Active=success / Unused 90d=warning) + a ghost icon-button dropdown menu (kebab icon) on the right. Rows separated by 1px bottom border.
- Dropdown menu: "Rotate", separator, "Revoke" (danger/red styling).
- Revoke confirms via a modal Dialog: title "Revoke API key?", description "Requests using this key will be rejected immediately. This cannot be undone.", footer with an outline "Cancel" and a destructive "Revoke" button. Dialog surface floats with the `0 20px 40px rgba(0,0,0,0.4)` shadow and an 8px-blur backdrop.

### 5. Settings
**Purpose:** Workspace defaults, plan/usage, and destructive account actions.
**Layout:** PageHeader, then a 2-column grid (max-width 960px) of cards: Workspace (left), Usage & billing (right), and a full-width Danger zone card below (grid-column span 2).
**Components:**
- Workspace card: labeled workspace-name text input (default "Acme Production"), labeled default-model select, right-aligned primary "Save changes" button.
- Usage & billing card: plan row ("Team — $199/mo") in mono, a labeled budget progress bar ("$758 / $2,000" at 38%), right-aligned outline "View invoices" button.
- Danger zone card: a peach/warning Alert ("Delete this workspace" + explanatory copy) above a right-aligned destructive "Delete workspace" button.

## Interactions & behavior
- Sidebar links, topbar, and page chrome are the same on every screen — implement once as a shared shell/layout component, not per-page.
- Dashboard time-range tabs are client-side state only (swap which data window is shown); no page reload.
- Chat: typing + Enter/click "Send" appends a user bubble immediately (optimistic); wire the actual model call server-side/via API in the real app.
- Playground sliders update their mono readout live on drag; "Reset to defaults" snaps Temperature→0.7, Max tokens→512, Top P→1. "Send request" should call the real completion endpoint and populate the Response card + the 3 metadata badges.
- API Keys: kebab menu opens a dropdown (click-outside or Escape closes it); "Revoke" opens the confirmation Dialog rather than acting immediately; confirming removes the row.
- All destructive actions (Revoke, Delete workspace) require the confirm step — never act on a single click.
- No page-transition animation between screens; only short (150–200ms ease) hover/press feedback as described above.

## State management (suggested)
- Global/shared: current user, active nav item, sidebar collapsed flag.
- Dashboard: selected time range (`'1h'|'6h'|'24h'|'7d'`), fetched metrics + requests list for that range.
- Chat: message list, draft input value, sending/loading flag.
- Playground: model, system prompt, temperature, max tokens, top-p, prompt text, last response + its token/latency/cost metadata, running flag.
- API Keys: keys list, which key's menu is open, revoke-confirmation dialog open + target key id.
- Settings: workspace name, default model, (read-only) plan/usage figures.

## Assets
- Icons: [Lucide](https://lucide.dev) (stroke style, 16–20px), loaded via the `lucide-react` package in a real React app (the prototype uses the CDN build — swap for the npm package in production).
- Fonts: Inter (400–800) and JetBrains Mono (400/500) — both are on Google Fonts / `next/font/google` if using Next.js; no custom font files needed.
- No photography, illustration, or custom icon assets are used anywhere in this system.

## Files in this bundle
- `VelocityLLM Console.dc.html` — the interactive design reference (open in a browser to see/click through all 5 screens). Not production code — see "About the Design Files" above.
- `tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `tokens/effects.css` — the exact CSS-variable values used throughout.
- `components/` — real, framework-agnostic React reference implementations (Sidebar, TopBar, PageHeader, Card family, StatCard, StatusChip, Badge, Button, Input, Label, Select, Progress, Alert, Dialog, DropdownMenu, Tabs, Icon). Port these directly — their structure and inline styles already encode every token above correctly.
