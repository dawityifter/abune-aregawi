'use strict';

// Event merchandise orders (t-shirts and similar). Deliberately separate from
// `donations`: a shirt is a sale, not a charitable gift, and mixing the two
// would put merchandise revenue into giving statements.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('merch_orders', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      // Nullable only for the instant between writing the pending order and
      // Stripe returning a session id; see the model for why that order matters.
      stripe_checkout_session_id: { type: Sequelize.STRING(255), allowNull: true },
      stripe_payment_intent_id: { type: Sequelize.STRING(255), allowNull: true },
      purchaser_name: { type: Sequelize.STRING(255), allowNull: false },
      purchaser_email: { type: Sequelize.STRING(255), allowNull: false },
      purchaser_phone: { type: Sequelize.STRING(32), allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'paid', 'canceled', 'expired'),
        allowNull: false,
        defaultValue: 'pending'
      },
      fulfillment_status: {
        type: Sequelize.ENUM('unfulfilled', 'fulfilled'),
        allowNull: false,
        defaultValue: 'unfulfilled'
      },
      subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      tax: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'usd' },
      event_key: { type: Sequelize.STRING(100), allowNull: false },
      transaction_id: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      fulfilled_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    // Load-bearing, not tidiness: this UNIQUE index is what makes the Stripe
    // webhook idempotent. A redelivered checkout.session.completed cannot
    // create a second order for the same session. Do not drop it.
    await queryInterface.addIndex('merch_orders', ['stripe_checkout_session_id'], {
      name: 'merch_orders_session_unique',
      unique: true
    });
    await queryInterface.addIndex('merch_orders', ['stripe_payment_intent_id'], {
      name: 'merch_orders_payment_intent_idx'
    });
    await queryInterface.addIndex('merch_orders', ['status'], { name: 'merch_orders_status_idx' });
    await queryInterface.addIndex('merch_orders', ['fulfillment_status'], {
      name: 'merch_orders_fulfillment_idx'
    });
    await queryInterface.addIndex('merch_orders', ['event_key'], { name: 'merch_orders_event_idx' });
    await queryInterface.addIndex('merch_orders', ['purchaser_email'], {
      name: 'merch_orders_email_idx'
    });

    await queryInterface.createTable('merch_order_items', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
      order_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'merch_orders', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      product_name: { type: Sequelize.STRING(255), allowNull: false },
      size: { type: Sequelize.STRING(20), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unit_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      total_amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });

    await queryInterface.addIndex('merch_order_items', ['order_id'], {
      name: 'merch_order_items_order_idx'
    });
    await queryInterface.addIndex('merch_order_items', ['size'], {
      name: 'merch_order_items_size_idx'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('merch_order_items');
    await queryInterface.dropTable('merch_orders');

    // Postgres leaves the ENUM types behind after the tables go.
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_merch_orders_status";');
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_merch_orders_fulfillment_status";');
    }
  }
};
