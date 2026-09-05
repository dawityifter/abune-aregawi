'use strict';

// Order is load-bearing. is_historical must be set on the existing rows BEFORE
// the partial unique index is built, because production has 6 members holding
// duplicate 2025 pledges (max 3 for one member). Building the index first fails.
//
// The whole body runs inside one transaction: this migration is several
// dependent ALTER TABLE / UPDATE steps, and without a transaction a failure
// partway through (e.g. the enum-cast bug this file used to have) leaves the
// schema half-migrated and un-recorded in SequelizeMeta, so a retry of
// `db:migrate` dies on "column already exists" instead of cleanly re-running.
// This migration contains no `ALTER TYPE ... ADD VALUE` (unlike 000006/000007,
// which must stay unwrapped — Postgres won't let a new enum value be used in
// the same transaction that adds it), so wrapping it is safe.

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      const [rows] = await queryInterface.sequelize.query(
        "SELECT id FROM pledge_campaigns WHERE slug = '2025-pledge-drive';",
        { transaction: t }
      );
      if (!rows.length) throw new Error('2025-pledge-drive campaign missing — run the campaigns migration first');
      const campaign2025 = rows[0].id;

      // 1. campaign_id, nullable for now
      await queryInterface.addColumn('pledges', 'campaign_id', {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: 'pledge_campaigns', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT'
      }, { transaction: t });

      // 2. Backfill unconditionally: all existing rows are one drive
      //    (verified in production — every row has a blank event_name).
      await queryInterface.sequelize.query(
        'UPDATE pledges SET campaign_id = :cid WHERE campaign_id IS NULL;',
        { replacements: { cid: campaign2025 }, transaction: t }
      );

      await queryInterface.changeColumn('pledges', 'campaign_id', {
        type: Sequelize.BIGINT, allowNull: false
      }, { transaction: t });

      // 3. is_historical — set true for every pre-existing row
      await queryInterface.addColumn('pledges', 'is_historical', {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false
      }, { transaction: t });
      await queryInterface.sequelize.query(
        'UPDATE pledges SET is_historical = true WHERE campaign_id = :cid;',
        { replacements: { cid: campaign2025 }, transaction: t }
      );

      // 4. lifecycle, derived from the old status
      await queryInterface.addColumn('pledges', 'lifecycle', {
        type: Sequelize.STRING(16), allowNull: false, defaultValue: 'active'
      }, { transaction: t });
      await queryInterface.sequelize.query(
        "UPDATE pledges SET lifecycle = 'cancelled' WHERE status = 'cancelled';",
        { transaction: t }
      );

      // 5. Rename status -> legacy_status and relax its constraints.
      //    The data is preserved verbatim; only the name and constraints
      //    change — NOT the underlying type. Postgres refuses a direct cast
      //    between two distinct enum types even when their labels are
      //    identical, and renameColumn() only renames the column, not the
      //    enum type backing it (still `enum_pledges_status`). A
      //    changeColumn() that tries to retype it into a freshly-created
      //    `enum_pledges_legacy_status` is therefore a hard Postgres error
      //    ("cannot cast type enum_pledges_status to
      //    enum_pledges_legacy_status"). Keeping the original enum type is
      //    strictly better anyway: zero conversion risk, and the Pledge model
      //    already maps this column as an ENUM of the same labels, so nothing
      //    downstream changes.
      await queryInterface.renameColumn('pledges', 'status', 'legacy_status', { transaction: t });
      if (isPg) {
        await queryInterface.sequelize.query(
          'ALTER TABLE pledges ALTER COLUMN legacy_status DROP NOT NULL, ALTER COLUMN legacy_status DROP DEFAULT;',
          { transaction: t }
        );
      } else {
        await queryInterface.changeColumn('pledges', 'legacy_status', {
          type: Sequelize.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
          allowNull: true, defaultValue: null
        }, { transaction: t });
      }

      // 6. Indexes — AFTER is_historical is populated
      await queryInterface.addIndex('pledges', ['campaign_id'], { transaction: t });
      await queryInterface.addIndex('pledges', ['campaign_id', 'lifecycle'], { transaction: t });

      if (isPg) {
        await queryInterface.sequelize.query(`
          CREATE UNIQUE INDEX pledges_one_active_per_member_per_campaign
          ON pledges (campaign_id, member_id)
          WHERE member_id IS NOT NULL AND lifecycle = 'active' AND is_historical = false;
        `, { transaction: t });
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_lifecycle_check
          CHECK (lifecycle IN ('active', 'cancelled'));
        `, { transaction: t });
        await queryInterface.sequelize.query(`
          ALTER TABLE pledges ADD CONSTRAINT pledges_amount_positive CHECK (amount > 0);
        `, { transaction: t });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    const isPg = queryInterface.sequelize.getDialect() === 'postgres';

    await queryInterface.sequelize.transaction(async (t) => {
      if (isPg) {
        await queryInterface.sequelize.query('DROP INDEX IF EXISTS pledges_one_active_per_member_per_campaign;', { transaction: t });
        await queryInterface.sequelize.query('ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_lifecycle_check;', { transaction: t });
        await queryInterface.sequelize.query('ALTER TABLE pledges DROP CONSTRAINT IF EXISTS pledges_amount_positive;', { transaction: t });
      }
      await queryInterface.renameColumn('pledges', 'legacy_status', 'status', { transaction: t });
      // Pledges created after this migration (2026 rows) legitimately have a NULL
      // legacy_status, so the NOT NULL constraint below cannot be applied until
      // those are backfilled.
      await queryInterface.sequelize.query(
        "UPDATE pledges SET status = 'pending' WHERE status IS NULL;",
        { transaction: t }
      );
      if (isPg) {
        // Mirror image of the up() fix: restore NOT NULL/DEFAULT on the
        // existing enum_pledges_status type rather than casting into a new one.
        await queryInterface.sequelize.query(
          "ALTER TABLE pledges ALTER COLUMN status SET DEFAULT 'pending', ALTER COLUMN status SET NOT NULL;",
          { transaction: t }
        );
      } else {
        await queryInterface.changeColumn('pledges', 'status', {
          type: Sequelize.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
          allowNull: false,
          defaultValue: 'pending'
        }, { transaction: t });
      }
      await queryInterface.removeColumn('pledges', 'lifecycle', { transaction: t });
      await queryInterface.removeColumn('pledges', 'is_historical', { transaction: t });
      await queryInterface.removeColumn('pledges', 'campaign_id', { transaction: t });
    });
  }
};
