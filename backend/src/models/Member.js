'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class Member extends Model {
    static associate(models) {
      // Define associations here
      Member.hasMany(models.Dependant, {
        foreignKey: 'member_id',
        as: 'dependents'
      });
      
      Member.hasMany(models.Transaction, {
        foreignKey: 'member_id',
        as: 'transactions'
      });
      
      Member.hasMany(models.Transaction, {
        foreignKey: 'collected_by',
        as: 'collected_transactions'
      });
      
      // Self-referencing association for family relationships
      Member.belongsTo(Member, {
        foreignKey: 'family_id',
        as: 'family_head'
      });
      
      Member.hasMany(Member, {
        foreignKey: 'family_id',
        as: 'family_members'
      });
    }
  }

  Member.init({
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    firebase_uid: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'firebase_uid'
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      field: 'first_name'
    },
    middle_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'middle_name'
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      },
      field: 'last_name'
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true
      },
      field: 'phone_number'
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'date_of_birth'
    },
    gender: {
      type: DataTypes.ENUM('male', 'female', 'other'),
      allowNull: true
    },
    baptism_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Baptism name',
      field: 'baptism_name'
    },
    repentance_father: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Name of the repentance father',
      field: 'repentance_father'
    },
    household_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Number of people in the household',
      field: 'household_size'
    },
    street_line1: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'street_line1'
    },
    apartment_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'apartment_no'
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    postal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'postal_code'
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'USA'
    },
    emergency_contact_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'emergency_contact_name'
    },
    emergency_contact_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: 'emergency_contact_phone'
    },
    date_joined_parish: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'date_joined_parish'
    },
    spouse_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: 'spouse_name'
    },
    family_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: {
        model: 'members',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      field: 'family_id'
    },
    role: {
      type: DataTypes.ENUM('member', 'admin', 'treasurer', 'secretary', 'church_leadership', 'guest', 'deacon', 'priest'),
      allowNull: false,
      defaultValue: 'member'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active'
    },
    registration_status: {
      type: DataTypes.ENUM('pending', 'complete', 'incomplete'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'registration_status'
    },
    interested_in_serving: {
      type: DataTypes.ENUM('yes', 'no', 'maybe'),
      allowNull: true,
      defaultValue: 'maybe',
      comment: 'Whether the member is interested in serving in ministries',
      field: 'interested_in_serving'
    }
  }, {
    sequelize,
    modelName: 'Member',
    tableName: 'members',
    timestamps: true,
    underscored: true
  });

  return Member;
}; 