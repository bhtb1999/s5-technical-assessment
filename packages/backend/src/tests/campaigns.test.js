'use strict';

require('dotenv').config();
const request = require('supertest');
const app = require('../app');
const { sequelize, User, Recipient, Campaign, CampaignRecipient } = require('../models');
const bcrypt = require('bcryptjs');

let token;
let userId;
let recipientIds = [];

// ── Setup & Teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  await sequelize.sync({ force: true });

  // Create a test user
  const passwordHash = await bcrypt.hash('password123', 10);
  const user = await User.create({
    email: 'campaigns-test@example.com',
    name: 'Campaign Tester',
    password_hash: passwordHash,
  });
  userId = user.id;

  // Log in to get token
  const loginRes = await request(app).post('/auth/login').send({
    email: 'campaigns-test@example.com',
    password: 'password123',
  });
  token = loginRes.body.token;

  // Create test recipients
  const r1 = await Recipient.create({ email: 'r1@test.com', name: 'Recipient One' });
  const r2 = await Recipient.create({ email: 'r2@test.com', name: 'Recipient Two' });
  const r3 = await Recipient.create({ email: 'r3@test.com', name: 'Recipient Three' });
  recipientIds = [r1.id, r2.id, r3.id];
});

afterAll(async () => {
  await sequelize.drop();
  await sequelize.close();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createDraftCampaign(overrides = {}) {
  const res = await request(app)
    .post('/campaigns')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test Campaign',
      subject: 'Test Subject',
      body: 'Test body content',
      recipientIds: [recipientIds[0], recipientIds[1]],
      ...overrides,
    });
  return res;
}

// ── Auth guard tests ──────────────────────────────────────────────────────────

describe('Campaign auth guard', () => {
  it('should return 401 when no token is provided', async () => {
    const res = await request(app).get('/campaigns');
    expect(res.status).toBe(401);
  });

  it('should return 401 when an invalid token is provided', async () => {
    const res = await request(app)
      .get('/campaigns')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });
});

// ── Create campaign ───────────────────────────────────────────────────────────

describe('POST /campaigns', () => {
  it('should create a draft campaign and return 201', async () => {
    const res = await createDraftCampaign();

    expect(res.status).toBe(201);
    expect(res.body.campaign).toBeDefined();
    expect(res.body.campaign.status).toBe('draft');
    expect(res.body.campaign.name).toBe('Test Campaign');
    expect(res.body.campaign.created_by).toBe(userId);
    expect(Array.isArray(res.body.campaign.recipients)).toBe(true);
    expect(res.body.campaign.recipients.length).toBe(2);
  });

  it('should return 400 when recipientIds is empty', async () => {
    const res = await request(app)
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'No Recipients',
        subject: 'Subject',
        body: 'Body',
        recipientIds: [],
      });

    expect(res.status).toBe(400);
  });

  it('should return 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Incomplete' });

    expect(res.status).toBe(400);
  });

  it('should return 400 when a recipientId does not exist', async () => {
    const res = await request(app)
      .post('/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Recipient',
        subject: 'Subject',
        body: 'Body',
        recipientIds: ['00000000-0000-4000-a000-000000000000'],
      });

    expect(res.status).toBe(400);
  });
});

// ── Business rule: only draft campaigns can be edited ─────────────────────────

describe('PATCH /campaigns/:id - draft-only edit rule', () => {
  it('should allow editing a draft campaign', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const res = await request(app)
      .patch(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.campaign.name).toBe('Updated Name');
  });

  it('should return 400 when trying to edit a non-draft campaign', async () => {
    // Create and immediately send to change status
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    // Send the campaign (transitions to sending)
    await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    // Try to patch the now-sending campaign
    const res = await request(app)
      .patch(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Should Not Work' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft/i);
  });
});

// ── Business rule: DELETE only allowed on draft ───────────────────────────────

describe('DELETE /campaigns/:id - draft-only delete rule', () => {
  it('should delete a draft campaign and return 204', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const res = await request(app)
      .delete(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    // Verify it's gone
    const getRes = await request(app)
      .get(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });

  it('should return 400 when deleting a non-draft campaign', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .delete(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/draft/i);
  });
});

// ── Business rule: scheduled_at must be a future date ────────────────────────

describe('POST /campaigns/:id/schedule - future date validation', () => {
  it('should schedule a campaign with a future date', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/campaigns/${id}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduled_at: futureDate });

    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe('scheduled');
  });

  it('should return 400 when scheduled_at is in the past', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/campaigns/${id}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduled_at: pastDate });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  it('should return 400 when scheduled_at is not a valid date', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const res = await request(app)
      .post(`/campaigns/${id}/schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ scheduled_at: 'not-a-date' });

    expect(res.status).toBe(400);
  });
});

// ── Business rule: send transitions status draft/scheduled → sending → sent ──

describe('POST /campaigns/:id/send - status transition', () => {
  it('should accept send on a draft campaign and return 202 with status=sending', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const res = await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(202);
    expect(res.body.campaign.status).toBe('sending');
  });

  it('should return 409 when trying to send an already-sending campaign', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    // First send
    await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    // Second send attempt
    const res = await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
  });

  it('background send eventually transitions campaign status to sent', async () => {
    const create = await createDraftCampaign({
      recipientIds: [recipientIds[0]],
    });
    const id = create.body.campaign.id;

    await request(app)
      .post(`/campaigns/${id}/send`)
      .set('Authorization', `Bearer ${token}`);

    // Wait for background process to complete (max 10 seconds)
    const maxWait = 10000;
    const interval = 500;
    let elapsed = 0;
    let finalStatus = 'sending';

    while (elapsed < maxWait) {
      await new Promise((r) => setTimeout(r, interval));
      elapsed += interval;
      const campaign = await Campaign.findByPk(id);
      finalStatus = campaign.status;
      if (finalStatus === 'sent') break;
    }

    expect(finalStatus).toBe('sent');
  }, 15000);
});

// ── Ownership enforcement ─────────────────────────────────────────────────────

describe('Campaign ownership', () => {
  let otherToken;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    await User.create({
      email: 'other-user@example.com',
      name: 'Other User',
      password_hash: passwordHash,
    });

    const loginRes = await request(app).post('/auth/login').send({
      email: 'other-user@example.com',
      password: 'password123',
    });
    otherToken = loginRes.body.token;
  });

  it('should return 403 when accessing another user\'s campaign', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const res = await request(app)
      .get(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 403 when deleting another user\'s campaign', async () => {
    const create = await createDraftCampaign();
    const id = create.body.campaign.id;

    const res = await request(app)
      .delete(`/campaigns/${id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });
});
