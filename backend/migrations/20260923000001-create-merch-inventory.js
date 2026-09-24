'use strict';

// Shirt stock for the October 5K, per product and size. See models/MerchInventory.js.
//
// Also gives each order line its catalog product_key. Lines stored only the
// display name until now, and returning an abandoned checkout's shirts to the
// right shelf needs the stable key. Nullable: older lines were never reserved,
// so there is nothing of theirs to return.
//
// Seeded with the opening count the parish has on hand. From here on the counts
// are changed by online sales and by staff on the admin page, never by a deploy.

const TABLE = 'merch_inventory';
const EVENT_KEY = 'october_5k_fundraiser';

const OPENING_STOCK = [
  { product_key: 'youth_heavy_cotton', size: 'S', quantity: 50 },
  { product_key: 'youth_heavy_cotton', size: 'M', quantity: 100 },
  { product_key: 'youth_heavy_cotton', size: 'L', quantity: 50 },
  { product_key: 'adult_heavy_cotton', size: 'S', quantity: 150 },
  { product_key: 'adult_heavy_cotton', size: 'L', quantity: 50 }
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      event_key: { type: Sequelize.STRING(100), allowNull: false },
      product_key: { type: Sequelize.STRING(100), allowNull: false },
      size: { type: Sequelize.STRING(20), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      updated_by: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    await queryInterface.addIndex(TABLE, ['event_key', 'product_key', 'size'], {
      unique: true,
      name: 'merch_inventory_event_product_size'
    });

    await queryInterface.addColumn('merch_order_items', 'product_key', {
      type: Sequelize.STRING(100),
      allowNull: true
    });

    const now = new Date();
    await queryInterface.bulkInsert(TABLE, OPENING_STOCK.map((row) => ({
      event_key: EVENT_KEY, ...row, created_at: now, updated_at: now
    })));
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('merch_order_items', 'product_key');
    await queryInterface.dropTable(TABLE);
  }
};
