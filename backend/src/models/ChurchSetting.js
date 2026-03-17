'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class ChurchSetting extends Model {}

  ChurchSetting.init({
    key: { type: DataTypes.STRING(100), primaryKey: true, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'ChurchSetting',
    tableName: 'church_settings',
    timestamps: true,
    updatedAt: 'updated_at',
    createdAt: false,
    underscored: true
  });

  return ChurchSetting;
};
