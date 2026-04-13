'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('members', 'members_new_email_key');
  },

  async down(queryInterface) {
    await queryInterface.addIndex('members', ['email'], {
      unique: true,
      name: 'members_new_email_key'
    });
  }
};
