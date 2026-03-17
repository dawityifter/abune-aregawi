'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Announcement extends Model {
    static associate(models) {
      Announcement.belongsTo(models.Member, { foreignKey: 'created_by_member_id', as: 'createdBy' });
    }
  }

  Announcement.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    title_ti: { type: DataTypes.STRING(255), allowNull: true },
    description_ti: { type: DataTypes.TEXT, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('active', 'cancelled'), allowNull: false, defaultValue: 'active' },
    created_by_member_id: { type: DataTypes.BIGINT, allowNull: true }
  }, {
    sequelize,
    modelName: 'Announcement',
    tableName: 'announcements',
    timestamps: true,
    underscored: true
  });

  return Announcement;
};
