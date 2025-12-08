'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ActivityLog extends Model {
        static associate(models) {
            // Define association here
            ActivityLog.belongsTo(models.Member, {
                foreignKey: 'user_id',
                as: 'actor'
            });
        }
    }

    ActivityLog.init({
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'members', // Name of the table being referenced
                key: 'id',
            }
        },
        action: {
            type: DataTypes.STRING, // e.g. 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
            allowNull: false
        },
        entity_type: {
            type: DataTypes.STRING, // e.g. 'Member', 'Donation'
            allowNull: true
        },
        entity_id: {
            type: DataTypes.STRING, // ID of the entity
            allowNull: true
        },
        details: {
            type: DataTypes.JSONB, // Changed values, metadata, etc.
            allowNull: true
        },
        ip_address: {
            type: DataTypes.STRING,
            allowNull: true
        },
        user_agent: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'ActivityLog',
        tableName: 'activity_logs',
        underscored: true, // Use snake_case for DB columns
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return ActivityLog;
};
