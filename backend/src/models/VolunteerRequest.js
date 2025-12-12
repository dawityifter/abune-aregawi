'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class VolunteerRequest extends Model {
        static associate(models) {
            VolunteerRequest.belongsTo(models.Member, {
                foreignKey: 'member_id',
                as: 'member'
            });
        }
    }

    VolunteerRequest.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        memberId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'member_id',
            references: {
                model: 'members',
                key: 'id'
            }
        },
        message: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                len: [1, 255]
            }
        },
        agreedToContact: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'agreed_to_contact'
        },
        status: {
            type: DataTypes.ENUM('new', 'contacted', 'archived'),
            defaultValue: 'new',
            allowNull: false
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at'
        }
    }, {
        sequelize,
        modelName: 'VolunteerRequest',
        tableName: 'volunteer_requests',
        timestamps: true,
        underscored: true
    });

    return VolunteerRequest;
};
