'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Vendor extends Model {
    static associate(models) {
      // A vendor can have multiple ledger entries (expenses paid to them)
      Vendor.hasMany(models.LedgerEntry, {
        foreignKey: 'vendor_id',
        as: 'expenses'
      });
    }
  }

  Vendor.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255]
      },
      comment: 'Vendor/supplier name'
    },
    vendor_type: {
      type: DataTypes.ENUM('utility', 'supplier', 'service-provider', 'contractor', 'lender', 'other'),
      allowNull: false,
      defaultValue: 'other',
      comment: 'Type of vendor'
    },
    contact_person: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Primary contact person name'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      },
      comment: 'Vendor email address'
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Vendor phone number'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Vendor mailing address'
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true
      },
      comment: 'Vendor website URL'
    },
    tax_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Vendor tax ID or EIN'
    },
    account_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Church account number with this vendor'
    },
    payment_terms: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Payment terms (e.g., Net 30, Due on receipt)'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether vendor is currently active'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the vendor'
    }
  }, {
    sequelize,
    modelName: 'Vendor',
    tableName: 'vendors',
    timestamps: true,
    paranoid: true, // Soft delete
    indexes: [
      { fields: ['is_active'] },
      { fields: ['vendor_type'] },
      { fields: ['name'] },
      { fields: ['created_at'] }
    ]
  });

  return Vendor;
};
