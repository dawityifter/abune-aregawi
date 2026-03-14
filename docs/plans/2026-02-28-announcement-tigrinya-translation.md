# Announcement Tigrinya Translation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow admins to optionally enter a Tigrinya title and description for each announcement; the Church TV View displays the Tigrinya version when `language === 'ti'`, falling back to English when no Tigrinya text was entered.

**Architecture:** Two nullable columns (`title_ti`, `description_ti`) are added to the `announcements` table. The Node.js backend accepts and returns both fields. The `AnnouncementFormModal` gets an expandable optional section for Tigrinya input. `ChurchTvView` selects the right text at render time based on the current language. The Java backend (`java` branch) mirrors the same changes to stay in parity.

**Tech Stack:** Node.js / Sequelize (migration + model + controller), React / TypeScript (form modal + TV view), i18n dictionary (`dictionaries.ts`), Java / Spring Boot + JPA (`java` branch).

---

## Phase 1 — Node.js Backend

### Task 1: Add Tigrinya-column migration

**Files:**
- Create: `backend/migrations/20260228000001-add-tigrinya-to-announcements.js`

**Step 1: Create the migration file**

```js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('announcements', 'title_ti', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('announcements', 'description_ti', {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('announcements', 'title_ti');
    await queryInterface.removeColumn('announcements', 'description_ti');
  }
};
```

**Step 2: Run migration locally**

```bash
cd backend && NODE_ENV=development npx sequelize-cli db:migrate
```
Expected: `== 20260228000001-add-tigrinya-to-announcements: migrated ==========`

---

### Task 2: Update Announcement model

**Files:**
- Modify: `backend/src/models/Announcement.js`

**Step 1: Add two new attributes inside `Announcement.init({ ... })`**

Add after the `description` field:
```js
title_ti: { type: DataTypes.STRING(255), allowNull: true },
description_ti: { type: DataTypes.TEXT, allowNull: true },
```

The full attributes block should be:
```js
id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
title: { type: DataTypes.STRING(255), allowNull: false },
description: { type: DataTypes.TEXT, allowNull: true },
title_ti: { type: DataTypes.STRING(255), allowNull: true },
description_ti: { type: DataTypes.TEXT, allowNull: true },
start_date: { type: DataTypes.DATEONLY, allowNull: false },
end_date: { type: DataTypes.DATEONLY, allowNull: false },
status: { type: DataTypes.ENUM('active', 'cancelled'), allowNull: false, defaultValue: 'active' },
created_by_member_id: { type: DataTypes.BIGINT, allowNull: true }
```

No test needed for model attribute additions (the controller tests cover persistence).

---

### Task 3: Update announcement controller

**Files:**
- Modify: `backend/src/controllers/announcementController.js`

**Step 1: Update `createAnnouncement` to read and persist the new fields**

Change the destructuring and create call:
```js
const { title, description, start_date, end_date, title_ti, description_ti } = req.body;
// ...
const announcement = await Announcement.create({
  id: uuidv4(), title, description, title_ti: title_ti || null, description_ti: description_ti || null,
  start_date, end_date, status: 'active', created_by_member_id: createdByMemberId
});
```

**Step 2: Update `updateAnnouncement` to persist the new fields**

Change the update call:
```js
const { title, description, start_date, end_date, title_ti, description_ti } = req.body;
// ...
await announcement.update({ title, description, title_ti: title_ti ?? announcement.title_ti, description_ti: description_ti ?? announcement.description_ti, start_date, end_date });
```

Note: `listAnnouncements` and `getActiveAnnouncements` already return all model attributes via `findAll`, so no changes needed there.

**Step 3: Run backend tests**

```bash
cd backend && npm test
```
Expected: All suites pass (green).

**Step 4: Commit**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backend/migrations/20260228000001-add-tigrinya-to-announcements.js \
        backend/src/models/Announcement.js \
        backend/src/controllers/announcementController.js
git commit -m "feat(backend): add title_ti and description_ti columns to announcements"
```

---

## Phase 2 — Frontend

### Task 4: Add i18n keys for Tigrinya translation section

**Files:**
- Modify: `frontend/src/i18n/dictionaries.ts`

The file has two dictionaries: `en` and `ti`. Both have an `announcements` object inside `outreachDashboard`.

**Step 1: Add three keys to the English `announcements` block**

Find this line in the `en` dictionary (around line 1262):
```
noAnnouncements: "No announcements found.",
```

Add after it (before the closing `}`):
```ts
titleTiLabel: "Title (Tigrinya)",
descriptionTiLabel: "Description (Tigrinya)",
tigrinyaSectionToggle: "Add Tigrinya Translation",
```

**Step 2: Add three keys to the Tigrinya `announcements` block**

Find the equivalent line in the `ti` dictionary (around line 1948):
```
noAnnouncements: "ሓበሬታ ኣይተረኸበን።",
```

Add after it (before the closing `}`):
```ts
titleTiLabel: "ኣርእስቲ (ትግርኛ)",
descriptionTiLabel: "መግለጺ (ትግርኛ)",
tigrinyaSectionToggle: "ትርጉም ትግርኛ ወሲኽ",
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: Zero errors in source files.

---

### Task 5: Update AnnouncementFormModal — interface and form section

**Files:**
- Modify: `frontend/src/components/admin/AnnouncementFormModal.tsx`

**Step 1: Extend `AnnouncementFormData` interface**

Change:
```ts
export interface AnnouncementFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
}
```
To:
```ts
export interface AnnouncementFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  title_ti?: string;
  description_ti?: string;
}
```

**Step 2: Add state for new fields**

Inside the component body, after the existing `useState` hooks, add:
```ts
const [titleTi, setTitleTi] = useState(initial?.title_ti || '');
const [descriptionTi, setDescriptionTi] = useState(initial?.description_ti || '');
const [tiSectionOpen, setTiSectionOpen] = useState(!!initial?.title_ti);
```

**Step 3: Include new fields in `handleSubmit`**

Change the `onSave` call:
```ts
onSave({
  title: title.trim(),
  description: editor?.getHTML() || '',
  start_date: startDate,
  end_date: endDate,
  title_ti: titleTi.trim() || undefined,
  description_ti: descriptionTi.trim() || undefined,
});
```

**Step 4: Add the collapsible Tigrinya section to the form JSX**

Insert this block between the English description `<div>` and the action buttons `<div className="flex justify-end...">`:

```tsx
{/* Tigrinya translation section */}
<div className="border rounded p-3 bg-gray-50">
  <button
    type="button"
    onClick={() => setTiSectionOpen(o => !o)}
    className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 w-full text-left"
  >
    <i className={`fas fa-chevron-${tiSectionOpen ? 'down' : 'right'} text-xs`}></i>
    {od.announcements.tigrinyaSectionToggle}
  </button>
  {tiSectionOpen && (
    <div className="mt-3 space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.titleTiLabel}</label>
        <input
          type="text"
          value={titleTi}
          onChange={e => setTitleTi(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
          dir="auto"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.descriptionTiLabel}</label>
        <textarea
          value={descriptionTi}
          onChange={e => setDescriptionTi(e.target.value)}
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 resize-y"
          dir="auto"
        />
      </div>
    </div>
  )}
</div>
```

**Step 5: Update TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: Zero errors.

---

### Task 6: Update AnnouncementsPanel — Announcement interface

**Files:**
- Modify: `frontend/src/components/admin/AnnouncementsPanel.tsx`

The `Announcement` interface in `AnnouncementsPanel.tsx` is used to type the objects fetched from the backend and passed to `AnnouncementFormModal` as `initial`. Add the two optional Tigrinya fields so they round-trip correctly.

**Step 1: Extend the `Announcement` interface**

Change:
```ts
interface Announcement {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'cancelled';
}
```
To:
```ts
interface Announcement {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'cancelled';
  title_ti?: string;
  description_ti?: string;
}
```

No other changes needed — `initial={editTarget ? { ...editTarget } : undefined}` already spreads the whole object.

---

### Task 7: Update ChurchTvView — Announcement interface and render logic

**Files:**
- Modify: `frontend/src/components/admin/ChurchTvView.tsx`

**Step 1: Extend the `Announcement` interface**

Change line 7:
```ts
interface Announcement { id: string; title: string; description: string; start_date: string; end_date: string; }
```
To:
```ts
interface Announcement { id: string; title: string; description: string; start_date: string; end_date: string; title_ti?: string; description_ti?: string; }
```

**Step 2: Update `renderAnnouncementSlide` to apply language fallback**

Replace the existing `renderAnnouncementSlide` body:

Current title line (line 66):
```tsx
<h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">{ann.title}</h2>
```
Replace with:
```tsx
<h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
  {language === 'ti' ? (ann.title_ti || ann.title) : ann.title}
</h2>
```

Current description block (lines 67-72):
```tsx
{ann.description && (
  <div
    className="text-2xl text-gray-700 max-w-3xl prose prose-2xl mx-auto"
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ann.description) }}
  />
)}
```
Replace with:
```tsx
{language === 'ti' && ann.description_ti ? (
  <p className="text-2xl text-gray-700 max-w-3xl mx-auto whitespace-pre-wrap">{ann.description_ti}</p>
) : ann.description ? (
  <div
    className="text-2xl text-gray-700 max-w-3xl prose prose-2xl mx-auto"
    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(ann.description) }}
  />
) : null}
```

**Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -20
```
Expected: Zero errors.

---

### Task 8: Update OutreachDashboard — pass title_ti/description_ti through

**Files:**
- Modify: `frontend/src/components/admin/OutreachDashboard.tsx`

`OutreachDashboard` fetches active announcements and stores them in `announcements` state, which is passed to `<ChurchTvView announcements={announcements} />`. The `Announcement` interface used inside `OutreachDashboard` needs the Tigrinya fields so TypeScript accepts them.

**Step 1: Find the local `Announcement` interface in `OutreachDashboard.tsx`**

Search for:
```ts
interface Announcement {
```

It should have `id`, `title`, `description`, `start_date`, `end_date`. Add:
```ts
title_ti?: string;
description_ti?: string;
```

**Step 2: TypeScript check (full)**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```
Expected: Zero errors.

---

### Task 9: Verify frontend tests

**Step 1: Run tests**

```bash
cd frontend && CI=true npx react-scripts test --watchAll=false 2>&1 | tail -20
```
Expected: All test suites pass.

**Step 2: Commit frontend changes**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add frontend/src/i18n/dictionaries.ts \
        frontend/src/components/admin/AnnouncementFormModal.tsx \
        frontend/src/components/admin/AnnouncementsPanel.tsx \
        frontend/src/components/admin/ChurchTvView.tsx \
        frontend/src/components/admin/OutreachDashboard.tsx
git commit -m "feat(frontend): add optional Tigrinya translation to announcements form and TV view"
```

---

## Phase 3 — Java Backend (java branch)

### Task 10: Switch to java branch and update Announcement entity

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/model/Announcement.java`

**Step 1: Switch to java branch**

```bash
git checkout java
```

**Step 2: Add two new fields to `Announcement.java`**

The file currently has `title`, `description`, `startDate`, `endDate`, `status`, `createdByMemberId`, `createdAt`, `updatedAt`. Add after `description`:

```java
@Column(name = "title_ti", length = 255)
private String titleTi;

@Column(name = "description_ti", columnDefinition = "TEXT")
private String descriptionTi;
```

Both fields use Lombok `@Builder`/`@Getter`/`@Setter`, so they're automatically included in the builder. Verify there is a `@Builder.Default` or similar on the class (Hibernate `ddl-auto: update` will add the columns automatically on restart).

---

### Task 11: Update AnnouncementDTO

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/dto/AnnouncementDTO.java`

**Step 1: Add fields to the DTO**

Add after `description`:
```java
private String titleTi;
private String descriptionTi;
```

**Step 2: Update the `from()` factory method**

Add to the builder chain inside `from(Announcement a)`:
```java
.titleTi(a.getTitleTi())
.descriptionTi(a.getDescriptionTi())
```

---

### Task 12: Update AnnouncementService and AnnouncementController

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/service/AnnouncementService.java`
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/controller/AnnouncementController.java`

**Step 1: Update `AnnouncementService.create()` to accept and persist `titleTi` and `descriptionTi`**

In the `create` method signature, change (or add to the parameter map) to also accept `titleTi` and `descriptionTi`. The exact signature depends on how the current method is structured — look at the existing signature and add the two new nullable String parameters.

Typical pattern (update accordingly):
```java
public AnnouncementDTO create(String title, String description, String titleTi, String descriptionTi,
                              LocalDate startDate, LocalDate endDate, Long createdByMemberId) {
    Announcement ann = Announcement.builder()
        .title(title).description(description)
        .titleTi(titleTi).descriptionTi(descriptionTi)
        .startDate(startDate).endDate(endDate)
        .createdByMemberId(createdByMemberId)
        .build();
    return AnnouncementDTO.from(announcementRepository.save(ann));
}
```

**Step 2: Update `AnnouncementService.update()` similarly**

Add `titleTi` and `descriptionTi` parameters; update the entity before saving:
```java
existing.setTitleTi(titleTi);
existing.setDescriptionTi(descriptionTi);
```

**Step 3: Update `AnnouncementController` to read `title_ti` / `description_ti` from request**

In the controller's `create` and `update` endpoints, read the two new fields from the JSON body and pass them to the service. The request body is likely a `Map<String, Object>` or a dedicated request record. Follow the existing pattern.

Example if body is a Map:
```java
String titleTi = (String) body.getOrDefault("title_ti", null);
String descriptionTi = (String) body.getOrDefault("description_ti", null);
```

**Step 4: Build the Java backend**

```bash
cd /Users/dawit/development/church/abune-aregawi/backendJava && ./gradlew assemble
```
Expected: `BUILD SUCCESSFUL`

**Step 5: Commit Java changes**

```bash
cd /Users/dawit/development/church/abune-aregawi
git add backendJava/src/main/java/church/abunearegawi/backend/model/Announcement.java \
        backendJava/src/main/java/church/abunearegawi/backend/dto/AnnouncementDTO.java \
        backendJava/src/main/java/church/abunearegawi/backend/service/AnnouncementService.java \
        backendJava/src/main/java/church/abunearegawi/backend/controller/AnnouncementController.java
git commit -m "feat(java): add titleTi and descriptionTi to Announcement entity, DTO, service, controller"
```

**Step 6: Switch back to main branch**

```bash
git checkout main
```

---

## Done

After all tasks are complete, the feature is live:
- Admins can click "Add Tigrinya Translation" in the announcement form and enter an optional Tigrinya title and/or description.
- The Church TV View displays Tigrinya text when the app language is set to `ti`, falling back to English otherwise.
- Java backend (java branch) has parity with the Node.js backend.
