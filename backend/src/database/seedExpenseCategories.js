const { ExpenseCategory } = require('../models');

const FIXED_EXPENSE_CATEGORIES = [
  {
    gl_code: 'EXP001',
    name: 'Salary/Allowance',
    description: 'Monthly staff salaries and allowances',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP002',
    name: 'Mortgage',
    description: 'Monthly mortgage payment',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP003',
    name: '1800 Loan Interest Payment',
    description: 'Interest payment on 1800 loan',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP004',
    name: 'Monthly FDGL Lease PYMT ZOOM, T-MOBILE & TSYS',
    description: 'Fixed monthly lease payments for ZOOM, T-MOBILE, and TSYS services',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP005',
    name: 'Utility',
    description: 'Electricity, water, gas, and other utilities',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP006',
    name: 'Cable',
    description: 'Cable and internet services',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP007',
    name: 'Property Insurance',
    description: 'Property and liability insurance',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP008',
    name: 'Rent Expense',
    description: 'Rental expenses for facilities or equipment',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP009',
    name: 'Chase Credit Card Payment',
    description: 'Monthly credit card payment to Chase',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP100',
    name: '1800 Barnes Bridge Hagere Sebket Building Renovation',
    description: 'Building renovation expenses for 1800 Barnes Bridge Hagere Sebket facility',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP101',
    name: 'Alarm Security',
    description: 'Security alarm system installation, monitoring, and maintenance',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP102',
    name: 'Building Repairs & Maintenance',
    description: 'General building repairs and ongoing maintenance expenses',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP103',
    name: 'Catering, Relief Assistance & Charitable Expenses',
    description: 'Catering for fundraising and holiday events, relief assistance, and charitable expenses',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP104',
    name: 'Office & Kitchen Equipment and Supplies',
    description: 'Office equipment, kitchen equipment, and related supplies',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP105',
    name: 'Parts & Fixtures',
    description: 'Replacement parts and fixtures for building and equipment',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP106',
    name: 'Bible, Miscellaneous Items & Teaching Fees',
    description: 'Purchase of Bibles, miscellaneous church items, and teaching fees',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP107',
    name: 'Sebket Wengel Service',
    description: 'Sebket Wengel service-related expenses',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP108',
    name: 'Texas Secretary of State & City of Garland Tax',
    description: 'Texas Secretary of State fees and City of Garland tax payments',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP109',
    name: 'Transfer from Other Account & Loan Payment',
    description: 'Transfers from other accounts and loan payment expenses',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP110',
    name: 'Visiting Priests Allowance & Travel Expenses',
    description: 'Allowances and travel expenses for visiting priests',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP111',
    name: 'Marble Jones',
    description: 'Marble Jones related expenses',
    is_active: true,
    is_fixed: true
  },
  {
    gl_code: 'EXP999',
    name: 'Other Expenses',
    description: 'Miscellaneous expenses not covered by other categories (please add detail in memo)',
    is_active: true,
    is_fixed: true
  }
];

async function seedExpenseCategories() {
  try {
    console.log('🌱 Seeding expense categories...');

    for (const category of FIXED_EXPENSE_CATEGORIES) {
      const [expenseCategory, created] = await ExpenseCategory.findOrCreate({
        where: { gl_code: category.gl_code },
        defaults: category
      });

      if (created) {
        console.log(`✅ Created: ${category.gl_code} - ${category.name}`);
      } else {
        console.log(`ℹ️  Already exists: ${category.gl_code} - ${category.name}`);
      }
    }

    console.log('✅ Expense categories seeded successfully');
    console.log(`📊 Total categories: ${FIXED_EXPENSE_CATEGORIES.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seedExpenseCategories()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = seedExpenseCategories;
