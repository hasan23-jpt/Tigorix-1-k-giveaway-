const crypto = require('crypto');
const admin = require('firebase-admin');

function db() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    const service = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(service) });
  }
  return admin.firestore();
}

const COLLECTION = 'giveawayEntries';
const CONFIG_DOC = 'giveawayConfig/main';
const WINNERS_DOC = 'giveawayWinners/main';

function hash(value) {
  const pepper = process.env.ANTI_ABUSE_PEPPER || 'change-this-pepper';
  return crypto.createHash('sha256').update(`${pepper}:${value}`).digest('hex');
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : (fwd || req.socket?.remoteAddress || 'unknown')).split(',')[0].trim();
}

function validateInitData(initData) {
  if (!initData || typeof initData !== 'string') throw new Error('Telegram authentication is missing.');
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

  const params = new URLSearchParams(initData);
  const hashValue = params.get('hash');
  const authDate = Number(params.get('auth_date') || 0);
  if (!hashValue || !authDate) throw new Error('Invalid Telegram authentication.');
  if (Math.floor(Date.now() / 1000) - authDate > 86400) throw new Error('Telegram session expired. Reopen the Mini App.');

  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hashValue))) throw new Error('Invalid Telegram authentication.');

  const userRaw = params.get('user');
  if (!userRaw) throw new Error('Telegram user data is missing.');
  return JSON.parse(userRaw);
}

async function telegram(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(body)
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.description || `Telegram ${method} failed`);
  return d.result;
}

async function getOrCreateConfig() {
  const firestore = db();
  const ref = firestore.doc(CONFIG_DOC);
  return firestore.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists) return snap.data();
    const now = admin.firestore.Timestamp.now();
    const ends = new admin.firestore.Timestamp(now.seconds + 5 * 60 * 60, now.nanoseconds);
    const data = { startedAt: now, endsAt: ends, status: 'open', createdAt: now };
    tx.set(ref, data);
    return data;
  });
}

function timestampToIso(ts) { return ts?.toDate ? ts.toDate().toISOString() : null; }

module.exports = { admin, db, COLLECTION, CONFIG_DOC, WINNERS_DOC, hash, clientIp, validateInitData, telegram, getOrCreateConfig, timestampToIso };
