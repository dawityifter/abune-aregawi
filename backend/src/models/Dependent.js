const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Dependent = sequelize.define('Dependent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    memberId: {
      type: DataTypes.UUID,
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
      allowNull: false
    },
    gender: {
      type: DataTypes.ENUM('Male', 'Female'),
      allowNull: false
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
    timestamps: true
  });

  Dependent.associate = (models) => {
    Dependent.belongsTo(models.Member, {
      foreignKey: 'memberId',
      as: 'member'
    });
  };

  return Dependent;
}; 