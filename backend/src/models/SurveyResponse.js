'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SurveyResponse extends Model {}

  SurveyResponse.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true, allowNull: false },
    survey_slug: { type: DataTypes.STRING(100), allowNull: false },
    locale: { type: DataTypes.STRING(5), allowNull: false },
    member_status: { type: DataTypes.STRING(30), allowNull: true, defaultValue: null },
    answers: { type: DataTypes.JSONB, allowNull: false },
    ip_hash: { type: DataTypes.STRING(64), allowNull: true, defaultValue: null },
    submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    sequelize,
    modelName: 'SurveyResponse',
    tableName: 'survey_responses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true
  });

  return SurveyResponse;
};
