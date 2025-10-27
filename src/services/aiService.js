// AI service that formats prompt, calls Gemini via @google/genai (when configured),
// else falls back to a simple rule-based reply.

let aiClient = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (GEMINI_API_KEY) {
  try {
    try {
      const { GoogleGenAI } = require('@google/genai');
      aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    } catch (e) {
      // SDK not available; use local adapter with SDK-like API
      const { GoogleGenAI } = require('../lib/googleGenAIAdapter');
      aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
  } catch (err) {
    console.warn('Failed to initialize @google/genai client:', err.message);
    aiClient = null;
  }
}

async function callGemini(prompt) {
  if (!aiClient) throw new Error('No Gemini client configured');

  // If the client exposes models.generateContent (official SDK), call it.
  if (aiClient.models && typeof aiClient.models.generateContent === 'function') {
    const resp = await aiClient.models.generateContent({ model: GEMINI_MODEL, contents: prompt });
    if (resp?.text) return resp.text;
    if (resp?.outputText) return resp.outputText;
    if (resp?.output_text) return resp.output_text;
    if (Array.isArray(resp?.output) && resp.output.length) {
      const parts = [];
      for (const item of resp.output) {
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c.text === 'string') parts.push(c.text);
            else if (typeof c === 'string') parts.push(c);
          }
        } else if (typeof item === 'string') {
          parts.push(item);
        }
      }
      if (parts.length) return parts.join('\n');
    }
    if (Array.isArray(resp?.candidates) && resp.candidates.length) {
      const cand = resp.candidates[0];
      if (cand?.content && Array.isArray(cand.content)) {
        const c0 = cand.content[0];
        if (c0?.text) return c0.text;
        if (typeof c0 === 'string') return c0;
      }
      if (cand?.output_text) return cand.output_text;
      if (cand?.text) return cand.text;
    }
    return JSON.stringify(resp).slice(0, 2000);
  }

  // If the client provides chat-like API (chats.create)... use that
  if (aiClient.chats && typeof aiClient.chats.create === 'function') {
    const session = aiClient.chats.create({ model: GEMINI_MODEL, history: [] });
    const out = await session.sendMessage({ message: prompt });
    if (out && typeof out.text === 'string') return out.text;
    if (typeof out === 'string') return out;
    return JSON.stringify(out).slice(0, 2000);
  }

  throw new Error('aiClient does not support known call patterns');
}


async function callGeminiREST(prompt) {
  // Use Google's Generative Language REST endpoint as a fallback when SDK is not present.
  const axios = require('axios');
  const model = GEMINI_MODEL;
  const key = GEMINI_API_KEY;

  // Try v1beta2 then v1 endpoint shapes (some deployments use v1beta2 or v1)
  const baseUrls = [
    `https://generativelanguage.googleapis.com/v1/models/${model}:generate`,
    `https://generativelanguage.googleapis.com/v1beta2/models/${model}:generate`,
  ];

  for (const base of baseUrls) {
    // Use the generateContent variant that your example shows works with gemini-2.5-flash
    const url = `${base.replace(/:generate$/, ':generateContent')}?key=${encodeURIComponent(key)}`;
    try {
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: { temperature: 0.7 }
      };

      const resp = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 20000 });
      const data = resp.data;

      // Parse the vx.js-style response: candidates[0].content.parts[0].text
      if (Array.isArray(data?.candidates) && data.candidates.length) {
        try {
          const cand = data.candidates[0];
          // cand.content can be an object with `parts` or an array of content objects
          if (cand?.content) {
            // If content is an object with parts
            if (cand.content.parts && Array.isArray(cand.content.parts) && cand.content.parts.length) {
              const firstPart = cand.content.parts[0];
              if (firstPart?.text) return firstPart.text;
            }

            // If content is an array of content items
            if (Array.isArray(cand.content)) {
              for (const contentItem of cand.content) {
                if (contentItem?.parts && Array.isArray(contentItem.parts) && contentItem.parts.length) {
                  const firstPart = contentItem.parts[0];
                  if (firstPart?.text) return firstPart.text;
                }
              }
            }
          }
        } catch (e) {
          // ignore and continue to other shapes
        }
      }

      // Fallback: try other common fields
      if (typeof data?.text === 'string') return data.text;
      if (data?.outputText) return data.outputText;
      if (data?.response) return data.response;
      // fallback to stringify
      return JSON.stringify(data).slice(0, 2000);
    } catch (err) {
      console.warn('[aiService] REST attempt failed for', url, err.response ? (err.response.status + ' ' + JSON.stringify(err.response.data)) : err.message);
      continue;
    }
  }

  throw new Error('REST Gemini endpoints all failed');
}

function applyPersonalityTransform(reply, personality = []) {
  if (!personality || personality.length === 0) return reply;
  if (personality.includes('playful')) reply = reply + ' 😊';
  if (personality.includes('supportive')) reply = reply + ' — I believe in you.';
  return reply;
}

async function getReply({ userId, friend, message, context, safeMode = true }) {
  const personality = friend.personality || [];
  const backstory = friend.backstory || '';

  // Build a prompt using the user's provided middleware template, mapped to our data.
  // recent messages are formatted as short lines to avoid accidental echo.
  const recentLines = (context && context.recent ? context.recent.map(msg => (msg.fromAI ? `${friend.name}: ${msg.message}` : `User: ${msg.message}`)) : []).join('\n');

  // map username: prefer context.username, fall back to userId or generic 'User'
  const username = (context && context.username) || (userId && String(userId)) || 'User';
  const personalityStr = Array.isArray(personality) ? personality.join(', ') : String(personality || '');
  const mode = safeMode ? 'safe' : 'normal';
  const before_chats = recentLines;

  // Use the exact template the user provided, with a short extra guard to avoid echoing.
  let systemInstructions = `You are an AI friend for a user named ${username}.\n` +
    `Your personality type is: ${personalityStr}.\n` +
    `Rules:\n` +
    `1. Respond as per your personality in mode ${mode}.\n` +
    `2. Keep responses short to medium length (2–4 sentences) if required more length you can.\n` +
    `3. Never give harmful advice.\n` +
    `4. Occasionally use emojis to make your replies feel lively.\n` +
    `5. Tailor your responses according to your personality type:\n\n` +
    `6.you can respond in a personal way Always reply in the **same language and style** the user uses. 
   - If the user types in Romanized Telugu, Hindi, or any other language using English letters, reply in the same style.
   - If the user types in English, reply in English.  \n` +
    `-give the responses such that user should be addicted to your words talk like how friend talks\n\n` +
    `past chat :"${before_chats}"\n\n` +
    `User message: "${message}"\n\n` +
    `Reply:`;

  // Extra guard: ensure model is instructed not to verbatim echo the user's message.
  systemInstructions += '\nDo NOT repeat the user\'s exact input back to them.';

  // The client code expects a `prompt` variable — alias the built instructions to `prompt`.
  const prompt = systemInstructions;

  try {
    if (aiClient) {
      try {
        console.log('[aiService] Using Gemini SDK model', GEMINI_MODEL, 'prompt-trunc:', prompt.slice(0, 400).replace(/\n+/g, ' '));
        let raw = await callGemini(prompt);
        console.log('[aiService] Gemini SDK raw response-trunc:', (raw || '').toString().slice(0, 400).replace(/\n+/g, ' '));

        // If the model echoed user's message, retry via SDK
        if (raw && raw.trim() === message.trim()) {
          const retryPrompt = `DO NOT ECHO THE USER. ${systemInstructions}\n\nContext:\n${recentLines}\n\nUser: ${message}\n\nReply without repeating the user's message:`;
          raw = await callGemini(retryPrompt);
          console.log('[aiService] Gemini SDK retry response-trunc:', (raw || '').toString().slice(0, 400).replace(/\n+/g, ' '));
        }

        if (raw && raw.trim() !== message.trim()) {
          const post = applyPersonalityTransform(raw, personality);
          if (safeMode) {
            try {
              const mod = await moderateResponse(post);
              if (!mod.ok) return sanitize(mod.replacement || 'Sorry, I cannot provide that.');
              return sanitize(mod.text || post);
            } catch (merr) {
              console.warn('[aiService] moderation failed, returning sanitized reply', merr.message);
              return sanitize(post);
            }
          }
          return post;
        }
      } catch (errInner) {
        console.warn('[aiService] Gemini SDK call failed:', errInner.message);
      }
    }

    // If SDK not present or failed, try REST
    if (GEMINI_API_KEY) {
      try {
        console.log('[aiService] Falling back to Gemini REST endpoint for model', GEMINI_MODEL);
        let raw = await callGeminiREST(prompt);
        console.log('[aiService] Gemini REST raw response-trunc:', (raw || '').toString().slice(0, 400).replace(/\n+/g, ' '));
        if (raw && raw.trim() === message.trim()) {
          const retryPrompt = `DO NOT ECHO THE USER. ${systemInstructions}\n\nContext:\n${recentLines}\n\nUser: ${message}\n\nReply without repeating the user's message:`;
          raw = await callGeminiREST(retryPrompt);
          console.log('[aiService] Gemini REST retry response-trunc:', (raw || '').toString().slice(0, 400).replace(/\n+/g, ' '));
        }
        if (raw && raw.trim() !== message.trim()) {
          const post = applyPersonalityTransform(raw, personality);
          if (safeMode) {
            try {
              const mod = await moderateResponse(post);
              if (!mod.ok) return sanitize(mod.replacement || 'Sorry, I cannot provide that.');
              return sanitize(mod.text || post);
            } catch (merr) {
              console.warn('[aiService] moderation failed, returning sanitized reply', merr.message);
              return sanitize(post);
            }
          }
          return post;
        }
      } catch (errRest) {
        console.warn('[aiService] Gemini REST calls failed:', errRest.message);
      }
    }
  } catch (err) {
    console.warn('Gemini call failed or not configured, falling back to local reply:', err.message);
  }

  const local = localReply(message, personality);
  if (safeMode) {
    try {
      const mod = await moderateResponse(local);
      if (!mod.ok) return sanitize(mod.replacement || 'Sorry, I cannot provide that.');
      return sanitize(mod.text || local);
    } catch (e) {
      return sanitize(local);
    }
  }
  return local;
}

function localReply(message, personality) {
  const msg = (message || '').trim();
  const lower = msg.toLowerCase();

  // Greeting / small talk
  if (/^(hi|hello|hey)\b/.test(lower)) {
    return `Hey there! I'm ${personality && personality.includes('playful') ? 'feeling great 😄' : 'here and ready to chat.'}`;
  }

  // How are you
  if (/(how are you|how's it going|how r u)/.test(lower)) {
    return `I'm doing well — thanks for asking! How can I help you today?`;
  }

  // Short question -> give concise answer or ask clarifying question
  if (lower.endsWith('?') || /^(what|why|how|where|when)\b/.test(lower)) {
    // Very small heuristic answers for common patterns
    if (lower.includes('ai') && lower.includes('work')) {
      return `AI learns patterns from data and uses models to make predictions — in short, it finds patterns and responds. Want a one-line analogy?`;
    }
    return `That's a good question — can you tell me a bit more about what you mean, so I can answer better?`;
  }

  // Fallback: avoid echoing, ask to clarify or reframe
  let base = `I hear you. Could you tell me more or ask a specific question so I can help?`;
  if (personality.includes('playful')) base = `Ooh, interesting! ${base}`;
  if (personality.includes('supportive')) base = `${base} I'm here for you.`;
  return base;
}

function sanitize(text) {
  return text.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '').slice(0, 1000);
}

// Simple moderation hook. Replace with a real moderation API for production.
async function moderateResponse(text) {
  const lower = (text || '').toLowerCase();
  // very small blacklist for demo purposes
  const blacklist = ['suicide', 'kill myself', 'bomb', 'child porn', 'explode', 'meth', 'how to make a gun', 'illegal'];
  for (const term of blacklist) {
    if (lower.includes(term)) {
      return { ok: false, reason: 'blocked', replacement: 'Sorry, I can’t help with that.' };
    }
  }
  // No flags
  return { ok: true, text };
}

module.exports = { getReply };
