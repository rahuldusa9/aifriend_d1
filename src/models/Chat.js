const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  receiverId: { type: mongoose.Schema.Types.ObjectId },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  chatType: { type: String, enum: ['individual', 'group'], default: 'individual' },
  fromAI: { type: Boolean, default: false },
  metadata: { type: Object, default: {} }
});

module.exports = mongoose.model('Chat', chatSchema);
