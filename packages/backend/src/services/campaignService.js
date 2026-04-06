'use strict';

const { Campaign, CampaignRecipient } = require('../models');

async function processSend(campaign) {
  try {
    const pendingRecipients = await CampaignRecipient.findAll({
      where: { campaign_id: campaign.id, status: 'pending' },
    });

    for (const cr of pendingRecipients) {
      const delay = Math.floor(Math.random() * 1300) + 200;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const success = Math.random() < 0.8;
      await cr.update({
        status: success ? 'sent' : 'failed',
        sent_at: success ? new Date() : null,
      });
    }

    await campaign.update({ status: 'sent' });
    console.log(`Campaign ${campaign.id} ("${campaign.name}") send complete.`);
  } catch (err) {
    console.error(`Background send failed for campaign ${campaign.id}:`, err);
    try {
      await campaign.update({ status: 'sent' });
    } catch (innerErr) {
      console.error('Failed to update campaign status after send error:', innerErr);
    }
  }
}

async function processScheduledCampaigns() {
  const { Op } = require('sequelize');

  // Pick up overdue scheduled campaigns
  const dueCampaigns = await Campaign.findAll({
    where: {
      status: 'scheduled',
      scheduled_at: { [Op.lte]: new Date() },
    },
  });

  if (dueCampaigns.length > 0) {
    console.log(`Scheduler: found ${dueCampaigns.length} campaign(s) due to send.`);
    for (const campaign of dueCampaigns) {
      await campaign.update({ status: 'sending' });
      processSend(campaign);
    }
  }

  // Recover campaigns stuck in 'sending' (e.g. server restarted mid-send)
  const stuckCampaigns = await Campaign.findAll({
    where: { status: 'sending' },
  });

  if (stuckCampaigns.length > 0) {
    console.log(`Scheduler: recovering ${stuckCampaigns.length} stuck campaign(s).`);
    for (const campaign of stuckCampaigns) {
      processSend(campaign);
    }
  }
}

module.exports = { processSend, processScheduledCampaigns };
