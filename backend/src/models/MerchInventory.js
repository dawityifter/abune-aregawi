'use strict';

const { Model, DataTypes } = require('sequelize');

/**
 * Shirts on hand, one row per (event, product, size).
 *
 * `quantity` is what is still available to SELL ONLINE. A checkout takes its
 * shirts off this number the moment it starts (see merchInventoryService), and
 * an abandoned checkout gives them back when Stripe expires the session — so
 * the last few of a size cannot be sold twice to two people paying at once.
 *
 * Staff edit it by hand from the admin page after cash sales at the church, or
 * after a recount. A (product, size) with no row is treated as sold out, never
 * as unlimited: a size added to the catalog must not go on sale until somebody
 * has actually counted how many there are.
 */
module.exports = (sequelize) => {
  class MerchInventory extends Model {}

  MerchInventory.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    event_key: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    product_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Catalog product_key, not the display name.'
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 }
    },
    updated_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Who last set the count by hand. Null when only online sales have moved it.'
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
    modelName: 'MerchInventory',
    tableName: 'merch_inventory',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { unique: true, fields: ['event_key', 'product_key', 'size'] }
    ]
  });

  return MerchInventory;
};
