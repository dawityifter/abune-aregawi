'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Department extends Model {
    static associate(models) {
      // Department has many members through department_members
      Department.belongsToMany(models.Member, {
        through: models.DepartmentMember,
        foreignKey: 'department_id',
        otherKey: 'member_id',
        as: 'members'
      });

      // Department has many department_members records
      Department.hasMany(models.DepartmentMember, {
        foreignKey: 'department_id',
        as: 'memberships'
      });

      // Department belongs to a leader (Member)
      Department.belongsTo(models.Member, {
        foreignKey: 'leader_id',
        as: 'leader'
      });

      // Self-referencing for hierarchy (parent-child departments)
      Department.belongsTo(models.Department, {
        foreignKey: 'parent_department_id',
        as: 'parentDepartment'
      });

      Department.hasMany(models.Department, {
        foreignKey: 'parent_department_id',
        as: 'subDepartments'
      });

      // Department has many meetings
      Department.hasMany(models.DepartmentMeeting, {
        foreignKey: 'department_id',
        as: 'meetings'
      });

      // Department has many tasks
      Department.hasMany(models.DepartmentTask, {
        foreignKey: 'department_id',
        as: 'tasks'
      });
    }
  }

  Department.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 150]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'ministry',
      validate: {
        isIn: [['ministry', 'committee', 'service', 'social', 'administrative']]
      }
    },
    parent_department_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'parent_department_id'
    },
    leader_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'leader_id'
    },
    contact_email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    contact_phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    meeting_schedule: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_public'
    },
    max_members: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1
      }
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    modelName: 'Department',
    tableName: 'departments',
    timestamps: true,
    underscored: true
  });

  return Department;
};
