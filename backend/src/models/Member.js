const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const Member = sequelize.define('Member', {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // 👤 Personal Information
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    middleName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    gender: {
      type: DataTypes.ENUM('Male', 'Female'),
      allowNull: false
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    maritalStatus: {
      type: DataTypes.ENUM('Single', 'Married', 'Divorced', 'Widowed'),
      allowNull: false
    },

    // 🏡 Contact & Address
    phoneNumber: {
      type: DataTypes.STRING(25),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    streetLine1: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    apartmentNo: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    postalCode: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'United States'
    },

    // 🧑‍🤝‍🧑 Family / Household Information
    isHeadOfHousehold: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    familyId: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'Links family members together. Head of household has familyId = their own id'
    },
    spouseEmail: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Email of spouse for family linking'
    },
    spouseName: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    emergencyContactName: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    emergencyContactPhone: {
      type: DataTypes.STRING(25),
      allowNull: true
    },

    // 🙏 Spiritual Information (Orthodox-specific)
    dateJoinedParish: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    baptismName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Baptism name'
    },
    interestedInServing: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    ministries: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'JSON array of ministry participations'
    },
    languagePreference: {
      type: DataTypes.ENUM('English', 'Tigrigna', 'Amharic'),
      defaultValue: 'English'
    },

    // 💰 Contribution & Giving
    memberId: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true,
      comment: 'Member/Envelope ID'
    },
    preferredGivingMethod: {
      type: DataTypes.ENUM('Cash', 'Online', 'Envelope', 'Check'),
      defaultValue: 'Cash'
    },
    titheParticipation: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },

    // 🌐 Account / System Access
    firebaseUid: {
      type: DataTypes.STRING(128),
      allowNull: true,
      unique: true,
      comment: 'Firebase Authentication UID'
    },
    loginEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true, // Optional since Firebase handles authentication
      validate: {
        len: [8, 255]
      }
    },
    role: {
      type: DataTypes.ENUM(
        'admin',
        'church_leadership',
        'treasurer',
        'secretary',
        'member',
        'guest'
      ),
      defaultValue: 'member'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },

    // Metadata
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
    tableName: 'members',
    timestamps: true,
    hooks: {
      beforeCreate: async (member) => {
        if (member.password) {
          member.password = await bcrypt.hash(member.password, 12);
        }
        // Generate member ID if not provided
        if (!member.memberId) {
          member.memberId = `MEM${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        }
      },
      beforeUpdate: async (member) => {
        if (member.changed('password') && member.password) {
          member.password = await bcrypt.hash(member.password, 12);
        }
      }
    }
  });

  // Instance methods
  Member.prototype.comparePassword = async function(candidatePassword) {
    if (!this.password) {
      return false; // No password stored, so no match possible
    }
    return await bcrypt.compare(candidatePassword, this.password);
  };

  Member.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    return values;
  };

  // Class methods
  Member.associate = (models) => {
    // Define associations here
    Member.hasMany(models.Dependant, {
      foreignKey: 'memberId',
      as: 'dependants'
    });
    
    // Contribution association will be added when Contribution model is created
    // Member.hasMany(models.Contribution, {
    //   foreignKey: 'memberId',
    //   as: 'contributions'
    // });
  };

  return Member;
}; 