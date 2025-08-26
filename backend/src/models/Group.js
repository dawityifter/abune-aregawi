'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Group extends Model {
    static associate(models) {
      Group.hasMany(models.MemberGroup, { foreignKey: 'group_id', as: 'memberships' });
    }
  }

  Group.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    sequelize,
    modelName: 'Group',
    tableName: 'groups',
    timestamps: true,
    underscored: true
  });

  return Group;
};
