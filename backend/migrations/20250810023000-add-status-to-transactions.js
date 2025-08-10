'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn(
        'transactions',
        'status',
        {
          type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'canceled'),
          allowNull: false,
          defaultValue: 'succeeded',
          comment: 'Settlement status for the transaction'
        },
        { transaction }
      );

      await queryInterface.addIndex('transactions', ['status'], { transaction });

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeIndex('transactions', ['status'], { transaction });
      await queryInterface.removeColumn('transactions', 'status', { transaction });
      // Note: Enum type cleanup for Postgres
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_transactions_status\";", { transaction });
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
};
