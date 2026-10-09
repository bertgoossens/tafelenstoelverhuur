const test = require('node:test');
const assert = require('node:assert');
const { validate, createLimiter } = require('../bestelling');
const { createApp } = require('../app');

const valid = { name: 'Jan Peeters', email: 'jan@example.com', phone: '', from: '2027-06-12', summary: '  20 × Beuken klapstoelen — € 50,00' };

async function withServer(app, fn) {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}
const post = (base, body) => fetch(base + '/api/bestelling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('validatie keurt een correcte aanvraag goed', () => {
  assert.deepEqual(validate(valid, '2026-10-09').errors, []);
});

test('validatie weigert foute velden', () => {
  const { errors } = validate({ name: 'J', email: 'geen-mail', from: '2026-01-01', summary: '' }, '2026-10-09');
  assert.deepEqual(errors, ['name', 'email', 'from', 'summary']);
});

test('limiter laat max. aantal aanvragen per IP toe', () => {
  const allow = createLimiter({ max: 2 });
  assert.deepEqual([allow('a'), allow('a'), allow('a'), allow('b')], [true, true, false, true]);
});

test('zonder Resend-sleutel: 503 zodat de site terugvalt op mailto', async () => {
  await withServer(createApp({ bestelling: { env: {} } }), async base => {
    assert.equal((await post(base, valid)).status, 503);
  });
});

test('met sleutel: mail met het bestelbriefje, antwoordadres van de klant', async () => {
  const sent = [];
  const app = createApp({ bestelling: { env: { RESEND_API_KEY: 'k' }, send: async m => sent.push(m) } });
  await withServer(app, async base => {
    const res = await post(base, valid);
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'info@tafelenstoelverhuur.be');
    assert.equal(sent[0].replyTo, 'jan@example.com');
    assert.match(sent[0].subject, /12\/06\/2027 – Jan Peeters/);
    assert.match(sent[0].text, /20 × Beuken klapstoelen/);
  });
});

test('honeypot: bots krijgen ok maar er wordt niets gemaild', async () => {
  const sent = [];
  const app = createApp({ bestelling: { env: { RESEND_API_KEY: 'k' }, send: async m => sent.push(m) } });
  await withServer(app, async base => {
    assert.equal((await post(base, { ...valid, website: 'spam' })).status, 200);
    assert.equal(sent.length, 0);
  });
});

test('Resend-fout geeft 502 zodat de site terugvalt op mailto', async () => {
  const app = createApp({ bestelling: { env: { RESEND_API_KEY: 'k' }, send: async () => { throw new Error('403'); } } });
  await withServer(app, async base => {
    assert.equal((await post(base, valid)).status, 502);
  });
});

test('de site zelf wordt geserveerd', async () => {
  await withServer(createApp(), async base => {
    const res = await fetch(base + '/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /orderForm/);
  });
});
