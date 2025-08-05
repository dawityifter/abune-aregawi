'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Donation extends Model {
    static associate(models) {
      // Define associations here if needed
      // For now, donations are standalone
    }
  }

  Donation.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    stripe_payment_intent_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    stripe_customer_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'usd'
    },
    donation_type: {
      type: DataTypes.ENUM('one-time', 'recurring'),
      allowNull: false
    },
    frequency: {
      type: DataTypes.ENUM('weekly', 'monthly', 'quarterly', 'yearly'),
      allowNull: true
    },
    payment_method: {
      type: DataTypes.ENUM('card', 'ach'),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'canceled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    donor_first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    donor_last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    donor_email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    donor_phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    donor_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    donor_zip_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Donation',
    tableName: 'donations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Donation;
}; 