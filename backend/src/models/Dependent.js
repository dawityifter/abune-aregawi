const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Dependent = sequelize.define('Dependent', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    memberId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: {
        model: 'members',
        key: 'id'
      }
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    middleName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gender: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    relationship: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    baptismName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    isBaptized: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    baptismDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    nameDay: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    medicalConditions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    allergies: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    medications: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dietaryRestrictions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'dependents',
    timestamps: true,
    underscored: true
  });

  Dependent.associate = (models) => {
    Dependent.belongsTo(models.Member, {
      foreignKey: 'memberId',
      as: 'member'
    });
  };

  return Dependent;
}; 