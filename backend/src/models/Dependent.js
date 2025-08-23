const { DataTypes } = require('sequelize');

// Define allowed relationship values
const RELATIONSHIP_VALUES = {
  SON: 'Son',
  DAUGHTER: 'Daughter', 
  SPOUSE: 'Spouse',
  PARENT: 'Parent',
  SIBLING: 'Sibling',
  OTHER: 'Other'
};

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
    linkedMemberId: {
      type: DataTypes.BIGINT,
      allowNull: true,
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
      type: DataTypes.ENUM(Object.values(RELATIONSHIP_VALUES)),
      allowNull: true,
      validate: {
        isIn: {
          args: [Object.values(RELATIONSHIP_VALUES)],
          msg: 'Relationship must be one of: Son, Daughter, Spouse, Parent, Sibling, Other'
        }
      }
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
    languagePreference: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    interestedInServing: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'no'
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

    // When a dependent self-claims, it links to a Member account
    Dependent.belongsTo(models.Member, {
      foreignKey: 'linkedMemberId',
      as: 'linkedMember'
    });
  };

  // Export the relationship values for use in other parts of the application
  Dependent.RELATIONSHIP_VALUES = RELATIONSHIP_VALUES;

  return Dependent;
}; 