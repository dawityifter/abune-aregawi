const { sequelize, Employee, Vendor } = require('../../models');

/**
 * Migration to add Employee and Vendor tables and update LedgerEntry
 * with payee-related fields for comprehensive expense tracking
 */
async function migrate() {
  console.log('🔄 Starting Employee and Vendor support migration...');
  
  try {
    // Create employees table
    console.log('📋 Creating employees table...');
    await sequelize.getQueryInterface().createTable('employees', {
      id: {
        type: sequelize.Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: sequelize.Sequelize.UUIDV4
      },
      first_name: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: false
      },
      last_name: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: false
      },
      position: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      },
      employment_type: {
        type: sequelize.Sequelize.ENUM('full-time', 'part-time', 'contract', 'volunteer'),
        allowNull: false,
        defaultValue: 'part-time'
      },
      email: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      },
      phone_number: {
        type: sequelize.Sequelize.STRING(20),
        allowNull: true
      },
      address: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      ssn_last_four: {
        type: sequelize.Sequelize.STRING(4),
        allowNull: true
      },
      hire_date: {
        type: sequelize.Sequelize.DATEONLY,
        allowNull: true
      },
      termination_date: {
        type: sequelize.Sequelize.DATEONLY,
        allowNull: true
      },
      salary_amount: {
        type: sequelize.Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      salary_frequency: {
        type: sequelize.Sequelize.ENUM('weekly', 'bi-weekly', 'monthly', 'annual', 'per-service'),
        allowNull: true
      },
      is_active: {
        type: sequelize.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      tax_id: {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
      },
      notes: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false
      },
      deleted_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      }
    });
    console.log('✅ Employees table created');

    // Create vendors table
    console.log('📋 Creating vendors table...');
    await sequelize.getQueryInterface().createTable('vendors', {
      id: {
        type: sequelize.Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: sequelize.Sequelize.UUIDV4
      },
      name: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: false
      },
      vendor_type: {
        type: sequelize.Sequelize.ENUM('utility', 'supplier', 'service-provider', 'contractor', 'lender', 'other'),
        allowNull: false,
        defaultValue: 'other'
      },
      contact_person: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      },
      email: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      },
      phone_number: {
        type: sequelize.Sequelize.STRING(20),
        allowNull: true
      },
      address: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      website: {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      },
      tax_id: {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
      },
      account_number: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      },
      payment_terms: {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      },
      is_active: {
        type: sequelize.Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      notes: {
        type: sequelize.Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: false
      },
      deleted_at: {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      }
    });
    console.log('✅ Vendors table created');

    // Add new columns to ledger_entries table
    console.log('📋 Adding payee columns to ledger_entries...');
    
    const tableInfo = await sequelize.getQueryInterface().describeTable('ledger_entries');
    
    if (!tableInfo.employee_id) {
      await sequelize.getQueryInterface().addColumn('ledger_entries', 'employee_id', {
        type: sequelize.Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'employees',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      console.log('✅ Added employee_id column');
    }

    if (!tableInfo.vendor_id) {
      await sequelize.getQueryInterface().addColumn('ledger_entries', 'vendor_id', {
        type: sequelize.Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'vendors',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
      console.log('✅ Added vendor_id column');
    }

    if (!tableInfo.payee_name) {
      await sequelize.getQueryInterface().addColumn('ledger_entries', 'payee_name', {
        type: sequelize.Sequelize.STRING(255),
        allowNull: true
      });
      console.log('✅ Added payee_name column');
    }

    if (!tableInfo.check_number) {
      await sequelize.getQueryInterface().addColumn('ledger_entries', 'check_number', {
        type: sequelize.Sequelize.STRING(50),
        allowNull: true
      });
      console.log('✅ Added check_number column');
    }

    if (!tableInfo.invoice_number) {
      await sequelize.getQueryInterface().addColumn('ledger_entries', 'invoice_number', {
        type: sequelize.Sequelize.STRING(100),
        allowNull: true
      });
      console.log('✅ Added invoice_number column');
    }

    // Create indexes
    console.log('📋 Creating indexes...');
    try {
      await sequelize.getQueryInterface().addIndex('employees', ['is_active'], {
        name: 'employees_is_active_idx'
      });
      await sequelize.getQueryInterface().addIndex('employees', ['employment_type'], {
        name: 'employees_employment_type_idx'
      });
      await sequelize.getQueryInterface().addIndex('vendors', ['is_active'], {
        name: 'vendors_is_active_idx'
      });
      await sequelize.getQueryInterface().addIndex('vendors', ['vendor_type'], {
        name: 'vendors_vendor_type_idx'
      });
      await sequelize.getQueryInterface().addIndex('ledger_entries', ['employee_id'], {
        name: 'ledger_entries_employee_id_idx'
      });
      await sequelize.getQueryInterface().addIndex('ledger_entries', ['vendor_id'], {
        name: 'ledger_entries_vendor_id_idx'
      });
      console.log('✅ Indexes created');
    } catch (indexError) {
      console.log('⚠️  Some indexes may already exist:', indexError.message);
    }

    console.log('✅ Migration completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

module.exports = migrate;
