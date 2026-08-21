'use strict';

// Order is load-bearing. is_historical must be set on the existing rows BEFORE
// the partial unique index is built, because production has 6 members holding
// duplicate 2025 pledges (max 3 for one member). Building the index first fails.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM pledge_campaigns WHERE slug = '2025-pledge-drive';"
    );
    if (!rows.length) throw new Error('2025-pledge-drive campaign missing — run the campaigns migration first');
    const campaign2025 = rows[0].id;

    // 1. campaign_id, nullable for now
    await queryInterface.addColumn('pledges', 'campaign_id', {
      type: Sequelize.BIGINT, allowNull: true,
      references: { model: 'pledge_campaigns', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'RESTRICT'
    });

    // 2. Backfill unconditionally: all existing rows are one drive
    //    (verified in production — every row has a blank event_name).
    await queryInterface.sequelize.query(
      'UPDATE pledges SET campaign_id = :cid WHERE campaign_id IS NULL;',
      { replacements: { cid: campaign2025 } }
    );

    await queryInterface.changeColumn('pledges', 'campaign_id', {
      type: Sequelize.BIGINT, allowNull: false
    });

    // 3. is_historical — set true for every pre-existing row
    await queryInterface.addColumn('pledges', 'is_historical', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false
    });
    await queryInterface.sequelize.query(
      'UPDATE pledges SET is_historical = true WHERE campaign_id = :cid;',
      { replacements: { cid: campaign2025 } }
    );

    // 4. lifecycle, derived from the old status
    await queryInterface.addColumn('pledges', 'lifecycle', {
      type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active'
    });
    await queryInterface.sequelize.query(
      "UPDATE pledges SET lifecycle = 'cancelled' WHERE status = 'cancelled';"
    );

    // 5. Rename status -> legacy_status and relax its constraints.
    //    The data is preserved verbatim; only the name changes.
    await queryInterface.renameColumn('pledges', 'status', 'legacy_status');
    await queryInterface.changeColumn('pledges', 'legacy_status', {
      type: Sequelize.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
      allowNull: true, defaultValue: null
    });

    // 6. Indexes — AFTER is_historical is populated
    await queryInterface.addIndex('pledges', ['campaign_id']);
    await queryInterface.addIndex('pledges', ['campaign_id', 'lifecycle']);

    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
        ON pledges (campaign_id, member_id)
        WHERE member_id IS NOT NULL AND lifecycle = 'active' AND is_historical = false;
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE pledges ADD CONSTRAINT pledges_lifecycle_check
        CHECK (lifecycle IN ('active', 'cancelled'));
      `);
      await queryInterface.sequelize.query(`
        ALTER TABLE pledges ADD CONSTRAINT pledges_amount_positive CHECK (amount > 0);
      `);
    }
  },

  down: async (queryInterface, Sequelize) => {
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;');
      await queryInterface.sequelize.query('ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_lifecycle_check;');
      await queryInterface.sequelize.query('ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_amount_positive;');
    }
    await queryInterface.renameColumn('pledges', 'legacy_status', 'status');
    // Pledges created after this migration (2026 rows) legitimately have a NULL
    // legacy_status, so the NOT NULL constraint below cannot be applied until
    // those are backfilled.
    await queryInterface.sequelize.query(
      "UPDATE pledges SET status = 'pending' WHERE status IS NULL;"
    );
    await queryInterface.changeColumn('pledges', 'status', {
      type: Sequelize.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    });
    await queryInterface.removeColumn('pledges', 'lifecycle');
    await queryInterface.removeColumn('pledges', 'is_historical');
    await queryInterface.removeColumn('pledges', 'campaign_id');
  }
};
