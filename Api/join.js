const { db, COLLECTION, getOrCreateConfig, validateInitData, hash, clientIp, admin, telegram } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { initData, wallet, deviceId } = req.body || {};
    const user = validateInitData(initData);
    const normalizedWallet = String(wallet || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) return res.status(400).json({ error: 'Invalid USDT BEP20 wallet address.' });
    if (!deviceId || String(deviceId).length < 10 || String(deviceId).length > 200) return res.status(400).json({ error: 'Device verification is missing. Reload the Mini App.' });

    const config = await getOrCreateConfig();
    if (config.status !== 'open' || config.endsAt.toMillis() <= Date.now()) return res.status(400).json({ error: 'The giveaway has ended.' });

    const community = process.env.COMMUNITY_CHANNEL || '@Tigorix';
    const member = await telegram('getChatMember', { chat_id: community, user_id: user.id });
    const allowed = ['creator', 'administrator', 'member', 'restricted'].includes(member.status) && (member.status !== 'restricted' || member.is_member !== false);
    if (!allowed) return res.status(403).json({ error: 'Join the TIGORIX Community channel first.' });

    const firestore = db();
    const userRef = firestore.collection(COLLECTION).doc(String(user.id));
    const ipHash = hash(clientIp(req));
    const deviceHash = hash(String(deviceId));
    const walletLower = normalizedWallet.toLowerCase();

    const existing = await userRef.get();
    if (existing.exists) return res.status(409).json({ error: 'You have already entered this giveaway.' });

    const ipSnap = await firestore.collection(COLLECTION).where('ipHash', '==', ipHash).limit(1).get();
    if (!ipSnap.empty) return res.status(409).json({ error: 'Only one giveaway entry is allowed per IP address.' });

    const deviceSnap = await firestore.collection(COLLECTION).where('deviceHash', '==', deviceHash).limit(1).get();
    if (!deviceSnap.empty) return res.status(409).json({ error: 'Only one giveaway entry is allowed per device.' });

    const walletSnap = await firestore.collection(COLLECTION).where('wallet', '==', walletLower).limit(1).get();
    if (!walletSnap.empty) return res.status(409).json({ error: 'This wallet address has already been used.' });

    await userRef.create({
      telegramId: String(user.id),
      username: user.username || null,
      firstName: user.first_name || null,
      wallet: normalizedWallet,
      walletLower,
      ipHash,
      deviceHash,
      joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      winner: false
    });

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Unable to join.' });
  }
};
