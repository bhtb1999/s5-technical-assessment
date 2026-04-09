"use strict";

const express = require("express");
const { z } = require("zod");
const { Op } = require("sequelize");
const { Campaign, Recipient, CampaignRecipient, User } = require("../models");
const auth = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { processSend } = require("../services/campaignService");

const router = express.Router();

router.use(auth);

const createCampaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  subject: z.string().min(1, "Subject is required").max(255),
  body: z.string().min(1, "Body is required"),
  recipientIds: z
    .array(z.string().uuid("Each recipientId must be a valid UUID"))
    .min(1, "At least one recipient is required"),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(255).optional(),
  body: z.string().min(1).optional(),
  recipientIds: z.array(z.string().uuid()).optional(),
});

const scheduleSchema = z.object({
  scheduled_at: z
    .string()
    .datetime("scheduled_at must be a valid ISO datetime"),
});

function computeStats(campaignRecipients) {
  const total = campaignRecipients.length;
  const sent = campaignRecipients.filter((cr) => cr.status === "sent").length;
  const failed = campaignRecipients.filter(
    (cr) => cr.status === "failed",
  ).length;
  const opened = campaignRecipients.filter(
    (cr) => cr.opened_at !== null,
  ).length;
  const open_rate =
    sent > 0 ? Math.round((opened / sent) * 100 * 100) / 100 : 0;
  const send_rate =
    total > 0 ? Math.round((sent / total) * 100 * 100) / 100 : 0;
  return { total, sent, failed, opened, open_rate, send_rate };
}

async function findOwnedCampaign(campaignId, userId) {
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new AppError("Campaign not found", 404);
  if (campaign.created_by !== userId) throw new AppError("Forbidden", 403);
  return campaign;
}

router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const where = { created_by: req.user.id };
  if (req.query.status) {
    const validStatuses = ["draft", "sending", "scheduled", "sent"];
    if (!validStatuses.includes(req.query.status)) {
      throw new AppError("Invalid status filter", 400);
    }
    where.status = req.query.status;
  }

  const { count, rows: campaigns } = await Campaign.findAndCountAll({
    where,
    limit,
    offset,
    distinct: true,
    order: [["created_at", "DESC"]],
    include: [
      {
        model: CampaignRecipient,
        as: "campaignRecipients",
        attributes: ["recipient_id"],
      },
    ],
  });

  const campaignsWithCount = campaigns.map((c) => {
    const plain = c.toJSON();
    plain.recipient_count = plain.campaignRecipients
      ? plain.campaignRecipients.length
      : 0;
    delete plain.campaignRecipients;
    return plain;
  });

  return res.status(200).json({
    campaigns: campaignsWithCount,
    total: count,
    page,
    totalPages: Math.ceil(count / limit),
  });
});

router.post("/", async (req, res) => {
  const data = createCampaignSchema.parse(req.body);

  const recipients = await Recipient.findAll({
    where: { id: { [Op.in]: data.recipientIds } },
  });
  if (recipients.length !== data.recipientIds.length) {
    throw new AppError("One or more recipient IDs not found", 400);
  }

  const campaign = await Campaign.create({
    name: data.name,
    subject: data.subject,
    body: data.body,
    status: "draft",
    created_by: req.user.id,
  });

  const joinRecords = data.recipientIds.map((rid) => ({
    campaign_id: campaign.id,
    recipient_id: rid,
    status: "pending",
  }));
  await CampaignRecipient.bulkCreate(joinRecords);

  const fullCampaign = await Campaign.findByPk(campaign.id, {
    include: [
      {
        model: Recipient,
        as: "recipients",
        through: { attributes: ["status", "sent_at", "opened_at"] },
      },
    ],
  });

  return res.status(201).json({ campaign: fullCampaign });
});

router.get("/:id", async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id, {
    include: [
      {
        model: Recipient,
        as: "recipients",
        through: { attributes: ["status", "sent_at", "opened_at"] },
      },
      {
        model: CampaignRecipient,
        as: "campaignRecipients",
        attributes: ["recipient_id", "status", "sent_at", "opened_at"],
      },
      {
        model: User,
        as: "creator",
        attributes: ["id", "email", "name"],
      },
    ],
  });

  if (!campaign) throw new AppError("Campaign not found", 404);
  if (campaign.created_by !== req.user.id) throw new AppError("Forbidden", 403);

  const stats = computeStats(campaign.campaignRecipients || []);
  const result = campaign.toJSON();
  result.stats = stats;

  return res.status(200).json({ campaign: result });
});

router.patch("/:id", async (req, res) => {
  const campaign = await findOwnedCampaign(req.params.id, req.user.id);

  if (campaign.status !== "draft") {
    throw new AppError("Only draft campaigns can be edited", 400);
  }

  const data = updateCampaignSchema.parse(req.body);

  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.subject !== undefined) updates.subject = data.subject;
  if (data.body !== undefined) updates.body = data.body;

  if (Object.keys(updates).length > 0) {
    await campaign.update(updates);
  }

  if (data.recipientIds !== undefined) {
    const recipients = await Recipient.findAll({
      where: { id: { [Op.in]: data.recipientIds } },
    });
    if (recipients.length !== data.recipientIds.length) {
      throw new AppError("One or more recipient IDs not found", 400);
    }

    await CampaignRecipient.destroy({ where: { campaign_id: campaign.id } });

    const joinRecords = data.recipientIds.map((rid) => ({
      campaign_id: campaign.id,
      recipient_id: rid,
      status: "pending",
    }));
    await CampaignRecipient.bulkCreate(joinRecords);
  }

  const updated = await Campaign.findByPk(campaign.id, {
    include: [
      {
        model: Recipient,
        as: "recipients",
        through: { attributes: ["status", "sent_at", "opened_at"] },
      },
    ],
  });

  return res.status(200).json({ campaign: updated });
});

router.delete("/:id", async (req, res) => {
  const campaign = await findOwnedCampaign(req.params.id, req.user.id);

  if (campaign.status !== "draft") {
    throw new AppError("Only draft campaigns can be deleted", 400);
  }

  await CampaignRecipient.destroy({ where: { campaign_id: campaign.id } });
  await campaign.destroy();

  return res.status(204).send();
});

router.post("/:id/schedule", async (req, res) => {
  const campaign = await findOwnedCampaign(req.params.id, req.user.id);

  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new AppError(
      "Only draft or scheduled campaigns can be scheduled",
      400,
    );
  }

  const data = scheduleSchema.parse(req.body);
  const scheduledAt = new Date(data.scheduled_at);

  if (scheduledAt <= new Date()) {
    throw new AppError("scheduled_at must be a future date", 400);
  }

  await campaign.update({
    scheduled_at: scheduledAt,
    status: "scheduled",
  });

  return res.status(200).json({ campaign });
});

router.post("/:id/send", async (req, res) => {
  const campaign = await findOwnedCampaign(req.params.id, req.user.id);

  if (campaign.status === "sent" || campaign.status === "sending") {
    throw new AppError(`Campaign is already ${campaign.status}`, 409);
  }

  if (!["draft", "scheduled"].includes(campaign.status)) {
    throw new AppError("Campaign cannot be sent from its current status", 400);
  }

  await campaign.update({ status: "sending" });

  processSend(campaign);

  return res.status(202).json({
    message: "Campaign send initiated",
    campaign: {
      id: campaign.id,
      status: "sending",
    },
  });
});

router.get("/:id/stats", async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id, {
    include: [
      {
        model: CampaignRecipient,
        as: "campaignRecipients",
        attributes: ["status", "sent_at", "opened_at"],
      },
    ],
  });

  if (!campaign) throw new AppError("Campaign not found", 404);
  if (campaign.created_by !== req.user.id) throw new AppError("Forbidden", 403);

  const stats = computeStats(campaign.campaignRecipients || []);

  return res.status(200).json(stats);
});

module.exports = router;
