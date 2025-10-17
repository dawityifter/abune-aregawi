# Departments Table - Production Migration Guide

## 🔍 Why You Don't Have the Departments Table in Production

The **departments feature** was added recently (January 2025) with database migrations, but these migrations **haven't been run in your production environment yet**.

Your local development database has the tables because they were created when you synced your database, but production needs the migrations to be explicitly run.

---

## 📊 What Migrations Need to Run

### **Migration 1:** `20250108-create-departments.js`
**Creates:**
- `departments` table (main department info)
- `department_members` table (members in departments)
- All necessary indexes and constraints

### **Migration 2:** `20250109-add-department-to-sms-logs.js`
**Updates:**
- Adds `department_id` column to `sms_logs` table
- Updates `recipient_type` enum to include 'department'

---

## ⚠️ Current State

### **Local (Development) ✅**
- ✅ `departments` table exists
- ✅ `department_members` table exists
- ✅ SMS department functionality works

### **Production (Render/Supabase) ❌**
- ❌ `departments` table missing
- ❌ `department_members` table missing
- ❌ `/api/departments` endpoints will fail
- ❌ SMS department feature won't work

---

## 🚀 How to Fix (Run Migrations in Production)

### **Option 1: Using Sequelize Migrations (Recommended)**

I've created a migration runner script for you.

#### **Step 1: Run the Migration Script**

From your local machine, run:

```bash
cd backend
node src/database/runDepartmentMigrations.js
```

This will:
1. Connect to your production database (using `DATABASE_URL` from `.env`)
2. Check if tables already exist
3. Run both department migrations
4. Verify the tables were created

---

### **Option 2: Manual SQL (If Script Fails)**

If you prefer to run the SQL manually in Supabase:

#### **Step 1: Create Departments Table**

```sql
-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL DEFAULT 'ministry',
  parent_department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL ON UPDATE CASCADE,
  leader_id BIGINT REFERENCES members(id) ON DELETE SET NULL ON UPDATE CASCADE,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  meeting_schedule TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  max_members INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create department_members table
CREATE TABLE IF NOT EXISTS department_members (
  id BIGSERIAL PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE CASCADE ON UPDATE CASCADE,
  member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role_in_department VARCHAR(50) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_department_member UNIQUE (department_id, member_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_departments_type ON departments(type);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_leader_id ON departments(leader_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent_department_id ON departments(parent_department_id);

CREATE INDEX IF NOT EXISTS idx_department_members_department_id ON department_members(department_id);
CREATE INDEX IF NOT EXISTS idx_department_members_member_id ON department_members(member_id);
CREATE INDEX IF NOT EXISTS idx_department_members_status ON department_members(status);
```

#### **Step 2: Update SMS Logs Table**

```sql
-- Add department_id column to sms_logs
ALTER TABLE sms_logs ADD COLUMN IF NOT EXISTS department_id BIGINT;

-- Update recipient_type enum to include 'department'
ALTER TYPE enum_sms_logs_recipient_type ADD VALUE IF NOT EXISTS 'department';
```

---

## ✅ Verification

After running the migrations, verify they worked:

### **Check Tables Exist:**

```sql
-- Check if departments table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'departments'
);

-- Check if department_members table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'department_members'
);

-- Check department_id column in sms_logs
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sms_logs' 
AND column_name = 'department_id';
```

### **Test the API:**

After migration, test the departments endpoint:

```bash
curl https://your-backend-url.onrender.com/api/departments \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return:
```json
{
  "success": true,
  "data": {
    "departments": [],
    "pagination": {...}
  }
}
```

---

## 📝 Migration Script Location

**File:** `backend/src/database/runDepartmentMigrations.js`

**Usage:**
```bash
# Make sure you're in the backend directory
cd backend

# Run the migration
node src/database/runDepartmentMigrations.js
```

---

## 🔐 Environment Variables

Make sure your production `.env` has:

```env
DATABASE_URL=postgresql://user:pass@host:port/database
```

The migration script will use this to connect to production.

---

## ⚠️ Important Notes

1. **Backup First:** Always backup your production database before running migrations
2. **Test Locally:** These migrations should already work in your local environment
3. **Downtime:** These migrations should run quickly (< 1 second) with minimal downtime
4. **Idempotent:** The migrations use `IF NOT EXISTS` so they're safe to run multiple times
5. **Auto-Deploy:** After migration, your backend on Render will automatically have the departments feature

---

## 🎯 After Migration

Once the departments tables exist in production:

1. ✅ `/api/departments` endpoints will work
2. ✅ SMS department feature will work
3. ✅ You can create departments through the admin UI
4. ✅ The department preview in SMS will work

---

## 🆘 Troubleshooting

### **"Table already exists" Error**
- This is fine - the migration checks for existing tables
- Skip to verification step

### **"Permission denied" Error**
- Check your database user has CREATE TABLE permissions
- You may need to use the Supabase admin user

### **Connection Error**
- Verify `DATABASE_URL` is correct in your `.env`
- Check if database is accessible from your location

---

## 📞 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Verify database connection
3. Try the manual SQL option
4. Check Supabase logs

---

**Status:** Ready to run migrations in production
**Risk:** Low - migrations are idempotent and reversible
**Estimated Time:** < 1 minute

---

**Next Steps:**
1. Run the migration script (Option 1) or manual SQL (Option 2)
2. Verify tables exist
3. Test the departments API endpoint
4. Deploy your SMS features!
