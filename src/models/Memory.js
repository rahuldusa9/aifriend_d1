const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  aiFriendId: { type: mongoose.Schema.Types.ObjectId, ref: 'AIFriend', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  context: { type: Object, default: {} },
  lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Memory', memorySchema);
