'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campaign_recipients', {
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'campaigns',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      recipient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: {
          model: 'recipients',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      opened_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'sent', 'failed'),
        allowNull: false,
        defaultValue: 'pending',
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('campaign_recipients');
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_campaign_recipients_status";'
    );
  },
};
