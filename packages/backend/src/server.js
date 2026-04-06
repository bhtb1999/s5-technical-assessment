'use strict';

require('dotenv').config();

const app = require('./app');
const { sequelize } = require('./models');
const { processScheduledCampaigns } = require('./services/campaignService');

const PORT = process.env.PORT || 3001;
const SCHEDULER_INTERVAL_MS = 60 * 1000; // every 60 seconds

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Run once immediately on startup, then every 60 seconds
    await processScheduledCampaigns();
    setInterval(processScheduledCampaigns, SCHEDULER_INTERVAL_MS);
    console.log('Campaign scheduler started (interval: 60s).');
  } catch (err) {
    console.error('Unable to start server:', err);
    process.exit(1);
  }
}

startServer();
