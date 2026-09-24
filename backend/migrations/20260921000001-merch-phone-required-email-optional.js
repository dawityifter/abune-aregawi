'use strict';

// Merchandise orders swap which contact detail is mandatory: the phone becomes
// required and the email optional.
//
// A separate ALTER rather than an edit to 20260919000002-create-merch-orders.js
// on purpose. That migration may already have run against a developer's local
// database, and sequelize-cli will never re-run a file it has recorded — so an
// in-place edit would leave those databases with the old NOT NULL on email
// while every test passed against a freshly built schema.
//
// The phone backfill below can only ever touch pre-release test rows: merch has
// never been deployed, so no real order exists in any environment. It is there
// so the NOT NULL can be added without the migration failing on a half-explored
// local database.

const TABLE = 'merch_orders';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.map(String).includes(TABLE)) return;

    await queryInterface.sequelize.query(
      `UPDATE ${TABLE} SET purchaser_phone = '' WHERE purchaser_phone IS NULL`
    );

    await queryInterface.changeColumn(TABLE, 'purchaser_phone', {
      type: Sequelize.STRING(32),
      allowNull: false
    });

    await queryInterface.changeColumn(TABLE, 'purchaser_email', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.map(String).includes(TABLE)) return;

    // Reversing is only safe if every row still has an email, which is what the
    // old schema guaranteed. Orders taken while the email was optional may not,
    // so they are given a placeholder rather than blocking the rollback — an
    // unreachable-by-email order is still an order the parish has to fulfil.
    await queryInterface.sequelize.query(
      `UPDATE ${TABLE} SET purchaser_email = '' WHERE purchaser_email IS NULL`
    );

    await queryInterface.changeColumn(TABLE, 'purchaser_email', {
      type: Sequelize.STRING(255),
      allowNull: false
    });

    await queryInterface.changeColumn(TABLE, 'purchaser_phone', {
      type: Sequelize.STRING(32),
      allowNull: true
    });
  }
};
