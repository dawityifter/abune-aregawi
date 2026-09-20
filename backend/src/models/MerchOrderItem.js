'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class MerchOrderItem extends Model {
    static associate(models) {
      MerchOrderItem.belongsTo(models.MerchOrder, {
        foreignKey: 'order_id',
        as: 'order'
      });
    }
  }

  MerchOrderItem.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    order_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'merch_orders',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    },
    product_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    size: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: 'Free-form here, but only catalog sizes get past merchPricingService.'
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 }
    },
    unit_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Price per shirt in dollars, snapshotted at purchase. A later catalog price change must not rewrite history.'
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'unit_amount * quantity, in dollars.'
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
    modelName: 'MerchOrderItem',
    tableName: 'merch_order_items',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['order_id'] },
      // The size-summary query groups by size across paid orders.
      { fields: ['size'] }
    ]
  });

  return MerchOrderItem;
};
