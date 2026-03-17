# Public Announcements Feature Design

**Date:** 2026-02-27
**Branch:** `main` (Node.js), then ported to `java`
**Feature:** Public Announcements tab in Outreach Dashboard with Church TV View integration

---

## Summary

Add a "Public Announcements" tab to the Outreach Dashboard. Announcements are managed by admin and outreach roles. They are not shown as a public webpage — they display exclusively in Church TV View, which rotates full-screen between active announcements and pending welcome names.

---

## Data Model

### `announcements` table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID (Node) / BIGINT (Java) | PK |
| `title` | VARCHAR(255) | required |
| `description` | TEXT | HTML from TipTap rich text editor |
| `start_date` | DATE | required |
| `end_date` | DATE | required |
| `status` | ENUM(`active`, `cancelled`) | default `active` |
| `created_by_member_id` | FK → members | nullable |
| `created_at` | TIMESTAMP | auto |
| `updated_at` | TIMESTAMP | auto |

### `church_settings` table

| Column | Type | Notes |
|---|---|---|
| `key` | VARCHAR(100) | PK, e.g. `tv_rotation_interval_seconds` |
| `value` | TEXT | stored as string, parsed by consumer |
| `updated_at` | TIMESTAMP | auto |

### TV View Active Filter

```sql
WHERE status = 'active'
  AND start_date <= CURRENT_DATE
  AND end_date >= CURRENT_DATE
```

---

## API Design

All endpoints require authentication. Responses use `ApiResponse<T>`: `{ success, message, data }`.

### Announcements

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/announcements` | outreach, admin | List all; accepts `?status=active\|cancelled\|expired\|all` |
| `POST` | `/api/announcements` | outreach, admin | Create announcement |
| `PUT` | `/api/announcements/:id` | outreach, admin | Edit announcement |
| `PATCH` | `/api/announcements/:id/cancel` | outreach, admin | Soft-cancel |
| `GET` | `/api/announcements/active` | outreach, admin | TV feed — active + date-filtered |

### Church Settings

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/settings/tv-rotation-interval` | outreach, admin | Get interval in seconds |
| `PUT` | `/api/settings/tv-rotation-interval` | outreach, admin | Update interval |

---

## Frontend Architecture

### New files

```
frontend/src/components/admin/
  AnnouncementsPanel.tsx       # Tab content: table, status filters, create/edit/cancel
  AnnouncementFormModal.tsx    # Create/edit form with TipTap rich text editor
  ChurchTvView.tsx             # Full-screen rotation component (announcements + welcomes)
```

### `OutreachDashboard.tsx` changes

- Add `announcements` tab (third tab alongside `pending` / `welcomed`)
- Fetch announcements list + TV interval setting on mount
- When `isTvView = true`, render `<ChurchTvView>` instead of tab panels
- Pass `pending`, `announcements`, `rotationIntervalSeconds`, `onIntervalChange` to `ChurchTvView`

### `ChurchTvView` props

```ts
interface ChurchTvViewProps {
  pendingWelcomes: Member[]
  announcements: Announcement[]
  rotationIntervalSeconds: number
  onIntervalChange: (seconds: number) => void
}
```

- Manages `currentSlide: 'announcements' | 'welcomes'` state
- Cycles on `setInterval(rotationIntervalSeconds * 1000)`
- If one side is empty, skips it (only shows the non-empty side)
- If both empty, shows a placeholder screen
- CSS fade transition (0.5s) between slides
- Multiple active announcements rotate within their own slide at `interval / count` seconds each
- Gear icon (top-right) reveals interval input; on save calls `onIntervalChange`

### `AnnouncementsPanel` props

```ts
interface AnnouncementsPanelProps {
  canManage: boolean  // from permissions.canManageAnnouncements
}
```

- Self-contained: manages list, loading, error state
- Status filter tabs: Active | Expired | Cancelled
- "Add Announcement" button (gated by `canManage`)
- Table columns: Title, Start Date, End Date, Status, Actions (Edit / Cancel)
- Opens `AnnouncementFormModal` for create and edit

### `AnnouncementFormModal`

- TipTap editor with extensions: Bold, Italic, BulletList, OrderedList, Heading (H2/H3), Link
- Fields: Title, Description (TipTap), Start Date, End Date
- HTML stored as-is; sanitized with DOMPurify before rendering in TV view

### Permissions

New permission `canManageAnnouncements` added to `roles.ts`:
- `admin`: `true`
- `outreach`: `true`
- All other roles: `false`

`canAccessOutreachDashboard` gates visibility of the tab itself (no change).

---

## Church TV View UX

### Announcements slide
- Full-screen white background
- Large centered title (`text-5xl font-bold text-primary-800`)
- Rich text body (`text-2xl text-gray-700`), HTML sanitized via DOMPurify
- Subtle date range at bottom (`Jan 15 – Mar 1, 2026`)

### Welcome names slide
- Unchanged from current scrolling implementation

### Transitions
- CSS fade-out / fade-in (0.5s) between slides
- Driven by `useEffect` + `setInterval`

### Interval control
- Gear icon (top-right corner of TV view)
- Inline input: `Rotate every: [30] seconds`
- On save: `PUT /api/settings/tv-rotation-interval`, updates local timer

### Empty states
- No active announcements → skip announcements slide
- No pending welcomes → skip welcomes slide
- Both empty → single placeholder: "No announcements or new members"

---

## Implementation Scope

1. **Node.js backend** (`main` branch): migration, model, routes, controller
2. **Frontend** (`main` branch): `ChurchTvView`, `AnnouncementsPanel`, `AnnouncementFormModal`, `OutreachDashboard` updates, roles, i18n
3. **Java backend** (`java` branch): entity, repository, service, controller, security config update
