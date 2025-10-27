require('dotenv').config();

(async () => {
  try {
    const aiService = require('../src/services/aiService');
    const friend = { name: 'Aanya', personality: ['supportive','playful'], backstory: 'A helpful AI friend' };
    console.log('Using GEMINI_API_KEY present?', !!process.env.GEMINI_API_KEY);
    const reply = await aiService.getReply({ userId: 'test-user', friend, message: 'who are you', context: { recent: [] }, safeMode: false });
    console.log('AI reply:', reply);
  } catch (err) {
    console.error('Test error:', err);
  }
})();
