"use strict";

const express = require("express");
const { z } = require("zod");
const { Op } = require("sequelize");
const { Recipient } = require("../models");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

const createRecipientSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(255, "Name too long"),
});

router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const search = req.query.search?.trim();

  const where = search
    ? {
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};

  const { count, rows: recipients } = await Recipient.findAndCountAll({
    where,
    limit,
    offset,
    order: [["created_at", "DESC"]],
  });

  const totalPages = Math.ceil(count / limit);

  return res.status(200).json({
    recipients,
    total: count,
    page,
    totalPages,
  });
});

router.post("/", async (req, res) => {
  const data = createRecipientSchema.parse(req.body);

  const [recipient, created] = await Recipient.findOrCreate({
    where: { email: data.email },
    defaults: {
      name: data.name,
    },
  });

  return res.status(created ? 201 : 200).json({ recipient });
});

module.exports = router;
