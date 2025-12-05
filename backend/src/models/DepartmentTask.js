'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class DepartmentTask extends Model {
        static associate(models) {
            // Belongs to a Department
            DepartmentTask.belongsTo(models.Department, {
                foreignKey: 'department_id',
                as: 'department'
            });

            // Belongs to a Meeting (optional)
            DepartmentTask.belongsTo(models.DepartmentMeeting, {
                foreignKey: 'meeting_id',
                as: 'meeting'
            });

            // Assigned to a Member
            DepartmentTask.belongsTo(models.Member, {
                foreignKey: 'assigned_to',
                as: 'assignee'
            });

            // Created by a Member
            DepartmentTask.belongsTo(models.Member, {
                foreignKey: 'created_by',
                as: 'creator'
            });
        }
    }

    DepartmentTask.init({
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
        meeting_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'department_meetings',
                key: 'id'
            },
            comment: 'Optional link to the meeting where this task was created'
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        assigned_to: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'members',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled', 'rejected'),
            allowNull: false,
            defaultValue: 'pending'
        },
        priority: {
            type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
            allowNull: false,
            defaultValue: 'medium'
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        start_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Task start date'
        },
        end_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Task end date'
        },
        rejected_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            comment: 'Date when task was rejected (required when status=rejected)'
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Additional notes about the task'
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
        modelName: 'DepartmentTask',
        tableName: 'department_tasks',
        timestamps: true,
        underscored: true
    });

    return DepartmentTask;
};
