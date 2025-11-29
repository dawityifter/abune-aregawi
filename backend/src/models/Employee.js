'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Employee extends Model {
    static associate(models) {
      // An employee can have multiple ledger entries (expenses paid to them)
      Employee.hasMany(models.LedgerEntry, {
        foreignKey: 'employee_id',
        as: 'expenses'
      });
    }
  }

  Employee.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      },
      comment: 'Employee first name'
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      },
      comment: 'Employee last name'
    },
    position: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Job title or position (e.g., Priest, Deacon, Janitor, Secretary)'
    },
    employment_type: {
      type: DataTypes.ENUM('full-time', 'part-time', 'contract', 'volunteer'),
      allowNull: false,
      defaultValue: 'part-time',
      comment: 'Type of employment'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      },
      comment: 'Employee email address'
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Employee phone number'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Employee mailing address'
    },
    ssn_last_four: {
      type: DataTypes.STRING(4),
      allowNull: true,
      validate: {
        len: [4, 4],
        isNumeric: true
      },
      comment: 'Last 4 digits of SSN for identification (encrypted in production)'
    },
    hire_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date employee was hired'
    },
    termination_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: 'Date employment ended (if applicable)'
    },
    salary_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Regular salary/allowance amount'
    },
    salary_frequency: {
      type: DataTypes.ENUM('weekly', 'bi-weekly', 'monthly', 'annual', 'per-service'),
      allowNull: true,
      comment: 'How often salary is paid'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether employee is currently active'
    },
    tax_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Tax ID or EIN for 1099 contractors'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Additional notes about the employee'
    }
  }, {
    sequelize,
    modelName: 'Employee',
    tableName: 'employees',
    timestamps: true,
    paranoid: true, // Soft delete
    indexes: [
      { fields: ['is_active'] },
      { fields: ['employment_type'] },
      { fields: ['email'], unique: true, where: { email: { [sequelize.Sequelize.Op.ne]: null } } },
      { fields: ['created_at'] }
    ]
  });

  return Employee;
};
