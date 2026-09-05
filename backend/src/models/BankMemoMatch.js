module.exports = (sequelize) => {
  const { DataTypes, Model } = require('sequelize');

  class BankMemoMatch extends Model {
    static associate(models) {
      BankMemoMatch.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });

      BankMemoMatch.belongsTo(models.BankTransaction, {
        foreignKey: 'created_from_bank_transaction_id',
        as: 'sourceBankTransaction'
      });
    }
  }

  BankMemoMatch.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    source_type: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    match_key: {
      type: DataTypes.STRING(512),
      allowNull: false
    },
    raw_description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    payer_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    created_from_bank_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'BankMemoMatch',
    tableName: 'bank_memo_matches',
    underscored: true,
    indexes: [
      { fields: ['member_id'] },
      { fields: ['source_type'] },
      { unique: true, fields: ['match_key'] }
    ]
  });

  return BankMemoMatch;
};
