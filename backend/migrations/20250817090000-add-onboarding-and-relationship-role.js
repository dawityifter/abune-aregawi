'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1) Add 'relationship' to role enum (PostgreSQL)
    // Safely add the value to the existing enum if it doesn't exist
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'enum_members_role' AND e.enumlabel = 'relationship'
        ) THEN
          ALTER TYPE "enum_members_role" ADD VALUE 'relationship';
        END IF;
      END$$;
    `);

    // 2) Add onboarding columns
    await queryInterface.addColumn('members', 'is_welcomed', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether the member has been welcomed by the Relationship Department'
    });

    await queryInterface.addColumn('members', 'welcomed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Timestamp when the member was welcomed'
    });

    await queryInterface.addColumn('members', 'welcomed_by', {
      type: Sequelize.BIGINT,
      allowNull: true,
      comment: 'Member ID of the staff/admin who marked as welcomed'
    });

    // 3) Add foreign key for welcomed_by referencing members(id)
    try {
      await queryInterface.addConstraint('members', {
        fields: ['welcomed_by'],
        type: 'foreign key',
        name: 'fk_members_welcomed_by_members_id',
        references: {
          table: 'members',
          field: 'id'
        },
        onUpdate: 'SET NULL',
        onDelete: 'SET NULL'
      });
    } catch (e) {
      // If constraint exists or fails, log and continue
      console.warn('Skipping FK add for welcomed_by:', e.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Drop constraint if exists
    try {
      await queryInterface.removeConstraint('members', 'fk_members_welcomed_by_members_id');
    } catch (e) {
      console.warn('Skipping FK removal for welcomed_by:', e.message);
    }

    // Remove columns
    await queryInterface.removeColumn('members', 'welcomed_by');
    await queryInterface.removeColumn('members', 'welcomed_at');
    await queryInterface.removeColumn('members', 'is_welcomed');

    // Note: Reverting enum value removal is non-trivial and often avoided.
    // We will leave 'relationship' value in enum to avoid breaking rows.
  }
};
