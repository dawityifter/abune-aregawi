'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class DepartmentMeeting extends Model {
        static associate(models) {
            // Belongs to a Department
            DepartmentMeeting.belongsTo(models.Department, {
                foreignKey: 'department_id',
                as: 'department'
            });

            // Created by a Member
            DepartmentMeeting.belongsTo(models.Member, {
                foreignKey: 'created_by',
                as: 'creator'
            });

            // Has many Tasks
            DepartmentMeeting.hasMany(models.DepartmentTask, {
                foreignKey: 'meeting_id',
                as: 'tasks'
            });
        }
    }

    DepartmentMeeting.init({
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        department_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'departments',
                key: 'id'
            }
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        meeting_date: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        location: {
            type: DataTypes.STRING,
            allowNull: true
        },
        purpose: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Short description of the meeting purpose'
        },
        agenda: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Detailed agenda for the meeting'
        },
        attendees: {
            type: DataTypes.JSONB,
            allowNull: true,
            defaultValue: [],
            comment: 'List of member IDs or names who attended'
        },
        minutes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Rich text content of meeting minutes'
        },
        created_by: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'members',
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'DepartmentMeeting',
        tableName: 'department_meetings',
        timestamps: true,
        underscored: true
    });

    return DepartmentMeeting;
};
