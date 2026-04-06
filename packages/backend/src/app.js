'use strict';

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const campaignRoutes = require('./routes/campaigns');
const recipientRoutes = require('./routes/recipients');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/auth', authRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/recipients', recipientRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
