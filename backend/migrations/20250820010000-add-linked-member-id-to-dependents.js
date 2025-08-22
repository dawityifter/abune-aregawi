'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add linked_member_id to dependents if it doesn't exist, with FK to members(id)
    const table = await queryInterface.describeTable('dependents');

    if (!table.linked_member_id) {
      await queryInterface.addColumn('dependents', 'linked_member_id', {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });

      // Index to speed up lookups by linked member
      await queryInterface.addIndex('dependents', ['linked_member_id'], {
        name: 'idx_dependents_linked_member_id'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index and column
    try {
      await queryInterface.removeIndex('dependents', 'idx_dependents_linked_member_id');
    } catch (_) {
      // ignore if index doesn't exist
    }

    await queryInterface.removeColumn('dependents', 'linked_member_id');
  }
};
