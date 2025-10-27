const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const AIFriend = require('../models/AIFriend');

const createSchema = Joi.object({
  name: Joi.string().min(2).required(),
  personality: Joi.array().items(Joi.string()).default([]),
  backstory: Joi.string().allow('').default('')
});

router.post('/', auth, async (req, res) => {
  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const friend = new AIFriend({ userId: req.user.id, name: value.name, personality: value.personality, backstory: value.backstory });
    await friend.save();
    res.json({ friend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const friends = await AIFriend.find({ userId: req.user.id });
    res.json({ friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
