'use strict';

// Every column is defaulted to the value that is already true of every existing
// row: each pledge on record WAS a promise to pay ('later'), and none was
// donor-anonymous. No backfill statement is needed or wanted.
//
// The index change narrows an existing partial index's WHERE clause by one
// conjunct, which can only remove rows from the index. It therefore cannot fail
// on existing data, and no current row can violate the result.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.addColumn('pledges', 'fulfillment_intent', {
        type: Sequelize.STRING(16), allowNull: false, defaultValue: 'later'
      }, { transaction: t });

      await queryInterface.addColumn('pledges', 'is_anonymous', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false
      }, { transaction: t });

      await queryInterface.addColumn('pledges', 'baptism_name', {
        type: Sequelize.STRING(255), allowNull: true
      }, { transaction: t });

      if (isPg) {
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_fulfillment_intent_check
          CHECK (fulfillment_intent IN ('later', 'immediate'));
        `, { transaction: t });

        // A pledge for future fulfillment may never be anonymous.
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_anonymous_requires_immediate
          CHECK (is_anonymous = false OR fulfillment_intent = 'immediate');
        `, { transaction: t });

        // Anonymous to the parish, never anonymous to the treasurer.
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_anonymous_is_identifiable
          CHECK (is_anonymous = false OR member_id IS NOT NULL OR baptism_name IS NOT NULL);
        `, { transaction: t });

        // Narrow the uniqueness rule to pledges that can still receive money.
        await queryInterface.sequelize.query(
          'DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;',
          { transaction: t }
        );
        await queryInterface.sequelize.query(`
          CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
          ON pledges (campaign_id, member_id)
          WHERE member_id IS NOT NULL
            AND lifecycle = 'active'
            AND is_historical = false
            AND fulfillment_intent = 'later';
        `, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      if (isPg) {
        await queryInterface.sequelize.query(
          'DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;',
          { transaction: t }
        );
        // Restore the original, wider predicate.
        await queryInterface.sequelize.query(`
          CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
          ON pledges (campaign_id, member_id)
          WHERE member_id IS NOT NULL AND lifecycle = 'active' AND is_historical = false;
        `, { transaction: t });

        await queryInterface.sequelize.query(
          'ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_anonymous_is_identifiable;',
          { transaction: t });
        await queryInterface.sequelize.query(
          'ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_anonymous_requires_immediate;',
          { transaction: t });
        await queryInterface.sequelize.query(
          'ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_fulfillment_intent_check;',
          { transaction: t });
      }

      await queryInterface.removeColumn('pledges', 'baptism_name', { transaction: t });
      await queryInterface.removeColumn('pledges', 'is_anonymous', { transaction: t });
      await queryInterface.removeColumn('pledges', 'fulfillment_intent', { transaction: t });
    });
  }
};
