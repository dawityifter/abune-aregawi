module.exports = (sequelize) => {
  const { DataTypes, Model } = require('sequelize');

  /**
   * Persistent record of every Zelle email seen by the Gmail sync.
   * Gives the treasurer an audit trail and powers the review queue,
   * instead of re-fetching Gmail live on every page load.
   *
   * status:
   *  - AUTO_CREATED : transaction auto-created from a learned payer match
   *  - NEEDS_REVIEW : no confident match; awaiting treasurer action
   *  - CREATED      : transaction created manually by treasurer
   *  - IGNORED      : treasurer dismissed this email
   *  - ERROR        : processing failed (see error column)
   *  - MATCHED      : treasurer associated this payer with a member; no transaction yet
   *  - BANK_POSTED  : bank reconciliation created the transaction for this payment
   *                   before anyone created it from the email
   */
  class ZelleEmailQueue extends Model {
    static associate(models) {
      ZelleEmailQueue.belongsTo(models.Member, {
        foreignKey: 'matched_member_id',
        as: 'matchedMember'
      });
      ZelleEmailQueue.belongsTo(models.Transaction, {
        foreignKey: 'transaction_id',
        as: 'transaction'
      });
      ZelleEmailQueue.belongsTo(models.BankTransaction, {
        foreignKey: 'bank_transaction_id',
        as: 'bankTransaction'
      });
    }
  }

  ZelleEmailQueue.init({
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    gmail_id: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    external_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    payer_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    // When Gmail received the email. payment_date is this instant cut to a
    // Chicago date; this keeps the time so same-day payments sort correctly.
    email_received_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    subject: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    matched_member_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    match_confidence: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    match_source: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'NEEDS_REVIEW'
    },
    transaction_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    // The bank row this payment was confirmed against. Unique: one bank row
    // can never satisfy two emails.
    bank_transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    matched_by: {
      type: DataTypes.BIGINT,
      allowNull: true,
      defaultValue: null
    },
    matched_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null
    }
  }, {
    sequelize,
    modelName: 'ZelleEmailQueue',
    tableName: 'zelle_email_queue',
    underscored: true,
    indexes: [
      { unique: true, fields: ['external_id'] },
      { fields: ['status'] },
      { fields: ['matched_member_id'] },
      { unique: true, fields: ['bank_transaction_id'], name: 'zelle_email_queue_bank_transaction_id_unique' },
      { fields: ['payment_date', 'email_received_at'], name: 'zelle_email_queue_payment_date_received_at' }
    ]
  });

  return ZelleEmailQueue;
};
