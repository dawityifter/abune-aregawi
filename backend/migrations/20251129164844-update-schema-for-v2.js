'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Create employees table
      // Check if table exists first to make migration idempotent
      const employeesExists = await queryInterface.tableExists('employees');
      if (!employeesExists) {
        await queryInterface.createTable('employees', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4
          },
          first_name: {
            type: Sequelize.STRING(100),
            allowNull: false
          },
          last_name: {
            type: Sequelize.STRING(100),
            allowNull: false
          },
          position: {
            type: Sequelize.STRING(100),
            allowNull: true
          },
          employment_type: {
            type: Sequelize.ENUM('full-time', 'part-time', 'contract', 'volunteer'),
            allowNull: false,
            defaultValue: 'part-time'
          },
          email: {
            type: Sequelize.STRING(255),
            allowNull: true
          },
          phone_number: {
            type: Sequelize.STRING(20),
            allowNull: true
          },
          address: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          ssn_last_four: {
            type: Sequelize.STRING(4),
            allowNull: true
          },
          hire_date: {
            type: Sequelize.DATEONLY,
            allowNull: true
          },
          termination_date: {
            type: Sequelize.DATEONLY,
            allowNull: true
          },
          salary_amount: {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true
          },
          salary_frequency: {
            type: Sequelize.ENUM('weekly', 'bi-weekly', 'monthly', 'annual', 'per-service'),
            allowNull: true
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },
          tax_id: {
            type: Sequelize.STRING(50),
            allowNull: true
          },
          notes: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          deleted_at: {
            type: Sequelize.DATE,
            allowNull: true
          }
        }, { transaction });

        // Indexes for employees
        await queryInterface.addIndex('employees', ['is_active'], { transaction });
        await queryInterface.addIndex('employees', ['employment_type'], { transaction });
        // Conditional unique index for email
        await queryInterface.addIndex('employees', ['email'], {
          unique: true,
          where: { email: { [Sequelize.Op.ne]: null } },
          transaction
        });
      }

      // 2. Create vendors table
      const vendorsExists = await queryInterface.tableExists('vendors');
      if (!vendorsExists) {
        await queryInterface.createTable('vendors', {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4
          },
          name: {
            type: Sequelize.STRING(255),
            allowNull: false
          },
          vendor_type: {
            type: Sequelize.ENUM('utility', 'supplier', 'service-provider', 'contractor', 'lender', 'other'),
            allowNull: false,
            defaultValue: 'other'
          },
          contact_person: {
            type: Sequelize.STRING(255),
            allowNull: true
          },
          email: {
            type: Sequelize.STRING(255),
            allowNull: true
          },
          phone_number: {
            type: Sequelize.STRING(20),
            allowNull: true
          },
          address: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          website: {
            type: Sequelize.STRING(255),
            allowNull: true
          },
          tax_id: {
            type: Sequelize.STRING(50),
            allowNull: true
          },
          account_number: {
            type: Sequelize.STRING(100),
            allowNull: true
          },
          payment_terms: {
            type: Sequelize.STRING(100),
            allowNull: true
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },
          notes: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          deleted_at: {
            type: Sequelize.DATE,
            allowNull: true
          }
        }, { transaction });

        // Indexes for vendors
        await queryInterface.addIndex('vendors', ['is_active'], { transaction });
        await queryInterface.addIndex('vendors', ['vendor_type'], { transaction });
        await queryInterface.addIndex('vendors', ['name'], { transaction });
      }

      // 3. Create income_categories table
      const incomeCategoriesExists = await queryInterface.tableExists('income_categories');
      if (!incomeCategoriesExists) {
        await queryInterface.createTable('income_categories', {
          id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          },
          gl_code: {
            type: Sequelize.STRING(20),
            allowNull: false,
            unique: true
          },
          name: {
            type: Sequelize.STRING(255),
            allowNull: false
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true
          },
          payment_type_mapping: {
            type: Sequelize.STRING(50),
            allowNull: true
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
          },
          display_order: {
            type: Sequelize.INTEGER,
            allowNull: true
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
          }
        }, { transaction });

        await queryInterface.addIndex('income_categories', ['gl_code'], { transaction });
        await queryInterface.addIndex('income_categories', ['is_active'], { transaction });
        await queryInterface.addIndex('income_categories', ['payment_type_mapping'], { transaction });
      }

      // 4. Add columns to ledger_entries
      const ledgerTable = await queryInterface.describeTable('ledger_entries');

      if (!ledgerTable.employee_id) {
        await queryInterface.addColumn('ledger_entries', 'employee_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'employees', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
        await queryInterface.addIndex('ledger_entries', ['employee_id'], { transaction });
      }

      if (!ledgerTable.vendor_id) {
        await queryInterface.addColumn('ledger_entries', 'vendor_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'vendors', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
        await queryInterface.addIndex('ledger_entries', ['vendor_id'], { transaction });
      }

      if (!ledgerTable.payee_name) {
        await queryInterface.addColumn('ledger_entries', 'payee_name', {
          type: Sequelize.STRING(255),
          allowNull: true
        }, { transaction });
      }

      if (!ledgerTable.check_number) {
        await queryInterface.addColumn('ledger_entries', 'check_number', {
          type: Sequelize.STRING(50),
          allowNull: true
        }, { transaction });
      }

      if (!ledgerTable.invoice_number) {
        await queryInterface.addColumn('ledger_entries', 'invoice_number', {
          type: Sequelize.STRING(100),
          allowNull: true
        }, { transaction });
      }

      // 5. Add columns to transactions
      const transactionTable = await queryInterface.describeTable('transactions');

      if (!transactionTable.income_category_id) {
        await queryInterface.addColumn('transactions', 'income_category_id', {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'income_categories', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
        await queryInterface.addIndex('transactions', ['income_category_id'], { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Remove columns from transactions
      const transactionTable = await queryInterface.describeTable('transactions');
      if (transactionTable.income_category_id) {
        await queryInterface.removeColumn('transactions', 'income_category_id', { transaction });
      }

      // Remove columns from ledger_entries
      const ledgerTable = await queryInterface.describeTable('ledger_entries');
      if (ledgerTable.invoice_number) await queryInterface.removeColumn('ledger_entries', 'invoice_number', { transaction });
      if (ledgerTable.check_number) await queryInterface.removeColumn('ledger_entries', 'check_number', { transaction });
      if (ledgerTable.payee_name) await queryInterface.removeColumn('ledger_entries', 'payee_name', { transaction });
      if (ledgerTable.vendor_id) await queryInterface.removeColumn('ledger_entries', 'vendor_id', { transaction });
      if (ledgerTable.employee_id) await queryInterface.removeColumn('ledger_entries', 'employee_id', { transaction });

      // Drop tables
      await queryInterface.dropTable('income_categories', { transaction });
      await queryInterface.dropTable('vendors', { transaction });
      await queryInterface.dropTable('employees', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
