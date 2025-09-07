'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Outreach extends Model {
    static associate(models) {
      Outreach.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
    }
  }

  Outreach.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    welcomed_by: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    welcomed_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 2000]
      }
    }
  }, {
    sequelize,
    modelName: 'Outreach',
    tableName: 'outreach',
    timestamps: true,
    underscored: true
  });

  return Outreach;
};
