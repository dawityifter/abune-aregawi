module.exports = (sequelize) => {
  const { DataTypes, Model } = require('sequelize');

  /**
   * Learned mapping from a normalized bank debit description/payee to an
   * expense classification (GL code + optional vendor/employee/payee).
   * Written every time the treasurer manually reconciles an expense;
   * read by the auto-reconcile pass on CSV upload.
   */
  class ExpenseMemoMatch extends Model {
    static associate(models) {
      ExpenseMemoMatch.belongsTo(models.Vendor, {
        foreignKey: 'vendor_id',
        as: 'vendor'
      });
      ExpenseMemoMatch.belongsTo(models.Employee, {
        foreignKey: 'employee_id',
        as: 'employee'
      });
    }
  }

  ExpenseMemoMatch.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    match_key: {
      type: DataTypes.STRING(512),
      allowNull: false
    },
    source_type: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    gl_code: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    payee_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    vendor_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    employee_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    raw_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_from_bank_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ExpenseMemoMatch',
    tableName: 'expense_memo_matches',
    underscored: true,
    indexes: [
      { unique: true, fields: ['match_key'] },
      { fields: ['gl_code'] }
    ]
  });

  return ExpenseMemoMatch;
};
