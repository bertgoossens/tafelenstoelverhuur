// Bestelaanvragen: POST /api/bestelling valideert het formulier en mailt de aanvraag via Resend.
// Zonder RESEND_API_KEY antwoordt de API met 503 en valt de website terug op een mailto-link.
//
// Omgevingsvariabelen:
//   RESEND_API_KEY   API-sleutel van Resend (verplicht om te mailen)
//   ORDER_TO         ontvanger, standaard info@tafelenstoelverhuur.be
//   ORDER_FROM       afzender (domein moet geverifieerd zijn in Resend),
//                    standaard "Tafel & Stoel <website@tafelenstoelverhuur.be>"
const express = require('express');

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

function validDate(s) {
  if (!ISO_RE.test(s)) return false;
  return new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; // weigert bv. 2026-02-31
}

function validate(body, today = new Date().toISOString().slice(0, 10)) {
  const b = body || {};
  const data = {
    name: clean(b.name, 100),
    email: clean(b.email, 200),
    phone: clean(b.phone, 40),
    from: clean(b.from, 10),
    summary: clean(b.summary, 5000), // het bestelbriefje zoals de bezoeker het op de site ziet
  };
  const errors = [];
  if (data.name.length < 2) errors.push('name');
  if (!EMAIL_RE.test(data.email)) errors.push('email');
  if (!validDate(data.from) || data.from < today) errors.push('from');
  if (!data.summary) errors.push('summary');
  return { data, errors };
}

const fmtDate = s => s.split('-').reverse().join('/');

async function sendViaResend({ apiKey, from, to, replyTo, subject, text, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend antwoordde ${res.status}: ${await res.text()}`);
}

// Eenvoudige rem: max. 5 aanvragen per IP per uur.
function createLimiter({ max = 5, windowMs = 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const hits = new Map();
  return ip => {
    const t = now();
    const list = (hits.get(ip) || []).filter(x => t - x < windowMs);
    if (list.length >= max) { hits.set(ip, list); return false; }
    list.push(t); hits.set(ip, list);
    return true;
  };
}

module.exports = function registerBestelling(app, { env = process.env, send = sendViaResend } = {}) {
  const allow = createLimiter();

  app.post('/api/bestelling', express.json({ limit: '20kb' }), async (req, res) => {
    const body = req.body || {};
    // Honeypot: bots vullen dit verborgen veld in. Doe alsof alles lukte.
    if (body.website) return res.json({ ok: true });

    const { data, errors } = validate(body);
    if (errors.length) return res.status(400).json({ error: 'invalid', fields: errors });

    if (!env.RESEND_API_KEY) return res.status(503).json({ error: 'not_configured' });
    if (!allow(req.ip)) return res.status(429).json({ error: 'too_many' });

    try {
      await send({
        apiKey: env.RESEND_API_KEY,
        from: env.ORDER_FROM || 'Tafel & Stoel <website@tafelenstoelverhuur.be>',
        to: env.ORDER_TO || 'info@tafelenstoelverhuur.be',
        replyTo: data.email,
        subject: `Reservatie tafelenstoel – ${fmtDate(data.from)} – ${data.name}`,
        text: 'Nieuwe aanvraag via tafelenstoelverhuur.be\n\n' + data.summary,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('Aanvraag mailen mislukt -', err.message);
      res.status(502).json({ error: 'send_failed' });
    }
  });
};

module.exports.validate = validate;
module.exports.createLimiter = createLimiter;
