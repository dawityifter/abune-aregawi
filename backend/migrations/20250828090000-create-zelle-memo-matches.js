'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('zelle_memo_matches', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      member_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'members',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      first_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      last_name: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      memo: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Indexes to speed up lookups by memo and member
    await queryInterface.addIndex('zelle_memo_matches', ['member_id']);
    await queryInterface.addIndex('zelle_memo_matches', ['memo'], { name: 'zelle_memo_matches_memo_idx' });

    // Optional: enforce unique memo to a single member to avoid ambiguity
    // Comment out if multiple members may share the same memo value.
    await queryInterface.addConstraint('zelle_memo_matches', {
      fields: ['memo'],
      type: 'unique',
      name: 'zelle_memo_matches_memo_unique'
    });

    console.log('✅ Created zelle_memo_matches table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeConstraint('zelle_memo_matches', 'zelle_memo_matches_memo_unique').catch(() => {});
    await queryInterface.removeIndex('zelle_memo_matches', 'zelle_memo_matches_memo_idx').catch(() => {});
    await queryInterface.removeIndex('zelle_memo_matches', ['member_id']).catch(() => {});
    await queryInterface.dropTable('zelle_memo_matches');
    console.log('✅ Dropped zelle_memo_matches table');
  }
};
