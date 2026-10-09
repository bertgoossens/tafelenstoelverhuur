// Tafel & Stoel — de Express-app (zonder listen), zodat tests ze kunnen opbouwen.
const path = require('path');
const express = require('express');
const registerBestelling = require('./bestelling');

function createApp({ bestelling = {} } = {}) {
  const app = express();
  app.set('trust proxy', 1); // Render zit achter een proxy: nodig voor req.ip

  // Bestelaanvragen (/api/bestelling).
  registerBestelling(app, bestelling);

  // Statische site (public/).
  app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

  return app;
}

module.exports = { createApp };
