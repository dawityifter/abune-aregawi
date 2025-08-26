'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SmsLog extends Model {
    static associate(models) {
      SmsLog.belongsTo(models.Member, { foreignKey: 'sender_id', as: 'sender' });
    }
  }

  SmsLog.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
    sender_id: { type: DataTypes.BIGINT, allowNull: false },
    role: { type: DataTypes.STRING(50), allowNull: false },
    recipient_type: { type: DataTypes.ENUM('individual', 'group', 'all'), allowNull: false },
    recipient_member_id: { type: DataTypes.BIGINT, allowNull: true },
    group_id: { type: DataTypes.BIGINT, allowNull: true },
    recipient_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('success', 'partial', 'failed'), allowNull: false },
    error: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'SmsLog',
    tableName: 'sms_logs',
    timestamps: true,
    underscored: true
  });

  return SmsLog;
};
