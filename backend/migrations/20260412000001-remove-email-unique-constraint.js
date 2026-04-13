'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeConstraint('members', 'members_new_email_key');
  },

  async down(queryInterface) {
    await queryInterface.addConstraint('members', {
      fields: ['email'],
      type: 'unique',
      name: 'members_new_email_key'
    });
  }
};
