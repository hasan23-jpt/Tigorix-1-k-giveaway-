const { db, COLLECTION, CONFIG_DOC, WINNERS_DOC, telegram, admin } = require('./_lib');

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function cryptoRandomInt(max) {
  const crypto = require('crypto');
  return crypto.randomInt(0, max);
}

module.exports = async (req, res) => {
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
  try {
    const firestore = db();
    const configRef = firestore.doc(CONFIG_DOC);
    const winnerRef = firestore.doc(WINNERS_DOC);

    const result = await firestore.runTransaction(async tx => {
      const configSnap = await tx.get(configRef);
      if (!configSnap.exists) return { done: false, reason: 'not_started' };
      const config = configSnap.data();
      if (config.status === 'finished') {
        const ws = await tx.get(winnerRef);
        return { done: true, winners: ws.exists ? (ws.data().winners || []) : [] };
      }
      if (config.endsAt.toMillis() > Date.now()) return { done: false, reason: 'not_ended', endsAt: config.endsAt.toDate().toISOString() };

      const snap = await tx.get(firestore.collection(COLLECTION).limit(5000));
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (entries.length < 10) return { done: false, reason: 'not_enough_entries', count: entries.length };

      const selected = shuffle(entries.slice()).slice(0, 10);
      const winners = selected.map(e => ({
        telegramId: e.telegramId,
        username: e.username || null,
        firstName: e.firstName || null,
        amount: 0.1,
        wallet: e.wallet
      }));
      tx.set(winnerRef, { winners, selectedAt: admin.firestore.FieldValue.serverTimestamp() });
      tx.update(configRef, { status: 'finished', finishedAt: admin.firestore.FieldValue.serverTimestamp() });
      for (const e of selected) tx.update(firestore.collection(COLLECTION).doc(e.id), { winner: true });
      return { done: true, winners };
    });

    if (!result.done) return res.status(200).json(result);
    if (result._notified) return res.status(200).json(result);

    // Notify only once using a Firestore notification lock.
    const lockRef = firestore.doc('giveawayMeta/notification');
    const lock = await firestore.runTransaction(async tx => {
      const s = await tx.get(lockRef);
      if (s.exists && s.data().sent) return false;
      tx.set(lockRef, { sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
      return true;
    });

    if (lock) {
      const lines = result.winners.map((w, i) => `${i+1}. ${w.username ? '@'+w.username : w.firstName || 'Telegram User'} — 0.1 USDT`).join('\n');
      const channelText = `🐯 <b>TIGORIX 1K COMMUNITY GIVEAWAY — WINNERS</b>\n\n🎉 Congratulations to our 10 random winners!\n\n${lines}\n\n💰 Prize: 0.1 USDT each\n🐯 TIGORIX — MINE • EARN • GROW`;
      await telegram('sendMessage', { chat_id: process.env.COMMUNITY_CHANNEL || '@Tigorix', text: channelText, parse_mode: 'HTML' });

      const adminLines = result.winners.map((w, i) => `${i+1}. ${w.username ? '@'+w.username : w.firstName || 'Telegram User'}\n   Amount: 0.1 USDT\n   Wallet: ${w.wallet}\n   Telegram ID: ${w.telegramId}`).join('\n\n');
      await telegram('sendMessage', { chat_id: process.env.ADMIN_CHAT_ID || '5767112472', text: `🐯 <b>TIGORIX GIVEAWAY WINNERS</b>\n\n${adminLines}`, parse_mode: 'HTML' });
    }

    res.status(200).json({ done: true, winners: result.winners });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unable to finish giveaway.' });
  }
};
