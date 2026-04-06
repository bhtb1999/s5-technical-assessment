'use strict';

const bcrypt = require('bcryptjs');

// Use crypto.randomUUID if available (Node 15.6+), otherwise fallback
function generateUUID() {
  try {
    return require('crypto').randomUUID();
  } catch {
    // Simple fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const passwordHash = await bcrypt.hash('password123', 10);

    // ── Users ────────────────────────────────────────────────────────────────
    const user1Id = generateUUID();
    const user2Id = generateUUID();

    await queryInterface.bulkInsert('users', [
      {
        id: user1Id,
        email: 'alice@example.com',
        name: 'Alice Johnson',
        password_hash: passwordHash,
        created_at: now,
      },
      {
        id: user2Id,
        email: 'bob@example.com',
        name: 'Bob Smith',
        password_hash: passwordHash,
        created_at: now,
      },
    ]);

    // ── Recipients ───────────────────────────────────────────────────────────
    const r1Id = generateUUID();
    const r2Id = generateUUID();
    const r3Id = generateUUID();
    const r4Id = generateUUID();
    const r5Id = generateUUID();

    await queryInterface.bulkInsert('recipients', [
      { id: r1Id, email: 'charlie@example.com', name: 'Charlie Brown', created_at: now },
      { id: r2Id, email: 'diana@example.com',  name: 'Diana Prince',  created_at: now },
      { id: r3Id, email: 'evan@example.com',   name: 'Evan Rogers',   created_at: now },
      { id: r4Id, email: 'fiona@example.com',  name: 'Fiona Green',   created_at: now },
      { id: r5Id, email: 'george@example.com', name: 'George Miller', created_at: now },
    ]);

    // ── Campaigns ────────────────────────────────────────────────────────────
    const c1Id = generateUUID(); // draft
    const c2Id = generateUUID(); // scheduled
    const c3Id = generateUUID(); // sent

    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    await queryInterface.bulkInsert('campaigns', [
      {
        id: c1Id,
        name: 'Welcome Campaign',
        subject: 'Welcome to our platform!',
        body: '<h1>Welcome!</h1><p>We are so glad to have you on board.</p>',
        status: 'draft',
        scheduled_at: null,
        created_by: user1Id,
        created_at: now,
        updated_at: now,
      },
      {
        id: c2Id,
        name: 'Product Launch',
        subject: 'Exciting new features coming soon!',
        body: '<h1>Big announcement!</h1><p>We have been working hard on something exciting.</p>',
        status: 'scheduled',
        scheduled_at: futureDate,
        created_by: user1Id,
        created_at: now,
        updated_at: now,
      },
      {
        id: c3Id,
        name: 'Monthly Newsletter',
        subject: 'Your monthly update is here',
        body: '<h1>Newsletter</h1><p>Here is what happened this month.</p>',
        status: 'sent',
        scheduled_at: null,
        created_by: user2Id,
        created_at: now,
        updated_at: now,
      },
    ]);

    // ── CampaignRecipients ────────────────────────────────────────────────────
    const sentTime = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
    const openTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

    await queryInterface.bulkInsert('campaign_recipients', [
      // Draft campaign recipients (pending)
      { campaign_id: c1Id, recipient_id: r1Id, status: 'pending', sent_at: null, opened_at: null },
      { campaign_id: c1Id, recipient_id: r2Id, status: 'pending', sent_at: null, opened_at: null },
      { campaign_id: c1Id, recipient_id: r3Id, status: 'pending', sent_at: null, opened_at: null },

      // Scheduled campaign recipients (pending)
      { campaign_id: c2Id, recipient_id: r2Id, status: 'pending', sent_at: null,    opened_at: null },
      { campaign_id: c2Id, recipient_id: r3Id, status: 'pending', sent_at: null,    opened_at: null },
      { campaign_id: c2Id, recipient_id: r4Id, status: 'pending', sent_at: null,    opened_at: null },
      { campaign_id: c2Id, recipient_id: r5Id, status: 'pending', sent_at: null,    opened_at: null },

      // Sent campaign recipients (mix of sent/failed/opened)
      { campaign_id: c3Id, recipient_id: r1Id, status: 'sent',   sent_at: sentTime, opened_at: openTime },
      { campaign_id: c3Id, recipient_id: r2Id, status: 'sent',   sent_at: sentTime, opened_at: null     },
      { campaign_id: c3Id, recipient_id: r3Id, status: 'failed', sent_at: null,     opened_at: null     },
      { campaign_id: c3Id, recipient_id: r4Id, status: 'sent',   sent_at: sentTime, opened_at: openTime },
      { campaign_id: c3Id, recipient_id: r5Id, status: 'sent',   sent_at: sentTime, opened_at: null     },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('campaign_recipients', null, {});
    await queryInterface.bulkDelete('campaigns', null, {});
    await queryInterface.bulkDelete('recipients', null, {});
    await queryInterface.bulkDelete('users', null, {});
  },
};
