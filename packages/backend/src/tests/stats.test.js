'use strict';

require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const {
  sequelize,
  User,
  Recipient,
  Campaign,
  CampaignRecipient,
} = require('../models');
const bcrypt = require('bcryptjs');

let token;
let userId;
let recipientIds = [];

// ── Setup & Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await sequelize.sync({ force: true });

  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await User.create({
    email: 'stats-test@example.com',
    name: 'Stats Tester',
    password_hash: passwordHash,
  });
  userId = user.id;

  const loginRes = await request(app).post('/auth/login').send({
    email: 'stats-test@example.com',
    password: 'password123',
  });
  token = loginRes.body.token;

  // Create 5 recipients
  for (let i = 1; i <= 5; i++) {
    const r = await Recipient.create({
      email: `stats-r${i}@test.com`,
      name: `Stats Recipient ${i}`,
    });
    recipientIds.push(r.id);
  }
});

afterAll(async () => {
  await sequelize.drop();
  await sequelize.close();
});

// ── Helper: create a campaign and manually set CampaignRecipient statuses ─────

async function createCampaignWithStats({ sent = 0, failed = 0, opened = 0 } = {}) {
  const total = sent + failed;
  if (total === 0) throw new Error('Must have at least one recipient');
  if (total > recipientIds.length) throw new Error('Not enough test recipients');

  // Create campaign via API
  const createRes = await request(app)
    .post('/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Stats Campaign',
      subject: 'Stats Subject',
      body: 'Stats body',
      recipientIds: recipientIds.slice(0, total),
    });

  const campaignId = createRes.body.campaign.id;

  // Manually patch CampaignRecipient records to desired statuses
  const allCRs = await CampaignRecipient.findAll({
    where: { campaign_id: campaignId },
  });

  const now = new Date();
  for (let i = 0; i < allCRs.length; i++) {
    const cr = allCRs[i];
    if (i < sent) {
      const didOpen = i < opened;
      await cr.update({
        status: 'sent',
        sent_at: now,
        opened_at: didOpen ? now : null,
      });
    } else {
      await cr.update({ status: 'failed', sent_at: null, opened_at: null });
    }
  }

  // Mark campaign as sent so it's realistic
  await Campaign.update({ status: 'sent' }, { where: { id: campaignId } });

  return campaignId;
}

// ── Stats calculation tests ───────────────────────────────────────────────────

describe('GET /campaigns/:id/stats', () => {
  it('should return zero stats for a brand-new draft campaign', async () => {
    const createRes = await request(app)
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Zero Stats',
        subject: 'Zero Subject',
        body: 'Zero body',
        recipientIds: [recipientIds[0], recipientIds[1]],
      });

    const id = createRes.body.campaign.id;

    const res = await request(app)
      .get(`/campaigns/${id}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.sent).toBe(0);
    expect(res.body.failed).toBe(0);
    expect(res.body.opened).toBe(0);
    expect(res.body.open_rate).toBe(0);
    expect(res.body.send_rate).toBe(0);
  });

  it('should compute correct stats when all recipients are sent', async () => {
    // 3 sent, 0 failed, 2 opened
    const id = await createCampaignWithStats({ sent: 3, failed: 0, opened: 2 });

    const res = await request(app)
      .get(`/campaigns/${id}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.sent).toBe(3);
    expect(res.body.failed).toBe(0);
    expect(res.body.opened).toBe(2);
    // open_rate = opened/sent * 100 = 2/3 * 100 = 66.67
    expect(res.body.open_rate).toBeCloseTo(66.67, 1);
    // send_rate = sent/total * 100 = 3/3 * 100 = 100
    expect(res.body.send_rate).toBe(100);
  });

  it('should compute correct stats with a mix of sent and failed', async () => {
    // 2 sent, 2 failed, 1 opened
    const id = await createCampaignWithStats({ sent: 2, failed: 2, opened: 1 });

    const res = await request(app)
      .get(`/campaigns/${id}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.sent).toBe(2);
    expect(res.body.failed).toBe(2);
    expect(res.body.opened).toBe(1);
    // open_rate = 1/2 * 100 = 50
    expect(res.body.open_rate).toBe(50);
    // send_rate = 2/4 * 100 = 50
    expect(res.body.send_rate).toBe(50);
  });

  it('should compute correct stats when all recipients failed', async () => {
    // 0 sent, 2 failed, 0 opened
    const id = await createCampaignWithStats({ sent: 0, failed: 2, opened: 0 });

    const res = await request(app)
      .get(`/campaigns/${id}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.sent).toBe(0);
    expect(res.body.failed).toBe(2);
    expect(res.body.opened).toBe(0);
    // open_rate = 0 (no sent)
    expect(res.body.open_rate).toBe(0);
    // send_rate = 0/2 * 100 = 0
    expect(res.body.send_rate).toBe(0);
  });

  it('should return stats embedded in GET /campaigns/:id response', async () => {
    const id = await createCampaignWithStats({ sent: 3, failed: 1, opened: 2 });

    const res = await request(app)
      .get(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.campaign.stats).toBeDefined();
    expect(res.body.campaign.stats.total).toBe(4);
    expect(res.body.campaign.stats.sent).toBe(3);
    expect(res.body.campaign.stats.failed).toBe(1);
    expect(res.body.campaign.stats.opened).toBe(2);
    expect(res.body.campaign.stats.open_rate).toBeCloseTo(66.67, 1);
    expect(res.body.campaign.stats.send_rate).toBe(75);
  });

  it('should return 404 for a non-existent campaign stats request', async () => {
    const res = await request(app)
      .get('/campaigns/00000000-0000-4000-a000-000000000000/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 when requesting stats for another user\'s campaign', async () => {
    const id = await createCampaignWithStats({ sent: 1, failed: 1, opened: 0 });

    // Create a second user
    const passwordHash = await bcrypt.hash('password123', 10);
    await User.create({
      email: 'stats-other@example.com',
      name: 'Stats Other',
      password_hash: passwordHash,
    });
    const otherLogin = await request(app).post('/auth/login').send({
      email: 'stats-other@example.com',
      password: 'password123',
    });
    const otherToken = otherLogin.body.token;

    const res = await request(app)
      .get(`/campaigns/${id}/stats`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});

// ── Stats via inline campaign detail ─────────────────────────────────────────

describe('Stats accuracy after background send completes', () => {
  it('all CampaignRecipient records should be non-pending after send completes', async () => {
    // Create a campaign with 2 recipients
    const createRes = await request(app)
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Background Send Stats',
        subject: 'Subject',
        body: 'Body',
        recipientIds: [recipientIds[0], recipientIds[1]],
      });

    const id = createRes.body.campaign.id;

    // Trigger send
    await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    // Wait for background process
    const maxWait = 10000;
    const interval = 500;
    let elapsed = 0;
    let campaign;

    while (elapsed < maxWait) {
      await new Promise((r) => setTimeout(r, interval));
      elapsed += interval;
      campaign = await Campaign.findByPk(id);
      if (campaign.status === 'sent') break;
    }

    expect(campaign.status).toBe('sent');

    // Check that all CampaignRecipients are no longer pending
    const pendingCount = await CampaignRecipient.count({
      where: { campaign_id: id, status: 'pending' },
    });
    expect(pendingCount).toBe(0);

    // Stats should reflect real results
    const statsRes = await request(app)
      .get(`/campaigns/${id}/stats`)
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.total).toBe(2);
    expect(statsRes.body.sent + statsRes.body.failed).toBe(2);
    // send_rate + some failure rate should add up to 100%
    const totalAccountedFor =
      statsRes.body.sent + statsRes.body.failed;
    expect(totalAccountedFor).toBe(statsRes.body.total);
  }, 15000);
});
