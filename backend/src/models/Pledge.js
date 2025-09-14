'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Pledge extends Model {
    static associate(models) {
      // Define associations here if needed
      // Pledge belongs to Member
      Pledge.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });

      // Pledge can be linked to a Donation when fulfilled
      Pledge.belongsTo(models.Donation, {
        foreignKey: 'donation_id',
        as: 'donation'
      });
    }
  }

  Pledge.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id'
      }
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
    pledge_type: {
      type: DataTypes.ENUM('general', 'event', 'fundraising', 'tithe'),
      allowNull: false,
      defaultValue: 'general'
    },
    event_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'fulfilled', 'expired', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    pledge_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    due_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fulfilled_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Contact information
    first_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    zip_code: {
      type: DataTypes.STRING,
      allowNull: true
    },
    // Link to donation when fulfilled
    donation_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'donations',
        key: 'id'
      }
    },
    // Additional fields
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Pledge',
    tableName: 'pledges',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  return Pledge;
};
