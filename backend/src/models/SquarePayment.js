module.exports = (sequelize) => {
  const { DataTypes, Model } = require('sequelize');

  /**
   * Persistent record of every Square payment seen by the webhook or backfill.
   * Ingest queue + audit trail, mirroring zelle_email_queue.
   *
   * status:
   *  - NEEDS_REVIEW : ingested, no confident match (default; POS taps land here)
   *  - AUTO_MATCHED : ingested with a confident learned match; awaits treasurer confirm
   *  - CREATED      : treasurer confirmed; a Transaction exists (transaction_id set)
   *  - IGNORED      : treasurer dismissed this payment
   *  - REFUNDED     : reserved for the future refunds phase (not written in v1)
   *  - ERROR        : processing failed (see error column)
   */
  class SquarePayment extends Model {
    static associate(models) {
      SquarePayment.belongsTo(models.Member, {
        foreignKey: 'matched_member_id',
        as: 'matchedMember'
      });
      SquarePayment.belongsTo(models.Transaction, {
        foreignKey: 'transaction_id',
        as: 'transaction'
      });
    }
  }

  SquarePayment.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    square_payment_id: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    order_id: { type: DataTypes.STRING(191), allowNull: true },
    location_id: { type: DataTypes.STRING(64), allowNull: true },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    currency: { type: DataTypes.STRING(3), allowNull: true },
    square_created_at: { type: DataTypes.DATE, allowNull: true },
    buyer_name: { type: DataTypes.STRING(255), allowNull: true },
    buyer_email: { type: DataTypes.STRING(255), allowNull: true },
    note: { type: DataTypes.TEXT, allowNull: true },
    card_brand: { type: DataTypes.STRING(40), allowNull: true },
    card_last4: { type: DataTypes.STRING(8), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'NEEDS_REVIEW' },
    matched_member_id: { type: DataTypes.BIGINT, allowNull: true },
    match_confidence: { type: DataTypes.STRING(20), allowNull: true },
    match_source: { type: DataTypes.STRING(60), allowNull: true },
    transaction_id: { type: DataTypes.BIGINT, allowNull: true },
    raw: { type: DataTypes.JSONB, allowNull: true },
    processed_at: { type: DataTypes.DATE, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true }
  }, {
    sequelize,
    modelName: 'SquarePayment',
    tableName: 'square_payments',
    underscored: true,
    indexes: [
      { unique: true, fields: ['square_payment_id'] },
      { fields: ['status'] },
      { fields: ['matched_member_id'] }
    ]
  });

  return SquarePayment;
};
