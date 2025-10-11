const { IncomeCategory } = require('../models');

const INCOME_CATEGORIES = [
  {
    gl_code: 'INC001',
    name: 'Membership',
    description: 'Membership dues and fees',
    payment_type_mapping: 'membership_due',
    is_active: true,
    display_order: 1
  },
  {
    gl_code: 'INC002',
    name: 'Weekly Offering',
    description: 'Regular weekly offerings and tithes',
    payment_type_mapping: 'offering',
    is_active: true,
    display_order: 2
  },
  {
    gl_code: 'INC003',
    name: 'Fundraising',
    description: 'Fundraising events and activities',
    payment_type_mapping: 'event',
    is_active: true,
    display_order: 3
  },
  {
    gl_code: 'INC004',
    name: 'Special Donation',
    description: 'Special donations including holidays and one-time gifts',
    payment_type_mapping: 'donation',
    is_active: true,
    display_order: 4
  },
  {
    gl_code: 'INC005',
    name: 'Sacramental Services',
    description: 'Baptisms (Christening), Weddings, Funerals, Services & Fithat',
    payment_type_mapping: null,
    is_active: true,
    display_order: 5
  },
  {
    gl_code: 'INC006',
    name: 'Newayat Kedesat & Sebkete Wongel',
    description: 'Newayat Kedesat and Sebkete Wongel related income',
    payment_type_mapping: null,
    is_active: true,
    display_order: 6
  },
  {
    gl_code: 'INC007',
    name: 'Event Hall & Church Item Rental',
    description: 'Rental income from event hall and church items',
    payment_type_mapping: null,
    is_active: true,
    display_order: 7
  },
  {
    gl_code: 'INC008',
    name: 'Vow (Selet) & Tselot',
    description: 'Vows (Selet) and Tselot offerings',
    payment_type_mapping: 'vow',
    is_active: true,
    display_order: 8
  },
  {
    gl_code: 'INC999',
    name: 'Other Income',
    description: 'Miscellaneous income not covered by other categories',
    payment_type_mapping: 'other',
    is_active: true,
    display_order: 999
  }
];

async function seedIncomeCategories() {
  try {
    console.log('🌱 Seeding income categories...');

    for (const category of INCOME_CATEGORIES) {
      const [incomeCategory, created] = await IncomeCategory.findOrCreate({
        where: { gl_code: category.gl_code },
        defaults: category
      });

      if (created) {
        console.log(`✅ Created: ${category.gl_code} - ${category.name}`);
      } else {
        console.log(`ℹ️  Already exists: ${category.gl_code} - ${category.name}`);
      }
    }

    console.log('✅ Income categories seeded successfully');
    console.log(`📊 Total categories: ${INCOME_CATEGORIES.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seedIncomeCategories()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = seedIncomeCategories;
