const axios = require('axios');

class ChatSession {
  constructor(apiKey, model, history = []) {
    this.apiKey = apiKey;
    this.model = model;
    this.history = history || [];
  }

  async sendMessage({ message }) {
    // Build a single prompt from history + user message
    const lines = [];
    for (const turn of this.history) {
      const role = turn.role || (turn.user ? 'user' : 'model');
      const parts = turn.parts || [];
      const text = parts.map(p => p.text || '').join('\n');
      if (text) lines.push(`${role === 'user' ? 'User' : 'Assistant'}: ${text}`);
    }
    lines.push(`User: ${message}`);
    const prompt = lines.join('\n') + '\nAssistant:';

    // Try REST endpoints
    const model = this.model;
    const key = this.apiKey;
    const baseUrls = [
      `https://generativelanguage.googleapis.com/v1/models/${model}:generate`,
      `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generate`,
    ];

    for (const base of baseUrls) {
      const url = `${base}?key=${encodeURIComponent(key)}`;
      try {
        const payload = { prompt: { text: prompt } };
        const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
        const data = resp.data;
        // Extract text like callGeminiREST
        if (typeof data?.text === 'string') return { text: data.text };
        if (data?.outputText) return { text: data.outputText };
        if (Array.isArray(data?.candidates) && data.candidates.length) {
          const c = data.candidates[0];
          if (c?.content && Array.isArray(c.content)) {
            const out = c.content.map(x => (typeof x === 'string' ? x : x?.text || '')).join('\n');
            return { text: out };
          }
          if (c?.text) return { text: c.text };
        }
        if (Array.isArray(data?.output) && data.output.length) {
          const parts = [];
          for (const item of data.output) {
            if (Array.isArray(item.content)) {
              for (const c of item.content) {
                if (typeof c.text === 'string') parts.push(c.text);
                else if (typeof c === 'string') parts.push(c);
              }
            }
          }
          if (parts.length) return { text: parts.join('\n') };
        }
        // fallback
        return { text: JSON.stringify(data).slice(0, 2000) };
      } catch (err) {
        // try next endpoint
        continue;
      }
    }

    throw new Error('All REST endpoints failed');
  }
}

class GoogleGenAI {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || process.env.GEMINI_API_KEY || '';
    this.chats = {
      create: ({ model, history }) => new ChatSession(this.apiKey, model, history),
    };
  }
}

module.exports = { GoogleGenAI };
