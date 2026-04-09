"use strict";

require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const campaignRoutes = require("./routes/campaigns");
const recipientRoutes = require("./routes/recipients");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);
app.use("/campaigns", campaignRoutes);
app.use("/recipients", recipientRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
