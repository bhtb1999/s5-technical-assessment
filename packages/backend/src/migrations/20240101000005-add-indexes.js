"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex("campaigns", ["created_by"], {
      name: "idx_campaigns_created_by",
    });

    await queryInterface.addIndex("campaigns", ["status"], {
      name: "idx_campaigns_status",
    });

    await queryInterface.addIndex("campaign_recipients", ["campaign_id"], {
      name: "idx_campaign_recipients_campaign_id",
    });

    await queryInterface.addIndex("campaign_recipients", ["recipient_id"], {
      name: "idx_campaign_recipients_recipient_id",
    });

    await queryInterface.addIndex("campaign_recipients", ["status"], {
      name: "idx_campaign_recipients_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("campaigns", "idx_campaigns_created_by");
    await queryInterface.removeIndex("campaigns", "idx_campaigns_status");
    await queryInterface.removeIndex(
      "campaign_recipients",
      "idx_campaign_recipients_campaign_id",
    );
    await queryInterface.removeIndex(
      "campaign_recipients",
      "idx_campaign_recipients_recipient_id",
    );
    await queryInterface.removeIndex(
      "campaign_recipients",
      "idx_campaign_recipients_status",
    );
  },
};
