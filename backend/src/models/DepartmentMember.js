'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class DepartmentMember extends Model {
    static associate(models) {
      // DepartmentMember belongs to Member
      DepartmentMember.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });

      // DepartmentMember belongs to Department
      DepartmentMember.belongsTo(models.Department, {
        foreignKey: 'department_id',
        as: 'department'
      });
    }
  }

  DepartmentMember.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    department_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'department_id'
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'member_id'
    },
    role_in_department: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'member',
      field: 'role_in_department'
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'joined_at'
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'inactive', 'pending']]
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'DepartmentMember',
    tableName: 'department_members',
    timestamps: true,
    underscored: true
  });

  return DepartmentMember;
};
