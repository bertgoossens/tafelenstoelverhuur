// Tafel & Stoel — start de Express-server: de site + de bestel-API.
const { createApp } = require('./app');

const app = createApp();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Tafel & Stoel draait op http://localhost:${PORT}`);
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠  RESEND_API_KEY is niet ingesteld — het bestelformulier valt terug op een mailto-link.');
  }
});
