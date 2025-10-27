const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getReply } = require('../services/aiService');

// POST /api/ai/generate
// Body: { model?: string, contents: string }
// Secured by JWT auth: useful for debugging the Gemini SDK from the server.
router.post('/generate', auth, async (req, res) => {
  const { model, contents } = req.body || {};
  if (!contents || typeof contents !== 'string') return res.status(400).json({ message: 'Missing contents' });

  try {
    // Reuse aiService but call the SDK directly via a small helper: use getReply-like wrapper
    // We create a temporary friend-like object for persona-less generation
    const friend = { name: 'DebugFriend', personality: [], backstory: '' };
    const context = { recent: [] };
    const result = await getReply({ userId: req.user.id, friend, message: contents, context, safeMode: false });
    res.json({ ok: true, text: result });
  } catch (err) {
    console.error('aiDebug error:', err);
    res.status(500).json({ message: err.message || 'AI error' });
  }
});

module.exports = router;
