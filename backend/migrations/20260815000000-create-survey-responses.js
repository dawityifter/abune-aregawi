'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('survey_responses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      survey_slug: { type: Sequelize.STRING(100), allowNull: false },
      locale: { type: Sequelize.STRING(5), allowNull: false },
      member_status: { type: Sequelize.STRING(30), allowNull: true },
      answers: { type: Sequelize.JSONB, allowNull: false },
      ip_hash: { type: Sequelize.STRING(64), allowNull: true },
      submitted_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
    });
    await queryInterface.addIndex('survey_responses', ['survey_slug'], { name: 'survey_responses_slug_idx' });
    await queryInterface.addIndex('survey_responses', ['survey_slug', 'submitted_at'], { name: 'survey_responses_slug_submitted_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('survey_responses');
  }
};
