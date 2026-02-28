# Announcement Tigrinya Translation — Design

**Date:** 2026-02-28
**Status:** Approved

## Goal

Display announcements in Tigrinya on the Church TV View when the selected language is Tigrinya (`ti`). Admins optionally enter a Tigrinya title and description when creating or editing an announcement; the TV view falls back to English when no Tigrinya version exists.

---

## Data Model

Add two nullable columns to the `announcements` table:

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `title_ti` | VARCHAR(255) | Yes | Tigrinya title |
| `description_ti` | TEXT | Yes | Tigrinya description (plain text, not HTML) |

Rationale: plain text for `description_ti` keeps the form lightweight (no second TipTap editor needed) and Tigrinya script doesn't typically need inline HTML formatting.

---

## Backend Changes

### Node.js (main branch)

- **Migration**: `ALTER TABLE announcements ADD COLUMN title_ti VARCHAR(255); ADD COLUMN description_ti TEXT`
- **Model**: Add `title_ti` and `description_ti` attributes (STRING, TEXT, allowNull: true)
- **Controllers**: `createAnnouncement` and `updateAnnouncement` accept and persist both fields; `listAnnouncements` and `getActiveAnnouncements` return them

### Java (java branch)

- **Entity** (`Announcement.java`): Add `titleTi` and `descriptionTi` fields
- **DTO** (`AnnouncementDTO.java`): Add `titleTi` and `descriptionTi` to builder and `from()` factory
- **Service** (`AnnouncementService.java`): Accept and persist both fields in `create` and `update`
- **Controller** (`AnnouncementController.java`): Read `title_ti` / `description_ti` from request body and pass to service

---

## Frontend Changes

### AnnouncementFormModal

- Add `title_ti?: string` and `description_ti?: string` to the `AnnouncementFormData` interface
- Add a collapsed `▶ Add Tigrinya Translation` section below the English description
- Clicking it expands to show:
  - **Title (ትግርኛ)** — plain text input, optional
  - **Description (ትግርኛ)** — plain `<textarea>`, optional
- The section auto-expands when `initial?.title_ti` is non-empty (i.e. editing an announcement that already has a Tigrinya version)

### ChurchTvView

- Update the `Announcement` interface: add `title_ti?: string` and `description_ti?: string`
- In `renderAnnouncementSlide`, when `language === 'ti'`:
  - Title: `ann.title_ti || ann.title`
  - Description: if `ann.description_ti` is set, render as plain text (`<p>`); otherwise render `ann.description` as HTML (existing DOMPurify path)

### i18n (dictionaries.ts)

Add to both `en` and `ti` dictionaries under `outreachDashboard.announcements`:
- `titleTiLabel` — "Title (Tigrinya)" / "ኣርእስቲ (ትግርኛ)"
- `descriptionTiLabel` — "Description (Tigrinya)" / "መግለጺ (ትግርኛ)"
- `tigrinyaSectionToggle` — "Add Tigrinya Translation" / "ትርጉም ትግርኛ ወሲኽ"

---

## Fallback Behaviour

| `language` | `title_ti` set? | Shown on TV |
|---|---|---|
| `en` | any | English title always |
| `ti` | yes | Tigrinya title |
| `ti` | no | English title (fallback) |

Same logic applies to description.

---

## Out of Scope

- Machine translation (not needed; admins enter Tigrinya manually)
- Tigrinya display in the AnnouncementsPanel list table (only TV view is affected)
- Rich text (TipTap) for Tigrinya description
