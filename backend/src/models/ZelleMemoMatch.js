module.exports = (sequelize) => {
  const { DataTypes, Model } = require('sequelize');

  class ZelleMemoMatch extends Model {
    static associate(models) {
      ZelleMemoMatch.belongsTo(models.Member, {
        foreignKey: 'member_id',
        as: 'member'
      });
    }
  }

  ZelleMemoMatch.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    member_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    memo: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    sequelize,
    modelName: 'ZelleMemoMatch',
    tableName: 'zelle_memo_matches',
    underscored: true
  });

  return ZelleMemoMatch;
};
