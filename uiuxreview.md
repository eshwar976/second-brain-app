# UI/UX Review: Second Brain Capture

Comprehensive review based on the UI/UX Pro Max framework (10 priority categories).  
The app is a well-crafted vanilla JS SPA with a warm, paper-like aesthetic and strong accessibility foundations. Below are findings organized by severity.

---

## Priority 1 — Accessibility (CRITICAL)

### ✅ What's Good
- `aria-labels` on icon-only buttons (send, close, sheet triggers)
- `aria-live="polite"` on chat timeline, toast, helper lines
- `role="dialog"`, `aria-modal`, `aria-labelledby` on all sheets
- Semantic form labels with `for` attributes (via `.sr-only`)
- `aria-current="page"` on active nav item
- `aria-expanded` on session picker and actions menu
- Keyboard `Escape` handling for all sheets and menus
- Toast uses `role="status"` for screen reader announcements

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **No skip-to-content link** — Keyboard users must tab through all 5 nav items first | `index.html` (top of `<body>`) | High |
| 2 | **No `prefers-reduced-motion` support** — All animations run unconditionally | `styles.css` (all `@keyframes`, transitions) | High |
| 3 | **Missing focus indicators on key elements** — `.nav-item`, `.chip`, `.choice-button`, `.task-badge-button` lack visible `:focus-visible` rings | `styles.css` | Medium |
| 4 | **No visible `h1` heading** — Highest semantic heading is `h2`, creating a hierarchy gap for screen readers | `index.html` | Medium |
| 5 | **Toast content auto-dismisses** (5200ms) — Users who miss the toast lose undo opportunity; no persistent undo button elsewhere | `app.js` `showUndoToast()` | Low |

---

## Priority 2 — Touch & Interaction (CRITICAL)

### ✅ What's Good
- Nav items at 66px desktop / 48px mobile — above 44pt minimum
- Category chips at 34px height
- Sheet action buttons at 38-40px
- `cursor: pointer` on all clickable elements
- `.session-row-actions` switches to `opacity: 1` on touch devices via `@media (hover: none)`

### 🔴 Issues

| # | Issue | Location | Target Size |
|---|-------|----------|-------------|
| 1 | **Task info button (`↗`) too small** | `app.js` `renderTaskSourceInfo()` — 22×22px | 22px ❌ (< 44pt) |
| 2 | **Session icon buttons too small** | `.session-icon-button` — 34×34px | 34px ❌ |
| 3 | **Deep Work card buttons** (26px), **context action buttons** (26px) too small | `.deep-work-card button`, `.chat-context-hide` | 26px ❌ |
| 4 | **Session row actions** — 30×30px buttons with 2px gap | `.session-row-actions button` | 30px ❌ |
| 5 | **No `touch-action: manipulation`** on interactive elements | `styles.css` (could cause 300ms tap delay on older mobile) | Low |
| 6 | **No visible pressed/ripple feedback** on nav, chips, most buttons — only color/elevation transitions | `styles.css` | Low |

---

## Priority 3 — Performance (HIGH)

### ✅ What's Good
- System font stack — no web font loading
- No images to optimize
- `transform`/`opacity` for animations
- SPA with single stylesheet

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **No skeleton loading states** — Data sections show empty state then content pops in; no shimmer/skeleton | `app.js` (all `load*` functions) | Medium |
| 2 | **Single ~4.3K-line JS file, no code splitting** — All features loaded upfront; Chat/Sprint/Dashboard code runs even on Capture tab | `public/app.js` | Medium |
| 3 | **No list virtualization** — Task lists and capture timelines with 100+ items render all DOM nodes | `app.js` `renderTasks()` / `renderTimeline()` | Low |

---

## Priority 4 — Style Selection (HIGH)

### ✅ What's Good
- Cohesive warm, paper-like aesthetic
- SVG icon sprite — no emoji as icons
- Consistent border-radius (8px standard, 999px pill)
- Category colors are well-chosen and distinct
- Blur effects used purposefully on top bars and composers
- Dark mode is fully implemented

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Non-standard font weights used** (650, 720, 750, 800, 850, 900) — rely on Inter being installed; fallback rendering varies | `styles.css` (many selectors) | Medium |
| 2 | **Chat swipe affordance uses fragile `::before` positioning** — "Chat" label positioned absolutely at `inset: 10px` | `.capture-bubble::before` | Low |
| 3 | **No micro-interaction on primary send button** beyond opacity change | `.send-button` | Low |

---

## Priority 5 — Layout & Responsive (HIGH)

### ✅ What's Good
- `viewport-fit=cover` + `env(safe-area-inset-*)` throughout
- `min-height: 100dvh` usage
- Responsive grid adjustments at 560px (mobile) and 390px (small mobile)
- Desktop sidebar / mobile bottom nav pattern
- Touch density on mobile is reasonable

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Body text below 16px on mobile** — Capture text 15px, chat text 14px. Below 16px triggers iOS auto-zoom on input focus | `.capture-text` (15px), `.chat-text` (14px) | High |
| 2 | **Non-standard spacing system** — Uses 2/3/4/5/6/7/8/9/10/12/14/16/18px instead of 4pt/8dp incremental rhythm | `styles.css` (throughout) | Medium |
| 3 | **Non-standard breakpoints** (560px/760px) — Tablets in portrait (768px) get mobile layout; only breakpoint above mobile is 760px | `styles.css` `@media` blocks | Medium |
| 4 | **Hidden scroll on horizontal containers** — `.chat-context-chips` and `.chat-composer-tools` scroll with `scrollbar-width: none`; users may not discover overflow | `styles.css` (mobile) | Medium |
| 5 | **`white-space: nowrap` on `h1`** — Long vault name will overflow/be clipped | `styles.css` `h1` | Low |

---

## Priority 6 — Typography & Color (MEDIUM)

### ✅ What's Good
- Color palette is cohesive: warm paper tones with sage/teal/amber/plum accents
- Dark mode has separately tuned token values (not inverted)
- Line heights 1.38-1.48 — close to recommended 1.5
- `color-mix()` for dynamic alpha is innovative

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Muted text contrast fails WCAG AA** — `#7a756e` on `#f7f4ee` ≈ 3.5:1 (below 4.5:1) | `--muted: #7a756e` on `--paper: #f7f4ee` | High |
| 2 | **Raw hex values instead of semantic tokens** — `#405c45` / `#c8dcc2` in `.nav-item.is-active`, `.vault-pill`, `.secondary-button`, `.model-pill` | `styles.css` (multiple selectors) | Medium |
| 3 | **Hardcoded placeholder color `#9a948b`** — Not tokenized, may not adapt properly in all dark mode scenarios | `styles.css` `textarea::placeholder`, `.search-form input::placeholder` | Medium |
| 4 | **Font-size 9px on badges** — Below recommended 11px minimum for readability | `.nav-badge` (9px) | Low |
| 5 | **No tabular figures for dashboard metrics** — Numbers shift width as they change | Dashboard metric values | Low |

---

## Priority 7 — Animation (MEDIUM)

### ✅ What's Good
- Duration range 140-260ms — within recommended 150-300ms
- Uses `transform` and `opacity` for animations
- Easing uses `ease` and `ease-out`
- Session drawer animation is subtle and purposeful

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **No `prefers-reduced-motion`** — All animations run unconditionally | `styles.css` | High |
| 2 | **No entrance animations** — Capture bubbles, chat messages, and task rows appear instantly | `app.js` render functions | Low |
| 3 | **Task completion transform too subtle** — `translateY(2px) scale(0.992)` may not be noticed | `.task-row.is-completing` | Low |

---

## Priority 8 — Forms & Feedback (MEDIUM)

### ✅ What's Good
- Toast with undo for task completion
- Auto-save / duplicate protection on captures
- Screen-reader-accessible helper lines (`aria-live="polite"`)
- Disabled states with opacity + `cursor: not-allowed`
- Shortcut: Ctrl+Enter / Cmd+Enter submits on desktop

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **Placeholder-only visible labels** on textareas — Only `.sr-only` `<label>` elements; no persistent visible label or floating label | Capture + Chat composers | Medium |
| 2 | **No inline validation errors** — Forms submit silently; errors shown via toast/helper text but no persistent error state near the field | `app.js` submit handlers | Medium |
| 3 | **No `enterkeyhint`** attributes on mobile textareas for keyboard submit hint | `index.html` textareas | Low |
| 4 | **No saving spinner on send button** — Only `opacity: 0.72` via `is-saving` class | `.send-button.is-saving` | Low |
| 5 | **No multi-step progress for todo capture → triage flow** — Sheet opens with no step indicator | `index.html` todo-sheet | Low |

---

## Priority 9 — Navigation Patterns (HIGH)

### ✅ What's Good
- 5 tabs — within 5-item max for bottom nav
- Mobile bottom nav with labels + icons
- Active state highlighting
- Consistent nav placement across all pages
- Escape key dismisses overlays
- Sheet backdrops are dismissable

### 🔴 Issues

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| 1 | **No deep linking to tabs** — URL doesn't change; cannot share/bookmark a specific tab | `app.js` `setActiveTab()` | Medium |
| 2 | **No scroll position restoration** — Switching tabs resets scroll position | `app.js` tab switching | Medium |
| 3 | **Session drawer has no exit animation** — Opens with `session-drawer-in` but closes with no matching out animation | `.session-drawer` | Low |

---

## Priority 10 — Charts & Data (N/A)

Metric tiles and grids used instead of charts. Not applicable.

---

## Pre-Delivery Checklist Summary

### ❌ Failed Items

| Category | Item | Location |
|---|---|---|
| **Visual Quality** | Badge pressed state uses `translateY(-1px)` which may shift layout | `.task-badge-button` |
| **Interaction** | Touch targets below 44pt minimum | task-info-button (22px), session-icon-button (34px), multiple 26-30px buttons |
| **Interaction** | No `prefers-reduced-motion` support | Entire app |
| **Light/Dark** | Muted text contrast below 4.5:1 in light mode | `--muted: #7a756e` on `--paper: #f7f4ee` (~3.5:1) |
| **Layout** | Body text below 16px on mobile (14-15px) | `.chat-text`, `.capture-text` |
| **Layout** | Desktop paragraphs not constrained — can go edge-to-edge | Chat messages, task text |
| **Accessibility** | No skip-to-content link | Top of `index.html` |
| **Accessibility** | No visible `h1` — heading hierarchy starts at `h2` | All pages |

---

## Recommended Action Priority

| Priority | Action | Effort |
|----------|--------|--------|
| 🔴 **Immediate** | Add `prefers-reduced-motion` queries wrapping all transitions/animations | Small |
| 🔴 **Immediate** | Increase touch targets below 44pt (task-info, icon buttons, context buttons) | Small |
| 🔴 **Immediate** | Fix muted text contrast (`--muted`) to meet 4.5:1 in light mode | Small |
| 🟡 **High** | Add skip-to-content link at top of `<body>` | Small |
| 🟡 **High** | Increase body text to min 16px on mobile | Small |
| 🟡 **High** | Add `:focus-visible` styles to nav items, chips, choice buttons, task badges | Small |
| 🟡 **High** | Replace raw hex values (`#405c45`, `#c8dcc2`) with `var(--sage)` etc. | Small |
| 🟢 **Medium** | Add skeleton/shimmer loading states for data sections | Medium |
| 🟢 **Medium** | Add `h1` heading for screen reader hierarchy | Small |
| 🟢 **Medium** | Add visible labels (or floating labels) to textarea inputs | Medium |
| 🔵 **Nice to have** | Standardize spacing to 4pt/8dp rhythm | Large |
| 🔵 **Nice to have** | Add entrance animations for list items | Medium |
| 🔵 **Nice to have** | Add deep linking (hash-based tab routing) | Medium |
| 🔵 **Nice to have** | Standardize breakpoints to common values (640/768/1024) | Medium |
