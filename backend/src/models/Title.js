'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Title extends Model {
        static associate(models) {
            // One Title can belong to many Members
            Title.hasMany(models.Member, {
                foreignKey: 'title_id',
                as: 'members'
            });
        }
    }

    Title.init({
        id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: DataTypes.INTEGER
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            validate: {
                notEmpty: true
            }
        },
        abbreviation: {
            type: DataTypes.STRING(10),
            allowNull: true
        },
        priority: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Display order priority (lower is higher priority)'
        }
    }, {
        sequelize,
        modelName: 'Title',
        tableName: 'titles',
        timestamps: true, // created_at, updated_at
        underscored: true
    });

    return Title;
};
