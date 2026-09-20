'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class MerchOrder extends Model {
    static associate(models) {
      MerchOrder.hasMany(models.MerchOrderItem, {
        foreignKey: 'order_id',
        as: 'items',
        onDelete: 'CASCADE',
        hooks: true
      });

      // The books, not the order, are the record of the money. This link is how
      // an admin gets from a purchaser's question to the ledger entry.
      MerchOrder.belongsTo(models.Transaction, {
        foreignKey: 'transaction_id',
        as: 'transaction'
      });
    }
  }

  MerchOrder.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    stripe_checkout_session_id: {
      type: DataTypes.STRING(255),
      // Null for the instant between writing the pending order and Stripe
      // returning a session id — the order row has to exist first, because its
      // id is what travels in the session metadata. NULLs are distinct under a
      // unique index in both Postgres and sqlite, so uniqueness still holds for
      // every real session id.
      allowNull: true,
      unique: true,
      comment: 'Stripe Checkout Session id. UNIQUE — one order per session.'
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Set on checkout.session.completed; null while the order is pending.'
    },
    purchaser_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    purchaser_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Where the pickup instructions and receipt go.'
    },
    purchaser_phone: {
      type: DataTypes.STRING(32),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'canceled', 'expired'),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'Payment state. Only the Stripe webhook moves an order to paid.'
    },
    fulfillment_status: {
      type: DataTypes.ENUM('unfulfilled', 'fulfilled'),
      allowNull: false,
      defaultValue: 'unfulfilled',
      comment: 'Whether the purchaser has collected their shirts. Pickup only — there is no shipping.'
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Merchandise total before tax, in dollars.'
    },
    tax: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Sales tax in dollars. See config/merchTax.js — not assumed to be zero.'
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: 'Amount charged, in dollars. Reconciled against the Stripe session on payment.'
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'usd'
    },
    event_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Which event this order belongs to, e.g. october_5k_fundraiser.'
    },
    transaction_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'transactions',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'The Transaction created when this order was paid.'
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fulfilled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'MerchOrder',
    tableName: 'merch_orders',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['stripe_checkout_session_id'] },
      { fields: ['stripe_payment_intent_id'] },
      { fields: ['status'] },
      { fields: ['fulfillment_status'] },
      { fields: ['event_key'] },
      { fields: ['purchaser_email'] }
    ]
  });

  return MerchOrder;
};
