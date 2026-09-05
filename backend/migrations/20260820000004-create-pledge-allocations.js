'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Wrapped in a transaction: createTable + 2 addIndex calls + the raw
    // CHECK constraints + the trigger function/trigger are none of them
    // individually idempotent (CREATE TRIGGER has no IF NOT EXISTS), so a
    // failure partway through would leave a created-but-not-fully-guarded
    // table that a retry of `db:migrate` can't get past ("relation already
    // exists"). No ALTER TYPE is used here, so a transaction wrapper is safe.
    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.createTable('pledge_allocations', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        pledge_id: {
          type: Sequelize.BIGINT, allowNull: false,
          references: { model: 'pledges', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'RESTRICT'
        },
        transaction_id: {
          type: Sequelize.BIGINT, allowNull: false,
          references: { model: 'transactions', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'RESTRICT'
        },
        amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        source: { type: Sequelize.STRING(24), allowNull: false },
        allocated_by: {
          type: Sequelize.BIGINT, allowNull: true,
          references: { model: 'members', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'SET NULL'
        },
        reason: { type: Sequelize.TEXT, allowNull: true },
        reverses_allocation_id: {
          type: Sequelize.BIGINT, allowNull: true,
          references: { model: 'pledge_allocations', key: 'id' },
          onUpdate: 'CASCADE', onDelete: 'RESTRICT'
        },
        idempotency_key: { type: Sequelize.STRING(191), allowNull: true, unique: true },
        created_at: { type: Sequelize.DATE, allowNull: false }
      }, { transaction: t });

      await queryInterface.addIndex('pledge_allocations', ['pledge_id'], { transaction: t });
      await queryInterface.addIndex('pledge_allocations', ['transaction_id'], { transaction: t });

      if (queryInterface.sequelize.getDialect() !== 'postgres') return;

      await queryInterface.sequelize.query(`
        ALTER TABLE pledge_allocations
          ADD CONSTRAINT pledge_allocations_amount_nonzero CHECK (amount <> 0),
          ADD CONSTRAINT pledge_allocations_source_check
            CHECK (source IN ('stripe_auto','treasurer_manual','migration','stripe_refund')),
          ADD CONSTRAINT pledge_allocations_reversal_shape
            CHECK (reverses_allocation_id IS NULL OR (amount < 0 AND reason IS NOT NULL));
      `, { transaction: t });

      // Append-only. This is what makes "financial records cannot be corrupted"
      // a guarantee rather than a convention. Corrections are reversing rows.
      await queryInterface.sequelize.query(`
        CREATE OR REPLACE FUNCTION pledge_allocations_append_only()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'pledge_allocations is append-only: insert a reversing row instead of %', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
      `, { transaction: t });
      await queryInterface.sequelize.query(`
        CREATE TRIGGER pledge_allocations_no_update_delete
        BEFORE UPDATE OR DELETE ON pledge_allocations
        FOR EACH ROW EXECUTE FUNCTION pledge_allocations_append_only();
      `, { transaction: t });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (t) => {
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query('DROP TRIGGER IF EXISTS pledge_allocations_no_update_delete ON pledge_allocations;', { transaction: t });
        await queryInterface.sequelize.query('DROP FUNCTION IF EXISTS pledge_allocations_append_only();', { transaction: t });
      }
      await queryInterface.dropTable('pledge_allocations', { transaction: t });
    });
  }
};
