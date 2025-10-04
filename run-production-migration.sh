#!/bin/bash

# Production Migration Script
# Run this to apply all migrations to production database

set -e  # Exit on error

echo "🚀 Production Migration Script"
echo "=============================="
echo ""

# Check if DATABASE_URL is set to production
if [[ ! $DATABASE_URL == *"supabase.com"* ]]; then
  echo "❌ ERROR: DATABASE_URL is not pointing to production!"
  echo "   Current: $DATABASE_URL"
  echo ""
  echo "   Please update backend/.env to point to production database"
  exit 1
fi

echo "✅ Production database detected"
echo ""

# Confirm with user
echo "⚠️  WARNING: This will modify the PRODUCTION database!"
echo "   Database: $DATABASE_URL"
echo ""
read -p "Have you created a backup? (yes/no): " backup_confirm

if [ "$backup_confirm" != "yes" ]; then
  echo "❌ Backup not confirmed. Please create a backup first:"
  echo "   pg_dump \"\$DATABASE_URL\" > prod_backup_\$(date +%Y%m%d_%H%M%S).sql"
  exit 1
fi

echo ""
read -p "Proceed with migration? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Migration cancelled"
  exit 0
fi

echo ""
echo "🔧 Starting migration..."
echo ""

# Migration 1: Income Categories
echo "📋 Step 1/5: Adding income category support..."
cd backend
npm run db:migrate:income || { echo "❌ Migration 1 failed"; exit 1; }
echo "✅ Step 1 complete"
echo ""

# Migration 2: Ledger Enum
echo "📋 Step 2/5: Adding ledger payment types..."
npm run db:migrate:ledger-types || { echo "❌ Migration 2 failed"; exit 1; }
echo "✅ Step 2 complete"
echo ""

# Migration 3: Expense Categories
echo "📋 Step 3/5: Creating expense categories..."
npm run db:migrate:expense || { echo "❌ Migration 3 failed"; exit 1; }
echo "✅ Step 3 complete"
echo ""

# Migration 4: Ledger Entry Transaction ID
echo "📋 Step 4/5: Updating ledger entry schema..."
node src/database/migrations/updateLedgerEntryTransactionId.js || { echo "❌ Migration 4 failed"; exit 1; }
echo "✅ Step 4 complete"
echo ""

# Migration 5: Ledger Entry Type Enum
echo "📋 Step 5/5: Updating ledger entry types..."
node src/database/migrations/updateLedgerEntryTypeEnum.js || { echo "❌ Migration 5 failed"; exit 1; }
echo "✅ Step 5 complete"
echo ""

echo "✅ All migrations completed successfully!"
echo ""

# Seed data
echo "🌱 Seeding data..."
echo ""

echo "📋 Seeding income categories..."
npm run db:seed:income || { echo "❌ Income seed failed"; exit 1; }
echo "✅ Income categories seeded (9 records)"
echo ""

echo "📋 Seeding expense categories..."
npm run db:seed:expense || { echo "❌ Expense seed failed"; exit 1; }
echo "✅ Expense categories seeded"
echo ""

echo "✅ All seeding completed successfully!"
echo ""

# Verification
echo "🔍 Verifying migration..."
echo ""

INCOME_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM income_categories;")
echo "   Income categories: $INCOME_COUNT (expected: 9)"

EXPENSE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM expense_categories;")
echo "   Expense categories: $EXPENSE_COUNT"

LEDGER_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='ledger_entries');")
echo "   Ledger entries table: $LEDGER_EXISTS"

COLUMN_EXISTS=$(psql "$DATABASE_URL" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='income_category_id');")
echo "   transactions.income_category_id: $COLUMN_EXISTS"

echo ""

if [ "$INCOME_COUNT" -eq 9 ] && [ "$LEDGER_EXISTS" == " t" ] && [ "$COLUMN_EXISTS" == " t" ]; then
  echo "✅ Migration verified successfully!"
else
  echo "⚠️  WARNING: Verification found issues. Please check manually."
fi

echo ""
echo "📝 Next Steps:"
echo "   1. Restart your backend server:"
echo "      pm2 restart backend"
echo ""
echo "   2. Test backend API:"
echo "      curl https://your-api.com/api/income-categories"
echo ""
echo "   3. Deploy frontend:"
echo "      cd frontend"
echo "      npm run build"
echo "      firebase deploy"
echo ""
echo "   4. Test frontend:"
echo "      - Open Treasurer Dashboard"
echo "      - Create a test transaction"
echo "      - Verify GL codes appear"
echo ""

echo "🎉 Migration complete!"
echo ""
echo "⚠️  Important: Check production logs for any errors"
