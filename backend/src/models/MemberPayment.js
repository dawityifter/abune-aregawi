const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MemberPayment = sequelize.define('MemberPayment', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    memberId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'member_id',
      references: {
        model: 'members',
        key: 'id'
      }
    },
    memberName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'member_name'
    },
    spouseName: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'spouse_name'
    },
    phone1: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'phone_1'
    },
    phone2: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'phone_2'
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'payment_method'
    },
    monthlyPayment: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'monthly_payment'
    },
    totalAmountDue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'total_amount_due'
    },
    january: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    february: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    march: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    april: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    may: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    june: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    july: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    august: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    september: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    october: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    november: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    december: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    totalCollected: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'total_collected'
    },
    balanceDue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'balance_due'
    },
    paidUpToDate: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'paid_up_to_date'
    },
    numberOfHousehold: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'number_of_household'
    }
  }, {
    tableName: 'member_payments_2024',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Define associations
  MemberPayment.associate = (models) => {
    MemberPayment.belongsTo(models.Member, {
      foreignKey: 'memberId',
      as: 'member'
    });
  };

  return MemberPayment;
}; 