'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class MemberGroup extends Model {
    static associate(models) {
      MemberGroup.belongsTo(models.Member, { foreignKey: 'member_id', as: 'member' });
      MemberGroup.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
    }
  }

  MemberGroup.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, allowNull: false },
    member_id: { type: DataTypes.BIGINT, allowNull: false },
    group_id: { type: DataTypes.BIGINT, allowNull: false }
  }, {
    sequelize,
    modelName: 'MemberGroup',
    tableName: 'member_groups',
    timestamps: true,
    underscored: true
  });

  return MemberGroup;
};
