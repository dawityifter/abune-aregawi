# Public Announcements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Public Announcements" tab to the Outreach Dashboard with full CRUD for admin/relationship roles, and extend the Church TV View to rotate full-screen between active announcements and pending welcome names.

**Architecture:** Modular — a new `AnnouncementsPanel` component handles CRUD in the tab, a new `ChurchTvView` component handles TV rotation (extracted from the inline TV code in `OutreachDashboard`), and `OutreachDashboard` becomes a thin orchestrator. Both Node.js (`main`) and Java (`java`) backends implement the same API contract.

**Tech Stack:** Node.js/Express/Sequelize (main branch), Spring Boot/JPA (java branch), React/TypeScript, TipTap (rich text), DOMPurify (HTML sanitization), Tailwind CSS.

---

## PHASE 1 — Node.js Backend (main branch)

### Task 1: Migration — create `announcements` table

**Files:**
- Create: `backend/migrations/20260227000001-create-announcements.js`

**Step 1: Create the migration file**

```js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('announcements', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.ENUM('active', 'cancelled'), allowNull: false, defaultValue: 'active' },
      created_by_member_id: { type: Sequelize.BIGINT, allowNull: true, references: { model: 'members', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('announcements', ['status', 'start_date', 'end_date'], { name: 'announcements_tv_filter_idx' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('announcements');
  }
};
```

**Step 2: Run the migration**

```bash
cd backend && npx sequelize-cli db:migrate
```
Expected: `== 20260227000001-create-announcements: migrated`

**Step 3: Commit**

```bash
git add backend/migrations/20260227000001-create-announcements.js
git commit -m "feat: add announcements table migration"
```

---

### Task 2: Migration — create `church_settings` table

**Files:**
- Create: `backend/migrations/20260227000002-create-church-settings.js`

**Step 1: Create the migration file**

```js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('church_settings', {
      key: { type: Sequelize.STRING(100), primaryKey: true, allowNull: false },
      value: { type: Sequelize.TEXT, allowNull: true },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    // Seed the default TV rotation interval
    await queryInterface.bulkInsert('church_settings', [{
      key: 'tv_rotation_interval_seconds',
      value: '30',
      updated_at: new Date()
    }]);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('church_settings');
  }
};
```

**Step 2: Run the migration**

```bash
cd backend && npx sequelize-cli db:migrate
```
Expected: `== 20260227000002-create-church-settings: migrated`

**Step 3: Commit**

```bash
git add backend/migrations/20260227000002-create-church-settings.js
git commit -m "feat: add church_settings table migration with default TV interval"
```

---

### Task 3: Sequelize Model — Announcement

**Files:**
- Create: `backend/src/models/Announcement.js`
- Modify: `backend/src/models/index.js` (Sequelize auto-loads all files in models dir — verify it does, no change needed if so)

**Step 1: Create the model**

```js
'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Announcement extends Model {
    static associate(models) {
      Announcement.belongsTo(models.Member, { foreignKey: 'created_by_member_id', as: 'createdBy' });
    }
  }

  Announcement.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'cancelled'), allowNull: false, defaultValue: 'active' },
    created_by_member_id: { type: DataTypes.BIGINT, allowNull: true }
  }, {
    sequelize,
    modelName: 'Announcement',
    tableName: 'announcements',
    timestamps: true,
    underscored: true
  });

  return Announcement;
};
```

**Step 2: Verify model loads**

```bash
cd backend && node -e "const { Announcement } = require('./src/models'); console.log('Model loaded:', !!Announcement);"
```
Expected: `Model loaded: true`

**Step 3: Commit**

```bash
git add backend/src/models/Announcement.js
git commit -m "feat: add Announcement Sequelize model"
```

---

### Task 4: Sequelize Model — ChurchSetting

**Files:**
- Create: `backend/src/models/ChurchSetting.js`

**Step 1: Create the model**

```js
'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ChurchSetting extends Model {}

  ChurchSetting.init({
    key: { type: DataTypes.STRING(100), primaryKey: true, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'ChurchSetting',
    tableName: 'church_settings',
    timestamps: true,
    updatedAt: 'updated_at',
    createdAt: false,
    underscored: true
  });

  return ChurchSetting;
};
```

**Step 2: Verify model loads**

```bash
cd backend && node -e "const { ChurchSetting } = require('./src/models'); console.log('Model loaded:', !!ChurchSetting);"
```
Expected: `Model loaded: true`

**Step 3: Commit**

```bash
git add backend/src/models/ChurchSetting.js
git commit -m "feat: add ChurchSetting Sequelize model"
```

---

### Task 5: Controller — announcements

**Files:**
- Create: `backend/src/controllers/announcementController.js`

**Step 1: Create the controller**

```js
'use strict';
const { Announcement } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// GET /api/announcements?status=active|cancelled|expired|all
const listAnnouncements = async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const today = new Date().toISOString().split('T')[0];
    let where = {};

    if (status === 'active') {
      where = { status: 'active', start_date: { [Op.lte]: today }, end_date: { [Op.gte]: today } };
    } else if (status === 'cancelled') {
      where = { status: 'cancelled' };
    } else if (status === 'expired') {
      where = { status: 'active', end_date: { [Op.lt]: today } };
    }

    const announcements = await Announcement.findAll({ where, order: [['start_date', 'DESC']] });
    return res.json({ success: true, data: announcements });
  } catch (err) {
    console.error('listAnnouncements error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list announcements' });
  }
};

// GET /api/announcements/active — TV feed
const getActiveAnnouncements = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const announcements = await Announcement.findAll({
      where: { status: 'active', start_date: { [Op.lte]: today }, end_date: { [Op.gte]: today } },
      order: [['start_date', 'DESC']]
    });
    return res.json({ success: true, data: announcements });
  } catch (err) {
    console.error('getActiveAnnouncements error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch active announcements' });
  }
};

// POST /api/announcements
const createAnnouncement = async (req, res) => {
  try {
    const { title, description, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'title, start_date, and end_date are required' });
    }
    const createdByMemberId = req.user?.id || null;
    const announcement = await Announcement.create({
      id: uuidv4(), title, description, start_date, end_date,
      status: 'active', created_by_member_id: createdByMemberId
    });
    return res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    console.error('createAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

// PUT /api/announcements/:id
const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });

    const { title, description, start_date, end_date } = req.body;
    await announcement.update({ title, description, start_date, end_date });
    return res.json({ success: true, data: announcement });
  } catch (err) {
    console.error('updateAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
};

// PATCH /api/announcements/:id/cancel
const cancelAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findByPk(id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    await announcement.update({ status: 'cancelled' });
    return res.json({ success: true, data: announcement });
  } catch (err) {
    console.error('cancelAnnouncement error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel announcement' });
  }
};

module.exports = { listAnnouncements, getActiveAnnouncements, createAnnouncement, updateAnnouncement, cancelAnnouncement };
```

**Step 2: Commit**

```bash
git add backend/src/controllers/announcementController.js
git commit -m "feat: add announcement controller"
```

---

### Task 6: Controller — church settings

**Files:**
- Create: `backend/src/controllers/churchSettingController.js`

**Step 1: Create the controller**

```js
'use strict';
const { ChurchSetting } = require('../models');

// GET /api/settings/tv-rotation-interval
const getTvRotationInterval = async (req, res) => {
  try {
    const setting = await ChurchSetting.findByPk('tv_rotation_interval_seconds');
    const seconds = setting ? parseInt(setting.value, 10) : 30;
    return res.json({ success: true, data: { seconds } });
  } catch (err) {
    console.error('getTvRotationInterval error:', err);
    return res.status(500).json({ success: false, message: 'Failed to get TV rotation interval' });
  }
};

// PUT /api/settings/tv-rotation-interval
const setTvRotationInterval = async (req, res) => {
  try {
    const { seconds } = req.body;
    const value = parseInt(seconds, 10);
    if (!value || value < 5 || value > 300) {
      return res.status(400).json({ success: false, message: 'seconds must be between 5 and 300' });
    }
    await ChurchSetting.upsert({ key: 'tv_rotation_interval_seconds', value: String(value) });
    return res.json({ success: true, data: { seconds: value } });
  } catch (err) {
    console.error('setTvRotationInterval error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update TV rotation interval' });
  }
};

module.exports = { getTvRotationInterval, setTvRotationInterval };
```

**Step 2: Commit**

```bash
git add backend/src/controllers/churchSettingController.js
git commit -m "feat: add church settings controller"
```

---

### Task 7: Routes — announcements and settings

**Files:**
- Create: `backend/src/routes/announcementRoutes.js`
- Create: `backend/src/routes/settingRoutes.js`

**Step 1: Create announcement routes**

```js
'use strict';
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { listAnnouncements, getActiveAnnouncements, createAnnouncement, updateAnnouncement, cancelAnnouncement } = require('../controllers/announcementController');

const ALLOWED_ROLES = ['admin', 'relationship'];

// TV feed — active only, auth required
router.get('/active', firebaseAuthMiddleware, getActiveAnnouncements);
// List all with ?status= filter
router.get('/', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), listAnnouncements);
// Create
router.post('/', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), createAnnouncement);
// Update
router.put('/:id', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), updateAnnouncement);
// Cancel (soft delete)
router.patch('/:id/cancel', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), cancelAnnouncement);

module.exports = router;
```

**Step 2: Create settings routes**

```js
'use strict';
const express = require('express');
const router = express.Router();
const { firebaseAuthMiddleware } = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const { getTvRotationInterval, setTvRotationInterval } = require('../controllers/churchSettingController');

const ALLOWED_ROLES = ['admin', 'relationship'];

router.get('/tv-rotation-interval', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), getTvRotationInterval);
router.put('/tv-rotation-interval', firebaseAuthMiddleware, roleMiddleware(ALLOWED_ROLES), setTvRotationInterval);

module.exports = router;
```

**Step 3: Commit**

```bash
git add backend/src/routes/announcementRoutes.js backend/src/routes/settingRoutes.js
git commit -m "feat: add announcement and settings routes"
```

---

### Task 8: Register routes in server.js

**Files:**
- Modify: `backend/src/server.js`

**Step 1: Add requires and registrations**

After the existing requires (around line 20), add:
```js
const announcementRoutes = require('./routes/announcementRoutes');
const settingRoutes = require('./routes/settingRoutes');
```

After line 263 (`app.use('/api/bank', bankRoutes);`), add:
```js
app.use('/api/announcements', announcementRoutes);
app.use('/api/settings', settingRoutes);
```

**Step 2: Smoke test**

```bash
cd backend && node -e "require('./src/server'); console.log('Server loaded OK');" 2>&1 | head -5
```
Expected: no errors, `Server loaded OK`

**Step 3: Commit**

```bash
git add backend/src/server.js
git commit -m "feat: register announcement and settings routes"
```

---

### Task 9: Integration tests — announcements API

**Files:**
- Create: `backend/tests/integration/announcements.test.js`

**Step 1: Write the tests**

```js
const request = require('supertest');
const app = require('../../src/server');
const { Announcement, ChurchSetting } = require('../../src/models');

// Mock Firebase auth — reuse the pattern from other integration tests
jest.mock('firebase-admin', () => ({
  auth: () => ({ verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-uid' }) }),
  apps: [{}]
}));

// Mock role middleware to inject a relationship-role user
jest.mock('../../src/middleware/auth', () => ({
  firebaseAuthMiddleware: (req, _res, next) => {
    req.user = { id: 1, role: 'relationship', roles: ['relationship'] };
    next();
  },
  authMiddleware: (req, _res, next) => { req.user = { id: 1, role: 'relationship', roles: ['relationship'] }; next(); }
}));

describe('Announcement API', () => {
  beforeEach(async () => {
    await Announcement.destroy({ where: {} });
  });

  it('POST /api/announcements creates an announcement', async () => {
    const res = await request(app).post('/api/announcements').send({
      title: 'Test', description: '<p>Hello</p>', start_date: '2026-01-01', end_date: '2099-12-31'
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Test');
    expect(res.body.data.status).toBe('active');
  });

  it('GET /api/announcements/active returns only date-valid active announcements', async () => {
    await Announcement.create({ id: require('uuid').v4(), title: 'Active', start_date: '2026-01-01', end_date: '2099-12-31', status: 'active' });
    await Announcement.create({ id: require('uuid').v4(), title: 'Expired', start_date: '2020-01-01', end_date: '2020-12-31', status: 'active' });
    const res = await request(app).get('/api/announcements/active');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('Active');
  });

  it('PATCH /api/announcements/:id/cancel soft-cancels the announcement', async () => {
    const ann = await Announcement.create({ id: require('uuid').v4(), title: 'ToCancel', start_date: '2026-01-01', end_date: '2099-12-31', status: 'active' });
    const res = await request(app).patch(`/api/announcements/${ann.id}/cancel`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
    const reloaded = await Announcement.findByPk(ann.id);
    expect(reloaded.status).toBe('cancelled');
  });

  it('GET /api/announcements?status=cancelled returns only cancelled', async () => {
    await Announcement.create({ id: require('uuid').v4(), title: 'Active', start_date: '2026-01-01', end_date: '2099-12-31', status: 'active' });
    await Announcement.create({ id: require('uuid').v4(), title: 'Cancelled', start_date: '2026-01-01', end_date: '2099-12-31', status: 'cancelled' });
    const res = await request(app).get('/api/announcements?status=cancelled');
    expect(res.status).toBe(200);
    expect(res.body.data.every((a) => a.status === 'cancelled')).toBe(true);
  });
});

describe('Church Settings API', () => {
  it('GET /api/settings/tv-rotation-interval returns default 30', async () => {
    const res = await request(app).get('/api/settings/tv-rotation-interval');
    expect(res.status).toBe(200);
    expect(res.body.data.seconds).toBe(30);
  });

  it('PUT /api/settings/tv-rotation-interval updates the value', async () => {
    const res = await request(app).put('/api/settings/tv-rotation-interval').send({ seconds: 45 });
    expect(res.status).toBe(200);
    expect(res.body.data.seconds).toBe(45);
    const setting = await ChurchSetting.findByPk('tv_rotation_interval_seconds');
    expect(setting.value).toBe('45');
  });

  it('PUT /api/settings/tv-rotation-interval rejects value < 5', async () => {
    const res = await request(app).put('/api/settings/tv-rotation-interval').send({ seconds: 2 });
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run the tests**

```bash
cd backend && npx jest tests/integration/announcements.test.js --verbose
```
Expected: all 7 tests pass

**Step 3: Commit**

```bash
git add backend/tests/integration/announcements.test.js
git commit -m "test: add integration tests for announcements and settings APIs"
```

---

## PHASE 2 — Frontend (main branch)

### Task 10: Install TipTap + DOMPurify

**Files:**
- Modify: `frontend/package.json` (via npm install)

**Step 1: Install packages**

```bash
cd frontend && npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link dompurify @types/dompurify
```

**Step 2: Verify import resolves**

```bash
cd frontend && node -e "require('@tiptap/react'); console.log('TipTap OK');"
```
Expected: `TipTap OK`

**Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: install TipTap and DOMPurify for rich text editor"
```

---

### Task 11: Add `canManageAnnouncements` permission to roles.ts

**Files:**
- Modify: `frontend/src/utils/roles.ts`

**Step 1: Add the field to the `RolePermissions` interface**

In the `// Outreach & Relations` section of the interface (around line 47), add after `canGenerateOutreachReports`:

```ts
canManageAnnouncements: boolean; // Create/edit/cancel public announcements
```

**Step 2: Set the value for each role**

In every role's `ROLE_PERMISSIONS` entry, add `canManageAnnouncements` in the `// Outreach & Relations` block:
- `admin`: `true`
- `relationship`: `true`
- All other roles (`treasurer`, `bookkeeper`, `budget_committee`, `auditor`, `ar_team`, `ap_team`, `church_leadership`, `secretary`, `member`, `guest`): `false`

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/utils/roles.ts
git commit -m "feat: add canManageAnnouncements permission to roles"
```

---

### Task 12: Add i18n keys for announcements

**Files:**
- Modify: `frontend/src/i18n/dictionaries.ts`

**Step 1: Add type definitions to the `Dictionaries` interface**

In the `outreachDashboard` type block (around line 537), add a new nested `tabs` entry for announcements and new top-level keys. Change `tabs` from:

```ts
tabs: {
  pending: string;
  welcomed: string;
};
```

To:

```ts
tabs: {
  pending: string;
  welcomed: string;
  announcements: string;
};
```

Also add inside the `outreachDashboard` type, after `welcomedSuccess`:

```ts
announcements: {
  tabTitle: string;
  addButton: string;
  editButton: string;
  cancelButton: string;
  statusActive: string;
  statusExpired: string;
  statusCancelled: string;
  filterAll: string;
  titleLabel: string;
  descriptionLabel: string;
  startDateLabel: string;
  endDateLabel: string;
  modalCreateTitle: string;
  modalEditTitle: string;
  saveButton: string;
  confirmCancel: string;
  noAnnouncements: string;
  columns: {
    title: string;
    dates: string;
    status: string;
    actions: string;
  };
};
tvSettings: {
  gearLabel: string;
  intervalLabel: string;
  saveLabel: string;
};
```

**Step 2: Add English values**

In the `en` dictionary object, inside `outreachDashboard`, add the `tabs.announcements` key and the new `announcements` and `tvSettings` blocks:

```ts
tabs: {
  pending: "Pending Welcomes",
  welcomed: "Already Welcomed",
  announcements: "Public Announcements"
},
// ... existing keys ...
announcements: {
  tabTitle: "Public Announcements",
  addButton: "Add Announcement",
  editButton: "Edit",
  cancelButton: "Cancel Announcement",
  statusActive: "Active",
  statusExpired: "Expired",
  statusCancelled: "Cancelled",
  filterAll: "All",
  titleLabel: "Title",
  descriptionLabel: "Description",
  startDateLabel: "Start Date",
  endDateLabel: "End Date",
  modalCreateTitle: "New Announcement",
  modalEditTitle: "Edit Announcement",
  saveButton: "Save",
  confirmCancel: "Cancel this announcement? This cannot be undone.",
  noAnnouncements: "No announcements found.",
  columns: {
    title: "Title",
    dates: "Date Range",
    status: "Status",
    actions: "Actions"
  }
},
tvSettings: {
  gearLabel: "TV Settings",
  intervalLabel: "Rotate every (seconds)",
  saveLabel: "Save"
}
```

**Step 3: Add Tigrinya values**

In the `ti` dictionary, inside `outreachDashboard`, mirror the same keys with Tigrinya translations (use English as placeholder if unsure — translator can update later):

```ts
tabs: {
  pending: "ዘይተቐበሉ",
  welcomed: "ዝተቐበሉ",
  announcements: "ሓበሬታታት"
},
announcements: {
  tabTitle: "ሓበሬታታት",
  addButton: "ሓበሬታ ወሰኽ",
  editButton: "ኣርም",
  cancelButton: "ሰርዝ",
  statusActive: "ንጡፍ",
  statusExpired: "ገደፍ",
  statusCancelled: "ተሰሪዙ",
  filterAll: "ኹሉ",
  titleLabel: "ኣርእስቲ",
  descriptionLabel: "መግለጺ",
  startDateLabel: "ዕለት ምጅማር",
  endDateLabel: "ዕለት ምዝዛም",
  modalCreateTitle: "ሓድሽ ሓበሬታ",
  modalEditTitle: "ሓበሬታ ኣርም",
  saveButton: "ዕቀብ",
  confirmCancel: "ሓበሬታ ክትሰርዞ? እዚ ክምለስ ኣይክእልን።",
  noAnnouncements: "ሓበሬታ ኣይተረኸበን።",
  columns: {
    title: "ኣርእስቲ",
    dates: "ዕለታት",
    status: "ኩነታት",
    actions: "ተግባር"
  }
},
tvSettings: {
  gearLabel: "ቴለቪዥን መቆጻጸሪ",
  intervalLabel: "ዙረት ኣብ (ካልኢታት)",
  saveLabel: "ዕቀብ"
}
```

**Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 5: Commit**

```bash
git add frontend/src/i18n/dictionaries.ts
git commit -m "feat: add i18n keys for announcements and TV settings"
```

---

### Task 13: Create AnnouncementFormModal.tsx

**Files:**
- Create: `frontend/src/components/admin/AnnouncementFormModal.tsx`

**Step 1: Create the component**

```tsx
import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useI18n } from '../../i18n/I18nProvider';

export interface AnnouncementFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
}

interface Props {
  initial?: AnnouncementFormData & { id?: string };
  busy: boolean;
  error: string | null;
  onSave: (data: AnnouncementFormData) => void;
  onClose: () => void;
}

const AnnouncementFormModal: React.FC<Props> = ({ initial, busy, error, onSave, onClose }) => {
  const { t } = useI18n();
  const od = t('outreachDashboard');
  const [title, setTitle] = useState(initial?.title || '');
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: initial?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    onSave({ title: title.trim(), description: editor?.getHTML() || '', start_date: startDate, end_date: endDate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          {initial?.id ? od.announcements.modalEditTitle : od.announcements.modalCreateTitle}
        </h2>
        {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.titleLabel}</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.startDateLabel}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.endDateLabel}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{od.announcements.descriptionLabel}</label>
            {/* TipTap toolbar */}
            <div className="border rounded-t flex gap-1 px-2 py-1 bg-gray-50">
              {[
                { label: 'B', action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                { label: 'I', action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
                { label: '• List', action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
                { label: '1. List', action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
              ].map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.action}
                  className={`px-2 py-0.5 text-xs rounded ${btn.active ? 'bg-primary-200 font-bold' : 'hover:bg-gray-200'}`}
                >{btn.label}</button>
              ))}
            </div>
            <EditorContent
              editor={editor}
              className="border border-t-0 rounded-b min-h-[120px] px-3 py-2 text-sm prose max-w-none focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border hover:bg-gray-50">
              {od.addWelcomeNote.cancel}
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-400">
              {busy ? od.addWelcomeNote.saving : od.announcements.saveButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AnnouncementFormModal;
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 3: Commit**

```bash
git add frontend/src/components/admin/AnnouncementFormModal.tsx
git commit -m "feat: add AnnouncementFormModal with TipTap rich text editor"
```

---

### Task 14: Create AnnouncementsPanel.tsx

**Files:**
- Create: `frontend/src/components/admin/AnnouncementsPanel.tsx`

**Step 1: Create the component**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import AnnouncementFormModal, { AnnouncementFormData } from './AnnouncementFormModal';

interface Announcement {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'cancelled';
}

type FilterStatus = 'active' | 'expired' | 'cancelled' | 'all';

interface Props {
  canManage: boolean;
  getIdToken: () => Promise<string>;
}

const AnnouncementsPanel: React.FC<Props> = ({ canManage, getIdToken }) => {
  const { t } = useI18n();
  const od = t('outreachDashboard');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('active');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/announcements?status=${filter}`, {
        headers: { Authorization: `Bearer ${token}` }, credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setAnnouncements(data.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter, getIdToken]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: AnnouncementFormData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const token = await getIdToken();
      const url = editTarget
        ? `${process.env.REACT_APP_API_URL}/api/announcements/${editTarget.id}`
        : `${process.env.REACT_APP_API_URL}/api/announcements`;
      const method = editTarget ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include', body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save');
      setModalOpen(false);
      setEditTarget(null);
      load();
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm(od.announcements.confirmCancel)) return;
    try {
      const token = await getIdToken();
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/announcements/${id}/cancel`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to cancel');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const statusBadge = (a: Announcement) => {
    const today = new Date().toISOString().split('T')[0];
    if (a.status === 'cancelled') return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{od.announcements.statusCancelled}</span>;
    if (a.end_date < today) return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">{od.announcements.statusExpired}</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">{od.announcements.statusActive}</span>;
  };

  const filters: { label: string; value: FilterStatus }[] = [
    { label: od.announcements.statusActive, value: 'active' },
    { label: od.announcements.statusExpired, value: 'expired' },
    { label: od.announcements.statusCancelled, value: 'cancelled' },
    { label: od.announcements.filterAll, value: 'all' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-sm ${filter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {canManage && (
          <button onClick={() => { setEditTarget(null); setModalOpen(true); }}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 flex items-center gap-2">
            <i className="fas fa-plus"></i> {od.announcements.addButton}
          </button>
        )}
      </div>

      {loading && <div className="text-sm text-gray-500">{t('common.loading')}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && announcements.length === 0 && (
        <div className="text-sm text-gray-500">{od.announcements.noAnnouncements}</div>
      )}

      {!loading && announcements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[od.announcements.columns.title, od.announcements.columns.dates, od.announcements.columns.status, od.announcements.columns.actions].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {announcements.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">{a.title}</td>
                  <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">{a.start_date} – {a.end_date}</td>
                  <td className="px-4 py-2">{statusBadge(a)}</td>
                  <td className="px-4 py-2 text-sm whitespace-nowrap">
                    {canManage && a.status !== 'cancelled' && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditTarget(a); setModalOpen(true); }}
                          className="text-primary-600 hover:underline">{od.announcements.editButton}</button>
                        <button onClick={() => handleCancel(a.id)}
                          className="text-red-600 hover:underline">{od.announcements.cancelButton}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AnnouncementFormModal
          initial={editTarget ? { ...editTarget } : undefined}
          busy={saving}
          error={saveError}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
};

export default AnnouncementsPanel;
```

**Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 3: Commit**

```bash
git add frontend/src/components/admin/AnnouncementsPanel.tsx
git commit -m "feat: add AnnouncementsPanel component"
```

---

### Task 15: Create ChurchTvView.tsx

**Files:**
- Create: `frontend/src/components/admin/ChurchTvView.tsx`

**Step 1: Install DOMPurify if not already present (check package.json)**

Already done in Task 10.

**Step 2: Create the component**

```tsx
import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useI18n } from '../../i18n/I18nProvider';
import { useLanguage } from '../../contexts/LanguageContext';
import { englishNameToTigrinya } from '../../utils/nameTransliteration';

interface Announcement { id: string; title: string; description: string; start_date: string; end_date: string; }
interface Member { id: number | string; firstName: string; middleName?: string; lastName: string; familySize?: number; }

interface Props {
  pendingWelcomes: Member[];
  announcements: Announcement[];
  rotationIntervalSeconds: number;
  onIntervalChange: (seconds: number) => void;
}

type Slide = 'announcements' | 'welcomes';

const ChurchTvView: React.FC<Props> = ({ pendingWelcomes, announcements, rotationIntervalSeconds, onIntervalChange }) => {
  const { t } = useI18n();
  const { language } = useLanguage();
  const od = t('outreachDashboard');

  const hasAnnouncements = announcements.length > 0;
  const hasWelcomes = pendingWelcomes.length > 0;

  const initialSlide: Slide = hasAnnouncements ? 'announcements' : 'welcomes';
  const [currentSlide, setCurrentSlide] = useState<Slide>(initialSlide);
  const [announcementIdx, setAnnouncementIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [intervalInput, setIntervalInput] = useState(String(rotationIntervalSeconds));

  // Reset announcement index when list changes
  useEffect(() => { setAnnouncementIdx(0); }, [announcements]);

  // Main rotation: switch between announcements slide and welcomes slide
  useEffect(() => {
    if (!hasAnnouncements || !hasWelcomes) return; // nothing to rotate
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentSlide(prev => prev === 'announcements' ? 'welcomes' : 'announcements');
        setVisible(true);
      }, 500);
    }, rotationIntervalSeconds * 1000);
    return () => clearInterval(id);
  }, [rotationIntervalSeconds, hasAnnouncements, hasWelcomes]);

  // Within-slide rotation for multiple announcements
  useEffect(() => {
    if (!hasAnnouncements || announcements.length < 2) return;
    const perAnnouncement = Math.max(5, Math.floor(rotationIntervalSeconds / announcements.length));
    const id = setInterval(() => {
      setAnnouncementIdx(prev => (prev + 1) % announcements.length);
    }, perAnnouncement * 1000);
    return () => clearInterval(id);
  }, [announcements, rotationIntervalSeconds, hasAnnouncements]);

  const handleIntervalSave = () => {
    const v = parseInt(intervalInput, 10);
    if (v >= 5 && v <= 300) { onIntervalChange(v); setSettingsOpen(false); }
  };

  const currentAnnouncement = announcements[announcementIdx];

  const renderAnnouncementsSlide = () => (
    <div className="flex flex-col items-center justify-center h-full px-12 text-center">
      <div className="text-primary-500 text-lg font-medium mb-4 uppercase tracking-widest">
        {od.announcements.tabTitle}
      </div>
      <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">{currentAnnouncement?.title}</h2>
      {currentAnnouncement?.description && (
        <div
          className="text-2xl text-gray-700 max-w-3xl prose prose-2xl mx-auto"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentAnnouncement.description) }}
        />
      )}
      {currentAnnouncement && (
        <p className="mt-8 text-lg text-gray-400">
          {currentAnnouncement.start_date} – {currentAnnouncement.end_date}
        </p>
      )}
      {announcements.length > 1 && (
        <div className="flex gap-2 mt-6">
          {announcements.map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${i === announcementIdx ? 'bg-primary-600' : 'bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  );

  const renderWelcomesSlide = () => (
    <>
      <div className="text-center mb-6">
        <h2 className="text-4xl font-bold text-primary-800 mb-2">{od.welcomeTitle}</h2>
        <p className="text-xl text-gray-600">{od.welcomeSubtitle}</p>
      </div>
      <div className="flex-1 w-full mx-auto max-w-5xl relative overflow-hidden flex flex-col justify-center items-center bg-gray-50/50 rounded-lg border border-gray-100">
        {pendingWelcomes.length === 0 ? (
          <div className="text-xl text-gray-500">{od.noNewMembers}</div>
        ) : (
          <>
            <style>{`
              @keyframes scroll-up { 0% { top: 100%; } 100% { top: 0; transform: translateY(-100%); } }
              .animate-scroll-up { position: absolute; width: 100%; animation: scroll-up ${Math.max(20, pendingWelcomes.length * 4)}s linear infinite; }
              .animate-scroll-up:hover { animation-play-state: paused; }
            `}</style>
            <div className="animate-scroll-up flex flex-col gap-6 w-full px-4 pt-10 pb-10">
              {pendingWelcomes.map(m => {
                const familySize = m.familySize || 1;
                const nameRaw = `${m.firstName} ${m.middleName ? m.middleName + ' ' : ''}${m.lastName}`;
                const nameDisplay = language === 'ti' ? englishNameToTigrinya(nameRaw) : nameRaw;
                const display = familySize > 1 ? `${nameDisplay} ${od.andFamily} (${familySize})` : nameDisplay;
                return (
                  <div key={m.id} className="bg-white rounded-lg p-6 border-l-4 border-primary-600 flex items-center justify-center text-center shadow-sm w-full mx-auto max-w-3xl">
                    <span className="text-3xl font-medium text-gray-900">{display}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="mt-8 pt-6 border-t border-gray-200 text-center z-10 bg-white">
        <p className="text-2xl font-semibold text-primary-900">{od.tvFooterMessage}</p>
      </div>
    </>
  );

  const renderEmpty = () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-2xl text-gray-400">{od.noNewMembers}</p>
    </div>
  );

  return (
    <div className="bg-white shadow-sm rounded-xl p-8 border flex flex-col h-[75vh] relative">
      {/* Settings gear */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={() => setSettingsOpen(o => !o)} className="p-2 rounded-full hover:bg-gray-100" title={od.tvSettings.gearLabel}>
          <i className="fas fa-cog text-gray-500"></i>
        </button>
        {settingsOpen && (
          <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg p-4 w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">{od.tvSettings.intervalLabel}</label>
            <div className="flex gap-2">
              <input type="number" min={5} max={300} value={intervalInput}
                onChange={e => setIntervalInput(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm"
              />
              <button onClick={handleIntervalSave} className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700">
                {od.tvSettings.saveLabel}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide content */}
      <div className={`flex-1 flex flex-col transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        {!hasAnnouncements && !hasWelcomes
          ? renderEmpty()
          : currentSlide === 'announcements' && hasAnnouncements
            ? renderAnnouncementsSlide()
            : hasWelcomes
              ? renderWelcomesSlide()
              : renderAnnouncementsSlide()
        }
      </div>
    </div>
  );
};

export default ChurchTvView;
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

**Step 4: Commit**

```bash
git add frontend/src/components/admin/ChurchTvView.tsx
git commit -m "feat: add ChurchTvView component with full-screen rotation"
```

---

### Task 16: Update OutreachDashboard.tsx

**Files:**
- Modify: `frontend/src/components/admin/OutreachDashboard.tsx`

**Step 1: Add imports at the top**

After the existing imports, add:
```tsx
import AnnouncementsPanel from './AnnouncementsPanel';
import ChurchTvView from './ChurchTvView';
```

**Step 2: Add new state variables**

After `const [isTvView, setIsTvView] = useState(false);`, add:
```tsx
const [activeTab, setActiveTab] = useState<'pending' | 'welcomed' | 'announcements'>('pending');
const [tvInterval, setTvInterval] = useState(30);
const [announcements, setAnnouncements] = useState<any[]>([]);
```

Note: remove the existing `const [activeTab, ...` declaration (it's already there with only 'pending'/'welcomed').

**Step 3: Load TV interval and active announcements on mount**

Add a new `useEffect` after the existing data-fetching effects:

```tsx
useEffect(() => {
  if (!firebaseUser) return;
  const loadTvData = async () => {
    try {
      const idToken = await firebaseUser.getIdToken(true);
      const headers = { Authorization: `Bearer ${idToken}` };
      const [intervalRes, announcementsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/settings/tv-rotation-interval`, { headers, credentials: 'include' }),
        fetch(`${process.env.REACT_APP_API_URL}/api/announcements/active`, { headers, credentials: 'include' })
      ]);
      if (intervalRes.ok) {
        const d = await intervalRes.json();
        setTvInterval(d?.data?.seconds || 30);
      }
      if (announcementsRes.ok) {
        const d = await announcementsRes.json();
        setAnnouncements(d?.data || []);
      }
    } catch (e) {
      console.error('Failed to load TV data:', e);
    }
  };
  loadTvData();
}, [firebaseUser]);
```

**Step 4: Add `handleIntervalChange` helper**

After the `loadWelcomedMembers` function, add:

```tsx
const handleIntervalChange = async (seconds: number) => {
  if (!firebaseUser) return;
  try {
    const idToken = await firebaseUser.getIdToken(true);
    await fetch(`${process.env.REACT_APP_API_URL}/api/settings/tv-rotation-interval`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      credentials: 'include',
      body: JSON.stringify({ seconds })
    });
    setTvInterval(seconds);
  } catch (e) {
    console.error('Failed to save interval:', e);
  }
};
```

**Step 5: Replace the inline TV view JSX with `<ChurchTvView />`**

Replace the entire `{isTvView ? ( /* TV View Layout */ ... ) : ( /* Standard View */ )}` section as follows:

In the `isTvView` branch, replace the existing large TV JSX block with:
```tsx
<ChurchTvView
  pendingWelcomes={pending}
  announcements={announcements}
  rotationIntervalSeconds={tvInterval}
  onIntervalChange={handleIntervalChange}
/>
```

**Step 6: Add the Announcements tab to the tab nav**

In the tab `<nav>` (currently has "Pending Welcomes" and "Already Welcomed"), add a third tab button:

```tsx
<button
  onClick={() => setActiveTab('announcements')}
  className={`whitespace-nowrap flex py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'announcements' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
>
  <i className="fas fa-bullhorn mr-2 self-center"></i>
  {t('outreachDashboard').tabs.announcements}
</button>
```

**Step 7: Add the Announcements tab content panel**

Inside the `<div className="p-4">` section, after the `{activeTab === 'welcomed' && ...}` block, add:

```tsx
{activeTab === 'announcements' && (
  <AnnouncementsPanel
    canManage={permissions.canManageAnnouncements}
    getIdToken={() => firebaseUser!.getIdToken(true)}
  />
)}
```

**Step 8: Verify TypeScript compiles and no regressions**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors

**Step 9: Commit**

```bash
git add frontend/src/components/admin/OutreachDashboard.tsx
git commit -m "feat: integrate announcements tab and ChurchTvView into OutreachDashboard"
```

---

### Task 17: Run all tests and verify

**Step 1: Run backend tests**

```bash
cd backend && npm test
```
Expected: all test suites pass (including new announcements tests)

**Step 2: Run frontend TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors

**Step 3: Commit if any final fixes were needed**

```bash
git add -A && git commit -m "fix: address any final TypeScript or test issues"
```

---

## PHASE 3 — Java Backend (java branch)

### Task 18: Switch to java branch and create entities

```bash
git checkout java
```

**Files:**
- Create: `backendJava/src/main/java/church/abunearegawi/backend/model/Announcement.java`
- Create: `backendJava/src/main/java/church/abunearegawi/backend/model/ChurchSetting.java`

**Step 1: Create Announcement entity**

```java
package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "announcements")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Announcement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.ACTIVE;

    @Column(name = "created_by_member_id")
    private Long createdByMemberId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum Status { ACTIVE, CANCELLED }
}
```

**Step 2: Create ChurchSetting entity**

```java
package church.abunearegawi.backend.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "church_settings")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ChurchSetting {

    @Id
    @Column(length = 100)
    private String key;

    @Column(columnDefinition = "TEXT")
    private String value;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
```

**Step 3: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/model/Announcement.java
git add backendJava/src/main/java/church/abunearegawi/backend/model/ChurchSetting.java
git commit -m "feat: add Announcement and ChurchSetting JPA entities"
```

---

### Task 19: Add database migration for Java branch

**Files:**
- Create: `backendJava/src/main/resources/db/migration/V2__create_announcements_and_settings.sql`

Check if Flyway is already configured in `application.yml`. If not, this migration is run manually or via `spring.jpa.hibernate.ddl-auto=update`.

> **Note:** Check `backendJava/src/main/resources/application.yml` for `spring.flyway` or `spring.jpa.hibernate.ddl-auto`. If `ddl-auto=create` or `update` is set, Hibernate will auto-create the tables from the entities and no SQL file is needed. If Flyway is used, create the SQL file below.

If Flyway is used, create:

```sql
CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by_member_id BIGINT REFERENCES members(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS announcements_tv_filter_idx ON announcements(status, start_date, end_date);

CREATE TABLE IF NOT EXISTS church_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO church_settings(key, value, updated_at) VALUES ('tv_rotation_interval_seconds', '30', NOW())
ON CONFLICT (key) DO NOTHING;
```

**Step: Commit**

```bash
git add backendJava/src/main/resources/
git commit -m "feat: add SQL migration for announcements and church_settings tables"
```

---

### Task 20: Create repositories and DTOs

**Files:**
- Create: `backendJava/src/main/java/church/abunearegawi/backend/repository/AnnouncementRepository.java`
- Create: `backendJava/src/main/java/church/abunearegawi/backend/repository/ChurchSettingRepository.java`
- Create: `backendJava/src/main/java/church/abunearegawi/backend/dto/AnnouncementDTO.java`

**Step 1: AnnouncementRepository**

```java
package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.Announcement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface AnnouncementRepository extends JpaRepository<Announcement, Long> {

    List<Announcement> findAllByOrderByStartDateDesc();

    List<Announcement> findByStatusOrderByStartDateDesc(Announcement.Status status);

    @Query("SELECT a FROM Announcement a WHERE a.status = 'ACTIVE' AND a.startDate <= :today AND a.endDate >= :today ORDER BY a.startDate DESC")
    List<Announcement> findActiveTodayOrderByStartDateDesc(LocalDate today);

    @Query("SELECT a FROM Announcement a WHERE a.status = 'ACTIVE' AND a.endDate < :today ORDER BY a.startDate DESC")
    List<Announcement> findExpiredOrderByStartDateDesc(LocalDate today);
}
```

**Step 2: ChurchSettingRepository**

```java
package church.abunearegawi.backend.repository;

import church.abunearegawi.backend.model.ChurchSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChurchSettingRepository extends JpaRepository<ChurchSetting, String> {}
```

**Step 3: AnnouncementDTO**

```java
package church.abunearegawi.backend.dto;

import church.abunearegawi.backend.model.Announcement;
import lombok.Builder;
import lombok.Getter;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Builder
public class AnnouncementDTO {
    private Long id;
    private String title;
    private String description;
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private Long createdByMemberId;
    private LocalDateTime createdAt;

    public static AnnouncementDTO from(Announcement a) {
        return AnnouncementDTO.builder()
            .id(a.getId()).title(a.getTitle()).description(a.getDescription())
            .startDate(a.getStartDate()).endDate(a.getEndDate())
            .status(a.getStatus().name().toLowerCase())
            .createdByMemberId(a.getCreatedByMemberId()).createdAt(a.getCreatedAt())
            .build();
    }
}
```

**Step 4: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/repository/AnnouncementRepository.java
git add backendJava/src/main/java/church/abunearegawi/backend/repository/ChurchSettingRepository.java
git add backendJava/src/main/java/church/abunearegawi/backend/dto/AnnouncementDTO.java
git commit -m "feat: add announcement and church setting repositories and DTO"
```

---

### Task 21: Create AnnouncementService and ChurchSettingService

**Files:**
- Create: `backendJava/src/main/java/church/abunearegawi/backend/service/AnnouncementService.java`
- Create: `backendJava/src/main/java/church/abunearegawi/backend/service/ChurchSettingService.java`

**Step 1: AnnouncementService**

```java
package church.abunearegawi.backend.service;

import church.abunearegawi.backend.dto.AnnouncementDTO;
import church.abunearegawi.backend.model.Announcement;
import church.abunearegawi.backend.repository.AnnouncementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private final AnnouncementRepository announcementRepository;

    public List<AnnouncementDTO> list(String status) {
        LocalDate today = LocalDate.now();
        List<Announcement> results = switch (status == null ? "all" : status) {
            case "active" -> announcementRepository.findActiveTodayOrderByStartDateDesc(today);
            case "cancelled" -> announcementRepository.findByStatusOrderByStartDateDesc(Announcement.Status.CANCELLED);
            case "expired" -> announcementRepository.findExpiredOrderByStartDateDesc(today);
            default -> announcementRepository.findAllByOrderByStartDateDesc();
        };
        return results.stream().map(AnnouncementDTO::from).collect(Collectors.toList());
    }

    public List<AnnouncementDTO> getActive() {
        return announcementRepository.findActiveTodayOrderByStartDateDesc(LocalDate.now())
            .stream().map(AnnouncementDTO::from).collect(Collectors.toList());
    }

    @Transactional
    public AnnouncementDTO create(String title, String description, LocalDate startDate, LocalDate endDate, Long createdByMemberId) {
        Announcement a = Announcement.builder()
            .title(title).description(description)
            .startDate(startDate).endDate(endDate)
            .createdByMemberId(createdByMemberId)
            .build();
        return AnnouncementDTO.from(announcementRepository.save(a));
    }

    @Transactional
    public AnnouncementDTO update(Long id, String title, String description, LocalDate startDate, LocalDate endDate) {
        Announcement a = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found: " + id));
        a.setTitle(title);
        a.setDescription(description);
        a.setStartDate(startDate);
        a.setEndDate(endDate);
        return AnnouncementDTO.from(announcementRepository.save(a));
    }

    @Transactional
    public AnnouncementDTO cancel(Long id) {
        Announcement a = announcementRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Announcement not found: " + id));
        a.setStatus(Announcement.Status.CANCELLED);
        return AnnouncementDTO.from(announcementRepository.save(a));
    }
}
```

**Step 2: ChurchSettingService**

```java
package church.abunearegawi.backend.service;

import church.abunearegawi.backend.model.ChurchSetting;
import church.abunearegawi.backend.repository.ChurchSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChurchSettingService {

    private final ChurchSettingRepository churchSettingRepository;
    private static final String TV_INTERVAL_KEY = "tv_rotation_interval_seconds";

    public int getTvRotationInterval() {
        return churchSettingRepository.findById(TV_INTERVAL_KEY)
            .map(s -> Integer.parseInt(s.getValue()))
            .orElse(30);
    }

    @Transactional
    public int setTvRotationInterval(int seconds) {
        if (seconds < 5 || seconds > 300) throw new IllegalArgumentException("seconds must be 5-300");
        ChurchSetting setting = churchSettingRepository.findById(TV_INTERVAL_KEY)
            .orElse(ChurchSetting.builder().key(TV_INTERVAL_KEY).build());
        setting.setValue(String.valueOf(seconds));
        churchSettingRepository.save(setting);
        return seconds;
    }
}
```

**Step 3: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/service/AnnouncementService.java
git add backendJava/src/main/java/church/abunearegawi/backend/service/ChurchSettingService.java
git commit -m "feat: add AnnouncementService and ChurchSettingService"
```

---

### Task 22: Create controllers

**Files:**
- Create: `backendJava/src/main/java/church/abunearegawi/backend/controller/AnnouncementController.java`
- Create: `backendJava/src/main/java/church/abunearegawi/backend/controller/ChurchSettingController.java`

**Step 1: AnnouncementController**

```java
package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.AnnouncementDTO;
import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    @GetMapping("/active")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<AnnouncementDTO>>> getActive() {
        return ResponseEntity.ok(ApiResponse.success(announcementService.getActive()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<List<AnnouncementDTO>>> list(@RequestParam(required = false) String status) {
        return ResponseEntity.ok(ApiResponse.success(announcementService.list(status)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<AnnouncementDTO>> create(@RequestBody Map<String, String> body) {
        AnnouncementDTO dto = announcementService.create(
            body.get("title"), body.get("description"),
            LocalDate.parse(body.get("start_date")), LocalDate.parse(body.get("end_date")),
            null
        );
        return ResponseEntity.status(201).body(ApiResponse.success(dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<AnnouncementDTO>> update(@PathVariable Long id, @RequestBody Map<String, String> body) {
        AnnouncementDTO dto = announcementService.update(
            id, body.get("title"), body.get("description"),
            LocalDate.parse(body.get("start_date")), LocalDate.parse(body.get("end_date"))
        );
        return ResponseEntity.ok(ApiResponse.success(dto));
    }

    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<AnnouncementDTO>> cancel(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(announcementService.cancel(id)));
    }
}
```

**Step 2: ChurchSettingController**

```java
package church.abunearegawi.backend.controller;

import church.abunearegawi.backend.dto.ApiResponse;
import church.abunearegawi.backend.service.ChurchSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class ChurchSettingController {

    private final ChurchSettingService churchSettingService;

    @GetMapping("/tv-rotation-interval")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> get() {
        int seconds = churchSettingService.getTvRotationInterval();
        return ResponseEntity.ok(ApiResponse.success(Map.of("seconds", seconds)));
    }

    @PutMapping("/tv-rotation-interval")
    @PreAuthorize("hasAnyRole('ADMIN', 'RELATIONSHIP')")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> set(@RequestBody Map<String, Integer> body) {
        int seconds = churchSettingService.setTvRotationInterval(body.get("seconds"));
        return ResponseEntity.ok(ApiResponse.success(Map.of("seconds", seconds)));
    }
}
```

**Step 3: Commit**

```bash
git add backendJava/src/main/java/church/abunearegawi/backend/controller/AnnouncementController.java
git add backendJava/src/main/java/church/abunearegawi/backend/controller/ChurchSettingController.java
git commit -m "feat: add AnnouncementController and ChurchSettingController"
```

---

### Task 23: Update SecurityConfig for new routes

**Files:**
- Modify: `backendJava/src/main/java/church/abunearegawi/backend/config/SecurityConfig.java`

**Step 1: Add `/api/announcements/active` to the public-authenticated permit list**

In `SecurityConfig.java`, in the `authorizeHttpRequests` block, the `/api/announcements/active` endpoint only needs `isAuthenticated()` (already handled by `@PreAuthorize`). No change to `SecurityConfig` is needed if `/api/**` is already gated by `.authenticated()`.

Verify this is the case by checking the existing `.requestMatchers("/api/**").authenticated()` line. If it is present, no changes are needed.

**Step 2: Build the Java backend**

```bash
cd backendJava && ./gradlew build
```
Expected: `BUILD SUCCESSFUL`

**Step 3: Commit**

```bash
git add backendJava/
git commit -m "feat: complete Java backend implementation for announcements and church settings"
```

---

### Task 24: Push both branches

**Step 1: Push main branch**

```bash
git checkout main && git push origin main
```

**Step 2: Push java branch**

```bash
git checkout java && git push origin java
```

---

## Summary of Files Changed

### main branch
| File | Action |
|---|---|
| `backend/migrations/20260227000001-create-announcements.js` | Create |
| `backend/migrations/20260227000002-create-church-settings.js` | Create |
| `backend/src/models/Announcement.js` | Create |
| `backend/src/models/ChurchSetting.js` | Create |
| `backend/src/controllers/announcementController.js` | Create |
| `backend/src/controllers/churchSettingController.js` | Create |
| `backend/src/routes/announcementRoutes.js` | Create |
| `backend/src/routes/settingRoutes.js` | Create |
| `backend/src/server.js` | Modify |
| `backend/tests/integration/announcements.test.js` | Create |
| `frontend/package.json` | Modify |
| `frontend/src/utils/roles.ts` | Modify |
| `frontend/src/i18n/dictionaries.ts` | Modify |
| `frontend/src/components/admin/AnnouncementFormModal.tsx` | Create |
| `frontend/src/components/admin/AnnouncementsPanel.tsx` | Create |
| `frontend/src/components/admin/ChurchTvView.tsx` | Create |
| `frontend/src/components/admin/OutreachDashboard.tsx` | Modify |

### java branch
| File | Action |
|---|---|
| `backendJava/src/main/java/.../model/Announcement.java` | Create |
| `backendJava/src/main/java/.../model/ChurchSetting.java` | Create |
| `backendJava/src/main/java/.../repository/AnnouncementRepository.java` | Create |
| `backendJava/src/main/java/.../repository/ChurchSettingRepository.java` | Create |
| `backendJava/src/main/java/.../dto/AnnouncementDTO.java` | Create |
| `backendJava/src/main/java/.../service/AnnouncementService.java` | Create |
| `backendJava/src/main/java/.../service/ChurchSettingService.java` | Create |
| `backendJava/src/main/java/.../controller/AnnouncementController.java` | Create |
| `backendJava/src/main/java/.../controller/ChurchSettingController.java` | Create |
