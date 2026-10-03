const { db, CONFIG_DOC, WINNERS_DOC, getOrCreateConfig, timestampToIso } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const config = await getOrCreateConfig();
    const snap = await db().doc(WINNERS_DOC).get();
    const winners = snap.exists ? (snap.data().winners || []) : [];
    res.status(200).json({
      startedAt: timestampToIso(config.startedAt),
      endsAt: timestampToIso(config.endsAt),
      status: config.status || 'open',
      winners
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
