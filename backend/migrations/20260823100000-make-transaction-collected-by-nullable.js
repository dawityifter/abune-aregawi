'use strict';

// transactions.collected_by is NOT NULL, and handlePaymentSucceeded sets it to
// the resolved member id. An online gift from a non-member has no member and
// therefore no collector — nobody collected it. Rather than invent a "system
// member" (which would pollute the members table, whose rows mean "registered
// parishioner"), the column becomes nullable. ledger_entries.collected_by
// already works this way: "Can be null for system-generated entries".

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      if (isPg) {
        // Raw ALTER rather than changeColumn: changeColumn re-emits the FK
        // definition, which on Postgres can drop and recreate the constraint
        // (and its ON DELETE RESTRICT) as a side effect. Dropping NOT NULL is
        // all we want.
        await queryInterface.sequelize.query(
          'ALTER TABLE transactions ALTER COLUMN collected_by DROP NOT NULL;',
          { transaction: t }
        );
      } else {
        await queryInterface.changeColumn('transactions', 'collected_by', {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        }, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    // This down() FAILS BY DESIGN if any anonymous online gift has been
    // recorded since up() ran, because there is no correct member id to put in
    // those rows and inventing one would corrupt "who collected this". If you
    // genuinely need to roll back, decide what those payments should say first.
    await queryInterface.sequelize.transaction(async (t) => {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT COUNT(*) AS n FROM transactions WHERE collected_by IS NULL;',
        { transaction: t }
      );
      const nullCount = parseInt(rows[0].n, 10);
      if (nullCount > 0) {
        throw new Error(
          `Cannot restore NOT NULL: ${nullCount} transaction(s) have a null collected_by. ` +
          'These are anonymous online gifts with no collector. Resolve them first.'
        );
      }

      if (isPg) {
        await queryInterface.sequelize.query(
          'ALTER TABLE transactions ALTER COLUMN collected_by SET NOT NULL;',
          { transaction: t }
        );
      } else {
        await queryInterface.changeColumn('transactions', 'collected_by', {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT'
        }, { transaction: t });
      }
    });
  }
};
