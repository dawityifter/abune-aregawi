'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Starting simple table refactor from UUID to BIGINT...');
    
    // Check if members_new table already exists
    const [results] = await queryInterface.sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'members_new'"
    );
    
    if (results.length > 0) {
      console.log('ℹ️  members_new table already exists, skipping creation');
      return; // Skip the rest of the migration
    }
    
    console.log('📋 Creating new members table with BIGINT...');
    await queryInterface.createTable('members_new', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      firebase_uid: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      middle_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true
      },
      phone_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: true
      },
      baptism_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      repentance_father: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      household_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      street_line1: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      apartment_no: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      state: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: 'USA'
      },
      emergency_contact_name: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      emergency_contact_phone: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      date_joined_parish: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      spouse_name: {
        type: Sequelize.STRING(200),
        allowNull: true
      },
      family_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members_new',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      role: {
        type: Sequelize.ENUM('member', 'admin', 'treasurer', 'secretary', 'priest', 'deacon'),
        allowNull: false,
        defaultValue: 'member'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      registration_status: {
        type: Sequelize.ENUM('pending', 'complete', 'incomplete'),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for members_new
    await queryInterface.addIndex('members_new', ['email']);
    await queryInterface.addIndex('members_new', ['phone_number']);
    await queryInterface.addIndex('members_new', ['firebase_uid']);
    await queryInterface.addIndex('members_new', ['role']);
    await queryInterface.addIndex('members_new', ['is_active']);
    await queryInterface.addIndex('members_new', ['family_id']);

    console.log('📋 Creating new dependents table with BIGINT...');
    await queryInterface.createTable('dependents_new', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'members_new',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      middle_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      gender: {
        type: Sequelize.ENUM('male', 'female', 'other'),
        allowNull: true
      },
      relationship: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      medical_conditions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      allergies: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      medications: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      dietary_restrictions: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for dependents_new
    await queryInterface.addIndex('dependents_new', ['member_id']);

    console.log('📋 Creating new transactions table with BIGINT...');
    await queryInterface.createTable('transactions_new', {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'members_new',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      collected_by: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'members_new',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      payment_type: {
        type: Sequelize.ENUM('membership_due', 'tithe', 'donation', 'event', 'other'),
        allowNull: false
      },
      payment_method: {
        type: Sequelize.ENUM('cash', 'check', 'zelle', 'credit_card', 'debit_card', 'ach', 'other'),
        allowNull: false
      },
      receipt_number: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create indexes for transactions_new
    await queryInterface.addIndex('transactions_new', ['member_id']);
    await queryInterface.addIndex('transactions_new', ['collected_by']);
    await queryInterface.addIndex('transactions_new', ['payment_date']);
    await queryInterface.addIndex('transactions_new', ['payment_type']);
    await queryInterface.addIndex('transactions_new', ['payment_method']);

    // Add CHECK constraints for transactions_new
    await queryInterface.sequelize.query(`
      ALTER TABLE transactions_new 
      ADD CONSTRAINT check_receipt_for_cash_check 
      CHECK (
        (payment_method IN ('cash', 'check') AND receipt_number IS NOT NULL) OR
        (payment_method NOT IN ('cash', 'check'))
      );
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE transactions_new 
      ADD CONSTRAINT check_positive_amount 
      CHECK (amount > 0);
    `);

    // Step 2: Migrate data from old tables to new tables
    console.log('🔄 Migrating data from old tables to new tables...');

    // Migrate members data
    console.log('📊 Migrating members data...');
    const members = await queryInterface.sequelize.query(
      'SELECT * FROM members ORDER BY created_at',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const member of members) {
      // Convert gender to lowercase for enum compatibility
      const gender = member.gender ? member.gender.toLowerCase() : null;
      
      await queryInterface.sequelize.query(`
        INSERT INTO members_new (
          firebase_uid, first_name, middle_name, last_name, email, phone_number,
          date_of_birth, gender, baptism_name, repentance_father, household_size,
          street_line1, apartment_no, city, state, postal_code, country, 
          emergency_contact_name, emergency_contact_phone, date_joined_parish,
          spouse_name, role, is_active, registration_status, created_at, updated_at
        ) VALUES (
          :firebase_uid, :first_name, :middle_name, :last_name, :email, :phone_number,
          :date_of_birth, :gender, :baptism_name, :repentance_father, :household_size,
          :street_line1, :apartment_no, :city, :state, :postal_code, :country,
          :emergency_contact_name, :emergency_contact_phone, :date_joined_parish,
          :spouse_name, :role, :is_active, :registration_status, :created_at, :updated_at
        )
      `, {
        replacements: {
          firebase_uid: member.firebase_uid,
          first_name: member.first_name,
          middle_name: member.middle_name,
          last_name: member.last_name,
          email: member.email,
          phone_number: member.phone_number,
          date_of_birth: member.date_of_birth,
          gender: gender,
          baptism_name: member.baptism_name,
          repentance_father: member.repentance_father,
          household_size: member.household_size,
          street_line1: member.street_line1,
          apartment_no: member.apartment_no,
          city: member.city,
          state: member.state,
          postal_code: member.postal_code,
          country: member.country,
          emergency_contact_name: member.emergency_contact_name,
          emergency_contact_phone: member.emergency_contact_phone,
          date_joined_parish: member.date_joined_parish,
          spouse_name: member.spouse_name,
          role: member.role,
          is_active: member.is_active,
          registration_status: member.registration_status || 'pending',
          created_at: member.created_at,
          updated_at: member.updated_at
        }
      });
    }

    // Migrate dependants data (renamed to dependents)
    console.log('📊 Migrating dependants data...');
    const dependants = await queryInterface.sequelize.query(
      'SELECT d.*, m.id as new_member_id FROM dependants d JOIN members m ON d.member_id = m.id ORDER BY d.created_at',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const dependant of dependants) {
      // Convert gender to lowercase for enum compatibility
      const gender = dependant.gender ? dependant.gender.toLowerCase() : null;
      
      await queryInterface.sequelize.query(`
        INSERT INTO dependents_new (
          member_id, first_name, middle_name, last_name, date_of_birth, gender,
          relationship, medical_conditions, allergies, medications, dietary_restrictions,
          notes, created_at, updated_at
        ) VALUES (
          :member_id, :first_name, :middle_name, :last_name, :date_of_birth, :gender,
          :relationship, :medical_conditions, :allergies, :medications, :dietary_restrictions,
          :notes, :created_at, :updated_at
        )
      `, {
        replacements: {
          member_id: dependant.new_member_id,
          first_name: dependant.first_name,
          middle_name: dependant.middle_name,
          last_name: dependant.last_name,
          date_of_birth: dependant.date_of_birth,
          gender: gender,
          relationship: dependant.relationship,
          medical_conditions: dependant.medical_conditions,
          allergies: dependant.allergies,
          medications: dependant.medications,
          dietary_restrictions: dependant.dietary_restrictions,
          notes: dependant.notes,
          created_at: dependant.created_at,
          updated_at: dependant.updated_at
        }
      });
    }

    // Migrate church_transactions data (renamed to transactions)
    console.log('📊 Migrating church_transactions data...');
    const transactions = await queryInterface.sequelize.query(
      'SELECT ct.*, m1.id as new_member_id, m2.id as new_collector_id FROM church_transactions ct JOIN members m1 ON ct.member_id = m1.id JOIN members m2 ON ct.collected_by = m2.id ORDER BY ct.created_at',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const transaction of transactions) {
      await queryInterface.sequelize.query(`
        INSERT INTO transactions_new (
          member_id, collected_by, payment_date, amount, payment_type, payment_method,
          receipt_number, note, created_at, updated_at
        ) VALUES (
          :member_id, :collected_by, :payment_date, :amount, :payment_type, :payment_method,
          :receipt_number, :note, :created_at, :updated_at
        )
      `, {
        replacements: {
          member_id: transaction.new_member_id,
          collected_by: transaction.new_collector_id,
          payment_date: transaction.payment_date,
          amount: transaction.amount,
          payment_type: transaction.payment_type,
          payment_method: transaction.payment_method,
          receipt_number: transaction.receipt_number,
          note: transaction.note,
          created_at: transaction.created_at,
          updated_at: transaction.updated_at
        }
      });
    }

    // Step 3: Update family_id references in members_new
    console.log('🔄 Updating family_id references...');
    const familyUpdates = await queryInterface.sequelize.query(
      'SELECT m1.id as old_id, m1.family_id as old_family_id, m2.id as new_family_id FROM members m1 JOIN members m2 ON m1.family_id = m2.id WHERE m1.family_id IS NOT NULL',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const update of familyUpdates) {
      await queryInterface.sequelize.query(`
        UPDATE members_new SET family_id = :new_family_id WHERE id = :old_id
      `, {
        replacements: {
          new_family_id: update.new_family_id,
          old_id: update.old_id
        }
      });
    }

    // Step 4: Drop old tables and rename new tables
    console.log('🗑️ Dropping old tables...');
    await queryInterface.dropTable('church_transactions');
    await queryInterface.dropTable('dependants');
    await queryInterface.dropTable('members');

    console.log('🔄 Renaming new tables...');
    await queryInterface.renameTable('members_new', 'members');
    await queryInterface.renameTable('dependents_new', 'dependents');
    await queryInterface.renameTable('transactions_new', 'transactions');

    console.log('✅ Table refactor completed successfully!');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🔄 Rolling back table refactor...');
    console.log('⚠️ This migration cannot be easily rolled back due to data structure changes.');
    throw new Error('This migration cannot be rolled back automatically. Manual intervention required.');
  }
}; 