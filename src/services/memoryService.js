const Chat = require('../models/Chat');
const Memory = require('../models/Memory');

const MAX_CONTEXT_MESSAGES = 10;

async function buildContext(userId, aiFriendId) {
  // Pull last N messages between the user and the AI friend
  const msgs = await Chat.find({ $or: [ { senderId: userId, receiverId: aiFriendId }, { senderId: aiFriendId, receiverId: userId } ] }).sort({ timestamp: -1 }).limit(MAX_CONTEXT_MESSAGES);
  const ordered = msgs.reverse().map(m => ({ fromAI: m.fromAI, message: m.message, time: m.timestamp }));

  // Also pull memory document
  const memory = await Memory.findOne({ aiFriendId, userId });
  return { recent: ordered, memory: memory ? memory.context : {} };
}

async function updateMemory(aiFriendId, userId, patch) {
  const doc = await Memory.findOneAndUpdate(
    { aiFriendId, userId },
    { $set: { lastUpdated: new Date(), ...(patch || {}) }, $setOnInsert: { context: {} } },
    { upsert: true, new: true }
  );
  // If patch contains nested context, merge (simplified)
  if (patch && patch.snippet) {
    doc.context.latestSnippet = patch.snippet;
    await doc.save();
  }
  return doc;
}

module.exports = { buildContext, updateMemory };
