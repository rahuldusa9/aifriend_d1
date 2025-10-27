const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const AIFriend = require('../models/AIFriend');
const aiService = require('../services/aiService');
const memoryService = require('../services/memoryService');
const mongoose = require('mongoose');

const sendSchema = Joi.object({
  friendId: Joi.string().required(),
  message: Joi.string().min(1).required(),
  safeMode: Joi.boolean().default(true)
});

router.post('/send', auth, async (req, res) => {
  const { error, value } = sendSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    // validate friend id
    if (!mongoose.Types.ObjectId.isValid(value.friendId)) return res.status(400).json({ message: 'Invalid friendId' });
    const friend = await AIFriend.findById(value.friendId);
    if (!friend) return res.status(404).json({ message: 'Friend not found' });

    // Save user message
    const userMsg = new Chat({ senderId: req.user.id, receiverId: friend._id, message: value.message, fromAI: false });
    try {
      await userMsg.save();
      // Emit user message to involved parties (sender and receiver rooms)
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(String(req.user.id)).emit('chat:message', userMsg.toObject ? userMsg.toObject() : userMsg);
          io.to(String(friend._id)).emit('chat:message', userMsg.toObject ? userMsg.toObject() : userMsg);
        }
      } catch (emitErr) {
        console.warn('[chats] emit userMsg failed:', emitErr);
      }
    } catch (saveErr) {
      console.error('[chats] Failed to save user message:', saveErr);
      return res.status(500).json({ message: 'Failed to save message' });
    }

    // Build context and call aiService
    const context = await memoryService.buildContext(req.user.id, friend._id);

    let replyText = null;
    try {
      replyText = await aiService.getReply({ userId: req.user.id, friend, message: value.message, context, safeMode: value.safeMode });
    } catch (aiErr) {
      console.error('[chats] aiService.getReply failed:', aiErr);
      // Provide a fallback reply so the user sees something and the flow continues
      replyText = 'Hmm, I\'m having trouble replying right now. Let\'s try again in a moment.';
    }

    // Ensure replyText is a string
    if (!replyText || typeof replyText !== 'string') replyText = String(replyText || '');

    // Save AI reply (best-effort)
    const aiMsg = new Chat({ senderId: friend._id, receiverId: req.user.id, message: replyText, fromAI: true });
    try {
      await aiMsg.save();
      // Emit AI reply to the user
      try {
        const io = req.app.get('io');
        if (io) io.to(String(req.user.id)).emit('chat:message', aiMsg.toObject ? aiMsg.toObject() : aiMsg);
      } catch (emitErr) {
        console.warn('[chats] emit aiMsg failed:', emitErr);
      }
    } catch (saveErr) {
      console.error('[chats] Failed to save AI message:', saveErr);
      // still return reply so UI shows something; memory update skipped
      return res.json({ reply: replyText, chat: null });
    }

    // Update memory (non-blocking)
    try {
      await memoryService.updateMemory(friend._id, req.user.id, { lastInteraction: new Date(), snippet: replyText });
    } catch (memErr) {
      console.warn('[chats] updateMemory failed:', memErr);
    }

    res.json({ reply: replyText, chat: aiMsg });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/history/:friendId', auth, async (req, res) => {
  try {
    const friendId = req.params.friendId;
    if (!mongoose.Types.ObjectId.isValid(friendId)) return res.status(400).json({ message: 'Invalid friendId' });
    // Safely coerce user id to ObjectId if possible; otherwise use string
    let uid;
  if (mongoose.Types.ObjectId.isValid(req.user.id)) uid = new mongoose.Types.ObjectId(req.user.id);
  else uid = req.user.id;
  const fid = new mongoose.Types.ObjectId(friendId);
    const chats = await Chat.find({ $or: [ { senderId: uid, receiverId: fid }, { senderId: fid, receiverId: uid } ] }).sort({ timestamp: 1 });
    res.json({ chats });
  } catch (err) {
    console.error('[chats] history error:', err);
    // Return error message to client for easier debugging in dev. In prod, consider hiding details.
    res.status(500).json({ message: err && err.message ? err.message : 'Server error' });
  }
});

module.exports = router;
