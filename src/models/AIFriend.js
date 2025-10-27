const mongoose = require('mongoose');

const aiFriendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  personality: { type: [String], default: [] },
  backstory: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AIFriend', aiFriendSchema);
