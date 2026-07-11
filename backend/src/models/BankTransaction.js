'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class BankTransaction extends Model {
        static associate(models) {
            BankTransaction.belongsTo(models.Member, {
                foreignKey: 'member_id',
                as: 'member'
            });
        }
    }

    BankTransaction.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        transaction_hash: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        balance: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'UNKNOWN'
        },
        status: {
            type: DataTypes.ENUM('PENDING', 'MATCHED', 'IGNORED'),
            defaultValue: 'PENDING'
        },
        payer_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        external_ref_id: {
            type: DataTypes.STRING,
            allowNull: true
        },
        check_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        raw_data: {
            type: DataTypes.JSON,
            allowNull: true
        },
        member_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'members',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        },
        reconciled_source: {
            // MANUAL | AUTO_LINKED | AUTO_MEMBER | AUTO_EXPENSE
            type: DataTypes.STRING(30),
            allowNull: true
        },
        reconciled_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        reconciled_meta: {
            // Details needed to audit/undo an automatic reconciliation, e.g.
            // { transaction_id, created, prev_external_id, ledger_entry_id, reason }
            type: DataTypes.JSON,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'BankTransaction',
        tableName: 'bank_transactions',
        underscored: true,
        timestamps: true
    });

    return BankTransaction;
};
