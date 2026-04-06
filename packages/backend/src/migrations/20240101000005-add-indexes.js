'use strict';

module.exports = {
  async up(queryInterface) {
    // campaigns.created_by - speeds up "campaigns by user" queries
    await queryInterface.addIndex('campaigns', ['created_by'], {
      name: 'idx_campaigns_created_by',
    });

    // campaigns.status - speeds up status filter queries
    await queryInterface.addIndex('campaigns', ['status'], {
      name: 'idx_campaigns_status',
    });

    // campaign_recipients.campaign_id - speeds up joins on campaign
    await queryInterface.addIndex('campaign_recipients', ['campaign_id'], {
      name: 'idx_campaign_recipients_campaign_id',
    });

    // campaign_recipients.recipient_id - speeds up joins on recipient
    await queryInterface.addIndex('campaign_recipients', ['recipient_id'], {
      name: 'idx_campaign_recipients_recipient_id',
    });

    // campaign_recipients.status - speeds up pending/sent/failed lookups
    await queryInterface.addIndex('campaign_recipients', ['status'], {
      name: 'idx_campaign_recipients_status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('campaigns', 'idx_campaigns_created_by');
    await queryInterface.removeIndex('campaigns', 'idx_campaigns_status');
    await queryInterface.removeIndex(
      'campaign_recipients',
      'idx_campaign_recipients_campaign_id'
    );
    await queryInterface.removeIndex(
      'campaign_recipients',
      'idx_campaign_recipients_recipient_id'
    );
    await queryInterface.removeIndex(
      'campaign_recipients',
      'idx_campaign_recipients_status'
    );
  },
};
