# UI Overhaul Roadmap: "Kinetic Console" Theme

> Transform VelocityLLM from the current MUI Slate/Blue theme to the Stitch "Kinetic Console" design — a dark, engineer-focused, high-density interface with charcoal surfaces, sharp corners, glassmorphism, and Inter + JetBrains Mono typography.
>
> **Scope**: Theme, colors, typography, spacing, layout chrome only. Zero functionality changes.

---

## Day 48: Foundation — Theme, Tokens & Layout Chrome

**Goal**: Replace the entire color system, typography, and layout shell (sidebar + topbar) so every page instantly looks "Kinetic" even before individual components are touched.

### 1. Install Google Fonts (Inter + JetBrains Mono)
- **`app/layout.tsx`** — Add `next/font/google` imports for Inter (400–900) and JetBrains Mono (400, 500)
- Apply Inter as default body font, expose JetBrains Mono as CSS variable `--font-mono`
- Remove any existing font imports that conflict

### 2. Rewrite MUI Theme (`lib/theme.ts`)
Replace `buildTheme()` with a single dark-only Kinetic theme:

| Token | Value | Usage |
|-------|-------|-------|
| `surface` | `#131313` | App background, body |
| `surface-container-low` | `#1c1b1b` | Sidebar background |
| `surface-container` | `#201f1f` | Cards, Paper default |
| `surface-container-high` | `#2a2a2a` | Table headers, input bg |
| `surface-container-highest` | `#353534` | Chips, badges, elevated |
| `surface-container-lowest` | `#0e0e0e` | Code blocks, deepest |
| `surface-bright` | `#393939` | Hover states |
| `primary` | `#adc6ff` | Primary actions, focus |
| `primary-container` | `#4b8eff` | Gradient pair |
| `secondary` | `#53e16f` | Success only |
| `tertiary` | `#ffb595` | Warning/accent |
| `error` | `#ef4444` | Errors |
| `on-surface` | `#e5e2e1` | Primary text (no pure white!) |
| `on-surface-variant` | `#c1c6d7` | Secondary text |
| `outline-variant` | `#414755` | Borders at 10-15% opacity |

Key MUI overrides:
- `MuiPaper`: bg `#201f1f`, borderRadius `0.5rem` max, border `1px solid rgba(65,71,85,0.15)`
- `MuiButton`: primary gradient `135deg #adc6ff → #4b8eff`, borderRadius `0.375rem`, uppercase tracking
- `MuiChip`: bg `#353534`, borderRadius `0.125rem` (sharp)
- `MuiTableHead`: bg `rgba(42,42,42,0.5)`, text `10px uppercase tracking-widest`
- `MuiInputBase`: bg `#2a2a2a`, no border, focus ring `rgba(173,198,255,0.4)`
- Remove all light-mode palette branches
- Typography: Inter for everything, monospace override for JetBrains Mono

### 3. Update global CSS (`globals.css`)
- Body background `#131313`
- Custom scrollbar: 4px width, `#353534` thumb, `#131313` track
- Remove light-mode CSS variables
- Add `.glass-panel` utility: `rgba(57,57,57,0.6)` + `backdrop-filter: blur(12px)`
- Selection color using primary

### 4. Update Tailwind config (`tailwind.config.js`)
- Add all Kinetic color tokens to `theme.extend.colors`
- Set fontFamily: headline/body/label → Inter, mono → JetBrains Mono
- Override borderRadius: DEFAULT `0.125rem`, lg `0.25rem`, xl `0.5rem`, full `0.75rem`

### 5. Rewrite Sidebar (`components/Sidebar.tsx`)
- Background: `#1c1b1b`
- Right border: `rgba(53,53,52,0.15)` (ghost border)
- Active nav item: left inset shadow `inset 3px 0 0 #adc6ff`, bg `#201f1f`, text `#adc6ff`
- Default nav text: `rgba(229,226,225,0.5)`, hover → full `#e5e2e1`
- Logo: bold uppercase with version in mono
- Remove color-mode-dependent styling

### 6. Rewrite TopBar (`components/TopBar.tsx`)
- Background: `rgba(19,19,19,0.6)` with `backdrop-filter: blur(16px)` (glassmorphism)
- Border-bottom: `rgba(65,71,85,0.1)`
- Remove light/dark toggle button (dark-only now)
- Text color: `#e5e2e1`

### 7. Remove ColorModeContext
- Delete `contexts/ColorModeContext.tsx`
- Update `components/providers/theme-provider.tsx` to use single dark theme
- Remove `toggleColorMode` from TopBar
- Clean up any `mode === 'light'` conditionals in components

**Files touched**: ~8 files modified, 1 deleted
**Verification**: App loads with dark Kinetic shell — all pages have correct background, sidebar, topbar. Content may still look "off" — that's Day 49's job.

---

## Day 49: Components — Cards, Tables, Buttons, Inputs, Charts

**Goal**: Every reusable component matches the Kinetic spec. After this day, all 34 pages should look cohesive without touching individual page files.

### 1. StatCard (`components/StatCard.tsx`)
- Background: `#201f1f`, border `rgba(65,71,85,0.15)`
- Left colored border accent (3px inset shadow like sidebar active)
- Label: `10px uppercase tracking-widest`, color `#c1c6d7`
- Value: `1.5rem font-bold`, font JetBrains Mono
- Subtext: `0.75rem`, color `rgba(229,226,225,0.5)`
- Border-radius: `0.5rem` max
- Hover: bg shift to `#2a2a2a`

### 2. PageHeader (`components/PageHeader.tsx`)
- Title: Inter 700, `#e5e2e1`, tracking tight
- Subtitle: `0.875rem`, `#c1c6d7`
- Bottom border: none (use spacing instead)

### 3. MUI Component Overrides (extend `lib/theme.ts`)
Fine-tune any overrides not fully covered in Day 48:

**Tables**:
- Header: bg `rgba(42,42,42,0.5)`, text `10px uppercase tracking-[0.2em]` mono
- Row dividers: `rgba(65,71,85,0.1)` (barely visible)
- Row hover: `rgba(32,31,31,0.3)`
- Data cells: JetBrains Mono for numbers/IDs

**Buttons**:
- Primary: gradient `linear-gradient(135deg, #adc6ff, #4b8eff)`, text dark
- Secondary/outlined: ghost with `rgba(65,71,85,0.2)` border, hover bg `#393939`
- Success/Action: gradient `#53e16f → #05b046` (use sparingly)
- All: `active:scale-95` transition, uppercase `tracking-[0.05em]`

**Inputs/TextFields**:
- Background: `#2a2a2a`, no visible border
- Focus: `1px ring rgba(173,198,255,0.4)`
- Placeholder: `rgba(193,198,215,0.4)`
- Text areas for prompts: JetBrains Mono font

**Chips/Badges**:
- Default: bg `#353534`, text `#c1c6d7`, borderRadius `0.125rem`
- Status variants:
  - Success: `rgba(83,225,111,0.1)` bg, `#53e16f` text, `rgba(83,225,111,0.2)` border
  - Active/Running: `rgba(173,198,255,0.1)` bg, `#adc6ff` text
  - Error: `rgba(239,68,68,0.1)` bg, `#ef4444` text
  - Warning: `rgba(255,181,149,0.1)` bg, `#ffb595` text

**Alerts**:
- Background: surface with tinted border (e.g., error alert → `rgba(239,68,68,0.1)` bg)
- No rounded corners > `0.5rem`
- Icon + text style matching

**LinearProgress / CircularProgress**:
- Track: `#2a2a2a`
- Bar: primary `#adc6ff` default, or contextual color
- Height: 4-6px, border-radius full

**Dialogs/Modals**:
- Background: `#201f1f`
- Backdrop: `rgba(0,0,0,0.6)` with blur
- Border: `rgba(65,71,85,0.15)`
- Shadow: `0 20px 40px rgba(0,0,0,0.4)` (ambient, not drop)

### 4. Chart Styling
Update chart color constants across all `*Charts.tsx` files:
- Grid lines: `rgba(65,71,85,0.2)` (not `#f0f0f0`)
- Axis text: `#c1c6d7` at 11px
- Tooltip: bg `#201f1f`, border `rgba(65,71,85,0.3)`, text `#e5e2e1`
- Primary data: `#adc6ff`
- Secondary data: `#53e16f`
- Tertiary data: `#ffb595`
- Error data: `#ef4444`
- Gradients: use primary/secondary with 0.3 → 0 opacity

### 5. Code Block Styling
For any code display (Playground, Chat):
- Background: `#0e0e0e` (surface-container-lowest)
- Border-radius: `0.125rem` (keep sharp)
- Syntax colors: keywords `#ffb595`, strings `#53e16f`, comments `#c1c6d7`
- Header bar: `#2a2a2a` with copy button

**Files touched**: ~10-15 files (theme + shared components + chart files)
**Verification**: Navigate all major pages — consistent dark Kinetic look. Cards, tables, buttons, charts all match the Stitch mockups.

---

## Day 50: Page-Level Polish & Micro-Interactions

**Goal**: Fix any page-specific issues, add the Kinetic micro-interactions, add glassmorphism touches, and do a final QA sweep across all 34 routes.

### 1. Page-Specific Fixes
Scan each page category and fix remaining "old theme" artifacts:

**Dashboard pages** (dashboard, analytics, visualization, monitoring, realtime):
- Stat card left-border colors → use Kinetic palette
- Remove any hardcoded `#f0f0f0`, `#fff`, light-mode colors
- Chart containers: ensure border `rgba(65,71,85,0.15)`, bg `#201f1f`

**Form-heavy pages** (settings, keys, tokens, webhooks, teams, profile):
- Input fields: bg `#2a2a2a`, focus ring primary
- Select dropdowns: match input styling
- Form section headers: uppercase tracking-widest mono

**Table-heavy pages** (logs, jobs, workers, billing, quota):
- Ensure table header styling applied
- Row alternation: none (use hover instead)
- Pagination buttons: ghost style

**Interactive pages** (playground, chat, workflows, streams):
- Chat bubbles: user → `rgba(173,198,255,0.1)`, AI → `#201f1f`
- Workflow canvas: grid background `radial-gradient(circle, #2a2a2a 1px, transparent 1px)` 24px
- Streaming indicators: pulse animation using `#53e16f`

### 2. Micro-Interactions
Add subtle Kinetic interactions via MUI theme `defaultProps` and `styleOverrides`:
- Buttons: `transition: all 0.15s ease`, `active:scale(0.95)` via sx
- Cards/Paper: `transition: background-color 0.2s ease` on hover
- Nav items: `transition: all 0.15s ease`
- Links: brightness shift on hover (`filter: brightness(1.2)`)

### 3. Glassmorphism Touches
- TopBar already done in Day 48
- Floating action buttons (e.g., chat input area): glass panel style
- Any overlay/popover: `rgba(57,57,57,0.6)` + `backdrop-filter: blur(12px)`

### 4. Typography Audit
Sweep for any remaining issues:
- No pure `#ffffff` text anywhere → replace with `#e5e2e1`
- All numerical/technical data → JetBrains Mono
- Section labels → `10px uppercase tracking-widest`
- Remove any `fontFamily` overrides that don't match Inter/JetBrains

### 5. Mobile Responsive Check
- Sidebar collapse behavior still works
- TopBar glassmorphism renders on mobile
- Cards stack properly on small screens
- Touch targets remain >= 44px

### 6. Loading States
- Update LoadingSkeleton.tsx: skeleton colors from `#2a2a2a` (base) to `#353534` (highlight)
- CircularProgress: default color `#adc6ff`
- Ensure all loading states use Kinetic surface colors

### 7. Final QA Checklist
Walk through every route and verify:
- [ ] Background is `#131313` (not white/grey)
- [ ] Text is `#e5e2e1` (not pure white)
- [ ] Borders are `rgba(65,71,85,0.15)` (ghost borders)
- [ ] Border-radius never exceeds `0.5rem`
- [ ] Buttons use gradient or ghost style
- [ ] Tables have uppercase mono headers
- [ ] Charts use Kinetic color palette
- [ ] No remnant light-mode styles
- [ ] Sidebar active state has left blue accent
- [ ] Scrollbars are thin and dark

**Files touched**: ~15-25 page files (minor color fixes) + theme tweaks
**Verification**: Full walkthrough of all 34 routes. Screenshots match Stitch mockups in feel and tone.

---

## Summary

| Day | Focus | Key Deliverables | Files |
|-----|-------|-----------------|-------|
| **48** | Foundation | Theme tokens, sidebar, topbar, fonts, remove light mode | ~8 modified, 1 deleted |
| **49** | Components | StatCard, tables, buttons, inputs, chips, charts, code blocks | ~10-15 files |
| **50** | Polish | Page fixes, micro-interactions, glass, typography audit, QA | ~15-25 files |

### Design Principles to Maintain
1. **No border-radius > 0.5rem** — professional sharpness
2. **No pure white** — always `#e5e2e1` for text
3. **No drop shadows** — use tonal surface shifts for depth
4. **Monospace for data** — JetBrains Mono for numbers, IDs, metrics
5. **Uppercase for labels** — 10px tracking-widest for technical metadata
6. **Color restraint** — primary blue for actions, green for success only, orange for warnings
7. **Ghost borders** — `rgba(65,71,85,0.1-0.15)`, barely visible

### What We're NOT Changing
- No functionality changes
- No route additions/removals
- No API changes
- No new dependencies (except fonts via next/font)
- No component restructuring — just restyling
