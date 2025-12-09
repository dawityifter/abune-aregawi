'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class Voicemail extends Model {
        static associate(models) {
            // Future associations can go here (e.g. member lookups)
        }
    }

    Voicemail.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        fromNumber: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'from_number'
        },
        recordingUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
            field: 'recording_url'
        },
        recordingDuration: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'recording_duration'
        },
        transcriptionText: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'transcription_text'
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
        modelName: 'Voicemail',
        tableName: 'voicemails',
        timestamps: true,
        underscored: true
    });

    return Voicemail;
};
