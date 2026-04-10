# UI Redesign — Church Bylaw & Dues Pages

**Date:** 2026-04-09  
**Status:** Approved  
**Files:** `frontend/src/components/ChurchBylaw.tsx`, `frontend/src/components/DuesPage.tsx`

---

## Overview

Two pages accessed from the dashboard need visual and UX improvements:

- `/church-bylaw` — ChurchBylaw.tsx: Solid structure but basic styling. Needs a more authoritative, branded look.
- `/dues` — DuesPage.tsx: Perceived slow loading (blank wait before content) and plain visual design. Needs an instant skeleton and a dashboard-style layout.

---

## Page 1 — Church Bylaw (`ChurchBylaw.tsx`)

### Problem
The current page has a plain white sticky header and a minimal sidebar. The document header area (logo + title) is understated and doesn't reflect the church's identity.

### Design: Full-Width Hero + Refined Sidebar

**Hero banner (replaces the current document header section):**
- Full-width gradient banner: `from #7f1d1d → #991b1b → #78350f` (135deg/160deg)
- Subtle radial dot pattern overlay at 7% opacity for texture
- Gold subtitle line: church name in uppercase gold (`#fbbf24`), letter-spacing 2.5px
- Large serif title: "Church Bylaws" in white
- Tigrinya subtitle below in italic: "ሕጊ ቤተ ክርስቲያን"
- Gold gradient divider line (`transparent → #fbbf24 → transparent`)
- Inline pill buttons for EN / TI language toggle and Print — all rendered inside the hero, eliminating the need for a separate top bar on initial load

**Compact sticky bar (always sticky, visible once hero scrolls out of view):**
- White bar with bottom border
- Left: hamburger icon (mobile TOC toggle) + "Church Bylaws" title + current section breadcrumb (e.g., `› Preamble`)
- Right: EN/TI language toggle pills + Print icon + "↑ Top" link
- Replaces the current plain sticky header; EN/TI/Print must remain accessible after the hero scrolls away

**Sidebar TOC:**
- Active item: light red background (`#fef2f2`) + filled red dot (`#b91c1c`) before text + dark red bold label
- Inactive L1 items: plain text, medium gray
- L2 items (sub-sections): indented 20px, smaller font, lighter gray
- Hover state: light gray background
- Overall background: white, right border separating from content

**Content area:** No changes to markdown rendering logic or existing prose/heading styles.

**Footer:** Unchanged.

---

## Page 2 — Member Dues (`DuesPage.tsx`)

### Problem 1: Perceived Slow Loading
The page waits for `authReady` (Firebase auth resolution + backend profile probe with multi-second backoffs) before showing anything. This results in a blank or full-spinner wait of several seconds.

### Fix: Layout-Mirroring Skeleton
Show the skeleton **immediately on mount**, before `authReady` is true. The skeleton mirrors the exact layout of the loaded state so the transition feels instant:
- Red banner placeholder (rounded rect, `#e5e7eb`, shimmer animation)
- 4 stat card placeholders in a 4-column grid
- Month grid placeholder (full-width rect)
- Payment table placeholder (rows)

Shimmer animation: `translateX(-100%) → translateX(200%)` over 1.5s, staggered delays per element.

The real content replaces the skeleton once data arrives. The existing spinner-only loading state is removed.

### Problem 2: Plain Visual Design

### Design: Dashboard Layout

**Header banner card:**
- Red background (`#b91c1c`), rounded (10px), subtle drop shadow
- Left: "Member Dues" label (uppercase, faded white) + member full name (large, bold white) + "Calculated from parish join date" note (small italic, faded)
- Right: year toggle pills — active year is white with red text + shadow; inactive is translucent white border

**4 Stat cards (replacing current colored-bg boxes):**
- White background, 8px border-radius, subtle shadow
- Colored **left border** (4px): green (collected), red (balance due), amber (other payments), purple (yearly pledge)
- Label: small uppercase gray text
- Value: large bold number in matching color

**Month grid (replacing current month table):**
- White card section titled "Monthly Status"
- 12 tiles in a 6-column grid (responsive: 4-col on mobile)
- Tile states (the `MonthStatus` type has `status` and `isFutureMonth` fields):
  - `status === 'paid'` → green background (`#dcfce7`) + green border + `✓` checkmark
  - `status === 'due'` and month < current month → red background (`#fee2e2`) + red border + "Due" label in red (overdue)
  - `status === 'due'` and month === current month → yellow background (`#fef9c3`) + yellow border + "Due" label in amber
  - `status === 'upcoming'` → gray background (`#f3f4f6`) + gray border + `—` dash
  - `status === 'pre-membership'` → same as upcoming (gray, `—`), to keep the grid full 12 tiles
  - Current month is determined by comparing the month name string to `new Date().toLocaleString('en',{month:'long'}).toLowerCase()`
- Monthly commitment note below grid

**Payment history table:**
- White card with title "Payment History" in header row
- Striped header row (`#f9fafb`), clean row dividers
- Status column uses pill badges: green "Succeeded", yellow "Pending"
- Columns: Date, Amount, Type, Method, Receipt #, Note, Status (all existing columns kept)

**Annual Contribution Statement section (prior years only):**
- White card with a 3px top red border accent
- Title + description + red "Print Statement" button
- No structural change, just styled to match the new card pattern

---

## Shared Design Tokens

These come from the existing Tailwind config — no new tokens needed:

| Token | Value | Use |
|---|---|---|
| `primary-700` | `#991b1b` | Hero gradient mid |
| `primary-800` | `#7f1d1d` | Hero gradient start |
| `secondary-600` | `#fbbf24` | Gold accents (bylaw hero) |
| `accent-500` | `#92400e` | Hero gradient end (brown) |

---

## Out of Scope

- No changes to routing, API calls, auth logic, or backend
- No changes to the markdown rendering components or TOC generation logic in ChurchBylaw
- No changes to the download/email statement functionality in DuesPage
- No new dependencies
